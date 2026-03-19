"""
Tier 2: Feature Extraction and QC Rules

Computes:
- QC flags for slides
- Similar slides (KNN in histomic space)
- Representative tiles per slide and cluster
"""


rule compute_qc_flags:
    """Compute QC flags for slides."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        tiles=DATA_ROOT / "tile_level_features.parquet",
    output:
        config=JSON_DIR / "qc_config.json",
    threads: 1
    log:
        "logs/compute_qc_flags.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_qc_flags.py 2>&1 | tee {log}
        """


rule compute_similar_slides:
    """Compute similar slides using KNN in histomic space."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
    output:
        pan_cancer=PRECOMPUTED_STATS_DIR / "similar_slides.parquet",
        cancer_specific=PRECOMPUTED_STATS_DIR / "similar_slides_cancer_specific.parquet",
    threads: 8
    log:
        "logs/compute_similar_slides.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_similar_slides.py 2>&1 | tee {log}
        """


rule compute_representative_tiles:
    """Compute representative tiles for slides and clusters."""
    input:
        tiles_dir=DATA_ROOT / "representative_tiles",
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        centroids=CLUSTERING_DIR / "l1_cluster_centroids_umap.parquet",
    output:
        slide_tiles=PRECOMPUTED_STATS_DIR / "slide_top_tiles.parquet",
        prototypes=CLUSTER_ANALYSES_DIR / "cluster_prototype_tiles.parquet",
    threads: 1
    log:
        "logs/compute_representative_tiles.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_representative_tiles.py 2>&1 | tee {log}
        """
