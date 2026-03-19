#!/usr/bin/env python3
"""
Download CPTAC molecular data from cBioPortal.

Downloads and processes the following data types for all CPTAC studies:
  1. Clinical data (patient demographics, survival endpoints)
  2. Curated gene expression (same ~130 gene panel as TCGA)
  3. Full gene expression (all genes, for ssGSEA pathway scoring)
  4. Mutations (gene-level binary matrix, like TCGA MC3)
  5. Copy Number Variation (GISTIC discrete, where available)

Data sources:
  - Published CPTAC studies on cBioPortal (molecular profiles)
  - GDC CPTAC studies on cBioPortal (standardized clinical/survival data)

Output directory: data/processed/molecular/cptac/
Output files mirror the TCGA naming convention with cptac_ prefix.

Usage:
    uv run python scripts/data/download_cptac_molecular.py
    uv run python scripts/data/download_cptac_molecular.py --step clinical
    uv run python scripts/data/download_cptac_molecular.py --step expression
    uv run python scripts/data/download_cptac_molecular.py --step mutations
    uv run python scripts/data/download_cptac_molecular.py --step cnv
    uv run python scripts/data/download_cptac_molecular.py --step expression-full
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
RATE_LIMIT_DELAY = 0.3  # seconds between API calls

# Same curated gene panel as TCGA (from download_expression_curated.py)
CURATED_GENES = [
    # Cancer drivers
    "TP53",
    "KRAS",
    "BRAF",
    "EGFR",
    "PIK3CA",
    "APC",
    "PTEN",
    "RB1",
    "CDKN2A",
    "ATM",
    "BRCA1",
    "BRCA2",
    "MYC",
    "ERBB2",
    "MET",
    "ALK",
    "NRAS",
    "HRAS",
    "STK11",
    "NF1",
    "NF2",
    "VHL",
    "SMAD4",
    "ARID1A",
    "CTNNB1",
    "CDH1",
    "NOTCH1",
    "FBXW7",
    "IDH1",
    "IDH2",
    "FGFR1",
    "FGFR2",
    "FGFR3",
    "RET",
    "KIT",
    "PDGFRA",
    "JAK2",
    "AKT1",
    "MTOR",
    "NFE2L2",
    "KEAP1",
    "SETD2",
    "BAP1",
    "SMARCA4",
    "TERT",
    # Immune markers
    "CD3D",
    "CD3E",
    "CD4",
    "CD8A",
    "CD8B",
    "FOXP3",
    "CD19",
    "MS4A1",
    "CD79A",
    "CD68",
    "CD163",
    "CD14",
    "ITGAM",
    "NKG7",
    "GZMA",
    "GZMB",
    "PRF1",
    "IFNG",
    "TNF",
    "IL2",
    "IL6",
    "IL10",
    "TGFB1",
    "CXCL9",
    "CXCL10",
    "PDCD1",
    "CD274",
    "PDCD1LG2",
    "CTLA4",
    "LAG3",
    "HAVCR2",
    "TIGIT",
    "IDO1",
    "CD40",
    "CD80",
    "CD86",
    # Proliferation
    "MKI67",
    "PCNA",
    "TOP2A",
    "MCM2",
    "CDK1",
    "CDK2",
    "CDK4",
    "CDK6",
    "CCND1",
    "CCNE1",
    "CCNB1",
    "E2F1",
    "PLK1",
    "AURKA",
    # EMT
    "CDH2",
    "VIM",
    "SNAI1",
    "SNAI2",
    "TWIST1",
    "ZEB1",
    "ZEB2",
    "FN1",
    "ACTA2",
    # Apoptosis/survival
    "BCL2",
    "BAX",
    "BCL2L1",
    "MCL1",
    "BIRC5",
    "CASP3",
    "CASP8",
    "FAS",
    # DNA repair
    "CHEK1",
    "CHEK2",
    "RAD51",
    "PARP1",
    "MLH1",
    "MSH2",
    "MSH6",
    "MGMT",
    # Hypoxia
    "HIF1A",
    "VEGFA",
    "SLC2A1",
    "LDHA",
    "CA9",
    # Hormone receptors
    "ESR1",
    "PGR",
    "AR",
    # Stem cell
    "CD44",
    "PROM1",
    "ALDH1A1",
    "NANOG",
    "SOX2",
]


# ---------------------------------------------------------------------------
# Helpers
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


def _api_post(path: str, payload: dict) -> list | dict:
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
    """Get sample IDs for a study.

    Args:
        study_id: cBioPortal study ID.
        tumor_only: If True, filter to tumor samples only. GDC studies include
            both tumor (suffix -01/-02/-04) and normal (suffix -11/-12/-14)
            samples. Published studies have one sample per patient and are
            unaffected by this filter.
    """
    data = _api_get(f"/studies/{study_id}/samples")
    if not isinstance(data, list):
        return []
    sample_ids = [s["sampleId"] for s in data]
    if tumor_only:
        # Tumor samples have a suffix starting with 0 (e.g., -01, -02, -04)
        # Normal samples have a suffix starting with 1 (e.g., -11, -12, -14)
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


def _get_patient_ids(study_id: str) -> list[str]:
    """Get all patient IDs for a study."""
    data = _api_get(f"/studies/{study_id}/patients")
    if isinstance(data, list):
        return [p["patientId"] for p in data]
    return []


# ---------------------------------------------------------------------------
# 1. Clinical data
# ---------------------------------------------------------------------------


def download_clinical(studies: list[CPTACStudy]) -> None:
    """Download and unify clinical data from published + GDC studies."""
    output_path = OUTPUT_DIR / "cptac_clinical_unified.parquet"
    if output_path.exists():
        logger.info("Clinical data already exists: %s", output_path)
        return

    all_clinical = []

    for study in tqdm(studies, desc="Clinical data"):
        cancer_type = study.cancer_type

        # Try published study first
        pub_clinical = _download_study_clinical(study.study_id, cancer_type)

        # Also try GDC study for survival data
        gdc_clinical = None
        if study.gdc_study_id:
            gdc_clinical = _download_study_clinical(study.gdc_study_id, cancer_type)

        # Merge: use published as base, supplement survival from GDC
        if pub_clinical is not None and not pub_clinical.empty:
            merged = pub_clinical.copy()
            if gdc_clinical is not None and not gdc_clinical.empty:
                merged = _supplement_survival(merged, gdc_clinical)
            all_clinical.append(merged)
        elif gdc_clinical is not None and not gdc_clinical.empty:
            all_clinical.append(gdc_clinical)
        else:
            logger.warning("No clinical data for %s", cancer_type)

        time.sleep(RATE_LIMIT_DELAY)

    if not all_clinical:
        logger.error("No clinical data downloaded!")
        return

    unified = pd.concat(all_clinical, ignore_index=True)
    unified = _standardize_clinical(unified)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    unified.to_parquet(output_path, index=False)
    logger.info(
        "Saved clinical data: %s (%d cases, %d columns)",
        output_path,
        len(unified),
        len(unified.columns),
    )

    # Also save raw patient and sample clinical separately
    _save_raw_clinical(studies)


def _download_study_clinical(study_id: str, cancer_type: str) -> pd.DataFrame | None:
    """Download patient-level clinical data for a single study."""
    data = _api_get(f"/studies/{study_id}/clinical-data", {"clinicalDataType": "PATIENT"})
    if not isinstance(data, list) or len(data) == 0:
        return None

    df = pd.DataFrame(data)
    # Pivot to wide format
    pivot = df.pivot_table(
        index="patientId", columns="clinicalAttributeId", values="value", aggfunc="first"
    ).reset_index()
    pivot["cancer_type"] = cancer_type
    pivot["source_study"] = study_id
    return pivot


def _supplement_survival(pub_df: pd.DataFrame, gdc_df: pd.DataFrame) -> pd.DataFrame:
    """Add survival columns from GDC where published study lacks them.

    Note: This performs a basic same-ID merge at download time. For full
    cross-study ID mapping and survival enrichment, see
    ``enrich_cptac_survival.py`` which maps published IDs to GDC patient IDs
    and merges survival data post-download.
    """
    survival_cols = ["OS_STATUS", "OS_MONTHS", "DAYS_TO_DEATH", "VITAL_STATUS"]
    existing_survival = [
        c for c in survival_cols if c in pub_df.columns and pub_df[c].notna().any()
    ]

    if "OS_MONTHS" in existing_survival:
        return pub_df  # Already has survival data

    # GDC has different patient IDs, so we can't merge directly
    # Just note that survival is available from GDC
    for col in survival_cols:
        if col in gdc_df.columns and col not in pub_df.columns:
            pub_df[f"gdc_{col.lower()}"] = None  # Placeholder
    return pub_df


def _standardize_clinical(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize clinical columns to match TCGA pipeline format."""
    # Map common column names
    col_map = {
        "patientId": "case_id",
        "AGE": "age_at_diagnosis",
        "SEX": "sex",
        "RACE": "race",
        "ETHNICITY": "ethnicity",
        "OS_STATUS": "os_status",
        "OS_MONTHS": "os_months",
        "PFS_STATUS": "pfs_status",
        "PFS_MONTHS": "pfs_months",
        "DFS_STATUS": "dfs_status",
        "DFS_MONTHS": "dfs_months",
        "DSS_STATUS": "dss_status",
        "DSS_MONTHS": "dss_months",
        "VITAL_STATUS": "vital_status",
        "DAYS_TO_DEATH": "days_to_death",
        "DAYS_TO_BIRTH": "days_to_birth",
        "STAGE": "stage",
        "TUMOR_STAGE-PATHOLOGICAL": "stage",
        "FIGO_STAGE": "stage",
    }

    result = pd.DataFrame()
    for old_col, new_col in col_map.items():
        if old_col in df.columns and new_col not in result.columns:
            result[new_col] = df[old_col]

    # Always keep cancer_type
    if "cancer_type" in df.columns:
        result["cancer_type"] = df["cancer_type"]

    # Convert numeric columns
    for col in [
        "age_at_diagnosis",
        "os_months",
        "pfs_months",
        "dfs_months",
        "dss_months",
        "days_to_death",
    ]:
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors="coerce")

    # Convert OS status: "1:DECEASED" -> 1, "0:LIVING" -> 0
    for col in ["os_status", "pfs_status", "dfs_status", "dss_status"]:
        if col in result.columns:
            result[col] = result[col].apply(
                lambda x: 1
                if pd.notna(x) and str(x).startswith("1:")
                else (0 if pd.notna(x) and str(x).startswith("0:") else None)
            )

    # Derive OS months from DAYS_TO_DEATH if not directly available
    if "os_months" not in result.columns or result["os_months"].isna().all():
        if "days_to_death" in result.columns:
            result["os_months"] = result["days_to_death"] / 30.44
            logger.info("Derived os_months from days_to_death")

    # Derive OS status from vital_status if not available
    if "os_status" not in result.columns or result["os_status"].isna().all():
        if "vital_status" in result.columns:
            result["os_status"] = result["vital_status"].apply(
                lambda x: 1
                if pd.notna(x) and str(x).lower() in ("dead", "deceased")
                else (0 if pd.notna(x) and str(x).lower() in ("alive", "living") else None)
            )
            logger.info("Derived os_status from vital_status")

    return result


