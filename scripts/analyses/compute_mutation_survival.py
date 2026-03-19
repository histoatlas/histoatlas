#!/usr/bin/env python3
"""
Mutation Survival Analysis for HistoAtlas.

This script computes gene-centric mutation statistics:
1. Mutation frequency per gene × cancer type
2. Cox regression for mutant vs wild-type survival
3. Kaplan-Meier curves for mutant vs wild-type
4. Mutation co-occurrence (gene pairs, Fisher's exact)

Outputs:
- mutation_frequency.parquet
- mutation_survival.parquet
- mutation_km.parquet
- mutation_cooccurrence.parquet
"""

import logging
import os
import warnings
from dataclasses import dataclass
from enum import Enum
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    CLINICAL_SAMPLE,
    CLINICAL_UNIFIED,
    MUTATION_COOCCURRENCE,
    MUTATION_FREQUENCY,
    MUTATION_KM,
    MUTATION_SURVIVAL,
    MUTATIONS,
    SLIDE_HISTOMICS,
    ensure_dirs,
)
from joblib import Parallel, delayed
from scipy.stats import fisher_exact
from tqdm.auto import tqdm

import histoatlas
from histoatlas import apply_bh_correction, mode_or_first, select_column

# Suppress lifelines convergence warnings and numpy divide-by-zero in hazard computation
warnings.filterwarnings("ignore", message=".*convergence.*")
warnings.filterwarnings("ignore", message=".*divide by zero.*")
warnings.filterwarnings("ignore", message=".*invalid value.*")
logging.basicConfig(level=logging.INFO, format="%(message)s")

logger = logging.getLogger(__name__)

# Genes tracked for mutation pages
TRACKED_GENES = ["TP53", "KRAS", "BRAF", "EGFR", "PIK3CA", "PTEN", "IDH1", "ARID1A"]

# Standard time points for KM curves (0-120 months)
STANDARD_TIME_POINTS = np.linspace(0, 120, 100)


class SurvivalEndpoint(Enum):
    """Survival endpoint definitions."""

    OS = ("os", "os_months", "os_status")
    PFS = ("pfs", "pfs_months", "pfs_status")
    DSS = ("dss", "dss_months", "dss_status")
    DFS = ("dfs", "dfs_months", "dfs_status")

    @property
    def name_str(self) -> str:
        return self.value[0]

    @property
    def time_col(self) -> str:
        return self.value[1]

    @property
    def event_col(self) -> str:
        return self.value[2]


@dataclass
class Config:
    """Configuration for mutation survival analysis."""

    @property
    def slides_path(self) -> Path:
        return SLIDE_HISTOMICS

    @property
    def clinical_path(self) -> Path:
        return CLINICAL_UNIFIED

    @property
    def mutations_path(self) -> Path:
        return MUTATIONS

    @property
    def freq_output_path(self) -> Path:
        return MUTATION_FREQUENCY

    @property
    def survival_output_path(self) -> Path:
        return MUTATION_SURVIVAL

    @property
    def km_output_path(self) -> Path:
        return MUTATION_KM

    @property
    def cooccurrence_output_path(self) -> Path:
        return MUTATION_COOCCURRENCE


@dataclass
class MutationData:
    """Container for loaded and merged mutation + survival data."""

    df: pd.DataFrame
    gene_cols: list[str]
    cancer_types: list[str]
    available_endpoints: list[SurvivalEndpoint]


def _get_n_jobs() -> int:
    """Get n_jobs from HISTOATLAS_N_JOBS env var."""
    return int(os.environ.get("HISTOATLAS_N_JOBS", "-1"))


def _cox_result_to_dict(result) -> dict | None:
    """Convert CoxRegressionResult to dict."""
    if result is None:
        return None
    return {
        "hazard_ratio": result.hazard_ratio,
        "hr_ci_lower": result.hr_ci_lower,
        "hr_ci_upper": result.hr_ci_upper,
        "p_value": result.p_value,
        "n_samples": result.n_samples,
        "n_events": result.n_events,
        "concordance": result.concordance,
        "ph_test_p": result.ph_test_p,
        "ph_flag": result.ph_flag,
    }


