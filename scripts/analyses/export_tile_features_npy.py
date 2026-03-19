#!/usr/bin/env python3
"""
Export Tile Features as NPY to S3.

For each slide in tile_level_features.parquet, creates a features.npy file
of shape (n_tiles, 4) with columns [tile_level, x, y, random_number].

Files are organized by cohort and uploaded to S3:
    s3://tcga-wsi-slides/features/TCGA_<COHORT>/<slide_name>/features.npy

In dry-run mode, files are saved locally instead of uploading.
"""

import logging
import subprocess
import tempfile
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from _config import get_dry_run_settings
from _paths import DATA_DIR
from tqdm.auto import tqdm

# Suppress FutureWarnings from pyarrow/pandas type inference
warnings.filterwarnings("ignore", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Configuration for tile feature NPY export."""

    s3_bucket: str = "s3://tcga-wsi-slides/features"
    random_seed: int = 42
    dtype: type = np.float32

    @property
    def tiles_path(self) -> Path:
        from _paths import TILE_LEVEL_FEATURES_INPUT

        return TILE_LEVEL_FEATURES_INPUT


def get_cancer_types(config: Config) -> list[str]:
    """Read unique cancer types from the parquet file.

    Uses column projection to avoid loading the full dataset.

    Returns:
        Sorted list of unique cancer type strings.
    """
    table = pq.read_table(config.tiles_path, columns=["cancer_type"])
    cancer_types = sorted(table.column("cancer_type").to_pandas().unique().tolist())

    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_types = cancer_types[: dry_run.n_cancer_types]
        logger.info("   [DRY-RUN] Subset to %d cancer types", len(cancer_types))

    return cancer_types


def parse_tile_ids(tile_id_series: pd.Series) -> np.ndarray:
    """Parse tile_id strings into numeric coordinates.

    Tile IDs are formatted as '{level}__{x}__{y}__{width}__{height}'.
    Extracts [level, x, y] as a float32 array.

    Args:
        tile_id_series: Series of tile_id strings.

    Returns:
        Array of shape (n_tiles, 3) with columns [level, x, y].
    """
    parts = tile_id_series.str.split("__", expand=True)
    coords = parts.iloc[:, :3].astype(np.float32).values
    return coords


def process_cohort(
    cancer_type: str,
    config: Config,
    tmp_dir: Path,
    rng: np.random.Generator,
) -> int:
    """Process all slides for a single cancer type cohort.

    Reads tile data with PyArrow filter pushdown, parses tile coordinates,
    adds a random column, and saves per-slide .npy files.

    Args:
        cancer_type: The cancer type to process.
        config: Configuration object.
        tmp_dir: Temporary directory for saving .npy files.
        rng: NumPy random generator for reproducible random column.

    Returns:
        Number of slides processed.
    """
    table = pq.read_table(
        config.tiles_path,
        columns=["slide_name", "tile_id"],
        filters=[("cancer_type", "=", cancer_type)],
    )
    df = table.to_pandas()

    slide_count = 0
    for slide_name, slide_tiles in df.groupby("slide_name"):
        coords = parse_tile_ids(slide_tiles["tile_id"])
        n_tiles = len(coords)
        random_col = rng.random(n_tiles, dtype=config.dtype)

        features = np.column_stack([coords, random_col])

        slide_dir = tmp_dir / slide_name
        slide_dir.mkdir(parents=True, exist_ok=True)
        np.save(slide_dir / "features.npy", features)

        slide_count += 1

    return slide_count


def upload_cohort(cancer_type: str, tmp_dir: Path, config: Config) -> bool:
    """Upload cohort .npy files to S3 using aws s3 sync.

    Args:
        cancer_type: The cancer type (used to build S3 prefix).
        tmp_dir: Local directory containing slide subdirectories.
        config: Configuration object.

    Returns:
        True if upload succeeded, False otherwise.
    """
    s3_dest = f"{config.s3_bucket}/TCGA_{cancer_type}/"
    try:
        result = subprocess.run(
            ["aws", "s3", "sync", str(tmp_dir), s3_dest, "--quiet"],
            check=True,
            capture_output=True,
            text=True,
        )
        return True
    except subprocess.CalledProcessError as e:
        logger.error("   Failed to upload %s: %s", cancer_type, e.stderr.strip())
        return False


def main(config: Config) -> None:
    """Run the tile feature NPY export pipeline."""
    logger.info("=" * 60)
    logger.info("EXPORT TILE FEATURES AS NPY")
    logger.info("=" * 60)

    dry_run = get_dry_run_settings()

    logger.info("\n1. Discovering cancer types...")
    cancer_types = get_cancer_types(config)
    logger.info("   Found %d cancer types", len(cancer_types))

    rng = np.random.default_rng(seed=config.random_seed)

    total_slides = 0
    failed_cohorts: list[str] = []

    logger.info("\n2. Processing cohorts...")
    for cancer_type in tqdm(cancer_types, desc="Cohorts"):
        if dry_run:
            # Save locally instead of uploading
            local_dir = DATA_DIR / "tile_features_npy" / f"TCGA_{cancer_type}"
            local_dir.mkdir(parents=True, exist_ok=True)
            slide_count = process_cohort(cancer_type, config, local_dir, rng)
            total_slides += slide_count
            logger.info("   %s: %d slides (saved locally)", cancer_type, slide_count)
        else:
            with tempfile.TemporaryDirectory() as tmp:
                tmp_dir = Path(tmp)
                slide_count = process_cohort(cancer_type, config, tmp_dir, rng)
                total_slides += slide_count
                logger.info("   %s: %d slides", cancer_type, slide_count)

                success = upload_cohort(cancer_type, tmp_dir, config)
                if not success:
                    failed_cohorts.append(cancer_type)

    logger.info("\n" + "=" * 60)
    logger.info("EXPORT COMPLETE")
    logger.info("=" * 60)

    logger.info("\nSummary:")
    logger.info("   Cancer types processed: %d", len(cancer_types))
    logger.info("   Total slides: %d", total_slides)
    if dry_run:
        logger.info("   Mode: dry-run (saved locally)")
    else:
        logger.info("   Destination: %s", config.s3_bucket)

    if failed_cohorts:
        logger.error("   Failed cohorts (%d): %s", len(failed_cohorts), ", ".join(failed_cohorts))


if __name__ == "__main__":
    config = Config()
    main(config)
