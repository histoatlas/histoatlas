"""Result dataclasses for survival analysis."""

from dataclasses import dataclass


@dataclass
class CoxRegressionResult:
    """Result of Cox proportional hazards regression."""

    feature: str
    hazard_ratio: float
    hr_ci_lower: float
    hr_ci_upper: float
    p_value: float
    n_samples: int
    n_events: int
    concordance: float
    feature_mean: float
    feature_std: float
    ph_test_p: float | None
    ph_flag: str  # 'pass', 'warn', 'fail', 'error', 'unknown'


@dataclass
class KaplanMeierResult:
    """Result of Kaplan-Meier curve computation for a group."""

    group: str
    time_points: list[float]
    survival_probs: list[float]
    ci_lower: list[float]
    ci_upper: list[float]
    n_at_risk: list[int]
    censoring_times: list[float]
    censoring_probs: list[float]
    n_samples: int
    n_events: int


@dataclass
class RMSTResult:
    """Result of Restricted Mean Survival Time computation."""

    rmst_difference: float
    rmst_ci_lower: float
    rmst_ci_upper: float
    rmst_p_value: float
    rmst_group_low: float
    rmst_group_high: float
    horizon_days: int
