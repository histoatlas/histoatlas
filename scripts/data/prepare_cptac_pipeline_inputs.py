"""Prepare CPTAC molecular data for the Snakemake pipeline.

Normalizes case IDs (strips X-prefix to match slide features),
drops LUSC (no histomics available), and writes unprefixed files
to data/datasets/cptac/processed/molecular/.
"""

import logging
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from _cptac_id_mapping import normalize_published_id

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CPTAC_DIR = PROJECT_ROOT / "data" / "processed" / "molecular" / "cptac"
OUTPUT_DIR = PROJECT_ROOT / "data" / "datasets" / "cptac" / "processed" / "molecular"

# (input_stem, output_stem, id_columns_to_normalize, cancer_type_column_for_lusc_filter)
FILES = [
    ("cptac_clinical_unified", "clinical_unified", ["case_id"], "cancer_type"),
    ("cptac_expression_curated", "expression_curated", ["case_id", "patientId"], "cancer_type"),
    ("cptac_expression_full", "expression_full", ["case_id", "patientId"], "cancer_type"),
    ("cptac_mutations", "mutations", ["sample_id"], "cancer_type"),
    ("cptac_cnv", "cnv", ["sample_id", "case_id"], "cancer_type"),
    ("cptac_clinical_sample", "clinical_sample", ["patientId", "sampleId"], None),
    ("cptac_clinical_patient", "clinical_patient", ["patientId"], None),
    ("cptac_proteomics", "proteomics", ["case_id", "patientId"], "cancer_type"),
]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Build set of LUSC patient IDs (both raw and normalized) for cross-file filtering
    clinical = pd.read_parquet(CPTAC_DIR / "cptac_clinical_unified.parquet")
    lusc_ids_raw = set(clinical.loc[clinical["cancer_type"] == "LUSC", "case_id"])
    lusc_ids_normalized = {normalize_published_id(cid) for cid in lusc_ids_raw}
    lusc_ids = lusc_ids_raw | lusc_ids_normalized
    logger.info(f"LUSC patient IDs to exclude: {len(lusc_ids_raw)} raw, {len(lusc_ids)} total")

    for input_stem, output_stem, id_cols, cancer_col in FILES:
        input_path = CPTAC_DIR / f"{input_stem}.parquet"
        output_path = OUTPUT_DIR / f"{output_stem}.parquet"

        if not input_path.exists():
            logger.warning(f"  SKIP {input_stem}: file not found")
            continue

        df = pd.read_parquet(input_path)
        n_before = len(df)

        # Drop LUSC rows
        if cancer_col and cancer_col in df.columns:
            df = df[df[cancer_col] != "LUSC"]
        else:
            # Fall back to matching patient IDs against known LUSC set
            for col in id_cols:
                if col in df.columns:
                    df = df[~df[col].isin(lusc_ids)]
                    break

        n_after_lusc = len(df)

        # Normalize IDs (strip X-prefix)
        for col in id_cols:
            if col in df.columns:
                df[col] = df[col].map(normalize_published_id)

        df.to_parquet(output_path, index=False)
        logger.info(
            f"  {output_stem}: {n_before} -> {n_after_lusc} rows "
            f"(dropped {n_before - n_after_lusc} LUSC), saved to {output_path.name}"
        )

    # Verify overlap
    slide_src = PROJECT_ROOT / "data" / "cptac_slide_level_features.parquet"
    if slide_src.exists():
        logger.info("\n  Verifying case_id overlap after normalization:")
        slides = pd.read_parquet(slide_src, columns=["case_id", "cancer_type"])
        clinical_out = pd.read_parquet(OUTPUT_DIR / "clinical_unified.parquet")
        for ct in sorted(slides["cancer_type"].unique()):
            slide_ids = set(slides.loc[slides["cancer_type"] == ct, "case_id"])
            clin_ids = set(clinical_out.loc[clinical_out["cancer_type"] == ct, "case_id"])
            overlap = slide_ids & clin_ids
            logger.info(
                f"    {ct}: {len(slide_ids)} slides, {len(clin_ids)} molecular, "
                f"{len(overlap)} overlap"
            )


if __name__ == "__main__":
    main()
