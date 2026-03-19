"""
Segmentation quality assessment by cancer type.

Aggregates available segmentation quality metrics (PQ, IoU, detection F1)
per cancer type. If per-slide segmentation scores exist in the data directory,
they are aggregated. Otherwise, this script creates a stub output documenting
the limitation and using available QC proxies.

Output:
- supplementary/segmentation_quality_by_cancer.parquet
"""

import logging
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    DATA_DIR,
    QC_DIR,
    SEGMENTATION_QUALITY,
    SLIDE_HISTOMICS,
    ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Known filenames for segmentation quality data
_CANDIDATE_SEGMENTATION_FILES = [
    "segmentation_quality.parquet",
    "cell_detection_quality.parquet",
    "panoptic_quality.parquet",
    "seg_scores.parquet",
    "segmentation_metrics.parquet",
]

# Known column name candidates for PQ, IoU, F1
_PQ_CANDIDATES = ["pq", "panoptic_quality", "PQ"]
_IOU_CANDIDATES = ["iou", "mean_iou", "IoU", "cell_iou"]
_F1_CANDIDATES = ["detection_f1", "f1", "det_f1", "F1"]


def _find_segmentation_data(data_dir: Path) -> Path | None:
    """Search for segmentation quality data in the data directory tree.

    Args:
        data_dir: Root data directory to search.

    Returns:
        Path to segmentation quality parquet file, or None if not found.
    """
    for candidate in _CANDIDATE_SEGMENTATION_FILES:
        # Check common locations
        for subdir in ["", "qc", "parquet", "parquet/qc", "processed"]:
            path = data_dir / subdir / candidate if subdir else data_dir / candidate
            if path.exists():
                return path
    return None


