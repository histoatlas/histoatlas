#!/usr/bin/env python3
"""
Download TCGA clinical data from cBioPortal API.

Includes:
- Patient demographics (age, sex, race)
- Tumor characteristics (stage, grade, histology)
- Survival data (OS, PFS, DSS)
- Treatment information (where available)
"""

import json
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from _tcga_studies import TCGA_STUDIES
from tqdm import tqdm

DATA_DIR = Path(__file__).parent.parent / "data"
PROCESSED_DIR = DATA_DIR / "processed" / "molecular"

CBIOPORTAL_API = "https://www.cbioportal.org/api"


def get_patients(study_id: str) -> pd.DataFrame:
    """Get patient data from a study."""
    url = f"{CBIOPORTAL_API}/studies/{study_id}/patients"
    response = requests.get(url, timeout=60)
    if response.status_code == 200:
        return pd.DataFrame(response.json())
    return pd.DataFrame()


def get_clinical_data(study_id: str) -> pd.DataFrame:
    """Get clinical data for all patients in a study."""
    url = f"{CBIOPORTAL_API}/studies/{study_id}/clinical-data"
    params = {"clinicalDataType": "PATIENT"}

    response = requests.get(url, params=params, timeout=120)
    if response.status_code == 200:
        return pd.DataFrame(response.json())
    return pd.DataFrame()


def get_sample_clinical_data(study_id: str) -> pd.DataFrame:
    """Get sample-level clinical data."""
    url = f"{CBIOPORTAL_API}/studies/{study_id}/clinical-data"
    params = {"clinicalDataType": "SAMPLE"}

    response = requests.get(url, params=params, timeout=120)
    if response.status_code == 200:
        return pd.DataFrame(response.json())
    return pd.DataFrame()


def pivot_clinical_data(df: pd.DataFrame, id_col: str = "patientId") -> pd.DataFrame:
    """Pivot long-form clinical data to wide format."""
    if df.empty:
        return df

    # Pivot to wide format
    pivot = df.pivot_table(
        index=id_col, columns="clinicalAttributeId", values="value", aggfunc="first"
    ).reset_index()

    return pivot


