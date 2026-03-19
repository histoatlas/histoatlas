"""Multiple testing correction utilities."""

import logging

import numpy as np
import pandas as pd
from statsmodels.stats.multitest import multipletests

logger = logging.getLogger(__name__)


def apply_bh_correction(
    df: pd.DataFrame, p_col: str = "p_value", groupby_cols: list | None = None
) -> pd.DataFrame:
    """
    Apply Benjamini-Hochberg correction within groups.

    Args:
        df: DataFrame containing p-values
        p_col: Name of the p-value column
        groupby_cols: Columns to group by for family-wise correction.
                     If None, infers appropriate columns based on available columns:
                     - For correlation results: ["cancer_type", "molecular_type"]
                     - For categorical associations: ["cancer_type", "categorical_var"]
                     - Fallback: ["cancer_type"] if available, else global correction

    Returns:
        DataFrame with added columns:
        - p_value_adj: BH-adjusted p-values
        - n_tests_in_family: Number of tests in the correction family
        - correction_family_id: Identifier for the correction family
    """
    if df.empty:
        df["p_value_adj"] = []
        df["n_tests_in_family"] = []
        df["correction_family_id"] = []
        return df

    df = df.copy()
    df["_orig_index"] = df.index

    if groupby_cols is None:
        # Auto-detect appropriate groupby columns based on DataFrame schema
        if "molecular_type" in df.columns and "cancer_type" in df.columns:
            groupby_cols = ["cancer_type", "molecular_type"]
        elif "categorical_var" in df.columns and "cancer_type" in df.columns:
            groupby_cols = ["cancer_type", "categorical_var"]
        elif "cancer_type" in df.columns:
            groupby_cols = ["cancer_type"]
        else:
            # Fall back to global correction
            groupby_cols = []

    # Check that all groupby columns exist (or use global correction if none specified)
    missing_cols = [col for col in groupby_cols if col not in df.columns]
    if missing_cols:
        logger.warning(
            f"BH correction: expected groupby columns {missing_cols} not found. "
            f"Falling back to global correction across all {len(df)} tests."
        )
    if missing_cols or len(groupby_cols) == 0:
        # Fall back to global correction
        pvals = df[p_col].values
        mask = ~np.isnan(pvals)
        corrected = np.full_like(pvals, np.nan)
        if mask.sum() > 0:
            _, corrected[mask], _, _ = multipletests(pvals[mask], method="fdr_bh")
        df["p_value_adj"] = corrected
        df["n_tests_in_family"] = int(mask.sum())
        df["correction_family_id"] = "all"
        return df.drop(columns="_orig_index")

    # Store results in a list
    results = []

    for keys, group in df.groupby(groupby_cols):
        pvals = group[p_col].values
        mask = ~np.isnan(pvals)
        corrected = np.full_like(pvals, np.nan)

        if mask.sum() > 0:
            _, corrected[mask], _, _ = multipletests(pvals[mask], method="fdr_bh")

        group = group.copy()
        group["p_value_adj"] = corrected
        group["n_tests_in_family"] = int(mask.sum())

        # Create correction family ID
        if isinstance(keys, tuple):
            family_id = "_".join(str(k) for k in keys)
        else:
            family_id = str(keys)
        group["correction_family_id"] = family_id

        results.append(group)

    corrected_df: pd.DataFrame = pd.concat(results, ignore_index=True)
    corrected_df = (
        corrected_df.sort_values("_orig_index")
        .drop(columns="_orig_index")
        .reset_index(drop=True)
    )
    return corrected_df
