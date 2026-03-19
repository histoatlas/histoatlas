"""
Shared configuration for analysis scripts.

This module provides dry-run detection and settings that are shared
across all analysis scripts. The dry-run mode uses a subset of data
to enable quick testing of the full pipeline.

Usage:
    from _config import get_dry_run_settings

    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_types = cancer_types[:dry_run.n_cancer_types]
        features = features[:dry_run.n_features]
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class DryRunSettings:
    """Settings for dry-run mode to subset data for quick testing.

    These settings enable running the full pipeline in ~5 minutes
    by reducing the number of cancer types, features, samples, etc.
    """

    n_cancer_types: int = 3
    n_features: int = 10
    max_samples: int = 500
    n_genes: int = 5
    n_mutations: int = 3
    n_pathways: int = 3
    n_neighbors: int = 5
    n_bootstrap: int = 10
    n_perm: int = 100


def is_dry_run() -> bool:
    """Check if running in dry-run mode via data path.

    Returns True if HISTOATLAS_DATA_ROOT contains 'dry_run'.
    """
    data_root = os.environ.get("HISTOATLAS_DATA_ROOT", "")
    return "dry_run" in data_root.lower()


def get_dry_run_settings() -> DryRunSettings | None:
    """Get dry-run settings if in dry-run mode.

    Returns:
        DryRunSettings instance if in dry-run mode, None otherwise.
    """
    if is_dry_run():
        return DryRunSettings()
    return None


def get_dataset_name() -> str:
    """Get the active dataset name (e.g., 'tcga', 'cptac')."""
    return os.environ.get("HISTOATLAS_DATASET", "tcga")


def include_pancan() -> bool:
    """Check if pan-cancer analyses (PANCAN cohort + L1 clustering) are enabled."""
    return os.environ.get("HISTOATLAS_INCLUDE_PANCAN", "true").lower() == "true"


def get_batch_proxy_column() -> str | None:
    """Get batch proxy column name (e.g. 'tss' for TCGA), or None to skip."""
    val = os.environ.get("HISTOATLAS_BATCH_PROXY_COLUMN", "")
    return val if val else None


def get_in_distribution_cancer_types() -> frozenset[str] | None:
    """Get in-distribution cancer types for OOD analysis, or None to skip."""
    val = os.environ.get("HISTOATLAS_IN_DISTRIBUTION_TYPES", "")
    return frozenset(val.split(",")) if val else None
