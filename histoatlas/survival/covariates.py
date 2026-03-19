"""Covariate preparation for adjusted Cox models."""

import logging

import pandas as pd

logger = logging.getLogger(__name__)

# Map AJCC substages to major stage categories (I/II/III/IV).
# Handles both TCGA long-form ("STAGE IIA") and CPTAC short-form ("2A").
# Rare or ambiguous values are mapped to None (excluded from adjusted models).
_STAGE_MAP: dict[str, str | None] = {
    # TCGA long-form
    "STAGE I": "I",
    "STAGE IA": "I",
    "STAGE IB": "I",
    "STAGE II": "II",
    "STAGE IIA": "II",
    "STAGE IIB": "II",
    "STAGE IIC": "II",
    "STAGE III": "III",
    "STAGE IIIA": "III",
    "STAGE IIIB": "III",
    "STAGE IIIC": "III",
    "STAGE IV": "IV",
    "STAGE IVA": "IV",
    "STAGE IVB": "IV",
    "STAGE IVC": "IV",
    # CPTAC short-form (numeric with optional letter suffix)
    "1": "I",
    "1A": "I",
    "1B": "I",
    "2": "II",
    "2A": "II",
    "2B": "II",
    "2C": "II",
    "3": "III",
    "3A": "III",
    "3B": "III",
    "3C": "III",
    "4": "IV",
    "4A": "IV",
    "4B": "IV",
    "4C": "IV",
    # Rare / ambiguous → exclude
    "STAGE 0": None,
    "STAGE IS": None,
    "STAGE X": None,
    "STAGE I/II (NOS)": None,
    "0": None,
}


def coarsen_stage(data: pd.DataFrame, col: str = "stage") -> pd.DataFrame:
    """Coarsen AJCC substages to major stage categories (I/II/III/IV).

    Reduces one-hot encoding from up to 18 dummies to 3, preventing singular
    matrices in Cox regression. Unknown values are set to NaN with a warning.

    Returns a copy; the original DataFrame is not modified.
    """
    if col not in data.columns or data[col].isna().all():
        return data.copy()

    data = data.copy()
    original = data[col]
    mapped = original.map(_STAGE_MAP)

    # Warn about unmapped non-null values
    unmapped_mask = original.notna() & mapped.isna() & ~original.isin(_STAGE_MAP)
    if unmapped_mask.any():
        unmapped_vals = original[unmapped_mask].unique().tolist()
        logger.warning("Unknown stage values mapped to NaN: %s", unmapped_vals)

    data[col] = mapped
    return data


def select_covariates(
    data: pd.DataFrame,
    candidates: list[str] | None = None,
) -> list[str]:
    """Select covariates that exist and have at least one non-null value.

    Fixes the bug where columns with 100% NaN (e.g. stage in 13 cancer types)
    were included, causing imputation to drop all rows.
    """
    if candidates is None:
        candidates = ["age_at_diagnosis", "sex", "stage"]
    return [cov for cov in candidates if cov in data.columns and data[cov].notna().any()]
