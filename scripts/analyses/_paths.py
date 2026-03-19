"""
Centralized path configuration for analysis scripts.

This module provides all file paths for analysis outputs, organized
by the target directory structure defined in PLAN.md §4.3.

Environment Variables:
    HISTOATLAS_DATA_ROOT: Override default data directory (e.g., for dry-run mode).
                          If set, all paths will be relative to this directory.
"""

import os
from pathlib import Path

# Base directories - support env var override for dry-run mode
_data_root_override = os.environ.get("HISTOATLAS_DATA_ROOT")
DATA_DIR = (
    Path(_data_root_override)
    if _data_root_override
    else Path(__file__).parent.parent.parent / "data"
)
FIGURES_DIR = DATA_DIR / "figures"

# Parquet subdirectories
PARQUET_DIR = DATA_DIR / "parquet"
CLUSTERING_DIR = PARQUET_DIR / "clustering"
CLUSTER_ANALYSES_DIR = PARQUET_DIR / "cluster_analyses"
PRECOMPUTED_STATS_DIR = PARQUET_DIR / "precomputed_stats"
QC_DIR = PARQUET_DIR / "qc"

# JSON output directory
JSON_DIR = DATA_DIR / "json"

# Input directories (keep existing structure)
MOLECULAR_DIR = DATA_DIR / "processed" / "molecular"

# Core OUTPUT parquet files (in PARQUET_DIR)
# slide features with embeddings and cluster assignments
SLIDE_HISTOMICS = PARQUET_DIR / "slide_histomics.parquet"
SLIDES = PARQUET_DIR / "slides.parquet"
PATHWAY_SCORES = PARQUET_DIR / "pathway_scores.parquet"

# Clustering outputs (in CLUSTERING_DIR)
L1_CLUSTERING_METRICS = CLUSTERING_DIR / "l1_clustering_metrics.parquet"
L1_CLUSTER_METADATA = CLUSTERING_DIR / "l1_cluster_metadata.parquet"
L1_CLUSTER_CENTROIDS_FEATURES = CLUSTERING_DIR / "l1_cluster_centroids_features.parquet"
L1_CLUSTER_CENTROIDS_UMAP = CLUSTERING_DIR / "l1_cluster_centroids_umap.parquet"
L1_CLUSTER_FEATURE_PROFILES = CLUSTERING_DIR / "l1_cluster_feature_profiles.parquet"
L1_CLUSTER_CANCER_COMPOSITION = CLUSTERING_DIR / "l1_cluster_cancer_composition.parquet"
L1_BOOTSTRAP_STABILITY = CLUSTERING_DIR / "l1_bootstrap_stability.parquet"
L2_CLUSTER_RESULTS = CLUSTERING_DIR / "l2_cluster_results.parquet"
L2_CLUSTER_NAMES = CLUSTERING_DIR / "l2_cluster_names.parquet"
L2_UMAP_COORDINATES = CLUSTERING_DIR / "l2_umap_coordinates.parquet"

# Cluster analyses (in CLUSTER_ANALYSES_DIR)
CLUSTER_MUTATION_ENRICHMENT = CLUSTER_ANALYSES_DIR / "cluster_mutation_enrichment.parquet"
CLUSTER_PATHWAY_ENRICHMENT = CLUSTER_ANALYSES_DIR / "cluster_pathway_enrichment.parquet"
CLUSTER_IMMUNE_ENRICHMENT = CLUSTER_ANALYSES_DIR / "cluster_immune_enrichment.parquet"
CLUSTER_PATHWAY_GSEA = CLUSTER_ANALYSES_DIR / "cluster_pathway_gsea.parquet"
CLUSTER_SURVIVAL_SUMMARY = CLUSTER_ANALYSES_DIR / "cluster_survival_summary.parquet"
CLUSTER_KM_CURVE_DATA = CLUSTER_ANALYSES_DIR / "cluster_km_curve_data.parquet"
CLUSTER_PROTOTYPE_TILES = CLUSTER_ANALYSES_DIR / "cluster_prototype_tiles.parquet"

