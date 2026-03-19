"""
Tier 6: Export Rules

Generates:
- Frontend JSON data files
- Polished final outputs
"""


rule export_frontend_json:
    """Export data for frontend consumption."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        cluster_metadata=CLUSTERING_DIR / "l1_cluster_metadata.parquet",
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
        correlations=PRECOMPUTED_STATS_DIR / "feature_correlations.parquet",
        similar=PRECOMPUTED_STATS_DIR / "similar_slides.parquet",
        mdes_marker=PRECOMPUTED_STATS_DIR / ".mdes_complete",
        l2_umap=CLUSTERING_DIR / "l2_umap_coordinates.parquet",
    output:
        frontend=JSON_DIR / "frontend_data.json",
        clusters=JSON_DIR / "clusters.json",
        atlas=JSON_DIR / "atlas_coordinates.json",
        cancer_types=JSON_DIR / "cancer_types.json",
        feature_metadata=JSON_DIR / "feature_metadata.json",
        filter_summaries=JSON_DIR / "filter_summaries.json",
    threads: 1
    log:
        "logs/export_frontend_json.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/export_frontend_json.py > {log} 2>&1
        """


rule generate_polish_artifacts:
    """Generate provenance, QC report, manifest, and canonical slides table."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        mdes_marker=PRECOMPUTED_STATS_DIR / ".mdes_complete",
    output:
        provenance=JSON_DIR / "provenance.json",
        qc_report=JSON_DIR / "data_qc_report.json",
        manifest=JSON_DIR / "manifest.json",
        run_metadata=JSON_DIR / "run_metadata.json",
        slides=PARQUET_DIR / "slides.parquet",
        schema=JSON_DIR / "slides_schema.json",
    threads: 1
    log:
        "logs/generate_polish_artifacts.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/generate_polish_artifacts.py > {log} 2>&1
        """
