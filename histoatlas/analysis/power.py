"""Minimum Detectable Effect Size (MDES) and power analysis functions."""

import numpy as np
import pandas as pd
from scipy import stats

# ---------------------------------------------------------------------------
# Analytical power helpers (O(1) per eval — no simulation)
# ---------------------------------------------------------------------------


def _use_analytical_mw(
    dist: str, round_decimals: int | None, zero_inflation: float, method: str
) -> bool:
    """Return True when the normal-shift / asymptotic defaults allow the analytical path."""
    return (
        dist == "normal"
        and round_decimals is None
        and zero_inflation == 0.0
        and method == "asymptotic"
    )


def _analytical_power_mann_whitney(n1: int, n2: int, delta: float, alpha: float) -> float:
    """Noether's large-sample power for MWU under a normal-shift model.

    Given X ~ N(0,1), Y ~ N(mu,1):
      p1 = (delta + 1) / 2          (population AUC)
      ncp = (p1 - 0.5) * sqrt(12 * n1 * n2 / (n1 + n2 + 1))
      power = 1 - Phi(z_crit - ncp) + Phi(-z_crit - ncp)
    """
    p1 = (delta + 1.0) / 2.0
    ncp = (p1 - 0.5) * np.sqrt(12.0 * n1 * n2 / (n1 + n2 + 1))
    z_crit = stats.norm.ppf(1.0 - alpha / 2.0)
    return float(1.0 - stats.norm.cdf(z_crit - ncp) + stats.norm.cdf(-z_crit - ncp))


def _analytical_power_kruskal_wallis(n_per_group: list[int], delta: float, alpha: float) -> float:
    """Power for KW via Pitman ARE (3/pi for normal data) + noncentral chi-squared.

    Groups have means = linspace(-(k-1)/2, (k-1)/2, k) * delta, sigma=1.
    """
    k = len(n_per_group)
    n_arr = np.asarray(n_per_group, dtype=float)
    means = np.linspace(-(k - 1) / 2.0, (k - 1) / 2.0, k) * delta
    grand_mean = np.dot(n_arr, means) / n_arr.sum()
    lambda_anova = float(np.dot(n_arr, (means - grand_mean) ** 2))
    lambda_kw = max((3.0 / np.pi) * lambda_anova, 1e-10)
    chi2_crit = stats.chi2.ppf(1.0 - alpha, df=k - 1)
    return float(stats.ncx2.sf(chi2_crit, df=k - 1, nc=lambda_kw))


def _mdes_mann_whitney_analytical(
    n1: int, n2: int, alpha: float, power: float, max_delta: float, n_search_iters: int
) -> float:
    """Binary-search MDES for MWU using the analytical power formula."""
    low, high = 0.0, min(0.2, max_delta)
    p_high = _analytical_power_mann_whitney(n1, n2, high, alpha)
    while p_high < power and high < max_delta:
        high = min(max_delta, high * 1.5 + 0.01)
        p_high = _analytical_power_mann_whitney(n1, n2, high, alpha)
    if p_high < power:
        return np.nan
    for _ in range(n_search_iters):
        mid = (low + high) / 2.0
        if _analytical_power_mann_whitney(n1, n2, mid, alpha) < power:
            low = mid
        else:
            high = mid
    return float(np.clip((low + high) / 2.0, 0.0, 1.0))


def _mdes_kruskal_wallis_analytical(
    n_per_group: list[int], alpha: float, power: float, k: int
) -> float:
    """Binary-search MDES for KW using the analytical power formula. Returns Cohen's f."""
    low, high = 0.0, 0.2
    p_high = _analytical_power_kruskal_wallis(n_per_group, high, alpha)
    while p_high < power and high < 5.0:
        high *= 1.5
        p_high = _analytical_power_kruskal_wallis(n_per_group, high, alpha)
    if p_high < power:
        return np.nan
    for _ in range(18):
        mid = (low + high) / 2.0
        if _analytical_power_kruskal_wallis(n_per_group, mid, alpha) < power:
            low = mid
        else:
            high = mid
    # Convert delta to Cohen's f: f = sqrt( sum(n_i*(mu_i - mu_bar)^2) / (N * sigma^2) )
    delta_mdes = (low + high) / 2.0
    means = np.linspace(-(k - 1) / 2.0, (k - 1) / 2.0, k) * delta_mdes
    n_arr = np.asarray(n_per_group, dtype=float)
    N = n_arr.sum()
    grand_mean = np.dot(n_arr, means) / N
    cohens_f = float(np.sqrt(np.dot(n_arr, (means - grand_mean) ** 2) / N))
    return cohens_f