def _save_raw_clinical(studies: list[CPTACStudy]) -> None:
    """Save raw patient + sample clinical data as separate files."""
    all_patient = []
    all_sample = []

    for study in studies:
        # Patient clinical
        data = _api_get(f"/studies/{study.study_id}/clinical-data", {"clinicalDataType": "PATIENT"})
        if isinstance(data, list) and data:
            df = pd.DataFrame(data)
            df["cancer_type"] = study.cancer_type
            all_patient.append(df)

        # Sample clinical
        data = _api_get(f"/studies/{study.study_id}/clinical-data", {"clinicalDataType": "SAMPLE"})
        if isinstance(data, list) and data:
            df = pd.DataFrame(data)
            df["cancer_type"] = study.cancer_type
            all_sample.append(df)

        time.sleep(RATE_LIMIT_DELAY)

    if all_patient:
        combined = pd.concat(all_patient, ignore_index=True)
        pivot = combined.pivot_table(
            index=["patientId", "studyId"],
            columns="clinicalAttributeId",
            values="value",
            aggfunc="first",
        ).reset_index()
        cancer_map = combined.groupby("patientId")["cancer_type"].first().to_dict()
        pivot["cancer_type"] = pivot["patientId"].map(cancer_map)
        pivot["case_id"] = pivot["patientId"]
        path = OUTPUT_DIR / "cptac_clinical_patient.parquet"
        pivot.to_parquet(path, index=False)
        logger.info("Saved raw patient clinical: %s", path)

    if all_sample:
        combined = pd.concat(all_sample, ignore_index=True)
        pivot = combined.pivot_table(
            index=["sampleId", "patientId", "studyId"],
            columns="clinicalAttributeId",
            values="value",
            aggfunc="first",
        ).reset_index()
        cancer_map = combined.groupby("sampleId")["cancer_type"].first().to_dict()
        pivot["cancer_type"] = pivot["sampleId"].map(cancer_map)
        pivot["case_id"] = pivot["patientId"]
        path = OUTPUT_DIR / "cptac_clinical_sample.parquet"
        pivot.to_parquet(path, index=False)
        logger.info("Saved raw sample clinical: %s", path)


