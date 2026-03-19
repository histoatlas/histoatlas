"""Statistical analysis utilities for HistoAtlas."""

from histoatlas.analysis.batch_effects import (
    compute_batch_effect_summary,
    compute_per_cancer_batch_effects,
    compute_pvca,
    compute_silhouette_by_batch,
)
from histoatlas.analysis.evidence import (
    evidence_badge_categorical,
    evidence_badge_correlation,
    evidence_badge_survival,
)
from histoatlas.analysis.multiple_testing import apply_bh_correction
from histoatlas.analysis.power import (
    ci_width_category,
    mdes_correlation,
    mdes_kruskal_wallis,
    mdes_mann_whitney,
    mdes_survival,
)

__all__ = [
    # Multiple testing
    "apply_bh_correction",
    # Power analysis
    "mdes_survival",
    "mdes_correlation",
    "mdes_mann_whitney",
    "mdes_kruskal_wallis",
    "ci_width_category",
    # Evidence badges
    "evidence_badge_survival",
    "evidence_badge_correlation",
    "evidence_badge_categorical",
    # Batch effects
    "compute_pvca",
    "compute_silhouette_by_batch",
    "compute_batch_effect_summary",
    "compute_per_cancer_batch_effects",
]
