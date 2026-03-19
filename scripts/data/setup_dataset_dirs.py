"""Populate data/datasets/{tcga,cptac}/ from existing data files.

One-time idempotent setup script. Creates per-dataset input directories
with the unprefixed file names expected by the Snakemake pipeline.

Usage:
    uv run python scripts/data/setup_dataset_dirs.py
"""

import logging
import shutil
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from _cptac_id_mapping import normalize_published_id

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
DATASETS_DIR = DATA_DIR / "datasets"
MOLECULAR_DIR = DATA_DIR / "processed" / "molecular"
CPTAC_MOLECULAR_DIR = MOLECULAR_DIR / "cptac"


def setup_tcga() -> None:
    """Populate data/datasets/tcga/ from tcga_*-prefixed originals."""
    tcga_dir = DATASETS_DIR / "tcga"
    mol_dir = tcga_dir / "processed" / "molecular"
    mol_dir.mkdir(parents=True, exist_ok=True)

    # Copy tcga_*-prefixed molecular files, stripping the prefix
    tcga_files = sorted(MOLECULAR_DIR.glob("tcga_*.parquet"))
    if not tcga_files:
        logger.warning("No tcga_*.parquet files found in %s", MOLECULAR_DIR)
    for src in tcga_files:
        stem = src.stem.removeprefix("tcga_")
        dst = mol_dir / f"{stem}.parquet"
        if dst.exists():
            logger.info("  SKIP %s (already exists)", dst.relative_to(DATA_DIR))
            continue
        shutil.copy2(src, dst)
        logger.info("  COPY %s -> %s", src.name, dst.relative_to(DATA_DIR))

    # Symlink TCGA-only assets
    _symlink(tcga_dir / "tile_level_features.parquet", Path("../../tile_level_features.parquet"))
    _symlink(tcga_dir / "immune_subtypes.xlsx", Path("../../immune_subtypes.xlsx"))
    _symlink(tcga_dir / "representative_tiles", Path("../../visual_assets/representative_tiles"))

    # slide_level_features.parquet — check if original TCGA file exists
    slide_src = DATA_DIR / "slide_level_features.parquet"
    slide_dst = tcga_dir / "slide_level_features.parquet"
    if slide_dst.exists() or slide_dst.is_symlink():
        logger.info("  SKIP %s (already exists)", slide_dst.relative_to(DATA_DIR))
    elif slide_src.exists() and not slide_src.is_symlink():
        # Original file (not a symlink to CPTAC) — copy it
        shutil.copy2(slide_src, slide_dst)
        logger.info("  COPY %s -> %s", slide_src.name, slide_dst.relative_to(DATA_DIR))
    elif (DATA_DIR / "tcga_slide_level_features.parquet").exists():
        # Explicit TCGA copy exists
        shutil.copy2(DATA_DIR / "tcga_slide_level_features.parquet", slide_dst)
        logger.info(
            "  COPY tcga_slide_level_features.parquet -> %s", slide_dst.relative_to(DATA_DIR)
        )
    else:
        logger.warning(
            "  WARNING: No TCGA slide_level_features.parquet found.\n"
            "  You must regenerate it from the remote machine:\n"
            "    uv run python scripts/data/create_slide_level_parquet_features.py "
            "/path/to/tcga/histomics --output data/datasets/tcga/slide_level_features.parquet"
        )

    logger.info("TCGA dataset directory ready: %s", tcga_dir.relative_to(PROJECT_ROOT))


def setup_cptac() -> None:
    """Populate data/datasets/cptac/ with normalized CPTAC data."""

    cptac_dir = DATASETS_DIR / "cptac"
    mol_dir = cptac_dir / "processed" / "molecular"
    mol_dir.mkdir(parents=True, exist_ok=True)

    # Symlink slide_level_features.parquet
    _symlink(
        cptac_dir / "slide_level_features.parquet",
        Path("../../cptac_slide_level_features.parquet"),
    )

    # Normalize and write CPTAC molecular files
    # (Same logic as prepare_cptac_pipeline_inputs.py)
    files = [
        ("cptac_clinical_unified", "clinical_unified", ["case_id"], "cancer_type"),
        ("cptac_expression_curated", "expression_curated", ["case_id", "patientId"], "cancer_type"),
        ("cptac_expression_full", "expression_full", ["case_id", "patientId"], "cancer_type"),
        ("cptac_mutations", "mutations", ["sample_id"], "cancer_type"),
        ("cptac_cnv", "cnv", ["sample_id", "case_id"], "cancer_type"),
        ("cptac_clinical_sample", "clinical_sample", ["patientId", "sampleId"], None),
        ("cptac_clinical_patient", "clinical_patient", ["patientId"], None),
    ]

    # Build LUSC exclusion set
    clinical_path = CPTAC_MOLECULAR_DIR / "cptac_clinical_unified.parquet"
    if not clinical_path.exists():
        logger.warning("CPTAC clinical file not found: %s", clinical_path)
        return

    clinical = pd.read_parquet(clinical_path)
    lusc_ids_raw = set(clinical.loc[clinical["cancer_type"] == "LUSC", "case_id"])
    lusc_ids_normalized = {normalize_published_id(cid) for cid in lusc_ids_raw}
    lusc_ids = lusc_ids_raw | lusc_ids_normalized
    logger.info("  LUSC IDs to exclude: %d", len(lusc_ids))

    for input_stem, output_stem, id_cols, cancer_col in files:
        input_path = CPTAC_MOLECULAR_DIR / f"{input_stem}.parquet"
        output_path = mol_dir / f"{output_stem}.parquet"

        if output_path.exists():
            logger.info("  SKIP %s (already exists)", output_path.relative_to(DATA_DIR))
            continue

        if not input_path.exists():
            logger.warning("  SKIP %s: file not found", input_stem)
            continue

        df = pd.read_parquet(input_path)
        n_before = len(df)

        # Drop LUSC rows
        if cancer_col and cancer_col in df.columns:
            df = df[df[cancer_col] != "LUSC"]
        else:
            for col in id_cols:
                if col in df.columns:
                    df = df[~df[col].isin(lusc_ids)]
                    break

        n_after = len(df)

        # Normalize IDs
        for col in id_cols:
            if col in df.columns:
                df[col] = df[col].map(normalize_published_id)

        df.to_parquet(output_path, index=False)
        logger.info(
            "  %s: %d -> %d rows (dropped %d LUSC), saved",
            output_stem,
            n_before,
            n_after,
            n_before - n_after,
        )

    logger.info("CPTAC dataset directory ready: %s", cptac_dir.relative_to(PROJECT_ROOT))


def _symlink(link_path: Path, points_to: Path) -> None:
    """Create a relative symlink, skipping if it already exists.

    Args:
        link_path: Where the symlink file is created on disk.
        points_to: Relative path the symlink resolves to (from link_path's parent).
    """
    if link_path.exists() or link_path.is_symlink():
        logger.info("  SKIP %s (already exists)", link_path.name)
        return
    link_path.symlink_to(points_to)
    logger.info("  LINK %s -> %s", link_path.name, points_to)


def main() -> None:
    logger.info("Setting up dataset directories in %s", DATASETS_DIR.relative_to(PROJECT_ROOT))
    logger.info("")

    logger.info("=== TCGA ===")
    setup_tcga()
    logger.info("")

    logger.info("=== CPTAC ===")
    setup_cptac()
    logger.info("")

    logger.info("Done. You can now run:")
    logger.info("  snakemake --cores 4 --config dataset=tcga")
    logger.info("  snakemake --cores 4 --config dataset=cptac")


if __name__ == "__main__":
    main()
