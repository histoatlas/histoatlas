"""Flag slides with near-zero denominator artifacts in ratio features.

The histotyper pipeline computes ratio/tilt features as (x + EPSILON) / (y + EPSILON)
with EPSILON = 1e-6. When the denominator cell type is absent (count = 0) but the
gate passes because it checks the COMBINED count of multiple cell types, the ratio
can explode to absurd values (e.g., 1.11e8).

This script detects such artifacts using robust z-scoring within cancer types,
analogous to flag_tissue_cell_discordance.py.

Input:  data/slide_level_features.parquet
Output: data/ratio_artifacts.parquet

See docs/FAILURE_MODES.md §4 for details on the gate loophole.
"""

import logging

import numpy as np
import pandas as pd
from _paths import QC_DIR, SLIDE_LEVEL_FEATURES_INPUT, ensure_dirs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

INPUT_PATH = SLIDE_LEVEL_FEATURES_INPUT
OUTPUT_PATH = QC_DIR / "ratio_artifacts.parquet"

# Ratio features vulnerable to the gate loophole.
# Each entry: (feature_name, description of the denominator issue)
RATIO_FEATURES = [
    "eosinophil_neutrophil_ratio_peritumoral",
    "apoptosis_mitosis_ratio_tumor",
    "intratumoral_myeloid_lymphoid_tilt",
    "stromal_inflammatory_tilt",
    "lymphocyte_infiltration_ratio_front",
    "myeloid_infiltration_ratio_front",
    "peritumoral_fibroblast_enrichment",
]

# Z-score threshold for flagging (positive = high ratio = near-zero denominator)
ZSCORE_THRESHOLD = 3.0

# Extreme value threshold: beyond this, it's certainly a denominator artifact
EXTREME_THRESHOLD = 5.0  # 5x IQR above Q3


def robust_zscore_within_cancer_type(series: pd.Series, groups: pd.Series) -> pd.Series:
    """Compute robust z-scores (median + MAD) within each cancer type."""

    def _zscore(group: pd.Series) -> pd.Series:
        median = group.median()
        mad = (group - median).abs().median()
        mad_std = mad * 1.4826  # MAD-to-std for normal distribution
        if mad_std < 1e-10:
            return pd.Series(0.0, index=group.index)
        return (group - median) / mad_std

    return series.groupby(groups).transform(_zscore)


def main() -> None:
    ensure_dirs()
    df = pd.read_parquet(INPUT_PATH)
    logger.info(f"Loaded {len(df)} slides from {INPUT_PATH}")

    # Build result: one row per slide × feature combination that is flagged
    records = []

    for feat in RATIO_FEATURES:
        val_col = f"{feat}_value"
        status_col = f"{feat}_status"

        if val_col not in df.columns:
            logger.warning(f"Feature {feat} not found in data, skipping")
            continue

        mask_ok = df[status_col] == "OK"
        n_ok = mask_ok.sum()
        if n_ok == 0:
            logger.info(f"{feat}: no OK values, skipping")
            continue

        vals = df.loc[mask_ok, val_col]

        # Log-transform for z-scoring (ratios are right-skewed)
        log_vals = np.log10(vals.clip(lower=1e-10))
        log_series = pd.Series(np.nan, index=df.index)
        log_series.loc[mask_ok] = log_vals.values

        # Robust z-score within cancer type
        zscores = robust_zscore_within_cancer_type(log_series, df["cancer_type"])

        # IQR-based extreme detection (global, not per cancer type)
        q1, q3 = vals.quantile(0.25), vals.quantile(0.75)
        iqr = q3 - q1
        extreme_upper = q3 + EXTREME_THRESHOLD * iqr

        # Flag slides
        is_flagged = mask_ok & ((zscores > ZSCORE_THRESHOLD) | (vals > extreme_upper))
        n_flagged = is_flagged.sum()

        logger.info(
            f"{feat}: {n_ok} OK, {n_flagged} flagged"
            f" (z>{ZSCORE_THRESHOLD} or value>{extreme_upper:.4g})"
        )

        for idx in df.index[is_flagged]:
            records.append(
                {
                    "slide_name": df.loc[idx, "slide_name"],
                    "cancer_type": df.loc[idx, "cancer_type"],
                    "feature": feat,
                    "value": df.loc[idx, val_col],
                    "log_value": log_series.loc[idx],
                    "zscore": zscores.loc[idx],
                    "extreme_upper_threshold": extreme_upper,
                    "is_extreme": df.loc[idx, val_col] > extreme_upper,
                }
            )

    result = pd.DataFrame(records)

    if len(result) == 0:
        logger.info("No ratio artifacts detected")
        result.to_parquet(OUTPUT_PATH, index=False)
        return

    # Summary
    logger.info(f"\nTotal flagged: {len(result)} slide×feature pairs")
    logger.info(f"Unique slides: {result['slide_name'].nunique()}")

    # Per-feature breakdown
    logger.info("\nPer-feature breakdown:")
    for feat, grp in result.groupby("feature"):
        n_extreme = grp["is_extreme"].sum()
        logger.info(
            f"  {feat}: {len(grp)} flagged, {n_extreme} extreme"
            f" (max value={grp['value'].max():.4g})"
        )

    # Top 20 most extreme across all features
    logger.info("\nTop 20 most extreme values:")
    top = result.nlargest(20, "value")
    for _, row in top.iterrows():
        logger.info(
            f"  {row['feature']:45s} {row['cancer_type']:6s}"
            f"  value={row['value']:12.4g}  z={row['zscore']:+6.1f}"
            f"  {row['slide_name'][:50]}"
        )

    # Slides flagged across multiple features
    multi = result.groupby("slide_name").agg(
        n_features=("feature", "nunique"),
        features=("feature", lambda x: ", ".join(sorted(x))),
        cancer_type=("cancer_type", "first"),
    )
    multi = multi[multi["n_features"] > 1].sort_values("n_features", ascending=False)
    if len(multi) > 0:
        logger.info(f"\nSlides flagged across multiple features ({len(multi)}):")
        for slide, row in multi.head(20).iterrows():
            logger.info(f"  {row['cancer_type']:6s} {row['n_features']} features  {slide[:50]}")

    result.to_parquet(OUTPUT_PATH, index=False)
    logger.info(f"\nSaved {len(result)} records to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
