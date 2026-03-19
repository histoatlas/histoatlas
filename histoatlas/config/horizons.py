"""RMST horizon settings for survival analysis."""

# Default RMST horizon: 3 years
DEFAULT_HORIZON_DAYS = 1095

# Cancer-specific horizons (override default for cancers with shorter/longer median survival)
CANCER_SPECIFIC_HORIZONS = {
    "PAAD": 730,  # 2 years (aggressive)
    "MESO": 730,  # 2 years (aggressive)
    "THCA": 1825,  # 5 years (indolent)
    "PRAD": 1825,  # 5 years (indolent)
}


def get_horizon_for_cancer(cancer_type: str) -> int:
    """
    Get RMST horizon for a cancer type.

    Args:
        cancer_type: TCGA cancer type abbreviation

    Returns:
        Horizon in days (default 1095 = 3 years)
    """
    return CANCER_SPECIFIC_HORIZONS.get(cancer_type, DEFAULT_HORIZON_DAYS)
