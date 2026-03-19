#!/usr/bin/env python3
"""
Compute Similar Slides (KNN) for HistoAtlas.

This script computes the top 10 nearest neighbors per slide in the
n-dimensional histomic feature space.

Output: similar_slides.parquet with fields:
- slide_id: VARCHAR (source slide)
- neighbor_rank: INTEGER (1-10)
- neighbor_slide_id: VARCHAR (neighbor slide)
- distance: FLOAT (Euclidean distance in histomic space)
- same_cancer_type: BOOLEAN (whether neighbor is same cancer type)
"""

import logging
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings

from histoatlas import (
    compute_cancer_specific_knn,
    compute_knn_batch,
    get_histomic_features,
)

# Suppress FutureWarnings from sklearn and RuntimeWarnings from distance computation
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")

logger = logging.getLogger(__name__)


def _get_n_jobs() -> int:
    """Get n_jobs from HISTOATLAS_N_JOBS env var."""
    import os

    return int(os.environ.get("HISTOATLAS_N_JOBS", "1"))


@dataclass
class Config:
    """Configuration for similar slides computation."""

    k_neighbors: int = 10

    def __post_init__(self) -> None:
        """Apply dry-run settings if active."""
        dry_run = get_dry_run_settings()
        if dry_run:
            object.__setattr__(self, "k_neighbors", dry_run.n_neighbors)

    @property
    def input_path(self) -> Path:
        from _paths import SLIDE_HISTOMICS

        return SLIDE_HISTOMICS

    @property
    def output_pan_cancer_path(self) -> Path:
        from _paths import SIMILAR_SLIDES

        return SIMILAR_SLIDES

    @property
    def output_cancer_specific_path(self) -> Path:
        from _paths import SIMILAR_SLIDES_CANCER_SPECIFIC

        return SIMILAR_SLIDES_CANCER_SPECIFIC


def _load_data(config: Config) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    """Load slides and extract feature matrix.

    Args:
        config: Configuration object.

    Returns:
        Tuple of (slides_df, features, slide_ids, cancer_types).
    """
    logger.info("\n1. Loading data...")

    slides_df = pd.read_parquet(config.input_path)
    logger.info("   Loaded %d slides", len(slides_df))

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        if len(slides_df) > dry_run.max_samples:
            slides_df = slides_df.sample(n=dry_run.max_samples, random_state=42)
            logger.info(f"   [DRY-RUN] Subset to {len(slides_df)} slides")

    histomic_features = get_histomic_features(slides_df)
    logger.info("   Histomic features: %d", len(histomic_features))

    features = slides_df[histomic_features].values.astype(np.float64)
    slide_ids = slides_df["slide_name"].values
    cancer_types = slides_df["cancer_type"].values

    logger.info("   Feature matrix shape: %s", features.shape)

    return slides_df, features, slide_ids, cancer_types


def _compute_neighbors(
    features: np.ndarray,
    slide_ids: np.ndarray,
    cancer_types: np.ndarray,
    config: Config,
) -> tuple[list, list]:
    """Compute pan-cancer and cancer-specific KNN.

    Args:
        features: Feature matrix.
        slide_ids: Array of slide IDs.
        cancer_types: Array of cancer types.
        config: Configuration object.

    Returns:
        Tuple of (pan_cancer_results, cancer_specific_results).
    """
    n_jobs = _get_n_jobs()
    logger.info("\n2. Computing pan-cancer KNN (n_jobs=%d)...", n_jobs)
    pan_cancer_results = compute_knn_batch(
        features, slide_ids, cancer_types, k=config.k_neighbors, batch_size=500, n_jobs=n_jobs
    )
    logger.info("   Computed %d neighbor relationships", len(pan_cancer_results))

    logger.info("\n3. Computing cancer-specific KNN (n_jobs=%d)...", n_jobs)
    cancer_specific_results = compute_cancer_specific_knn(
        features, slide_ids, cancer_types, k=config.k_neighbors, n_jobs=n_jobs
    )
    logger.info(
        "   Computed %d cancer-specific neighbor relationships", len(cancer_specific_results)
    )

    return pan_cancer_results, cancer_specific_results


