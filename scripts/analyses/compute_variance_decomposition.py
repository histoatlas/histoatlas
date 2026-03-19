"""
Cancer-type vs. within-cancer variance decomposition for histomic features.

For each feature, computes one-way ANOVA R-squared (fraction of variance
explained by cancer type), eta-squared, and the F-test p-value. Features
are ranked by R-squared to identify which features are cancer-type proxies
versus within-type discriminators.

Output:
- supplementary/variance_decomposition.parquet
"""

import logging

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    SLIDE_HISTOMICS,
    VARIANCE_DECOMPOSITION,
    ensure_dirs,
)
from scipy.stats import f_oneway

from histoatlas import get_histomic_features

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def compute_variance_decomposition_for_feature(
    df: pd.DataFrame, feature: str
) -> dict | None:
    """Compute one-way ANOVA variance decomposition for a single feature.

    Args:
        df: Slide-level dataframe with cancer_type and the feature column.
        feature: Name of the histomic feature.

    Returns:
        Dict with variance decomposition metrics, or None if insufficient data.
    """
    valid = df[["cancer_type", feature]].dropna()
    if len(valid) < 10:
        return None

    groups = [g[feature].to_numpy() for _, g in valid.groupby("cancer_type") if len(g) >= 2]
    if len(groups) < 2:
        return None

    grand_mean = valid[feature].mean()
    n_total = len(valid)

    # SS_between = sum of n_j * (mean_j - grand_mean)^2
    ss_between = sum(
        len(g) * (np.mean(g) - grand_mean) ** 2 for g in groups
    )

    # SS_total = sum of (x_i - grand_mean)^2
    ss_total = np.sum((valid[feature].to_numpy() - grand_mean) ** 2)

    if ss_total == 0:
        return None

    r_squared = ss_between / ss_total

    # SS_within
    ss_within = ss_total - ss_between
    k = len(groups)
    df_between = k - 1
    df_within = n_total - k

    # Eta-squared (same as R^2 for one-way ANOVA)
    eta_squared = ss_between / ss_total

    # Omega-squared (less biased estimator)
    ms_within = ss_within / df_within if df_within > 0 else 0
    omega_squared = (ss_between - df_between * ms_within) / (ss_total + ms_within)
    omega_squared = max(0.0, omega_squared)

    # F-test p-value
    try:
        f_stat, p_value = f_oneway(*groups)
    except Exception:
        f_stat, p_value = np.nan, np.nan

    return {
        "feature": feature,
        "r_squared": float(r_squared),
        "eta_squared": float(eta_squared),
        "omega_squared": float(omega_squared),
        "ss_between": float(ss_between),
        "ss_within": float(ss_within),
        "ss_total": float(ss_total),
        "f_statistic": float(f_stat) if not np.isnan(f_stat) else None,
        "p_value": float(p_value) if not np.isnan(p_value) else None,
        "n_samples": n_total,
        "n_cancer_types": k,
    }


def main() -> None:
    """Compute variance decomposition for all features and save to parquet."""
    ensure_dirs()

    logger.info("=" * 60)
    logger.info("CANCER-TYPE VARIANCE DECOMPOSITION")
    logger.info("=" * 60)

    # Load data
    logger.info("Loading slide histomics...")
    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    logger.info("  Loaded %d slides across %d cancer types", len(slides_df), slides_df["cancer_type"].nunique())

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_types = sorted(slides_df["cancer_type"].unique())[: dry_run.n_cancer_types]
        slides_df = slides_df[slides_df["cancer_type"].isin(cancer_types)]
        logger.info("  [DRY-RUN] Subset to %d cancer types, %d slides", len(cancer_types), len(slides_df))

    # Get histomic features
    features = get_histomic_features(slides_df)
    if dry_run:
        features = features[: dry_run.n_features]
    logger.info("  Features: %d", len(features))

    # Compute variance decomposition
    logger.info("Computing variance decomposition...")
    records = []
    for feat in features:
        result = compute_variance_decomposition_for_feature(slides_df, feat)
        if result is not None:
            records.append(result)

    result_df = pd.DataFrame(records)

    # Rank by R-squared (descending)
    result_df = result_df.sort_values("r_squared", ascending=False).reset_index(drop=True)
    result_df["rank"] = range(1, len(result_df) + 1)

    # Save
    result_df.to_parquet(VARIANCE_DECOMPOSITION, index=False)
    logger.info("Saved %s (%d rows)", VARIANCE_DECOMPOSITION.name, len(result_df))

    # Summary
    logger.info("")
    logger.info("Top 5 features by cancer-type R-squared (cancer-type proxies):")
    for _, row in result_df.head(5).iterrows():
        logger.info(
            "  %s: R²=%.3f, eta²=%.3f, p=%s",
            row["feature"],
            row["r_squared"],
            row["eta_squared"],
            f"{row['p_value']:.2e}" if row["p_value"] is not None else "N/A",
        )

    logger.info("")
    logger.info("Bottom 5 features (within-type discriminators):")
    for _, row in result_df.tail(5).iterrows():
        logger.info(
            "  %s: R²=%.3f, eta²=%.3f",
            row["feature"],
            row["r_squared"],
            row["eta_squared"],
        )

    median_r2 = result_df["r_squared"].median()
    logger.info("")
    logger.info("Median R² across features: %.3f", median_r2)
    logger.info(
        "Features with R² > 0.5 (mostly cancer-type signal): %d/%d",
        (result_df["r_squared"] > 0.5).sum(),
        len(result_df),
    )


if __name__ == "__main__":
    main()
