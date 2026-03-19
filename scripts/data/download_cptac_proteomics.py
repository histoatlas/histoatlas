#!/usr/bin/env python3
"""
Download CPTAC global proteomics (TMT protein quantification) from cBioPortal.

Downloads protein abundance data for all CPTAC studies that have proteomics
profiles available. Uses the same cBioPortal REST API as download_cptac_molecular.py.

Output:
    data/processed/molecular/cptac/cptac_proteomics.parquet
        Wide format: case_id, cancer_type, + protein columns (Hugo gene symbols)
    data/processed/molecular/cptac/proteomics_metadata.json

Usage:
    uv run python scripts/data/download_cptac_proteomics.py
"""

import json
import logging
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from _cptac_studies import CPTAC_STUDIES, CPTACStudy
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / "data"
OUTPUT_DIR = DATA_DIR / "processed" / "molecular" / "cptac"

CBIOPORTAL_API = "https://www.cbioportal.org/api"
REQUEST_TIMEOUT = 120
RATE_LIMIT_DELAY = 0.3


# ---------------------------------------------------------------------------
# Helpers (mirrored from download_cptac_molecular.py)
# ---------------------------------------------------------------------------


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


def _api_post(path: str, payload: dict | list) -> list | dict:
    """POST request to cBioPortal API with retry."""
    url = f"{CBIOPORTAL_API}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    for attempt in range(3):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, json.JSONDecodeError) as e:
            if attempt == 2:
                logger.warning("POST %s failed after 3 attempts: %s", path, e)
                return []
            time.sleep(2**attempt)
    return []


def _get_sample_ids(study_id: str, tumor_only: bool = False) -> list[str]:
    """Get sample IDs for a study."""
    data = _api_get(f"/studies/{study_id}/samples")
    if not isinstance(data, list):
        return []
    sample_ids = [s["sampleId"] for s in data]
    if tumor_only:
        tumor_ids = [s for s in sample_ids if s.rsplit("-", 1)[-1].startswith("0")]
        if tumor_ids:
            logger.info(
                "  Filtered %d → %d tumor samples (excluded %d normals)",
                len(sample_ids),
                len(tumor_ids),
                len(sample_ids) - len(tumor_ids),
            )
            return tumor_ids
    return sample_ids


def _batch_resolve_entrez(entrez_ids: list[int], batch_size: int = 500) -> dict[int, str]:
    """Resolve Entrez gene IDs to Hugo symbols in batches."""
    result = {}
    for i in range(0, len(entrez_ids), batch_size):
        batch = entrez_ids[i : i + batch_size]
        payload = [str(eid) for eid in batch]
        data = _api_post("/genes/fetch", payload)
        if isinstance(data, list):
            for gene in data:
                result[gene["entrezGeneId"]] = gene["hugoGeneSymbol"]
        time.sleep(RATE_LIMIT_DELAY)
    return result


# ---------------------------------------------------------------------------
# Proteomics download
# ---------------------------------------------------------------------------


def _fetch_proteomics(profile_id: str, sample_ids: list[str], batch_size: int = 50) -> pd.DataFrame:
    """Fetch proteomics data for all proteins (no entrez filter)."""
    all_data = []
    for i in tqdm(range(0, len(sample_ids), batch_size), desc=f"  {profile_id}", leave=False):
        batch = sample_ids[i : i + batch_size]
        payload = {"sampleIds": batch}
        data = _api_post(f"/molecular-profiles/{profile_id}/molecular-data/fetch", payload)
        if isinstance(data, list):
            all_data.extend(data)
        time.sleep(RATE_LIMIT_DELAY)
    return pd.DataFrame(all_data) if all_data else pd.DataFrame()


