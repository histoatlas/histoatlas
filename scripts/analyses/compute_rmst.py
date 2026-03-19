#!/usr/bin/env python3
"""
Compute Restricted Mean Survival Time (RMST) for PH-Violating Features.

When the proportional hazards assumption fails (ph_flag='warn' or 'fail'), Cox HR is unreliable.
RMST provides an alternative summary: the average survival time up to a specified horizon.

Output: Updates survival_associations.parquet with RMST columns.
"""

import logging
import os
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from joblib import Parallel, delayed
from tqdm.auto import tqdm

from histoatlas import (
    apply_bh_correction,
    compute_rmst_difference,
    get_horizon_for_cancer,
    select_case_representative_slides,
)

# Suppress lifelines convergence warnings and numpy divide-by-zero in RMST computation
warnings.filterwarnings("ignore", message=".*convergence.*")
warnings.filterwarnings("ignore", message=".*divide by zero.*")
warnings.filterwarnings("ignore", message=".*invalid value.*")
logger = logging.getLogger(__name__)

# Endpoint-specific column mapping (matches compute_survival.py)
ENDPOINT_COLUMNS = {
    "os": ("os_months", "os_status"),
    "pfs": ("pfs_months", "pfs_status"),
    "dss": ("dss_months", "dss_status"),
    "dfs": ("dfs_months", "dfs_status"),
}


@dataclass
class Config:
    """Configuration for RMST computation."""

    @property
    def slides_path(self) -> Path:
        from _paths import SLIDE_HISTOMICS

        return SLIDE_HISTOMICS

    @property
    def clinical_path(self) -> Path:
        from _paths import CLINICAL_UNIFIED

        return CLINICAL_UNIFIED

    @property
    def survival_associations_path(self) -> Path:
        from _paths import SURVIVAL_ASSOCIATIONS

        return SURVIVAL_ASSOCIATIONS


@dataclass
class RmstResult:
    """Result of RMST computation for a single feature."""

    cancer_type: str
    endpoint: str
    feature: str
    model: str
    rmst_difference: float | None = None
    rmst_ci_lower: float | None = None
    rmst_ci_upper: float | None = None
    rmst_p_value: float | None = None
    rmst_group_low: float | None = None
    rmst_group_high: float | None = None
    rmst_horizon_days: float | None = None

    @classmethod
    def empty(cls, cancer_type: str, endpoint: str, feature: str, model: str) -> "RmstResult":
        """Create result with all metrics as None (for skip cases)."""
        return cls(cancer_type=cancer_type, endpoint=endpoint, feature=feature, model=model)


def _load_survival_associations(config: Config) -> pd.DataFrame:
    """Load and report survival associations."""
    survival_df = pd.read_parquet(config.survival_associations_path)
    logger.info("Total survival associations: %d", len(survival_df))
    return survival_df


def _filter_ph_violating(survival_df: pd.DataFrame) -> pd.DataFrame:
    """Filter to PH-violating features (unadjusted models only)."""
    ph_violating_df = survival_df[
        survival_df["ph_flag"].isin(["warn", "fail", "error", "unknown"])
        & (survival_df["model"] == "unadjusted")
    ]
    logger.info(
        "PH-violating/invalid (ph_flag in warn/fail/error/unknown): %d", len(ph_violating_df)
    )

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run and len(ph_violating_df) > 0:
        # Subset to top N cancer types
        cancer_counts = ph_violating_df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(dry_run.n_cancer_types).index.tolist()
        ph_violating_df = ph_violating_df[ph_violating_df["cancer_type"].isin(top_cancers)]
        logger.info(f"[DRY-RUN] Subset to {len(ph_violating_df)} PH-violating features")

    return ph_violating_df