# ---------------------------------------------------------------------------
# 2. Expression (curated gene panel)
# ---------------------------------------------------------------------------


def download_expression_curated(studies: list[CPTACStudy]) -> None:
    """Download expression data for the curated gene panel."""
    output_path = OUTPUT_DIR / "cptac_expression_curated.parquet"
    if output_path.exists():
        logger.info("Curated expression already exists: %s", output_path)
        return

    # Resolve entrez IDs for curated genes
    gene_map = _resolve_gene_ids(CURATED_GENES)
    entrez_ids = list(gene_map.keys())
    logger.info("Resolved %d / %d curated genes to Entrez IDs", len(entrez_ids), len(CURATED_GENES))

    all_data = []

    for study in tqdm(studies, desc="Expression (curated)"):
        sample_ids = _get_sample_ids(study.study_id, tumor_only=study.is_gdc_only)
        if not sample_ids:
            logger.warning("No samples for %s", study.study_id)
            continue

        profile_id = study.expression_profile
        exp_df = _fetch_expression_batch(profile_id, sample_ids, entrez_ids)

        if not exp_df.empty:
            exp_df["cancer_type"] = study.cancer_type
            # Map entrez IDs to gene symbols
            exp_df["gene"] = exp_df["entrezGeneId"].map(gene_map)
            all_data.append(exp_df)
            logger.info(
                "  %s: %d samples, %d entries", study.cancer_type, len(sample_ids), len(exp_df)
            )
        else:
            logger.warning(
                "  %s: no expression data from profile %s", study.cancer_type, profile_id
            )

    if not all_data:
        logger.error("No expression data downloaded!")
        return

    combined = pd.concat(all_data, ignore_index=True)

    # Pivot to wide format (samples × genes)
    pivot_df = combined.pivot_table(
        index=["sampleId", "patientId"], columns="gene", values="value", aggfunc="first"
    ).reset_index()

    pivot_df["case_id"] = pivot_df["patientId"]

    # Add cancer type
    cancer_map = combined.groupby("sampleId")["cancer_type"].first().to_dict()
    pivot_df["cancer_type"] = pivot_df["sampleId"].map(cancer_map)

    # Reorder columns
    meta_cols = ["sampleId", "patientId", "case_id", "cancer_type"]
    gene_cols = sorted([c for c in pivot_df.columns if c not in meta_cols])
    pivot_df = pivot_df[meta_cols + gene_cols]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pivot_df.to_parquet(output_path, index=False)
    logger.info(
        "Saved curated expression: %s (%d samples × %d genes)",
        output_path,
        len(pivot_df),
        len(gene_cols),
    )

    # Metadata
    with open(OUTPUT_DIR / "expression_metadata.json", "w") as f:
        json.dump(
            {
                "download_date": datetime.now().isoformat(),
                "source": "cBioPortal API (CPTAC studies)",
                "genes": gene_cols,
                "n_genes": len(gene_cols),
                "n_samples": len(pivot_df),
                "studies": [s.study_id for s in studies],
            },
            f,
            indent=2,
        )


