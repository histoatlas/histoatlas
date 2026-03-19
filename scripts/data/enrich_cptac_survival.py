#!/usr/bin/env python3
"""Enrich CPTAC unified clinical data with GDC survival endpoints.

Published CPTAC studies on cBioPortal often lack OS_MONTHS and other survival
time fields. The GDC versions of the same studies have standardized clinical
data including survival. This script:

1. Builds an ID mapping between published and GDC patient IDs
2. Merges GDC survival fields (os_status, os_months) into the unified clinical file
3. Saves the mapping table and enriched clinical data

Prerequisites:
    - cptac_clinical_unified.parquet (from download_cptac_molecular.py)
    - cptac_clinical_gdc.parquet (from download_cptac_gdc_clinical.py)

Usage:
    uv run python scripts/data/enrich_cptac_survival.py
    uv run python scripts/data/enrich_cptac_survival.py --dry-run
"""

import argparse
import logging
from pathlib import Path

import pandas as pd
from _cptac_id_mapping import build_mapping_table

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / "data"
CPTAC_DIR = DATA_DIR / "processed" / "molecular" / "cptac"


def _load_gdc_clinical() -> pd.DataFrame:
    """Load and standardize GDC clinical data.

    The GDC parquet uses ``patientId`` as the ID column; we rename it to
    ``case_id`` for consistency with the unified clinical file.
    """
    path = CPTAC_DIR / "cptac_clinical_gdc.parquet"
    df = pd.read_parquet(path)
    df = df.rename(columns={"patientId": "case_id"})

    # Parse OS_STATUS: "1:DECEASED" → 1, "0:LIVING" → 0
    if "OS_STATUS" in df.columns:
        df["gdc_os_status"] = df["OS_STATUS"].apply(
            lambda x: 1
            if pd.notna(x) and str(x).startswith("1:")
            else (0 if pd.notna(x) and str(x).startswith("0:") else None)
        )
    if "OS_MONTHS" in df.columns:
        df["gdc_os_months"] = pd.to_numeric(df["OS_MONTHS"], errors="coerce")

    return df


def enrich(dry_run: bool = False) -> None:
    """Run the survival enrichment pipeline."""
    # Load data
    unified_path = CPTAC_DIR / "cptac_clinical_unified.parquet"
    unified = pd.read_parquet(unified_path)
    gdc = _load_gdc_clinical()

    logger.info("Unified clinical: %d patients", len(unified))
    logger.info("GDC clinical: %d patients", len(gdc))

    # Build ID mapping
    mapping = build_mapping_table(unified, gdc)
    matched = mapping[mapping["match_method"] != "unmatched"]
    unmatched = mapping[mapping["match_method"] == "unmatched"]

    logger.info("ID mapping: %d matched, %d unmatched", len(matched), len(unmatched))
    for cancer in sorted(mapping["cancer_type"].unique()):
        ct_map = mapping[mapping["cancer_type"] == cancer]
        ct_matched = ct_map[ct_map["match_method"] != "unmatched"]
        methods = ct_matched["match_method"].value_counts().to_dict()
        logger.info(
            "  %s: %d/%d matched %s",
            cancer,
            len(ct_matched),
            len(ct_map),
            methods,
        )
    if len(unmatched) > 0:
        logger.info("Unmatched IDs: %s", unmatched["case_id"].tolist())

    # Build GDC lookup: gdc_patient_id → survival fields
    gdc_lookup = gdc.set_index("case_id")[
        [c for c in ["gdc_os_status", "gdc_os_months"] if c in gdc.columns]
    ].to_dict("index")

    # Create case_id → gdc_patient_id lookup from mapping
    id_lookup = dict(zip(matched["case_id"], matched["gdc_patient_id"]))

    # Count pre-merge survival coverage
    pre_os_months = unified["os_months"].notna().sum() if "os_months" in unified.columns else 0
    pre_os_status = unified["os_status"].notna().sum() if "os_status" in unified.columns else 0

    # Merge survival fields
    if "os_status" not in unified.columns:
        unified["os_status"] = None
    if "os_months" not in unified.columns:
        unified["os_months"] = None

    filled_status = 0
    filled_months = 0
    for idx, row in unified.iterrows():
        gdc_pid = id_lookup.get(row["case_id"])
        if not gdc_pid:
            continue
        gdc_data = gdc_lookup.get(gdc_pid, {})

        if pd.isna(row["os_status"]) and "gdc_os_status" in gdc_data:
            val = gdc_data["gdc_os_status"]
            if pd.notna(val):
                unified.at[idx, "os_status"] = val
                filled_status += 1

        if pd.isna(row["os_months"]) and "gdc_os_months" in gdc_data:
            val = gdc_data["gdc_os_months"]
            if pd.notna(val):
                unified.at[idx, "os_months"] = val
                filled_months += 1

    post_os_months = unified["os_months"].notna().sum()
    post_os_status = unified["os_status"].notna().sum()

    logger.info("Survival enrichment results:")
    logger.info("  os_status: %d → %d (+%d)", pre_os_status, post_os_status, filled_status)
    logger.info("  os_months: %d → %d (+%d)", pre_os_months, post_os_months, filled_months)

    # Per-cancer breakdown
    for cancer in sorted(unified["cancer_type"].unique()):
        ct = unified[unified["cancer_type"] == cancer]
        n_status = ct["os_status"].notna().sum()
        n_months = ct["os_months"].notna().sum()
        logger.info(
            "  %s: %d/%d status, %d/%d months", cancer, n_status, len(ct), n_months, len(ct)
        )

    if dry_run:
        logger.info("Dry run — no files written.")
        return

    # Save mapping
    mapping_path = CPTAC_DIR / "cptac_id_mapping.parquet"
    mapping.to_parquet(mapping_path, index=False)
    logger.info("Saved ID mapping: %s", mapping_path)

    # Back up original
    backup_path = CPTAC_DIR / "cptac_clinical_unified_pre_gdc.parquet"
    pd.read_parquet(unified_path).to_parquet(backup_path, index=False)
    logger.info("Backed up original: %s", backup_path)

    # Overwrite enriched
    unified.to_parquet(unified_path, index=False)
    logger.info("Saved enriched clinical: %s", unified_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich CPTAC clinical data with GDC survival")
    parser.add_argument("--dry-run", action="store_true", help="Print stats without writing files")
    args = parser.parse_args()
    enrich(dry_run=args.dry_run)
