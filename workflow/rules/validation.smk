"""
Validation Rules

Runs automated validation checks and generates validation plots.
"""


rule validate:
    """Run validation checks and generate validation report."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
        correlations=PRECOMPUTED_STATS_DIR / "feature_correlations.parquet",
        frontend=JSON_DIR / "frontend_data.json",
    output:
        report=VALIDATION_DIR / "validation_report.json",
    threads: 1
    log:
        "logs/validate.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/validation/generate_validation_report.py 2>&1 | tee {log}
        """
