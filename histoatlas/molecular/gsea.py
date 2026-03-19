"""Gene Set Enrichment Analysis (GSEA) functions."""

import json
import logging

import numpy as np
import pandas as pd

from histoatlas.molecular._results import GSEAResult

logger = logging.getLogger(__name__)


def _impute_nans(expression_df: pd.DataFrame, gene_cols: list[str]) -> np.ndarray:
    """Extract expression matrix, impute NaNs with column medians, cast to float32.

    NaN imputation enables vectorized Welch's t-test via BLAS matmul by removing
    the need for scipy's slow per-column nan_policy="omit" path.
    All-NaN columns are filled with 0.0 (yielding t-stat = 0, matching the old
    nan_to_num(nan=0.0) behavior).
    """
    values = expression_df[gene_cols].values.astype(np.float32)
    nan_mask = np.isnan(values)
    if nan_mask.any():
        col_medians = np.nanmedian(values, axis=0)
        # All-NaN columns get median=NaN; replace with 0.0
        col_medians = np.where(np.isfinite(col_medians), col_medians, np.float32(0.0))
        row_idx, col_idx = np.where(nan_mask)
        values[row_idx, col_idx] = col_medians[col_idx]
    return values


def compute_gene_t_statistics(
    expression_df: pd.DataFrame,
    cluster_mask: np.ndarray,
    gene_cols: list[str],
) -> np.ndarray:
    """
    Compute t-statistics comparing in-cluster vs out-cluster for each gene.

    Uses a vectorized Welch's t-test after NaN imputation (column medians).

    Args:
        expression_df: DataFrame with gene expression data
        cluster_mask: Boolean array indicating cluster membership
        gene_cols: List of gene column names

    Returns:
        Array of t-statistics for each gene
    """
    expr = _impute_nans(expression_df, gene_cols)
    in_cluster = expr[cluster_mask]
    out_cluster = expr[~cluster_mask]

    n1, n2 = np.float64(in_cluster.shape[0]), np.float64(out_cluster.shape[0])
    mean1 = in_cluster.mean(axis=0, dtype=np.float64)
    mean2 = out_cluster.mean(axis=0, dtype=np.float64)
    var1 = in_cluster.var(axis=0, ddof=1, dtype=np.float64)
    var2 = out_cluster.var(axis=0, ddof=1, dtype=np.float64)

    with np.errstate(divide="ignore", invalid="ignore"):
        denom = np.sqrt(var1 / n1 + var2 / n2)
        t_stats = np.where(denom > 0, (mean1 - mean2) / denom, 0.0)
    return t_stats


def compute_enrichment_score(
    ranked_genes: np.ndarray, gene_set_mask: np.ndarray, weighted: bool = True
) -> tuple[float, int, list[int]]:
    """
    Compute GSEA enrichment score.

    Args:
        ranked_genes: Array of gene scores (e.g., t-statistics) for ranking
        gene_set_mask: Boolean mask indicating genes in the gene set
        weighted: Whether to use weighted scoring (default True)

    Returns:
        (es, leading_edge_size, leading_edge_indices) tuple
    """
    n = len(ranked_genes)
    n_hit = gene_set_mask.sum()
    n_miss = n - n_hit

    if n_hit == 0 or n_miss == 0:
        return 0.0, 0, []

    order = np.argsort(-ranked_genes)
    sorted_mask = gene_set_mask[order]
    sorted_scores = np.abs(ranked_genes[order]) if weighted else np.ones(n)

    hit_scores = sorted_scores * sorted_mask
    hit_sum = hit_scores.sum()

    if hit_sum == 0:
        return 0.0, 0, []

    hit_increment = np.where(sorted_mask, sorted_scores / hit_sum, 0.0)
    miss_increment = np.where(~sorted_mask, 1.0 / n_miss, 0.0)
    running_sum = np.cumsum(hit_increment - miss_increment)

    max_pos = running_sum.max()
    max_neg = running_sum.min()

    if abs(max_pos) >= abs(max_neg):
        es = max_pos
        peak_idx = np.argmax(running_sum)
    else:
        es = max_neg
        peak_idx = np.argmin(running_sum)

    if es >= 0:
        leading_edge_positions = np.where(sorted_mask[: peak_idx + 1])[0]
    else:
        leading_edge_positions = np.where(sorted_mask[peak_idx:])[0] + peak_idx

    leading_edge_indices = order[leading_edge_positions].tolist()
    return es, len(leading_edge_indices), leading_edge_indices


