"""Flag slides with tissue–cell segmentation discordance.

Detects slides where the tissue segmentation model identifies substantial
tumor area but the cell segmentation model detects very few cancer cells.
This pattern indicates cancer cells are likely misclassified as healthy
epithelial cells or lymphocytes.

Detection approach:
    1. Compute the cancer cell density / tumor area fraction ratio per slide.
       A high tumor fraction with low cancer cell density = discordance.
    2. Z-score the ratio within each cancer type (since baseline ratios vary
       across cancer types — e.g., KIRC has naturally lower ratios due to
       clear cell histology).
    3. Flag slides below a z-score threshold as discordant.

Input:  data/slide_level_features.parquet
Output: data/tissue_cell_discordance.parquet
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
OUTPUT_PATH = QC_DIR / "tissue_cell_discordance.parquet"

# A slide needs at least this much tumor tissue to be assessable
MIN_TUMOR_AREA_FRACTION = 0.10

# Z-score threshold within cancer type for flagging (negative = low ratio)
ZSCORE_THRESHOLD = -2.0


def main() -> None:
    ensure_dirs()
    df = pd.read_parquet(INPUT_PATH)
    logger.info(f"Loaded {len(df)} slides from {INPUT_PATH}")

    # Require both features to have OK status
    mask_ok = (df["tumor_area_fraction_status"] == "OK") & (
        df["intratumoral_cancer_cell_density_status"] == "OK"
    )
    logger.info(f"Slides with both features OK: {mask_ok.sum()}")

    # Build result dataframe for ALL slides
    result = df[["slide_name", "cancer_type"]].copy()
    result["tumor_area_fraction"] = df["tumor_area_fraction_value"]
    result["intratumoral_cancer_cell_density"] = df["intratumoral_cancer_cell_density_value"]

    # Compute density-to-fraction ratio (cells/mm² per unit tumor fraction)
    # Use log scale for normality; add small constants to avoid log(0)
    result["density_fraction_ratio"] = np.where(
        mask_ok,
        result["intratumoral_cancer_cell_density"] / result["tumor_area_fraction"].clip(lower=1e-4),
        np.nan,
    )
    result["log_density_fraction_ratio"] = np.log10(result["density_fraction_ratio"].clip(lower=1))

    # Z-score within cancer type (robust: use median and MAD)
    def robust_zscore(group: pd.Series) -> pd.Series:
        median = group.median()
        mad = (group - median).abs().median()
        # MAD to std conversion factor for normal distribution
        mad_std = mad * 1.4826
        if mad_std < 1e-10:
            return pd.Series(0.0, index=group.index)
        return (group - median) / mad_std

    result["ratio_zscore"] = result.groupby("cancer_type")["log_density_fraction_ratio"].transform(
        robust_zscore
    )

    # Flag discordant slides
    result["assessable"] = mask_ok & (result["tumor_area_fraction"] >= MIN_TUMOR_AREA_FRACTION)
    result["is_discordant"] = result["assessable"] & (result["ratio_zscore"] < ZSCORE_THRESHOLD)

    # Add context: what cells ARE in the tumor region?
    for col in [
        "intratumoral_lymphocyte_density",
        "intratumoral_neutrophil_density",
        "intratumoral_eosinophil_density",
    ]:
        result[col] = df[f"{col}_value"]

    # Compute the fraction of intratumoral cells that are NOT cancer cells
    total_density = (
        result["intratumoral_cancer_cell_density"].fillna(0)
        + result["intratumoral_lymphocyte_density"].fillna(0)
        + result["intratumoral_neutrophil_density"].fillna(0)
        + result["intratumoral_eosinophil_density"].fillna(0)
    )
    result["non_cancer_cell_fraction_in_tumor"] = np.where(
        total_density > 0,
        1 - result["intratumoral_cancer_cell_density"].fillna(0) / total_density,
        np.nan,
    )

    # Summary stats
    n_assessable = result["assessable"].sum()
    n_discordant = result["is_discordant"].sum()
    logger.info(f"Assessable slides (tumor_frac >= {MIN_TUMOR_AREA_FRACTION}): {n_assessable}")
    logger.info(
        f"Discordant slides (z < {ZSCORE_THRESHOLD}): {n_discordant} ({n_discordant / n_assessable * 100:.1f}%)"
    )

    # Per cancer type breakdown
    disc_by_ct = (
        result[result["assessable"]]
        .groupby("cancer_type")
        .agg(
            n_slides=("assessable", "sum"),
            n_discordant=("is_discordant", "sum"),
        )
    )
    disc_by_ct["pct"] = (disc_by_ct["n_discordant"] / disc_by_ct["n_slides"] * 100).round(1)
    disc_by_ct = disc_by_ct.sort_values("pct", ascending=False)
    logger.info("Discordance rate by cancer type:")
    for ct, row in disc_by_ct.iterrows():
        if row["n_discordant"] > 0:
            logger.info(
                f"  {ct:6s}  {row['n_discordant']:3.0f} / {row['n_slides']:4.0f}  ({row['pct']:.1f}%)"
            )

    # Save
    result.to_parquet(OUTPUT_PATH, index=False)
    logger.info(f"Saved to {OUTPUT_PATH}")

    # Print the most extreme cases
    extreme = result[result["is_discordant"]].sort_values("ratio_zscore").head(20)
    logger.info("Top 20 most discordant slides:")
    for _, row in extreme.iterrows():
        logger.info(
            f"  z={row['ratio_zscore']:+5.1f}  {row['cancer_type']:6s}"
            f"  tumor_frac={row['tumor_area_fraction']:.3f}"
            f"  cancer_density={row['intratumoral_cancer_cell_density']:7.1f}"
            f"  non_cancer_frac={row['non_cancer_cell_fraction_in_tumor']:.3f}"
            f"  {row['slide_name'][:70]}"
        )


if __name__ == "__main__":
    main()
