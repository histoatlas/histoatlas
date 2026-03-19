"""
Supplementary Analysis Rules

Computes:
- Feature redundancy (correlation matrix, PCA, VIF)
- Per-cancer feature distributions
- Variance decomposition
- Data completeness
- BH sensitivity analysis
- Null model validation
- Endpoint concordance
- OOD sensitivity
- Feature reliability tiers
"""


rule compute_feature_redundancy:
    """Compute feature redundancy (correlation matrix, PCA, VIF)."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
    output:
        corr_matrix=PARQUET_DIR / "feature_redundancy/feature_correlation_matrix.parquet",
        pca=PARQUET_DIR / "feature_redundancy/pca_variance_explained.parquet",
        vif=PARQUET_DIR / "feature_redundancy/vif_scores.parquet",
        summary=PARQUET_DIR / "feature_redundancy/summary.json",
    threads: 2
    log:
        "logs/compute_feature_redundancy.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_feature_redundancy.py > {log} 2>&1
        """


rule compute_per_cancer_distributions:
    """Compute per-cancer feature distribution statistics."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
    output:
        distributions=SUPPLEMENTARY_DIR / "per_cancer_feature_distributions.parquet",
    threads: 1
    log:
        "logs/compute_per_cancer_distributions.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_per_cancer_distributions.py > {log} 2>&1
        """


rule compute_variance_decomposition:
    """Compute variance decomposition across cancer types."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
    output:
        decomposition=SUPPLEMENTARY_DIR / "variance_decomposition.parquet",
    threads: 1
    log:
        "logs/compute_variance_decomposition.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_variance_decomposition.py > {log} 2>&1
        """


rule compute_data_completeness:
    """Compute data completeness across histomics and molecular data."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        expression=DATA_ROOT / "processed/molecular/expression_curated.parquet",
        clinical=DATA_ROOT / "processed/molecular/clinical_unified.parquet",
        mutations=DATA_ROOT / "processed/molecular/mutations.parquet",
    output:
        completeness=PARQUET_DIR / "data_completeness.parquet",
    threads: 1
    log:
        "logs/compute_data_completeness.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_data_completeness.py > {log} 2>&1
        """


rule compute_bh_sensitivity:
    """Compute Benjamini-Hochberg sensitivity analysis."""
    input:
        correlations=PRECOMPUTED_STATS_DIR / "feature_correlations.parquet",
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
    output:
        comparison=PARQUET_DIR / "bh_by_comparison.parquet",
        summary=PARQUET_DIR / "bh_by_summary.json",
    threads: 1
    log:
        "logs/compute_bh_sensitivity.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_bh_sensitivity.py > {log} 2>&1
        """


rule compute_null_model:
    """Compute null model validation (permutation tests)."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        expression=DATA_ROOT / "processed/molecular/expression_curated.parquet",
    output:
        results=PARQUET_DIR / "null_model_results.json",
    threads: 1
    log:
        "logs/compute_null_model.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_null_model.py > {log} 2>&1
        """


rule compute_endpoint_concordance:
    """Compute concordance across survival endpoints."""
    input:
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
    output:
        concordance=SUPPLEMENTARY_DIR / "endpoint_concordance.parquet",
        summary=JSON_DIR / "endpoint_concordance_summary.json",
    threads: 1
    log:
        "logs/compute_endpoint_concordance.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_endpoint_concordance.py > {log} 2>&1
        """


rule compute_ood_sensitivity:
    """Compute out-of-distribution sensitivity analysis."""
    input:
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
    output:
        sensitivity=SUPPLEMENTARY_DIR / "ood_sensitivity.parquet",
    threads: 1
    log:
        "logs/compute_ood_sensitivity.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_ood_sensitivity.py > {log} 2>&1
        """


rule compute_feature_reliability_tiers:
    """Compute feature reliability tiers from survival and correlation evidence."""
    input:
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
        correlations=PRECOMPUTED_STATS_DIR / "feature_correlations.parquet",
    output:
        tiers=SUPPLEMENTARY_DIR / "feature_reliability_tiers.parquet",
    threads: 1
    log:
        "logs/compute_feature_reliability_tiers.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} uv run python scripts/analyses/compute_feature_reliability_tiers.py > {log} 2>&1
        """
