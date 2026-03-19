#!/usr/bin/env python3
"""
Validate analytical vs permutation p-values for Spearman correlations.

Historical validation script: compares permutation-based p-values (from a
previous pipeline run) against analytical p-values computed from the same
(rho, n) pairs using scipy's t-distribution approximation.

The pipeline now uses analytical t-test p-values for all Spearman correlations
(both unadjusted and covariate-adjusted partial). This script documents the
validation that justified the switch from permutation-based to analytical
inference (concordance rho = 1.000).

Usage:
    uv run python scripts/analyses/validate_analytical_pvalues.py
"""

import logging
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import t as t_dist

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path("data/latest/parquet/precomputed_stats")
OUTPUT_DIR = Path("data/validation")
SEED = 42


def _analytical_p_from_rho(rho: float, n: int) -> float:
    """Compute two-sided p-value for Spearman rho using t-approximation.

    This mirrors what scipy.stats.spearmanr does internally.
    """
    if n < 3 or np.isnan(rho):
        return np.nan
    # t-statistic: t = rho * sqrt((n-2) / (1 - rho^2))
    rho2 = rho * rho
    if rho2 >= 1.0:
        return 0.0
    t_stat = rho * np.sqrt((n - 2) / (1 - rho2))
    p = 2 * t_dist.sf(np.abs(t_stat), df=n - 2)
    return p


def main() -> None:
    # Load correlation results (unadjusted only — those use simple Spearman)
    corr_path = DATA_DIR / "feature_correlations.parquet"
    logger.info("Loading correlations from %s", corr_path)
    corr_df = pd.read_parquet(corr_path)
    unadj = corr_df[corr_df["model"] == "unadjusted"].copy()
    logger.info("Unadjusted correlations: %d rows", len(unadj))

    # Compute analytical p-values from existing (rho, n) pairs
    unadj["p_analytical"] = unadj.apply(
        lambda row: _analytical_p_from_rho(row["spearman_rho"], int(row["n_samples"])),
        axis=1,
    )

    # Drop rows where either p-value is NaN
    valid = unadj.dropna(subset=["spearman_p", "p_analytical"])
    valid = valid[valid["spearman_p"] > 0]
    valid = valid[valid["p_analytical"] > 0]
    logger.info("Valid pairs for comparison: %d", len(valid))

    perm_ps = valid["spearman_p"].values
    analytical_ps = valid["p_analytical"].values

    # Summary statistics
    log_analytical = -np.log10(np.clip(analytical_ps, 1e-300, 1))
    log_perm = -np.log10(np.clip(perm_ps, 1e-300, 1))

    rho_corr, _ = stats.spearmanr(log_analytical, log_perm)
    logger.info("\n=== Validation Results ===")
    logger.info("Spearman ρ between -log10(p_analytical) and -log10(p_perm): %.4f", rho_corr)

    diff = log_analytical - log_perm
    logger.info("Mean difference (-log10 scale): %.3f", np.mean(diff))
    logger.info("Std difference (-log10 scale): %.3f", np.std(diff))
    logger.info(
        "Max |difference| (-log10 scale): %.3f (at perm p=%.2e, analytical p=%.2e)",
        np.max(np.abs(diff)),
        perm_ps[np.argmax(np.abs(diff))],
        analytical_ps[np.argmax(np.abs(diff))],
    )

    # Floor detection: how many permutation p-values are at the floor?
    floor_p = 1 / 5001  # Minimum achievable with n_permutations=5000
    n_at_floor = np.sum(perm_ps <= floor_p * 1.1)
    logger.info(
        "\nPermutation p-values at floor (≤ %.2e): %d / %d (%.1f%%)",
        floor_p,
        n_at_floor,
        len(perm_ps),
        100 * n_at_floor / len(perm_ps),
    )
    n_analytical_smaller = np.sum(analytical_ps < perm_ps)
    logger.info(
        "Cases where analytical p < permutation p: %d / %d (%.1f%%)",
        n_analytical_smaller,
        len(perm_ps),
        100 * n_analytical_smaller / len(perm_ps),
    )

    # Among floored permutation p-values, what's the analytical p distribution?
    floored_mask = perm_ps <= floor_p * 1.1
    if floored_mask.any():
        floored_analytical = analytical_ps[floored_mask]
        logger.info("\nFor floored permutation p-values (n=%d):", floored_mask.sum())
        logger.info(
            "  Analytical p range: [%.2e, %.2e]", floored_analytical.min(), floored_analytical.max()
        )
        logger.info("  Analytical p median: %.2e", np.median(floored_analytical))
        logger.info(
            "  -log10(p_analytical) range: [%.1f, %.1f]",
            -np.log10(floored_analytical.max()),
            -np.log10(floored_analytical.min()),
        )

    # Validation figure
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    # Panel A: -log10(p) scatter
    ax = axes[0]
    ax.scatter(log_perm, log_analytical, s=2, alpha=0.15, c="#3b82f6", rasterized=True)
    lim = max(log_perm.max(), log_analytical.max()) * 1.05
    ax.plot([0, lim], [0, lim], "k--", lw=0.8, alpha=0.5)
    ax.set_xlabel("-log₁₀(p_permutation)")
    ax.set_ylabel("-log₁₀(p_analytical)")
    ax.set_title(f"P-value comparison (ρ = {rho_corr:.3f})")
    ax.set_xlim(0, lim)
    ax.set_ylim(0, lim)

    # Panel B: Bland-Altman
    ax = axes[1]
    mean_log = (log_analytical + log_perm) / 2
    ax.scatter(mean_log, diff, s=2, alpha=0.15, c="#8b5cf6", rasterized=True)
    ax.axhline(0, color="k", lw=0.8, ls="--")
    ax.axhline(np.mean(diff) + 1.96 * np.std(diff), color="red", lw=0.5, ls=":")
    ax.axhline(np.mean(diff) - 1.96 * np.std(diff), color="red", lw=0.5, ls=":")
    ax.set_xlabel("Mean -log₁₀(p)")
    ax.set_ylabel("Difference (analytical - permutation)")
    ax.set_title("Bland-Altman plot")

    # Panel C: Histogram of analytical p-values for floored permutation p-values
    ax = axes[2]
    if floored_mask.any():
        floored_log = -np.log10(analytical_ps[floored_mask])
        ax.hist(floored_log, bins=50, color="#10b981", alpha=0.7, edgecolor="white")
        ax.axvline(
            -np.log10(floor_p), color="red", lw=1, ls="--", label=f"Perm floor ({floor_p:.2e})"
        )
        ax.set_xlabel("-log₁₀(p_analytical)")
        ax.set_ylabel("Count")
        ax.set_title(f"Floored perm p-values (n={floored_mask.sum()})\nAnalytical p distribution")
        ax.legend(fontsize=8)
    else:
        ax.text(0.5, 0.5, "No floored p-values", transform=ax.transAxes, ha="center")

    plt.tight_layout()
    fig_path = OUTPUT_DIR / "pvalue_validation_analytical_vs_permutation.png"
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    logger.info("\nSaved validation figure to %s", fig_path)

    # Verdict
    if rho_corr > 0.95:
        logger.info("\n✓ PASS: Analytical and permutation p-values are highly concordant.")
        logger.info("  Safe to switch to analytical p-values for unadjusted Spearman.")
    else:
        logger.info("\n✗ CAUTION: Concordance is lower than expected (ρ = %.3f).", rho_corr)
        logger.info("  Review the validation figure before switching.")


if __name__ == "__main__":
    main()
