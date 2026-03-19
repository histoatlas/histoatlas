#!/usr/bin/env python3
"""
Download TCGA Pan-Cancer molecular data (mutations, expression, CNV).

This script uses a hybrid approach:
1. Xena: Mutations (mc3) and CNV (GISTIC) - large pre-computed matrices
2. cBioPortal API: Expression data per cancer type

Reference: TCGA Pan-Cancer Atlas (2018)
"""

import json
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from _tcga_studies import TCGA_STUDIES
from tqdm import tqdm

# Configuration
DATA_DIR = Path(__file__).parent.parent / "data"
RAW_DIR = DATA_DIR / "raw" / "tcga_molecular"
PROCESSED_DIR = DATA_DIR / "processed" / "molecular"

# Working URLs
XENA_URLS = {
    "mutations": {
        "url": "https://pancanatlas.xenahubs.net/download/mc3.v0.2.8.PUBLIC.nonsilentGene.xena.gz",
        "description": "MC3 gene-level mutation calls (non-silent)",
        "filename": "mc3_mutations.tsv.gz",
    },
    "cnv": {
        "url": "https://tcga.xenahubs.net/download/TCGA.PANCAN.sampleMap/Gistic2_CopyNumber_Gistic2_all_thresholded.by_genes.gz",
        "description": "GISTIC2 thresholded CNV calls",
        "filename": "gistic2_cnv.tsv.gz",
    },
    "phenotype": {
        "url": "https://pancanatlas.xenahubs.net/download/TCGA_phenotype_denseDataOnlyDownload.tsv.gz",
        "description": "Sample phenotype and cancer type annotations",
        "filename": "phenotype.tsv.gz",
    },
}

# cBioPortal API for expression
CBIOPORTAL_API = "https://www.cbioportal.org/api"


