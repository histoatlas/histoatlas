#!/usr/bin/env python3
"""
Download TCGA Pan-Cancer molecular data from UCSC Xena Browser.

This is the most efficient approach as Xena provides pre-processed
Pan-Cancer Atlas matrices in downloadable format.

Data sources (UCSC Xena - TCGA Pan-Cancer hub):
- Mutations: mc3.v0.2.8.PUBLIC.maf.gene_level (gene-level binary calls)
- Expression: EB++AdjustPANCAN_IlluminaHiSeq_RNASeqV2.geneExp.xena (RSEM normalized)
- CNV: Gistic2_CopyNumber_Gistic2_all_thresholded.by_genes (GISTIC2 thresholded)

Reference: https://xenabrowser.net/datapages/?cohort=TCGA%20Pan-Cancer%20(PANCAN)
"""

import json
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

# Configuration
DATA_DIR = Path(__file__).parent.parent / "data"
RAW_DIR = DATA_DIR / "raw" / "xena"
PROCESSED_DIR = DATA_DIR / "processed" / "molecular"

# UCSC Xena Pan-Cancer Hub
XENA_HUB = "https://tcga-pancan-atlas-hub.s3.us-east-1.amazonaws.com"

# Data files to download
XENA_FILES = {
    "mutations": {
        "url": f"{XENA_HUB}/mc3.v0.2.8.PUBLIC.nonsilentGene.xena.gz",
        "description": "MC3 gene-level mutation calls (non-silent)",
        "filename": "mc3_mutations.tsv.gz",
    },
    "expression": {
        "url": f"{XENA_HUB}/EB%2B%2BAdjustPANCAN_IlluminaHiSeq_RNASeqV2.geneExp.xena.gz",
        "description": "RSEM normalized gene expression (batch-corrected)",
        "filename": "pancan_expression.tsv.gz",
    },
    "cnv_gistic": {
        "url": f"{XENA_HUB}/Gistic2_CopyNumber_Gistic2_all_thresholded.by_genes.gz",
        "description": "GISTIC2 thresholded CNV calls (-2,-1,0,1,2)",
        "filename": "gistic2_cnv.tsv.gz",
    },
    "clinical": {
        "url": f"{XENA_HUB}/Survival_SupspleaceAntal_File_clinical_ational_Outcome.txt.gz",
        "description": "Clinical and survival data",
        "filename": "clinical_survival.tsv.gz",
    },
    "sample_type": {
        "url": f"{XENA_HUB}/TCGA_phenotype_denseDataOnlyDownload.tsv.gz",
        "description": "Sample type and cancer type annotations",
        "filename": "phenotype.tsv.gz",
    },
}

# Alternative URLs (direct from GDC PanCan Atlas)
GDC_PANCAN_FILES = {
    "mutations_maf": {
        "url": "https://api.gdc.cancer.gov/data/1c8cfe5f-e52d-41ba-94da-f15ea1337efc",
        "description": "MC3 MAF file (full mutation details)",
        "filename": "mc3.v0.2.8.PUBLIC.maf.gz",
    }
}