def mdes_survival(n_events: int, alpha: float = 0.05, power: float = 0.80) -> tuple[float, float]:
    """
    Conservative MDES for Cox PH (HR > 1) using the Schoenfeld-Freedman approximation.

    Approx: Var(beta) ≈ 1 / (D * p*(1-p)) for a binary 0/1 predictor with prevalence p.
    Uses worst case p*(1-p)=1/4 -> SE(beta) <= 2/sqrt(D).

    Args:
        n_events: Number of events observed
        alpha: Significance level (default 0.05 for two-sided test)
        power: Desired statistical power (default 0.80)

    Returns:
        Tuple of (harmful_mdes_hr, protective_mdes_hr) - minimum detectable
        hazard ratios HR > 1 and HR < 1 respectively
    """
    if n_events < 5:
        return (np.nan, np.nan)

    z_alpha = stats.norm.ppf(1 - alpha / 2)  # Two-sided
    z_power = stats.norm.ppf(power)

    se_log_hr = 2 / np.sqrt(n_events)  # upper bound

    # MDES in log(HR) scale
    mdes_log_hr = (z_alpha + z_power) * se_log_hr

    # Convert to HR scale (return the detectable HR > 1)
    harmful_mdes_hr = float(np.exp(mdes_log_hr))
    protective_mdes_hr = float(np.exp(-mdes_log_hr))

    return (harmful_mdes_hr, protective_mdes_hr)


def mdes_correlation(
    n: int, alpha: float = 0.05, power: float = 0.80, n_covariates: int = 0
) -> float:
    """
    Compute MDES for Pearson/Spearman correlation.

    Using Fisher z-transform, SE(z) = 1/sqrt(n - k - 3) where k is the number
    of covariates (for partial correlations).

    This function should be used for correlations with continuous features! Note that the
    Fisher z-transform is not robust to ties (ordinal/discrete features), non-Gaussian,
    heavy tails.

    Args:
        n: Sample size
        alpha: Significance level (default 0.05 for two-sided test)
        power: Desired statistical power (default 0.80)
        n_covariates: Number of covariates for partial correlation (default 0)

    Returns:
        Minimum detectable |r|
    """
    effective_n = n - n_covariates
    if effective_n < 10:
        return np.nan

    z_alpha = stats.norm.ppf(1 - alpha / 2)
    z_power = stats.norm.ppf(power)

    se_z = 1 / np.sqrt(effective_n - 3)
    mdes_z = (z_alpha + z_power) * se_z

    # Convert from z to r
    mdes_r = float(np.tanh(mdes_z))

    return mdes_r