def _compute_enrichment_scores_batch(
    ranked_stats: np.ndarray,
    gene_set_mask: np.ndarray,
) -> np.ndarray:
    """Compute enrichment scores for all permutations at once.

    Vectorizes argsort + cumsum across all permutations, replacing the
    Python for-loop over individual compute_enrichment_score calls.

    Args:
        ranked_stats: Array of shape (n_perm, n_genes) with gene scores
        gene_set_mask: Boolean mask of shape (n_genes,) for the gene set

    Returns:
        Array of shape (n_perm,) with enrichment scores
    """
    n_perm, n_genes = ranked_stats.shape
    n_hit = gene_set_mask.sum()
    n_miss = n_genes - n_hit

    if n_hit == 0 or n_miss == 0:
        return np.zeros(n_perm)

    # Batch argsort: sort each permutation's genes by descending score
    orders = np.argsort(-ranked_stats, axis=1)  # (n_perm, n_genes)

    # Sorted masks and scores for all permutations
    sorted_masks = gene_set_mask[orders]  # (n_perm, n_genes)
    sorted_scores = np.abs(np.take_along_axis(ranked_stats, orders, axis=1))

    # Weighted hit scores
    hit_scores = sorted_scores * sorted_masks
    hit_sums = hit_scores.sum(axis=1, keepdims=True)  # (n_perm, 1)
    hit_sums_safe = np.where(hit_sums > 0, hit_sums, 1.0)

    hit_increment = np.where(sorted_masks, sorted_scores / hit_sums_safe, 0.0)
    miss_increment = np.where(~sorted_masks, 1.0 / n_miss, 0.0)
    running_sum = np.cumsum(hit_increment - miss_increment, axis=1)

    max_pos = running_sum.max(axis=1)
    max_neg = running_sum.min(axis=1)

    es = np.where(np.abs(max_pos) >= np.abs(max_neg), max_pos, max_neg)
    # Zero out cases where all hit scores were zero
    es = np.where(hit_sums.ravel() > 0, es, 0.0)

    return es


