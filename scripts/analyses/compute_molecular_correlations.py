#!/usr/bin/env python3
"""
Molecular Correlation Analysis for HistoAtlas.

This script computes:
1. Pathway scores via ssGSEA on 50 MSigDB Hallmark gene sets
2. Feature correlations (histomic <-> molecular)
3. Categorical associations (mutations, immune subtypes)
4. Cluster enrichments (mutations, pathways, immune subtypes)

All with Benjamini-Hochberg correction per cancer type and target set
(and per correlation method where applicable).
Includes unadjusted and adjusted models when covariates
are available (age, sex, stage, TSS).

Usage:
    uv run python scripts/analyses/compute_molecular_correlations.py
    uv run python scripts/analyses/compute_molecular_correlations.py --dry-run
"""

import argparse
import json
import logging
import os
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path

import pandas as pd
from compute_mutation_survival import TRACKED_GENES
from joblib import Parallel, delayed
from pandas.api.types import is_numeric_dtype
from tqdm.auto import tqdm

import histoatlas
from histoatlas import (
    AVAILABLE_GENES,
    HALLMARK_PATHWAYS,  # noqa: F401
    apply_bh_correction,
    cnv_to_category,
    compute_cluster_immune_enrichment,
    compute_cluster_mutation_enrichment,
    compute_cluster_pathway_enrichment,
    compute_hallmark_ssgsea,
    mode_or_first,
    run_categorical_analysis,
    run_correlation_analysis,
    select_case_representative_slides,
    select_column,
)

# Suppress FutureWarnings from pandas/scipy and RuntimeWarnings from correlation edge cases
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")
warnings.filterwarnings("ignore", message=".*divide by zero.*")

logger = logging.getLogger(__name__)


def _output_exists(path: Path) -> bool:
    """Check if an output file already exists (for idempotent resumption)."""
    if path.exists():
        logger.info("  ↳ Found existing %s — skipping", path.name)
        return True
    return False


