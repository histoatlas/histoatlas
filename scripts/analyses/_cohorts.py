"""
Shared cohort builder for pan-cancer and per-cancer analyses.

Provides a single helper that builds per-cancer DataFrames and optionally
adds a PANCAN pooled cohort, eliminating the duplicated pattern across
survival, mutation, treatment, and correlation scripts.
"""

import pandas as pd
from _config import include_pancan


def build_cancer_cohorts(
    df: pd.DataFrame,
    cancer_types: list[str],
) -> dict[str, tuple[pd.DataFrame, list[str] | None]]:
    """Build per-cancer DataFrames, optionally including PANCAN pooled cohort.

    Returns dict: cancer_label -> (dataframe, cox_strata).
    PANCAN gets strata=["cancer_type"], per-cancer gets strata=None.
    """
    cohorts: dict[str, tuple[pd.DataFrame, list[str] | None]] = {}
    for cancer in cancer_types:
        cohorts[cancer] = (df[df["cancer_type"] == cancer].copy(), None)

    if include_pancan():
        cohorts["PANCAN"] = (df.copy(), ["cancer_type"])

    return cohorts
