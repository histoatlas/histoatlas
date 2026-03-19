#!/usr/bin/env python3
"""
Download expression data for a curated gene panel from cBioPortal.
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

# Curated gene panel (~200 genes covering key pathways)
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


def get_gene_info() -> dict:
    """Get Entrez IDs and symbols for curated genes."""
    gene_map = {}

    print("Getting gene information...")
    for gene in tqdm(CURATED_GENES, desc="Genes"):
        try:
            url = f"{CBIOPORTAL_API}/genes/{gene}"
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                data = response.json()
                gene_map[data["entrezGeneId"]] = data["hugoGeneSymbol"]
        except:
            continue
        time.sleep(0.05)

    return gene_map


def get_samples(study_id: str) -> list:
    """Get sample IDs from a study."""
    url = f"{CBIOPORTAL_API}/studies/{study_id}/samples"
    response = requests.get(url, timeout=60)
    if response.status_code == 200:
        return [s["sampleId"] for s in response.json()]
    return []


def get_expression(study_id: str, sample_ids: list, entrez_ids: list) -> pd.DataFrame:
    """Get expression data for specific genes."""
    profile_id = f"{study_id}_rna_seq_v2_mrna"
    url = f"{CBIOPORTAL_API}/molecular-profiles/{profile_id}/molecular-data/fetch"

    all_data = []
    batch_size = 100

    for i in range(0, len(sample_ids), batch_size):
        batch = sample_ids[i : i + batch_size]

        payload = {"sampleIds": batch, "entrezGeneIds": entrez_ids}

        try:
            response = requests.post(
                url, json=payload, headers={"Content-Type": "application/json"}, timeout=300
            )
            if response.status_code == 200:
                all_data.extend(response.json())
        except:
            continue

        time.sleep(0.1)

    return pd.DataFrame(all_data) if all_data else pd.DataFrame()


def main():
    """Download expression for curated gene panel."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("TCGA Expression Data - Curated Gene Panel")
    print("=" * 60)

    # Get gene info
    gene_map = get_gene_info()
    entrez_ids = list(gene_map.keys())
    print(f"\nFound {len(gene_map)} genes with valid Entrez IDs")

    if not entrez_ids:
        print("ERROR: No gene IDs found!")
        return

    all_data = []

    print(f"\nDownloading expression for {len(TCGA_STUDIES)} studies...")
    for study_id in tqdm(TCGA_STUDIES, desc="Studies"):
        cancer_type = study_id.split("_")[0].upper()

        try:
            sample_ids = get_samples(study_id)
            if not sample_ids:
                continue

            exp_df = get_expression(study_id, sample_ids, entrez_ids)

            if not exp_df.empty:
                exp_df["cancer_type"] = cancer_type
                all_data.append(exp_df)
                print(f"  {cancer_type}: {len(sample_ids)} samples, {len(exp_df)} entries")

        except Exception as e:
            print(f"  {cancer_type}: Error - {e}")

    if all_data:
        print("\nProcessing data...")
        combined = pd.concat(all_data, ignore_index=True)

        # Map entrez IDs to gene symbols
        combined["gene"] = combined["entrezGeneId"].map(gene_map)

        # Pivot to wide format
        pivot_df = combined.pivot_table(
            index=["sampleId", "patientId"], columns="gene", values="value", aggfunc="first"
        ).reset_index()

        # Add case_id
        pivot_df["case_id"] = pivot_df["patientId"]

        # Add cancer type
        cancer_map = combined.groupby("sampleId")["cancer_type"].first().to_dict()
        pivot_df["cancer_type"] = pivot_df["sampleId"].map(cancer_map)

        # Reorder columns
        meta_cols = ["sampleId", "patientId", "case_id", "cancer_type"]
        gene_cols = [c for c in pivot_df.columns if c not in meta_cols]
        pivot_df = pivot_df[meta_cols + sorted(gene_cols)]

        # Save
        output_path = PROCESSED_DIR / "tcga_expression_curated.parquet"
        pivot_df.to_parquet(output_path, index=False)

        print(f"\nSaved to: {output_path}")
        print(f"Shape: {pivot_df.shape} ({len(pivot_df)} samples x {len(gene_cols)} genes)")

        # Save metadata
        with open(PROCESSED_DIR / "expression_metadata.json", "w") as f:
            json.dump(
                {
                    "download_date": datetime.now().isoformat(),
                    "source": "cBioPortal API",
                    "genes": sorted(gene_cols),
                    "n_genes": len(gene_cols),
                    "n_samples": len(pivot_df),
                    "studies": TCGA_STUDIES,
                },
                f,
                indent=2,
            )

        return pivot_df

    print("No data downloaded!")
    return None


if __name__ == "__main__":
    main()