def _resolve_gene_ids(gene_symbols: list[str]) -> dict[int, str]:
    """Resolve Hugo gene symbols to Entrez IDs via cBioPortal."""
    gene_map = {}
    for gene in gene_symbols:
        data = _api_get(f"/genes/{gene}")
        if isinstance(data, dict) and "entrezGeneId" in data:
            gene_map[data["entrezGeneId"]] = data["hugoGeneSymbol"]
        time.sleep(0.05)
    return gene_map


def _fetch_expression_batch(
    profile_id: str, sample_ids: list[str], entrez_ids: list[int], batch_size: int = 100
) -> pd.DataFrame:
    """Fetch expression data in batches."""
    all_data = []
    for i in range(0, len(sample_ids), batch_size):
        batch = sample_ids[i : i + batch_size]
        payload = {"sampleIds": batch, "entrezGeneIds": entrez_ids}
        data = _api_post(f"/molecular-profiles/{profile_id}/molecular-data/fetch", payload)
        if isinstance(data, list):
            all_data.extend(data)
        time.sleep(RATE_LIMIT_DELAY)
    return pd.DataFrame(all_data) if all_data else pd.DataFrame()


# ---------------------------------------------------------------------------
# 3. Expression (full — all genes, for ssGSEA)
# ---------------------------------------------------------------------------


