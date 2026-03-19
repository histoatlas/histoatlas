"""
Feature reliability tier classification based on survival and correlation results.

Classifies each feature into a reliability tier based on how consistently
it shows significant associations across cancer types:

- Tier 1 (Robust): Significant in >= 5 cancer types with consistent direction
- Tier 2 (Moderate): Significant in 3-4 cancer types
- Tier 3 (Limited): Significant in 1-2 cancer types
- Tier 4 (Unreliable): Never significant or inconsistent direction

Output:
- supplementary/feature_reliability_tiers.parquet
"""

import logging

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    FEATURE_CORRELATIONS,
    FEATURE_RELIABILITY_TIERS,
    SURVIVAL_ASSOCIATIONS,
    ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FDR_THRESHOLD = 0.05
DIRECTION_CONSISTENCY_THRESHOLD = 0.75


def _classify_tier(
    n_sig_types: int, direction_consistent: bool
) -> int:
    """Assign reliability tier based on significance count and consistency.

    Args:
        n_sig_types: Number of cancer types with significant result.
        direction_consistent: Whether the direction is consistent across types.

    Returns:
        Tier number (1-4).
    """
    if n_sig_types >= 5 and direction_consistent:
        return 1
    if n_sig_types >= 3:
        return 2
    if n_sig_types >= 1:
        return 3
    return 4


def _tier_label(tier: int) -> str:
    """Human-readable tier label."""
    labels = {
        1: "Robust",
        2: "Moderate",
        3: "Limited",
        4: "Unreliable",
    }
    return labels.get(tier, "Unknown")


