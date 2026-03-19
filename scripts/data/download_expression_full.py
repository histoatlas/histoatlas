#!/usr/bin/env python3
"""
Download the full TCGA Pan-Cancer batch-corrected RNA-seq expression matrix.

Source: UCSC Xena Pan-Cancer Atlas hub
Dataset: EB++AdjustPANCAN_IlluminaHiSeq_RNASeqV2.geneExp.xena
Format: log2(RSEM+1), batch-corrected across cancer types
Size: ~600 MB compressed, ~10,500 samples × ~20,500 genes

The matrix is used for ssGSEA scoring of 50 MSigDB Hallmark pathways.
"""

import logging
import os
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

_data_root_override = os.environ.get("HISTOATLAS_DATA_ROOT")
DATA_DIR = (
    Path(_data_root_override)
    if _data_root_override
    else Path(__file__).parent.parent.parent / "data"
)
RAW_DIR = DATA_DIR / "raw" / "xena"
PROCESSED_DIR = DATA_DIR / "processed" / "molecular"

EXPRESSION_URL = (
    "https://pancanatlas.xenahubs.net/download/"
    "EB%2B%2BAdjustPANCAN_IlluminaHiSeq_RNASeqV2.geneExp.xena.gz"
)
PHENOTYPE_URL = (
    "https://pancanatlas.xenahubs.net/download/"
    "TCGA_phenotype_denseDataOnlyDownload.tsv.gz"
)
RAW_FILENAME = "pancan_expression_full.tsv.gz"
OUTPUT_FILENAME = "tcga_expression_full.parquet"


def download_file(url: str, output_path: Path, description: str = "") -> None:
    """Download a file with progress bar.

    Downloads to a temporary file first, then renames atomically to avoid
    leaving corrupt partial files if the download is interrupted.
    """
    if output_path.exists():
        logger.info("Already downloaded: %s", output_path.name)
        return

    tmp_path = output_path.with_suffix(output_path.suffix + ".tmp")

    logger.info("Downloading: %s", description or url)
    response = requests.get(url, stream=True, timeout=300)
    response.raise_for_status()

    total_size = int(response.headers.get("content-length", 0))
    with (
        open(tmp_path, "wb") as f,
        tqdm(total=total_size, unit="B", unit_scale=True, desc=output_path.name) as pbar,
    ):
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            pbar.update(len(chunk))

    # Atomic rename — avoids partial files on interrupt
    tmp_path.rename(output_path)
    logger.info("Downloaded: %s (%.1f MB)", output_path.name, output_path.stat().st_size / 1e6)


def load_phenotype() -> pd.DataFrame:
    """Load phenotype data for sample-to-cancer-type mapping."""
    phenotype_path = RAW_DIR / "phenotype.tsv.gz"
    download_file(PHENOTYPE_URL, phenotype_path, "Sample phenotype annotations")

    pheno = pd.read_csv(phenotype_path, sep="\t", low_memory=False)
    # Keep primary tumor samples only (sample type code 01)
    if "_primary_disease" in pheno.columns:
        cancer_col = "_primary_disease"
    elif "primary_disease" in pheno.columns:
        cancer_col = "primary_disease"
    else:
        cancer_col = pheno.columns[1]

    pheno = pheno.rename(columns={"sample": "sample_id", cancer_col: "cancer_type_full"})
    return pheno[["sample_id", "cancer_type_full"]].dropna()