def _flatten_km_result(km_data: dict) -> dict | None:
    """Flatten KM result dict with KaplanMeierResult objects to plain dicts."""
    if km_data is None:
        return None
    result = {"stratification": km_data["stratification"], "groups": {}}
    for group_name, km_result in km_data["groups"].items():
        result["groups"][group_name] = {
            "time_points": km_result.time_points,
            "survival_probs": km_result.survival_probs,
            "ci_lower": km_result.ci_lower,
            "ci_upper": km_result.ci_upper,
            "n_at_risk": km_result.n_at_risk,
            "censoring_times": km_result.censoring_times,
            "censoring_probs": km_result.censoring_probs,
            "n_samples": km_result.n_samples,
            "n_events": km_result.n_events,
        }
    return result


def load_data(config: Config) -> MutationData | None:
    """Load and merge slides, clinical, and mutation data."""
    # Load slides
    slides_df = pd.read_parquet(config.slides_path)
    logger.info(f"   Loaded {len(slides_df)} slides")

    if "case_id" not in slides_df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")

    # One slide per case
    slides_df, case_meta = histoatlas.select_case_representative_slides(slides_df)
    logger.info(f"   Case selection: {case_meta['n_rows_in']} -> {case_meta['n_rows_out']} cases")

    # Load clinical
    if not config.clinical_path.exists():
        logger.info(f"   ERROR: Clinical data not found at {config.clinical_path}")
        return None
    clinical = pd.read_parquet(config.clinical_path)
    logger.info(f"   Clinical data: {len(clinical)} patients")

    # Load mutations
    if not config.mutations_path.exists():
        logger.info(f"   ERROR: Mutation data not found at {config.mutations_path}")
        return None
    mutations = pd.read_parquet(config.mutations_path)
    logger.info(f"   Mutation data: {len(mutations)} rows, {len(mutations.columns)} columns")

    if "case_id" not in mutations.columns and "sample_id" in mutations.columns:
        mutations["case_id"] = mutations["sample_id"].str[:12]
    mutations = mutations.drop_duplicates(subset=["case_id"], keep="first")

    # Determine available gene columns
    tracked = TRACKED_GENES.copy()
    dry_run = get_dry_run_settings()
    if dry_run:
        tracked = tracked[: dry_run.n_mutations]

    gene_cols = [g for g in tracked if g in mutations.columns]
    logger.info(f"   Gene columns available: {gene_cols}")

    if not gene_cols:
        logger.info("   ERROR: No tracked gene columns found in mutation data")
        return None

    # Merge: slides + clinical + mutations
    df = slides_df.merge(clinical, on="case_id", how="left", suffixes=("", "_clinical"))
    df = df.merge(
        mutations[["case_id"] + gene_cols], on="case_id", how="left", suffixes=("", "_mut")
    )
    logger.info(f"   Merged: {len(df)} cases")

    # Merge TSS from sample data for stratified Cox
    if CLINICAL_SAMPLE.exists():
        sample_df = pd.read_parquet(CLINICAL_SAMPLE)
        if "case_id" in sample_df.columns:
            sample_df = sample_df.drop_duplicates("case_id")
        tss_col = select_column(sample_df, ["tissue_source_site", "tss", "tss_code"])
        if tss_col:
            tss_df = (
                sample_df[["case_id", tss_col]]
                .dropna()
                .groupby("case_id", as_index=False)[tss_col]
                .agg(mode_or_first)
                .rename(columns={tss_col: "tss"})
            )
            df = df.merge(tss_df, on="case_id", how="left")
            logger.info(f"   TSS merged: {df['tss'].notna().sum()} cases with TSS")

    # Dry-run subsetting
    if dry_run:
        cancer_counts = df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(dry_run.n_cancer_types).index.tolist()
        df = df[df["cancer_type"].isin(top_cancers)]
        logger.info(f"   [DRY-RUN] Subset to {len(df)} cases ({dry_run.n_cancer_types} cancers)")

    # Available endpoints
    available_endpoints = []
    for endpoint in SurvivalEndpoint:
        if endpoint.time_col in df.columns and endpoint.event_col in df.columns:
            n_complete = (df[endpoint.time_col].notna() & df[endpoint.event_col].notna()).sum()
            n_events = (df[endpoint.event_col] == 1).sum()
            logger.info(f"     {endpoint.name}: {n_complete} complete, {n_events} events")
            available_endpoints.append(endpoint)

    cancer_types = sorted(df["cancer_type"].dropna().unique().tolist())

    return MutationData(
        df=df,
        gene_cols=gene_cols,
        cancer_types=cancer_types,
        available_endpoints=available_endpoints,
    )