def download_expression_full(studies: list[CPTACStudy]) -> None:
    """Download full gene expression matrix for all genes (for ssGSEA pathway scoring)."""
    output_path = OUTPUT_DIR / "cptac_expression_full.parquet"
    if output_path.exists():
        logger.info("Full expression already exists: %s", output_path)
        return

    all_data = []

    for study in tqdm(studies, desc="Expression (full)"):
        sample_ids = _get_sample_ids(study.study_id, tumor_only=study.is_gdc_only)
        if not sample_ids:
            continue

        profile_id = study.expression_profile
        logger.info(
            "Fetching full expression for %s (%d samples)...", study.cancer_type, len(sample_ids)
        )

        # Fetch without entrez filter to get all genes
        exp_df = _fetch_expression_all_genes(profile_id, sample_ids)

        if not exp_df.empty:
            exp_df["cancer_type"] = study.cancer_type
            all_data.append(exp_df)
            n_genes = exp_df["entrezGeneId"].nunique()
            logger.info("  %s: %d samples × %d genes", study.cancer_type, len(sample_ids), n_genes)
        else:
            logger.warning("  %s: no full expression data", study.cancer_type)

    if not all_data:
        logger.error("No full expression data downloaded!")
        return

    combined = pd.concat(all_data, ignore_index=True)

    # We need gene symbols — fetch them
    logger.info(
        "Resolving gene symbols for %d unique Entrez IDs...", combined["entrezGeneId"].nunique()
    )
    entrez_to_symbol = _batch_resolve_entrez(combined["entrezGeneId"].unique().tolist())
    combined["gene"] = combined["entrezGeneId"].map(entrez_to_symbol)
    combined = combined.dropna(subset=["gene"])

    # Pivot
    logger.info("Pivoting to wide format...")
    pivot_df = combined.pivot_table(
        index=["sampleId", "patientId"], columns="gene", values="value", aggfunc="first"
    ).reset_index()

    pivot_df["case_id"] = pivot_df["patientId"]
    cancer_map = combined.groupby("sampleId")["cancer_type"].first().to_dict()
    pivot_df["cancer_type"] = pivot_df["sampleId"].map(cancer_map)

    meta_cols = ["sampleId", "patientId", "case_id", "cancer_type"]
    gene_cols = sorted([c for c in pivot_df.columns if c not in meta_cols])
    pivot_df = pivot_df[meta_cols + gene_cols]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pivot_df.to_parquet(output_path, index=False)
    logger.info(
        "Saved full expression: %s (%d samples × %d genes)",
        output_path,
        len(pivot_df),
        len(gene_cols),
    )