def download_proteomics(studies: list[CPTACStudy]) -> None:
    """Download global proteomics data for all CPTAC studies with proteomics profiles."""
    output_path = OUTPUT_DIR / "cptac_proteomics.parquet"
    if output_path.exists():
        logger.info("Proteomics data already exists: %s", output_path)
        return

    proteomics_studies = [s for s in studies if s.proteomics_profile]
    if not proteomics_studies:
        logger.error("No studies have proteomics profiles configured!")
        return

    logger.info(
        "Downloading proteomics for %d studies: %s",
        len(proteomics_studies),
        ", ".join(s.cancer_type for s in proteomics_studies),
    )

    all_data = []

    for study in tqdm(proteomics_studies, desc="Proteomics"):
        sample_ids = _get_sample_ids(study.study_id, tumor_only=study.is_gdc_only)
        if not sample_ids:
            logger.warning("  %s: no samples found", study.cancer_type)
            continue

        profile_id = study.proteomics_profile
        logger.info(
            "Fetching proteomics for %s from %s (%d samples)...",
            study.cancer_type,
            profile_id,
            len(sample_ids),
        )

        prot_df = _fetch_proteomics(profile_id, sample_ids)

        if not prot_df.empty:
            prot_df["cancer_type"] = study.cancer_type
            all_data.append(prot_df)
            n_proteins = prot_df["entrezGeneId"].nunique()
            logger.info(
                "  %s: %d samples × %d proteins", study.cancer_type, len(sample_ids), n_proteins
            )
        else:
            logger.warning("  %s: no proteomics data from %s", study.cancer_type, profile_id)

    if not all_data:
        logger.error("No proteomics data downloaded!")
        return

    combined = pd.concat(all_data, ignore_index=True)

    # Resolve gene symbols
    logger.info(
        "Resolving gene symbols for %d unique Entrez IDs...",
        combined["entrezGeneId"].nunique(),
    )
    entrez_to_symbol = _batch_resolve_entrez(combined["entrezGeneId"].unique().tolist())
    combined["gene"] = combined["entrezGeneId"].map(entrez_to_symbol)
    combined = combined.dropna(subset=["gene"])

    # Pivot to wide format (samples × proteins)
    logger.info("Pivoting to wide format...")
    pivot_df = combined.pivot_table(
        index=["sampleId", "patientId"], columns="gene", values="value", aggfunc="first"
    ).reset_index()

    pivot_df["case_id"] = pivot_df["patientId"]

    # Add cancer type
    cancer_map = combined.groupby("sampleId")["cancer_type"].first().to_dict()
    pivot_df["cancer_type"] = pivot_df["sampleId"].map(cancer_map)

    # Reorder columns
    meta_cols = ["sampleId", "patientId", "case_id", "cancer_type"]
    protein_cols = sorted([c for c in pivot_df.columns if c not in meta_cols])
    pivot_df = pivot_df[meta_cols + protein_cols]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pivot_df.to_parquet(output_path, index=False)
    logger.info(
        "Saved proteomics: %s (%d samples × %d proteins)",
        output_path,
        len(pivot_df),
        len(protein_cols),
    )

    # Save metadata
    samples_per_cancer = pivot_df.groupby("cancer_type")["case_id"].nunique().to_dict()
    with open(OUTPUT_DIR / "proteomics_metadata.json", "w") as f:
        json.dump(
            {
                "download_date": datetime.now().isoformat(),
                "source": "cBioPortal API (CPTAC protein_quantification profiles)",
                "n_proteins": len(protein_cols),
                "n_samples": len(pivot_df),
                "samples_per_cancer_type": samples_per_cancer,
                "studies": [s.study_id for s in proteomics_studies],
                "profiles": [s.proteomics_profile for s in proteomics_studies],
            },
            f,
            indent=2,
        )
    logger.info("Saved proteomics_metadata.json")


def main() -> None:
    """Run the CPTAC proteomics download."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("CPTAC Proteomics Data Download")
    logger.info("=" * 60)
    logger.info("Date: %s", datetime.now().isoformat())

    download_proteomics(CPTAC_STUDIES)

    logger.info("\nDownload complete!")


if __name__ == "__main__":
    main()