# ---------------------------------------------------------------------------
# 1. Mutation Frequency
# ---------------------------------------------------------------------------


def compute_mutation_frequency(data: MutationData) -> pd.DataFrame:
    """Compute mutation frequency per gene × cancer type."""
    results = []
    from _cohorts import build_cancer_cohorts

    cohorts = build_cancer_cohorts(data.df, data.cancer_types)

    for gene in data.gene_cols:
        for cancer, (subset, _strata) in cohorts.items():
            has_gene = subset[gene].notna()
            n_total = has_gene.sum()
            if n_total == 0:
                continue
            n_mutated = (subset[gene] == 1).sum()
            frequency = n_mutated / n_total
            results.append(
                {
                    "gene": gene,
                    "cancer_type": cancer,
                    "n_mutated": int(n_mutated),
                    "n_total": int(n_total),
                    "frequency": float(frequency),
                }
            )

    return pd.DataFrame(results)


# ---------------------------------------------------------------------------
# 2. Mutation Survival (Cox Regression)
# ---------------------------------------------------------------------------


def _mutation_cox_task(
    cancer_data: pd.DataFrame,
    cancer_label: str,
    endpoint: SurvivalEndpoint,
    gene: str,
    strata: list[str] | None = None,
) -> list[dict]:
    """Cox regression for binary mutation status (gene mutated vs WT)."""
    # Suppress lifelines convergence/overflow warnings in loky worker processes
    warnings.filterwarnings("ignore", message=".*convergence.*")
    warnings.filterwarnings("ignore", message=".*divide by zero.*")
    warnings.filterwarnings("ignore", message=".*invalid value.*")
    warnings.filterwarnings("ignore", message=".*overflow.*")

    results = []

    # Create binary column
    col = f"_mut_{gene}"
    cancer_data = cancer_data.copy()
    cancer_data[col] = cancer_data[gene].apply(
        lambda v: 1.0 if v == 1 else (0.0 if v == 0 else np.nan)
    )
    valid = cancer_data[[col, endpoint.time_col, endpoint.event_col]].dropna()

    # Need sufficient samples in both groups
    n_mut = (valid[col] == 1).sum()
    n_wt = (valid[col] == 0).sum()
    if n_mut < 10 or n_wt < 10:
        return results
    if valid[endpoint.event_col].sum() < 10:
        return results

    # Unadjusted
    result = histoatlas.run_cox_regression(
        cancer_data,
        col,
        endpoint.time_col,
        endpoint.event_col,
        covariates=None,
        strata=strata,
        standardize=False,
    )
    if result:
        d = _cox_result_to_dict(result)
        d.update(
            {
                "gene": gene,
                "cancer_type": cancer_label,
                "endpoint": endpoint.name_str,
                "model": "unadjusted",
                "covariates": None,
            }
        )
        results.append(d)

    # Adjusted (age, sex, stage; stratified by TSS)
    cancer_data = histoatlas.coarsen_stage(cancer_data)
    covariates = histoatlas.select_covariates(cancer_data)

    # TSS handled via stratified Cox (separate baseline hazard per site)
    adj_strata = list(strata) if strata else []
    if "tss" in cancer_data.columns:
        adj_strata.append("tss")

    if covariates:
        result_adj = histoatlas.run_cox_regression(
            cancer_data,
            col,
            endpoint.time_col,
            endpoint.event_col,
            covariates=covariates,
            strata=adj_strata if adj_strata else None,
            standardize=False,
        )
        if result_adj:
            d = _cox_result_to_dict(result_adj)
            d.update(
                {
                    "gene": gene,
                    "cancer_type": cancer_label,
                    "endpoint": endpoint.name_str,
                    "model": "adjusted",
                    "covariates": ",".join(covariates),
                }
            )
            results.append(d)

    return results


