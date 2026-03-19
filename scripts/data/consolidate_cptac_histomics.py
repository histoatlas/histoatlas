"""Concatenate per-slide CPTAC histomic CSVs into a single parquet file.

Walks ~/Desktop/histomics/CPTAC_{cohort}/{slide_name}.svs/slide_level_features.csv,
derives cancer_type / slide_name / case_id from folder structure, adds missing
fallback columns, and writes data/cptac_slide_level_features.parquet matching the
TCGA schema (plus a case_id column).
"""

import logging
import re
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

HISTOMICS_ROOT = Path.home() / "Desktop" / "histomics"
OUTPUT_PATH = _PROJECT_ROOT / "data" / "cptac_slide_level_features.parquet"
TCGA_PATH = _PROJECT_ROOT / "data" / "slide_level_features.parquet"

COHORTS = ["CPTAC_BRCA", "CPTAC_HNSCC", "CPTAC_LUAD", "CPTAC_PDA", "CPTAC_UCEC"]

# Map folder-derived cancer type codes to standardized TCGA codes.
# Most CPTAC folder names match the standard (e.g. CPTAC_BRCA -> BRCA),
# but some don't (e.g. CPTAC_PDA -> should be PAAD, not PDA).
_CANCER_TYPE_OVERRIDE: dict[str, str] = {
    "PDA": "PAAD",
}

# Regex for C3L/C3N slide names: C3{L,N}-XXXXX-NN.svs
_C3_PATTERN = re.compile(r"^(C3[LN]-\d{5})-\d+\.svs$")

# Regex for BRCA slide names: ZZBRXXX-uuid.svs
_BRCA_PATTERN = re.compile(r"^(\d{2}BR\d{3})-[0-9a-f].*\.svs$")

# Regex for LUAD UUID slide names: uuid_region.svs
_UUID_PATTERN = re.compile(r"^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]+)_.+\.svs$")


def extract_case_id(slide_name: str, cancer_type: str) -> str:
    """Extract patient-level case_id from a CPTAC slide folder name."""
    if cancer_type == "BRCA":
        m = _BRCA_PATTERN.match(slide_name)
        if m:
            return m.group(1)
        raise ValueError(f"Cannot extract case_id from BRCA slide: {slide_name}")

    # C3L/C3N pattern (HNSCC, LUAD, PAAD, UCEC)
    m = _C3_PATTERN.match(slide_name)
    if m:
        return m.group(1)

    # LUAD UUID pattern
    if cancer_type == "LUAD":
        m = _UUID_PATTERN.match(slide_name)
        if m:
            return m.group(1)

    raise ValueError(f"Cannot extract case_id from {cancer_type} slide: {slide_name}")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    # Load TCGA schema for column ordering
    tcga_columns = pq.read_schema(TCGA_PATH).names

    rows: list[dict] = []
    errors: list[str] = []

    for cohort in COHORTS:
        cohort_dir = HISTOMICS_ROOT / cohort
        raw_type = cohort.removeprefix("CPTAC_")
        cancer_type = _CANCER_TYPE_OVERRIDE.get(raw_type, raw_type)

        if not cohort_dir.exists():
            logger.warning("Missing cohort directory: %s", cohort_dir)
            continue

        slide_dirs = sorted(
            d for d in cohort_dir.iterdir() if d.is_dir() and d.name.endswith(".svs")
        )

        for slide_dir in slide_dirs:
            csv_path = slide_dir / "slide_level_features.csv"
            if not csv_path.exists():
                errors.append(f"Missing CSV: {csv_path}")
                continue

            df_row = pd.read_csv(csv_path)
            if len(df_row) != 1:
                errors.append(f"Expected 1 row, got {len(df_row)}: {csv_path}")
                continue

            record = df_row.iloc[0].to_dict()
            slide_name = slide_dir.name

            try:
                case_id = extract_case_id(slide_name, cancer_type)
            except ValueError as e:
                errors.append(str(e))
                continue

            record["cancer_type"] = cancer_type
            record["slide_name"] = slide_name
            record["case_id"] = case_id
            rows.append(record)

    if errors:
        logger.warning("Encountered %d errors:", len(errors))
        for err in errors:
            logger.warning("  %s", err)

    if not rows:
        logger.error("No slides found across any cohort -- nothing to write.")
        return

    df = pd.DataFrame(rows)

    # Add fallback columns (and any other TCGA columns missing from CPTAC) as NaN
    feature_columns = [c for c in tcga_columns if c not in ("cancer_type", "slide_name")]
    for col in feature_columns:
        if col not in df.columns:
            df[col] = float("nan")

    # Warn about CPTAC columns that will be dropped (not in TCGA schema)
    meta_cols = {"cancer_type", "slide_name", "case_id"}
    dropped = set(df.columns) - set(feature_columns) - meta_cols
    if dropped:
        logger.warning("Dropping %d CPTAC columns not in TCGA schema: %s", len(dropped), dropped)

    # Reorder: cancer_type, slide_name, case_id, then remaining TCGA columns
    final_columns = ["cancer_type", "slide_name", "case_id"] + feature_columns
    df = df[final_columns]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)

    # Summary
    logger.info("Wrote %s (%d rows × %d columns)", OUTPUT_PATH, len(df), len(df.columns))
    logger.info("")
    logger.info("Slides per cohort:")
    for cancer_type, count in df["cancer_type"].value_counts().sort_index().items():
        n_cases = df.loc[df["cancer_type"] == cancer_type, "case_id"].nunique()
        logger.info("  %s: %d slides, %d unique case_ids", cancer_type, count, n_cases)

    logger.info("")
    null_case_ids = df["case_id"].isna().sum()
    logger.info("Null case_ids: %d", null_case_ids)

    # Duplicate case_id stats
    logger.info("")
    logger.info("Duplicate case_ids per cohort (patients with multiple slides):")
    for cancer_type in sorted(df["cancer_type"].unique()):
        subset = df[df["cancer_type"] == cancer_type]
        dup_cases = subset["case_id"].value_counts()
        n_dup = (dup_cases > 1).sum()
        logger.info("  %s: %d patients with >1 slide", cancer_type, n_dup)

    # Schema check vs TCGA
    tcga_set = set(tcga_columns)
    cptac_set = set(final_columns) - {"case_id"}
    missing = tcga_set - cptac_set
    extra = cptac_set - tcga_set
    if missing:
        logger.warning("Columns in TCGA but missing from CPTAC: %s", missing)
    if extra:
        logger.warning("Columns in CPTAC but not in TCGA: %s", extra)
    if not missing and not extra:
        logger.info("")
        logger.info("Schema matches TCGA (plus case_id column).")


if __name__ == "__main__":
    main()
