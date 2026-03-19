#!/usr/bin/env python3
"""
Compute QC Flags for HistoAtlas Slides.

This script adds quality control flags to the slide-level data to identify
potentially unreliable slides.

QC flags computed:
- tile_extraction_coverage_ok: Adequate tile coverage
- extreme_feature_outlier: Extreme values in multiple features
- high_missingness: High proportion of missing feature values
- qc_pass: Composite pass flag
"""

import json
import logging
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from _config import get_dry_run_settings

from histoatlas._utils import get_histomic_features
from histoatlas.qc import add_qc_flags_to_slides

# Suppress FutureWarnings from pandas type inference
warnings.filterwarnings("ignore", category=FutureWarning)

logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Configuration for QC flag computation."""

    min_tiles: int = 10
    z_threshold: float = 5.0
    max_outlier_features: int = 5
    max_missing_pct: float = 0.2

    @property
    def slides_path(self) -> Path:
        from _paths import SLIDE_HISTOMICS

        return SLIDE_HISTOMICS

    @property
    def tiles_path(self) -> Path:
        from _paths import TILE_LEVEL_FEATURES_INPUT

        return TILE_LEVEL_FEATURES_INPUT

    @property
    def qc_config_path(self) -> Path:
        from _paths import JSON_DIR

        return JSON_DIR / "qc_config.json"

    def to_qc_config_dict(self) -> dict[str, Any]:
        """Convert config to dict format expected by add_qc_flags_to_slides."""
        return {
            "min_tiles": self.min_tiles,
            "z_threshold": self.z_threshold,
            "max_outlier_features": self.max_outlier_features,
            "max_missing_pct": self.max_missing_pct,
        }


def load_data(config: Config) -> tuple[pd.DataFrame, pd.DataFrame | None, list[str]]:
    """Load slides and tiles data.

    Args:
        config: Configuration object with data paths.

    Returns:
        Tuple of (slides_df, tiles_df or None, histomic_features list).
    """
    logger.info("Loading data...")

    slides_df = pd.read_parquet(config.slides_path)
    logger.info("   Loaded %d slides", len(slides_df))

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        # Subset to max_samples slides
        if len(slides_df) > dry_run.max_samples:
            slides_df = slides_df.sample(n=dry_run.max_samples, random_state=42)
            logger.info(f"   [DRY-RUN] Subset to {len(slides_df)} slides")

    histomic_features = get_histomic_features(slides_df)
    logger.info("   Histomic features: %d", len(histomic_features))

    tiles_df = None
    if config.tiles_path.exists():
        tiles_df = pd.read_parquet(config.tiles_path)
        logger.info("   Loaded %d tiles", len(tiles_df))

        # Filter tiles to match subsetted slides
        if dry_run:
            slide_names = set(slides_df["slide_name"])
            tiles_df = tiles_df[tiles_df["slide_name"].isin(slide_names)]
            logger.info(f"   [DRY-RUN] Filtered to {len(tiles_df)} tiles")
    else:
        logger.info("   Tile-level data not found, skipping tile coverage flags")

    return slides_df, tiles_df, histomic_features


def compute_qc_flags(
    slides_df: pd.DataFrame,
    tiles_df: pd.DataFrame | None,
    histomic_features: list[str],
    config: Config,
) -> pd.DataFrame:
    """Compute QC flags for slides.

    Args:
        slides_df: Slide-level features DataFrame.
        tiles_df: Tile-level features DataFrame (optional).
        histomic_features: List of histomic feature column names.
        config: Configuration object.

    Returns:
        DataFrame with QC flag columns added.
    """
    logger.info("Computing QC flags...")

    return add_qc_flags_to_slides(
        slides_df,
        tiles_df=tiles_df,
        feature_cols=histomic_features,
        config=config.to_qc_config_dict(),
    )


def _log_qc_summary(
    slides_with_qc: pd.DataFrame,
    tiles_df: pd.DataFrame | None,
    config: Config,
) -> dict[str, Any]:
    """Log QC summary statistics and return summary dict.

    Args:
        slides_with_qc: DataFrame with QC flags computed.
        tiles_df: Tile-level data (for tile stats).
        config: Configuration object.

    Returns:
        Summary dictionary for JSON export.
    """
    logger.info("QC Flag Summary:")

    # Tile coverage
    n_tile_ok = None
    if "tile_extraction_coverage_ok" in slides_with_qc.columns:
        n_tile_ok = int(slides_with_qc["tile_extraction_coverage_ok"].sum())
        n_tile_total = slides_with_qc["tile_extraction_coverage_ok"].notna().sum()
        if n_tile_total > 0:
            logger.info(
                "   Tile coverage OK: %d/%d (%.1f%%)",
                n_tile_ok,
                n_tile_total,
                n_tile_ok / n_tile_total * 100,
            )
            if tiles_df is not None:
                logger.info("   Min tiles per slide: %d", slides_with_qc["n_tiles"].min())
                logger.info("   Max tiles per slide: %d", slides_with_qc["n_tiles"].max())
                logger.info("   Median tiles per slide: %.0f", slides_with_qc["n_tiles"].median())

    # Extreme outliers
    n_outliers = int(slides_with_qc["extreme_feature_outlier"].sum())
    logger.info(
        "   Extreme outliers: %d (%.1f%%)",
        n_outliers,
        n_outliers / len(slides_with_qc) * 100,
    )

    # Missingness
    n_high_missing = int(slides_with_qc["high_missingness"].sum())
    logger.info(
        "   High missingness: %d (%.1f%%)",
        n_high_missing,
        n_high_missing / len(slides_with_qc) * 100,
    )

    # Overall QC pass
    n_pass = int(slides_with_qc["qc_pass"].sum())
    logger.info(
        "   Overall QC pass: %d/%d (%.1f%%)",
        n_pass,
        len(slides_with_qc),
        n_pass / len(slides_with_qc) * 100,
    )

    # Per-cancer QC pass rates
    logger.info("   QC pass rate by cancer type:")
    qc_by_cancer = (
        slides_with_qc.groupby("cancer_type")
        .agg({"qc_pass": ["sum", "count"]})
        .droplevel(0, axis=1)
    )
    qc_by_cancer["pass_rate"] = qc_by_cancer["sum"] / qc_by_cancer["count"]
    qc_by_cancer = qc_by_cancer.sort_values("pass_rate")

    for cancer_type in qc_by_cancer.head(5).index:
        row = qc_by_cancer.loc[cancer_type]
        logger.info(
            "      %s: %d/%d (%.1f%%)",
            cancer_type,
            int(row["sum"]),
            int(row["count"]),
            row["pass_rate"] * 100,
        )

    return {
        "config": config.to_qc_config_dict(),
        "total_slides": len(slides_with_qc),
        "qc_pass_count": n_pass,
        "qc_pass_rate": float(n_pass / len(slides_with_qc)),
        "flag_counts": {
            "tile_extraction_coverage_ok": n_tile_ok,
            "extreme_feature_outlier": n_outliers,
            "high_missingness": n_high_missing,
        },
        "unavailable_flags": [
            "qc_blur_suspect",
            "qc_pen_marks_suspect",
            "qc_min_tissue_area_pass",
        ],
        "notes": "Image-based QC flags (blur, pen marks, tissue area) require additional image analysis data",
    }


def save_results(
    slides_with_qc: pd.DataFrame,
    qc_summary: dict[str, Any],
    config: Config,
) -> None:
    """Save QC results to disk.

    Args:
        slides_with_qc: DataFrame with QC flags.
        qc_summary: Summary dictionary.
        config: Configuration object.
    """
    from _paths import JSON_DIR, ensure_dirs

    logger.info("Saving results...")

    ensure_dirs()
    JSON_DIR.mkdir(parents=True, exist_ok=True)

    slides_with_qc.to_parquet(config.slides_path, index=False)
    logger.info("   Updated %s", config.slides_path.name)

    with open(config.qc_config_path, "w") as f:
        json.dump(qc_summary, f, indent=2)
    logger.info("   Saved %s", config.qc_config_path)


def _log_completion_summary() -> None:
    """Log the final summary of QC columns added."""
    logger.info("QC columns added to slide data:")
    logger.info("  - n_tiles: Number of tiles extracted")
    logger.info("  - tile_extraction_coverage_ok: Adequate tile coverage (>= 10 tiles)")
    logger.info("  - n_outlier_features: Count of features with |z| > 5")
    logger.info("  - extreme_feature_outlier: More than 5 extreme outlier features")
    logger.info("  - n_missing_features: Count of missing feature values")
    logger.info("  - high_missingness: More than 20% missing features")
    logger.info("  - qc_pass: Composite pass flag (all checks pass)")

    logger.info("Unavailable flags (require additional data):")
    logger.info("  - qc_blur_suspect: Requires image blur detection")
    logger.info("  - qc_pen_marks_suspect: Requires pen mark detection")
    logger.info("  - qc_min_tissue_area_pass: Requires tissue segmentation")


def main(config: Config) -> None:
    """Main entry point for QC flag computation.

    Args:
        config: Configuration object.
    """
    logger.info("=" * 60)
    logger.info("COMPUTING QC FLAGS")
    logger.info("=" * 60)

    # Load data
    slides_df, tiles_df, histomic_features = load_data(config)

    # Compute QC flags
    slides_with_qc = compute_qc_flags(slides_df, tiles_df, histomic_features, config)

    # Log summary and get summary dict
    qc_summary = _log_qc_summary(slides_with_qc, tiles_df, config)

    # Save results
    save_results(slides_with_qc, qc_summary, config)

    # Final summary
    logger.info("=" * 60)
    logger.info("QC FLAGS COMPLETE")
    logger.info("=" * 60)
    _log_completion_summary()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main(Config())
