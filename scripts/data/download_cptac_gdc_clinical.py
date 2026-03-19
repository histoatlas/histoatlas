#!/usr/bin/env python3
"""Download clinical data from GDC CPTAC studies on cBioPortal.

GDC studies have standardized clinical/survival data (OS_STATUS, OS_MONTHS,
VITAL_STATUS, etc.) that published CPTAC studies often lack. This script
downloads patient-level clinical data from each GDC study and saves it as a
single parquet file for use by ``enrich_cptac_survival.py``.

Usage:
    uv run python scripts/data/download_cptac_gdc_clinical.py
"""

import json
import logging
import time
from pathlib import Path

import pandas as pd
import requests
from _cptac_studies import CPTAC_STUDIES
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / "data"
OUTPUT_DIR = DATA_DIR / "processed" / "molecular" / "cptac"

CBIOPORTAL_API = "https://www.cbioportal.org/api"
REQUEST_TIMEOUT = 120
RATE_LIMIT_DELAY = 0.3


def _api_get(path: str, params: dict | None = None) -> list | dict:
    """GET request to cBioPortal API with retry."""
    url = f"{CBIOPORTAL_API}{path}"
    for attempt in range(3):
        try:
            resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, json.JSONDecodeError) as e:
            if attempt == 2:
                logger.warning("GET %s failed after 3 attempts: %s", path, e)
                return []
            time.sleep(2**attempt)
    return []


def download_gdc_clinical() -> None:
    """Download patient-level clinical data from all GDC CPTAC studies."""
    output_path = OUTPUT_DIR / "cptac_clinical_gdc.parquet"

    # Collect unique GDC study IDs
    gdc_studies = []
    for study in CPTAC_STUDIES:
        if study.gdc_study_id:
            gdc_studies.append((study.gdc_study_id, study.cancer_type))

    all_clinical = []

    for gdc_study_id, cancer_type in tqdm(gdc_studies, desc="GDC clinical"):
        data = _api_get(f"/studies/{gdc_study_id}/clinical-data", {"clinicalDataType": "PATIENT"})
        if not isinstance(data, list) or len(data) == 0:
            logger.warning("No GDC clinical data for %s (%s)", cancer_type, gdc_study_id)
            continue

        df = pd.DataFrame(data)
        pivot = df.pivot_table(
            index="patientId",
            columns="clinicalAttributeId",
            values="value",
            aggfunc="first",
        ).reset_index()
        pivot["cancer_type"] = cancer_type
        pivot["gdc_study_id"] = gdc_study_id
        all_clinical.append(pivot)
        logger.info("  %s: %d patients from %s", cancer_type, len(pivot), gdc_study_id)
        time.sleep(RATE_LIMIT_DELAY)

    if not all_clinical:
        logger.error("No GDC clinical data downloaded!")
        return

    combined = pd.concat(all_clinical, ignore_index=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    combined.to_parquet(output_path, index=False)
    logger.info(
        "Saved GDC clinical: %s (%d patients across %d cancer types)",
        output_path,
        len(combined),
        combined["cancer_type"].nunique(),
    )

    # Summary
    for ct in sorted(combined["cancer_type"].unique()):
        ct_df = combined[combined["cancer_type"] == ct]
        os_status = ct_df["OS_STATUS"].notna().sum() if "OS_STATUS" in ct_df.columns else 0
        os_months = ct_df["OS_MONTHS"].notna().sum() if "OS_MONTHS" in ct_df.columns else 0
        logger.info(
            "  %s: %d patients, %d os_status, %d os_months", ct, len(ct_df), os_status, os_months
        )


if __name__ == "__main__":
    download_gdc_clinical()