def _save_parquet(df: pd.DataFrame, path: Path) -> None:
    """Save a single dataframe to parquet, creating parent dirs as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)
    logger.info("  ↳ Saved %s (%d rows)", path.name, len(df))


@dataclass
class DryRunConfig:
    """Configuration for dry-run mode to subset data for quick testing."""

    n_genes: int = 5
    n_cnv_genes: int = 5
    n_mutations: int = 3
    n_pathways: int = 3
    n_histomic_features: int = 5
    n_cancer_types: int = 2


@dataclass
class Config:
    """Configuration for the molecular correlation analysis."""

    dry_run: bool = False
    dry_run_cfg: DryRunConfig | None = None
    min_samples_per_cancer: int = 30

    def __post_init__(self) -> None:
        if self.dry_run and self.dry_run_cfg is None:
            self.dry_run_cfg = DryRunConfig()


@dataclass
class ModelConfig:
    """Configuration for a statistical model (unadjusted or adjusted)."""

    name: str
    covariate_cols: list[str]


@dataclass
class LoadedData:
    """Container for all loaded datasets."""

    slides_df: pd.DataFrame
    expression_df: pd.DataFrame
    immune_df: pd.DataFrame
    mutations_df: pd.DataFrame
    cnv_df: pd.DataFrame
    clinical_df: pd.DataFrame
    sample_df: pd.DataFrame
    phenotype_df: pd.DataFrame
    histomic_features: list[str]
    gene_cols: list[str]
    cnv_gene_cols: list[str]
    top_mutations: list[str]
    covariate_sources: dict[str, str]


@dataclass
class MergedData:
    """Container for merged dataset and derived columns."""

    df: pd.DataFrame
    histomic_features: list[str]
    gene_cols: list[str]
    cnv_merged_cols: list[str]
    pathway_cols: list[str]
    mutation_cat_cols: list[str]
    cnv_cat_cols: list[str]
    top_mutations: list[str]
    model_configs: list[ModelConfig]


def _load_slides(config: Config) -> tuple[pd.DataFrame, list[str]]:
    """Load slide-level features and extract histomic feature columns."""
    from _paths import SLIDE_HISTOMICS

    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    logger.info("Slides (raw): %d", len(slides_df))

    meta_cols = [
        "case_id",
        "cancer_type",
        "slide_name",
        "umap_1",
        "umap_2",
        "cluster_l1",
        "cluster_l2",
    ]

    if "tsne_1" in slides_df.columns and "tsne_2" in slides_df.columns:
        meta_cols.extend(["tsne_1", "tsne_2"])

    histomic_features = [
        c for c in slides_df.columns if c not in meta_cols and is_numeric_dtype(slides_df[c])
    ]

    if config.dry_run_cfg:
        histomic_features = histomic_features[: config.dry_run_cfg.n_histomic_features]
        cancer_counts = slides_df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(config.dry_run_cfg.n_cancer_types).index.tolist()
        slides_df = slides_df[slides_df["cancer_type"].isin(top_cancers)]
        logger.info(
            "Dry-run: filtered to %d slides (%d cancer types)",
            len(slides_df),
            config.dry_run_cfg.n_cancer_types,
        )

    logger.info("Histomic features: %d", len(histomic_features))
    return slides_df, histomic_features


def _load_expression(config: Config) -> tuple[pd.DataFrame, list[str]]:
    """Load expression data and extract gene columns."""
    from _paths import EXPRESSION

    expression_df = pd.read_parquet(EXPRESSION)
    if "case_id" in expression_df.columns:
        expression_df = expression_df.drop_duplicates("case_id")
    logger.info("Expression samples: %d", len(expression_df))

    gene_cols = [g for g in AVAILABLE_GENES if g in expression_df.columns]
    if config.dry_run_cfg:
        gene_cols = gene_cols[: config.dry_run_cfg.n_genes]
    logger.info("Genes: %d", len(gene_cols))

    return expression_df, gene_cols


def _load_immune(config: Config) -> pd.DataFrame:
    """Load immune subtype data. Returns empty DataFrame if file is missing."""
    from _paths import IMMUNE_SUBTYPES

    if not IMMUNE_SUBTYPES.exists():
        logger.info("Immune subtypes file not found, skipping (%s)", IMMUNE_SUBTYPES)
        return pd.DataFrame()

    immune_df = pd.read_excel(IMMUNE_SUBTYPES)
    immune_df = immune_df.rename(
        columns={
            "TCGA Participant Barcode": "case_id",
            "Immune Subtype": "immune_subtype",
            "Leukocyte Fraction": "leukocyte_fraction",
            "Lymphocyte Infiltration Signature Score": "lymphocyte_infiltration",
            "IFN-gamma Response": "ifn_gamma_response",
            "TGF-beta Response": "tgf_beta_response",
            "Wound Healing": "wound_healing",
            "Macrophage Regulation": "macrophage_regulation",
        }
    )
    if "case_id" in immune_df.columns:
        immune_df = immune_df.drop_duplicates("case_id")
    logger.info("Immune subtypes: %d", len(immune_df))
    return immune_df


def _load_clinical_covariates(
    config: Config,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict[str, str]]:
    """Load clinical, sample, and phenotype data for covariates."""
    from _paths import CLINICAL_SAMPLE, CLINICAL_UNIFIED, PHENOTYPE

    clinical_df = pd.DataFrame()
    if CLINICAL_UNIFIED.exists():
        clinical_df = pd.read_parquet(CLINICAL_UNIFIED)
        if "case_id" in clinical_df.columns:
            clinical_df = clinical_df.drop_duplicates("case_id")

    sample_df = pd.DataFrame()
    if CLINICAL_SAMPLE.exists():
        sample_df = pd.read_parquet(CLINICAL_SAMPLE)
        if "case_id" in sample_df.columns:
            sample_df = sample_df.drop_duplicates("case_id")

    phenotype_df = pd.DataFrame()
    if PHENOTYPE.exists():
        phenotype_df = pd.read_parquet(PHENOTYPE)
        if "case_id" in phenotype_df.columns:
            phenotype_df = phenotype_df.drop_duplicates("case_id")

    covariate_sources: dict[str, str] = {}
    if not clinical_df.empty:
        age_col = select_column(clinical_df, ["age_at_diagnosis", "age"])
        sex_col = select_column(clinical_df, ["sex", "gender"])
        stage_col = select_column(clinical_df, ["stage", "stage_2009"])
        if age_col:
            covariate_sources["age"] = age_col
        if sex_col:
            covariate_sources["sex"] = sex_col
        if stage_col:
            covariate_sources["stage"] = stage_col

    if not sample_df.empty:
        tss_col = select_column(sample_df, ["tissue_source_site", "tss", "tss_code"])
        if tss_col:
            covariate_sources["tss"] = tss_col

    return clinical_df, sample_df, phenotype_df, covariate_sources


def _load_mutations(config: Config) -> tuple[pd.DataFrame, list[str]]:
    """Load mutation data and identify top mutations."""
    from _paths import MUTATIONS

    mutations_df = pd.read_parquet(MUTATIONS)
    mutations_df = mutations_df.rename(columns={"sample_id": "sample_barcode"})
    mutations_df["case_id"] = mutations_df["sample_barcode"].str[:12]
    logger.info("Mutation samples: %d", len(mutations_df))

    non_gene_cols = {"sample_barcode", "case_id", "cancer_type", "patientId", "sampleId"}
    gene_cols = [c for c in mutations_df.columns if c not in non_gene_cols]
    mutation_freq = mutations_df[gene_cols].sum() / len(mutations_df)
    top_mutations = (
        mutation_freq[mutation_freq > 0.05].sort_values(ascending=False).head(30).index.tolist()
    )

    # Always include curated driver genes for mutation hub pages
    for gene in TRACKED_GENES:
        if gene in gene_cols and gene not in top_mutations:
            top_mutations.append(gene)

    if config.dry_run_cfg:
        top_mutations = top_mutations[: config.dry_run_cfg.n_mutations]
    logger.info("Top mutations (>5%%): %d", len(top_mutations))

    return mutations_df, top_mutations


def _load_cnv(config: Config) -> tuple[pd.DataFrame, list[str]]:
    """Load CNV data and identify gene columns."""
    from _paths import CNV

    cnv_df = pd.read_parquet(CNV)
    cnv_df["case_id"] = cnv_df["sample_id"].str[:12]
    logger.info("CNV samples: %d", len(cnv_df))

    cnv_gene_cols = [g for g in AVAILABLE_GENES if g in cnv_df.columns]
    if config.dry_run_cfg:
        cnv_gene_cols = cnv_gene_cols[: config.dry_run_cfg.n_cnv_genes]
    logger.info("CNV genes (curated overlap): %d", len(cnv_gene_cols))

    return cnv_df, cnv_gene_cols


def load_all_data(config: Config) -> LoadedData:
    """Load all input datasets."""
    logger.info("Loading data...")

    slides_df, histomic_features = _load_slides(config)
    expression_df, gene_cols = _load_expression(config)
    immune_df = _load_immune(config)
    clinical_df, sample_df, phenotype_df, covariate_sources = _load_clinical_covariates(config)
    mutations_df, top_mutations = _load_mutations(config)
    cnv_df, cnv_gene_cols = _load_cnv(config)

    # Enforce one slide per case to avoid pseudo-replication
    slides_df, case_meta = select_case_representative_slides(slides_df)
    logger.info(
        "Case selection: %d slides -> %d cases (dropped %d duplicates)",
        case_meta["n_rows_in"],
        case_meta["n_rows_out"],
        case_meta["n_duplicates_dropped"],
    )

    return LoadedData(
        slides_df=slides_df,
        expression_df=expression_df,
        immune_df=immune_df,
        mutations_df=mutations_df,
        cnv_df=cnv_df,
        clinical_df=clinical_df,
        sample_df=sample_df,
        phenotype_df=phenotype_df,
        histomic_features=histomic_features,
        gene_cols=gene_cols,
        cnv_gene_cols=cnv_gene_cols,
        top_mutations=top_mutations,
        covariate_sources=covariate_sources,
    )


def compute_pathway_scores(
    expression_df: pd.DataFrame, config: Config
) -> tuple[pd.DataFrame, list[str]]:
    """Compute ssGSEA Hallmark pathway scores from full expression data."""
    from _paths import EXPRESSION_FULL

    logger.info("Loading full expression matrix for ssGSEA...")
    expression_full_df = pd.read_parquet(EXPRESSION_FULL)

    # Keep only cases present in our histomics cohort
    valid_cases = set(expression_df["case_id"].unique())
    expression_full_df = expression_full_df[expression_full_df["case_id"].isin(valid_cases)].copy()
    logger.info("Matched %d cases for ssGSEA", len(expression_full_df))

    logger.info("Computing ssGSEA Hallmark pathway scores...")
    pathway_scores_df = compute_hallmark_ssgsea(expression_full_df)

    meta_cols = ["case_id", "cancer_type"]
    pathway_cols = [c for c in pathway_scores_df.columns if c not in meta_cols]

    non_nan_pathways = [c for c in pathway_cols if pathway_scores_df[c].notna().sum() > 0]
    if config.dry_run_cfg:
        non_nan_pathways = non_nan_pathways[: config.dry_run_cfg.n_pathways]

    logger.info("Pathways with data: %d/%d", len(non_nan_pathways), len(pathway_cols))
    return pathway_scores_df, non_nan_pathways


def _merge_expression(
    merged_df: pd.DataFrame, expression_df: pd.DataFrame, gene_cols: list[str]
) -> pd.DataFrame:
    """Merge expression data into the main dataframe."""
    expr_subset = expression_df[["case_id"] + gene_cols].drop_duplicates("case_id")
    merged_df = merged_df.merge(expr_subset, on="case_id", how="left")

    n_with_expr = merged_df[gene_cols[0]].notna().sum() if gene_cols else 0
    logger.info(
        "After expression merge: %d with expression (%.1f%%)",
        n_with_expr,
        n_with_expr / len(merged_df) * 100,
    )
    return merged_df


def _merge_pathways(
    merged_df: pd.DataFrame, pathway_scores_df: pd.DataFrame, pathway_cols: list[str]
) -> pd.DataFrame:
    """Merge pathway scores into the main dataframe."""
    pathway_subset = pathway_scores_df[["case_id"] + pathway_cols].drop_duplicates("case_id")
    merged_df = merged_df.merge(pathway_subset, on="case_id", how="left")

    n_with_pathway = merged_df[pathway_cols[0]].notna().sum() if pathway_cols else 0
    logger.info(
        "After pathway merge: %d with pathways (%.1f%%)",
        n_with_pathway,
        n_with_pathway / len(merged_df) * 100,
    )
    return merged_df


def _merge_immune(merged_df: pd.DataFrame, immune_df: pd.DataFrame) -> pd.DataFrame:
    """Merge immune subtype data into the main dataframe."""
    if immune_df.empty:
        logger.info("No immune subtype data available, skipping merge")
        return merged_df

    immune_cols = [
        "case_id",
        "immune_subtype",
        "leukocyte_fraction",
        "lymphocyte_infiltration",
        "ifn_gamma_response",
        "tgf_beta_response",
        "wound_healing",
        "macrophage_regulation",
    ]
    available_immune_cols = [c for c in immune_cols if c in immune_df.columns]

    missing = set(immune_cols) - set(available_immune_cols)
    if missing:
        logger.warning("Could not find the following columns in immune_df %s", missing)

    immune_subset = immune_df[available_immune_cols].copy().drop_duplicates("case_id")
    merged_df = merged_df.merge(immune_subset, on="case_id", how="left")

    n_with_immune = (
        merged_df["immune_subtype"].notna().sum() if "immune_subtype" in merged_df.columns else 0
    )
    logger.info(
        "After immune merge: %d with immune (%.1f%%)",
        n_with_immune,
        n_with_immune / len(merged_df) * 100,
    )
    return merged_df


def _merge_mutations(
    merged_df: pd.DataFrame, mutations_df: pd.DataFrame, top_mutations: list[str]
) -> pd.DataFrame:
    """Merge mutation data into the main dataframe.

    When multiple samples exist for the same case, mutation status is aggregated
    using max() - if any sample has a mutation (1), the case is marked as mutated.
    """
    if not top_mutations:
        logger.info("After mutation merge: 0 with mutations (0.0%%)")
        return merged_df

    mutation_cols_available = ["case_id"] + [g for g in top_mutations if g in mutations_df.columns]
    if len(mutation_cols_available) <= 1:
        logger.info("After mutation merge: 0 with mutations (0.0%%)")
        return merged_df

    mutation_subset = (
        mutations_df[mutation_cols_available]
        .groupby("case_id", as_index=False)
        .max(numeric_only=True)
    )
    merged_df = merged_df.merge(mutation_subset, on="case_id", how="left", suffixes=("", "_mut"))

    n_with_mut = merged_df[mutation_cols_available[1]].notna().sum()
    logger.info(
        "After mutation merge: %d with mutations (%.1f%%)",
        n_with_mut,
        n_with_mut / len(merged_df) * 100,
    )
    return merged_df


def _max_abs(series: pd.Series) -> float:
    """Return the value with the maximum absolute magnitude."""
    if series.isna().all():
        return float("nan")
    return series.iloc[series.abs().argmax()]


def _merge_cnv(
    merged_df: pd.DataFrame, cnv_df: pd.DataFrame, cnv_gene_cols: list[str]
) -> tuple[pd.DataFrame, list[str]]:
    """Merge CNV data into the main dataframe.

    When multiple samples exist for the same case, CNV GISTIC values are aggregated
    by selecting the value with the maximum absolute magnitude (most extreme alteration).
    """
    cnv_cols_for_merge = ["case_id"] + cnv_gene_cols
    cnv_subset = (
        cnv_df[cnv_cols_for_merge]
        .groupby("case_id", as_index=False)
        .agg({col: _max_abs for col in cnv_gene_cols})
    )
    cnv_subset = cnv_subset.rename(columns={g: f"{g}_cnv" for g in cnv_gene_cols})
    merged_df = merged_df.merge(cnv_subset, on="case_id", how="left")

    cnv_merged_cols = [f"{g}_cnv" for g in cnv_gene_cols]
    n_with_cnv = merged_df[cnv_merged_cols[0]].notna().sum() if cnv_merged_cols else 0
    logger.info(
        "After CNV merge: %d with CNV (%.1f%%)", n_with_cnv, n_with_cnv / len(merged_df) * 100
    )
    return merged_df, cnv_merged_cols


def _merge_covariates(
    merged_df: pd.DataFrame,
    clinical_df: pd.DataFrame,
    sample_df: pd.DataFrame,
    phenotype_df: pd.DataFrame,
    covariate_sources: dict[str, str],
) -> pd.DataFrame:
    """Merge covariate data into the main dataframe."""
    if not covariate_sources:
        return merged_df

    covariate_df = pd.DataFrame()

    if not clinical_df.empty:
        base_cols = ["case_id"]
        rename_map = {}
        for key in ["age", "sex", "stage"]:
            src = covariate_sources.get(key)
            if src and src in clinical_df.columns:
                base_cols.append(src)
                # This mapping is true only for TCGA
                rename_map[src] = {"age": "age_at_diagnosis", "sex": "sex", "stage": "stage"}[key]
        if len(base_cols) > 1:
            covariate_df = clinical_df[base_cols].copy().rename(columns=rename_map)

    if "tss" in covariate_sources and not sample_df.empty:
        tss_src = covariate_sources["tss"]
        if tss_src in sample_df.columns:
            tss_df = (
                sample_df[["case_id", tss_src]]
                .dropna()
                .groupby("case_id", as_index=False)[tss_src]
                .agg(mode_or_first)
                .rename(columns={tss_src: "tss"})
            )
            covariate_df = (
                tss_df
                if covariate_df.empty
                else covariate_df.merge(tss_df, on="case_id", how="left")
            )

    if not covariate_df.empty:
        merged_df = merged_df.merge(covariate_df, on="case_id", how="left")

    return merged_df


def _group_tss_topk(df: pd.DataFrame, k: int = 5) -> pd.DataFrame:
    """Group TSS into top-k most frequent sites + 'Other' per cancer type.

    This bounds the number of TSS dummy variables to k in the rank-based
    partial correlation residualization, avoiding sparse categories.

    NaN TSS values are preserved (not replaced with 'Other') so that
    downstream complete-case analysis correctly drops rows with missing TSS.
    """
    if "tss" not in df.columns:
        return df

    df = df.copy()
    for cancer_type in df["cancer_type"].unique():
        mask = df["cancer_type"] == cancer_type
        tss_counts = df.loc[mask, "tss"].value_counts()
        top_sites = set(tss_counts.head(k).index)
        # Only remap non-NaN, non-top-k sites to "Other"; preserve NaN
        remap_mask = mask & df["tss"].notna() & ~df["tss"].isin(top_sites)
        df.loc[remap_mask, "tss"] = "Other"

    return df


def _build_model_configs(merged_df: pd.DataFrame) -> list[ModelConfig]:
    """Build model configurations based on available covariates."""
    model_configs = [
        ModelConfig(name="unadjusted", covariate_cols=[]),
    ]

    adj_covs = []
    for cov in ["age_at_diagnosis", "sex", "stage", "tss"]:
        if cov in merged_df.columns:
            adj_covs.append(cov)

    if adj_covs:
        model_configs.append(ModelConfig(name="adjusted", covariate_cols=adj_covs))

    return model_configs


def _create_categorical_columns(
    merged_df: pd.DataFrame, top_mutations: list[str], cnv_gene_cols: list[str]
) -> tuple[pd.DataFrame, list[str], list[str]]:
    """Create categorical columns for mutations and CNV."""
    # Mutation status columns
    for gene in top_mutations:
        col_name = f"mut_{gene.lower()}"
        if gene in merged_df.columns:
            # The mapping is true for TCGA
            merged_df[col_name] = merged_df[gene].map(
                {0: "WT", 1: "Mutant", True: "Mutant", False: "WT"}
            )
            merged_df[col_name] = merged_df[col_name].where(merged_df[gene].notna())

    mutation_cat_cols = [
        f"mut_{g.lower()}" for g in top_mutations if f"mut_{g.lower()}" in merged_df.columns
    ]

    # CNV categorical columns
    # Filter CNV genes to those altered in >5% of samples, matching the frequency
    # threshold applied to somatic mutations.  This ensures adequate statistical power
    # and avoids testing rarely altered genes where group sizes are too small for
    # meaningful effect-size estimation (Sanchez-Vega et al., Cell 2018).
    MIN_CNV_ALT_FREQ = 0.05
    cnv_cat_cols = []
    n_cnv_total = 0
    for gene in cnv_gene_cols:
        cnv_col = f"{gene}_cnv"
        if cnv_col in merged_df.columns:
            n_cnv_total += 1
            cat_col = f"cnv_{gene.lower()}"
            merged_df[cat_col] = merged_df[cnv_col].apply(cnv_to_category)
            # Keep only genes altered (non-Neutral) in >5% of samples pan-cancer.
            # NaN rows (missing CNV data) must be excluded from the denominator.
            non_null = merged_df[cat_col].dropna()
            altered_frac = (non_null != "Neutral").mean() if len(non_null) > 0 else 0.0
            if altered_frac > MIN_CNV_ALT_FREQ:
                cnv_cat_cols.append(cat_col)
            else:
                merged_df.drop(columns=[cat_col], inplace=True)
    logger.info(
        "CNV genes passing %d%% alteration frequency filter: %d / %d",
        int(MIN_CNV_ALT_FREQ * 100),
        len(cnv_cat_cols),
        n_cnv_total,
    )

    return merged_df, mutation_cat_cols, cnv_cat_cols


def merge_datasets(
    loaded_data: LoadedData, pathway_scores_df: pd.DataFrame, pathway_cols: list[str]
) -> MergedData:
    """Merge all datasets into a single dataframe for analysis."""
    logger.info("Merging datasets...")

    merged_df = loaded_data.slides_df.copy()

    merged_df = _merge_expression(merged_df, loaded_data.expression_df, loaded_data.gene_cols)
    merged_df = _merge_pathways(merged_df, pathway_scores_df, pathway_cols)
    merged_df = _merge_immune(merged_df, loaded_data.immune_df)
    merged_df = _merge_mutations(merged_df, loaded_data.mutations_df, loaded_data.top_mutations)
    merged_df, cnv_merged_cols = _merge_cnv(
        merged_df, loaded_data.cnv_df, loaded_data.cnv_gene_cols
    )
    merged_df = _merge_covariates(
        merged_df,
        loaded_data.clinical_df,
        loaded_data.sample_df,
        loaded_data.phenotype_df,
        loaded_data.covariate_sources,
    )

    logger.info("Final merged: %d cases, %d columns", len(merged_df), len(merged_df.columns))

    # Group TSS into top-5 sites per cancer type + "Other" to bound dummy variables
    merged_df = _group_tss_topk(merged_df, k=5)

    model_configs = _build_model_configs(merged_df)
    merged_df, mutation_cat_cols, cnv_cat_cols = _create_categorical_columns(
        merged_df, loaded_data.top_mutations, loaded_data.cnv_gene_cols
    )

    return MergedData(
        df=merged_df,
        histomic_features=loaded_data.histomic_features,
        gene_cols=loaded_data.gene_cols,
        cnv_merged_cols=cnv_merged_cols,
        pathway_cols=pathway_cols,
        mutation_cat_cols=mutation_cat_cols,
        cnv_cat_cols=cnv_cat_cols,
        top_mutations=loaded_data.top_mutations,
        model_configs=model_configs,
    )


def run_correlation_analyses(merged_data: MergedData) -> pd.DataFrame:
    """Run all correlation analyses (pathways, expression, CNV, immune scores).

    This function tests associations between the histomics features and continuous
    molecular features (gene expression, pathway scores, immune scores, CNVs), adjusting
    for basic clinical covariates.

    The associations are tested using Spearman's correlation coefficient. P-values are
    obtained using permutation tests, and confidence intervals using bootstrapping.
    """
    logger.info("Running correlation analysis...")

    all_correlations = []
    df = merged_data.df

    from _config import include_pancan

    input_dfs = [df]
    if include_pancan():
        pancan_df = df.copy()
        pancan_df["cancer_type"] = "PANCAN"
        input_dfs.append(pancan_df)

    n_jobs = _get_n_jobs()

    for model_cfg in merged_data.model_configs:
        model_name = model_cfg.name
        cov_cols = model_cfg.covariate_cols

        for input_df in input_dfs:
            # Pathway correlations
            if merged_data.pathway_cols:
                logger.info("Pathway correlations (%s)...", model_name)
                pathway_corr_df = run_correlation_analysis(
                    input_df,
                    merged_data.histomic_features,
                    merged_data.pathway_cols,
                    molecular_type="pathway",
                    target_set_id="hallmark_ssgsea_v1",
                    model=model_name,
                    covariate_cols=cov_cols,
                    n_jobs=n_jobs,
                )
                if not pathway_corr_df.empty:
                    all_correlations.append(pathway_corr_df)
                    logger.info("  %d correlations", len(pathway_corr_df))

            # Gene expression correlations
            logger.info("Gene expression correlations (%s)...", model_name)
            gene_corr_df = run_correlation_analysis(
                input_df,
                merged_data.histomic_features,
                merged_data.gene_cols,
                molecular_type="expression",
                target_set_id="expression_curated_v1",
                model=model_name,
                covariate_cols=cov_cols,
                n_jobs=n_jobs,
            )
            if not gene_corr_df.empty:
                all_correlations.append(gene_corr_df)
                logger.info("  %d correlations", len(gene_corr_df))

            # CNV correlations
            if merged_data.cnv_merged_cols:
                logger.info("CNV correlations (%s)...", model_name)
                cnv_corr_df = run_correlation_analysis(
                    input_df,
                    merged_data.histomic_features,
                    merged_data.cnv_merged_cols,
                    molecular_type="cnv",
                    target_set_id="cnv_curated_v1",
                    model=model_name,
                    covariate_cols=cov_cols,
                    n_jobs=n_jobs,
                )
                if not cnv_corr_df.empty:
                    cnv_corr_df["molecular_feature"] = cnv_corr_df["molecular_feature"].str.replace(
                        "_cnv", ""
                    )
                    all_correlations.append(cnv_corr_df)
                    logger.info("  %d correlations", len(cnv_corr_df))

            # Immune score correlations
            immune_score_cols = [
                "leukocyte_fraction",
                "lymphocyte_infiltration",
                "ifn_gamma_response",
                "tgf_beta_response",
                "wound_healing",
                "macrophage_regulation",
            ]
            available_immune_score_cols = [c for c in immune_score_cols if c in input_df.columns]

            if available_immune_score_cols:
                logger.info("Immune score correlations (%s)...", model_name)
                immune_corr_df = run_correlation_analysis(
                    input_df,
                    merged_data.histomic_features,
                    available_immune_score_cols,
                    molecular_type="immune_score",
                    target_set_id="immune_scores_thorsson_v1",
                    model=model_name,
                    covariate_cols=cov_cols,
                    n_jobs=n_jobs,
                )
                if not immune_corr_df.empty:
                    all_correlations.append(immune_corr_df)
                    logger.info("  %d correlations", len(immune_corr_df))

    if not all_correlations:
        return pd.DataFrame()

    all_correlations_df = pd.concat(all_correlations, ignore_index=True)

    # Apply BH correction
    spearman_df = all_correlations_df.copy()
    spearman_df["corr_method"] = "spearman"
    spearman_df = apply_bh_correction(
        spearman_df,
        p_col="spearman_p",
        groupby_cols=["cancer_type", "target_set_id", "corr_method", "model"],
    )
    all_correlations_df["spearman_p_adj"] = spearman_df["p_value_adj"].values
    all_correlations_df["n_tests_in_family"] = spearman_df["n_tests_in_family"].values
    all_correlations_df["correction_family_id"] = spearman_df["correction_family_id"].values
    all_correlations_df["corr_method"] = "spearman"
    all_correlations_df["is_significant"] = all_correlations_df["spearman_p_adj"] < 0.05
    all_correlations_df["correction_method"] = "BH"

    logger.info("Total correlations: %d", len(all_correlations_df))
    logger.info(
        "Significant (Spearman p_adj < 0.05): %d", all_correlations_df["is_significant"].sum()
    )

    return all_correlations_df


def _get_n_jobs() -> int:
    """Get n_jobs from HISTOATLAS_N_JOBS env var."""

    return int(os.environ.get("HISTOATLAS_N_JOBS", "-1"))


def run_categorical_analyses(merged_data: MergedData, config: Config) -> pd.DataFrame:
    """Run all categorical association analyses.

    This function tests associations between the histomics features and categorical molecular
    features (gene mutations, CNV categorical associations, immune subtype associations),
    adjusting for basic clinical covariates.

    For unadjusted models, associations are tested using nonparametric tests
    (Mann-Whitney U / Kruskal-Wallis).
    For covariate-adjusted models, associations are tested using rank-ANCOVA with permutation
    p-values (Freedman-Lane) for robust inference under non-normality.
    """
    logger.info("Running categorical association analysis...")

    all_categorical = []
    df = merged_data.df
    n_jobs = _get_n_jobs()

    from _config import include_pancan

    input_dfs = [df]
    if include_pancan():
        pancan_df = df.copy()
        pancan_df["cancer_type"] = "PANCAN"
        input_dfs.append(pancan_df)

    for model_cfg in merged_data.model_configs:
        model_name = model_cfg.name
        cov_cols = model_cfg.covariate_cols

        for input_df in input_dfs:
            # Mutation associations
            if merged_data.mutation_cat_cols:
                logger.info("Mutation associations (%s)...", model_name)
                mutation_assoc_df = run_categorical_analysis(
                    input_df,
                    merged_data.histomic_features,
                    merged_data.mutation_cat_cols,
                    model=model_name,
                    covariate_cols=cov_cols,
                    min_samples_per_cancer=config.min_samples_per_cancer,
                    n_jobs=n_jobs,
                )
                if not mutation_assoc_df.empty:
                    all_categorical.append(mutation_assoc_df)
                    logger.info("  %d associations", len(mutation_assoc_df))

            # CNV categorical associations
            if merged_data.cnv_cat_cols:
                logger.info("CNV categorical associations (%s)...", model_name)
                cnv_assoc_df = run_categorical_analysis(
                    input_df,
                    merged_data.histomic_features,
                    merged_data.cnv_cat_cols,
                    model=model_name,
                    covariate_cols=cov_cols,
                    min_samples_per_cancer=config.min_samples_per_cancer,
                    n_jobs=n_jobs,
                )
                if not cnv_assoc_df.empty:
                    all_categorical.append(cnv_assoc_df)
                    logger.info("  %d associations", len(cnv_assoc_df))

            # Immune subtype associations
            if "immune_subtype" in input_df.columns:
                logger.info("Immune subtype associations (%s)...", model_name)
                immune_assoc_df = run_categorical_analysis(
                    input_df,
                    merged_data.histomic_features,
                    ["immune_subtype"],
                    model=model_name,
                    covariate_cols=cov_cols,
                    min_samples_per_cancer=config.min_samples_per_cancer,
                    n_jobs=n_jobs,
                )
                if not immune_assoc_df.empty:
                    all_categorical.append(immune_assoc_df)
                    logger.info("  %d associations", len(immune_assoc_df))

    if not all_categorical:
        return pd.DataFrame()

    all_categorical_df = pd.concat(all_categorical, ignore_index=True)
    all_categorical_df = apply_bh_correction(
        all_categorical_df,
        p_col="p_value",
        groupby_cols=["cancer_type", "categorical_var", "test_type", "model"],
    )
    all_categorical_df["is_significant"] = all_categorical_df["p_value_adj"] < 0.05
    all_categorical_df["correction_method"] = "BH"

    logger.info("Total associations: %d", len(all_categorical_df))
    logger.info("Significant: %d", all_categorical_df["is_significant"].sum())

    return all_categorical_df


def _mutation_enrichment_task(df: pd.DataFrame, cluster_id: int, mutation: str) -> dict | None:
    """Single mutation enrichment task for parallel execution."""
    result = compute_cluster_mutation_enrichment(
        df, "cluster_l1", mutation, cluster_id, "L1", cancer_type="PAN"
    )
    return asdict(result) if result else None


def _run_cluster_mutation_enrichment(df: pd.DataFrame, top_mutations: list[str]) -> pd.DataFrame:
    """Run cluster mutation enrichment analysis."""
    logger.info("Cluster mutation enrichment...")

    clusters = df["cluster_l1"].dropna().unique()
    valid_mutations = [m for m in top_mutations if m in df.columns]
    n_jobs = _get_n_jobs()

    mutation_tasks = [
        (cluster_id, mutation) for cluster_id in clusters for mutation in valid_mutations
    ]
    results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_mutation_enrichment_task)(df, cid, mut)
        for cid, mut in tqdm(mutation_tasks, desc="L1 mutation enrichment")
    )
    results = [r for r in results if r is not None]

    enrichment_df = pd.DataFrame(results)

    if not enrichment_df.empty:
        enrichment_df = apply_bh_correction(
            enrichment_df,
            p_col="p_value",
            groupby_cols=["cancer_type", "cluster_level", "cluster_id"],
        )
        enrichment_df["is_significant"] = enrichment_df["p_value_adj"] < 0.05
        enrichment_df["mutation_set_id"] = "top_mutations_gt5pct_v1"
        enrichment_df["test_type"] = "fisher_exact"
        enrichment_df["correction_method"] = "BH"

    logger.info("Mutation enrichments: %d", len(enrichment_df))
    if not enrichment_df.empty:
        logger.info("Significant: %d", enrichment_df["is_significant"].sum())

    return enrichment_df


def _pathway_enrichment_task(df: pd.DataFrame, cluster_id: int, pathway: str) -> dict | None:
    """Single pathway enrichment task for parallel execution."""
    result = compute_cluster_pathway_enrichment(
        df, "cluster_l1", pathway, cluster_id, "L1", cancer_type="PAN"
    )
    return asdict(result) if result else None


def _run_cluster_pathway_enrichment(df: pd.DataFrame, pathway_cols: list[str]) -> pd.DataFrame:
    """Run cluster pathway enrichment analysis."""
    if not pathway_cols:
        return pd.DataFrame()

    logger.info("Cluster pathway enrichment...")

    clusters = df["cluster_l1"].dropna().unique()
    n_jobs = _get_n_jobs()

    pathway_tasks = [(cluster_id, pathway) for cluster_id in clusters for pathway in pathway_cols]
    results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_pathway_enrichment_task)(df, cid, pw)
        for cid, pw in tqdm(pathway_tasks, desc="L1 pathway enrichment")
    )
    results = [r for r in results if r is not None]

    enrichment_df = pd.DataFrame(results)

    if not enrichment_df.empty:
        enrichment_df = apply_bh_correction(
            enrichment_df,
            p_col="p_value",
            groupby_cols=["cancer_type", "cluster_level", "cluster_id"],
        )
        enrichment_df["is_significant"] = enrichment_df["p_value_adj"] < 0.05
        enrichment_df["pathway_set_id"] = "hallmark_ssgsea_v1"
        enrichment_df["analysis_method"] = "hallmark_ssgsea_mwu"
        enrichment_df["correction_method"] = "BH"

    logger.info("Pathway enrichments: %d", len(enrichment_df))
    if not enrichment_df.empty:
        logger.info("Significant: %d", enrichment_df["is_significant"].sum())

    return enrichment_df


def _immune_enrichment_task(df: pd.DataFrame, cluster_id: int) -> list[dict]:
    """Single immune enrichment task for parallel execution."""
    enrichments = compute_cluster_immune_enrichment(
        df, "cluster_l1", cluster_id, "L1", cancer_type="PAN"
    )
    return [asdict(e) for e in enrichments]


def _run_cluster_immune_enrichment(df: pd.DataFrame) -> pd.DataFrame:
    """Run cluster immune subtype enrichment analysis."""
    logger.info("Cluster immune subtype enrichment...")

    results = []

    if "immune_subtype" in df.columns:
        clusters = df["cluster_l1"].dropna().unique()
        n_jobs = _get_n_jobs()

        task_results = Parallel(n_jobs=n_jobs, backend="loky")(
            delayed(_immune_enrichment_task)(df, cluster_id)
            for cluster_id in tqdm(list(clusters), desc="L1 immune enrichment")
        )
        for task_result in task_results:
            results.extend(task_result)

    enrichment_df = pd.DataFrame(results)

    if not enrichment_df.empty:
        enrichment_df = apply_bh_correction(
            enrichment_df,
            p_col="p_value",
            groupby_cols=["cancer_type", "cluster_level", "cluster_id"],
        )
        enrichment_df["is_significant"] = enrichment_df["p_value_adj"] < 0.05
        enrichment_df["immune_subtype_set_id"] = "thorsson_v1"
        enrichment_df["test_type"] = "fisher_exact"
        enrichment_df["correction_method"] = "BH"

    logger.info("Immune enrichments: %d", len(enrichment_df))
    if not enrichment_df.empty:
        logger.info("Significant: %d", enrichment_df["is_significant"].sum())

    return enrichment_df


def _l2_mutation_enrichment_task(
    cancer_df: pd.DataFrame, cluster_id: int, mutation: str, cancer_type: str
) -> dict | None:
    """Single L2 mutation enrichment task for parallel execution."""
    result = compute_cluster_mutation_enrichment(
        cancer_df, "cluster_l2", mutation, cluster_id, "L2", cancer_type=cancer_type
    )
    return asdict(result) if result else None


def _run_l2_cluster_mutation_enrichment(df: pd.DataFrame, top_mutations: list[str]) -> pd.DataFrame:
    """Run L2 (cancer-specific) cluster mutation enrichment analysis."""
    logger.info("L2 cluster mutation enrichment...")

    valid_mutations = [m for m in top_mutations if m in df.columns]
    if not valid_mutations:
        return pd.DataFrame()

    n_jobs = _get_n_jobs()
    cancer_types = df["cancer_type"].unique()

    tasks = []
    for cancer in cancer_types:
        cancer_df = df[df["cancer_type"] == cancer]
        clusters = cancer_df["cluster_l2"].dropna().unique()
        if len(clusters) < 2:
            continue
        for cluster_id in clusters:
            for mutation in valid_mutations:
                tasks.append((cancer_df, cluster_id, mutation, cancer))

    if not tasks:
        return pd.DataFrame()

    results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_l2_mutation_enrichment_task)(*t)
        for t in tqdm(tasks, desc="L2 mutation enrichment")
    )
    results = [r for r in results if r is not None]

    enrichment_df = pd.DataFrame(results)

    if not enrichment_df.empty:
        enrichment_df = apply_bh_correction(
            enrichment_df,
            p_col="p_value",
            groupby_cols=["cancer_type", "cluster_level", "cluster_id"],
        )
        enrichment_df["is_significant"] = enrichment_df["p_value_adj"] < 0.05
        enrichment_df["mutation_set_id"] = "top_mutations_gt5pct_v1"
        enrichment_df["test_type"] = "fisher_exact"
        enrichment_df["correction_method"] = "BH"

    logger.info("L2 mutation enrichments: %d", len(enrichment_df))
    if not enrichment_df.empty:
        logger.info("Significant: %d", enrichment_df["is_significant"].sum())

    return enrichment_df


def _l2_pathway_enrichment_task(
    cancer_df: pd.DataFrame, cluster_id: int, pathway: str, cancer_type: str
) -> dict | None:
    """Single L2 pathway enrichment task for parallel execution."""
    result = compute_cluster_pathway_enrichment(
        cancer_df, "cluster_l2", pathway, cluster_id, "L2", cancer_type=cancer_type
    )
    return asdict(result) if result else None


def _run_l2_cluster_pathway_enrichment(df: pd.DataFrame, pathway_cols: list[str]) -> pd.DataFrame:
    """Run L2 (cancer-specific) cluster pathway enrichment analysis."""
    if not pathway_cols:
        return pd.DataFrame()

    logger.info("L2 cluster pathway enrichment...")

    n_jobs = _get_n_jobs()
    cancer_types = df["cancer_type"].unique()

    tasks = []
    for cancer in cancer_types:
        cancer_df = df[df["cancer_type"] == cancer]
        clusters = cancer_df["cluster_l2"].dropna().unique()
        if len(clusters) < 2:
            continue
        for cluster_id in clusters:
            for pathway in pathway_cols:
                tasks.append((cancer_df, cluster_id, pathway, cancer))

    if not tasks:
        return pd.DataFrame()

    results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_l2_pathway_enrichment_task)(*t) for t in tqdm(tasks, desc="L2 pathway enrichment")
    )
    results = [r for r in results if r is not None]

    enrichment_df = pd.DataFrame(results)

    if not enrichment_df.empty:
        enrichment_df = apply_bh_correction(
            enrichment_df,
            p_col="p_value",
            groupby_cols=["cancer_type", "cluster_level", "cluster_id"],
        )
        enrichment_df["is_significant"] = enrichment_df["p_value_adj"] < 0.05
        enrichment_df["pathway_set_id"] = "hallmark_ssgsea_v1"
        enrichment_df["analysis_method"] = "hallmark_ssgsea_mwu"
        enrichment_df["correction_method"] = "BH"

    logger.info("L2 pathway enrichments: %d", len(enrichment_df))
    if not enrichment_df.empty:
        logger.info("Significant: %d", enrichment_df["is_significant"].sum())

    return enrichment_df


def _l2_immune_enrichment_task(
    cancer_df: pd.DataFrame, cluster_id: int, cancer_type: str
) -> list[dict]:
    """Single L2 immune enrichment task for parallel execution."""
    enrichments = compute_cluster_immune_enrichment(
        cancer_df, "cluster_l2", cluster_id, "L2", cancer_type=cancer_type
    )
    return [asdict(e) for e in enrichments]


def _run_l2_cluster_immune_enrichment(df: pd.DataFrame) -> pd.DataFrame:
    """Run L2 (cancer-specific) cluster immune subtype enrichment analysis."""
    logger.info("L2 cluster immune subtype enrichment...")

    results = []

    if "immune_subtype" not in df.columns:
        return pd.DataFrame()

    n_jobs = _get_n_jobs()
    cancer_types = df["cancer_type"].unique()

    tasks = []
    for cancer in cancer_types:
        cancer_df = df[df["cancer_type"] == cancer]
        clusters = cancer_df["cluster_l2"].dropna().unique()
        if len(clusters) < 2:
            continue
        for cluster_id in clusters:
            tasks.append((cancer_df, cluster_id, cancer))

    if not tasks:
        return pd.DataFrame()

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_l2_immune_enrichment_task)(*t) for t in tqdm(tasks, desc="L2 immune enrichment")
    )
    for task_result in task_results:
        results.extend(task_result)

    enrichment_df = pd.DataFrame(results)

    if not enrichment_df.empty:
        enrichment_df = apply_bh_correction(
            enrichment_df,
            p_col="p_value",
            groupby_cols=["cancer_type", "cluster_level", "cluster_id"],
        )
        enrichment_df["is_significant"] = enrichment_df["p_value_adj"] < 0.05
        enrichment_df["immune_subtype_set_id"] = "thorsson_v1"
        enrichment_df["test_type"] = "fisher_exact"
        enrichment_df["correction_method"] = "BH"

    logger.info("L2 immune enrichments: %d", len(enrichment_df))
    if not enrichment_df.empty:
        logger.info("Significant: %d", enrichment_df["is_significant"].sum())

    return enrichment_df


def run_cluster_enrichment_analyses(
    merged_data: MergedData,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Run all cluster enrichment analyses.

    This function tests the associations between the pan-cancer clusters derived from
    histomics features with mutations, pathways and immune scores, for both L1
    (pan-cancer) and L2 (cancer-specific) cluster levels.
    """
    logger.info("Running cluster enrichment analysis...")

    from _config import include_pancan

    df = merged_data.df

    # L1 (pan-cancer) enrichments — only if PANCAN is enabled
    if include_pancan():
        l1_mutation_df = _run_cluster_mutation_enrichment(df, merged_data.top_mutations)
        l1_pathway_df = _run_cluster_pathway_enrichment(df, merged_data.pathway_cols)
        l1_immune_df = _run_cluster_immune_enrichment(df)
    else:
        l1_mutation_df = pd.DataFrame()
        l1_pathway_df = pd.DataFrame()
        l1_immune_df = pd.DataFrame()

    # L2 (cancer-specific) enrichments
    logger.info("L2 cluster enrichments (cancer-specific)...")
    l2_mutation_df = _run_l2_cluster_mutation_enrichment(df, merged_data.top_mutations)
    l2_pathway_df = _run_l2_cluster_pathway_enrichment(df, merged_data.pathway_cols)
    l2_immune_df = _run_l2_cluster_immune_enrichment(df)

    # Concatenate L1 + L2 results
    mutation_df = pd.concat([l1_mutation_df, l2_mutation_df], ignore_index=True)
    pathway_df = pd.concat([l1_pathway_df, l2_pathway_df], ignore_index=True)
    immune_df = pd.concat([l1_immune_df, l2_immune_df], ignore_index=True)

    return mutation_df, pathway_df, immune_df