def _load_slides(config: Config) -> pd.DataFrame:
    """Load slide features with case_id extraction and representative selection."""
    slides_df = pd.read_parquet(config.slides_path)
    if "case_id" not in slides_df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")

    slides_df, case_meta = select_case_representative_slides(slides_df)
    logger.info(
        "Case selection: %d slides -> %d cases (dropped %d duplicates)",
        case_meta["n_rows_in"],
        case_meta["n_rows_out"],
        case_meta["n_duplicates_dropped"],
    )
    return slides_df


def _load_clinical(config: Config) -> pd.DataFrame | None:
    """Load clinical data, return None if not found."""
    if not config.clinical_path.exists():
        logger.error("Clinical data not found at %s", config.clinical_path)
        return None

    clinical_df = pd.read_parquet(config.clinical_path)
    logger.info("Clinical data: %d patients", len(clinical_df))

    logger.info("Survival endpoints available:")
    for endpoint_name, (time_col, event_col) in ENDPOINT_COLUMNS.items():
        if time_col in clinical_df.columns and event_col in clinical_df.columns:
            n_complete = (clinical_df[time_col].notna() & clinical_df[event_col].notna()).sum()
            n_events = (clinical_df[event_col] == 1).sum()
            logger.info("  %s: %d complete, %d events", endpoint_name.upper(), n_complete, n_events)

    return clinical_df


def _merge_data(slides_df: pd.DataFrame, clinical_df: pd.DataFrame) -> pd.DataFrame:
    """Merge slides with clinical data."""
    merged_df = slides_df.merge(clinical_df, on="case_id", how="left", suffixes=("", "_clinical"))
    logger.info("Cases with clinical data: %d", len(merged_df))
    return merged_df


def _compute_rmst_for_feature(
    cancer_df: pd.DataFrame,
    cancer_type: str,
    endpoint: str,
    feature: str,
    model: str,
) -> RmstResult:
    """
    Compute RMST difference for a single feature.

    Returns RmstResult with metrics, or empty result if data insufficient.
    """
    # Suppress convergence/numerical warnings in loky worker processes
    warnings.filterwarnings("ignore", message=".*convergence.*")
    warnings.filterwarnings("ignore", message=".*divide by zero.*")
    warnings.filterwarnings("ignore", message=".*invalid value.*")

    # Get endpoint-specific columns
    if endpoint not in ENDPOINT_COLUMNS:
        return RmstResult.empty(cancer_type, endpoint, feature, model)

    time_col, event_col = ENDPOINT_COLUMNS[endpoint]

    # Check columns exist
    if time_col not in cancer_df.columns or event_col not in cancer_df.columns:
        return RmstResult.empty(cancer_type, endpoint, feature, model)

    if len(cancer_df) < 20:
        return RmstResult.empty(cancer_type, endpoint, feature, model)

    # Get feature values
    if feature not in cancer_df.columns:
        return RmstResult.empty(cancer_type, endpoint, feature, model)

    feature_vals = cancer_df[feature].values
    # Use endpoint-specific columns; convert months to days
    time = cancer_df[time_col].values * 30.44  # months to days
    event = cancer_df[event_col].values  # Don't convert to int yet - may have NaN

    mask = ~np.isnan(feature_vals) & ~np.isnan(time) & ~pd.isna(event)
    feature_vals = feature_vals[mask]
    time = time[mask]
    event = event[mask].astype(int)

    if len(time) < 20:
        return RmstResult.empty(cancer_type, endpoint, feature, model)

    # Median split (use strict inequality > for consistency with KM visualization)
    median_val = np.median(feature_vals)
    group = (feature_vals > median_val).astype(int)  # 0=low, 1=high

    # Get horizon for this cancer type
    horizon = get_horizon_for_cancer(cancer_type)

    # Compute RMST difference
    rmst_result = compute_rmst_difference(time, event, group, horizon)

    return RmstResult(
        cancer_type=cancer_type,
        endpoint=endpoint,
        feature=feature,
        model=model,
        rmst_difference=rmst_result["rmst_difference"],
        rmst_ci_lower=rmst_result["rmst_ci_lower"],
        rmst_ci_upper=rmst_result["rmst_ci_upper"],
        rmst_p_value=rmst_result["rmst_p_value"],
        rmst_group_low=rmst_result["rmst_group_low"],
        rmst_group_high=rmst_result["rmst_group_high"],
        rmst_horizon_days=horizon,
    )


