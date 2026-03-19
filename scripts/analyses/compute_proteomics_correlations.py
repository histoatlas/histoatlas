#!/usr/bin/env python3
"""
Proteomics Correlation Analysis for HistoAtlas (CPTAC Tier 4).

Computes:
1. Histomic ↔ protein abundance Spearman correlations (curated + global panels)
2. mRNA vs protein correlation comparison (delta rho, direction concordance, Fisher z-test)

Requires proteomics data from download_cptac_proteomics.py and existing mRNA
correlations from compute_molecular_correlations.py.

Usage:
    uv run python scripts/analyses/compute_proteomics_correlations.py
    uv run python scripts/analyses/compute_proteomics_correlations.py --dry-run
"""

import argparse
import logging
import os
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
from scipy import stats

from histoatlas import (
    AVAILABLE_GENES,
    apply_bh_correction,
    mode_or_first,
    run_correlation_analysis,
    select_case_representative_slides,
    select_column,
)

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")
warnings.filterwarnings("ignore", message=".*divide by zero.*")

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


def _get_n_jobs() -> int:
    """Get n_jobs from HISTOATLAS_N_JOBS env var."""
    return int(os.environ.get("HISTOATLAS_N_JOBS", "-1"))


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@dataclass
class DryRunConfig:
    """Configuration for dry-run mode to subset data for quick testing."""

    n_proteins_curated: int = 5
    n_proteins_global: int = 20
    n_histomic_features: int = 5
    n_cancer_types: int = 2


@dataclass
class Config:
    """Configuration for the proteomics correlation analysis."""

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


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


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

    # Enforce one slide per case
    slides_df, case_meta = select_case_representative_slides(slides_df)
    logger.info(
        "Case selection: %d slides -> %d cases (dropped %d duplicates)",
        case_meta["n_rows_in"],
        case_meta["n_rows_out"],
        case_meta["n_duplicates_dropped"],
    )

    logger.info("Histomic features: %d", len(histomic_features))
    return slides_df, histomic_features


def _load_proteomics(config: Config) -> tuple[pd.DataFrame, list[str], list[str]]:
    """Load proteomics data and split into curated and global protein columns.

    Returns:
        proteomics_df: DataFrame with proteomics data
        protein_cols_curated: Proteins overlapping with AVAILABLE_GENES curated panel
        protein_cols_global: All protein columns
    """
    from _paths import PROTEOMICS

    if not PROTEOMICS.exists():
        raise FileNotFoundError(f"Proteomics file not found: {PROTEOMICS}")

    proteomics_df = pd.read_parquet(PROTEOMICS)
    if "case_id" in proteomics_df.columns:
        proteomics_df = proteomics_df.drop_duplicates("case_id")
    logger.info("Proteomics samples: %d", len(proteomics_df))

    meta_cols = {"sampleId", "patientId", "case_id", "cancer_type", "sample_id"}
    all_protein_cols = sorted([c for c in proteomics_df.columns if c not in meta_cols])
    logger.info("Total proteins: %d", len(all_protein_cols))

    # Curated panel: intersection with AVAILABLE_GENES (same genes as mRNA curated panel)
    protein_cols_curated = [g for g in AVAILABLE_GENES if g in all_protein_cols]
    logger.info("Curated proteins (overlap with AVAILABLE_GENES): %d", len(protein_cols_curated))

    protein_cols_global = all_protein_cols

    if config.dry_run_cfg:
        protein_cols_curated = protein_cols_curated[: config.dry_run_cfg.n_proteins_curated]
        protein_cols_global = protein_cols_global[: config.dry_run_cfg.n_proteins_global]

    return proteomics_df, protein_cols_curated, protein_cols_global


def _load_clinical_covariates() -> tuple[pd.DataFrame, pd.DataFrame, dict[str, str]]:
    """Load clinical and sample data for covariates."""
    from _paths import CLINICAL_SAMPLE, CLINICAL_UNIFIED

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

    return clinical_df, sample_df, covariate_sources


# ---------------------------------------------------------------------------
# Merge and model setup
# ---------------------------------------------------------------------------


