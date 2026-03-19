#!/usr/bin/env python3
"""
Patch unadjusted Spearman p-values from permutation to analytical.

Reads the existing feature_correlations.parquet, replaces permutation-based
p-values for the unadjusted model with analytical t-distribution p-values
(computed from rho and n), re-applies BH correction per family, and saves
the result as a new file.

Usage:
    uv run python scripts/analyses/patch_analytical_pvalues.py
"""

import logging
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr, t as t_dist

from statsmodels.stats.multitest import multipletests

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

INPUT_PATH = Path("data/latest/parquet/precomputed_stats/feature_correlations.parquet")
OUTPUT_PATH = Path("data/rerun_analytical_pvalues/feature_correlations.parquet")


def analytical_p_from_rho(rho: np.ndarray, n: np.ndarray) -> np.ndarray:
    """Vectorized two-sided p-value for Spearman rho using t-approximation."""
    rho2 = rho * rho
    # Clamp to avoid division by zero when |rho| == 1
    denom = np.clip(1.0 - rho2, 1e-300, None)
    t_stat = rho * np.sqrt((n - 2) / denom)
    p = 2.0 * t_dist.sf(np.abs(t_stat), df=n - 2)
    return p


def main() -> None:
    logger.info("Loading %s", INPUT_PATH)
    df = pd.read_parquet(INPUT_PATH)
    logger.info("Total rows: %d", len(df))

    unadj_mask = df["model"] == "unadjusted"
    n_unadj = unadj_mask.sum()
    logger.info("Unadjusted rows to patch: %d", n_unadj)

    # Compute analytical p-values
    rho = df.loc[unadj_mask, "spearman_rho"].values
    n = df.loc[unadj_mask, "n_samples"].values.astype(float)
    p_analytical = analytical_p_from_rho(rho, n)

    # Compare before patching
    p_old = df.loc[unadj_mask, "spearman_p"].values
    valid = (p_old > 0) & (p_analytical > 0) & np.isfinite(p_old) & np.isfinite(p_analytical)
    if valid.any():
        log_old = -np.log10(np.clip(p_old[valid], 1e-300, 1))
        log_new = -np.log10(np.clip(p_analytical[valid], 1e-300, 1))
        corr, _ = spearmanr(log_old, log_new)
        logger.info("Concordance check (valid=%d): rho=%.4f", valid.sum(), corr)

    # Patch raw p-values
    df.loc[unadj_mask, "spearman_p"] = p_analytical

    # Re-apply BH correction per correction_family_id for unadjusted rows
    logger.info("Re-applying BH correction per family...")
    unadj_df = df.loc[unadj_mask].copy()

    for family_id, group in unadj_df.groupby("correction_family_id"):
        idx = group.index
        raw_p = group["spearman_p"].values
        _, p_adj, _, _ = multipletests(raw_p, method="fdr_bh")
        df.loc[idx, "spearman_p_adj"] = p_adj

    # Update is_significant (p_adj < 0.05)
    df.loc[unadj_mask, "is_significant"] = df.loc[unadj_mask, "spearman_p_adj"] < 0.05

    # Summary
    n_sig_new = df.loc[unadj_mask, "is_significant"].sum()
    logger.info("Significant unadjusted associations after patch: %d / %d", n_sig_new, n_unadj)

    # Save
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    logger.info("Saved patched file to %s", OUTPUT_PATH)
    logger.info("Original file unchanged at %s", INPUT_PATH)


if __name__ == "__main__":
    main()
