#!/usr/bin/env python3
"""
Data Completeness Table for HistoAtlas.

Computes a per-cancer-type summary of data availability:
- n_slides, n_with_expression, n_with_mutations, n_with_clinical
- Percentage missing per histomic feature

This provides a Supplementary Table for the paper showing which cancer
types have matched multi-omic data.

Output:
- data_completeness.parquet
"""

import logging
import warnings
from dataclasses import dataclass

import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    CLINICAL_UNIFIED,
    EXPRESSION,
    MUTATIONS,
    PARQUET_DIR,
    SLIDE_HISTOMICS,
    ensure_dirs,
)

from histoatlas._utils import get_histomic_features

# Suppress FutureWarnings from pandas type inference
warnings.filterwarnings("ignore", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Configuration for data completeness analysis."""

    # Survival endpoint columns to check
    survival_endpoints: tuple[str, ...] = (
        "os_months",
        "pfs_months",
        "dss_months",
        "dfs_months",
    )


def main() -> None:
    """Compute data completeness table."""
    logger.info("=" * 60)
    logger.info("DATA COMPLETENESS ANALYSIS")
    logger.info("=" * 60)

    config = Config()
    ensure_dirs()

    # 1. Load slide-level features
    logger.info("\n1. Loading slide-level features...")
    slides_df = pd.read_parquet(SLIDE_HISTOMICS)
    if "case_id" not in slides_df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")
    histomic_features = get_histomic_features(slides_df)
    logger.info("   Slides: %d, Features: %d", len(slides_df), len(histomic_features))

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_counts = slides_df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(dry_run.n_cancer_types).index.tolist()
        slides_df = slides_df[slides_df["cancer_type"].isin(top_cancers)]
        histomic_features = histomic_features[: dry_run.n_features]
        logger.info("   [DRY-RUN] Subset to %d slides", len(slides_df))

    # 2. Load molecular datasets
    logger.info("\n2. Loading molecular datasets...")

    # Expression
    expr_cases: set[str] = set()
    if EXPRESSION.exists():
        expr_df = pd.read_parquet(EXPRESSION, columns=["case_id"])
        expr_cases = set(expr_df["case_id"].unique())
        logger.info("   Expression cases: %d", len(expr_cases))
    else:
        logger.info("   Expression file not found — skipping")

    # Mutations
    mut_cases: set[str] = set()
    if MUTATIONS.exists():
        mut_df = pd.read_parquet(MUTATIONS)
        # Mutations may have case_id or Tumor_Sample_Barcode
        if "case_id" in mut_df.columns:
            mut_cases = set(mut_df["case_id"].unique())
        elif "Tumor_Sample_Barcode" in mut_df.columns:
            mut_cases = set(mut_df["Tumor_Sample_Barcode"].str[:12].unique())
        logger.info("   Mutation cases: %d", len(mut_cases))
    else:
        logger.info("   Mutations file not found — skipping")

    # Clinical
    clinical_df: pd.DataFrame | None = None
    if CLINICAL_UNIFIED.exists():
        clinical_df = pd.read_parquet(CLINICAL_UNIFIED)
        if "case_id" not in clinical_df.columns and "bcr_patient_barcode" in clinical_df.columns:
            clinical_df["case_id"] = clinical_df["bcr_patient_barcode"]
        logger.info("   Clinical cases: %d", len(clinical_df))
    else:
        logger.info("   Clinical file not found — skipping")

    # 3. Compute per-cancer-type completeness
    logger.info("\n3. Computing per-cancer-type completeness...")
    rows = []

    for cancer_type in sorted(slides_df["cancer_type"].unique()):
        ct_slides = slides_df[slides_df["cancer_type"] == cancer_type]
        ct_cases = set(ct_slides["case_id"].unique())
        n_slides = len(ct_slides)
        n_cases = len(ct_cases)

        # Expression match
        n_with_expression = len(ct_cases & expr_cases)

        # Mutation match
        n_with_mutations = len(ct_cases & mut_cases)

        # Clinical match — per endpoint
        endpoint_availability = {}
        if clinical_df is not None:
            ct_clinical = clinical_df[clinical_df["case_id"].isin(ct_cases)]
            for endpoint_col in config.survival_endpoints:
                if endpoint_col in ct_clinical.columns:
                    n_avail = int(ct_clinical[endpoint_col].notna().sum())
                else:
                    n_avail = 0
                endpoint_availability[f"n_with_{endpoint_col}"] = n_avail
        else:
            for endpoint_col in config.survival_endpoints:
                endpoint_availability[f"n_with_{endpoint_col}"] = 0

        # Feature missingness
        feature_missing = {}
        for feat in histomic_features:
            n_missing = int(ct_slides[feat].isna().sum())
            pct_missing = round(100 * n_missing / n_slides, 2) if n_slides > 0 else 0.0
            feature_missing[f"pct_missing_{feat}"] = pct_missing

        row = {
            "cancer_type": cancer_type,
            "n_slides": n_slides,
            "n_cases": n_cases,
            "n_with_expression": n_with_expression,
            "pct_with_expression": round(100 * n_with_expression / n_cases, 1)
            if n_cases > 0
            else 0,
            "n_with_mutations": n_with_mutations,
            "pct_with_mutations": round(100 * n_with_mutations / n_cases, 1) if n_cases > 0 else 0,
            **endpoint_availability,
            **feature_missing,
        }
        rows.append(row)

    completeness_df = pd.DataFrame(rows)

    # 4. Add totals row
    total_row = {"cancer_type": "ALL"}
    for col in completeness_df.columns:
        if col == "cancer_type":
            continue
        if col.startswith("pct_"):
            # Recompute percentage from totals
            if col == "pct_with_expression":
                n_total_cases = completeness_df["n_cases"].sum()
                n_total_expr = completeness_df["n_with_expression"].sum()
                total_row[col] = (
                    round(100 * n_total_expr / n_total_cases, 1) if n_total_cases > 0 else 0
                )
            elif col == "pct_with_mutations":
                n_total_cases = completeness_df["n_cases"].sum()
                n_total_mut = completeness_df["n_with_mutations"].sum()
                total_row[col] = (
                    round(100 * n_total_mut / n_total_cases, 1) if n_total_cases > 0 else 0
                )
            elif col.startswith("pct_missing_"):
                feat_name = col.removeprefix("pct_missing_")
                if feat_name in slides_df.columns:
                    total_row[col] = round(100 * slides_df[feat_name].isna().mean(), 2)
                else:
                    total_row[col] = 0
            else:
                total_row[col] = completeness_df[col].mean()
        else:
            total_row[col] = int(completeness_df[col].sum())

    completeness_df = pd.concat([completeness_df, pd.DataFrame([total_row])], ignore_index=True)

    # 5. Save
    logger.info("\n4. Saving results...")
    output_path = PARQUET_DIR / "data_completeness.parquet"
    completeness_df.to_parquet(output_path, index=False)
    logger.info("   Saved data_completeness.parquet (%d rows)", len(completeness_df))

    # Log summary
    logger.info("\n   Summary (ALL cancer types):")
    logger.info("   Total slides: %d", total_row.get("n_slides", 0))
    logger.info("   Total cases: %d", total_row.get("n_cases", 0))
    logger.info(
        "   With expression: %d (%.1f%%)",
        total_row.get("n_with_expression", 0),
        total_row.get("pct_with_expression", 0),
    )
    logger.info(
        "   With mutations: %d (%.1f%%)",
        total_row.get("n_with_mutations", 0),
        total_row.get("pct_with_mutations", 0),
    )

    logger.info("\n" + "=" * 60)
    logger.info("DATA COMPLETENESS ANALYSIS COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
