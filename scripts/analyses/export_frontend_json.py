#!/usr/bin/env python3
"""
Export Frontend JSON Files for HistoAtlas.

This script exports pre-computed data in JSON format optimized for frontend consumption.

Output files:
1. atlas_coordinates.json - UMAP coordinates for all slides
2. clusters.json - Cluster metadata and enrichments
3. feature_metadata.json - Feature descriptions, units, etc.
4. cancer_types.json - Cancer type list with colors
5. similar_slides.json - KNN index from parquet
6. filter_summaries.json - Per-feature min/max/quantiles for filter UI
"""

import json
import logging
import warnings

import pandas as pd
from _paths import CLUSTER_ANALYSES_DIR, DATA_DIR, L2_UMAP_COORDINATES, PRECOMPUTED_STATS_DIR

from histoatlas import (
    export_atlas_coordinates,
    export_cancer_types,
    export_clusters,
    export_enrichment_summaries,
    export_feature_metadata,
    export_filter_summaries,
    export_similar_slides,
    export_treatment_associations,
)

# Suppress FutureWarnings from pandas/pyarrow type coercion
warnings.filterwarnings("ignore", category=FutureWarning)

logger = logging.getLogger(__name__)


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    from _paths import (
        JSON_DIR,
        SLIDE_HISTOMICS,
        ensure_dirs,
    )

    logger.info("=" * 60)
    logger.info("EXPORTING FRONTEND JSON FILES")
    logger.info("=" * 60)

    # Create output directory
    ensure_dirs()
    OUTPUT_DIR = JSON_DIR
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"\nOutput directory: {OUTPUT_DIR}")

    # -------------------------------------------------------------------------
    # Load data
    # -------------------------------------------------------------------------
    logger.info("\n1. Loading data...")

    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    if "case_id" not in slides_df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")
    logger.info(f"   Loaded {len(slides_df)} slides")

    # -------------------------------------------------------------------------
    # Export files
    # -------------------------------------------------------------------------
    logger.info("\n2. Exporting JSON files...")

    logger.info("   Exporting atlas_coordinates.json...")
    l2_umap_df = None
    if L2_UMAP_COORDINATES.exists():
        l2_umap_df = pd.read_parquet(L2_UMAP_COORDINATES)
        logger.info(f"   Loaded L2 UMAP coordinates: {len(l2_umap_df)} slides")
    export_atlas_coordinates(slides_df, OUTPUT_DIR, l2_umap_df=l2_umap_df)

    logger.info("   Exporting clusters.json...")
    from _paths import L1_CLUSTER_METADATA, L2_CLUSTER_NAMES

    export_clusters(
        slides_df,
        OUTPUT_DIR,
        metadata_path=L1_CLUSTER_METADATA if L1_CLUSTER_METADATA.exists() else None,
        l2_names_path=L2_CLUSTER_NAMES if L2_CLUSTER_NAMES.exists() else None,
    )

    logger.info("   Exporting feature_metadata.json...")
    export_feature_metadata(slides_df, OUTPUT_DIR)

    logger.info("   Exporting cancer_types.json...")
    export_cancer_types(slides_df, OUTPUT_DIR)

    logger.info("   Exporting similar_slides.json...")

    export_similar_slides(PRECOMPUTED_STATS_DIR, OUTPUT_DIR)

    logger.info("   Exporting filter_summaries.json...")
    export_filter_summaries(slides_df, OUTPUT_DIR)

    logger.info("   Exporting enrichment_summaries.json...")
    export_enrichment_summaries(CLUSTER_ANALYSES_DIR, OUTPUT_DIR)

    logger.info("   Exporting treatment_associations.json...")
    export_treatment_associations(PRECOMPUTED_STATS_DIR, OUTPUT_DIR)

    logger.info("   Exporting frontend_data.json...")

    frontend_metadata = {
        "version": "1.0.0",
        "data_root": str(DATA_DIR),
        "dry_run": "dry_run" in str(DATA_DIR),
        "n_slides": len(slides_df),
    }
    with open(OUTPUT_DIR / "frontend_data.json", "w") as f:
        json.dump(frontend_metadata, f, indent=2)

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    logger.info("\n" + "=" * 60)
    logger.info("FRONTEND EXPORT COMPLETE")
    logger.info("=" * 60)

    logger.info("\nOutput files:")
    for f in sorted(OUTPUT_DIR.glob("*.json")):
        size_kb = f.stat().st_size / 1024
        logger.info(f"  - {f.name} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
