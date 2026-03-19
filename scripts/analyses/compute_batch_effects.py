#!/usr/bin/env python3
"""
Compute Batch Effect Assessment for HistoAtlas.

This script computes batch effect metrics to assess whether tissue source site (TSS)
introduces confounding in the histomic features.

Output files:
- batch_effect_summary.json - Overall batch effect assessment
- batch_effect_pvca.parquet - PVCA results (pan-cancer and per-cancer)
- batch_effect_silhouette.parquet - Silhouette scores by TSS
"""

import json
import logging
import warnings

import matplotlib
from _config import get_dry_run_settings
from sklearn.preprocessing import StandardScaler
from umap import UMAP

matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from _paths import (
    BATCH_EFFECT_PVCA,
    BATCH_EFFECT_SILHOUETTE,
    CLINICAL_SAMPLE,
    FIGURES_DIR,
    JSON_DIR,
    QC_DIR,
    SLIDE_HISTOMICS,
    ensure_dirs,
)

from histoatlas._utils import get_histomic_features
from histoatlas.analysis.batch_effects import (
    compute_batch_effect_summary,
    compute_per_cancer_batch_effects,
)

# Suppress FutureWarnings from sklearn/UMAP and RuntimeWarnings from silhouette edge cases
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*divide by zero.*")
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*overflow.*")
warnings.filterwarnings("ignore", category=UserWarning, message=".*n_jobs.*")

logger = logging.getLogger(__name__)