def precompute_permuted_t_stats(
    expression_df: pd.DataFrame,
    cluster_mask: np.ndarray,
    gene_cols: list[str],
    n_perm: int = 1000,
    seed: int = 42,
) -> np.ndarray:
    """Pre-compute t-statistics for all phenotype permutations.

    Uses vectorized BLAS matmul to compute Welch's t-test across all
    permutations simultaneously, replacing the sequential scipy loop.
    NaNs are pre-imputed with column medians. Matrix multiplications use
    float32 for optimal BLAS throughput; variance arithmetic is done in
    float64 to avoid catastrophic cancellation.

    Args:
        expression_df: DataFrame with gene expression data
        cluster_mask: Boolean array indicating cluster membership
        gene_cols: List of gene column names
        n_perm: Number of permutations
        seed: Random seed for reproducibility

    Returns:
        Array of shape (n_perm, n_genes) with permuted t-statistics
    """
    rng = np.random.default_rng(seed)

    # Pre-impute NaNs and cast to float32 for fast BLAS matmul
    expr = _impute_nans(expression_df, gene_cols)
    expr_sq = expr**2
    n_samples = expr.shape[0]

    # Permutation preserves True/False counts, so group sizes are constant
    n1 = float(cluster_mask.sum())
    n2 = float(n_samples) - n1

    # Generate all permutation masks: (n_perm, n_samples) float32
    masks = np.empty((n_perm, n_samples), dtype=np.float32)
    for i in range(n_perm):
        masks[i] = rng.permutation(cluster_mask).astype(np.float32)
    masks_out = np.float32(1.0) - masks

    # errstate suppresses benign BLAS float32 warnings (denorm handling)
    with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
        # Vectorized group sums via BLAS matmul (float32 for speed)
        sum1 = masks @ expr  # (n_perm, n_genes) float32
        sum2 = masks_out @ expr
        sumsq1 = masks @ expr_sq
        sumsq2 = masks_out @ expr_sq

        # Upcast to float64 for variance arithmetic to avoid catastrophic
        # cancellation in the (Σx² - (Σx)²/n) subtraction
        sum1 = sum1.astype(np.float64)
        sum2 = sum2.astype(np.float64)
        sumsq1 = sumsq1.astype(np.float64)
        sumsq2 = sumsq2.astype(np.float64)

        mean1 = sum1 / n1
        mean2 = sum2 / n2

        # Variance: s² = (Σx² - (Σx)²/n) / (n - 1)
        var1 = np.maximum((sumsq1 - sum1**2 / n1) / (n1 - 1), 0.0)
        var2 = np.maximum((sumsq2 - sum2**2 / n2) / (n2 - 1), 0.0)

        # Welch's t-statistic
        denom = np.sqrt(var1 / n1 + var2 / n2)
        result = np.where(denom > 0, (mean1 - mean2) / denom, 0.0)

    return np.nan_to_num(result, nan=0.0)


def gsea_permutation_test(
    expression_df: pd.DataFrame,
    cluster_mask: np.ndarray,
    gene_cols: list[str],
    gene_set_mask: np.ndarray,
    n_perm: int = 1000,
    seed: int = 42,
    t_stats: np.ndarray | None = None,
    return_null_nes: bool = False,
    permuted_t_stats: np.ndarray | None = None,
) -> tuple[float, float, float] | tuple[float, float, float, np.ndarray]:
    """
    Compute GSEA with phenotype permutation test for significance.

    Implements the standard GSEA method (Subramanian et al., 2005) which permutes
    sample phenotype labels rather than gene-set membership.

    Args:
        expression_df: DataFrame with gene expression data
        cluster_mask: Boolean array indicating cluster membership
        gene_cols: List of gene column names
        gene_set_mask: Boolean mask indicating genes in the gene set
        n_perm: Number of permutations (default 1000)
        seed: Random seed for reproducibility
        t_stats: Pre-computed t-statistics (optional, computed if not provided)
        return_null_nes: If True, also return the normalized null NES distribution
            for pooled FDR computation across gene sets (default False)
        permuted_t_stats: Pre-computed permuted t-statistics array of shape
            (n_perm, n_genes). When provided, skips the expensive permutation
            loop and computes enrichment scores directly from these.

    Returns:
        (nes, p_value, es) tuple when return_null_nes=False, or
        (nes, p_value, es, null_nes) 4-tuple when return_null_nes=True
    """
    # Compute observed ES from real cluster labels
    if t_stats is None:
        t_stats = compute_gene_t_statistics(expression_df, cluster_mask, gene_cols)
    es_obs, _, _ = compute_enrichment_score(t_stats, gene_set_mask)

    if es_obs == 0:
        if return_null_nes:
            return 0.0, 1.0, 0.0, np.array([], dtype=float)
        return 0.0, 1.0, 0.0

    # Build null distribution
    es_null_list: list[float] = []
    if permuted_t_stats is not None:
        if permuted_t_stats.ndim != 2:
            raise ValueError("permuted_t_stats must be a 2D array of shape (n_perm, n_genes)")
        if permuted_t_stats.shape[1] != len(gene_cols):
            raise ValueError(
                "permuted_t_stats second dimension must match len(gene_cols): "
                f"{permuted_t_stats.shape[1]} != {len(gene_cols)}"
            )
        # Fast path: batch-compute ES for all permutations via vectorized argsort+cumsum
        es_null_list = _compute_enrichment_scores_batch(permuted_t_stats, gene_set_mask).tolist()
    else:
        # Original path: permute phenotype labels and compute t-stats per permutation
        rng = np.random.default_rng(seed)
        for _ in range(n_perm):
            perm_mask = rng.permutation(cluster_mask)
            perm_t_stats = compute_gene_t_statistics(expression_df, perm_mask, gene_cols)
            es_perm, _, _ = compute_enrichment_score(perm_t_stats, gene_set_mask)
            es_null_list.append(es_perm)

    es_null = np.array(es_null_list, dtype=float)
    n_null = len(es_null)
    es_null_pos = es_null[es_null >= 0]
    es_null_neg = es_null[es_null < 0]

    mean_pos = float(np.mean(es_null_pos)) if len(es_null_pos) > 0 else 0.0
    mean_neg = float(np.mean(np.abs(es_null_neg))) if len(es_null_neg) > 0 else 0.0

    if es_obs >= 0:
        nes = es_obs / mean_pos if mean_pos != 0 else es_obs
        if len(es_null_pos) > 0:
            p_value = float((np.sum(es_null_pos >= es_obs) + 1) / (len(es_null_pos) + 1))
        else:
            p_value = 1.0 / (n_null + 1)
    else:
        nes = es_obs / mean_neg if mean_neg != 0 else es_obs
        if len(es_null_neg) > 0:
            p_value = float((np.sum(es_null_neg <= es_obs) + 1) / (len(es_null_neg) + 1))
        else:
            p_value = 1.0 / (n_null + 1)

    # Normalized null NES distribution (pooled later for FDR)
    if return_null_nes:
        null_nes = np.zeros_like(es_null, dtype=float)
        if len(es_null_pos) > 0:
            denom = mean_pos if mean_pos != 0 else 1.0
            null_nes[es_null >= 0] = es_null[es_null >= 0] / denom
        if len(es_null_neg) > 0:
            denom = mean_neg if mean_neg != 0 else 1.0
            null_nes[es_null < 0] = es_null[es_null < 0] / denom
        return nes, p_value, es_obs, null_nes

    return nes, p_value, es_obs


