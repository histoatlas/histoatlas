#!/usr/bin/env python3
"""
Compute Representative Tiles for HistoAtlas.

Consolidates per-slide JSON files produced by histotyper's
``save_representative_tiles()`` into a single parquet table.

Each JSON contains top-K tiles per feature, already scored and sorted.
This script simply reads them, assigns 1-based ranks, and writes the
unified ``slide_top_tiles.parquet``.

Output schema:
    slide_id, feature_name, rank, tile_x, tile_y, tile_level, score, percentile
"""

import json
import logging
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings

# Suppress FutureWarnings from pandas type inference
warnings.filterwarnings("ignore", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Configuration for representative tile computation."""

    k_tiles: int = 5  # tiles per feature per slide

    @property
    def representative_tiles_dir(self) -> Path:
        from _paths import REPRESENTATIVE_TILES_DIR

        return REPRESENTATIVE_TILES_DIR

    @property
    def slides_path(self) -> Path:
        from _paths import SLIDE_HISTOMICS

        return SLIDE_HISTOMICS

    @property
    def centroids_path(self) -> Path:
        from _paths import L1_CLUSTER_CENTROIDS_UMAP

        return L1_CLUSTER_CENTROIDS_UMAP

    @property
    def output_slide_tiles_path(self) -> Path:
        from _paths import SLIDE_TOP_TILES

        return SLIDE_TOP_TILES

    @property
    def output_prototypes_path(self) -> Path:
        from _paths import CLUSTER_PROTOTYPE_TILES

        return CLUSTER_PROTOTYPE_TILES


def load_representative_tiles(config: Config) -> pd.DataFrame:
    """Load per-slide JSON files and consolidate into a DataFrame.

    Each JSON file maps feature names to a list of tile dicts
    (tile_grid_x, tile_grid_y, tile_level, score, percentile),
    already sorted by score descending.

    Args:
        config: Configuration object.

    Returns:
        DataFrame with columns:
            slide_id, feature_name, rank, tile_x, tile_y,
            tile_level, score, percentile
    """
    tiles_dir = config.representative_tiles_dir
    json_files = sorted(tiles_dir.glob("*.json"))
    logger.info("   Found %d slide JSON files in %s", len(json_files), tiles_dir)

    dry_run = get_dry_run_settings()
    if dry_run and len(json_files) > dry_run.max_samples:
        json_files = json_files[: dry_run.max_samples]
        logger.info("   [DRY-RUN] Subset to %d JSON files", len(json_files))

    records: list[dict] = []
    for json_path in json_files:
        slide_id = json_path.stem  # e.g. TCGA-XX-XXXX

        with open(json_path) as f:
            data = json.load(f)

        for feature_name, tile_list in data.items():
            for rank_idx, tile in enumerate(tile_list[: config.k_tiles]):
                records.append(
                    {
                        "slide_id": slide_id,
                        "feature_name": feature_name,
                        "rank": rank_idx + 1,
                        "tile_x": tile["tile_grid_x"],
                        "tile_y": tile["tile_grid_y"],
                        "tile_level": tile["tile_level"],
                        "score": tile["score"],
                        "percentile": tile["percentile"],
                    }
                )

    df = pd.DataFrame(records)
    logger.info("   Consolidated %d tile records from %d slides", len(df), len(json_files))
    return df


def compute_cluster_prototype_tiles(
    repr_tiles_df: pd.DataFrame,
    slides_df: pd.DataFrame,
    centroids_df: pd.DataFrame,
    k: int,
) -> pd.DataFrame:
    """Compute prototype tiles for each cluster.

    For each L1 cluster, find the slide closest to the centroid and select
    its top-k tiles ranked by total score across all features.

    Args:
        repr_tiles_df: Consolidated representative tiles DataFrame.
        slides_df: DataFrame with slide embeddings and cluster assignments.
        centroids_df: DataFrame with cluster centroids.
        k: Number of prototype tiles per cluster.

    Returns:
        DataFrame with cluster prototype tile records.
    """
    results: list[dict] = []

    for _, centroid in centroids_df.iterrows():
        cluster_id = centroid["cluster_id"]
        cx, cy = centroid["umap_1"], centroid["umap_2"]

        cluster_slides = slides_df[slides_df["cluster_l1"] == cluster_id]
        if len(cluster_slides) == 0:
            continue

        distances = np.sqrt(
            (cluster_slides["umap_1"] - cx) ** 2 + (cluster_slides["umap_2"] - cy) ** 2
        )
        closest_idx = distances.idxmin()
        closest_slide = slides_df.loc[closest_idx, "slide_name"]

        # Get tiles for this slide, aggregate score across features per tile location
        slide_tiles = repr_tiles_df[repr_tiles_df["slide_id"] == closest_slide]
        if slide_tiles.empty:
            continue

        # Sum scores per unique tile location
        tile_scores = (
            slide_tiles.groupby(["tile_x", "tile_y", "tile_level"])
            .agg(total_score=("score", "sum"))
            .reset_index()
            .sort_values("total_score", ascending=False)
            .head(k)
        )

        for rank_idx, (_, row) in enumerate(tile_scores.iterrows()):
            results.append(
                {
                    "cluster_id": int(cluster_id),
                    "cluster_level": "L1",
                    "prototype_slide": closest_slide,
                    "rank": rank_idx + 1,
                    "tile_x": int(row["tile_x"]),
                    "tile_y": int(row["tile_y"]),
                    "tile_level": int(row["tile_level"]),
                    "total_score": float(row["total_score"]),
                }
            )

    return pd.DataFrame(results)


def save_results(
    repr_tiles_df: pd.DataFrame,
    prototypes_df: pd.DataFrame | None,
    config: Config,
) -> None:
    """Save results to parquet files.

    Args:
        repr_tiles_df: DataFrame with slide representative tiles.
        prototypes_df: DataFrame with cluster prototype tiles (or None).
        config: Configuration object.
    """
    from _paths import CLUSTER_ANALYSES_DIR, PRECOMPUTED_STATS_DIR, ensure_dirs

    ensure_dirs()
    PRECOMPUTED_STATS_DIR.mkdir(parents=True, exist_ok=True)
    CLUSTER_ANALYSES_DIR.mkdir(parents=True, exist_ok=True)

    repr_tiles_df.to_parquet(config.output_slide_tiles_path, index=False)
    logger.info("   Saved %s (%d rows)", config.output_slide_tiles_path.name, len(repr_tiles_df))

    if prototypes_df is not None:
        prototypes_df.to_parquet(config.output_prototypes_path, index=False)
        logger.info("   Saved %s (%d rows)", config.output_prototypes_path.name, len(prototypes_df))
    else:
        # Write empty file so Snakemake output contract is satisfied
        pd.DataFrame().to_parquet(config.output_prototypes_path, index=False)
        logger.info("   Saved %s (empty)", config.output_prototypes_path.name)


def main(config: Config) -> None:
    """Run the representative tile consolidation pipeline.

    Args:
        config: Configuration object.
    """
    logger.info("=" * 60)
    logger.info("COMPUTING REPRESENTATIVE TILES")
    logger.info("=" * 60)

    logger.info("\n1. Loading representative tile JSONs...")
    repr_tiles_df = load_representative_tiles(config)

    logger.info("\n2. Computing cluster prototype tiles...")
    prototypes_df: pd.DataFrame | None = None

    from _config import include_pancan

    if not include_pancan():
        logger.info("   L1 prototype tiles skipped (include_pancan=false)")
    elif config.centroids_path.exists():
        slides_df = pd.read_parquet(config.slides_path)
        logger.info("   Loaded %d slides with embeddings", len(slides_df))
        centroids_df = pd.read_parquet(config.centroids_path)
        logger.info("   Loaded %d cluster centroids", len(centroids_df))
        prototypes_df = compute_cluster_prototype_tiles(
            repr_tiles_df, slides_df, centroids_df, k=config.k_tiles
        )
        logger.info("   Generated %d cluster prototype tiles", len(prototypes_df))
    else:
        logger.info("   Cluster centroids not found, skipping prototype tiles")

    logger.info("\n3. Saving results...")
    save_results(repr_tiles_df, prototypes_df, config)

    logger.info("\n" + "=" * 60)
    logger.info("REPRESENTATIVE TILES COMPLETE")
    logger.info("=" * 60)

    n_slides = repr_tiles_df["slide_id"].nunique() if len(repr_tiles_df) > 0 else 0
    n_features = repr_tiles_df["feature_name"].nunique() if len(repr_tiles_df) > 0 else 0
    logger.info("\nSummary:")
    logger.info("   Slides processed: %d", n_slides)
    logger.info("   Features: %d", n_features)
    logger.info("   Tiles per feature: %d", config.k_tiles)
    logger.info("   Total representative tile records: %d", len(repr_tiles_df))

    logger.info("\nOutput files:")
    logger.info("  - slide_top_tiles.parquet (per-slide representative tiles)")
    logger.info("  - cluster_prototype_tiles.parquet (cluster prototype tiles)")


if __name__ == "__main__":
    config = Config()
    main(config)
