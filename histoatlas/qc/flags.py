"""QC flag computation for HistoAtlas slides.

Computes quality control flags to identify potentially unreliable slides.
"""

import numpy as np
import pandas as pd


def compute_tile_coverage_flags(
    tiles_df: pd.DataFrame,
    slides_df: pd.DataFrame,
    min_tiles: int = 10,
    tile_count_col: str = "tile_id",
) -> pd.DataFrame:
    """
    Compute tile extraction coverage QC flags.

    Args:
        tiles_df: Tile-level DataFrame with slide identifiers
        slides_df: Slide-level DataFrame
        min_tiles: Minimum number of tiles for adequate coverage
        tile_count_col: Column to count for tiles (usually tile_id or any tile column)

    Returns:
        DataFrame with slide_name and tile_extraction_coverage_ok flag
    """
    # Count tiles per slide
    tile_counts = tiles_df.groupby("slide_name").size().reset_index(name="n_tiles")

    # Create flag
    tile_counts["tile_extraction_coverage_ok"] = tile_counts["n_tiles"] >= min_tiles

    # Merge with slides to ensure all slides have a flag
    result = slides_df[["slide_name"]].merge(tile_counts, on="slide_name", how="left")

    # Fill missing with False (no tiles found)
    result["n_tiles"] = result["n_tiles"].fillna(0).astype(int)
    result["tile_extraction_coverage_ok"] = result["tile_extraction_coverage_ok"].fillna(False)

    return result[["slide_name", "n_tiles", "tile_extraction_coverage_ok"]]


def compute_extreme_outlier_flags(
    slides_df: pd.DataFrame,
    feature_cols: list[str],
    z_threshold: float = 5.0,
    max_outlier_features: int = 5,
) -> pd.DataFrame:
    """
    Compute extreme feature outlier flags.

    A slide is flagged if it has more than max_outlier_features with
    |z-score| > z_threshold.

    Args:
        slides_df: Slide-level DataFrame with features
        feature_cols: List of feature column names to check
        z_threshold: Z-score threshold for outlier detection
        max_outlier_features: Max outlier features before flagging

    Returns:
        DataFrame with slide_name and extreme_feature_outlier flag
    """
    # Compute z-scores for each feature within each cancer type
    result_rows = []

    for cancer_type in slides_df["cancer_type"].unique():
        cancer_mask = slides_df["cancer_type"] == cancer_type
        cancer_df = slides_df[cancer_mask]

        # Count outlier features per slide
        outlier_counts = np.zeros(len(cancer_df))

        for col in feature_cols:
            if col not in cancer_df.columns:
                continue

            values = cancer_df[col].values
            mean_val = np.nanmean(values)
            std_val = np.nanstd(values)

            if std_val > 0:
                z_scores = np.abs((values - mean_val) / std_val)
                outlier_counts += (z_scores > z_threshold).astype(int)

        # Create flags
        for i, (idx, row) in enumerate(cancer_df.iterrows()):
            result_rows.append(
                {
                    "slide_name": row["slide_name"],
                    "n_outlier_features": int(outlier_counts[i]),
                    "extreme_feature_outlier": outlier_counts[i] > max_outlier_features,
                }
            )

    return pd.DataFrame(result_rows)


def compute_missingness_flags(
    slides_df: pd.DataFrame,
    feature_cols: list[str],
    max_missing_pct: float = 0.2,
) -> pd.DataFrame:
    """
    Compute missingness flags for slides.

    Args:
        slides_df: Slide-level DataFrame with features
        feature_cols: List of feature column names to check
        max_missing_pct: Maximum proportion of missing features

    Returns:
        DataFrame with slide_name and high_missingness flag
    """
    available_cols = [c for c in feature_cols if c in slides_df.columns]
    n_features = len(available_cols)

    result_rows = []
    for _, row in slides_df.iterrows():
        n_missing = sum(pd.isna(row[c]) for c in available_cols)
        missing_pct = n_missing / n_features if n_features > 0 else 0

        result_rows.append(
            {
                "slide_name": row["slide_name"],
                "n_missing_features": n_missing,
                "missing_feature_pct": missing_pct,
                "high_missingness": missing_pct > max_missing_pct,
            }
        )

    return pd.DataFrame(result_rows)


def add_qc_flags_to_slides(
    slides_df: pd.DataFrame,
    tiles_df: pd.DataFrame | None = None,
    feature_cols: list[str] | None = None,
    config: dict | None = None,
) -> pd.DataFrame:
    """
    Add all QC flags to slides DataFrame.

    Args:
        slides_df: Slide-level DataFrame
        tiles_df: Optional tile-level DataFrame for tile coverage flags
        feature_cols: List of histomic feature columns
        config: Optional QC configuration dict

    Returns:
        slides_df with QC flag columns added
    """
    config = config or {}
    result = slides_df.copy()

    # Determine feature columns if not provided
    if feature_cols is None:
        meta_cols = {
            "cancer_type",
            "slide_name",
            "case_id",
            "umap_1",
            "umap_2",
            "tsne_1",
            "tsne_2",
            "cluster_l1",
            "cluster_l2",
        }
        feature_cols = [
            c
            for c in slides_df.columns
            if c not in meta_cols
            and not c.startswith("emb_")
            and pd.api.types.is_numeric_dtype(slides_df[c])
        ]

    # Tile coverage flags
    if tiles_df is not None:
        min_tiles = config.get("min_tiles", 10)
        tile_flags = compute_tile_coverage_flags(tiles_df, slides_df, min_tiles=min_tiles)
        result = result.merge(
            tile_flags[["slide_name", "n_tiles", "tile_extraction_coverage_ok"]],
            on="slide_name",
            how="left",
        )
    else:
        result["n_tiles"] = None
        result["tile_extraction_coverage_ok"] = None

    # Extreme outlier flags
    z_threshold = config.get("z_threshold", 5.0)
    max_outlier_features = config.get("max_outlier_features", 5)
    outlier_flags = compute_extreme_outlier_flags(
        slides_df, feature_cols, z_threshold=z_threshold, max_outlier_features=max_outlier_features
    )
    result = result.merge(
        outlier_flags[["slide_name", "n_outlier_features", "extreme_feature_outlier"]],
        on="slide_name",
        how="left",
    )

    # Missingness flags
    max_missing_pct = config.get("max_missing_pct", 0.2)
    missingness_flags = compute_missingness_flags(
        slides_df, feature_cols, max_missing_pct=max_missing_pct
    )
    result = result.merge(
        missingness_flags[["slide_name", "n_missing_features", "high_missingness"]],
        on="slide_name",
        how="left",
    )

    # Composite QC pass flag
    # Tile coverage: pass if True or missing (None/NaN treated as pass)
    tile_ok = result["tile_extraction_coverage_ok"].fillna(True).astype(bool)
    result["qc_pass"] = (
        tile_ok & (~result["extreme_feature_outlier"]) & (~result["high_missingness"])
    )

    # Note about unavailable flags
    result["qc_blur_suspect"] = None  # Not available without image QC
    result["qc_pen_marks_suspect"] = None  # Not available without image QC
    result["qc_min_tissue_area_pass"] = None  # Would need tissue segmentation data

    return result