def compute_mutation_survival(data: MutationData) -> pd.DataFrame:
    """Run Cox regression for all gene × cancer × endpoint combinations."""
    n_jobs = _get_n_jobs()
    from _cohorts import build_cancer_cohorts

    cohorts = build_cancer_cohorts(data.df, data.cancer_types)
    cancer_labels = list(cohorts.keys())
    cancer_dfs = {k: v[0] for k, v in cohorts.items()}

    # Build task list
    tasks = []
    for gene in data.gene_cols:
        for cancer in cancer_labels:
            cancer_data = cancer_dfs[cancer]
            strata = cohorts[cancer][1]
            for endpoint in data.available_endpoints:
                if endpoint.time_col not in cancer_data.columns:
                    continue
                tasks.append((cancer_data, cancer, endpoint, gene, strata))

    logger.info(f"   Dispatching {len(tasks)} Cox tasks (n_jobs={n_jobs})")

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_mutation_cox_task)(cd, cl, ep, g, s)
        for cd, cl, ep, g, s in tqdm(tasks, desc="Mutation Cox tasks")
    )

    all_results = []
    for result_list in task_results:
        all_results.extend(result_list)

    df = pd.DataFrame(all_results)
    if df.empty:
        return df

    # BH correction with PH violation handling
    ph_invalid = df["ph_flag"].isin(["warn", "fail", "error", "unknown"])
    df["cox_valid"] = ~ph_invalid
    if ph_invalid.any():
        df.loc[ph_invalid, "hazard_ratio"] = np.nan
        df.loc[ph_invalid, "hr_ci_lower"] = np.nan
        df.loc[ph_invalid, "hr_ci_upper"] = np.nan

    df["p_value_bh"] = df["p_value"]
    df.loc[ph_invalid, "p_value_bh"] = 1.0

    df = apply_bh_correction(
        df, p_col="p_value_bh", groupby_cols=["cancer_type", "endpoint", "model"]
    )
    # NaN-out p-values for PH-violating rows (Cox p-value is equally invalid when PH fails)
    df.loc[ph_invalid, "p_value"] = np.nan
    df.loc[ph_invalid, "p_value_adj"] = np.nan
    df = df.drop(columns=["p_value_bh"], errors="ignore")

    return df


# ---------------------------------------------------------------------------
# 3. Mutation KM Curves
# ---------------------------------------------------------------------------