def _merge_datasets(
    slides_df: pd.DataFrame,
    proteomics_df: pd.DataFrame,
    clinical_df: pd.DataFrame,
    sample_df: pd.DataFrame,
    covariate_sources: dict[str, str],
) -> pd.DataFrame:
    """Merge slides with proteomics and covariate data."""
    merged = slides_df.copy()

    # Merge proteomics (all columns, including global)
    prot_cols_to_merge = [c for c in proteomics_df.columns if c != "cancer_type"]
    prot_subset = proteomics_df[prot_cols_to_merge].drop_duplicates("case_id")
    merged = merged.merge(prot_subset, on="case_id", how="left")

    # Check actual proteomics overlap by a protein column
    meta_cols = {"sampleId", "patientId", "case_id", "cancer_type", "sample_id"}
    first_prot = [c for c in proteomics_df.columns if c not in meta_cols]
    n_with_prot = merged[first_prot[0]].notna().sum() if first_prot else 0
    logger.info(
        "After proteomics merge: %d with proteomics (%.1f%%)",
        n_with_prot,
        n_with_prot / len(merged) * 100 if len(merged) > 0 else 0,
    )

    # Merge clinical covariates (age, sex, stage)
    if not clinical_df.empty:
        base_cols = ["case_id"]
        rename_map = {}
        for key in ["age", "sex", "stage"]:
            src = covariate_sources.get(key)
            if src and src in clinical_df.columns:
                base_cols.append(src)
                rename_map[src] = {"age": "age_at_diagnosis", "sex": "sex", "stage": "stage"}[key]
        if len(base_cols) > 1:
            cov_df = clinical_df[base_cols].copy().rename(columns=rename_map)
            merged = merged.merge(cov_df, on="case_id", how="left")

    # Merge TSS from sample data (independent of clinical data availability)
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
            merged = merged.merge(tss_df, on="case_id", how="left")

    logger.info("Final merged: %d cases, %d columns", len(merged), len(merged.columns))
    return merged