def download_all_clinical_data():
    """Download clinical data for all TCGA studies."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("TCGA Clinical Data Download")
    print("=" * 60)

    all_patient_clinical = []
    all_sample_clinical = []

    for study_id in tqdm(TCGA_STUDIES, desc="Studies"):
        cancer_type = study_id.split("_")[0].upper()

        try:
            # Get patient-level clinical data
            patient_data = get_clinical_data(study_id)
            if not patient_data.empty:
                patient_data["cancer_type"] = cancer_type
                patient_data["study_id"] = study_id
                all_patient_clinical.append(patient_data)

            # Get sample-level clinical data
            sample_data = get_sample_clinical_data(study_id)
            if not sample_data.empty:
                sample_data["cancer_type"] = cancer_type
                sample_data["study_id"] = study_id
                all_sample_clinical.append(sample_data)

            print(
                f"  {cancer_type}: {len(patient_data)} patient attributes, {len(sample_data)} sample attributes"
            )

        except Exception as e:
            print(f"  {cancer_type}: Error - {e}")

        time.sleep(0.3)

    # Combine patient clinical data
    if all_patient_clinical:
        print("\nProcessing patient-level clinical data...")
        patient_combined = pd.concat(all_patient_clinical, ignore_index=True)

        # Pivot to wide format
        patient_wide = patient_combined.pivot_table(
            index=["patientId", "studyId"],
            columns="clinicalAttributeId",
            values="value",
            aggfunc="first",
        ).reset_index()

        # Add cancer type back
        cancer_map = patient_combined.groupby("patientId")["cancer_type"].first().to_dict()
        patient_wide["cancer_type"] = patient_wide["patientId"].map(cancer_map)

        # Add case_id (same as patientId for TCGA)
        patient_wide["case_id"] = patient_wide["patientId"]

        # Save
        output_path = PROCESSED_DIR / "tcga_clinical_patient.parquet"
        patient_wide.to_parquet(output_path, index=False)
        print(f"Saved patient clinical data: {output_path}")
        print(f"  Shape: {patient_wide.shape}")
        print(f"  Columns: {sorted(patient_wide.columns.tolist())[:20]}...")

    # Combine sample clinical data
    if all_sample_clinical:
        print("\nProcessing sample-level clinical data...")
        sample_combined = pd.concat(all_sample_clinical, ignore_index=True)

        # Pivot to wide format
        sample_wide = sample_combined.pivot_table(
            index=["sampleId", "patientId", "studyId"],
            columns="clinicalAttributeId",
            values="value",
            aggfunc="first",
        ).reset_index()

        # Add cancer type
        cancer_map = sample_combined.groupby("sampleId")["cancer_type"].first().to_dict()
        sample_wide["cancer_type"] = sample_wide["sampleId"].map(cancer_map)

        # Add case_id
        sample_wide["case_id"] = sample_wide["patientId"]

        # Save
        output_path = PROCESSED_DIR / "tcga_clinical_sample.parquet"
        sample_wide.to_parquet(output_path, index=False)
        print(f"Saved sample clinical data: {output_path}")
        print(f"  Shape: {sample_wide.shape}")

    # Create a unified clinical table with key variables
    print("\nCreating unified clinical table...")
    create_unified_clinical_table()

    # Save metadata
    metadata = {
        "download_date": datetime.now().isoformat(),
        "source": "cBioPortal API",
        "studies": TCGA_STUDIES,
        "n_studies": len(TCGA_STUDIES),
    }
    with open(PROCESSED_DIR / "clinical_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("\nDownload complete!")


def create_unified_clinical_table():
    """Create a unified clinical table with standardized key variables."""
    patient_path = PROCESSED_DIR / "tcga_clinical_patient.parquet"

    if not patient_path.exists():
        print("Patient clinical data not found!")
        return

    df = pd.read_parquet(patient_path)

    # Key clinical variables to standardize
    # These are common across most TCGA studies
    key_vars = {
        "case_id": "case_id",
        "cancer_type": "cancer_type",
        # Demographics
        "AGE": "age_at_diagnosis",
        "SEX": "sex",
        "RACE": "race",
        "ETHNICITY": "ethnicity",
        # Survival
        "OS_STATUS": "os_status",
        "OS_MONTHS": "os_months",
        "PFS_STATUS": "pfs_status",
        "PFS_MONTHS": "pfs_months",
        "DSS_STATUS": "dss_status",
        "DSS_MONTHS": "dss_months",
        "DFS_STATUS": "dfs_status",
        "DFS_MONTHS": "dfs_months",
        # Tumor characteristics
        "AJCC_PATHOLOGIC_TUMOR_STAGE": "stage",
        "TUMOR_STAGE_2009": "stage_2009",
        "PATH_T_STAGE": "path_t",
        "PATH_N_STAGE": "path_n",
        "PATH_M_STAGE": "path_m",
        "GRADE": "grade",
        "HISTOLOGICAL_DIAGNOSIS": "histology",
        # Molecular subtypes (where available)
        "SUBTYPE": "subtype",
    }

    # Create unified table with available columns
    unified = pd.DataFrame()

    for old_col, new_col in key_vars.items():
        if old_col in df.columns:
            unified[new_col] = df[old_col]

    # Convert numeric columns
    numeric_cols = ["age_at_diagnosis", "os_months", "pfs_months", "dss_months", "dfs_months"]
    for col in numeric_cols:
        if col in unified.columns:
            unified[col] = pd.to_numeric(unified[col], errors="coerce")

    # Convert status columns to binary (1=event, 0=censored)
    status_cols = ["os_status", "pfs_status", "dss_status", "dfs_status"]
    for col in status_cols:
        if col in unified.columns:
            # Common patterns: "1:DECEASED", "0:LIVING", "1:PROGRESSED", etc.
            unified[col] = unified[col].apply(
                lambda x: 1
                if pd.notna(x) and str(x).startswith("1:")
                else (0 if pd.notna(x) and str(x).startswith("0:") else None)
            )

    # Save
    output_path = PROCESSED_DIR / "tcga_clinical_unified.parquet"
    unified.to_parquet(output_path, index=False)

    print(f"Saved unified clinical data: {output_path}")
    print(f"  Shape: {unified.shape}")
    print(f"  Columns: {unified.columns.tolist()}")

    # Summary statistics
    print("\n  Key variable availability:")
    for col in unified.columns:
        non_null = unified[col].notna().sum()
        pct = non_null / len(unified) * 100
        print(f"    {col}: {non_null} ({pct:.1f}%)")

    return unified


if __name__ == "__main__":
    download_all_clinical_data()