def _find_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Find the first matching column name from candidates."""
    lower_map = {c.lower(): c for c in df.columns}
    for cand in candidates:
        actual = lower_map.get(cand.lower())
        if actual is not None:
            return actual
    return None


def _aggregate_metric(
    group: pd.DataFrame, col: str
) -> dict:
    """Compute summary stats for a single metric column within a group."""
    values = group[col].dropna()
    if len(values) == 0:
        return {
            f"{col}_mean": np.nan,
            f"{col}_median": np.nan,
            f"{col}_std": np.nan,
            f"{col}_min": np.nan,
            f"{col}_max": np.nan,
            f"{col}_n": 0,
        }
    arr = values.to_numpy()
    return {
        f"{col}_mean": float(np.mean(arr)),
        f"{col}_median": float(np.median(arr)),
        f"{col}_std": float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0,
        f"{col}_min": float(np.min(arr)),
        f"{col}_max": float(np.max(arr)),
        f"{col}_n": len(arr),
    }


def compute_from_segmentation_data(
    seg_df: pd.DataFrame, slides_df: pd.DataFrame
) -> pd.DataFrame:
    """Aggregate segmentation metrics by cancer type.

    Args:
        seg_df: Per-slide segmentation quality scores.
        slides_df: Slide histomics with cancer_type mapping.

    Returns:
        DataFrame with per-cancer-type segmentation quality summary.
    """
    # Merge cancer type from slides
    slide_key = "slide_name" if "slide_name" in seg_df.columns else None
    if slide_key is None:
        for cand in ["slide_id", "sample_id", "case_id"]:
            if cand in seg_df.columns:
                slide_key = cand
                break

    if slide_key is None:
        logger.info("  No slide identifier column found in segmentation data")
        return pd.DataFrame()

    cancer_map = slides_df.set_index("slide_name")["cancer_type"].to_dict()
    seg_df = seg_df.copy()
    seg_df["cancer_type"] = seg_df[slide_key].map(cancer_map)
    seg_df = seg_df[seg_df["cancer_type"].notna()]

    # Find available metric columns
    pq_col = _find_column(seg_df, _PQ_CANDIDATES)
    iou_col = _find_column(seg_df, _IOU_CANDIDATES)
    f1_col = _find_column(seg_df, _F1_CANDIDATES)

    metric_cols = [c for c in [pq_col, iou_col, f1_col] if c is not None]
    if not metric_cols:
        logger.info("  No recognized metric columns found")
        return pd.DataFrame()

    logger.info("  Found metric columns: %s", metric_cols)

    records: list[dict] = []
    for cancer_type, group in seg_df.groupby("cancer_type"):
        record: dict = {"cancer_type": cancer_type, "n_slides": len(group)}
        for col in metric_cols:
            record.update(_aggregate_metric(group, col))
        record["data_source"] = "segmentation_scores"
        records.append(record)

    return pd.DataFrame(records)


def compute_stub_from_qc_proxies(slides_df: pd.DataFrame) -> pd.DataFrame:
    """Create a stub output using available QC proxy metrics.

    When per-slide segmentation scores are not available, we document
    what QC data exists and aggregate any available proxies by cancer type.

    Args:
        slides_df: Slide histomics dataframe.

    Returns:
        DataFrame with per-cancer-type QC proxy summary.
    """
    logger.info("  Creating stub from available QC proxies...")

    # Check for QC-related columns in slide_histomics
    qc_cols = [c for c in slides_df.columns if "qc" in c.lower() or "n_tiles" in c.lower()]
    logger.info("  Available QC columns: %s", qc_cols)

    records: list[dict] = []
    for cancer_type, group in slides_df.groupby("cancer_type"):
        record: dict = {
            "cancer_type": cancer_type,
            "n_slides": len(group),
            "data_source": "qc_proxy",
            "limitation": "Per-slide segmentation scores (PQ, IoU, F1) not available. "
            "Using tile count as a QC proxy.",
        }

        # Use n_tiles as a rough quality proxy if available
        if "n_tiles" in group.columns:
            tiles = group["n_tiles"].dropna()
            if len(tiles) > 0:
                record["n_tiles_mean"] = float(tiles.mean())
                record["n_tiles_median"] = float(tiles.median())
                record["n_tiles_std"] = float(tiles.std()) if len(tiles) > 1 else 0.0

        # QC pass rate if available
        if "qc_pass" in group.columns:
            qc_pass = group["qc_pass"].dropna()
            if len(qc_pass) > 0:
                record["qc_pass_rate"] = float(qc_pass.mean())
                record["qc_pass_n"] = int(qc_pass.sum())

        records.append(record)

    return pd.DataFrame(records)


def main() -> None:
    """Compute segmentation quality by cancer type and save to parquet."""
    ensure_dirs()

    logger.info("=" * 60)
    logger.info("SEGMENTATION QUALITY BY CANCER TYPE")
    logger.info("=" * 60)

    # Load slide histomics for cancer type mapping
    logger.info("Loading slide histomics...")
    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    logger.info("  Loaded %d slides across %d cancer types", len(slides_df), slides_df["cancer_type"].nunique())

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_types = sorted(slides_df["cancer_type"].unique())[: dry_run.n_cancer_types]
        slides_df = slides_df[slides_df["cancer_type"].isin(cancer_types)]
        logger.info("  [DRY-RUN] Subset to %d cancer types", len(cancer_types))

    # Search for segmentation quality data
    logger.info("Searching for segmentation quality data...")
    seg_path = _find_segmentation_data(DATA_DIR)

    if seg_path is not None:
        logger.info("  Found segmentation data: %s", seg_path)
        seg_df = pd.read_parquet(seg_path)
        logger.info("  Loaded %d rows, columns: %s", len(seg_df), list(seg_df.columns))
        result_df = compute_from_segmentation_data(seg_df, slides_df)
    else:
        logger.info("  No segmentation quality data found in %s", DATA_DIR)
        result_df = pd.DataFrame()

    # Fall back to QC proxies if no real segmentation data
    if result_df.empty:
        logger.info("  Falling back to QC proxy metrics...")
        result_df = compute_stub_from_qc_proxies(slides_df)

    # Save
    result_df.to_parquet(SEGMENTATION_QUALITY, index=False)
    logger.info("Saved %s (%d rows)", SEGMENTATION_QUALITY.name, len(result_df))

    # Summary
    logger.info("")
    data_source = result_df["data_source"].iloc[0] if not result_df.empty else "none"
    logger.info("Data source: %s", data_source)
    logger.info("Cancer types: %d", result_df["cancer_type"].nunique() if not result_df.empty else 0)

    if data_source == "qc_proxy" and not result_df.empty:
        logger.info("")
        logger.info(
            "NOTE: Per-slide segmentation quality scores (PQ, IoU, detection F1) "
            "are not available in the current data directory. The output contains "
            "QC proxy metrics only. To generate full segmentation quality data, "
            "run the cell detection evaluation pipeline and place results in "
            "data/segmentation_quality.parquet."
        )


if __name__ == "__main__":
    main()