def _group_tss_topk(df: pd.DataFrame, k: int = 5) -> pd.DataFrame:
    """Group TSS into top-k most frequent sites + 'Other' per cancer type.

    This bounds the number of TSS dummy variables in the rank-based
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
        remap_mask = mask & df["tss"].notna() & ~df["tss"].isin(top_sites)
        df.loc[remap_mask, "tss"] = "Other"

    return df


def _build_model_configs(merged_df: pd.DataFrame) -> list[ModelConfig]:
    """Build model configurations based on available covariates."""
    model_configs = [ModelConfig(name="unadjusted", covariate_cols=[])]

    adj_covs = []
    for cov in ["age_at_diagnosis", "sex", "stage", "tss"]:
        if cov in merged_df.columns:
            adj_covs.append(cov)

    if adj_covs:
        model_configs.append(ModelConfig(name="adjusted", covariate_cols=adj_covs))

    return model_configs


# ---------------------------------------------------------------------------
# Proteomics correlation analysis
# ---------------------------------------------------------------------------


def run_proteomics_correlations(
    merged_df: pd.DataFrame,
    histomic_features: list[str],
    protein_cols_curated: list[str],
    protein_cols_global: list[str],
    model_configs: list[ModelConfig],
) -> pd.DataFrame:
    """Run proteomics correlation analyses (curated + global panels)."""
    logger.info("Running proteomics correlation analysis...")

    all_correlations = []
    n_jobs = _get_n_jobs()

    from _config import include_pancan

    input_dfs = [merged_df]
    if include_pancan():
        pancan_df = merged_df.copy()
        pancan_df["cancer_type"] = "PANCAN"
        input_dfs.append(pancan_df)

    for model_cfg in model_configs:
        model_name = model_cfg.name
        cov_cols = model_cfg.covariate_cols

        for input_df in input_dfs:
            # Curated panel (same genes as mRNA curated — enables direct comparison)
            if protein_cols_curated:
                logger.info("Proteomics curated correlations (%s)...", model_name)
                curated_df = run_correlation_analysis(
                    input_df,
                    histomic_features,
                    protein_cols_curated,
                    molecular_type="proteomics",
                    target_set_id="proteomics_curated_v1",
                    model=model_name,
                    covariate_cols=cov_cols,
                    n_jobs=n_jobs,
                )
                if not curated_df.empty:
                    all_correlations.append(curated_df)
                    logger.info("  %d correlations", len(curated_df))

            # Global panel (all proteins)
            if protein_cols_global:
                logger.info("Proteomics global correlations (%s)...", model_name)
                global_df = run_correlation_analysis(
                    input_df,
                    histomic_features,
                    protein_cols_global,
                    molecular_type="proteomics",
                    target_set_id="proteomics_global_v1",
                    model=model_name,
                    covariate_cols=cov_cols,
                    n_jobs=n_jobs,
                )
                if not global_df.empty:
                    all_correlations.append(global_df)
                    logger.info("  %d correlations", len(global_df))

    if not all_correlations:
        return pd.DataFrame()

    all_correlations_df = pd.concat(all_correlations, ignore_index=True)

    # Apply BH correction (same grouping as mRNA correlations)
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

    logger.info("Total proteomics correlations: %d", len(all_correlations_df))
    logger.info(
        "Significant (Spearman p_adj < 0.05): %d",
        all_correlations_df["is_significant"].sum(),
    )

    return all_correlations_df


# ---------------------------------------------------------------------------
# mRNA vs protein comparison
# ---------------------------------------------------------------------------


def _fisher_z_test(rho1: float, n1: int, rho2: float, n2: int) -> float:
    """Fisher z-test for the difference between two independent Spearman correlations.

    Tests H0: rho1 == rho2 against H1: rho1 != rho2.
    Returns two-sided p-value.

    Requires n1 > 3 and n2 > 3 for valid variance estimation.
    """
    if n1 <= 3 or n2 <= 3:
        return np.nan

    # Clamp to avoid arctanh(±1) = ±inf
    rho1 = np.clip(rho1, -0.9999, 0.9999)
    rho2 = np.clip(rho2, -0.9999, 0.9999)

    z1 = np.arctanh(rho1)
    z2 = np.arctanh(rho2)
    se = np.sqrt(1.0 / (n1 - 3) + 1.0 / (n2 - 3))
    z_diff = (z1 - z2) / se
    p = 2 * stats.norm.sf(np.abs(z_diff))
    return float(p)


def compute_mrna_vs_protein_comparison(
    proteomics_corr_df: pd.DataFrame,
    mrna_corr_path: Path,
) -> pd.DataFrame:
    """Compare mRNA and protein correlations for the same (feature, gene, cancer_type) triplets.

    Uses the curated panel results from both mRNA (expression_curated_v1) and
    protein (proteomics_curated_v1), since they share the same gene names.
    """
    logger.info("Computing mRNA vs protein comparison...")

    mrna_df = pd.read_parquet(mrna_corr_path)

    # Filter to curated panels only (shared gene names)
    mrna_curated = mrna_df[mrna_df["target_set_id"] == "expression_curated_v1"].copy()
    prot_curated = proteomics_corr_df[
        proteomics_corr_df["target_set_id"] == "proteomics_curated_v1"
    ].copy()

    if mrna_curated.empty or prot_curated.empty:
        logger.warning("Cannot compare: empty mRNA or protein curated results")
        return pd.DataFrame()

    # Prepare for merge
    join_cols = ["cancer_type", "histomic_feature", "molecular_feature", "model"]

    mrna_subset = mrna_curated[join_cols + ["spearman_rho", "spearman_p_adj", "n_samples"]].rename(
        columns={
            "spearman_rho": "mrna_rho",
            "spearman_p_adj": "mrna_p_adj",
            "n_samples": "mrna_n",
        }
    )

    prot_subset = prot_curated[join_cols + ["spearman_rho", "spearman_p_adj", "n_samples"]].rename(
        columns={
            "spearman_rho": "protein_rho",
            "spearman_p_adj": "protein_p_adj",
            "n_samples": "protein_n",
        }
    )

    # Inner join on shared triplets
    comparison = mrna_subset.merge(prot_subset, on=join_cols, how="inner")
    logger.info("Matched %d (feature, gene, cancer_type, model) triplets", len(comparison))

    if comparison.empty:
        return pd.DataFrame()

    # Rename molecular_feature → gene for clarity
    comparison = comparison.rename(columns={"molecular_feature": "gene"})

    # Compute comparison statistics
    comparison["delta_rho"] = comparison["protein_rho"] - comparison["mrna_rho"]
    comparison["same_direction"] = np.sign(comparison["mrna_rho"]) == np.sign(
        comparison["protein_rho"]
    )

    # Fisher z-test for each pair
    comparison["fisher_z_p"] = comparison.apply(
        lambda row: _fisher_z_test(
            row["mrna_rho"],
            int(row["mrna_n"]),
            row["protein_rho"],
            int(row["protein_n"]),
        )
        if pd.notna(row["mrna_rho"]) and pd.notna(row["protein_rho"])
        else np.nan,
        axis=1,
    )

    comparison["both_significant"] = (comparison["mrna_p_adj"] < 0.05) & (
        comparison["protein_p_adj"] < 0.05
    )

    # Summary stats
    n_same_dir = comparison["same_direction"].sum()
    pct_same_dir = n_same_dir / len(comparison) * 100
    n_both_sig = comparison["both_significant"].sum()
    median_delta = comparison["delta_rho"].median()

    logger.info("  Same direction: %d / %d (%.1f%%)", n_same_dir, len(comparison), pct_same_dir)
    logger.info("  Both significant: %d", n_both_sig)
    logger.info("  Median delta_rho (protein - mRNA): %.3f", median_delta)

    return comparison


# ---------------------------------------------------------------------------
# CLI and Main
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Proteomics correlation analysis for HistoAtlas (CPTAC Tier 4)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run on small subset for quick testing",
    )
    parser.add_argument(
        "--curated-only",
        action="store_true",
        help="Skip global panel (13k proteins); only run curated panel (~130 genes)",
    )
    return parser.parse_args()


def main() -> None:
    """Run the proteomics correlation analysis pipeline."""
    from _config import is_dry_run
    from _paths import (
        FEATURE_CORRELATIONS,
        MRNA_VS_PROTEIN_COMPARISON,
        PROTEOMICS_CORRELATIONS,
        ensure_dirs,
    )

    args = parse_args()
    dry_run_mode = args.dry_run or is_dry_run()
    curated_only = args.curated_only

    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        handlers=[logging.StreamHandler()],
    )
    logger.info("=" * 60)
    logger.info("PROTEOMICS CORRELATION ANALYSIS (CPTAC Tier 4)")
    if dry_run_mode:
        logger.info("** DRY-RUN MODE: Using subset of data for quick testing **")
    if curated_only:
        logger.info("** CURATED-ONLY MODE: Skipping global panel (13k proteins) **")
    logger.info("=" * 60)

    config = Config(dry_run=dry_run_mode)
    ensure_dirs()

    # 1. Load data
    logger.info("\n1. Loading data...")
    slides_df, histomic_features = _load_slides(config)
    proteomics_df, protein_cols_curated, protein_cols_global = _load_proteomics(config)
    clinical_df, sample_df, covariate_sources = _load_clinical_covariates()

    # 2. Merge datasets
    logger.info("\n2. Merging datasets...")
    merged_df = _merge_datasets(slides_df, proteomics_df, clinical_df, sample_df, covariate_sources)
    # Group TSS into top-5 sites per cancer type to bound dummy variables
    merged_df = _group_tss_topk(merged_df, k=5)
    model_configs = _build_model_configs(merged_df)

    # 3. Run proteomics correlations
    logger.info("\n3. Running proteomics correlation analysis...")
    if not _output_exists(PROTEOMICS_CORRELATIONS):
        global_cols = [] if curated_only else protein_cols_global
        prot_corr_df = run_proteomics_correlations(
            merged_df, histomic_features, protein_cols_curated, global_cols, model_configs
        )
        _save_parquet(prot_corr_df, PROTEOMICS_CORRELATIONS)
    else:
        prot_corr_df = pd.read_parquet(PROTEOMICS_CORRELATIONS)

    # 4. mRNA vs protein comparison
    logger.info("\n4. Computing mRNA vs protein comparison...")
    if not _output_exists(MRNA_VS_PROTEIN_COMPARISON):
        if FEATURE_CORRELATIONS.exists() and not prot_corr_df.empty:
            comparison_df = compute_mrna_vs_protein_comparison(prot_corr_df, FEATURE_CORRELATIONS)
        else:
            logger.warning(
                "Skipping mRNA vs protein comparison: "
                "feature_correlations.parquet not found or proteomics results empty"
            )
            comparison_df = pd.DataFrame()
        _save_parquet(comparison_df, MRNA_VS_PROTEIN_COMPARISON)

    logger.info("\n" + "=" * 60)
    logger.info("PROTEOMICS ANALYSIS COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
