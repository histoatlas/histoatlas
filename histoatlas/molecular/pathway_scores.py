"""Pathway score computation via ssGSEA on MSigDB Hallmark gene sets."""

import logging

import gseapy as gp
import numpy as np
import pandas as pd

from histoatlas.config.gene_sets import HALLMARK_PATHWAYS

logger = logging.getLogger(__name__)

# MSigDB Hallmark library name (gseapy resolves the latest version automatically)
_HALLMARK_LIBRARY = "MSigDB_Hallmark_2020"

# Mapping from Enrichr short names (MSigDB_Hallmark_2020) to canonical
# HALLMARK_* names used throughout the codebase and paper.  The Enrichr
# mirror uses human-readable short names (e.g. "Adipogenesis") whereas
# MSigDB's native .gmt files use "HALLMARK_ADIPOGENESIS".
_ENRICHR_TO_HALLMARK: dict[str, str] = {
    "Adipogenesis": "HALLMARK_ADIPOGENESIS",
    "Allograft Rejection": "HALLMARK_ALLOGRAFT_REJECTION",
    "Androgen Response": "HALLMARK_ANDROGEN_RESPONSE",
    "Angiogenesis": "HALLMARK_ANGIOGENESIS",
    "Apical Junction": "HALLMARK_APICAL_JUNCTION",
    "Apical Surface": "HALLMARK_APICAL_SURFACE",
    "Apoptosis": "HALLMARK_APOPTOSIS",
    "Bile Acid Metabolism": "HALLMARK_BILE_ACID_METABOLISM",
    "Cholesterol Homeostasis": "HALLMARK_CHOLESTEROL_HOMEOSTASIS",
    "Coagulation": "HALLMARK_COAGULATION",
    "Complement": "HALLMARK_COMPLEMENT",
    "DNA Repair": "HALLMARK_DNA_REPAIR",
    "E2F Targets": "HALLMARK_E2F_TARGETS",
    "Epithelial Mesenchymal Transition": "HALLMARK_EPITHELIAL_MESENCHYMAL_TRANSITION",
    "Estrogen Response Early": "HALLMARK_ESTROGEN_RESPONSE_EARLY",
    "Estrogen Response Late": "HALLMARK_ESTROGEN_RESPONSE_LATE",
    "Fatty Acid Metabolism": "HALLMARK_FATTY_ACID_METABOLISM",
    "G2M Checkpoint": "HALLMARK_G2M_CHECKPOINT",
    "G2-M Checkpoint": "HALLMARK_G2M_CHECKPOINT",  # Enrichr alternate name
    "Glycolysis": "HALLMARK_GLYCOLYSIS",
    "Hedgehog Signaling": "HALLMARK_HEDGEHOG_SIGNALING",
    "Heme Metabolism": "HALLMARK_HEME_METABOLISM",
    "heme Metabolism": "HALLMARK_HEME_METABOLISM",  # Enrichr alternate casing
    "Hypoxia": "HALLMARK_HYPOXIA",
    "IL-2/STAT5 Signaling": "HALLMARK_IL2_STAT5_SIGNALING",
    "IL-6/JAK/STAT3 Signaling": "HALLMARK_IL6_JAK_STAT3_SIGNALING",
    "Inflammatory Response": "HALLMARK_INFLAMMATORY_RESPONSE",
    "Interferon Alpha Response": "HALLMARK_INTERFERON_ALPHA_RESPONSE",
    "Interferon Gamma Response": "HALLMARK_INTERFERON_GAMMA_RESPONSE",
    "KRAS Signaling Dn": "HALLMARK_KRAS_SIGNALING_DN",
    "KRAS Signaling Up": "HALLMARK_KRAS_SIGNALING_UP",
    "Mitotic Spindle": "HALLMARK_MITOTIC_SPINDLE",
    "MTORC1 Signaling": "HALLMARK_MTORC1_SIGNALING",
    "mTORC1 Signaling": "HALLMARK_MTORC1_SIGNALING",  # Enrichr alternate casing
    "MYC Targets V1": "HALLMARK_MYC_TARGETS_V1",
    "Myc Targets V1": "HALLMARK_MYC_TARGETS_V1",  # Enrichr alternate casing
    "MYC Targets V2": "HALLMARK_MYC_TARGETS_V2",
    "Myc Targets V2": "HALLMARK_MYC_TARGETS_V2",  # Enrichr alternate casing
    "Myogenesis": "HALLMARK_MYOGENESIS",
    "Notch Signaling": "HALLMARK_NOTCH_SIGNALING",
    "Oxidative Phosphorylation": "HALLMARK_OXIDATIVE_PHOSPHORYLATION",
    "p53 Pathway": "HALLMARK_P53_PATHWAY",
    "Pancreas Beta Cells": "HALLMARK_PANCREAS_BETA_CELLS",
    "Peroxisome": "HALLMARK_PEROXISOME",
    "Pperoxisome": "HALLMARK_PEROXISOME",  # Enrichr typo
    "PI3K/AKT/MTOR Signaling": "HALLMARK_PI3K_AKT_MTOR_SIGNALING",
    "PI3K/AKT/mTOR  Signaling": "HALLMARK_PI3K_AKT_MTOR_SIGNALING",  # Enrichr alternate (note double space)
    "Protein Secretion": "HALLMARK_PROTEIN_SECRETION",
    "Reactive Oxygen Species Pathway": "HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY",
    "Spermatogenesis": "HALLMARK_SPERMATOGENESIS",
    "TGF Beta Signaling": "HALLMARK_TGF_BETA_SIGNALING",
    "TGF-beta Signaling": "HALLMARK_TGF_BETA_SIGNALING",  # Enrichr alternate name
    "TNFa Signaling via NFkB": "HALLMARK_TNFA_SIGNALING_VIA_NFKB",
    "TNF-alpha Signaling via NF-kB": "HALLMARK_TNFA_SIGNALING_VIA_NFKB",  # Enrichr alternate name
    "Unfolded Protein Response": "HALLMARK_UNFOLDED_PROTEIN_RESPONSE",
    "UV Response Dn": "HALLMARK_UV_RESPONSE_DN",
    "UV Response Up": "HALLMARK_UV_RESPONSE_UP",
    "Wnt Beta Catenin Signaling": "HALLMARK_WNT_BETA_CATENIN_SIGNALING",
    "Wnt-beta Catenin Signaling": "HALLMARK_WNT_BETA_CATENIN_SIGNALING",  # Enrichr alternate name
    "Xenobiotic Metabolism": "HALLMARK_XENOBIOTIC_METABOLISM",
}


