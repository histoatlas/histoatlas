"""Association analysis between histomics vector and molecular data."""

from histoatlas.molecular._results import (
    CategoricalAssociationResult,
    ClusterImmuneEnrichment,
    ClusterMutationEnrichment,
    ClusterPathwayEnrichment,
    CorrelationResult,
    GSEAResult,
)
from histoatlas.molecular.categorical import (
    cliffs_delta,
    eta_squared_kw,
    run_categorical_analysis,
    test_categorical_association,
)
from histoatlas.molecular.correlation import (
    build_covariate_matrix,
    compute_correlation,
    residualize,
    run_correlation_analysis,
)
from histoatlas.molecular.enrichment import (
    compute_cluster_immune_enrichment,
    compute_cluster_mutation_enrichment,
    compute_cluster_pathway_enrichment,
)
from histoatlas.molecular.gsea import (
    compute_enrichment_score,
    gsea_permutation_test,
    run_gsea_for_cluster,
)
from histoatlas.molecular.pathway_scores import (
    cnv_to_category,
    compute_hallmark_ssgsea,
    load_hallmark_gene_sets,
)

__all__ = [
    # Result dataclasses
    "CorrelationResult",
    "CategoricalAssociationResult",
    "ClusterMutationEnrichment",
    "ClusterPathwayEnrichment",
    "ClusterImmuneEnrichment",
    "GSEAResult",
    # Pathway scores
    "compute_hallmark_ssgsea",
    "load_hallmark_gene_sets",
    "cnv_to_category",
    # Correlation
    "build_covariate_matrix",
    "residualize",
    "compute_correlation",
    "run_correlation_analysis",
    # Categorical
    "cliffs_delta",
    "eta_squared_kw",
    "test_categorical_association",
    "run_categorical_analysis",
    # GSEA
    "compute_enrichment_score",
    "gsea_permutation_test",
    "run_gsea_for_cluster",
    # Enrichment
    "compute_cluster_mutation_enrichment",
    "compute_cluster_pathway_enrichment",
    "compute_cluster_immune_enrichment",
]
