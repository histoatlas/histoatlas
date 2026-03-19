"""Shared utility functions for HistoAtlas analysis."""

import numpy as np
import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype


def get_histomic_features(df: pd.DataFrame) -> list[str]:
    """
    Extract histomic feature column names from dataframe.

    Excludes metadata columns (cancer_type, slide_name, case_id, embedding columns,
    cluster columns, UMAP/t-SNE coordinates), QC flag columns, and boolean columns.

    Args:
        df: DataFrame with histomic features and metadata

    Returns:
        List of histomic feature column names
    """
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
        "cluster_l1_name",
        "cluster_l2_name",
        # QC columns
        "n_tiles",
        "tile_extraction_coverage_ok",
        "n_outlier_features",
        "extreme_feature_outlier",
        "n_missing_features",
        "missing_feature_pct",
        "high_missingness",
        "qc_pass",
        "qc_blur_suspect",
        "qc_pen_marks_suspect",
        "qc_min_tissue_area_pass",
        # TSS column
        "tss",
    }
    return [
        c
        for c in df.columns
        if c not in meta_cols
        and is_numeric_dtype(df[c])
        and not c.startswith("emb_")
        and not is_bool_dtype(df[c])  # Exclude boolean columns
    ]


def select_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """
    Pick the first matching column from a list of candidates (case-insensitive).

    Args:
        df: DataFrame to search
        candidates: List of candidate column names to look for

    Returns:
        Actual column name if found, None otherwise
    """
    lower_map: dict[str, str] = {str(c).lower(): str(c) for c in df.columns}
    for cand in candidates:
        col = lower_map.get(cand.lower())
        if col:
            return col
    return None


def mode_or_first(series: pd.Series) -> object:
    """
    Return the mode of a series, falling back to the first non-null value.

    Args:
        series: Pandas Series

    Returns:
        Mode value, or first non-null value if mode fails
    """
    if series is None:
        return np.nan
    non_null = series.dropna()
    if non_null.empty:
        return np.nan
    try:
        mode_vals = non_null.mode()
        if not mode_vals.empty:
            return mode_vals.iloc[0]
    except Exception:
        pass
    return non_null.iloc[0]


def select_case_representative_slides(
    df: pd.DataFrame,
    *,
    case_id_col: str = "case_id",
    slide_id_col: str = "slide_name",
) -> tuple[pd.DataFrame, dict]:
    """
    Select a single representative slide per case.

    Uses available QC and coverage columns to deterministically prefer higher
    quality slides. Falls back to slide_id_col ordering for stable selection.

    Args:
        df: Slide-level dataframe with case identifiers.
        case_id_col: Column containing case identifiers.
        slide_id_col: Column containing slide identifiers.

    Returns:
        (filtered_df, metadata) tuple where filtered_df has one row per case.
    """
    if case_id_col not in df.columns:
        raise ValueError(f"Missing required column '{case_id_col}'")

    df_in = df.copy()
    missing_case_id = int(df_in[case_id_col].isna().sum())
    df_valid = df_in[df_in[case_id_col].notna()].copy()

    sort_cols: list[str] = []
    ascending: list[bool] = []

    def add_sort(col: str, asc: bool) -> None:
        if col in df_valid.columns:
            sort_cols.append(col)
            ascending.append(asc)

    # Prefer higher-quality/QC-passing slides if these columns exist
    add_sort("qc_pass", False)
    add_sort("qc_min_tissue_area_pass", False)
    add_sort("tile_extraction_coverage_ok", False)
    # Prefer larger tissue coverage proxies if available
    add_sort("n_tiles", False)
    # Prefer fewer missing features if available
    add_sort("missing_feature_pct", True)
    add_sort("n_missing_features", True)
    # Deterministic fallback
    add_sort(slide_id_col, True)

    if sort_cols:
        df_valid = df_valid.sort_values(sort_cols, ascending=ascending, kind="mergesort")
    elif slide_id_col in df_valid.columns:
        df_valid = df_valid.sort_values(slide_id_col, kind="mergesort")

    df_out = df_valid.drop_duplicates(subset=[case_id_col], keep="first").copy()

    meta = {
        "n_rows_in": len(df_in),
        "n_rows_valid": len(df_valid),
        "n_rows_out": len(df_out),
        "n_cases": int(df_out[case_id_col].nunique()),
        "n_duplicates_dropped": int(len(df_valid) - len(df_out)),
        "missing_case_id": missing_case_id,
        "sort_cols": sort_cols,
    }

    return df_out, meta