def _build_metadata(loaded_data: LoadedData, merged_data: MergedData, config: Config) -> dict:
    """Build analysis metadata dictionary."""
    return {
        "analysis_version": histoatlas.__version__,
        "analysis_date": pd.Timestamp.now().isoformat(),
        "n_slides": len(loaded_data.slides_df),
        "n_histomic_features": len(merged_data.histomic_features),
        "n_cancer_types": int(loaded_data.slides_df["cancer_type"].nunique()),
        "n_l1_clusters": int(
            loaded_data.slides_df.loc[
                loaded_data.slides_df["cluster_l1"] >= 0, "cluster_l1"
            ].nunique()
        ),
        "molecular_data": {
            "n_genes_tested": len(merged_data.gene_cols),
            "n_cnv_genes_tested": len(loaded_data.cnv_gene_cols),
            "n_pathways_tested": len(merged_data.pathway_cols),
            "pathway_names": merged_data.pathway_cols,
            "n_mutations_tested": len(merged_data.top_mutations),
            "mutation_names": merged_data.top_mutations,
        },
        "correction_method": "Benjamini-Hochberg",
        "dry_run": config.dry_run,
    }


# =============================================================================
# CLI and Main
# =============================================================================


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Molecular correlation analysis for HistoAtlas")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run on small subset for quick testing",
    )
    return parser.parse_args()


