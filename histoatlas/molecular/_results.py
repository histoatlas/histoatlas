"""Result dataclasses for molecular analysis."""

from dataclasses import dataclass


@dataclass
class CorrelationResult:
    """Result of a correlation analysis between histomic and molecular features."""

    cancer_type: str
    histomic_feature: str
    molecular_feature: str
    molecular_type: str  # 'pathway', 'expression', 'cnv', 'immune_score'
    target_set_id: str
    model: str  # 'unadjusted' or 'adjusted'
    covariates_used: str  # JSON string
    spearman_rho: float
    spearman_p: float
    spearman_ci_lower: float
    spearman_ci_upper: float
    n_samples: int


@dataclass
class CategoricalAssociationResult:
    """Result of a categorical association test."""

    cancer_type: str
    histomic_feature: str
    categorical_var: str
    test_type: str  # 'mann_whitney', 'kruskal_wallis', 'rank_ancova'
    model: str
    covariates_used: str  # JSON string
    test_statistic: float
    p_value: float
    effect_size_name: str  # 'cliffs_delta', 'eta_squared', 'cohens_d', 'partial_eta_squared'
    effect_size: float
    effect_ci_lower: float
    effect_ci_upper: float
    n_samples: int
    group_sizes: str  # JSON string
    group_medians: str  # JSON string
    group_means: str  # JSON string
    df_model: int  # Model degrees of freedom (1 for binary, k-1 for k groups)
    df_residual: int  # Residual degrees of freedom


@dataclass
class ClusterMutationEnrichment:
    """Result of cluster mutation enrichment test using Fisher's exact test."""

    cancer_type: str | None
    cluster_id: int
    cluster_level: str
    mutation: str
    odds_ratio: float
    or_ci_lower: float
    or_ci_upper: float
    p_value: float
    n_mutated_in: int
    n_mutated_out: int
    n_wt_in: int
    n_wt_out: int
    absolute_risk_in: float
    absolute_risk_out: float
    risk_difference: float


@dataclass
class ClusterPathwayEnrichment:
    """Result of cluster pathway enrichment test."""

    cancer_type: str | None
    cluster_id: int
    cluster_level: str
    pathway_name: str
    mean_score_in: float
    mean_score_out: float
    score_difference: float
    cliffs_delta: float
    cliffs_delta_ci_lower: float
    cliffs_delta_ci_upper: float
    p_value: float
    n_in: int
    n_out: int


@dataclass
class ClusterImmuneEnrichment:
    """Result of cluster immune subtype enrichment test."""

    cancer_type: str | None
    cluster_id: int
    cluster_level: str
    immune_subtype: str
    observed: int
    expected: float
    ratio: float
    odds_ratio: float
    or_ci_lower: float
    or_ci_upper: float
    p_value: float


@dataclass
class GSEAResult:
    """Result of Gene Set Enrichment Analysis for a cluster-pathway pair."""

    cancer_type: str | None
    cluster_id: int
    cluster_level: str
    pathway_name: str
    nes: float  # Normalized Enrichment Score
    p_value: float
    fdr_q: float  # Canonical GSEA FDR q-value (pooled null NES)
    is_significant: bool
    leading_edge_genes: str  # JSON string
    leading_edge_size: int
    es: float  # Raw enrichment score
    n_genes_in_pathway: int
    n_genes_in_data: int
