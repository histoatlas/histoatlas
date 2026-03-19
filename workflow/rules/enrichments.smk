"""
Tier 4: Enrichment Analysis Rules

Computes:
- RMST for PH-violating features
- Cluster GSEA analysis
"""


rule compute_rmst:
    """Compute RMST for PH-violating survival features."""
    input:
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        clinical=DATA_ROOT / "processed/molecular/clinical_unified.parquet",
    output:
        # RMST updates survival_associations.parquet in place
        # Use a marker file to track completion
        marker=touch(PRECOMPUTED_STATS_DIR / ".rmst_complete"),
    threads: 24
    log:
        "logs/compute_rmst.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_rmst.py 2>&1 | tee {log}
        """


rule compute_cluster_gsea:
    """Compute GSEA for histomic clusters."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        expression_full=DATA_ROOT / "processed/molecular/expression_full.parquet",
    output:
        gsea=CLUSTER_ANALYSES_DIR / "cluster_pathway_gsea.parquet",
    threads: 24
    log:
        "logs/compute_cluster_gsea.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_cluster_gsea.py 2>&1 | tee {log}
        """