def setup_logging(dry_run: bool) -> None:
    """Configure logging for the analysis."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        handlers=[logging.StreamHandler()],
    )
    logger.info("=" * 60)
    logger.info("MOLECULAR CORRELATION ANALYSIS")
    if dry_run:
        logger.info("** DRY-RUN MODE: Using subset of data for quick testing **")
    logger.info("=" * 60)


def main() -> None:
    """Run the molecular correlation analysis pipeline.

    Each stage saves its output immediately and is skipped on re-run if the
    output file already exists, making the pipeline idempotent and resumable.
    """
    from _config import is_dry_run
    from _paths import (
        CATEGORICAL_ASSOCIATIONS,
        CLUSTER_IMMUNE_ENRICHMENT,
        CLUSTER_MUTATION_ENRICHMENT,
        CLUSTER_PATHWAY_ENRICHMENT,
        FEATURE_CORRELATIONS,
        JSON_DIR,
        PATHWAY_SCORES,
        ensure_dirs,
    )

    args = parse_args()

    # Auto-detect dry-run from environment OR command-line flag
    dry_run_mode = args.dry_run or is_dry_run()

    setup_logging(dry_run_mode)

    config = Config(dry_run=dry_run_mode)
    ensure_dirs()

    # 1. Load data
    logger.info("\n1. Loading data...")
    loaded_data = load_all_data(config)

    # 2. Compute pathway scores (needed by merge step)
    logger.info("\n2. Computing pathway scores...")
    if _output_exists(PATHWAY_SCORES):
        pathway_scores_df = pd.read_parquet(PATHWAY_SCORES)
        pathway_cols = [c for c in pathway_scores_df.columns if c not in ("case_id", "cancer_type")]
    else:
        pathway_scores_df, pathway_cols = compute_pathway_scores(loaded_data.expression_df, config)
        _save_parquet(pathway_scores_df, PATHWAY_SCORES)

    # 3. Merge datasets (in-memory only, always runs)
    logger.info("\n3. Merging datasets...")
    merged_data = merge_datasets(loaded_data, pathway_scores_df, pathway_cols)

    # 4. Run correlation analysis
    logger.info("\n4. Running correlation analysis...")
    if not _output_exists(FEATURE_CORRELATIONS):
        correlations_df = run_correlation_analyses(merged_data)
        _save_parquet(correlations_df, FEATURE_CORRELATIONS)

    # 5. Run categorical analysis
    logger.info("\n5. Running categorical association analysis...")
    if not _output_exists(CATEGORICAL_ASSOCIATIONS):
        categorical_df = run_categorical_analyses(merged_data, config)
        _save_parquet(categorical_df, CATEGORICAL_ASSOCIATIONS)

    # 6. Run cluster enrichment analysis (3 outputs, all-or-nothing)
    logger.info("\n6. Running cluster enrichment analysis...")
    cluster_paths = [
        CLUSTER_MUTATION_ENRICHMENT,
        CLUSTER_PATHWAY_ENRICHMENT,
        CLUSTER_IMMUNE_ENRICHMENT,
    ]
    if all(_output_exists(p) for p in cluster_paths):
        pass  # all three exist — skip
    else:
        mut_df, path_df, imm_df = run_cluster_enrichment_analyses(merged_data)
        _save_parquet(mut_df, CLUSTER_MUTATION_ENRICHMENT)
        _save_parquet(path_df, CLUSTER_PATHWAY_ENRICHMENT)
        _save_parquet(imm_df, CLUSTER_IMMUNE_ENRICHMENT)

    # 7. Save metadata JSON (always overwrite — cheap, captures timestamps)
    logger.info("\n7. Saving metadata...")
    metadata = _build_metadata(loaded_data, merged_data, config)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    with open(JSON_DIR / "molecular_analysis_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    logger.info("  ↳ Saved molecular_analysis_metadata.json")

    # Final summary
    logger.info("\n" + "=" * 60)
    logger.info("ANALYSIS COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
