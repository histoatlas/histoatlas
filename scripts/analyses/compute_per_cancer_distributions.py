"""
Compute per-cancer-type feature distributions for all histomic features.

For each of the 38 features and each cancer type, computes summary statistics:
mean, median, std, Q1, Q3, min, max, skewness, kurtosis.

Output:
- supplementary/per_cancer_feature_distributions.parquet
"""

import logging

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    PER_CANCER_FEATURE_DISTRIBUTIONS,
    SLIDE_HISTOMICS,
    ensure_dirs,
)
from scipy.stats import kurtosis, skew

from histoatlas import get_histomic_features

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def compute_distributions(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    """Compute summary statistics per cancer type and feature.

    Args:
        df: Slide-level dataframe with cancer_type and histomic features.
        features: List of histomic feature column names.

    Returns:
        DataFrame with one row per (cancer_type, feature) combination.
    """
    records: list[dict] = []

    for cancer_type, group in df.groupby("cancer_type"):
        for feat in features:
            values = group[feat].dropna()
            if len(values) < 2:
                continue
            arr = values.to_numpy()
            records.append(
                {
                    "cancer_type": cancer_type,
                    "feature": feat,
                    "n_samples": len(values),
                    "n_missing": int(group[feat].isna().sum()),
                    "mean": float(np.mean(arr)),
                    "median": float(np.median(arr)),
                    "std": float(np.std(arr, ddof=1)),
                    "q1": float(np.percentile(arr, 25)),
                    "q3": float(np.percentile(arr, 75)),
                    "min": float(np.min(arr)),
                    "max": float(np.max(arr)),
                    "skewness": float(skew(arr, nan_policy="omit")),
                    "kurtosis": float(kurtosis(arr, nan_policy="omit")),
                    "iqr": float(np.percentile(arr, 75) - np.percentile(arr, 25)),
                }
            )

    return pd.DataFrame(records)


def main() -> None:
    """Compute per-cancer feature distributions and save to parquet."""
    ensure_dirs()

    logger.info("=" * 60)
    logger.info("PER-CANCER FEATURE DISTRIBUTIONS")
    logger.info("=" * 60)

    # Load data
    logger.info("Loading slide histomics...")
    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    logger.info(
        "  Loaded %d slides across %d cancer types",
        len(slides_df),
        slides_df["cancer_type"].nunique(),
    )

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_types = sorted(slides_df["cancer_type"].unique())[: dry_run.n_cancer_types]
        slides_df = slides_df[slides_df["cancer_type"].isin(cancer_types)]
        logger.info(
            "  [DRY-RUN] Subset to %d cancer types, %d slides", len(cancer_types), len(slides_df)
        )

    # Get histomic features
    features = get_histomic_features(slides_df)
    if dry_run:
        features = features[: dry_run.n_features]
    logger.info("  Features: %d", len(features))

    # Compute distributions
    logger.info("Computing summary statistics...")
    result_df = compute_distributions(slides_df, features)
    logger.info("  Computed %d (cancer_type, feature) combinations", len(result_df))

    # Save
    result_df.to_parquet(PER_CANCER_FEATURE_DISTRIBUTIONS, index=False)
    logger.info("Saved %s (%d rows)", PER_CANCER_FEATURE_DISTRIBUTIONS.name, len(result_df))

    # Summary
    logger.info("")
    logger.info("Cancer types: %d", result_df["cancer_type"].nunique())
    logger.info("Features: %d", result_df["feature"].nunique())
    logger.info(
        "Most skewed feature: %s (skewness=%.2f)",
        result_df.loc[result_df["skewness"].abs().idxmax(), "feature"],
        result_df["skewness"].abs().max(),
    )


if __name__ == "__main__":
    main()