def _fetch_expression_all_genes(
    profile_id: str, sample_ids: list[str], batch_size: int = 50
) -> pd.DataFrame:
    """Fetch expression data for ALL genes (no entrez filter)."""
    all_data = []
    for i in tqdm(range(0, len(sample_ids), batch_size), desc=f"  {profile_id}", leave=False):
        batch = sample_ids[i : i + batch_size]
        payload = {"sampleIds": batch}
        data = _api_post(f"/molecular-profiles/{profile_id}/molecular-data/fetch", payload)
        if isinstance(data, list):
            all_data.extend(data)
        time.sleep(RATE_LIMIT_DELAY)
    return pd.DataFrame(all_data) if all_data else pd.DataFrame()


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
# 4. Mutations (gene-level binary matrix)
# ---------------------------------------------------------------------------


def download_mutations(studies: list[CPTACStudy]) -> None:
    """Download mutation data and convert to gene-level binary matrix."""
    output_path = OUTPUT_DIR / "cptac_mutations.parquet"
    if output_path.exists():
        logger.info("Mutation data already exists: %s", output_path)
        return

    all_mutations = []

    for study in tqdm(studies, desc="Mutations"):
        sample_ids = _get_sample_ids(study.study_id, tumor_only=study.is_gdc_only)
        if not sample_ids:
            continue

        profile_id = study.mutation_profile
        logger.info("Fetching mutations for %s (%d samples)...", study.cancer_type, len(sample_ids))

        mutations = _fetch_mutations(profile_id, sample_ids)
        if mutations:
            # Convert to per-sample gene-level binary
            sample_genes: dict[str, set[str]] = {}
            for m in mutations:
                sid = m.get("sampleId", "")
                gene = m.get("gene", {})
                symbol = gene.get("hugoGeneSymbol") if isinstance(gene, dict) else None
                if sid and symbol:
                    sample_genes.setdefault(sid, set()).add(symbol)

            logger.info(
                "  %s: %d samples, %d unique genes mutated",
                study.cancer_type,
                len(sample_genes),
                len(set().union(*sample_genes.values())),
            )

            for sid, genes in sample_genes.items():
                row = {"sample_id": sid, "cancer_type": study.cancer_type}
                for g in genes:
                    row[g] = 1
                all_mutations.append(row)

            # Also record samples with 0 mutations
            for sid in sample_ids:
                if sid not in sample_genes:
                    all_mutations.append({"sample_id": sid, "cancer_type": study.cancer_type})
        else:
            logger.warning("  %s: no mutation data", study.cancer_type)

    if not all_mutations:
        logger.error("No mutation data downloaded!")
        return

    df = pd.DataFrame(all_mutations).fillna(0)

    # Extract case_id from sample_id
    df["case_id"] = df["sample_id"]  # CPTAC IDs are already case-level

    # Ensure gene columns are int
    gene_cols = [c for c in df.columns if c not in {"sample_id", "case_id", "cancer_type"}]
    for col in gene_cols:
        df[col] = df[col].astype(int)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False)
    logger.info("Saved mutations: %s (%d samples × %d genes)", output_path, len(df), len(gene_cols))


def _fetch_mutations(profile_id: str, sample_ids: list[str], batch_size: int = 200) -> list[dict]:
    """Fetch mutation data with DETAILED projection (includes gene symbols)."""
    all_data = []
    for i in range(0, len(sample_ids), batch_size):
        batch = sample_ids[i : i + batch_size]
        url = f"/molecular-profiles/{profile_id}/mutations/fetch"
        payload = {"sampleIds": batch}
        # Need DETAILED projection for gene.hugoGeneSymbol
        full_url = f"{CBIOPORTAL_API}{url}?projection=DETAILED"
        headers = {"Content-Type": "application/json", "Accept": "application/json"}

        for attempt in range(3):
            try:
                resp = requests.post(
                    full_url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT
                )
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, list):
                    all_data.extend(data)
                break
            except (requests.RequestException, json.JSONDecodeError) as e:
                if attempt == 2:
                    logger.warning("Mutation fetch failed for %s: %s", profile_id, e)
                time.sleep(2**attempt)

        time.sleep(RATE_LIMIT_DELAY)
    return all_data


