"""HistoAtlas - Pan-cancer histopathology morphology atlas."""

__version__ = "0.1.0"

# Utilities
from histoatlas._utils import (
    get_histomic_features,
    mode_or_first,
    select_case_representative_slides,
    select_column,
)

# Analysis
from histoatlas.analysis import (
    apply_bh_correction,
    ci_width_category,
    evidence_badge_categorical,
    evidence_badge_correlation,
    evidence_badge_survival,
    mdes_correlation,
    mdes_kruskal_wallis,
    mdes_mann_whitney,
    mdes_survival,
)

# Cluster
from histoatlas.cluster import (
    FEATURE_LABELS,
    compute_bootstrap_stability_fast,
    compute_tsne,
    compute_umap,
    find_optimal_k_elbow,
    generate_cluster_names_for_k,
    generate_l2_cluster_name,
    select_optimal_k_elbow,
)

# Config - commonly used constants
from histoatlas.config import (
    AVAILABLE_GENES,
    CANCER_FULL_NAMES,
    CANCER_SPECIFIC_HORIZONS,
    CANCER_TYPE_COLORS,
    DEFAULT_HORIZON_DAYS,
    FEATURE_METADATA,
    HALLMARK_PATHWAYS,
    MODERATE_EFFECT_THRESHOLDS,
    STRONG_EFFECT_THRESHOLDS,
    get_horizon_for_cancer,
)

# Frontend
from histoatlas.frontend import (
    SimilarSlide,
    compute_cancer_specific_knn,
    compute_categorical_bitsets,
    compute_feature_bitsets,
    compute_knn_batch,
    compute_quantile_bins,
    compute_range_lookup,
    encode_bitset_base64,
    export_atlas_coordinates,
    export_cancer_types,
    export_clusters,
    export_enrichment_summaries,
    export_feature_metadata,
    export_filter_summaries,
    export_similar_slides,
    export_treatment_associations,
    pack_bitset,
)

# Molecular
from histoatlas.molecular import (
    CategoricalAssociationResult,
    ClusterImmuneEnrichment,
    ClusterMutationEnrichment,
    ClusterPathwayEnrichment,
    CorrelationResult,
    GSEAResult,
    cliffs_delta,
    cnv_to_category,
    compute_cluster_immune_enrichment,
    compute_cluster_mutation_enrichment,
    compute_cluster_pathway_enrichment,
    compute_correlation,
    compute_enrichment_score,
    compute_hallmark_ssgsea,
    eta_squared_kw,
    gsea_permutation_test,
    load_hallmark_gene_sets,
    residualize,
    run_categorical_analysis,
    run_correlation_analysis,
    run_gsea_for_cluster,
    test_categorical_association,
)

# Preprocessing
from histoatlas.preprocessing import (
    LOG_TRANSFORM_FEATURES,
    get_preprocessed_matrix,
    preprocess_features,
)

# Survival
from histoatlas.survival import (
    CoxRegressionResult,
    KaplanMeierResult,
    RMSTResult,
    coarsen_stage,
    compute_cluster_survival,
    compute_km_curves,
    compute_median_survival,
    compute_missingness_stats,
    compute_rmst,
    compute_rmst_difference,
    impute_covariates,
    pool_cox_results,
    run_cox_regression,
    select_covariates,
)

__all__ = [
    # Version
    "__version__",
    # Utilities
    "get_histomic_features",
    "select_column",
    "mode_or_first",
    "select_case_representative_slides",
    # Config
    "HALLMARK_PATHWAYS",
    "AVAILABLE_GENES",
    "CANCER_TYPE_COLORS",
    "CANCER_FULL_NAMES",
    "FEATURE_METADATA",
    "DEFAULT_HORIZON_DAYS",
    "CANCER_SPECIFIC_HORIZONS",
    "get_horizon_for_cancer",
    "STRONG_EFFECT_THRESHOLDS",
    "MODERATE_EFFECT_THRESHOLDS",
    # Analysis
    "apply_bh_correction",
    "mdes_survival",
    "mdes_correlation",
    "mdes_mann_whitney",
    "mdes_kruskal_wallis",
    "ci_width_category",
    "evidence_badge_survival",
    "evidence_badge_correlation",
    "evidence_badge_categorical",
    # Molecular - dataclasses
    "CorrelationResult",
    "CategoricalAssociationResult",
    "ClusterMutationEnrichment",
    "ClusterPathwayEnrichment",
    "ClusterImmuneEnrichment",
    "GSEAResult",
    # Molecular - functions
    "compute_hallmark_ssgsea",
    "load_hallmark_gene_sets",
    "cnv_to_category",
    "residualize",
    "compute_correlation",
    "run_categorical_analysis",
    "run_correlation_analysis",
    "cliffs_delta",
    "eta_squared_kw",
    "test_categorical_association",
    "compute_enrichment_score",
    "gsea_permutation_test",
    "run_gsea_for_cluster",
    "compute_cluster_mutation_enrichment",
    "compute_cluster_pathway_enrichment",
    "compute_cluster_immune_enrichment",
    # Survival - dataclasses
    "CoxRegressionResult",
    "KaplanMeierResult",
    "RMSTResult",
    # Survival - functions
    "coarsen_stage",
    "select_covariates",
    "run_cox_regression",
    "compute_missingness_stats",
    "impute_covariates",
    "pool_cox_results",
    "compute_km_curves",
    "compute_cluster_survival",
    "compute_median_survival",
    "compute_rmst",
    "compute_rmst_difference",
    # Preprocessing
    "LOG_TRANSFORM_FEATURES",
    "preprocess_features",
    "get_preprocessed_matrix",
    # Cluster
    "compute_umap",
    "compute_tsne",
    "find_optimal_k_elbow",
    "select_optimal_k_elbow",
    "FEATURE_LABELS",
    "generate_cluster_names_for_k",
    "generate_l2_cluster_name",
    "compute_bootstrap_stability_fast",
    # Frontend - dataclass
    "SimilarSlide",
    # Frontend - filters
    "pack_bitset",
    "encode_bitset_base64",
    "compute_quantile_bins",
    "compute_feature_bitsets",
    "compute_categorical_bitsets",
    "compute_range_lookup",
    # Frontend - similarity
    "compute_knn_batch",
    "compute_cancer_specific_knn",
    # Frontend - export
    "export_atlas_coordinates",
    "export_clusters",
    "export_feature_metadata",
    "export_cancer_types",
    "export_similar_slides",
    "export_filter_summaries",
    "export_enrichment_summaries",
    "export_treatment_associations",
]
