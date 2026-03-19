"""Quality control (QC) flags for HistoAtlas slides."""

from histoatlas.qc.flags import (
    add_qc_flags_to_slides,
    compute_extreme_outlier_flags,
    compute_missingness_flags,
    compute_tile_coverage_flags,
)

__all__ = [
    "compute_tile_coverage_flags",
    "compute_extreme_outlier_flags",
    "compute_missingness_flags",
    "add_qc_flags_to_slides",
]
