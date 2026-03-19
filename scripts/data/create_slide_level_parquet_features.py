#!/usr/bin/env python3
"""
Create slide-level features parquet from per-slide CSV files.

Consolidates scattered ``<cohort>/<slidename>/slide_level_features.csv``
files into a single ``data/slide_level_features.parquet`` used as input
by all downstream analysis scripts.

Output columns: cancer_type, slide_name, <feature_1>, <feature_2>, ...
"""

import argparse
import logging
import sys
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Configuration for slide-level feature consolidation."""

    input_dir: Path
    output: Path | None = None

    @property
    def output_path(self) -> Path:
        if self.output is not None:
            return self.output
        # Lazy import to allow running from scripts/data/ with sys.path setup
        sys.path.insert(0, str(Path(__file__).parent.parent / "analyses"))
        from _paths import SLIDE_LEVEL_FEATURES_INPUT

        return SLIDE_LEVEL_FEATURES_INPUT


def _discover_csv_files(input_dir: Path) -> list[Path]:
    """Glob for slide-level feature CSVs.

    Expected structure: ``<input_dir>/<cohort>/<slide>/slide_level_features.csv``

    Args:
        input_dir: Root directory to search.

    Returns:
        Sorted list of discovered CSV paths.
    """
    csv_paths = sorted(input_dir.glob("*/*/slide_level_features.csv"))
    logger.info("Discovered %d slide_level_features.csv files in %s", len(csv_paths), input_dir)
    if not csv_paths:
        logger.error("No CSV files found — check the input directory structure")
        sys.exit(1)
    return csv_paths


def _read_and_tag(csv_path: Path) -> pd.DataFrame:
    """Read a single CSV and tag it with cancer_type and slide_name.

    Args:
        csv_path: Path to a ``slide_level_features.csv`` file.

    Returns:
        DataFrame with ``cancer_type`` and ``slide_name`` as first two columns.
    """
    df = pd.read_csv(csv_path)
    cancer_type = csv_path.parent.parent.name
    slide_name = csv_path.parent.name
    df.insert(0, "cancer_type", cancer_type)
    df.insert(1, "slide_name", slide_name)
    return df


def _concatenate_and_save(csv_paths: list[Path], output_path: Path) -> pd.DataFrame:
    """Read all CSVs, concatenate, and save as parquet.

    Args:
        csv_paths: List of CSV file paths.
        output_path: Destination parquet path.

    Returns:
        Concatenated DataFrame.
    """
    logger.info("Reading and concatenating %d files...", len(csv_paths))
    dfs = [_read_and_tag(p) for p in csv_paths]
    df = pd.concat(dfs, ignore_index=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False)
    logger.info("Saved %s (%d rows)", output_path, len(df))

    return df


def _log_summary(df: pd.DataFrame) -> None:
    """Log summary statistics of the consolidated DataFrame.

    Args:
        df: The concatenated slide-level features DataFrame.
    """
    feature_cols = [c for c in df.columns if c not in ("cancer_type", "slide_name")]
    logger.info("Shape: %s", df.shape)
    logger.info("Total slides: %d", len(df))
    logger.info(
        "Cancer types: %d (%s)",
        df["cancer_type"].nunique(),
        ", ".join(sorted(df["cancer_type"].unique())),
    )
    logger.info("Feature columns: %d", len(feature_cols))


def main(config: Config) -> None:
    """Main entry point.

    Args:
        config: Configuration object.
    """
    logger.info("=" * 60)
    logger.info("CREATING SLIDE-LEVEL FEATURES PARQUET")
    logger.info("=" * 60)

    csv_paths = _discover_csv_files(config.input_dir)
    df = _concatenate_and_save(csv_paths, config.output_path)

    logger.info("")
    logger.info("=" * 60)
    logger.info("DONE")
    logger.info("=" * 60)
    _log_summary(df)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    parser = argparse.ArgumentParser(
        description="Consolidate per-slide CSV features into a single parquet file.",
    )
    parser.add_argument(
        "input_dir",
        type=Path,
        help="Root directory containing <cohort>/<slide>/slide_level_features.csv files.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output parquet path. Defaults to data/slide_level_features.parquet.",
    )
    args = parser.parse_args()

    main(Config(input_dir=args.input_dir, output=args.output))