# Precomputed statistics (in PRECOMPUTED_STATS_DIR)
SURVIVAL_ASSOCIATIONS = PRECOMPUTED_STATS_DIR / "survival_associations.parquet"
FEATURE_CORRELATIONS = PRECOMPUTED_STATS_DIR / "feature_correlations.parquet"
CATEGORICAL_ASSOCIATIONS = PRECOMPUTED_STATS_DIR / "categorical_associations.parquet"
TREATMENT_ASSOCIATIONS = PRECOMPUTED_STATS_DIR / "treatment_associations.parquet"
KM_CURVE_DATA = PRECOMPUTED_STATS_DIR / "km_curve_data.parquet"
SIMILAR_SLIDES = PRECOMPUTED_STATS_DIR / "similar_slides.parquet"
SIMILAR_SLIDES_CANCER_SPECIFIC = PRECOMPUTED_STATS_DIR / "similar_slides_cancer_specific.parquet"
SLIDE_TOP_TILES = PRECOMPUTED_STATS_DIR / "slide_top_tiles.parquet"
MUTATION_FREQUENCY = PRECOMPUTED_STATS_DIR / "mutation_frequency.parquet"
MUTATION_SURVIVAL = PRECOMPUTED_STATS_DIR / "mutation_survival.parquet"
MUTATION_KM = PRECOMPUTED_STATS_DIR / "mutation_km.parquet"
MUTATION_COOCCURRENCE = PRECOMPUTED_STATS_DIR / "mutation_cooccurrence.parquet"

# Supplementary analyses (in PARQUET_DIR)
SUPPLEMENTARY_DIR = PARQUET_DIR / "supplementary"
PER_CANCER_FEATURE_DISTRIBUTIONS = SUPPLEMENTARY_DIR / "per_cancer_feature_distributions.parquet"
VARIANCE_DECOMPOSITION = SUPPLEMENTARY_DIR / "variance_decomposition.parquet"
ENDPOINT_CONCORDANCE = SUPPLEMENTARY_DIR / "endpoint_concordance.parquet"
ENDPOINT_CONCORDANCE_SUMMARY = JSON_DIR / "endpoint_concordance_summary.json"
OOD_SENSITIVITY = SUPPLEMENTARY_DIR / "ood_sensitivity.parquet"
FEATURE_RELIABILITY_TIERS = SUPPLEMENTARY_DIR / "feature_reliability_tiers.parquet"
SEGMENTATION_QUALITY = SUPPLEMENTARY_DIR / "segmentation_quality_by_cancer.parquet"

# QC outputs (in QC_DIR)
BATCH_EFFECT_PVCA = QC_DIR / "batch_effect_pvca.parquet"
BATCH_EFFECT_SILHOUETTE = QC_DIR / "batch_effect_silhouette.parquet"

# Input files (read-only, from external pipelines)
# Histomic feature extraction outputs (stay at DATA_DIR root)
SLIDE_LEVEL_FEATURES_INPUT = DATA_DIR / "slide_level_features.parquet"
TILE_LEVEL_FEATURES_INPUT = DATA_DIR / "tile_level_features.parquet"
REPRESENTATIVE_TILES_DIR = DATA_DIR / "representative_tiles"  # per-slide JSONs from histotyper
IMMUNE_SUBTYPES = DATA_DIR / "immune_subtypes.xlsx"

# Molecular data (processed/molecular/)
EXPRESSION = MOLECULAR_DIR / "expression_curated.parquet"
EXPRESSION_FULL = MOLECULAR_DIR / "expression_full.parquet"
CLINICAL_UNIFIED = MOLECULAR_DIR / "clinical_unified.parquet"
CLINICAL_SAMPLE = MOLECULAR_DIR / "clinical_sample.parquet"
CLINICAL_PATIENT = MOLECULAR_DIR / "clinical_patient.parquet"
PHENOTYPE = MOLECULAR_DIR / "phenotype.parquet"
MUTATIONS = MOLECULAR_DIR / "mutations.parquet"
CNV = MOLECULAR_DIR / "cnv.parquet"
PROTEOMICS = MOLECULAR_DIR / "proteomics.parquet"

# Proteomics analysis outputs (in PRECOMPUTED_STATS_DIR)
PROTEOMICS_CORRELATIONS = PRECOMPUTED_STATS_DIR / "proteomics_correlations.parquet"
MRNA_VS_PROTEIN_COMPARISON = PRECOMPUTED_STATS_DIR / "mrna_vs_protein_comparison.parquet"


# Helper functions
def ensure_dirs() -> None:
    """Create all output directories if they don't exist."""
    for directory in [
        PARQUET_DIR,
        CLUSTERING_DIR,
        CLUSTER_ANALYSES_DIR,
        PRECOMPUTED_STATS_DIR,
        SUPPLEMENTARY_DIR,
        QC_DIR,
        JSON_DIR,
        FIGURES_DIR,
    ]:
        directory.mkdir(parents=True, exist_ok=True)