def _compute_all_rmst(merged_df: pd.DataFrame, ph_violating_df: pd.DataFrame) -> list[RmstResult]:
    """Compute RMST for all PH-violating feature combinations."""
    unique_combos = ph_violating_df[
        ["cancer_type", "endpoint", "feature", "model"]
    ].drop_duplicates()
    logger.info("Unique feature-cancer combinations: %d", len(unique_combos))

    n_jobs = int(os.environ.get("HISTOATLAS_N_JOBS", "-1"))

    # Pre-compute cancer DataFrames
    cancer_dfs: dict[str, pd.DataFrame] = {}
    for cancer_type in unique_combos["cancer_type"].unique():
        cancer_dfs[cancer_type] = merged_df[merged_df["cancer_type"] == cancer_type]

    # Build task list
    tasks = [
        (
            cancer_dfs[row["cancer_type"]],
            row["cancer_type"],
            row["endpoint"],
            row["feature"],
            row["model"],
        )
        for _, row in unique_combos.iterrows()
    ]

    logger.info("Dispatching %d RMST tasks (n_jobs=%d)", len(tasks), n_jobs)

    rmst_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_compute_rmst_for_feature)(
            cancer_df=cancer_df,
            cancer_type=cancer_type,
            endpoint=endpoint,
            feature=feature,
            model=model,
        )
        for cancer_df, cancer_type, endpoint, feature, model in tqdm(
            tasks, desc="RMST computations"
        )
    )

    return rmst_results


def _apply_rmst_correction(rmst_df: pd.DataFrame) -> pd.DataFrame:
    """Apply BH correction to RMST p-values."""
    if rmst_df.empty:
        return rmst_df

    rmst_df = apply_bh_correction(
        rmst_df,
        p_col="rmst_p_value",
        groupby_cols=["cancer_type", "endpoint", "model"],
    )
    rmst_df = rmst_df.rename(
        columns={
            "p_value_adj": "rmst_p_adj",
            "n_tests_in_family": "rmst_n_tests_in_family",
            "correction_family_id": "rmst_correction_family_id",
        }
    )
    rmst_df["rmst_significant_adj"] = rmst_df["rmst_p_adj"] < 0.05
    return rmst_df


def _format_rmst_interpretation(row: pd.Series) -> str | None:
    """Format human-readable RMST interpretation."""
    if pd.isna(row.get("rmst_difference")):
        return None

    diff = row["rmst_difference"]
    horizon = row["rmst_horizon_days"]

    if diff > 0:
        direction = "longer"
    elif diff < 0:
        direction = "shorter"
        diff = abs(diff)
    else:
        return f"High values associated with no difference in mean survival up to {horizon / 365:.1f} years"

    return f"High values associated with {diff:.0f} days {direction} mean survival up to {horizon / 365:.1f} years"


def _merge_rmst_results(survival_df: pd.DataFrame, rmst_df: pd.DataFrame) -> pd.DataFrame:
    """Merge RMST results back to survival associations."""
    # Drop existing RMST columns if present (allows re-running the script)
    rmst_cols = [
        "rmst_difference",
        "rmst_ci_lower",
        "rmst_ci_upper",
        "rmst_p_value",
        "rmst_p_adj",
        "rmst_n_tests_in_family",
        "rmst_correction_family_id",
        "rmst_significant_adj",
        "rmst_group_low",
        "rmst_group_high",
        "rmst_horizon_days",
        "rmst_interpretation",
    ]
    existing_rmst_cols = [col for col in rmst_cols if col in survival_df.columns]
    if existing_rmst_cols:
        logger.info("Dropping existing RMST columns: %s", existing_rmst_cols)
        survival_df = survival_df.drop(columns=existing_rmst_cols)

    # Merge RMST results
    survival_df = survival_df.merge(
        rmst_df,
        on=["cancer_type", "endpoint", "feature", "model"],
        how="left",
    )

    # Add interpretation
    survival_df["rmst_interpretation"] = survival_df.apply(_format_rmst_interpretation, axis=1)

    return survival_df