def _write_empty_outputs() -> None:
    """Write empty-but-schema-correct output files when no batch proxy is available."""
    ensure_dirs()
    QC_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)

    # Empty PVCA — schema must match the production path (lines 331-354)
    pvca_cols = [
        "scope",
        "cancer_type",
        "n_samples",
        "batch_variance_proportion",
        "biological_variance_proportion",
        "residual_variance_proportion",
        "n_pcs_used",
    ]
    pd.DataFrame(columns=pvca_cols).to_parquet(BATCH_EFFECT_PVCA, index=False)
    logger.info("   Saved empty %s", BATCH_EFFECT_PVCA.name)

    # Empty silhouette — schema must match the production path (lines 361-382)
    sil_cols = [
        "scope",
        "cancer_type",
        "n_samples",
        "n_tss",
        "silhouette_score",
        "silhouette_interpretation",
    ]
    pd.DataFrame(columns=sil_cols).to_parquet(BATCH_EFFECT_SILHOUETTE, index=False)
    logger.info("   Saved empty %s", BATCH_EFFECT_SILHOUETTE.name)

    # Empty summary JSON
    summary_path = JSON_DIR / "batch_effect_summary.json"
    with open(summary_path, "w") as f:
        json.dump({"status": "skipped", "reason": "no_batch_proxy"}, f)
    logger.info("   Saved empty %s", summary_path.name)


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    logger.info("=" * 60)
    logger.info("BATCH EFFECT ASSESSMENT")
    logger.info("=" * 60)

    # Create output directories
    ensure_dirs()
    OUTPUT_DIR = JSON_DIR
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    QC_DIR.mkdir(parents=True, exist_ok=True)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    # -------------------------------------------------------------------------
    # Load data
    # -------------------------------------------------------------------------
    logger.info("1. Loading data...")

    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    if "case_id" not in slides_df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")

    logger.info(f"   Loaded {len(slides_df)} slides")

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        if len(slides_df) > dry_run.max_samples:
            slides_df = slides_df.sample(n=dry_run.max_samples, random_state=42)
            logger.info(f"   [DRY-RUN] Subset to {len(slides_df)} slides")

    # Get histomic features
    histomic_features = get_histomic_features(slides_df)
    logger.info(f"   Histomic features: {len(histomic_features)}")

    # Load batch proxy information
    from _config import get_batch_proxy_column

    batch_col = get_batch_proxy_column()

    if batch_col and batch_col in slides_df.columns:
        # Batch proxy already in slides data
        slides_df["tss"] = slides_df[batch_col]
        n_with_tss = slides_df["tss"].notna().sum()
        logger.info(
            f"   Batch proxy '{batch_col}' from slides: {n_with_tss} "
            f"({n_with_tss / len(slides_df) * 100:.1f}%)"
        )
        logger.info(f"   Unique batch sites: {slides_df['tss'].nunique()}")
    elif CLINICAL_SAMPLE.exists():
        sample_df = pd.read_parquet(CLINICAL_SAMPLE)

        # Get TSS column — prefer explicit batch_col if set, else search common names
        tss_col = None
        if batch_col and batch_col in sample_df.columns:
            tss_col = batch_col
        else:
            for col in ["TISSUE_SOURCE_SITE_CODE", "TISSUE_SOURCE_SITE", "tss"]:
                if col in sample_df.columns:
                    tss_col = col
                    break

        if tss_col:
            # Merge TSS into slides data
            tss_df = sample_df[["case_id", tss_col]].drop_duplicates("case_id")
            tss_df = tss_df.rename(columns={tss_col: "tss"})
            slides_df = slides_df.merge(tss_df, on="case_id", how="left")
            n_with_tss = slides_df["tss"].notna().sum()
            logger.info(
                f"   Slides with TSS: {n_with_tss} ({n_with_tss / len(slides_df) * 100:.1f}%)"
            )
            logger.info(f"   Unique TSS sites: {slides_df['tss'].nunique()}")
        else:
            logger.warning("   No batch proxy column found — writing empty outputs")
            _write_empty_outputs()
            return
    else:
        logger.warning("   No batch proxy available — writing empty outputs")
        _write_empty_outputs()
        return

    # -------------------------------------------------------------------------
    # Pan-cancer batch effect assessment
    # -------------------------------------------------------------------------
    logger.info("2. Computing pan-cancer batch effects...")

    # Filter to slides with TSS
    analysis_df = slides_df[slides_df["tss"].notna()].copy()
    logger.info(f"   Analysis set: {len(analysis_df)} slides")

    # Compute comprehensive summary
    summary = compute_batch_effect_summary(
        analysis_df,
        histomic_features,
        batch_col="tss",
        biological_col="cancer_type",
    )

    logger.info("   PVCA Results:")
    pvca = summary.get("pvca", {})
    logger.info(f"      Batch (TSS) variance: {pvca.get('batch_variance_proportion', 0):.1%}")
    logger.info(
        f"      Biological (cancer type) variance: {pvca.get('biological_variance_proportion', 0):.1%}"
    )
    logger.info(f"      Residual variance: {pvca.get('residual_variance_proportion', 0):.1%}")

    logger.info("   Silhouette Results (TSS as clusters):")
    sil = summary.get("silhouette", {})
    logger.info(f"      Silhouette score: {sil.get('silhouette_score', 0):.3f}")
    logger.info(f"      Interpretation: {sil.get('silhouette_interpretation', 'N/A')}")

    logger.info(f"   Overall Assessment: {summary.get('overall_assessment', 'N/A')}")
    logger.info(f"   Recommendation: {summary.get('recommendation', 'N/A')}")

    # -------------------------------------------------------------------------
    # Per-cancer batch effect assessment
    # -------------------------------------------------------------------------
    logger.info("3. Computing per-cancer batch effects...")

    per_cancer_df = compute_per_cancer_batch_effects(
        analysis_df,
        histomic_features,
        batch_col="tss",
        min_samples=50,
    )

    logger.info(f"   Computed for {len(per_cancer_df)} cancer types")

    if len(per_cancer_df) > 0:
        # Show cancers with highest batch effects
        per_cancer_sorted = per_cancer_df.sort_values("pvca_batch_variance", ascending=False)
        logger.info("   Cancer types with highest batch effects:")
        for _, row in per_cancer_sorted.head(5).iterrows():
            logger.info(
                f"      {row['cancer_type']}: "
                f"PVCA={row['pvca_batch_variance']:.1%}, "
                f"Silhouette={row['silhouette_score']:.3f}"
            )

    # -------------------------------------------------------------------------
    # Generate UMAP colored by TSS
    # -------------------------------------------------------------------------
    logger.info("4. Generating UMAP visualization by TSS...")

    # Use existing UMAP coordinates if available
    if "umap_1" in analysis_df.columns and "umap_2" in analysis_df.columns:
        umap_coords = analysis_df[["umap_1", "umap_2"]].values
        logger.info("   Using existing UMAP coordinates")
    else:
        # Compute new UMAP for batch visualization
        logger.info("   Computing UMAP from features...")
        features = analysis_df[histomic_features].values

        # Handle NaN
        for i in range(features.shape[1]):
            col = features[:, i]
            nan_mask = np.isnan(col)
            if nan_mask.any():
                features[nan_mask, i] = np.nanmedian(col)

        # Standardize

        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)

        # UMAP
        reducer = UMAP(n_components=2, n_neighbors=30, min_dist=0.1, random_state=42)
        umap_coords = reducer.fit_transform(features_scaled)

    # Create figure
    fig, axes = plt.subplots(1, 2, figsize=(16, 7))

    # Plot 1: UMAP colored by TSS
    ax1 = axes[0]
    tss_values = analysis_df["tss"].values
    unique_tss = np.unique(tss_values[pd.notna(tss_values)])

    # Use a colormap for TSS (many categories)
    colors = plt.cm.tab20(np.linspace(0, 1, min(20, len(unique_tss))))
    tss_to_color = {tss: colors[i % 20] for i, tss in enumerate(unique_tss)}

    for tss in unique_tss[:20]:  # Limit to 20 most common TSS for legend
        mask = tss_values == tss
        ax1.scatter(
            umap_coords[mask, 0],
            umap_coords[mask, 1],
            c=[tss_to_color[tss]],
            s=3,
            alpha=0.5,
            label=tss if sum(mask) > 50 else None,
        )

    ax1.set_xlabel("UMAP 1")
    ax1.set_ylabel("UMAP 2")
    ax1.set_title("UMAP colored by Tissue Source Site (TSS)")
    handles, labels = ax1.get_legend_handles_labels()
    if labels:
        ax1.legend(loc="upper right", fontsize=6, ncol=2)

    # Plot 2: UMAP colored by cancer type (for comparison)
    ax2 = axes[1]
    cancer_types = analysis_df["cancer_type"].values
    unique_cancers = np.unique(cancer_types)

    colors = plt.cm.tab20(np.linspace(0, 1, min(20, len(unique_cancers))))
    cancer_to_color = {ct: colors[i % 20] for i, ct in enumerate(unique_cancers)}

    for ct in unique_cancers:
        mask = cancer_types == ct
        ax2.scatter(
            umap_coords[mask, 0],
            umap_coords[mask, 1],
            c=[cancer_to_color[ct]],
            s=3,
            alpha=0.5,
            label=ct,
        )

    ax2.set_xlabel("UMAP 1")
    ax2.set_ylabel("UMAP 2")
    ax2.set_title("UMAP colored by Cancer Type")
    ax2.legend(loc="upper right", fontsize=6, ncol=2)

    plt.tight_layout()
    fig_path = FIGURES_DIR / "umap_by_tss.png"
    plt.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close()
    logger.info(f"   Saved figure: {fig_path}")

    # -------------------------------------------------------------------------
    # Save results
    # -------------------------------------------------------------------------
    logger.info("5. Saving results...")

    # Save summary JSON
    summary_path = OUTPUT_DIR / "batch_effect_summary.json"
    with open(summary_path, "w") as f:
        # Convert numpy types to Python types for JSON serialization
        summary_clean = _convert_numpy_types(summary)
        json.dump(summary_clean, f, indent=2)
    logger.info(f"   Saved {summary_path}")

    # Save PVCA results
    pvca_results = [
        {
            "scope": "pan_cancer",
            "cancer_type": "ALL",
            "n_samples": summary.get("n_slides"),
            "batch_variance_proportion": pvca.get("batch_variance_proportion"),
            "biological_variance_proportion": pvca.get("biological_variance_proportion"),
            "residual_variance_proportion": pvca.get("residual_variance_proportion"),
            "n_pcs_used": pvca.get("n_pcs_used"),
        }
    ]

    for _, row in per_cancer_df.iterrows():
        pvca_results.append(
            {
                "scope": "per_cancer",
                "cancer_type": row["cancer_type"],
                "n_samples": row["n_samples"],
                "batch_variance_proportion": row["pvca_batch_variance"],
                "biological_variance_proportion": None,
                "residual_variance_proportion": row["pvca_residual_variance"],
                "n_pcs_used": None,
            }
        )

    pvca_df = pd.DataFrame(pvca_results)
    pvca_df.to_parquet(BATCH_EFFECT_PVCA, index=False)
    logger.info(f"   Saved {BATCH_EFFECT_PVCA.name} ({len(pvca_df)} rows)")

    # Save silhouette results
    silhouette_results = [
        {
            "scope": "pan_cancer",
            "cancer_type": "ALL",
            "n_samples": summary.get("n_slides"),
            "n_tss": sil.get("n_batches"),
            "silhouette_score": sil.get("silhouette_score"),
            "silhouette_interpretation": sil.get("silhouette_interpretation"),
        }
    ]

    for _, row in per_cancer_df.iterrows():
        silhouette_results.append(
            {
                "scope": "per_cancer",
                "cancer_type": row["cancer_type"],
                "n_samples": row["n_samples"],
                "n_tss": row["n_tss"],
                "silhouette_score": row["silhouette_score"],
                "silhouette_interpretation": row["silhouette_interpretation"],
            }
        )

    silhouette_df = pd.DataFrame(silhouette_results)
    silhouette_df.to_parquet(BATCH_EFFECT_SILHOUETTE, index=False)
    logger.info(f"   Saved {BATCH_EFFECT_SILHOUETTE.name} ({len(silhouette_df)} rows)")

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("BATCH EFFECT ASSESSMENT COMPLETE")
    logger.info("=" * 60)

    logger.info("Key findings:")
    batch_var = pvca.get("batch_variance_proportion", 0)
    bio_var = pvca.get("biological_variance_proportion", 0)
    sil_score = sil.get("silhouette_score", 0)

    logger.info(f"   TSS explains {batch_var:.1%} of variance (vs {bio_var:.1%} for cancer type)")
    logger.info(f"   Silhouette score by TSS: {sil_score:.3f}")

    if batch_var < bio_var:
        logger.info("   Cancer type dominates TSS effects - good sign")
    else:
        logger.info(
            "   TSS effects comparable to/exceeding cancer type - consider batch correction"
        )

    logger.info("Output files:")
    logger.info("  - batch_effect_summary.json")
    logger.info("  - batch_effect_pvca.parquet")
    logger.info("  - batch_effect_silhouette.parquet")
    logger.info("  - figures/umap_by_tss.png")


def _convert_numpy_types(obj):
    """Convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_numpy_types(v) for v in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif pd.isna(obj):
        return None
    else:
        return obj


if __name__ == "__main__":
    main()
