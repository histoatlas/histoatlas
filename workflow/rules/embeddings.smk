"""
Tier 1: Embedding and Clustering Rules

Computes:
- UMAP and t-SNE embeddings
- L1 (pan-cancer) clustering
- L2 (cancer-specific) clustering
- Cluster metadata, centroids, and feature profiles
"""


rule compute_embeddings:
    """Compute embeddings and clustering (Tier 1)."""
    input:
        features=DATA_ROOT / "slide_level_features.parquet",
    output:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        metrics=CLUSTERING_DIR / "l1_clustering_metrics.parquet",
        metadata=CLUSTERING_DIR / "l1_cluster_metadata.parquet",
        centroids_features=CLUSTERING_DIR / "l1_cluster_centroids_features.parquet",
        centroids_umap=CLUSTERING_DIR / "l1_cluster_centroids_umap.parquet",
        profiles=CLUSTERING_DIR / "l1_cluster_feature_profiles.parquet",
        composition=CLUSTERING_DIR / "l1_cluster_cancer_composition.parquet",
        stability=CLUSTERING_DIR / "l1_bootstrap_stability.parquet",
        l2_results=CLUSTERING_DIR / "l2_cluster_results.parquet",
        l2_names=CLUSTERING_DIR / "l2_cluster_names.parquet",
        l2_umap=CLUSTERING_DIR / "l2_umap_coordinates.parquet",
    threads: 16
    log:
        "logs/compute_embeddings.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_embeddings.py 2>&1 | tee {log}
        """