def _save_results(
    pan_cancer_results: list,
    cancer_specific_results: list,
    config: Config,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Save KNN results to parquet files.

    Args:
        pan_cancer_results: Pan-cancer neighbor results.
        cancer_specific_results: Cancer-specific neighbor results.
        config: Configuration object.

    Returns:
        Tuple of (pan_cancer_df, cancer_specific_df).
    """
    from _paths import PRECOMPUTED_STATS_DIR, ensure_dirs

    logger.info("\n4. Saving results...")

    ensure_dirs()
    PRECOMPUTED_STATS_DIR.mkdir(parents=True, exist_ok=True)

    pan_cancer_df = pd.DataFrame([asdict(r) for r in pan_cancer_results])
    pan_cancer_df["neighbor_type"] = "pan_cancer"
    pan_cancer_df.to_parquet(config.output_pan_cancer_path, index=False)
    logger.info("   Saved %s (%d rows)", config.output_pan_cancer_path.name, len(pan_cancer_df))

    cancer_specific_df = pd.DataFrame([asdict(r) for r in cancer_specific_results])
    cancer_specific_df["neighbor_type"] = "cancer_specific"
    cancer_specific_df.to_parquet(config.output_cancer_specific_path, index=False)
    logger.info(
        "   Saved %s (%d rows)", config.output_cancer_specific_path.name, len(cancer_specific_df)
    )

    return pan_cancer_df, cancer_specific_df


def _log_summary(
    slides_df: pd.DataFrame,
    pan_cancer_df: pd.DataFrame,
    cancer_specific_df: pd.DataFrame,
    config: Config,
) -> None:
    """Log summary statistics.

    Args:
        slides_df: Original slides DataFrame.
        pan_cancer_df: Pan-cancer results DataFrame.
        cancer_specific_df: Cancer-specific results DataFrame.
        config: Configuration object.
    """
    logger.info("\nSummary:")
    logger.info("   Total slides: %d", len(slides_df))
    logger.info("   Neighbors per slide: %d", config.k_neighbors)
    logger.info("   Pan-cancer relationships: %d", len(pan_cancer_df))
    logger.info("   Cancer-specific relationships: %d", len(cancer_specific_df))

    logger.info("\nPan-cancer distance statistics:")
    logger.info("   Mean distance: %.3f", pan_cancer_df["distance"].mean())
    logger.info("   Median distance: %.3f", pan_cancer_df["distance"].median())
    logger.info("   Min distance: %.3f", pan_cancer_df["distance"].min())
    logger.info("   Max distance: %.3f", pan_cancer_df["distance"].max())

    logger.info("\nCancer-specific distance statistics:")
    logger.info("   Mean distance: %.3f", cancer_specific_df["distance"].mean())
    logger.info("   Median distance: %.3f", cancer_specific_df["distance"].median())

    same_cancer_prop = pan_cancer_df["same_cancer_type"].mean()
    logger.info("\nPan-cancer: %.1f%% of neighbors are same cancer type", same_cancer_prop * 100)

    logger.info("\nOutput files:")
    logger.info("  - similar_slides.parquet (pan-cancer KNN)")
    logger.info("  - similar_slides_cancer_specific.parquet (within-cancer KNN)")


def main(config: Config) -> None:
    """Main entry point for similar slides computation.

    Args:
        config: Configuration object.
    """
    logger.info("=" * 60)
    logger.info("COMPUTING SIMILAR SLIDES (KNN)")
    logger.info("=" * 60)

    # Load data
    slides_df, features, slide_ids, cancer_types = _load_data(config)

    # Compute neighbors
    pan_cancer_results, cancer_specific_results = _compute_neighbors(
        features, slide_ids, cancer_types, config
    )

    # Save results
    pan_cancer_df, cancer_specific_df = _save_results(
        pan_cancer_results, cancer_specific_results, config
    )

    # Summary statistics
    logger.info("\n" + "=" * 60)
    logger.info("SIMILAR SLIDES COMPUTATION COMPLETE")
    logger.info("=" * 60)

    _log_summary(slides_df, pan_cancer_df, cancer_specific_df, config)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main(Config())
