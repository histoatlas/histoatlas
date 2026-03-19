"""
Tier 5: Meta-Analysis Rules

Computes:
- MDES (Minimum Detectable Effect Size)
- Evidence strength badges
"""


rule compute_mdes:
    """Compute MDES and evidence strength badges for all analyses."""
    input:
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
        correlations=PRECOMPUTED_STATS_DIR / "feature_correlations.parquet",
        categorical=PRECOMPUTED_STATS_DIR / "categorical_associations.parquet",
        rmst_marker=PRECOMPUTED_STATS_DIR / ".rmst_complete",
        # Optional: proteomics correlations (CPTAC only, processed if present)
        proteomics=PRECOMPUTED_STATS_DIR / "proteomics_correlations.parquet" if (INPUT_ROOT / "processed" / "molecular" / "proteomics.parquet").exists() else [],
    output:
        # MDES updates files in place; use marker file
        marker=touch(PRECOMPUTED_STATS_DIR / ".mdes_complete"),
    threads: 24
    log:
        "logs/compute_mdes.log"
    shell:
        """
        PYTHONUNBUFFERED=1 HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_mdes.py 2>&1 | tee {log}
        """