def _save_results(survival_df: pd.DataFrame, config: Config) -> None:
    """Save updated survival associations."""
    survival_df.to_parquet(config.survival_associations_path, index=False)
    logger.info("Updated %d survival associations", len(survival_df))


def _print_summary(survival_df: pd.DataFrame) -> None:
    """Print summary statistics."""
    logger.info("")
    logger.info("=" * 60)
    logger.info("RMST COMPUTATION COMPLETE")
    logger.info("=" * 60)

    computed_rmst = survival_df[survival_df["rmst_difference"].notna()]
    logger.info("RMST computed for %d PH-violating associations", len(computed_rmst))

    if len(computed_rmst) > 0:
        logger.info("RMST difference statistics (days):")
        logger.info("  Mean: %.1f", computed_rmst["rmst_difference"].mean())
        logger.info("  Median: %.1f", computed_rmst["rmst_difference"].median())
        logger.info("  Min: %.1f", computed_rmst["rmst_difference"].min())
        logger.info("  Max: %.1f", computed_rmst["rmst_difference"].max())

        # Count significant RMST differences (CI excludes 0)
        sig_rmst = computed_rmst[
            (computed_rmst["rmst_ci_lower"] > 0) | (computed_rmst["rmst_ci_upper"] < 0)
        ]
        logger.info(
            "Significant (CI excludes 0): %d (%.1f%%)",
            len(sig_rmst),
            len(sig_rmst) / len(computed_rmst) * 100,
        )

    logger.info("New columns added:")
    logger.info("  - rmst_difference: RMST(high) - RMST(low) in days")
    logger.info("  - rmst_ci_lower, rmst_ci_upper: 95%% CI for RMST difference")
    logger.info("  - rmst_p_value, rmst_p_adj: Raw and BH-adjusted p-values for RMST difference")
    logger.info("  - rmst_group_low, rmst_group_high: RMST for each group")
    logger.info("  - rmst_horizon_days: Time horizon used (default 1095 = 3 years)")
    logger.info("  - rmst_interpretation: Human-readable interpretation")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    logger.info("=" * 60)
    logger.info("COMPUTING RMST FOR PH-VIOLATING FEATURES")
    logger.info("=" * 60)

    config = Config()

    # Phase 1: Load data
    logger.info("")
    logger.info("1. Loading data...")
    survival_df = _load_survival_associations(config)
    ph_violating_df = _filter_ph_violating(survival_df)
    if ph_violating_df.empty:
        logger.info("No PH-violating features found. Exiting.")
        return

    slides_df = _load_slides(config)
    clinical_df = _load_clinical(config)
    if clinical_df is None:
        return

    merged_df = _merge_data(slides_df, clinical_df)

    # Phase 2: Compute RMST
    logger.info("")
    logger.info("2. Computing RMST for PH-violating features...")
    rmst_results = _compute_all_rmst(merged_df, ph_violating_df)
    rmst_df = pd.DataFrame([asdict(r) for r in rmst_results])
    logger.info("Computed RMST for %d associations", len(rmst_df))

    # Phase 3: Multiple testing correction
    rmst_df = _apply_rmst_correction(rmst_df)

    # Phase 4: Merge and save
    logger.info("")
    logger.info("3. Updating survival associations with RMST...")
    survival_df = _merge_rmst_results(survival_df, rmst_df)
    _save_results(survival_df, config)

    # Phase 5: Report summary
    _print_summary(survival_df)


if __name__ == "__main__":
    main()
