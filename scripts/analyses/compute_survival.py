#!/usr/bin/env python3
"""
Survival Analysis Computation for HistoAtlas.

This script computes:
1. Cox regression for all features across cancer types and endpoints
2. Kaplan-Meier curves for feature stratifications
3. Cluster survival analysis (L1 and L2)
4. Benjamini-Hochberg correction for all tests

Outputs:
- survival_associations.parquet (Cox regression results)
- km_curve_data.parquet (Kaplan-Meier curve data)
- cluster_survival_summary.parquet (Cluster survival analysis)
- cluster_km_curve_data.parquet (KM curves for clusters)
"""

import logging
import os
import warnings
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    CLINICAL_SAMPLE,
    CLINICAL_UNIFIED,
    CLUSTER_KM_CURVE_DATA,
    CLUSTER_SURVIVAL_SUMMARY,
    KM_CURVE_DATA,
    MOLECULAR_DIR,
    SLIDE_HISTOMICS,
    SURVIVAL_ASSOCIATIONS,
)
from joblib import Parallel, delayed
from tqdm.auto import tqdm

import histoatlas
from histoatlas import apply_bh_correction, get_histomic_features, mode_or_first, select_column

# Suppress lifelines convergence warnings and numpy divide-by-zero in hazard computation
warnings.filterwarnings("ignore", message=".*convergence.*")
warnings.filterwarnings("ignore", message=".*divide by zero.*")
warnings.filterwarnings("ignore", message=".*invalid value.*")
logging.basicConfig(level=logging.INFO, format="%(message)s")

logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Configuration for survival analysis."""

    @property
    def molecular_dir(self) -> Path:
        return MOLECULAR_DIR

    @property
    def slides_path(self) -> Path:
        return SLIDE_HISTOMICS

    @property
    def clinical_path(self) -> Path:
        return CLINICAL_UNIFIED

    @property
    def cox_output_path(self) -> Path:
        return SURVIVAL_ASSOCIATIONS

    @property
    def km_output_path(self) -> Path:
        return KM_CURVE_DATA

    @property
    def cluster_survival_output_path(self) -> Path:
        return CLUSTER_SURVIVAL_SUMMARY

    @property
    def cluster_km_output_path(self) -> Path:
        return CLUSTER_KM_CURVE_DATA


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


# Standard time points for KM curves (0-120 months)
# Note (PAB): It varies a lot of depending on the endpoints and the cancer types. For visualization
# purposes, it seems to be a good starting point for most cancer types.
STANDARD_TIME_POINTS = np.linspace(0, 120, 100)


@dataclass
class SurvivalData:
    """Container for loaded and merged survival data."""

    df: pd.DataFrame
    feature_cols: list[str]
    cancer_types: list[str]
    available_endpoints: list[SurvivalEndpoint]


def _cox_result_to_dict(
    result,
    *,
    imputation_used: bool = False,
    n_imputations: int | None = None,
    fmi: float | None = None,
    missingness_stats: dict | None = None,
) -> dict | None:
    """Convert CoxRegressionResult dataclass to dict with optional imputation metadata."""
    if result is None:
        return None
    d = {
        "hazard_ratio": result.hazard_ratio,
        "hr_ci_lower": result.hr_ci_lower,
        "hr_ci_upper": result.hr_ci_upper,
        "p_value": result.p_value,
        "n_samples": result.n_samples,
        "n_events": result.n_events,
        "concordance": result.concordance,
        "feature_mean": result.feature_mean,
        "feature_std": result.feature_std,
        "ph_test_p": result.ph_test_p,
        "ph_flag": result.ph_flag,
        "imputation_used": imputation_used,
        "n_imputations": n_imputations,
        "fmi": fmi,
    }
    if missingness_stats is not None:
        d["n_complete_case"] = missingness_stats.get("n_complete_case")
        d["pct_dropped"] = missingness_stats.get("pct_dropped")
        d["missing_frac_age"] = missingness_stats.get("age_at_diagnosis")
        d["missing_frac_sex"] = missingness_stats.get("sex")
        d["missing_frac_stage"] = missingness_stats.get("stage")
    else:
        d["n_complete_case"] = None
        d["pct_dropped"] = None
        d["missing_frac_age"] = None
        d["missing_frac_sex"] = None
        d["missing_frac_stage"] = None
    return d


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


def _build_cluster_survival_result(
    *,
    cluster_level: str,
    analysis_type: str,
    cancer_type: str,
    cluster_id: int,
    endpoint: SurvivalEndpoint,
    model: str,
    cox_result: dict,
    logrank_result: dict | None,
    median_cluster: float | None,
    median_rest: float | None,
    covariates: list[str] | None,
) -> dict:
    """Build a cluster survival result dictionary."""
    return {
        "cluster_level": cluster_level,
        "analysis_type": analysis_type,
        "cancer_type": cancer_type,
        "cluster_id": cluster_id,
        "endpoint": endpoint.name_str,
        "model": model,
        "n_cluster": cox_result.get("n_cluster"),
        "n_events_cluster": cox_result.get("n_events_cluster"),
        "n_total": cox_result.get("n_total"),
        "n_events_total": cox_result.get("n_events_total"),
        "hazard_ratio": cox_result.get("hazard_ratio"),
        "hr_ci_lower": cox_result.get("hr_ci_lower"),
        "hr_ci_upper": cox_result.get("hr_ci_upper"),
        "cox_p": cox_result.get("p_value"),
        "cox_ph_test_p": cox_result.get("ph_test_p"),
        "cox_ph_flag": cox_result.get("ph_flag"),
        "logrank_p": logrank_result["p_value"] if logrank_result else None,
        "logrank_stat": logrank_result["test_statistic"] if logrank_result else None,
        "median_survival_cluster": median_cluster,
        "median_survival_rest": median_rest,
        "covariates": ",".join(covariates) if covariates else None,
    }


def _build_cluster_km_result(
    *,
    cluster_level: str,
    analysis_type: str,
    cancer_type: str,
    cluster_id: int,
    endpoint: SurvivalEndpoint,
    group_name: str,
    km_data: dict,
) -> dict:
    """Build a cluster KM curve result dictionary."""
    return {
        "cluster_level": cluster_level,
        "analysis_type": analysis_type,
        "cancer_type": cancer_type,
        "cluster_id": cluster_id,
        "endpoint": endpoint.name_str,
        "group": group_name,
        "time_points": km_data["time_points"],
        "survival_probs": km_data["survival_probs"],
        "ci_lower": km_data["ci_lower"],
        "ci_upper": km_data["ci_upper"],
        "censoring_times": km_data["censoring_times"],
        "censoring_probs": km_data["censoring_probs"],
        "n_samples": km_data["n_samples"],
        "n_events": km_data["n_events"],
    }


def _load_slides(config: Config) -> pd.DataFrame:
    """Load slide-level features."""
    df = pd.read_parquet(config.slides_path)
    logger.info(f"   Loaded {len(df)} slides (raw)")

    if "case_id" not in df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")

    return df


def _load_clinical(config: Config) -> pd.DataFrame | None:
    """Load clinical data."""
    if not config.clinical_path.exists():
        logger.info(f"   ERROR: Clinical data not found at {config.clinical_path}")
        return None

    clinical = pd.read_parquet(config.clinical_path)
    logger.info(f"   Clinical data: {len(clinical)} patients")
    return clinical


def load_data(config: Config) -> SurvivalData | None:
    """Load and merge slide and clinical data for survival analysis.

    Args:
        config: Configuration object

    Returns:
        SurvivalData container or None if clinical data is missing
    """
    df = _load_slides(config)
    clinical = _load_clinical(config)

    if clinical is None:
        return None

    # Get feature columns
    feature_cols = get_histomic_features(df)

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        # Subset cancer types
        cancer_counts = df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(dry_run.n_cancer_types).index.tolist()
        df = df[df["cancer_type"].isin(top_cancers)]
        logger.info(
            f"   [DRY-RUN] Subset to {len(df)} slides ({dry_run.n_cancer_types} cancer types)"
        )
        # Subset features
        feature_cols = feature_cols[: dry_run.n_features]
        logger.info(f"   [DRY-RUN] Subset to {len(feature_cols)} features")

    logger.info(f"   Feature columns: {len(feature_cols)}")

    # Enforce one slide per case to avoid pseudo-replication
    df, case_meta = histoatlas.select_case_representative_slides(df)
    logger.info(
        "   Case selection: "
        f"{case_meta['n_rows_in']} slides -> {case_meta['n_rows_out']} cases "
        f"(dropped {case_meta['n_duplicates_dropped']} duplicates)"
    )

    # Merge with clinical data
    df_survival = df.merge(clinical, on="case_id", how="left", suffixes=("", "_clinical"))
    logger.info(f"   Merged: {len(df_survival)} cases")

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
            df_survival = df_survival.merge(tss_df, on="case_id", how="left")
            logger.info(f"   TSS merged: {df_survival['tss'].notna().sum()} cases with TSS")

    # Check available endpoints
    available_endpoints = []
    logger.info("\n   Survival endpoints available:")
    for endpoint in SurvivalEndpoint:
        if endpoint.time_col in df_survival.columns and endpoint.event_col in df_survival.columns:
            n_complete = (
                df_survival[endpoint.time_col].notna() & df_survival[endpoint.event_col].notna()
            ).sum()
            n_events = (df_survival[endpoint.event_col] == 1).sum()
            logger.info(f"     {endpoint.name}: {n_complete} complete, {n_events} events")
            available_endpoints.append(endpoint)

    cancer_types = list(df_survival["cancer_type"].unique())

    return SurvivalData(
        df=df_survival,
        feature_cols=feature_cols,
        cancer_types=cancer_types,
        available_endpoints=available_endpoints,
    )


def _apply_cox_bh_correction(cox_df: pd.DataFrame) -> pd.DataFrame:
    """Apply BH correction to Cox regression results with PH violation handling."""
    if cox_df.empty:
        return cox_df

    # Flag PH-violating features; keep p-values for correction to avoid
    # shrinking correction families in a data-dependent way.
    ph_invalid_mask = cox_df["ph_flag"].isin(["warn", "fail", "error", "unknown"])
    cox_df["cox_valid"] = ~ph_invalid_mask

    if ph_invalid_mask.any():
        n_invalid = ph_invalid_mask.sum()
        logger.info(
            f"   PH-violating/invalid features: {n_invalid} "
            "(HR/CI invalidated, p-values set to 1.0 for BH correction)"
        )
        # Invalidate HR and CI since they're unreliable under PH violation
        cox_df.loc[ph_invalid_mask, "hazard_ratio"] = np.nan
        cox_df.loc[ph_invalid_mask, "hr_ci_lower"] = np.nan
        cox_df.loc[ph_invalid_mask, "hr_ci_upper"] = np.nan

    # Use conservative p-values for PH-violating rows when correcting
    cox_df["p_value_bh"] = cox_df["p_value"]
    cox_df.loc[ph_invalid_mask, "p_value_bh"] = 1.0

    # Apply BH correction across the full family of Cox tests
    cox_df = apply_bh_correction(
        cox_df, p_col="p_value_bh", groupby_cols=["cancer_type", "endpoint", "model"]
    )
    # NaN-out p-values for PH-violating rows (Cox p-value is equally invalid when PH fails)
    cox_df.loc[ph_invalid_mask, "p_value"] = np.nan
    cox_df.loc[ph_invalid_mask, "p_value_adj"] = np.nan

    cox_df["significant_raw"] = (cox_df["p_value"] < 0.05) & cox_df["cox_valid"]
    cox_df["significant_adj"] = (cox_df["p_value_adj"] < 0.05) & cox_df["cox_valid"]

    # Drop internal correction column to avoid confusion in outputs
    if "p_value_bh" in cox_df.columns:
        cox_df = cox_df.drop(columns=["p_value_bh"])

    return cox_df


def _get_n_jobs() -> int:
    """Get n_jobs from HISTOATLAS_N_JOBS env var."""

    return int(os.environ.get("HISTOATLAS_N_JOBS", "-1"))


def _cox_task(
    cancer_data: pd.DataFrame,
    cancer_label: str,
    endpoint: "SurvivalEndpoint",
    feature: str,
    strata: list[str] | None = None,
) -> list[dict]:
    """Execute Cox regression for a single (cancer, endpoint, feature) combination."""
    # Suppress lifelines convergence warnings in loky worker processes
    warnings.filterwarnings("ignore", message=".*convergence.*")
    warnings.filterwarnings("ignore", message=".*divide by zero.*")
    warnings.filterwarnings("ignore", message=".*invalid value.*")

    results = []

    # Unadjusted model
    result = histoatlas.run_cox_regression(
        cancer_data, feature, endpoint.time_col, endpoint.event_col, covariates=None, strata=strata
    )

    if result:
        result_dict = _cox_result_to_dict(result)
        result_dict.update(
            {
                "cancer_type": cancer_label,
                "feature": feature,
                "endpoint": endpoint.name_str,
                "model": "unadjusted",
                "covariates": None,
            }
        )
        results.append(result_dict)

    # Adjusted model (age, sex, stage; stratified by TSS)
    cancer_data = histoatlas.coarsen_stage(cancer_data)
    covariates = histoatlas.select_covariates(cancer_data)

    # TSS handled via stratified Cox (separate baseline hazard per site)
    adj_strata = list(strata) if strata else []
    if "tss" in cancer_data.columns:
        adj_strata.append("tss")

    if covariates:
        # Compute missingness stats (always)
        miss_stats = histoatlas.compute_missingness_stats(
            cancer_data, covariates, feature, endpoint.time_col, endpoint.event_col
        )

        # Try multiple imputation
        imputation_used = False
        n_imputations = None
        fmi = None
        result_adj = None

        imputed_datasets = histoatlas.impute_covariates(
            cancer_data,
            feature,
            endpoint.time_col,
            endpoint.event_col,
            covariates,
            strata=adj_strata if adj_strata else None,
        )

        if imputed_datasets is not None:
            # Run Cox on each imputed dataset
            imputed_results = []
            for ds in imputed_datasets:
                r = histoatlas.run_cox_regression(
                    ds,
                    feature,
                    endpoint.time_col,
                    endpoint.event_col,
                    covariates=covariates,
                    strata=adj_strata if adj_strata else None,
                )
                if r is not None:
                    imputed_results.append(r)

            # Pool if enough fits succeeded (≥3 out of 5)
            if len(imputed_results) >= 3:
                result_adj, fmi = histoatlas.pool_cox_results(imputed_results)
                imputation_used = True
                n_imputations = len(imputed_results)

        # Fall back to complete-case if imputation was skipped or failed
        if result_adj is None:
            result_adj = histoatlas.run_cox_regression(
                cancer_data,
                feature,
                endpoint.time_col,
                endpoint.event_col,
                covariates=covariates,
                strata=adj_strata if adj_strata else None,
            )

        if result_adj:
            result_dict = _cox_result_to_dict(
                result_adj,
                imputation_used=imputation_used,
                n_imputations=n_imputations,
                fmi=fmi,
                missingness_stats=miss_stats,
            )
            result_dict.update(
                {
                    "cancer_type": cancer_label,
                    "feature": feature,
                    "endpoint": endpoint.name_str,
                    "model": "adjusted",
                    "covariates": ",".join(covariates),
                }
            )
            results.append(result_dict)

    return results


def run_cox_analysis(data: SurvivalData) -> pd.DataFrame:
    """Run Cox regression analysis across all features, cancer types, and endpoints.

    Args:
        data: SurvivalData container

    Returns:
        DataFrame with Cox regression results
    """

    logger.info(
        f"   Processing {len(data.feature_cols)} features × "
        f"{len(data.cancer_types)} cancer types × {len(data.available_endpoints)} endpoints"
    )

    n_jobs = _get_n_jobs()

    # Pre-build cancer DataFrames (includes PANCAN if enabled)
    from _cohorts import build_cancer_cohorts

    cohorts = build_cancer_cohorts(data.df, list(data.cancer_types))
    cancer_labels = list(cohorts.keys())
    cancer_dfs = {k: v[0] for k, v in cohorts.items()}

    # Build task list: (cancer_data, cancer_label, endpoint, feature)
    tasks = []
    for cancer in cancer_labels:
        cancer_data = cancer_dfs[cancer]
        strata = cohorts[cancer][1]
        for endpoint in data.available_endpoints:
            if endpoint.time_col not in cancer_data.columns:
                continue
            valid_data = cancer_data[[endpoint.time_col, endpoint.event_col]].dropna()
            if len(valid_data) < 30 or valid_data[endpoint.event_col].sum() < 10:
                continue
            for feature in data.feature_cols:
                tasks.append((cancer_data, cancer, endpoint, feature, strata))

    logger.info(f"   Dispatching {len(tasks)} Cox tasks (n_jobs={n_jobs})")

    # Parallel dispatch

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_cox_task)(cancer_data, cancer_label, endpoint, feature, strata)
        for cancer_data, cancer_label, endpoint, feature, strata in tqdm(
            tasks, desc="Cox regression tasks"
        )
    )

    # Flatten results
    cox_results = []
    for result_list in task_results:
        cox_results.extend(result_list)

    cox_df = pd.DataFrame(cox_results)
    cox_df = _apply_cox_bh_correction(cox_df)

    return cox_df


def _compute_group_mask(
    cancer_data: pd.DataFrame,
    survival_subset: pd.DataFrame,
    feature: str,
    time_col: str,
    event_col: str,
    stratification: str,
    group: str,
) -> pd.Series:
    """Compute the boolean mask for a KM stratification group."""
    if stratification == "median":
        median_val = survival_subset[feature].median()
        if group == "High":
            return (
                (cancer_data[feature] > median_val)
                & cancer_data[time_col].notna()
                & cancer_data[event_col].notna()
            )
        else:
            return (
                (cancer_data[feature] <= median_val)
                & cancer_data[time_col].notna()
                & cancer_data[event_col].notna()
            )
    else:
        # Quartile stratification
        q1, q3 = survival_subset[feature].quantile([0.25, 0.75])
        if "High" in group:
            return (
                (cancer_data[feature] >= q3)
                & cancer_data[time_col].notna()
                & cancer_data[event_col].notna()
            )
        else:
            # Use (feature <= q1) & (feature < q3) to match kaplan_meier.py
            # behavior when q1 == q3 (edge case with low variance features)
            return (
                (cancer_data[feature] <= q1)
                & (cancer_data[feature] < q3)
                & cancer_data[time_col].notna()
                & cancer_data[event_col].notna()
            )


def _km_task(
    cancer_data: pd.DataFrame,
    cancer_label: str,
    endpoint: "SurvivalEndpoint",
    feature: str,
) -> list[dict]:
    """Execute KM curve computation for a single (cancer, endpoint, feature) combination."""
    results = []
    for stratification in ["median", "quartile"]:
        km_data = histoatlas.compute_km_curves(
            cancer_data,
            feature,
            endpoint.time_col,
            endpoint.event_col,
            stratification=stratification,
            time_points=STANDARD_TIME_POINTS,
        )

        if km_data:
            flat_km = _flatten_km_result(km_data)
            for group, group_data in flat_km["groups"].items():
                survival_subset = cancer_data[
                    [feature, endpoint.time_col, endpoint.event_col]
                ].dropna()

                group_mask = _compute_group_mask(
                    cancer_data,
                    survival_subset,
                    feature,
                    endpoint.time_col,
                    endpoint.event_col,
                    stratification,
                    group,
                )

                median_surv = histoatlas.compute_median_survival(
                    cancer_data, endpoint.time_col, endpoint.event_col, group_mask
                )

                results.append(
                    {
                        "cancer_type": cancer_label,
                        "feature": feature,
                        "endpoint": endpoint.name_str,
                        "stratification": stratification,
                        "group": group,
                        "time_points": group_data["time_points"],
                        "survival_probs": group_data["survival_probs"],
                        "ci_lower": group_data["ci_lower"],
                        "ci_upper": group_data["ci_upper"],
                        "n_at_risk": group_data["n_at_risk"],
                        "censoring_times": group_data["censoring_times"],
                        "censoring_probs": group_data["censoring_probs"],
                        "n_samples": group_data["n_samples"],
                        "n_events": group_data["n_events"],
                        "median_survival": median_surv,
                    }
                )
    return results


def compute_km_curves_for_features(data: SurvivalData) -> pd.DataFrame:
    """Compute Kaplan-Meier curves for feature stratifications.

    Args:
        data: SurvivalData container

    Returns:
        DataFrame with KM curve data
    """

    n_jobs = _get_n_jobs()

    # Pre-build cancer DataFrames (includes PANCAN if enabled)
    from _cohorts import build_cancer_cohorts

    cohorts = build_cancer_cohorts(data.df, list(data.cancer_types))
    cancer_labels = list(cohorts.keys())
    cancer_dfs = {k: v[0] for k, v in cohorts.items()}

    # Build task list
    tasks = []
    for cancer in cancer_labels:
        cancer_data = cancer_dfs[cancer]
        for endpoint in data.available_endpoints:
            if endpoint.time_col not in cancer_data.columns:
                continue
            valid_data = cancer_data[[endpoint.time_col, endpoint.event_col]].dropna()
            if len(valid_data) < 30 or valid_data[endpoint.event_col].sum() < 10:
                continue
            for feature in data.feature_cols:
                tasks.append((cancer_data, cancer, endpoint, feature))

    logger.info(f"   Dispatching {len(tasks)} KM tasks (n_jobs={n_jobs})")

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_km_task)(cancer_data, cancer_label, endpoint, feature)
        for cancer_data, cancer_label, endpoint, feature in tqdm(tasks, desc="KM curve tasks")
    )

    km_results = []
    for result_list in task_results:
        km_results.extend(result_list)

    return pd.DataFrame(km_results)


def _cluster_survival_task(
    df_data: pd.DataFrame,
    cluster_col: str,
    cluster_id: int,
    endpoint: "SurvivalEndpoint",
    cluster_level: str,
    analysis_type: str,
    cancer_type: str,
    strata: list[str] | None = None,
) -> tuple[list[dict], list[dict]]:
    """Execute cluster survival analysis for a single (cluster, endpoint) pair."""
    survival_results = []
    km_results = []

    if endpoint.time_col not in df_data.columns:
        return survival_results, km_results

    result = histoatlas.compute_cluster_survival(
        df_data,
        cluster_col,
        cluster_id,
        endpoint.time_col,
        endpoint.event_col,
        STANDARD_TIME_POINTS,
        compute_adjusted=True,
        strata=strata,
    )

    if result:
        cluster_mask = df_data[cluster_col] == cluster_id
        rest_mask = df_data[cluster_col] != cluster_id

        survival_notna = df_data[endpoint.time_col].notna() & df_data[endpoint.event_col].notna()
        median_cluster = histoatlas.compute_median_survival(
            df_data,
            endpoint.time_col,
            endpoint.event_col,
            cluster_mask & survival_notna,
        )
        median_rest = histoatlas.compute_median_survival(
            df_data,
            endpoint.time_col,
            endpoint.event_col,
            rest_mask & survival_notna,
        )

        unadj = result.get("cox_unadjusted", {})
        if unadj:
            survival_results.append(
                _build_cluster_survival_result(
                    cluster_level=cluster_level,
                    analysis_type=analysis_type,
                    cancer_type=cancer_type,
                    cluster_id=cluster_id,
                    endpoint=endpoint,
                    model="unadjusted",
                    cox_result=unadj,
                    logrank_result=result["logrank"],
                    median_cluster=median_cluster,
                    median_rest=median_rest,
                    covariates=None,
                )
            )

        adj = result.get("cox_adjusted", {})
        if adj:
            survival_results.append(
                _build_cluster_survival_result(
                    cluster_level=cluster_level,
                    analysis_type=analysis_type,
                    cancer_type=cancer_type,
                    cluster_id=cluster_id,
                    endpoint=endpoint,
                    model="adjusted",
                    cox_result=adj,
                    logrank_result=None,
                    median_cluster=median_cluster,
                    median_rest=median_rest,
                    covariates=adj.get("covariates", []),
                )
            )

        for group_name, km_data in result["km_curves"]["groups"].items():
            km_results.append(
                _build_cluster_km_result(
                    cluster_level=cluster_level,
                    analysis_type=analysis_type,
                    cancer_type=cancer_type,
                    cluster_id=cluster_id,
                    endpoint=endpoint,
                    group_name=group_name,
                    km_data=km_data,
                )
            )

    return survival_results, km_results


def _compute_l1_cluster_survival(
    df_survival: pd.DataFrame,
    available_endpoints: list[SurvivalEndpoint],
) -> tuple[list[dict], list[dict]]:
    """Compute L1 (pan-tumor) cluster survival analysis.

    L1 clusters are morphological patterns that span across cancer types.
    We analyze them with pooled pan-cancer data and compute median survival.

    Args:
        df_survival: Merged survival DataFrame
        available_endpoints: List of available survival endpoints

    Returns:
        Tuple of (survival_results, km_results)
    """

    cluster_col = "cluster_l1"
    cluster_ids = sorted(df_survival[cluster_col].dropna().unique())
    logger.info(f"   Analyzing {len(cluster_ids)} L1 clusters (pan-cancer)")

    n_jobs = _get_n_jobs()
    tasks = [
        (df_survival, cluster_col, cluster_id, endpoint, "L1", "pan_cancer", "ALL", ["cancer_type"])
        for cluster_id in cluster_ids
        for endpoint in available_endpoints
    ]

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_cluster_survival_task)(*t) for t in tqdm(tasks, desc="L1 cluster survival tasks")
    )

    cluster_survival_results = []
    cluster_km_results = []
    for surv, km in task_results:
        cluster_survival_results.extend(surv)
        cluster_km_results.extend(km)

    return cluster_survival_results, cluster_km_results


def _compute_l2_cluster_survival(
    df_survival: pd.DataFrame,
    available_endpoints: list[SurvivalEndpoint],
) -> tuple[list[dict], list[dict]]:
    """Compute L2 (cancer-specific) cluster survival analysis.

    L2 clusters are subdivisions within each cancer type. We analyze them
    per-cancer since that's where they are defined and meaningful.

    Args:
        df_survival: Merged survival DataFrame
        available_endpoints: List of available survival endpoints

    Returns:
        Tuple of (survival_results, km_results)
    """

    cluster_col = "cluster_l2"
    cancer_types = df_survival["cancer_type"].unique()
    logger.info(f"   Analyzing L2 clusters across {len(cancer_types)} cancer types (per-cancer)")

    n_jobs = _get_n_jobs()

    # Build task list across all cancers, clusters, and endpoints
    tasks = []
    for cancer in cancer_types:
        cancer_data = df_survival[df_survival["cancer_type"] == cancer]
        cancer_cluster_ids = sorted(cancer_data[cluster_col].dropna().unique())
        for cluster_id in cancer_cluster_ids:
            for endpoint in available_endpoints:
                tasks.append(
                    (cancer_data, cluster_col, cluster_id, endpoint, "L2", "per_cancer", cancer)
                )

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_cluster_survival_task)(*t) for t in tqdm(tasks, desc="L2 cluster survival tasks")
    )

    cluster_survival_results = []
    cluster_km_results = []
    for surv, km in task_results:
        cluster_survival_results.extend(surv)
        cluster_km_results.extend(km)

    return cluster_survival_results, cluster_km_results


def _apply_cluster_bh_correction(cluster_surv_df: pd.DataFrame) -> pd.DataFrame:
    """Apply BH correction to cluster survival results."""
    if cluster_surv_df.empty:
        return cluster_surv_df

    # Flag PH-violating clusters and invalidate HR/CI
    ph_invalid_mask = cluster_surv_df["cox_ph_flag"].isin(["warn", "fail", "error", "unknown"])
    cluster_surv_df["cox_valid"] = ~ph_invalid_mask
    if ph_invalid_mask.any():
        cluster_surv_df.loc[ph_invalid_mask, "hazard_ratio"] = np.nan
        cluster_surv_df.loc[ph_invalid_mask, "hr_ci_lower"] = np.nan
        cluster_surv_df.loc[ph_invalid_mask, "hr_ci_upper"] = np.nan

    # Conservative p-values for BH correction under PH violations
    cluster_surv_df["cox_p_bh"] = cluster_surv_df["cox_p"]
    cluster_surv_df.loc[ph_invalid_mask, "cox_p_bh"] = 1.0

    # BH correction for Cox p-values
    cluster_surv_df = apply_bh_correction(
        cluster_surv_df,
        p_col="cox_p_bh",
        groupby_cols=["cluster_level", "analysis_type", "cancer_type", "endpoint", "model"],
    )
    cluster_surv_df = cluster_surv_df.rename(
        columns={
            "p_value_adj": "cox_p_adj",
            "n_tests_in_family": "cox_n_tests_in_family",
            "correction_family_id": "cox_correction_family_id",
        }
    )
    # NaN-out p-values for PH-violating rows (Cox p-value is equally invalid when PH fails)
    cluster_surv_df.loc[ph_invalid_mask, "cox_p"] = np.nan
    cluster_surv_df.loc[ph_invalid_mask, "cox_p_adj"] = np.nan

    if "cox_p_bh" in cluster_surv_df.columns:
        cluster_surv_df = cluster_surv_df.drop(columns=["cox_p_bh"])

    # BH correction for log-rank p-values (computed once per cluster/endpoint)
    logrank_mask = cluster_surv_df["logrank_p"].notna()
    if logrank_mask.any():
        logrank_subset = cluster_surv_df.loc[logrank_mask].copy()
        logrank_subset["_row_index"] = logrank_subset.index
        logrank_corrected = apply_bh_correction(
            logrank_subset,
            p_col="logrank_p",
            groupby_cols=["cluster_level", "analysis_type", "cancer_type", "endpoint"],
        )
        cluster_surv_df.loc[logrank_corrected["_row_index"], "logrank_p_adj"] = logrank_corrected[
            "p_value_adj"
        ].values
        cluster_surv_df.loc[logrank_corrected["_row_index"], "logrank_n_tests_in_family"] = (
            logrank_corrected["n_tests_in_family"].values
        )
        cluster_surv_df.loc[logrank_corrected["_row_index"], "logrank_correction_family_id"] = (
            logrank_corrected["correction_family_id"].values
        )
    else:
        cluster_surv_df["logrank_p_adj"] = np.nan
        cluster_surv_df["logrank_n_tests_in_family"] = np.nan
        cluster_surv_df["logrank_correction_family_id"] = np.nan

    # Significance flags
    cluster_surv_df["cox_significant_raw"] = (cluster_surv_df["cox_p"] < 0.05) & cluster_surv_df[
        "cox_valid"
    ]
    cluster_surv_df["cox_significant_adj"] = (
        cluster_surv_df["cox_p_adj"] < 0.05
    ) & cluster_surv_df["cox_valid"]
    cluster_surv_df["logrank_significant_raw"] = cluster_surv_df["logrank_p"] < 0.05
    cluster_surv_df["logrank_significant_adj"] = cluster_surv_df["logrank_p_adj"] < 0.05

    return cluster_surv_df


def compute_cluster_survival_analysis(
    data: SurvivalData,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Compute cluster survival analysis for L1 and L2 clusters.

    L1 (pan-tumor) clusters span cancer types, so we analyze them pan-cancer.
    L2 (cancer-specific) clusters are subdivisions within each cancer type,
    so we analyze them per-cancer.

    Args:
        data: SurvivalData container

    Returns:
        Tuple of (cluster_survival_df, cluster_km_df)
    """
    from _config import include_pancan

    all_survival_results = []
    all_km_results = []

    # L1: pan-cancer analysis (only if PANCAN is enabled)
    if include_pancan():
        l1_surv, l1_km = _compute_l1_cluster_survival(data.df, data.available_endpoints)
        all_survival_results.extend(l1_surv)
        all_km_results.extend(l1_km)

    # L2: per-cancer analysis
    l2_surv, l2_km = _compute_l2_cluster_survival(data.df, data.available_endpoints)
    all_survival_results.extend(l2_surv)
    all_km_results.extend(l2_km)

    # Create DataFrames and apply corrections
    cluster_surv_df = pd.DataFrame(all_survival_results)
    cluster_surv_df = _apply_cluster_bh_correction(cluster_surv_df)

    cluster_km_df = pd.DataFrame(all_km_results)

    return cluster_surv_df, cluster_km_df