def run_gsea_for_cluster(
    expression_df: pd.DataFrame,
    cluster_mask: np.ndarray,
    pathways: dict,
    gene_cols: list[str],
    cluster_id: int,
    cluster_level: str,
    n_perm: int = 1000,
    min_genes: int = 3,
    compute_fdr: bool = True,
    seed: int = 42,
    cancer_type: str | None = None,
) -> list[GSEAResult]:
    """
    Run GSEA for a single cluster against all pathways.

    Args:
        expression_df: DataFrame with gene expression data
        cluster_mask: Boolean array indicating cluster membership
        pathways: Dictionary mapping pathway names to gene lists
        gene_cols: List of gene column names in expression_df
        cluster_id: Cluster identifier
        cluster_level: Cluster level ('L1' or 'L2')
        n_perm: Number of permutations (default 1000)
        min_genes: Minimum number of genes required in pathway
        compute_fdr: Compute canonical GSEA FDR q-values (pooled null NES)
        cancer_type: Cancer type label (None for pan-cancer L1, specific type for L2)

    Returns:
        List of GSEAResult objects
    """
    logger.info(
        "GSEA cluster %s (%s): %d pathways, %d permutations",
        cluster_id,
        cluster_level,
        len(pathways),
        n_perm,
    )

    gene_to_idx = {g: i for i, g in enumerate(gene_cols)}
    results = []
    temp_results: list[dict] = []

    # Compute t-stats once for leading edge calculation
    t_stats = compute_gene_t_statistics(expression_df, cluster_mask, gene_cols)

    # Pre-compute permuted t-statistics once for all pathways.
    # Every pathway uses the same seed, so the permutation sequence is
    # identical — reusing avoids recomputing t-stats K×n_perm times.
    permuted_t_stats = precompute_permuted_t_stats(
        expression_df, cluster_mask, gene_cols, n_perm, seed
    )

    for pathway_name, genes in pathways.items():
        # Deduplicate pathway genes so min_genes and counts reflect unique genes.
        pathway_genes = list(dict.fromkeys(genes))
        gene_indices = [gene_to_idx[g] for g in pathway_genes if g in gene_to_idx]

        if len(gene_indices) < min_genes:
            continue

        gene_set_mask = np.zeros(len(gene_cols), dtype=bool)
        gene_set_mask[gene_indices] = True

        nes, p_value, es, null_nes = gsea_permutation_test(
            expression_df,
            cluster_mask,
            gene_cols,
            gene_set_mask,
            n_perm=n_perm,
            seed=seed,
            t_stats=t_stats,
            return_null_nes=True,
            permuted_t_stats=permuted_t_stats,
        )

        _, le_size, le_indices = compute_enrichment_score(t_stats, gene_set_mask)
        leading_edge_genes = [gene_cols[i] for i in le_indices if i < len(gene_cols)]

        temp_results.append(
            {
                "cancer_type": cancer_type,
                "cluster_id": int(cluster_id),
                "cluster_level": cluster_level,
                "pathway_name": pathway_name,
                "nes": float(nes),
                "p_value": float(p_value),
                "es": float(es),
                "null_nes": null_nes,
                "leading_edge_genes": json.dumps(leading_edge_genes[:20]),
                "leading_edge_size": le_size,
                "n_genes_in_pathway": len(pathway_genes),
                "n_genes_in_data": len(gene_indices),
            }
        )

    if not temp_results:
        return results

    if compute_fdr:
        obs_pos = np.array([r["nes"] for r in temp_results if r["nes"] >= 0], dtype=float)
        obs_neg = np.array([r["nes"] for r in temp_results if r["nes"] < 0], dtype=float)
        null_pos = np.concatenate([r["null_nes"][r["null_nes"] >= 0] for r in temp_results], axis=0)
        null_neg = np.concatenate([r["null_nes"][r["null_nes"] < 0] for r in temp_results], axis=0)

        def _fdr_from_pooled(null_vals: np.ndarray, obs_vals: np.ndarray, obs_val: float) -> float:
            if null_vals.size == 0 or obs_vals.size == 0:
                return np.nan
            if obs_val >= 0:
                num = np.mean(null_vals >= obs_val)
                den = np.mean(obs_vals >= obs_val)
            else:
                num = np.mean(null_vals <= obs_val)
                den = np.mean(obs_vals <= obs_val)
            if den == 0:
                return np.nan
            return float(min(1.0, num / den))

        for r in temp_results:
            if r["nes"] >= 0:
                fdr_q = _fdr_from_pooled(null_pos, obs_pos, r["nes"])
            else:
                fdr_q = _fdr_from_pooled(null_neg, obs_neg, r["nes"])
            r["fdr_q"] = fdr_q
            r["is_significant"] = bool(fdr_q < 0.25) if np.isfinite(fdr_q) else False
    else:
        for r in temp_results:
            r["fdr_q"] = np.nan
            r["is_significant"] = False

    n_significant = sum(1 for r in temp_results if r.get("is_significant"))
    logger.info(
        "GSEA cluster %s done: %d/%d pathways significant",
        cluster_id,
        n_significant,
        len(temp_results),
    )

    results = [
        GSEAResult(
            cancer_type=r["cancer_type"],
            cluster_id=r["cluster_id"],
            cluster_level=r["cluster_level"],
            pathway_name=r["pathway_name"],
            nes=r["nes"],
            p_value=r["p_value"],
            fdr_q=r["fdr_q"],
            is_significant=r["is_significant"],
            leading_edge_genes=r["leading_edge_genes"],
            leading_edge_size=r["leading_edge_size"],
            es=r["es"],
            n_genes_in_pathway=r["n_genes_in_pathway"],
            n_genes_in_data=r["n_genes_in_data"],
        )
        for r in temp_results
    ]

    return results