# ---------------------------------------------------------------------------
# 5. Copy Number Variation (GISTIC discrete)
# ---------------------------------------------------------------------------


def download_cnv(studies: list[CPTACStudy]) -> None:
    """Download GISTIC discrete CNV data."""
    output_path = OUTPUT_DIR / "cptac_cnv.parquet"
    if output_path.exists():
        logger.info("CNV data already exists: %s", output_path)
        return

    all_data = []

    for study in tqdm(studies, desc="CNV (GISTIC)"):
        # Use published GISTIC if available, otherwise GDC CNA
        cnv_profile = study.cnv_profile or study.gdc_cnv_profile
        using_gdc_source = not study.cnv_profile
        source_study = study.study_id if study.cnv_profile else study.gdc_study_id

        if not cnv_profile or not source_study:
            logger.warning("  %s: no GISTIC CNV available", study.cancer_type)
            continue

        # Filter to tumor samples when pulling from a GDC study (which
        # includes both tumor and normal samples)
        sample_ids = _get_sample_ids(source_study, tumor_only=study.is_gdc_only or using_gdc_source)
        if not sample_ids:
            continue

        logger.info(
            "Fetching CNV for %s from %s (%d samples)...",
            study.cancer_type,
            cnv_profile,
            len(sample_ids),
        )

        cnv_df = _fetch_cnv(cnv_profile, sample_ids)

        if not cnv_df.empty:
            cnv_df["cancer_type"] = study.cancer_type
            all_data.append(cnv_df)
            n_genes = cnv_df["entrezGeneId"].nunique()
            logger.info("  %s: %d samples × %d genes", study.cancer_type, len(sample_ids), n_genes)
        else:
            logger.warning("  %s: no CNV data from %s", study.cancer_type, cnv_profile)

    if not all_data:
        logger.error("No CNV data downloaded!")
        return

    combined = pd.concat(all_data, ignore_index=True)

    # Resolve gene symbols if needed
    if "gene" not in combined.columns and "entrezGeneId" in combined.columns:
        entrez_to_symbol = _batch_resolve_entrez(combined["entrezGeneId"].unique().tolist())
        combined["gene"] = combined["entrezGeneId"].map(entrez_to_symbol)
        combined = combined.dropna(subset=["gene"])

    # Pivot to wide format
    pivot_df = combined.pivot_table(
        index="sampleId", columns="gene", values="value", aggfunc="first"
    ).reset_index()

    pivot_df.rename(columns={"sampleId": "sample_id"}, inplace=True)
    pivot_df["case_id"] = pivot_df["sample_id"]  # CPTAC IDs are already case-level

    # Add cancer type
    cancer_map = combined.groupby("sampleId")["cancer_type"].first().to_dict()
    pivot_df["cancer_type"] = pivot_df["sample_id"].map(cancer_map)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pivot_df.to_parquet(output_path, index=False)
    gene_cols = [c for c in pivot_df.columns if c not in {"sample_id", "case_id", "cancer_type"}]
    logger.info("Saved CNV: %s (%d samples × %d genes)", output_path, len(pivot_df), len(gene_cols))


def _fetch_cnv(profile_id: str, sample_ids: list[str], batch_size: int = 50) -> pd.DataFrame:
    """Fetch discrete CNV data."""
    all_data = []
    for i in range(0, len(sample_ids), batch_size):
        batch = sample_ids[i : i + batch_size]
        payload = {"sampleIds": batch}
        data = _api_post(f"/molecular-profiles/{profile_id}/molecular-data/fetch", payload)
        if isinstance(data, list):
            all_data.extend(data)
        time.sleep(RATE_LIMIT_DELAY)
    return pd.DataFrame(all_data) if all_data else pd.DataFrame()


