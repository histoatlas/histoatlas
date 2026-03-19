#!/usr/bin/env python3
"""
BH vs BY Correction Sensitivity Analysis for HistoAtlas.

Compares Benjamini-Hochberg (BH) and Benjamini-Yekutieli (BY) multiple
testing corrections across the two main correction families:
- Feature correlations (Spearman rho)
- Survival associations (Cox regression)

BY is more conservative and controls FDR under arbitrary dependence,
whereas BH assumes positive regression dependency (PRDS). This analysis
quantifies how many associations survive each threshold.

Outputs:
- bh_by_comparison.parquet   — per-test BH vs BY q-values
- bh_by_summary.json         — counts of significant associations
"""

import json
import logging
import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd
from _paths import (
    FEATURE_CORRELATIONS,
    PARQUET_DIR,
    SURVIVAL_ASSOCIATIONS,
    ensure_dirs,
)
from statsmodels.stats.multitest import multipletests

# Suppress FutureWarnings from pandas
warnings.filterwarnings("ignore", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

ALPHA = 0.05


@dataclass
class Config:
    """Configuration for BH vs BY sensitivity analysis."""

    alpha: float = ALPHA


def apply_by_correction(p_values: np.ndarray, alpha: float = ALPHA) -> np.ndarray:
    """Apply Benjamini-Yekutieli correction, returning adjusted p-values.

    Args:
        p_values: Array of raw p-values.
        alpha: Significance threshold (not used for q-value computation).

    Returns:
        Array of BY-adjusted p-values (q-values).
    """
    valid_mask = np.isfinite(p_values)
    q_values = np.full_like(p_values, np.nan, dtype=float)
    if valid_mask.sum() == 0:
        return q_values
    _, q_valid, _, _ = multipletests(p_values[valid_mask], alpha=alpha, method="fdr_by")
    q_values[valid_mask] = q_valid
    return q_values


def apply_bh_correction_array(p_values: np.ndarray, alpha: float = ALPHA) -> np.ndarray:
    """Apply Benjamini-Hochberg correction, returning adjusted p-values.

    Args:
        p_values: Array of raw p-values.
        alpha: Significance threshold (not used for q-value computation).

    Returns:
        Array of BH-adjusted p-values (q-values).
    """
    valid_mask = np.isfinite(p_values)
    q_values = np.full_like(p_values, np.nan, dtype=float)
    if valid_mask.sum() == 0:
        return q_values
    _, q_valid, _, _ = multipletests(p_values[valid_mask], alpha=alpha, method="fdr_bh")
    q_values[valid_mask] = q_valid
    return q_values


def analyze_family(
    df: pd.DataFrame,
    p_col: str,
    family_name: str,
    group_cols: list[str],
    alpha: float,
) -> tuple[pd.DataFrame, dict]:
    """Compare BH and BY corrections for a single correction family.

    BH/BY corrections are applied within each group defined by group_cols
    (e.g., per cancer_type x target_set).

    Args:
        df: DataFrame containing p-values.
        p_col: Column name for raw p-values.
        family_name: Label for this family (e.g., "correlations").
        group_cols: Columns defining correction groups.
        alpha: Significance threshold.

    Returns:
        Tuple of (comparison DataFrame, summary dict).
    """
    logger.info("Analyzing family: %s (%d tests)", family_name, len(df))

    results = []
    for group_vals, group_df in df.groupby(group_cols):
        p_raw = group_df[p_col].values.astype(float)
        q_bh = apply_bh_correction_array(p_raw, alpha)
        q_by = apply_by_correction(p_raw, alpha)

        group_result = group_df.copy()
        group_result["q_bh"] = q_bh
        group_result["q_by"] = q_by
        group_result["sig_bh"] = q_bh < alpha
        group_result["sig_by"] = q_by < alpha
        group_result["family"] = family_name
        results.append(group_result)

    comparison_df = pd.concat(results, ignore_index=True)

    n_total = len(comparison_df)
    n_valid = int(comparison_df[p_col].notna().sum())
    n_sig_bh = int(comparison_df["sig_bh"].sum())
    n_sig_by = int(comparison_df["sig_by"].sum())
    n_lost = n_sig_bh - n_sig_by

    summary = {
        "family": family_name,
        "n_total_tests": n_total,
        "n_valid_pvalues": n_valid,
        "n_significant_bh": n_sig_bh,
        "n_significant_by": n_sig_by,
        "pct_significant_bh": round(100 * n_sig_bh / n_valid, 2) if n_valid > 0 else 0,
        "pct_significant_by": round(100 * n_sig_by / n_valid, 2) if n_valid > 0 else 0,
        "n_lost_bh_to_by": n_lost,
        "pct_lost": round(100 * n_lost / n_sig_bh, 2) if n_sig_bh > 0 else 0,
    }

    logger.info("   BH significant: %d (%.1f%%)", n_sig_bh, summary["pct_significant_bh"])
    logger.info("   BY significant: %d (%.1f%%)", n_sig_by, summary["pct_significant_by"])
    logger.info("   Lost BH->BY: %d (%.1f%%)", n_lost, summary["pct_lost"])

    return comparison_df, summary


def main() -> None:
    """Run BH vs BY sensitivity analysis."""
    logger.info("=" * 60)
    logger.info("BH vs BY CORRECTION SENSITIVITY ANALYSIS")
    logger.info("=" * 60)

    config = Config()
    ensure_dirs()

    all_comparisons = []
    all_summaries = []

    # 1. Feature correlations
    logger.info("\n1. Loading feature correlations...")
    if FEATURE_CORRELATIONS.exists():
        corr_df = pd.read_parquet(FEATURE_CORRELATIONS)
        logger.info("   Loaded %d rows", len(corr_df))

        # Identify p-value and grouping columns
        p_col = next(c for c in ["p_value", "pvalue", "spearman_p"] if c in corr_df.columns)
        group_cols = []
        for col in ["cancer_type", "target_set", "target_set_id", "model"]:
            if col in corr_df.columns:
                group_cols.append(col)
        if not group_cols:
            group_cols = ["cancer_type"]

        comp_df, summary = analyze_family(corr_df, p_col, "correlations", group_cols, config.alpha)
        all_comparisons.append(comp_df)
        all_summaries.append(summary)
    else:
        logger.info("   Skipping — file not found: %s", FEATURE_CORRELATIONS)

    # 2. Survival associations
    logger.info("\n2. Loading survival associations...")
    if SURVIVAL_ASSOCIATIONS.exists():
        surv_df = pd.read_parquet(SURVIVAL_ASSOCIATIONS)
        logger.info("   Loaded %d rows", len(surv_df))

        p_col = next(c for c in ["p_value", "pvalue"] if c in surv_df.columns)
        group_cols = []
        for col in ["cancer_type", "endpoint", "model"]:
            if col in surv_df.columns:
                group_cols.append(col)
        if not group_cols:
            group_cols = ["cancer_type"]

        comp_df, summary = analyze_family(surv_df, p_col, "survival", group_cols, config.alpha)
        all_comparisons.append(comp_df)
        all_summaries.append(summary)
    else:
        logger.info("   Skipping — file not found: %s", SURVIVAL_ASSOCIATIONS)

    if not all_comparisons:
        logger.info("\nNo data available. Exiting.")
        return

    # 3. Save comparison parquet
    logger.info("\n3. Saving results...")
    combined_df = pd.concat(all_comparisons, ignore_index=True)
    output_path = PARQUET_DIR / "bh_by_comparison.parquet"
    combined_df.to_parquet(output_path, index=False)
    logger.info("   Saved bh_by_comparison.parquet (%d rows)", len(combined_df))

    # 4. Save summary JSON
    overall_summary = {
        "alpha": config.alpha,
        "families": all_summaries,
        "total_tests": sum(s["n_total_tests"] for s in all_summaries),
        "total_sig_bh": sum(s["n_significant_bh"] for s in all_summaries),
        "total_sig_by": sum(s["n_significant_by"] for s in all_summaries),
    }
    summary_path = PARQUET_DIR / "bh_by_summary.json"
    with open(summary_path, "w") as f:
        json.dump(overall_summary, f, indent=2)
    logger.info("   Saved bh_by_summary.json")

    logger.info("\n" + "=" * 60)
    logger.info("BH vs BY SENSITIVITY ANALYSIS COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