def setup_directories():
    """Create necessary directories."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Data directories created at {DATA_DIR}")


def download_file(url: str, output_path: Path, description: str = ""):
    """Download a file with progress bar."""
    print(f"\nDownloading: {description or url}")

    response = requests.get(url, stream=True, timeout=60)
    response.raise_for_status()

    total_size = int(response.headers.get("content-length", 0))

    with open(output_path, "wb") as f:
        with tqdm(
            total=total_size, unit="B", unit_scale=True, desc=output_path.name
        ) as pbar:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                pbar.update(len(chunk))

    print(f"  Saved to: {output_path}")
    return output_path


def download_xena_data(data_types: list = None):
    """Download specified data types from Xena."""
    setup_directories()

    if data_types is None:
        data_types = ["mutations", "expression", "cnv_gistic"]

    metadata = {
        "download_date": datetime.now().isoformat(),
        "source": "UCSC Xena TCGA Pan-Cancer Hub",
        "files_downloaded": [],
    }

    for data_type in data_types:
        if data_type not in XENA_FILES:
            print(f"Unknown data type: {data_type}")
            continue

        file_info = XENA_FILES[data_type]
        output_path = RAW_DIR / file_info["filename"]

        if output_path.exists():
            print(f"\n{data_type}: File already exists at {output_path}")
            metadata["files_downloaded"].append(
                {"type": data_type, "file": str(output_path), "status": "exists"}
            )
            continue

        try:
            download_file(file_info["url"], output_path, file_info["description"])
            metadata["files_downloaded"].append(
                {"type": data_type, "file": str(output_path), "status": "downloaded"}
            )
        except Exception as e:
            print(f"  Error downloading {data_type}: {e}")
            metadata["files_downloaded"].append(
                {"type": data_type, "error": str(e), "status": "failed"}
            )

    return metadata


def process_mutations(input_path: Path = None) -> pd.DataFrame:
    """Process mutation data into gene-level binary matrix."""
    if input_path is None:
        input_path = RAW_DIR / "mc3_mutations.tsv.gz"

    print(f"\nProcessing mutations from {input_path}")

    # Read the gene-level mutation matrix
    # Format: gene rows x sample columns, values indicate mutation presence
    df = pd.read_csv(input_path, sep="\t", index_col=0, compression="gzip")

    print(f"  Raw shape: {df.shape}")

    # Transpose to have samples as rows, genes as columns
    df = df.T

    # Convert to binary (any mutation = 1)
    df = (df > 0).astype(int)

    # Extract case ID from sample barcode (first 12 chars)
    df["case_id"] = df.index.str[:12]
    df["sample_id"] = df.index

    print(f"  Processed shape: {df.shape}")
    print(f"  Unique cases: {df['case_id'].nunique()}")

    # Save
    output_path = PROCESSED_DIR / "tcga_mutations_binary.parquet"
    df.to_parquet(output_path)
    print(f"  Saved to: {output_path}")

    return df


def process_expression(input_path: Path = None) -> pd.DataFrame:
    """Process expression data."""
    if input_path is None:
        input_path = RAW_DIR / "pancan_expression.tsv.gz"

    print(f"\nProcessing expression from {input_path}")

    # Read expression matrix (gene rows x sample columns)
    df = pd.read_csv(input_path, sep="\t", index_col=0, compression="gzip")

    print(f"  Raw shape: {df.shape}")

    # Transpose to samples x genes
    df = df.T

    # Extract case ID
    df["case_id"] = df.index.str[:12]
    df["sample_id"] = df.index

    print(f"  Processed shape: {df.shape}")
    print(f"  Unique cases: {df['case_id'].nunique()}")

    # Save full expression matrix
    output_path = PROCESSED_DIR / "tcga_expression.parquet"
    df.to_parquet(output_path)
    print(f"  Saved to: {output_path}")

    return df


def process_cnv(input_path: Path = None) -> pd.DataFrame:
    """Process CNV data."""
    if input_path is None:
        input_path = RAW_DIR / "gistic2_cnv.tsv.gz"

    print(f"\nProcessing CNV from {input_path}")

    # Read GISTIC2 thresholded CNV (gene rows x sample columns)
    # Values: -2 (deep del), -1 (shallow del), 0 (neutral), 1 (gain), 2 (amp)
    df = pd.read_csv(input_path, sep="\t", index_col=0, compression="gzip")

    print(f"  Raw shape: {df.shape}")

    # Transpose to samples x genes
    df = df.T

    # Extract case ID
    df["case_id"] = df.index.str[:12]
    df["sample_id"] = df.index

    print(f"  Processed shape: {df.shape}")
    print(f"  Unique cases: {df['case_id'].nunique()}")

    # Save
    output_path = PROCESSED_DIR / "tcga_cnv_gistic.parquet"
    df.to_parquet(output_path)
    print(f"  Saved to: {output_path}")

    return df


def download_and_process_all():
    """Download and process all molecular data."""
    print("=" * 60)
    print("TCGA Pan-Cancer Molecular Data Download")
    print("=" * 60)

    # Download
    metadata = download_xena_data(["mutations", "expression", "cnv_gistic"])

    # Process each data type
    print("\n" + "=" * 60)
    print("Processing downloaded data")
    print("=" * 60)

    results = {}

    try:
        results["mutations"] = process_mutations()
    except Exception as e:
        print(f"Error processing mutations: {e}")

    try:
        results["expression"] = process_expression()
    except Exception as e:
        print(f"Error processing expression: {e}")

    try:
        results["cnv"] = process_cnv()
    except Exception as e:
        print(f"Error processing CNV: {e}")

    # Save metadata
    metadata["processing_date"] = datetime.now().isoformat()
    with open(PROCESSED_DIR / "download_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    for dtype, df in results.items():
        if df is not None:
            print(f"{dtype}: {df.shape[0]} samples, {df.shape[1] - 2} features")

    print(f"\nAll data saved to: {PROCESSED_DIR}")
    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Download TCGA molecular data from Xena"
    )
    parser.add_argument(
        "--download-only", action="store_true", help="Only download, don't process"
    )
    parser.add_argument(
        "--process-only", action="store_true", help="Only process existing downloads"
    )
    parser.add_argument(
        "--data-types",
        nargs="+",
        choices=["mutations", "expression", "cnv_gistic", "clinical"],
        default=["mutations", "expression", "cnv_gistic"],
        help="Data types to download/process",
    )

    args = parser.parse_args()

    if args.download_only:
        download_xena_data(args.data_types)
    elif args.process_only:
        if "mutations" in args.data_types:
            process_mutations()
        if "expression" in args.data_types:
            process_expression()
        if "cnv_gistic" in args.data_types:
            process_cnv()
    else:
        download_and_process_all()
