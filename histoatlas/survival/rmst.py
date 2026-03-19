"""Restricted Mean Survival Time (RMST) computation functions."""

import numpy as np


def compute_rmst(
    time: np.ndarray,
    event: np.ndarray,
    horizon: float,
) -> tuple[float, float]:
    """
    Compute RMST (area under KM curve up to horizon) and its standard error.

    Uses the Irwin (1949) variance formula for RMST.

    Args:
        time: Survival times
        event: Event indicators (1=event, 0=censored)
        horizon: Time horizon for RMST calculation

    Returns:
        (rmst, se): RMST estimate and standard error
    """
    # Sort by time
    order = np.argsort(time)
    time_sorted = time[order]
    event_sorted = event[order]

    # Truncate at horizon
    time_truncated = np.minimum(time_sorted, horizon)
    event_truncated = event_sorted.copy()
    event_truncated[time_sorted > horizon] = 0

    # Kaplan-Meier estimation at unique event times
    unique_times = np.unique(time_truncated[event_truncated == 1])

    if len(unique_times) == 0:
        # No events before horizon: RMST = horizon (100% survival)
        # SE is undefined/infinite since no variance information is available
        # Return NaN for SE to indicate this edge case
        return horizon, np.nan

    # Add time 0 and horizon, de-duplicate (avoid double-counting events at t=0)
    unique_times = np.unique(np.concatenate([[0], unique_times, [horizon]]))

    # Compute KM survival probability at each time
    n_at_risk = np.zeros(len(unique_times))
    n_events = np.zeros(len(unique_times))
    survival = np.ones(len(unique_times))

    for i, t in enumerate(unique_times):
        n_at_risk[i] = np.sum(time_truncated >= t)
        n_events[i] = np.sum((time_truncated == t) & (event_truncated == 1))

        # Apply event updates at t=0 as well (events at time 0 should reduce survival immediately)
        if i == 0:
            if n_at_risk[i] > 0 and n_events[i] > 0:
                survival[i] = 1 - n_events[i] / n_at_risk[i]
            else:
                survival[i] = 1.0
        else:
            if n_at_risk[i] > 0 and n_events[i] > 0:
                survival[i] = survival[i - 1] * (1 - n_events[i] / n_at_risk[i])
            else:
                survival[i] = survival[i - 1]

    # Compute RMST as area under KM curve
    # RMST = sum of (S(t_i) * delta_t)
    rmst = 0.0
    for i in range(len(unique_times) - 1):
        dt = unique_times[i + 1] - unique_times[i]
        rmst += survival[i] * dt

    # Variance using Irwin's formula
    # Var(RMST) ≈ sum of [A_i^2 * d_i / (n_i * (n_i - d_i))]
    # where A_i = integral of S(u) from t_i to tau
    variance = 0.0
    for i in range(len(unique_times) - 1):
        if n_at_risk[i] > 0 and n_at_risk[i] > n_events[i]:
            # Area from this time to horizon
            area_i = 0.0
            for j in range(i, len(unique_times) - 1):
                dt = unique_times[j + 1] - unique_times[j]
                area_i += survival[j] * dt

            d_i = n_events[i]
            n_i = n_at_risk[i]

            if n_i > d_i and n_i > 0:
                variance += (area_i**2) * d_i / (n_i * (n_i - d_i))

    se = np.sqrt(variance)

    return rmst, se


def _bootstrap_percentile_ci(samples: np.ndarray, alpha: float) -> tuple[float, float]:
    """Compute bootstrap percentile CI."""
    samples = samples[~np.isnan(samples)]
    if samples.size == 0:
        return np.nan, np.nan
    lower = np.percentile(samples, 100 * alpha / 2)
    upper = np.percentile(samples, 100 * (1 - alpha / 2))
    return float(lower), float(upper)