def _mutation_km_task(
    cancer_data: pd.DataFrame,
    cancer_label: str,
    endpoint: SurvivalEndpoint,
    gene: str,
) -> list[dict]:
    """KM curves for mutant vs wild-type."""
    results = []

    col = f"_mut_{gene}"
    cancer_data = cancer_data.copy()
    cancer_data[col] = cancer_data[gene].apply(
        lambda v: 1.0 if v == 1 else (0.0 if v == 0 else np.nan)
    )

    # Need enough samples in both groups
    valid = cancer_data[[col, endpoint.time_col, endpoint.event_col]].dropna()
    n_mut = (valid[col] == 1).sum()
    n_wt = (valid[col] == 0).sum()
    if n_mut < 10 or n_wt < 10:
        return results

    # Binary mutation: assign groups directly instead of relying on median split
    cancer_data["_km_group"] = cancer_data[col].map({1.0: "Mutated", 0.0: "Wild-type"})
    km_subset = cancer_data[[endpoint.time_col, endpoint.event_col, "_km_group"]].dropna()

    if len(km_subset) < 30 or km_subset["_km_group"].nunique() < 2:
        return results

    from lifelines import KaplanMeierFitter

    km_results_dict: dict = {"stratification": "binary", "groups": {}}
    kmf = KaplanMeierFitter()
    for group_name in ["Mutated", "Wild-type"]:
        mask = km_subset["_km_group"] == group_name
        T = km_subset.loc[mask, endpoint.time_col]
        E = km_subset.loc[mask, endpoint.event_col]
        if len(T) < 5:
            continue
        kmf.fit(T, E, label=group_name)
        sf = kmf.survival_function_at_times(STANDARD_TIME_POINTS)
        ci = kmf.confidence_interval_survival_function_
        ci_lower, ci_upper = [], []
        ci_times = ci.index.values
        for t in STANDARD_TIME_POINTS:
            valid_indices = np.where(ci_times <= t)[0]
            idx = 0 if len(valid_indices) == 0 else valid_indices[-1]
            ci_lower.append(float(ci.iloc[idx, 0]))
            ci_upper.append(float(ci.iloc[idx, 1]))
        n_at_risk = [int((T >= t).sum()) for t in STANDARD_TIME_POINTS]
        censored_mask = E == 0
        censoring_times = sorted(T[censored_mask].tolist())
        censoring_probs = kmf.survival_function_at_times(censoring_times).values.tolist()
        km_results_dict["groups"][group_name] = {
            "time_points": STANDARD_TIME_POINTS.tolist(),
            "survival_probs": sf.values.tolist(),
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "n_at_risk": n_at_risk,
            "censoring_times": censoring_times,
            "censoring_probs": censoring_probs,
            "n_samples": int(mask.sum()),
            "n_events": int(E.sum()),
        }

    if len(km_results_dict["groups"]) < 2:
        return results

    for group_name, group_data in km_results_dict["groups"].items():
        mask = (
            cancer_data[col].notna()
            & cancer_data[endpoint.time_col].notna()
            & cancer_data[endpoint.event_col].notna()
        )
        if group_name == "Mutated":
            mask = mask & (cancer_data[col] == 1)
        else:
            mask = mask & (cancer_data[col] == 0)

        median_surv = histoatlas.compute_median_survival(
            cancer_data, endpoint.time_col, endpoint.event_col, mask
        )

        results.append(
            {
                "gene": gene,
                "cancer_type": cancer_label,
                "endpoint": endpoint.name_str,
                "group": group_name,
                "time_points": group_data["time_points"],
                "survival_probs": group_data["survival_probs"],
                "ci_lower": group_data["ci_lower"],
                "ci_upper": group_data["ci_upper"],
                "n_at_risk": group_data.get("n_at_risk"),
                "censoring_times": group_data["censoring_times"],
                "censoring_probs": group_data["censoring_probs"],
                "n_samples": group_data["n_samples"],
                "n_events": group_data["n_events"],
                "median_survival": median_surv,
            }
        )

    return results


def compute_mutation_km(data: MutationData) -> pd.DataFrame:
    """Compute KM curves for all gene × cancer × endpoint combinations."""
    n_jobs = _get_n_jobs()
    from _cohorts import build_cancer_cohorts

    cohorts = build_cancer_cohorts(data.df, data.cancer_types)
    cancer_labels = list(cohorts.keys())
    cancer_dfs = {k: v[0] for k, v in cohorts.items()}

    tasks = []
    for gene in data.gene_cols:
        for cancer in cancer_labels:
            for endpoint in data.available_endpoints:
                if endpoint.time_col not in cancer_dfs[cancer].columns:
                    continue
                tasks.append((cancer_dfs[cancer], cancer, endpoint, gene))

    logger.info(f"   Dispatching {len(tasks)} KM tasks (n_jobs={n_jobs})")

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_mutation_km_task)(cd, cl, ep, g)
        for cd, cl, ep, g in tqdm(tasks, desc="Mutation KM tasks")
    )

    all_results = []
    for result_list in task_results:
        all_results.extend(result_list)

    return pd.DataFrame(all_results)


# ---------------------------------------------------------------------------
# 4. Mutation Co-occurrence
# ---------------------------------------------------------------------------