def mdes_mann_whitney(
    n1: int,
    n2: int,
    alpha: float = 0.05,
    power: float = 0.80,
    n_simulations: int = 2000,
    seed: int = 42,
    *,
    dist: str = "normal",
    t_df: float = 5.0,
    round_decimals: int | None = None,
    zero_inflation: float = 0.0,
    method: str = "asymptotic",
    n_permutations: int = 2000,
    max_delta: float = 0.95,
    n_search_iters: int = 20,
) -> float:
    """
    Simulation-based MDES for Mann-Whitney U, returned as minimum detectable |Cliff's delta|.

    Effect size:
        Cliff's delta: delta = P(Y > X) - P(Y < X)  (ties ignored; SciPy MWU handles ties)
        Equivalent: AUC = P(Y > X) + 0.5 P(Y = X) and δ = 2*AUC - 1 (when ties are rare)

    Data generation (default):
        X ~ N(0, 1), Y ~ N(mu, 1)
        For the normal-shift model, the *population* AUC satisfies:
            AUC = Phi(mu / sqrt(2))  =>  mu = sqrt(2) * Phi^{-1}(AUC)
        We use that to simulate a target delta via mu.

    The simulation-based approach is robust to ties (rounding), zero-inflation, and
    non-normality (t-dist).

    Returns:
        Minimum detectable |Delta| (clipped to [0, 1]). Returns np.nan if cannot bracket.

    Notes:
        - If you set round_decimals or zero_inflation, the achieved Delta in samples won't be
        exactly the target population Delta of the underlying shift model; MDES remains valid
        for the chosen simulation scenario.
        - For small n, consider method="permutation" (slower but closer to exact).
    """
    if n1 < 2 or n2 < 2:
        return np.nan
    if not (0 < alpha < 1) or not (0 < power < 1):
        return np.nan
    if not (0.0 <= zero_inflation < 1.0):
        return np.nan
    if method not in {"asymptotic", "permutation"}:
        return np.nan
    if dist not in {"normal", "t"}:
        return np.nan

    # Fast analytical path for the normal-shift / asymptotic defaults
    if _use_analytical_mw(dist, round_decimals, zero_inflation, method):
        return _mdes_mann_whitney_analytical(n1, n2, alpha, power, max_delta, n_search_iters)

    rng = np.random.default_rng(seed)

    def _sample_base(size: int) -> np.ndarray:
        if dist == "normal":
            return rng.normal(0.0, 1.0, size=size)
        # Student-t, standardized to unit variance (if df>2)
        x = rng.standard_t(t_df, size=size)
        if t_df > 2:
            x = x / np.sqrt(t_df / (t_df - 2))
        return x

    def _inject_ties_and_zeros(x: np.ndarray) -> np.ndarray:
        if zero_inflation > 0:
            mask = rng.random(x.shape[0]) < zero_inflation
            x = x.copy()
            x[mask] = 0.0
        if round_decimals is not None:
            x = np.round(x, round_decimals)
        return x

    def _pvalue_mwu(x: np.ndarray, y: np.ndarray) -> float:
        # SciPy: mannwhitneyu supports method="asymptotic" or "exact" depending on version.
        # Permutation here means permutation-based p-value we compute ourselves (two-sided).
        if method == "asymptotic":
            return stats.mannwhitneyu(x, y, alternative="two-sided", method="asymptotic").pvalue

        # Permutation p-value (two-sided) based on U statistic
        u_obs = stats.mannwhitneyu(x, y, alternative="two-sided", method="asymptotic").statistic
        pooled = np.concatenate([x, y])
        n = pooled.shape[0]
        # Two-sided: compare |U - E[U]|, where E[U]=n1*n2/2
        e_u = (x.shape[0] * y.shape[0]) / 2.0
        dev_obs = abs(u_obs - e_u)

        cnt = 0
        for _ in range(n_permutations):
            perm = rng.permutation(n)
            x_p = pooled[perm[: x.shape[0]]]
            y_p = pooled[perm[x.shape[0] :]]
            u_p = stats.mannwhitneyu(
                x_p, y_p, alternative="two-sided", method="asymptotic"
            ).statistic
            dev_p = abs(u_p - e_u)
            if dev_p >= dev_obs:
                cnt += 1
        # add-one smoothing
        return (cnt + 1.0) / (n_permutations + 1.0)

    def _delta_to_mu(delta: float) -> float:
        # delta -> AUC -> mu for normal-shift model
        auc = (delta + 1.0) / 2.0
        # avoid inf
        auc = np.clip(auc, 1e-6, 1 - 1e-6)
        return np.sqrt(2.0) * stats.norm.ppf(auc)

    def simulate_power(delta: float) -> float:
        mu = _delta_to_mu(delta)
        rej = 0
        for _ in range(n_simulations):
            x = _sample_base(n1)
            y = _sample_base(n2) + mu
            x = _inject_ties_and_zeros(x)
            y = _inject_ties_and_zeros(y)
            p = _pvalue_mwu(x, y)
            if p < alpha:
                rej += 1
        return rej / n_simulations

    # Bracket the solution: ensure power(high) >= target
    low, high = 0.0, min(0.2, max_delta)
    p_high = simulate_power(high)
    while p_high < power and high < max_delta:
        high = min(max_delta, high * 1.5 + 0.01)
        p_high = simulate_power(high)

    if p_high < power:
        return np.nan

    # Binary search on delta
    for _ in range(n_search_iters):
        mid = (low + high) / 2.0
        p_mid = simulate_power(mid)
        if p_mid < power:
            low = mid
        else:
            high = mid

    return float(np.clip((low + high) / 2.0, 0.0, 1.0))


def mdes_kruskal_wallis(
    n_per_group: list[int],
    alpha: float = 0.05,
    power: float = 0.80,
    n_sim: int = 2000,
    seed: int = 42,
):
    """Compute Cohen's f MDES for Kruskal-Wallis test."""
    k = len(n_per_group)
    if k < 2 or any(n < 2 for n in n_per_group):
        return np.nan
    if not (0 < alpha < 1) or not (0 < power < 1):
        return np.nan

    # Analytical path (always valid — the function generates normal data)
    return _mdes_kruskal_wallis_analytical(n_per_group, alpha, power, k)


def ci_width_category(ci_lower: float, ci_upper: float, scale: str = "ratio") -> str:
    """
    Categorize CI width as narrow, moderate, or wide.

    Args:
        ci_lower: Lower bound of confidence interval
        ci_upper: Upper bound of confidence interval
        scale: "ratio" for HR/OR (use CI ratio), "additive" for r/delta (use CI width)

    Returns:
        "narrow", "moderate", "wide", or "unknown"
    """
    if pd.isna(ci_lower) or pd.isna(ci_upper):
        return "unknown"

    if scale == "ratio":
        if ci_lower <= 0:
            return "wide"
        ci_ratio = ci_upper / ci_lower
        if ci_ratio < 2:
            return "narrow"
        elif ci_ratio < 4:
            return "moderate"
        else:
            return "wide"
    else:
        ci_width = ci_upper - ci_lower
        # For correlations, width of 0.3 is narrow, 0.6 is moderate
        if ci_width < 0.3:
            return "narrow"
        elif ci_width < 0.6:
            return "moderate"
        else:
            return "wide"
