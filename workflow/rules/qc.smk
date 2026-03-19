"""
Tier 1 (parallel): QC Flag Rules

Computes:
- Ratio artifact detection (near-zero denominator)
- Tissue–cell segmentation discordance
- Segmentation quality metrics per cancer type
"""


rule flag_ratio_artifacts:
    """Flag slides with near-zero denominator artifacts in ratio features."""
    input:
        features=SLIDE_LEVEL_FEATURES_INPUT,
    output:
        artifacts=QC_DIR / "ratio_artifacts.parquet",
    threads: 1
    log:
        "logs/flag_ratio_artifacts.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/flag_ratio_artifacts.py > {log} 2>&1
        """


rule flag_tissue_cell_discordance:
    """Flag slides with tissue–cell segmentation discordance."""
    input:
        features=SLIDE_LEVEL_FEATURES_INPUT,
    output:
        discordance=QC_DIR / "tissue_cell_discordance.parquet",
    threads: 1
    log:
        "logs/flag_tissue_cell_discordance.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/flag_tissue_cell_discordance.py > {log} 2>&1
        """


rule compute_segmentation_quality:
    """Compute segmentation quality metrics per cancer type."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
    output:
        quality=SUPPLEMENTARY_DIR / "segmentation_quality_by_cancer.parquet",
    threads: 1
    log:
        "logs/compute_segmentation_quality.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_segmentation_quality.py > {log} 2>&1
        """
