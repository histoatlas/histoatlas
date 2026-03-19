#!/usr/bin/env python3
"""
Generate Polish Artifacts for HistoAtlas.

This script generates low-priority but important metadata and documentation:
1. Provenance metadata (model IDs, versions)
2. Data QC report (missingness, winsorization)
3. Reproducibility artifacts (manifest, checksums)
4. Canonical slides table with schema alignment
"""

import hashlib
import json
import logging
import warnings
from datetime import datetime
from pathlib import Path

import pandas as pd
from _paths import (
    CATEGORICAL_ASSOCIATIONS,
    FEATURE_CORRELATIONS,
    JSON_DIR,
    PARQUET_DIR,
    SIMILAR_SLIDES,
    SLIDE_HISTOMICS,
    SLIDES,
    SURVIVAL_ASSOCIATIONS,
    TREATMENT_ASSOCIATIONS,
    ensure_dirs,
)

from histoatlas._utils import get_histomic_features

# Suppress FutureWarnings from pandas/pyarrow type coercion
warnings.filterwarnings("ignore", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def compute_file_checksum(filepath: Path, algorithm: str = "sha256") -> str:
    """Compute checksum for a file."""
    h = hashlib.new(algorithm)
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    logger.info("=" * 60)
    logger.info("GENERATING POLISH ARTIFACTS")
    logger.info("=" * 60)

    # Create output directories
    ensure_dirs()
    OUTPUT_DIR = JSON_DIR
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PARQUET_DIR.mkdir(parents=True, exist_ok=True)

    # -------------------------------------------------------------------------
    # D1: Histomics Provenance
    # -------------------------------------------------------------------------
    logger.info("\n1. Generating provenance metadata...")

    provenance = {
        "version": "1.0.0",
        "created_at": datetime.now().isoformat(),
        "histomics_pipeline": {
            "cell_segmentation_model": {
                "model_id": "hovernet",
                "description": "HoVer-Net cell segmentation and classification",
                "checkpoint": "not_tracked",
            },
            "tissue_segmentation_model": {
                "model_id": "deeplabv3",
                "description": "DeepLabV3 tissue segmentation",
                "checkpoint": "not_tracked",
            },
            "feature_extraction": {
                "version": "1.0.0",
                "code_repo": "histoatlas",
            },
        },
        "tcga_data": {
            "source": "TCGA via cBioPortal/GDC",
            "cancer_types": 26,
            "slides_total": 9028,
        },
        "analysis_pipeline": {
            "version": "1.0.0",
            "python_version": "3.12",
            "key_dependencies": [
                "pandas>=2.0",
                "numpy>=1.24",
                "scikit-learn>=1.3",
                "lifelines>=0.27",
                "umap-learn>=0.5",
            ],
        },
        "notes": "Provenance tracking is incomplete for v1. Future versions will include full model checkpoints and code versions.",
    }

    provenance_path = OUTPUT_DIR / "provenance.json"
    with open(provenance_path, "w") as f:
        json.dump(provenance, f, indent=2)
    logger.info(f"   Saved {provenance_path}")

    # -------------------------------------------------------------------------
    # D2: Data QC Report
    # -------------------------------------------------------------------------
    logger.info("\n2. Generating data QC report...")

    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    histomic_features = get_histomic_features(slides_df)

    # Compute missingness matrix (cancer × feature)
    missingness = {}
    for cancer_type in slides_df["cancer_type"].unique():
        cancer_df = slides_df[slides_df["cancer_type"] == cancer_type]
        missing_pct = {}
        for feature in histomic_features:
            n_missing = cancer_df[feature].isna().sum()
            missing_pct[feature] = float(n_missing / len(cancer_df))
        missingness[cancer_type] = missing_pct

    # Compute feature statistics for winsorization documentation
    feature_stats = {}
    for feature in histomic_features:
        values = slides_df[feature].dropna()
        if len(values) > 0:
            feature_stats[feature] = {
                "n_valid": int(len(values)),
                "n_missing": int(slides_df[feature].isna().sum()),
                "missing_pct": float(slides_df[feature].isna().mean()),
                "min": float(values.min()),
                "max": float(values.max()),
                "mean": float(values.mean()),
                "std": float(values.std()),
                "p01": float(values.quantile(0.01)),
                "p99": float(values.quantile(0.99)),
            }

    qc_report = {
        "version": "1.0.0",
        "generated_at": datetime.now().isoformat(),
        "slides": {
            "total": len(slides_df),
            "cancer_types": int(slides_df["cancer_type"].nunique()),
        },
        "features": {
            "total": len(histomic_features),
            "statistics": feature_stats,
        },
        "missingness_by_cancer": missingness,
        "preprocessing": {
            "winsorization": {
                "method": "clip at percentiles",
                "lower_percentile": 1,
                "upper_percentile": 99,
                "note": "Values outside p1-p99 clipped to percentile values",
            },
            "standardization": {
                "method": "z-score",
                "scope": "within cancer type",
                "note": "Features standardized separately within each cancer type",
            },
        },
    }

    qc_report_path = OUTPUT_DIR / "data_qc_report.json"
    with open(qc_report_path, "w") as f:
        json.dump(qc_report, f, indent=2)
    logger.info(f"   Saved {qc_report_path}")

    # -------------------------------------------------------------------------
    # D3: Reproducibility Artifacts
    # -------------------------------------------------------------------------
    logger.info("\n3. Generating reproducibility artifacts...")

    # Generate checksums for key data files

    data_files = {
        "slide_histomics.parquet": SLIDE_HISTOMICS,
        "survival_associations.parquet": SURVIVAL_ASSOCIATIONS,
        "feature_correlations.parquet": FEATURE_CORRELATIONS,
        "categorical_associations.parquet": CATEGORICAL_ASSOCIATIONS,
        "treatment_associations.parquet": TREATMENT_ASSOCIATIONS,
        "similar_slides.parquet": SIMILAR_SLIDES,
    }

    file_checksums = {}
    for filename, filepath in data_files.items():
        if filepath.exists():
            checksum = compute_file_checksum(filepath)
            file_checksums[filename] = {
                "sha256": checksum,
                "size_bytes": filepath.stat().st_size,
                "modified": datetime.fromtimestamp(filepath.stat().st_mtime).isoformat(),
            }

    manifest = {
        "version": "1.0.0",
        "generated_at": datetime.now().isoformat(),
        "data_files": file_checksums,
        "analysis_scripts": [
            "scripts/analyses/compute_similar_slides.py",
            "scripts/analyses/compute_filter_artifacts.py",
            "scripts/analyses/compute_batch_effects.py",
            "scripts/analyses/compute_qc_flags.py",
            "scripts/analyses/compute_representative_tiles.py",
            "scripts/analyses/export_frontend_json.py",
        ],
        "notes": "Use checksums to verify data integrity",
    }

    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    logger.info(f"   Saved {manifest_path}")

    # Generate run metadata template
    run_metadata = {
        "version": "1.0.0",
        "run_id": datetime.now().strftime("%Y%m%d_%H%M%S"),
        "started_at": datetime.now().isoformat(),
        "completed_at": datetime.now().isoformat(),
        "environment": {
            "python_version": "3.12",
            "platform": "darwin",
            "hostname": "localhost",
        },
        "inputs": {
            "slide_features": "data/slide_level_features_with_embeddings.parquet",
            "molecular_data": "data/processed/molecular/",
        },
        "outputs": {
            "frontend_json": "data/frontend/",
            "analysis_outputs": "data/",
        },
        "parameters": {
            "n_neighbors": 10,
            "n_quantile_bins": 32,
            "qc_z_threshold": 5.0,
        },
    }

    run_metadata_path = OUTPUT_DIR / "run_metadata.json"
    with open(run_metadata_path, "w") as f:
        json.dump(run_metadata, f, indent=2)
    logger.info(f"   Saved {run_metadata_path}")

    # -------------------------------------------------------------------------
    # D4: Canonical Slides Table
    # -------------------------------------------------------------------------
    logger.info("\n4. Creating canonical slides table with PLAN.md schema...")

    # Create slides table with canonical schema
    slides_canonical = slides_df.copy()

    # Rename columns to canonical names if needed
    if "umap_1" in slides_canonical.columns:
        slides_canonical = slides_canonical.rename(columns={"umap_1": "umap_x", "umap_2": "umap_y"})

    # Ensure case_id exists
    if "case_id" not in slides_canonical.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")

    # Select columns in canonical order
    meta_cols = [
        "slide_name",
        "case_id",
        "cancer_type",
        "umap_x",
        "umap_y",
        "cluster_l1",
        "cluster_l2",
    ]

    # Add QC columns if they exist
    qc_cols = [
        "qc_pass",
        "tile_extraction_coverage_ok",
        "extreme_feature_outlier",
        "high_missingness",
        "n_tiles",
    ]
    for col in qc_cols:
        if col in slides_canonical.columns:
            meta_cols.append(col)

    # Add histomic features
    feature_cols = [c for c in histomic_features if c in slides_canonical.columns]

    # Combine columns
    final_cols = meta_cols + feature_cols
    slides_canonical = slides_canonical[[c for c in final_cols if c in slides_canonical.columns]]

    # Save canonical table
    slides_canonical.to_parquet(SLIDES, index=False)
    logger.info(
        f"   Saved slides.parquet ({len(slides_canonical)} rows, {len(slides_canonical.columns)} columns)"
    )

    # Generate schema file
    schema = {
        "version": "1.0.0",
        "table": "slides",
        "description": "Canonical slide-level feature table for HistoAtlas",
        "columns": {},
    }

    for col in slides_canonical.columns:
        dtype = str(slides_canonical[col].dtype)
        schema["columns"][col] = {
            "dtype": dtype,
            "description": _get_column_description(col),
            "nullable": bool(slides_canonical[col].isna().any()),
        }

    schema_path = OUTPUT_DIR / "slides_schema.json"
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    logger.info(f"   Saved {schema_path}")

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    logger.info("\n" + "=" * 60)
    logger.info("POLISH ARTIFACTS COMPLETE")
    logger.info("=" * 60)

    logger.info("\nGenerated files:")
    logger.info("  - provenance.json - Pipeline and model provenance")
    logger.info("  - data_qc_report.json - Missingness and preprocessing documentation")
    logger.info("  - manifest.json - File checksums for reproducibility")
    logger.info("  - run_metadata.json - Run parameters and environment")
    logger.info("  - slides.parquet - Canonical slides table")
    logger.info("  - slides_schema.json - Table schema documentation")


def _get_column_description(col: str) -> str:
    """Get description for column."""
    descriptions = {
        "slide_name": "Unique slide identifier (TCGA barcode)",
        "case_id": "Patient case identifier (first 12 chars of slide_name)",
        "cancer_type": "TCGA cancer type abbreviation",
        "umap_x": "UMAP embedding X coordinate",
        "umap_y": "UMAP embedding Y coordinate",
        "cluster_l1": "Pan-cancer L1 cluster assignment",
        "cluster_l2": "Cancer-specific L2 cluster assignment",
        "qc_pass": "Composite QC pass flag",
        "tile_extraction_coverage_ok": "Adequate tile coverage",
        "extreme_feature_outlier": "Has extreme outlier features",
        "high_missingness": "High feature missingness",
        "n_tiles": "Number of tiles extracted",
    }
    return descriptions.get(col, f"Histomic feature: {col}")


if __name__ == "__main__":
    main()