def setup_directories():
    """Create necessary directories."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Data directories created at {DATA_DIR}")


def download_file(url: str, output_path: Path, description: str = "") -> bool:
    """Download a file with progress bar."""
    print(f"\nDownloading: {description}")

    try:
        response = requests.get(url, stream=True, timeout=60, allow_redirects=True)
        response.raise_for_status()

        total_size = int(response.headers.get("content-length", 0))

        with open(output_path, "wb") as f:
            with tqdm(total=total_size, unit="B", unit_scale=True, desc=output_path.name) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))

        print(f"  Saved to: {output_path}")
        return True
    except Exception as e:
        print(f"  Error: {e}")
        return False


def download_xena_data():
    """Download data from Xena."""
    setup_directories()

    results = {}
    for data_type, info in XENA_URLS.items():
        output_path = RAW_DIR / info["filename"]

        if output_path.exists():
            print(f"\n{data_type}: File already exists at {output_path}")
            results[data_type] = {"status": "exists", "path": str(output_path)}
            continue

        success = download_file(info["url"], output_path, info["description"])
        results[data_type] = {
            "status": "downloaded" if success else "failed",
            "path": str(output_path) if success else None,
        }

    return results


def process_mutations(input_path: Path = None) -> pd.DataFrame:
    """Process mutation data into gene-level binary matrix."""
    if input_path is None:
        input_path = RAW_DIR / "mc3_mutations.tsv.gz"

    print(f"\nProcessing mutations from {input_path}")

    # Read the gene-level mutation matrix
    df = pd.read_csv(input_path, sep="\t", index_col=0, compression="gzip")
    print(f"  Raw shape: {df.shape} (genes x samples)")

    # Transpose to samples x genes
    df = df.T

    # Convert to binary (any mutation = 1)
    df = (df > 0).astype(int)

    # Extract case ID from sample barcode (first 12 chars: TCGA-XX-XXXX)
    df.index.name = "sample_id"
    df = df.reset_index()
    df["case_id"] = df["sample_id"].str[:12]

    print(f"  Processed shape: {df.shape}")
    print(f"  Unique cases: {df['case_id'].nunique()}")

    # Save
    output_path = PROCESSED_DIR / "tcga_mutations.parquet"
    df.to_parquet(output_path, index=False)
    print(f"  Saved to: {output_path}")

    return df


def process_cnv(input_path: Path = None) -> pd.DataFrame:
    """Process CNV data."""
    if input_path is None:
        input_path = RAW_DIR / "gistic2_cnv.tsv.gz"

    print(f"\nProcessing CNV from {input_path}")

    # Read GISTIC2 thresholded CNV (gene rows x sample columns)
    # Values: -2 (homozygous del), -1 (hemizygous del), 0 (neutral), 1 (gain), 2 (amp)
    df = pd.read_csv(input_path, sep="\t", index_col=0, compression="gzip")
    print(f"  Raw shape: {df.shape} (genes x samples)")

    # Transpose to samples x genes
    df = df.T

    # Extract case ID
    df.index.name = "sample_id"
    df = df.reset_index()
    df["case_id"] = df["sample_id"].str[:12]

    print(f"  Processed shape: {df.shape}")
    print(f"  Unique cases: {df['case_id'].nunique()}")

    # Save
    output_path = PROCESSED_DIR / "tcga_cnv.parquet"
    df.to_parquet(output_path, index=False)
    print(f"  Saved to: {output_path}")

    return df


def process_phenotype(input_path: Path = None) -> pd.DataFrame:
    """Process phenotype data."""
    if input_path is None:
        input_path = RAW_DIR / "phenotype.tsv.gz"

    print(f"\nProcessing phenotype from {input_path}")

    df = pd.read_csv(input_path, sep="\t", compression="gzip")
    print(f"  Shape: {df.shape}")
    print(f"  Columns: {df.columns.tolist()[:10]}")

    # Save
    output_path = PROCESSED_DIR / "tcga_phenotype.parquet"
    df.to_parquet(output_path, index=False)
    print(f"  Saved to: {output_path}")

    return df


def get_cbioportal_samples(study_id: str) -> list:
    """Get sample IDs from a cBioPortal study."""
    url = f"{CBIOPORTAL_API}/studies/{study_id}/samples"
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    samples = response.json()
    return [s["sampleId"] for s in samples]


def get_cbioportal_expression(
    study_id: str, sample_ids: list, batch_size: int = 500
) -> pd.DataFrame:
    """Get expression data from cBioPortal API."""
    profile_id = f"{study_id}_rna_seq_v2_mrna"
    url = f"{CBIOPORTAL_API}/molecular-profiles/{profile_id}/molecular-data/fetch"

    all_data = []

    for i in range(0, len(sample_ids), batch_size):
        batch = sample_ids[i : i + batch_size]

        payload = {"sampleIds": batch}

        try:
            response = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=300,
            )

            if response.status_code == 200:
                data = response.json()
                all_data.extend(data)
            else:
                continue
        except Exception:
            continue

        # Rate limiting
        time.sleep(0.5)

    if all_data:
        df = pd.DataFrame(all_data)
        return df
    return pd.DataFrame()


def download_expression_cbioportal(studies: list = None) -> pd.DataFrame:
    """Download expression data from cBioPortal for all TCGA studies."""
    if studies is None:
        studies = TCGA_STUDIES

    all_expression = []

    print("\nDownloading expression data from cBioPortal API...")
    print("(This may take a while due to API rate limits)\n")

    for study_id in tqdm(studies, desc="Studies"):
        cancer_type = study_id.split("_")[0].upper()

        try:
            # Get samples
            sample_ids = get_cbioportal_samples(study_id)
            print(f"\n{cancer_type}: {len(sample_ids)} samples")

            # Get expression
            exp_df = get_cbioportal_expression(study_id, sample_ids)

            if not exp_df.empty:
                exp_df["cancer_type"] = cancer_type
                all_expression.append(exp_df)
                print(f"  Got {len(exp_df)} expression entries")

        except Exception as e:
            print(f"  Error: {e}")
            continue

    if all_expression:
        combined = pd.concat(all_expression, ignore_index=True)

        # Pivot to wide format (samples x genes)
        print("\nPivoting to wide format...")
        pivot_df = combined.pivot_table(
            index="sampleId", columns="hugoGeneSymbol", values="value", aggfunc="first"
        )
        pivot_df = pivot_df.reset_index()
        pivot_df["case_id"] = pivot_df["sampleId"].str[:12]

        # Save
        output_path = PROCESSED_DIR / "tcga_expression.parquet"
        pivot_df.to_parquet(output_path, index=False)
        print(f"Saved expression data to: {output_path}")

        return pivot_df

    return pd.DataFrame()


def create_summary_stats():
    """Create summary statistics for downloaded data."""
    print("\n" + "=" * 60)
    print("Data Summary")
    print("=" * 60)

    summary = {}

    # Mutations
    mut_path = PROCESSED_DIR / "tcga_mutations.parquet"
    if mut_path.exists():
        df = pd.read_parquet(mut_path)
        n_genes = len([c for c in df.columns if c not in ["sample_id", "case_id"]])
        summary["mutations"] = {
            "samples": len(df),
            "cases": df["case_id"].nunique(),
            "genes": n_genes,
        }
        print(f"Mutations: {len(df)} samples, {n_genes} genes")

    # CNV
    cnv_path = PROCESSED_DIR / "tcga_cnv.parquet"
    if cnv_path.exists():
        df = pd.read_parquet(cnv_path)
        n_genes = len([c for c in df.columns if c not in ["sample_id", "case_id"]])
        summary["cnv"] = {
            "samples": len(df),
            "cases": df["case_id"].nunique(),
            "genes": n_genes,
        }
        print(f"CNV: {len(df)} samples, {n_genes} genes")

    # Expression
    exp_path = PROCESSED_DIR / "tcga_expression.parquet"
    if exp_path.exists():
        df = pd.read_parquet(exp_path)
        n_genes = len([c for c in df.columns if c not in ["sampleId", "case_id"]])
        summary["expression"] = {
            "samples": len(df),
            "cases": df["case_id"].nunique(),
            "genes": n_genes,
        }
        print(f"Expression: {len(df)} samples, {n_genes} genes")

    # Save summary
    with open(PROCESSED_DIR / "data_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    return summary


def main():
    """Main download and processing pipeline."""
    print("=" * 60)
    print("TCGA Pan-Cancer Molecular Data Download")
    print("=" * 60)
    print(f"Date: {datetime.now().isoformat()}")

    # Step 1: Download from Xena
    print("\n" + "=" * 60)
    print("Step 1: Downloading from UCSC Xena")
    print("=" * 60)
    download_xena_data()

    # Step 2: Process mutations
    print("\n" + "=" * 60)
    print("Step 2: Processing mutations")
    print("=" * 60)
    try:
        process_mutations()
    except Exception as e:
        print(f"Error processing mutations: {e}")

    # Step 3: Process CNV
    print("\n" + "=" * 60)
    print("Step 3: Processing CNV")
    print("=" * 60)
    try:
        process_cnv()
    except Exception as e:
        print(f"Error processing CNV: {e}")

    # Step 4: Process phenotype
    print("\n" + "=" * 60)
    print("Step 4: Processing phenotype")
    print("=" * 60)
    try:
        process_phenotype()
    except Exception as e:
        print(f"Error processing phenotype: {e}")

    # Step 5: Download expression (optional - can be slow)
    print("\n" + "=" * 60)
    print("Step 5: Expression data")
    print("=" * 60)
    print("Note: Expression download from cBioPortal is slow.")
    print("For faster results, consider using pre-computed pathway scores.")

    # Create summary
    print("\n" + "=" * 60)
    print("Step 6: Creating summary")
    print("=" * 60)
    create_summary_stats()

    # Save metadata
    metadata = {
        "download_date": datetime.now().isoformat(),
        "sources": {
            "mutations": "UCSC Xena - MC3 Pan-Cancer mutation calls",
            "cnv": "UCSC Xena - GISTIC2 thresholded CNV",
            "expression": "cBioPortal API - RSEM normalized",
        },
        "output_dir": str(PROCESSED_DIR),
    }
    with open(PROCESSED_DIR / "download_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("\n" + "=" * 60)
    print("Download complete!")
    print(f"Data saved to: {PROCESSED_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Download TCGA molecular data")
    parser.add_argument(
        "--skip-expression", action="store_true", help="Skip expression download (slow)"
    )
    parser.add_argument(
        "--expression-only", action="store_true", help="Only download expression data"
    )

    args = parser.parse_args()

    if args.expression_only:
        setup_directories()
        download_expression_cbioportal()
    else:
        main()
