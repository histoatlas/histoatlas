"""Configuration constants for HistoAtlas analysis."""

from histoatlas.config.cancer_metadata import CANCER_FULL_NAMES, CANCER_TYPE_COLORS
from histoatlas.config.evidence_thresholds import (
    MODERATE_EFFECT_THRESHOLDS,
    N_INSUFFICIENT,
    N_MODERATE,
    N_STRONG,
    P_MODERATE,
    P_STRONG,
    P_SUGGESTIVE,
    STRONG_EFFECT_THRESHOLDS,
)
from histoatlas.config.feature_metadata import FEATURE_METADATA
from histoatlas.config.gene_sets import AVAILABLE_GENES, HALLMARK_PATHWAYS
from histoatlas.config.horizons import (
    CANCER_SPECIFIC_HORIZONS,
    DEFAULT_HORIZON_DAYS,
    get_horizon_for_cancer,
)

__all__ = [
    # Gene sets
    "HALLMARK_PATHWAYS",
    "AVAILABLE_GENES",
    # Cancer metadata
    "CANCER_TYPE_COLORS",
    "CANCER_FULL_NAMES",
    # Feature metadata
    "FEATURE_METADATA",
    # Horizons
    "DEFAULT_HORIZON_DAYS",
    "CANCER_SPECIFIC_HORIZONS",
    "get_horizon_for_cancer",
    # Evidence thresholds
    "STRONG_EFFECT_THRESHOLDS",
    "MODERATE_EFFECT_THRESHOLDS",
    "N_STRONG",
    "N_MODERATE",
    "N_INSUFFICIENT",
    "P_STRONG",
    "P_MODERATE",
    "P_SUGGESTIVE",
]