def save_results(
    cox_df: pd.DataFrame,
    km_df: pd.DataFrame,
    cluster_surv_df: pd.DataFrame,
    cluster_km_df: pd.DataFrame,
    config: Config,
) -> None:
    """Save all result DataFrames to parquet files.

    Args:
        cox_df: Cox regression results
        km_df: KM curve data
        cluster_surv_df: Cluster survival results
        cluster_km_df: Cluster KM curve data
        config: Configuration object
    """
    from _paths import CLUSTER_ANALYSES_DIR, PRECOMPUTED_STATS_DIR, ensure_dirs

    ensure_dirs()
    PRECOMPUTED_STATS_DIR.mkdir(parents=True, exist_ok=True)
    CLUSTER_ANALYSES_DIR.mkdir(parents=True, exist_ok=True)

    cox_df.to_parquet(config.cox_output_path, index=False)
    logger.info(f"   Saved survival_associations.parquet ({len(cox_df)} results)")
    if not cox_df.empty:
        logger.info(f"   Significant (raw p < 0.05): {cox_df['significant_raw'].sum()}")
        logger.info(f"   Significant (BH-adjusted p < 0.05): {cox_df['significant_adj'].sum()}")

    km_df.to_parquet(config.km_output_path, index=False)
    logger.info(f"   Saved km_curve_data.parquet ({len(km_df)} curves)")

    cluster_surv_df.to_parquet(config.cluster_survival_output_path, index=False)
    logger.info(f"   Saved cluster_survival_summary.parquet ({len(cluster_surv_df)} results)")

    cluster_km_df.to_parquet(config.cluster_km_output_path, index=False)
    logger.info(f"   Saved cluster_km_curve_data.parquet ({len(cluster_km_df)} curves)")


