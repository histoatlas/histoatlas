#!/usr/bin/env python3
"""
Permutation Null Model for Correlation Significance Rate.

Contextualizes the observed significance rate (e.g. 17.2%) by comparing
it to a permutation null where feature-molecular pairings are shuffled.

For each permutation:
1. Shuffle molecular labels across slides (within each cancer type)
2. Recompute Spearman correlations for all feature-molecular pairs
3. Apply BH correction
4. Count number of significant pairs

Reports mean null significance rate +/- SD, observed rate, and fold enrichment.

Outputs:
- null_model_results.json  — null rate, observed rate, fold enrichment, effect sizes
"""

import json
import logging
import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    EXPRESSION,
    PARQUET_DIR,
    SLIDE_HISTOMICS,
    ensure_dirs,
)
from scipy.stats import spearmanr
from statsmodels.stats.multitest import multipletests

from histoatlas import AVAILABLE_GENES
from histoatlas._utils import get_histomic_features

# Suppress RuntimeWarnings from constant-column correlations
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")
warnings.filterwarnings("ignore", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

ALPHA = 0.05


@dataclass
class Config:
    """Configuration for permutation null model."""

    n_permutations: int = 100
    alpha: float = ALPHA
    n_genes: int = 50  # subset of genes for tractability
    random_state: int = 42

    def __post_init__(self) -> None:
        dry_run = get_dry_run_settings()
        if dry_run:
            self.n_permutations = 10
            self.n_genes = dry_run.n_genes
            logger.info(
                "[DRY-RUN] n_permutations=%d, n_genes=%d",
                self.n_permutations,
                self.n_genes,
            )


def run_correlation_pass(
    df: pd.DataFrame,
    histomic_features: list[str],
    gene_cols: list[str],
    cancer_types: list[str],
    alpha: float,
) -> tuple[int, int, list[float]]:
    """Run one pass of Spearman correlations + per-family BH correction.

    BH correction is applied per cancer type to match the production pipeline,
    which corrects within (cancer_type × target_set_id) families.

    Returns:
        Tuple of (n_significant, n_total_valid, list of significant |rho| values).
    """
    n_sig_total = 0
    n_total_valid = 0
    sig_rhos_all: list[float] = []

    for ct in cancer_types:
        ct_mask = df["cancer_type"] == ct
        ct_df = df[ct_mask]
        if len(ct_df) < 30:
            continue

        ct_pvalues: list[float] = []
        ct_rhos: list[float] = []

        for feat in histomic_features:
            x = ct_df[feat].values
            for gene in gene_cols:
                y = ct_df[gene].values
                valid = np.isfinite(x) & np.isfinite(y)
                if valid.sum() < 10:
                    continue
                rho, pval = spearmanr(x[valid], y[valid])
                if np.isfinite(pval):
                    ct_pvalues.append(pval)
                    ct_rhos.append(abs(rho))

        if not ct_pvalues:
            continue

        p_array = np.array(ct_pvalues)
        rho_array = np.array(ct_rhos)

        # Apply BH correction per cancer type (matches production pipeline)
        _, q_values, _, _ = multipletests(p_array, alpha=alpha, method="fdr_bh")
        sig_mask = q_values < alpha
        n_sig = int(sig_mask.sum())

        n_sig_total += n_sig
        n_total_valid += len(p_array)
        sig_rhos_all.extend(rho_array[sig_mask].tolist())

    return n_sig_total, n_total_valid, sig_rhos_all


def main() -> None:
    """Run permutation null model."""
    logger.info("=" * 60)
    logger.info("PERMUTATION NULL MODEL FOR SIGNIFICANCE RATE")
    logger.info("=" * 60)

    config = Config()
    ensure_dirs()

    # 1. Load data
    logger.info("\n1. Loading data...")
    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    histomic_features = get_histomic_features(slides_df)
    logger.info("   Slides: %d, Features: %d", len(slides_df), len(histomic_features))

    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_counts = slides_df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(dry_run.n_cancer_types).index.tolist()
        slides_df = slides_df[slides_df["cancer_type"].isin(top_cancers)]
        histomic_features = histomic_features[: dry_run.n_features]
        logger.info(
            "   [DRY-RUN] Subset to %d slides, %d features", len(slides_df), len(histomic_features)
        )

    # Load expression data
    expr_df = pd.read_parquet(EXPRESSION)
    if "case_id" in expr_df.columns:
        expr_df = expr_df.drop_duplicates("case_id")

    gene_cols = [g for g in AVAILABLE_GENES if g in expr_df.columns]
    gene_cols = gene_cols[: config.n_genes]
    logger.info("   Genes (subset): %d", len(gene_cols))

    # Merge slides with expression
    merge_key = "case_id"
    if merge_key not in slides_df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")

    merged = slides_df.merge(expr_df[[merge_key] + gene_cols], on=merge_key, how="inner")
    cancer_types = sorted(merged["cancer_type"].unique())
    logger.info("   Merged samples: %d, Cancer types: %d", len(merged), len(cancer_types))

    # 2. Observed significance rate
    logger.info("\n2. Computing observed significance rate...")
    obs_n_sig, obs_n_total, obs_sig_rhos = run_correlation_pass(
        merged, histomic_features, gene_cols, cancer_types, config.alpha
    )
    obs_rate = obs_n_sig / obs_n_total if obs_n_total > 0 else 0
    logger.info("   Observed: %d / %d significant (%.2f%%)", obs_n_sig, obs_n_total, 100 * obs_rate)

    # 3. Permutation null
    logger.info("\n3. Running %d permutations...", config.n_permutations)
    rng = np.random.RandomState(config.random_state)
    null_rates = []
    null_n_sig_list = []

    for i in range(config.n_permutations):
        # Shuffle molecular labels within each cancer type
        permuted = merged.copy()
        for ct in cancer_types:
            ct_mask = permuted["cancer_type"] == ct
            ct_indices = permuted.index[ct_mask]
            shuffled_indices = rng.permutation(ct_indices)
            permuted.loc[ct_indices, gene_cols] = permuted.loc[shuffled_indices, gene_cols].values

        null_n_sig, null_n_total, _ = run_correlation_pass(
            permuted, histomic_features, gene_cols, cancer_types, config.alpha
        )
        null_rate = null_n_sig / null_n_total if null_n_total > 0 else 0
        null_rates.append(null_rate)
        null_n_sig_list.append(null_n_sig)

        if (i + 1) % max(1, config.n_permutations // 10) == 0:
            logger.info(
                "   Permutation %d/%d: %d significant (%.2f%%)",
                i + 1,
                config.n_permutations,
                null_n_sig,
                100 * null_rate,
            )

    # 4. Summary statistics
    null_rate_mean = float(np.mean(null_rates))
    null_rate_sd = float(np.std(null_rates, ddof=1)) if len(null_rates) > 1 else 0.0
    fold_enrichment = obs_rate / null_rate_mean if null_rate_mean > 0 else float("inf")

    # Effect size distribution among observed significant pairs
    if obs_sig_rhos:
        median_rho = float(np.median(obs_sig_rhos))
        iqr_rho_25 = float(np.percentile(obs_sig_rhos, 25))
        iqr_rho_75 = float(np.percentile(obs_sig_rhos, 75))
    else:
        median_rho = iqr_rho_25 = iqr_rho_75 = 0.0

    results = {
        "n_permutations": config.n_permutations,
        "n_total_tests": obs_n_total,
        "n_features": len(histomic_features),
        "n_genes": len(gene_cols),
        "n_cancer_types": len(cancer_types),
        "observed_n_significant": obs_n_sig,
        "observed_rate": round(obs_rate, 6),
        "observed_rate_pct": round(100 * obs_rate, 2),
        "null_rate_mean": round(null_rate_mean, 6),
        "null_rate_sd": round(null_rate_sd, 6),
        "null_rate_pct": round(100 * null_rate_mean, 2),
        "fold_enrichment": round(fold_enrichment, 2),
        "empirical_p_value": round(
            (sum(1 for r in null_rates if r >= obs_rate) + 1) / (config.n_permutations + 1), 4
        ),
        "effect_size_median_abs_rho": round(median_rho, 4),
        "effect_size_iqr_25": round(iqr_rho_25, 4),
        "effect_size_iqr_75": round(iqr_rho_75, 4),
    }

    logger.info("\n4. Results:")
    logger.info("   Observed rate: %.2f%%", results["observed_rate_pct"])
    logger.info("   Null rate:     %.2f%% +/- %.2f%%", 100 * null_rate_mean, 100 * null_rate_sd)
    logger.info("   Fold enrichment: %.1fx", fold_enrichment)
    logger.info(
        "   Median |rho| (significant): %.4f [IQR: %.4f - %.4f]", median_rho, iqr_rho_25, iqr_rho_75
    )

    # 5. Save
    output_path = PARQUET_DIR / "null_model_results.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    logger.info("\n   Saved %s", output_path.name)

    logger.info("\n" + "=" * 60)
    logger.info("PERMUTATION NULL MODEL COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
