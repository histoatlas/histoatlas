"""Cluster enrichment analysis functions."""

import numpy as np
import pandas as pd
from scipy.stats import fisher_exact, mannwhitneyu
from statsmodels.stats.contingency_tables import Table2x2

from histoatlas.molecular._results import (
    ClusterImmuneEnrichment,
    ClusterMutationEnrichment,
    ClusterPathwayEnrichment,
)
from histoatlas.molecular.categorical import cliffs_delta


def compute_cluster_mutation_enrichment(
    df: pd.DataFrame,
    cluster_col: str,
    mutation_col: str,
    cluster_id: int,
    cluster_level: str,
    cancer_type: str | None = None,
) -> ClusterMutationEnrichment | None:
    """
    Compute mutation enrichment for a cluster using Fisher's exact test.

    Args:
        df: DataFrame with cluster and mutation columns
        cluster_col: Name of cluster column
        mutation_col: Name of mutation column (binary 0/1)
        cluster_id: Cluster identifier
        cluster_level: Cluster level ('L1' or 'L2')
        cancer_type: Cancer type (optional)

    Returns:
        ClusterMutationEnrichment or None if insufficient data
    """
    mask = df[cluster_col].notna() & df[mutation_col].notna()
    subset = df.loc[mask].copy()

    if len(subset) < 20:
        return None

    in_cluster = subset[cluster_col] == cluster_id
    is_mutated = subset[mutation_col] == 1

    n_mutated_in = int((in_cluster & is_mutated).sum())
    n_mutated_out = int((~in_cluster & is_mutated).sum())
    n_wt_in = int((in_cluster & ~is_mutated).sum())
    n_wt_out = int((~in_cluster & ~is_mutated).sum())

    if n_mutated_in + n_mutated_out < 5 or n_mutated_in + n_wt_in < 5:
        return None

    contingency = [[n_mutated_in, n_mutated_out], [n_wt_in, n_wt_out]]
    odds_ratio, p_value = fisher_exact(contingency)

    table = Table2x2(contingency)
    ci_lower, ci_upper = table.oddsratio_confint(method="exact")

    n_in = n_mutated_in + n_wt_in
    n_out = n_mutated_out + n_wt_out

    risk_in = n_mutated_in / n_in if n_in > 0 else np.nan
    risk_out = n_mutated_out / n_out if n_out > 0 else np.nan
    risk_diff = risk_in - risk_out

    return ClusterMutationEnrichment(
        cancer_type=cancer_type,
        cluster_id=int(cluster_id),
        cluster_level=cluster_level,
        mutation=mutation_col,
        odds_ratio=odds_ratio,
        or_ci_lower=ci_lower,
        or_ci_upper=ci_upper,
        p_value=p_value,
        n_mutated_in=n_mutated_in,
        n_mutated_out=n_mutated_out,
        n_wt_in=n_wt_in,
        n_wt_out=n_wt_out,
        absolute_risk_in=risk_in,
        absolute_risk_out=risk_out,
        risk_difference=risk_diff,
    )


def compute_cluster_pathway_enrichment(
    df: pd.DataFrame,
    cluster_col: str,
    pathway_col: str,
    cluster_id: int,
    cluster_level: str,
    cancer_type: str | None = None,
    seed: int | None = 42,
) -> ClusterPathwayEnrichment | None:
    """
    Compute pathway enrichment for a cluster using Mann-Whitney U test.

    Args:
        df: DataFrame with cluster and pathway score columns
        cluster_col: Name of cluster column
        pathway_col: Name of pathway score column
        cluster_id: Cluster identifier
        cluster_level: Cluster level ('L1' or 'L2')
        cancer_type: Cancer type (optional)

    Returns:
        ClusterPathwayEnrichment or None if insufficient data
    """
    mask = df[cluster_col].notna() & df[pathway_col].notna()
    subset = df.loc[mask].copy()

    if len(subset) < 20:
        return None

    in_cluster = subset[cluster_col] == cluster_id
    scores_in = subset.loc[in_cluster, pathway_col].values
    scores_out = subset.loc[~in_cluster, pathway_col].values

    if len(scores_in) < 5 or len(scores_out) < 5:
        return None

    mean_in = float(np.mean(scores_in))
    mean_out = float(np.mean(scores_out))
    diff = mean_in - mean_out

    # Cliff's delta effect size (nonparametric, pairs with Mann-Whitney U)
    delta, delta_ci_lower, delta_ci_upper = cliffs_delta(scores_in, scores_out, seed=seed)

    _, p_value = mannwhitneyu(scores_in, scores_out, alternative="two-sided")

    return ClusterPathwayEnrichment(
        cancer_type=cancer_type,
        cluster_id=int(cluster_id),
        cluster_level=cluster_level,
        pathway_name=pathway_col,
        mean_score_in=mean_in,
        mean_score_out=mean_out,
        score_difference=diff,
        cliffs_delta=delta,
        cliffs_delta_ci_lower=delta_ci_lower,
        cliffs_delta_ci_upper=delta_ci_upper,
        p_value=float(p_value),
        n_in=len(scores_in),
        n_out=len(scores_out),
    )


def compute_cluster_immune_enrichment(
    df: pd.DataFrame,
    cluster_col: str,
    cluster_id: int,
    cluster_level: str,
    cancer_type: str | None = None,
) -> list[ClusterImmuneEnrichment]:
    """
    Compute immune subtype enrichment for a cluster using Fisher's exact test.

    Args:
        df: DataFrame with cluster and immune_subtype columns
        cluster_col: Name of cluster column
        cluster_id: Cluster identifier
        cluster_level: Cluster level ('L1' or 'L2')
        cancer_type: Cancer type (optional)

    Returns:
        List of ClusterImmuneEnrichment objects (one per subtype)
    """
    mask = df[cluster_col].notna() & df["immune_subtype"].notna()
    subset = df.loc[mask].copy()

    if len(subset) < 20:
        return []

    results = []
    subtypes = subset["immune_subtype"].dropna().unique()

    n_total = len(subset)
    n_in_cluster = (subset[cluster_col] == cluster_id).sum()

    if n_in_cluster < 5:
        return []

    for subtype in subtypes:
        in_cluster = subset[cluster_col] == cluster_id
        is_subtype = subset["immune_subtype"] == subtype

        a = int((in_cluster & is_subtype).sum())
        b = int((~in_cluster & is_subtype).sum())
        c = int((in_cluster & ~is_subtype).sum())
        d = int((~in_cluster & ~is_subtype).sum())

        if a + b < 5:
            continue

        expected = n_in_cluster * (a + b) / n_total
        ratio = a / expected if expected > 0 else np.nan

        or_val, p_val = fisher_exact([[a, b], [c, d]])

        table = Table2x2([[a, b], [c, d]])
        ci_lower, ci_upper = table.oddsratio_confint(method="exact")

        results.append(
            ClusterImmuneEnrichment(
                cancer_type=cancer_type,
                cluster_id=int(cluster_id),
                cluster_level=cluster_level,
                immune_subtype=str(subtype),
                observed=a,
                expected=expected,
                ratio=ratio,
                odds_ratio=or_val,
                or_ci_lower=ci_lower,
                or_ci_upper=ci_upper,
                p_value=p_val,
            )
        )

    return results