def print_summary() -> None:
    """Print final summary."""
    logger.info("\n" + "=" * 60)
    logger.info("ANALYSIS COMPLETE")
    logger.info("=" * 60)
    logger.info("\nOutput files:")
    logger.info("  - survival_associations.parquet")
    logger.info("  - km_curve_data.parquet")
    logger.info("  - cluster_survival_summary.parquet")
    logger.info("  - cluster_km_curve_data.parquet")


def main(config: Config) -> None:
    """Orchestrate the survival analysis pipeline."""
    logger.info("=" * 60)
    logger.info("SURVIVAL ANALYSIS COMPUTATION")
    logger.info("=" * 60)

    logger.info("\n1. Loading data...")
    data = load_data(config)
    if data is None:
        return

    logger.info("\n2. Running Cox regression analysis...")
    cox_df = run_cox_analysis(data)

    logger.info("\n3. Computing Kaplan-Meier curves...")
    km_df = compute_km_curves_for_features(data)

    logger.info("\n4. Computing cluster survival analysis...")
    cluster_surv_df, cluster_km_df = compute_cluster_survival_analysis(data)

    logger.info("\n5. Saving results...")
    save_results(cox_df, km_df, cluster_surv_df, cluster_km_df, config)

    print_summary()


if __name__ == "__main__":
    config = Config()
    main(config)