def process_expression() -> None:
    """Download, transpose, and save the full expression matrix as parquet."""
    raw_path = RAW_DIR / RAW_FILENAME
    output_path = PROCESSED_DIR / OUTPUT_FILENAME

    if output_path.exists():
        logger.info("Output already exists: %s", output_path)
        return

    download_file(EXPRESSION_URL, raw_path, "TCGA Pan-Cancer batch-corrected expression")

    logger.info("Reading expression matrix (this may take a few minutes)...")
    # Xena format: genes as rows, samples as columns
    expr = pd.read_csv(raw_path, sep="\t", index_col=0)
    # Gene names are Entrez IDs (integers); convert to strings for parquet compatibility
    expr.index = expr.index.astype(str)
    # Drop duplicate gene names (rare, <5 occurrences)
    n_dup = expr.index.duplicated().sum()
    if n_dup > 0:
        logger.info("Dropping %d duplicate gene entries", n_dup)
        expr = expr[~expr.index.duplicated(keep="first")]
    logger.info("Raw matrix: %d genes × %d samples", expr.shape[0], expr.shape[1])

    # Transpose to samples × genes
    expr = expr.T
    expr.index.name = "sample_id"
    expr = expr.reset_index()

    # Extract case_id from TCGA barcode (first 12 characters)
    expr["case_id"] = expr["sample_id"].str[:12]

    # Keep only primary tumor samples (barcode position 13-14 == "01")
    sample_type = expr["sample_id"].str[13:15]
    primary_mask = sample_type == "01"
    expr = expr[primary_mask].copy()
    logger.info("Primary tumor samples: %d", len(expr))

    # Deduplicate by case_id (keep first if multiple)
    expr = expr.drop_duplicates(subset="case_id", keep="first")
    logger.info("Unique cases: %d", len(expr))

    # Extract cancer type from barcode
    # TCGA barcode: TCGA-XX-XXXX where XX at positions 5-6 is the TSS
    # We need phenotype data for cancer type mapping
    pheno = load_phenotype()
    expr = expr.merge(
        pheno.rename(columns={"sample_id": "sample_id_pheno"}),
        left_on="sample_id",
        right_on="sample_id_pheno",
        how="left",
    )

    # Map full disease names to TCGA codes
    cancer_type_map = _build_cancer_type_map()
    expr["cancer_type"] = expr["cancer_type_full"].map(cancer_type_map)
    expr = expr.dropna(subset=["cancer_type"])

    # Select final columns
    gene_cols = [
        c
        for c in expr.columns
        if c not in {"sample_id", "case_id", "cancer_type", "sample_id_pheno", "cancer_type_full"}
    ]
    final_cols = ["case_id", "cancer_type"] + gene_cols
    expr = expr[final_cols]

    logger.info("Final matrix: %d samples × %d genes", len(expr), len(gene_cols))

    # Save
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    expr.to_parquet(output_path, index=False)
    logger.info("Saved: %s (%.1f MB)", output_path, output_path.stat().st_size / 1e6)


def _build_cancer_type_map() -> dict[str, str]:
    """Map TCGA full disease names to short cancer type codes."""
    return {
        "acute myeloid leukemia": "LAML",
        "adrenocortical cancer": "ACC",
        "bile duct cancer": "CHOL",
        "bladder urothelial carcinoma": "BLCA",
        "brain lower grade glioma": "LGG",
        "breast invasive carcinoma": "BRCA",
        "cervical & endocervical cancer": "CESC",
        "colon adenocarcinoma": "COAD",
        "diffuse large B-cell lymphoma": "DLBC",
        "esophageal carcinoma": "ESCA",
        "glioblastoma multiforme": "GBM",
        "head & neck squamous cell carcinoma": "HNSC",
        "kidney chromophobe": "KICH",
        "kidney clear cell carcinoma": "KIRC",
        "kidney papillary cell carcinoma": "KIRP",
        "liver hepatocellular carcinoma": "LIHC",
        "lung adenocarcinoma": "LUAD",
        "lung squamous cell carcinoma": "LUSC",
        "mesothelioma": "MESO",
        "ovarian serous cystadenocarcinoma": "OV",
        "pancreatic adenocarcinoma": "PAAD",
        "pheochromocytoma & paraganglioma": "PCPG",
        "prostate adenocarcinoma": "PRAD",
        "rectum adenocarcinoma": "READ",
        "sarcoma": "SARC",
        "skin cutaneous melanoma": "SKCM",
        "stomach adenocarcinoma": "STAD",
        "testicular germ cell tumor": "TGCT",
        "thymoma": "THYM",
        "thyroid carcinoma": "THCA",
        "uterine carcinosarcoma": "UCS",
        "uterine corpus endometrioid carcinoma": "UCEC",
        "uveal melanoma": "UVM",
    }


if __name__ == "__main__":
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    process_expression()