def _cooccurrence_task(
    cancer_data: pd.DataFrame,
    cancer_label: str,
    gene_a: str,
    gene_b: str,
) -> dict | None:
    """Fisher's exact test on 2×2 gene-pair co-occurrence table."""
    subset = cancer_data[[gene_a, gene_b]].dropna()
    if len(subset) < 20:
        return None

    a = (subset[gene_a] == 1).astype(int)
    b = (subset[gene_b] == 1).astype(int)

    n_both = int(((a == 1) & (b == 1)).sum())
    n_a_only = int(((a == 1) & (b == 0)).sum())
    n_b_only = int(((a == 0) & (b == 1)).sum())
    n_neither = int(((a == 0) & (b == 0)).sum())

    table = [[n_both, n_a_only], [n_b_only, n_neither]]
    odds_ratio, p_value = fisher_exact(table)

    return {
        "gene_a": gene_a,
        "gene_b": gene_b,
        "cancer_type": cancer_label,
        "n_both": n_both,
        "n_a_only": n_a_only,
        "n_b_only": n_b_only,
        "n_neither": n_neither,
        "odds_ratio": float(odds_ratio),
        "p_value": float(p_value),
    }


def compute_mutation_cooccurrence(data: MutationData) -> pd.DataFrame:
    """Compute gene-pair co-occurrence statistics per cancer type."""
    n_jobs = _get_n_jobs()
    from _cohorts import build_cancer_cohorts

    cohorts = build_cancer_cohorts(data.df, data.cancer_types)
    gene_pairs = list(combinations(data.gene_cols, 2))

    tasks = []
    for cancer, (subset, _strata) in cohorts.items():
        for gene_a, gene_b in gene_pairs:
            tasks.append((subset, cancer, gene_a, gene_b))

    logger.info(f"   Dispatching {len(tasks)} co-occurrence tasks (n_jobs={n_jobs})")

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_cooccurrence_task)(cd, cl, ga, gb)
        for cd, cl, ga, gb in tqdm(tasks, desc="Co-occurrence tasks")
    )

    results = [r for r in task_results if r is not None]
    df = pd.DataFrame(results)

    if not df.empty:
        df = apply_bh_correction(df, p_col="p_value", groupby_cols=["cancer_type"])

    return df


# ---------------------------------------------------------------------------
# Save & Main
# ---------------------------------------------------------------------------


def save_results(
    freq_df: pd.DataFrame,
    survival_df: pd.DataFrame,
    km_df: pd.DataFrame,
    cooccurrence_df: pd.DataFrame,
    config: Config,
) -> None:
    """Save all result DataFrames to parquet files."""
    ensure_dirs()

    freq_df.to_parquet(config.freq_output_path, index=False)
    logger.info(f"   Saved mutation_frequency.parquet ({len(freq_df)} rows)")

    survival_df.to_parquet(config.survival_output_path, index=False)
    logger.info(f"   Saved mutation_survival.parquet ({len(survival_df)} rows)")

    km_df.to_parquet(config.km_output_path, index=False)
    logger.info(f"   Saved mutation_km.parquet ({len(km_df)} curves)")

    cooccurrence_df.to_parquet(config.cooccurrence_output_path, index=False)
    logger.info(f"   Saved mutation_cooccurrence.parquet ({len(cooccurrence_df)} rows)")


def main(config: Config) -> None:
    """Orchestrate the mutation survival analysis pipeline."""
    logger.info("=" * 60)
    logger.info("MUTATION SURVIVAL ANALYSIS")
    logger.info("=" * 60)

    logger.info("\n1. Loading data...")
    data = load_data(config)
    if data is None:
        return

    logger.info("\n2. Computing mutation frequencies...")
    freq_df = compute_mutation_frequency(data)

    logger.info("\n3. Running Cox regression (mutant vs WT)...")
    survival_df = compute_mutation_survival(data)

    logger.info("\n4. Computing Kaplan-Meier curves...")
    km_df = compute_mutation_km(data)

    logger.info("\n5. Computing co-occurrence statistics...")
    cooccurrence_df = compute_mutation_cooccurrence(data)

    logger.info("\n6. Saving results...")
    save_results(freq_df, survival_df, km_df, cooccurrence_df, config)

    logger.info("\n" + "=" * 60)
    logger.info("MUTATION SURVIVAL ANALYSIS COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    config = Config()
    main(config)
