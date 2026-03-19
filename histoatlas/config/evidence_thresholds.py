"""Evidence strength badge thresholds."""

# Minimum effect sizes for "strong" evidence (clinically meaningful / Cohen's medium)
STRONG_EFFECT_THRESHOLDS = {
    "hr": 1.5,  # Hazard ratio >= 1.5 or <= 1/1.5 ≈ 0.667
    "correlation": 0.3,  # |r| >= 0.3
    "cliffs_delta": 0.3,  # |delta| >= 0.3
    "eta_squared": 0.06,  # eta² >= 0.06 (medium effect)
    "partial_eta_squared": 0.06,  # partial eta² >= 0.06 (medium effect)
}

# Minimum effect sizes for "moderate" evidence (Cohen's small)
MODERATE_EFFECT_THRESHOLDS = {
    "hr": 1.18,  # Hazard ratio >= 1.18 or <= 1/1.18 ≈ 0.847 (Cohen's small for log-HR)
    "correlation": 0.1,  # |r| >= 0.1
    "cliffs_delta": 0.15,  # |delta| >= 0.15
    "eta_squared": 0.01,  # eta² >= 0.01 (small effect)
    "partial_eta_squared": 0.01,  # partial eta² >= 0.01 (small effect)
}

# Sample size thresholds
N_STRONG = 100
N_MODERATE = 50
N_INSUFFICIENT = 30

# P-value thresholds
P_STRONG = 0.01
P_MODERATE = 0.05
P_SUGGESTIVE = 0.10