def compute_survival_reliability(
    surv_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute reliability metrics from survival associations.

    Args:
        surv_df: Survival associations dataframe.

    Returns:
        DataFrame with per-feature survival reliability metrics.
    """
    # Focus on OS endpoint, primary model
    os_df = surv_df[surv_df["endpoint"] == "os"].copy()
    if "model" in os_df.columns:
        model_counts = os_df["model"].value_counts()
        primary_model = model_counts.index[0]
        os_df = os_df[os_df["model"] == primary_model]

    records: list[dict] = []
    for feature, group in os_df.groupby("feature"):
        n_cancer_types = group["cancer_type"].nunique()
        sig_mask = group["p_value_adj"] < FDR_THRESHOLD
        n_sig = int(sig_mask.sum())

        valid_hr = group["hazard_ratio"].dropna()
        n_harmful = int((valid_hr > 1.0).sum())
        n_protective = int((valid_hr < 1.0).sum())
        dominant_count = max(n_harmful, n_protective)
        direction_consistency = (
            dominant_count / len(valid_hr) if len(valid_hr) > 0 else 0.0
        )
        dominant_direction = "harmful" if n_harmful >= n_protective else "protective"
        direction_consistent = direction_consistency >= DIRECTION_CONSISTENCY_THRESHOLD

        tier = _classify_tier(n_sig, direction_consistent)

        records.append(
            {
                "feature": feature,
                "survival_n_cancer_types_tested": n_cancer_types,
                "survival_n_significant": n_sig,
                "survival_significance_rate": n_sig / n_cancer_types if n_cancer_types > 0 else 0.0,
                "survival_dominant_direction": dominant_direction,
                "survival_direction_consistency": direction_consistency,
                "survival_direction_consistent": direction_consistent,
                "survival_median_hr": float(valid_hr.median()) if len(valid_hr) > 0 else np.nan,
                "survival_tier": tier,
                "survival_tier_label": _tier_label(tier),
            }
        )

    return pd.DataFrame(records)


def compute_correlation_reliability(
    corr_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute reliability metrics from molecular correlation data.

    Args:
        corr_df: Feature correlations dataframe.

    Returns:
        DataFrame with per-feature correlation reliability metrics.
    """
    records: list[dict] = []

    for feature, group in corr_df.groupby("histomic_feature"):
        n_cancer_types = group["cancer_type"].nunique()

        # Count cancer types where at least one molecular feature is significant
        sig_by_cancer = (
            group[group["is_significant"]]
            .groupby("cancer_type")
            .size()
        )
        n_sig_types = len(sig_by_cancer)

        # Direction consistency: check if median rho is consistently pos/neg
        median_rho_by_cancer = group.groupby("cancer_type")["spearman_rho"].median()
        n_positive = int((median_rho_by_cancer > 0).sum())
        n_negative = int((median_rho_by_cancer < 0).sum())
        dominant_count = max(n_positive, n_negative)
        direction_consistency = (
            dominant_count / len(median_rho_by_cancer)
            if len(median_rho_by_cancer) > 0
            else 0.0
        )
        direction_consistent = direction_consistency >= DIRECTION_CONSISTENCY_THRESHOLD

        # Total significant correlations
        n_sig_total = int(group["is_significant"].sum())

        tier = _classify_tier(n_sig_types, direction_consistent)

        records.append(
            {
                "feature": feature,
                "correlation_n_cancer_types_tested": n_cancer_types,
                "correlation_n_types_with_sig": n_sig_types,
                "correlation_n_sig_total": n_sig_total,
                "correlation_direction_consistency": direction_consistency,
                "correlation_direction_consistent": direction_consistent,
                "correlation_tier": tier,
                "correlation_tier_label": _tier_label(tier),
            }
        )

    return pd.DataFrame(records)


def main() -> None:
    """Compute feature reliability tiers and save to parquet."""
    ensure_dirs()

    logger.info("=" * 60)
    logger.info("FEATURE RELIABILITY TIER CLASSIFICATION")
    logger.info("=" * 60)

    # Load survival associations
    logger.info("Loading survival associations...")
    surv_df = pd.read_parquet(SURVIVAL_ASSOCIATIONS)
    logger.info("  Loaded %d survival associations", len(surv_df))

    # Load feature correlations
    logger.info("Loading feature correlations...")
    corr_df = pd.read_parquet(FEATURE_CORRELATIONS)
    logger.info("  Loaded %d feature correlations", len(corr_df))

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_types = sorted(surv_df["cancer_type"].unique())[: dry_run.n_cancer_types]
        surv_df = surv_df[surv_df["cancer_type"].isin(cancer_types)]
        corr_df = corr_df[corr_df["cancer_type"].isin(cancer_types)]
        logger.info("  [DRY-RUN] Subset to %d cancer types", len(cancer_types))

    # Compute survival reliability
    logger.info("Computing survival reliability tiers...")
    surv_reliability = compute_survival_reliability(surv_df)
    logger.info("  %d features assessed", len(surv_reliability))

    # Compute correlation reliability
    logger.info("Computing correlation reliability tiers...")
    corr_reliability = compute_correlation_reliability(corr_df)
    logger.info("  %d features assessed", len(corr_reliability))

    # Merge on feature name
    result_df = surv_reliability.merge(corr_reliability, on="feature", how="outer")

    # Compute overall tier (worst of survival and correlation tiers)
    result_df["overall_tier"] = result_df[
        ["survival_tier", "correlation_tier"]
    ].max(axis=1)
    result_df["overall_tier"] = result_df["overall_tier"].fillna(4).astype(int)
    result_df["overall_tier_label"] = result_df["overall_tier"].apply(_tier_label)

    # Sort by overall tier, then survival significance
    result_df = result_df.sort_values(
        ["overall_tier", "survival_n_significant"],
        ascending=[True, False],
    ).reset_index(drop=True)

    # Save
    result_df.to_parquet(FEATURE_RELIABILITY_TIERS, index=False)
    logger.info("Saved %s (%d rows)", FEATURE_RELIABILITY_TIERS.name, len(result_df))

    # Print tier distribution
    logger.info("")
    logger.info("Tier distribution:")
    for tier in [1, 2, 3, 4]:
        label = _tier_label(tier)
        n = int((result_df["overall_tier"] == tier).sum())
        logger.info("  Tier %d (%s): %d features", tier, label, n)

    # Show Tier 1 features
    tier1 = result_df[result_df["overall_tier"] == 1]
    if not tier1.empty:
        logger.info("")
        logger.info("Tier 1 (Robust) features:")
        for _, row in tier1.iterrows():
            logger.info(
                "  %s: surv_sig=%d types, corr_sig=%d types",
                row["feature"],
                row.get("survival_n_significant", 0),
                row.get("correlation_n_types_with_sig", 0),
            )


if __name__ == "__main__":
    main()
