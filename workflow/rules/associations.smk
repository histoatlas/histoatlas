"""
Tier 3: Association Analysis Rules

Computes:
- Survival associations (Cox regression, Kaplan-Meier)
- Molecular correlations (expression, pathways, mutations)
- Treatment response associations
- Batch effect assessment
"""


rule compute_survival:
    """Compute survival associations using Cox regression."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        clinical=DATA_ROOT / "processed/molecular/clinical_unified.parquet",
    output:
        survival=PRECOMPUTED_STATS_DIR / "survival_associations.parquet",
        km_curves=PRECOMPUTED_STATS_DIR / "km_curve_data.parquet",
        cluster_survival=CLUSTER_ANALYSES_DIR / "cluster_survival_summary.parquet",
        cluster_km=CLUSTER_ANALYSES_DIR / "cluster_km_curve_data.parquet",
    threads: 32
    log:
        "logs/compute_survival.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_survival.py 2>&1 | tee {log}
        """


rule compute_molecular_correlations:
    """Compute molecular correlations (expression, pathways, mutations)."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        expression=DATA_ROOT / "processed/molecular/expression_curated.parquet",
        expression_full=DATA_ROOT / "processed/molecular/expression_full.parquet",
    output:
        correlations=PRECOMPUTED_STATS_DIR / "feature_correlations.parquet",
        categorical=PRECOMPUTED_STATS_DIR / "categorical_associations.parquet",
        pathways=PARQUET_DIR / "pathway_scores.parquet",
        mutation_enrichment=CLUSTER_ANALYSES_DIR / "cluster_mutation_enrichment.parquet",
        pathway_enrichment=CLUSTER_ANALYSES_DIR / "cluster_pathway_enrichment.parquet",
        immune_enrichment=CLUSTER_ANALYSES_DIR / "cluster_immune_enrichment.parquet",
    threads: 32
    log:
        "logs/compute_molecular_correlations.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_molecular_correlations.py 2>&1 | tee {log}
        """


rule compute_proteomics_correlations:
    """Compute proteomics correlations (CPTAC Tier 4) and mRNA vs protein comparison."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        proteomics=DATA_ROOT / "processed/molecular/proteomics.parquet",
        mrna_correlations=PRECOMPUTED_STATS_DIR / "feature_correlations.parquet",
    output:
        correlations=PRECOMPUTED_STATS_DIR / "proteomics_correlations.parquet",
        comparison=PRECOMPUTED_STATS_DIR / "mrna_vs_protein_comparison.parquet",
    threads: 32
    log:
        "logs/compute_proteomics_correlations.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_proteomics_correlations.py 2>&1 | tee {log}
        """


rule compute_treatment_associations:
    """Compute treatment response associations."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        patient=DATA_ROOT / "processed/molecular/clinical_patient.parquet",
    output:
        treatment=PRECOMPUTED_STATS_DIR / "treatment_associations.parquet",
    threads: 16
    log:
        "logs/compute_treatment_associations.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_treatment_associations.py 2>&1 | tee {log}
        """


rule compute_mutation_survival:
    """Compute gene-centric mutation survival analysis."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        clinical=DATA_ROOT / "processed/molecular/clinical_unified.parquet",
        mutations=DATA_ROOT / "processed/molecular/mutations.parquet",
    output:
        frequency=PRECOMPUTED_STATS_DIR / "mutation_frequency.parquet",
        survival=PRECOMPUTED_STATS_DIR / "mutation_survival.parquet",
        km=PRECOMPUTED_STATS_DIR / "mutation_km.parquet",
        cooccurrence=PRECOMPUTED_STATS_DIR / "mutation_cooccurrence.parquet",
    threads: 16
    log:
        "logs/compute_mutation_survival.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_mutation_survival.py 2>&1 | tee {log}
        """


rule compute_batch_effects:
    """Compute batch effect assessment (TSS effects)."""
    input:
        histomics=PARQUET_DIR / "slide_histomics.parquet",
        sample=DATA_ROOT / "processed/molecular/clinical_sample.parquet",
    output:
        pvca=QC_DIR / "batch_effect_pvca.parquet",
        silhouette=QC_DIR / "batch_effect_silhouette.parquet",
    threads: 2
    log:
        "logs/compute_batch_effects.log"
    shell:
        """
        HISTOATLAS_DATA_ROOT={DATA_ROOT} HISTOATLAS_N_JOBS={threads} uv run python scripts/analyses/compute_batch_effects.py 2>&1 | tee {log}
        """
