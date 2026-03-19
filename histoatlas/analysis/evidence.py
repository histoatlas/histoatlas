"""Evidence strength badge computation functions."""

import numpy as np
import pandas as pd

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


def evidence_badge_survival(row: pd.Series) -> str:
    """
    Compute evidence strength badge for survival association.

    Based on: p_adj, HR, CI width, N

    Args:
        row: DataFrame row with survival association statistics

    Returns:
        "strong", "moderate", "suggestive", or "insufficient"
    """
    p_adj = row.get("p_value_adj", np.nan)
    hr = row.get("hazard_ratio", np.nan)
    n_samples = row.get("n_samples", 0)
    n_events = row.get("n_events", 0)
    ci_width = row.get("ci_width_category", "unknown")

    # Check for insufficient data
    if n_samples < N_INSUFFICIENT or n_events < 10:
        return "insufficient"

    if pd.isna(p_adj) or pd.isna(hr):
        return "insufficient"

    # Effect size: HR >= threshold or HR <= 1/threshold
    hr_threshold = STRONG_EFFECT_THRESHOLDS["hr"]
    strong_effect = hr >= hr_threshold or hr <= (1 / hr_threshold)

    # Strong: p_adj < 0.01, strong effect, narrow CI, N > 100
    if p_adj < P_STRONG and strong_effect and ci_width == "narrow" and n_samples >= N_STRONG:
        return "strong"

    # Moderate: p_adj < 0.05, effect >= Cohen's small, narrow/moderate CI, N > 50
    hr_mod_threshold = MODERATE_EFFECT_THRESHOLDS["hr"]
    moderate_effect = hr >= hr_mod_threshold or hr <= (1 / hr_mod_threshold)
    ci_not_wide = ci_width in {"narrow", "moderate"}
    if p_adj < P_MODERATE and moderate_effect and ci_not_wide and n_samples >= N_MODERATE:
        return "moderate"

    # Suggestive: p_adj < 0.1 or CI excludes null (HR != 1) but wide
    hr_ci_lower = row.get("hr_ci_lower", np.nan)
    hr_ci_upper = row.get("hr_ci_upper", np.nan)
    ci_excludes_null = (
        not pd.isna(hr_ci_lower)
        and not pd.isna(hr_ci_upper)
        and (hr_ci_lower > 1 or hr_ci_upper < 1)
    )

    if p_adj < P_SUGGESTIVE or ci_excludes_null:
        return "suggestive"

    return "insufficient"


def evidence_badge_correlation(row: pd.Series) -> str:
    """
    Compute evidence strength badge for correlation.

    Based on: p_adj, |rho|, CI width, N

    Args:
        row: DataFrame row with correlation statistics

    Returns:
        "strong", "moderate", "suggestive", or "insufficient"
    """
    # Use Spearman correlation
    p_adj = row.get("spearman_p_adj", np.nan)
    r = row.get("spearman_rho", np.nan)
    n_samples = row.get("n_samples", 0)
    ci_width = row.get("ci_width_category", "unknown")

    # Check for insufficient data
    if n_samples < N_INSUFFICIENT:
        return "insufficient"

    if pd.isna(p_adj) or pd.isna(r):
        return "insufficient"

    # Effect size
    r_threshold = STRONG_EFFECT_THRESHOLDS["correlation"]
    strong_effect = abs(r) >= r_threshold

    # Strong: p_adj < 0.01, |rho| >= 0.3, narrow CI, N > 100
    if p_adj < P_STRONG and strong_effect and ci_width == "narrow" and n_samples >= N_STRONG:
        return "strong"

    # Moderate: p_adj < 0.05, effect >= Cohen's small, narrow/moderate CI, N > 50
    moderate_effect = abs(r) >= MODERATE_EFFECT_THRESHOLDS["correlation"]
    ci_not_wide = ci_width in {"narrow", "moderate"}
    if p_adj < P_MODERATE and moderate_effect and ci_not_wide and n_samples >= N_MODERATE:
        return "moderate"

    # Suggestive: p_adj < 0.1 or CI excludes null (0)
    ci_lower = row.get("spearman_ci_lower", np.nan)
    ci_upper = row.get("spearman_ci_upper", np.nan)
    ci_excludes_null = (
        not pd.isna(ci_lower) and not pd.isna(ci_upper) and (ci_lower > 0 or ci_upper < 0)
    )

    if p_adj < P_SUGGESTIVE or ci_excludes_null:
        return "suggestive"

    return "insufficient"


def evidence_badge_categorical(row: pd.Series) -> str:
    """
    Compute evidence strength badge for categorical association.

    Based on: p_adj, effect size (Cliff's delta or eta²), CI width, N

    Args:
        row: DataFrame row with categorical association statistics

    Returns:
        "strong", "moderate", "suggestive", or "insufficient"
    """
    p_adj = row.get("p_value_adj", np.nan)
    effect_size = row.get("effect_size", np.nan)
    effect_name = row.get("effect_size_name", "")
    n_samples = row.get("n_samples", 0)
    ci_width = row.get("ci_width_category", "unknown")

    # Check for insufficient data
    if n_samples < N_INSUFFICIENT:
        return "insufficient"

    if pd.isna(p_adj) or pd.isna(effect_size):
        return "insufficient"

    # Effect size threshold depends on test type
    if effect_name == "cliffs_delta":
        threshold = STRONG_EFFECT_THRESHOLDS["cliffs_delta"]
        strong_effect = abs(effect_size) >= threshold
    elif effect_name in {"eta_squared", "partial_eta_squared"}:
        threshold = STRONG_EFFECT_THRESHOLDS["eta_squared"]
        strong_effect = effect_size >= threshold
    else:
        strong_effect = False

    # Strong: p_adj < 0.01, strong effect, narrow CI, N > 100
    if p_adj < P_STRONG and strong_effect and ci_width == "narrow" and n_samples >= N_STRONG:
        return "strong"

    # Moderate: p_adj < 0.05, effect >= Cohen's small, narrow/moderate CI, N > 50
    if effect_name == "cliffs_delta":
        mod_threshold = MODERATE_EFFECT_THRESHOLDS["cliffs_delta"]
        moderate_effect = abs(effect_size) >= mod_threshold
    elif effect_name in {"eta_squared", "partial_eta_squared"}:
        mod_threshold = MODERATE_EFFECT_THRESHOLDS["eta_squared"]
        moderate_effect = effect_size >= mod_threshold
    else:
        moderate_effect = False

    ci_not_wide = ci_width in {"narrow", "moderate"}
    if p_adj < P_MODERATE and moderate_effect and ci_not_wide and n_samples >= N_MODERATE:
        return "moderate"

    # Suggestive: p_adj < 0.1 or CI excludes null
    ci_lower = row.get("effect_ci_lower", np.nan)
    ci_upper = row.get("effect_ci_upper", np.nan)

    if effect_name == "cliffs_delta":
        ci_excludes_null = (
            not pd.isna(ci_lower) and not pd.isna(ci_upper) and (ci_lower > 0 or ci_upper < 0)
        )
    else:
        # For eta_squared / partial_eta_squared, null is 0 (no effect)
        ci_excludes_null = not pd.isna(ci_lower) and ci_lower > 0

    if p_adj < P_SUGGESTIVE or ci_excludes_null:
        return "suggestive"

    return "insufficient"