def load_hallmark_gene_sets() -> dict[str, list[str]]:
    """Load the 50 MSigDB Hallmark gene sets via gseapy.

    Returns gene sets keyed by canonical HALLMARK_* names (not Enrichr
    short names) so that column names propagated through ssGSEA are
    consistent with ``HALLMARK_PATHWAYS``, paper figures, and the rest
    of the codebase.
    """
    raw_sets = gp.get_library(name=_HALLMARK_LIBRARY)

    # Rename keys from Enrichr short names to canonical HALLMARK_* names
    hallmark_sets: dict[str, list[str]] = {}
    unmapped: list[str] = []
    for enrichr_name, genes in raw_sets.items():
        canonical = _ENRICHR_TO_HALLMARK.get(enrichr_name)
        if canonical is None:
            unmapped.append(enrichr_name)
            # Fall back to raw name so we don't silently drop gene sets
            hallmark_sets[enrichr_name] = genes
        else:
            hallmark_sets[canonical] = genes

    if unmapped:
        logger.warning("Enrichr gene set names not in mapping (kept as-is): %s", unmapped)

    # Sanity-check: every expected HALLMARK pathway should be present
    missing = set(HALLMARK_PATHWAYS) - set(hallmark_sets.keys())
    if missing:
        logger.warning("Expected HALLMARK pathways missing from Enrichr library: %s", missing)

    return hallmark_sets


def compute_hallmark_ssgsea(
    expr_df: pd.DataFrame,
    min_size: int = 10,
    threads: int = 4,
) -> pd.DataFrame:
    """Compute ssGSEA scores for 50 MSigDB Hallmark pathways.

    Args:
        expr_df: Expression DataFrame with genes as columns and samples as rows.
                 Must contain ``case_id`` and ``cancer_type`` columns.
        min_size: Minimum gene set size after intersection with expression genes.
        threads: Number of parallel threads for ssGSEA.

    Returns:
        DataFrame with columns ``[case_id, cancer_type, <pathway>, ...]``.
        Pathway column names use canonical HALLMARK_* format
        (e.g. "HALLMARK_ADIPOGENESIS", "HALLMARK_APOPTOSIS").
        Scores are ssGSEA normalized enrichment scores (sample-level).
    """
    meta_cols = ["case_id", "cancer_type"]
    meta = expr_df[meta_cols].copy()

    # Expression matrix: samples × genes (numeric only, exclude all metadata)
    gene_cols = [
        c
        for c in expr_df.columns
        if c not in meta_cols and pd.api.types.is_numeric_dtype(expr_df[c])
    ]
    expr_matrix = expr_df[gene_cols].copy()
    expr_matrix.index = expr_df["case_id"].values

    hallmark_sets = load_hallmark_gene_sets()
    logger.info(
        "Loaded %d Hallmark gene sets (%d genes in expression matrix)",
        len(hallmark_sets),
        len(gene_cols),
    )

    # Run ssGSEA — gseapy expects samples as columns, genes as rows
    ss = gp.ssgsea(
        data=expr_matrix.T,
        gene_sets=hallmark_sets,
        outdir=None,
        min_size=min_size,
        threads=threads,
        verbose=False,
        no_plot=True,
    )

    # Extract score matrix: pivot long-format res2d to samples × pathways
    # gseapy versions vary on whether ssGSEA produces NES or ES; use NES if available
    score_col = "NES" if "NES" in ss.res2d.columns else "ES"
    scores_df = ss.res2d.pivot(index="Name", columns="Term", values=score_col)
    scores_df.index.name = None
    scores_df.columns.name = None

    # Align with input metadata
    scores_df = scores_df.reindex(meta["case_id"].values)
    scores_df.insert(0, "case_id", meta["case_id"].values)
    scores_df.insert(1, "cancer_type", meta["cancer_type"].values)
    scores_df = scores_df.reset_index(drop=True)

    # Convert score columns to float
    pathway_cols = [c for c in scores_df.columns if c not in meta_cols]
    scores_df[pathway_cols] = scores_df[pathway_cols].astype(float)

    logger.info(
        "ssGSEA complete: %d samples × %d pathways",
        len(scores_df),
        len(pathway_cols),
    )

    return scores_df


def cnv_to_category(value: float) -> str | float:
    """Map GISTIC-like CNV values to categorical calls.

    Args:
        value: Numeric CNV value (typically -2, -1, 0, 1, 2 from GISTIC)

    Returns:
        "Deletion", "Neutral", "Amplification", or np.nan
    """
    if pd.isna(value):
        return np.nan
    try:
        val = float(value)
    except (TypeError, ValueError):
        return np.nan
    if val <= -1:
        return "Deletion"
    if val >= 1:
        return "Amplification"
    return "Neutral"