def compute_rmst_difference(
    time: np.ndarray,
    event: np.ndarray,
    group: np.ndarray,
    horizon: float,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int | None = 42,
    *,
    n_permutations: int = 5000,
) -> dict:
    """
    Compute RMST difference between two groups with bootstrap CI.

    Uses bootstrap resampling for confidence intervals, which correctly
    accounts for the covariance structure of complementary groups.
    Uses permutation testing (label shuffling) for p-values to ensure a
    valid null distribution centered at zero.

    Args:
        time: Survival times
        event: Event indicators (1=event, 0=censored)
        group: Group indicators (0 or 1, typically low vs high)
        horizon: Time horizon for RMST calculation
        n_bootstrap: Number of bootstrap resamples (default 1000)
        alpha: Significance level for CI (default 0.05 for 95% CI)
        seed: Random seed for reproducibility (default 42)
        n_permutations: Number of permutations for p-value (default 5000)

    Returns:
        dict with rmst_difference, ci_lower, ci_upper, rmst_p_value,
        rmst_group_low, rmst_group_high
    """
    # Split by group
    mask_0 = group == 0
    mask_1 = group == 1

    time_0 = time[mask_0]
    event_0 = event[mask_0]
    time_1 = time[mask_1]
    event_1 = event[mask_1]

    if len(time_0) < 5 or len(time_1) < 5:
        return {
            "rmst_difference": np.nan,
            "rmst_ci_lower": np.nan,
            "rmst_ci_upper": np.nan,
            "rmst_p_value": np.nan,
            "rmst_group_low": np.nan,
            "rmst_group_high": np.nan,
        }

    # Compute point estimates
    rmst_0, _ = compute_rmst(time_0, event_0, horizon)
    rmst_1, _ = compute_rmst(time_1, event_1, horizon)
    rmst_diff = rmst_1 - rmst_0

    # Permutation p-value (valid null distribution centered at 0)
    p_value = np.nan
    if n_permutations > 0:
        from numpy.random import SeedSequence, default_rng

        rng_perm = default_rng(SeedSequence(seed).spawn(2)[0])
        perm_diffs = np.empty(n_permutations, dtype=float)
        n = len(time)

        for i in range(n_permutations):
            perm_group = rng_perm.permutation(group)
            mask_0_perm = perm_group == 0
            mask_1_perm = perm_group == 1

            # Should preserve group sizes, but guard against degenerate cases
            if mask_0_perm.sum() < 5 or mask_1_perm.sum() < 5:
                perm_diffs[i] = np.nan
                continue

            rmst_0_perm, _ = compute_rmst(time[mask_0_perm], event[mask_0_perm], horizon)
            rmst_1_perm, _ = compute_rmst(time[mask_1_perm], event[mask_1_perm], horizon)
            perm_diffs[i] = rmst_1_perm - rmst_0_perm

        valid_perm = perm_diffs[~np.isnan(perm_diffs)]
        if valid_perm.size > 0:
            p_value = float(
                (np.sum(np.abs(valid_perm) >= np.abs(rmst_diff)) + 1) / (len(valid_perm) + 1)
            )

    # Bootstrap CI (p-value comes from permutation test above)
    if n_bootstrap > 0:
        from numpy.random import SeedSequence, default_rng

        rng = default_rng(SeedSequence(seed).spawn(2)[1]) if seed is not None else np.random
        boot_diffs = np.empty(n_bootstrap, dtype=float)
        n = len(time)

        for i in range(n_bootstrap):
            # Resample entire cohort
            idx = rng.choice(n, size=n, replace=True)
            time_boot = time[idx]
            event_boot = event[idx]
            group_boot = group[idx]

            # Split by group
            mask_0_boot = group_boot == 0
            mask_1_boot = group_boot == 1

            # Skip if a group is empty or too small
            if mask_0_boot.sum() < 5 or mask_1_boot.sum() < 5:
                boot_diffs[i] = np.nan
                continue

            rmst_0_boot, _ = compute_rmst(time_boot[mask_0_boot], event_boot[mask_0_boot], horizon)
            rmst_1_boot, _ = compute_rmst(time_boot[mask_1_boot], event_boot[mask_1_boot], horizon)
            boot_diffs[i] = rmst_1_boot - rmst_0_boot

        valid_boot = boot_diffs[~np.isnan(boot_diffs)]
        min_required = max(10, int(0.5 * n_bootstrap))
        if n_bootstrap >= 200:
            min_required = max(min_required, 100)
        if valid_boot.size < min_required:
            ci_lower, ci_upper = np.nan, np.nan
            # Leave p_value from permutation test
        else:
            ci_lower, ci_upper = _bootstrap_percentile_ci(valid_boot, alpha)
    else:
        ci_lower, ci_upper = np.nan, np.nan

    return {
        "rmst_difference": rmst_diff,
        "rmst_ci_lower": ci_lower,
        "rmst_ci_upper": ci_upper,
        "rmst_p_value": p_value,
        "rmst_group_low": rmst_0,
        "rmst_group_high": rmst_1,
    }