# ---------------------------------------------------------------------------
# Summary & metadata
# ---------------------------------------------------------------------------


def create_summary(studies: list[CPTACStudy]) -> None:
    """Create summary statistics for downloaded data."""
    summary = {"download_date": datetime.now().isoformat(), "source": "cBioPortal API"}
    data_types = {
        "clinical": ("cptac_clinical_unified.parquet", ["case_id", "cancer_type"]),
        "expression_curated": (
            "cptac_expression_curated.parquet",
            ["sampleId", "patientId", "case_id", "cancer_type"],
        ),
        "expression_full": (
            "cptac_expression_full.parquet",
            ["sampleId", "patientId", "case_id", "cancer_type"],
        ),
        "mutations": ("cptac_mutations.parquet", ["sample_id", "case_id", "cancer_type"]),
        "cnv": ("cptac_cnv.parquet", ["sample_id", "case_id", "cancer_type"]),
    }

    logger.info("\n" + "=" * 60)
    logger.info("CPTAC Data Summary")
    logger.info("=" * 60)

    for name, (filename, meta_cols) in data_types.items():
        path = OUTPUT_DIR / filename
        if path.exists():
            df = pd.read_parquet(path)
            n_data_cols = len([c for c in df.columns if c not in meta_cols])
            id_col = "case_id" if "case_id" in df.columns else df.columns[0]
            summary[name] = {
                "samples": len(df),
                "cases": df[id_col].nunique() if id_col in df.columns else len(df),
                "data_columns": n_data_cols,
                "cancer_types": sorted(df["cancer_type"].unique().tolist())
                if "cancer_type" in df.columns
                else [],
            }
            logger.info("  %s: %d samples, %d data columns", name, len(df), n_data_cols)
        else:
            logger.info("  %s: NOT DOWNLOADED", name)

    with open(OUTPUT_DIR / "data_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    # Document what's missing
    missing = {
        "immune_subtypes": "Thorsson et al. 2018 immune subtypes are TCGA-specific. No equivalent classification exists for CPTAC.",
        "pfs_endpoints": "Most CPTAC studies only report OS (overall survival). PFS, DSS, DFS are not available for most cancer types.",
        "pan_cancer_mc3_mutations": "CPTAC has no MC3-equivalent pan-cancer mutation matrix. Mutations are aggregated per-study.",
    }
    with open(OUTPUT_DIR / "MISSING_DATA.json", "w") as f:
        json.dump(missing, f, indent=2)
    logger.info("\nMissing data documented in MISSING_DATA.json")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(step: str | None = None) -> None:
    """Run the CPTAC data download pipeline."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("CPTAC Molecular Data Download")
    logger.info("=" * 60)
    logger.info("Date: %s", datetime.now().isoformat())
    logger.info("Studies: %s", ", ".join(s.cancer_type for s in CPTAC_STUDIES))
    logger.info("Output: %s", OUTPUT_DIR)

    steps = {
        "clinical": lambda: download_clinical(CPTAC_STUDIES),
        "expression": lambda: download_expression_curated(CPTAC_STUDIES),
        "expression-full": lambda: download_expression_full(CPTAC_STUDIES),
        "mutations": lambda: download_mutations(CPTAC_STUDIES),
        "cnv": lambda: download_cnv(CPTAC_STUDIES),
    }

    if step:
        if step not in steps:
            logger.error("Unknown step: %s. Available: %s", step, ", ".join(steps.keys()))
            return
        steps[step]()
    else:
        for name, func in steps.items():
            logger.info("\n" + "=" * 60)
            logger.info("Step: %s", name)
            logger.info("=" * 60)
            func()

    create_summary(CPTAC_STUDIES)
    logger.info("\nDownload complete!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Download CPTAC molecular data from cBioPortal")
    parser.add_argument(
        "--step",
        choices=["clinical", "expression", "expression-full", "mutations", "cnv"],
        help="Download only a specific data type (default: all)",
    )
    args = parser.parse_args()
    main(step=args.step)
