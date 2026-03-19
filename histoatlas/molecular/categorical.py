"""Categorical association test functions."""

import json
import logging
from dataclasses import asdict

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from scipy import stats
from scipy.stats import kruskal, mannwhitneyu
from tqdm.auto import tqdm

from histoatlas.molecular._parallel import get_task_seed
from histoatlas.molecular._results import CategoricalAssociationResult
from histoatlas.molecular.correlation import build_covariate_matrix

logger = logging.getLogger(__name__)

# Minimum proportion of successful bootstrap iterations required for valid CI
MIN_BOOTSTRAP_SUCCESS_RATE = 0.9


def _bootstrap_percentile_ci(samples: np.ndarray, alpha: float) -> tuple[float, float]:
    samples = samples[~np.isnan(samples)]
    if samples.size == 0:
        return np.nan, np.nan
    lower = np.percentile(samples, 100 * alpha / 2)
    upper = np.percentile(samples, 100 * (1 - alpha / 2))
    return float(lower), float(upper)


def cliffs_delta(
    x: np.ndarray,
    y: np.ndarray,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int | None = 42,
) -> tuple:
    """
    Compute Cliff's delta effect size with bootstrap CI.

    Args:
        x: Values from group 1
        y: Values from group 2
        n_bootstrap: Number of bootstrap resamples
        alpha: Significance level for CI
        seed: Random seed (use None for nondeterministic)

    Returns:
        (delta, ci_lower, ci_upper) tuple
    """
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    n1, n2 = len(x), len(y)

    if n1 == 0 or n2 == 0:
        return np.nan, np.nan, np.nan

    # Vectorized computation of dominance matrix
    dominance_matrix = np.sign(np.subtract.outer(x, y))
    delta = np.mean(dominance_matrix)

    if n_bootstrap <= 0:
        return float(delta), np.nan, np.nan

    rng = np.random.default_rng(seed)
    boot_stats = np.empty(n_bootstrap, dtype=float)

    for i in range(n_bootstrap):
        x_boot = x[rng.choice(n1, size=n1, replace=True)]
        y_boot = y[rng.choice(n2, size=n2, replace=True)]
        boot_stats[i] = np.mean(np.sign(np.subtract.outer(x_boot, y_boot)))

    ci_lower, ci_upper = _bootstrap_percentile_ci(boot_stats, alpha)

    return float(delta), ci_lower, ci_upper


def eta_squared_kw(
    h_statistic: float | None = None,
    n: int | None = None,
    k: int | None = None,
    *,
    groups: list[np.ndarray] | None = None,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int | None = 42,
) -> tuple:
    """
    Compute eta-squared from Kruskal-Wallis H statistic with bootstrap CI.

    Args:
        h_statistic: Kruskal-Wallis H statistic
        n: Total sample size
        k: Number of groups
        groups: Optional list of group arrays to bootstrap from
        n_bootstrap: Number of bootstrap resamples
        alpha: Significance level for CI
        seed: Random seed (use None for nondeterministic)

    Returns:
        (eta_squared, ci_lower, ci_upper) tuple

    Notes:
        Bootstrap CIs require raw group data; if groups is None, CIs are NaN.
    """
    if groups is not None:
        groups = [np.asarray(g) for g in groups]
        if n is None:
            n = sum(len(g) for g in groups)
        if k is None:
            k = len(groups)

    if n is None or k is None:
        return np.nan, np.nan, np.nan

    if n <= k:
        return np.nan, np.nan, np.nan

    if h_statistic is None:
        if groups is None:
            return np.nan, np.nan, np.nan
        h_statistic, _ = kruskal(*groups)

    eta_sq = (h_statistic - k + 1) / (n - k)
    eta_sq = max(0, eta_sq)

    if groups is None or n_bootstrap <= 0:
        return float(eta_sq), np.nan, np.nan

    rng = np.random.default_rng(seed)
    boot_stats = []

    for _ in range(n_bootstrap):
        boot_groups = [g[rng.choice(len(g), size=len(g), replace=True)] for g in groups]
        try:
            h_boot, _ = kruskal(*boot_groups)
        except ValueError:
            continue
        boot_eta = (h_boot - k + 1) / (n - k)
        boot_stats.append(max(0, boot_eta))

    # Check if enough bootstrap iterations succeeded
    n_successful = len(boot_stats)
    success_rate = n_successful / n_bootstrap if n_bootstrap > 0 else 0

    if success_rate < MIN_BOOTSTRAP_SUCCESS_RATE:
        logger.warning(
            f"Only {n_successful}/{n_bootstrap} ({100 * success_rate:.1f}%) bootstrap iterations "
            f"succeeded for eta-squared CI. CI may be unreliable."
        )

    if n_successful < 100:
        # Too few successful iterations for reliable CI
        logger.warning(
            f"Only {n_successful} successful bootstrap iterations. "
            f"Returning NaN for CI (need at least 100)."
        )
        return float(eta_sq), np.nan, np.nan

    boot_stats = np.asarray(boot_stats, dtype=float)
    ci_lower, ci_upper = _bootstrap_percentile_ci(boot_stats, alpha)

    return float(eta_sq), ci_lower, ci_upper


def _binary_group_order(labels: list) -> list:
    """
    Return a deterministic order for binary groups to stabilize effect size sign.

    Args:
        labels: List of group labels

    Returns:
        Ordered list with "positive" group first
    """
    labels_list = list(labels)
    labels_lower = {str(l).lower() for l in labels_list}

    if labels_lower == {"mutant", "wt"}:
        return [l for l in labels_list if str(l).lower() == "mutant"] + [
            l for l in labels_list if str(l).lower() == "wt"
        ]
    if labels_lower == {"yes", "no"}:
        return [l for l in labels_list if str(l).lower() == "yes"] + [
            l for l in labels_list if str(l).lower() == "no"
        ]
    if labels_lower in ({"1", "0"}, {"true", "false"}):
        return sorted(
            labels_list,
            key=lambda x: 0 if str(x).lower() in {"1", "true"} else 1,
        )
    if labels_lower == {"amplification", "neutral"}:
        return [l for l in labels_list if str(l).lower() == "amplification"] + [
            l for l in labels_list if str(l).lower() == "neutral"
        ]
    if labels_lower == {"deletion", "neutral"}:
        return [l for l in labels_list if str(l).lower() == "deletion"] + [
            l for l in labels_list if str(l).lower() == "neutral"
        ]

    return sorted(labels_list, key=lambda x: str(x))


def _bootstrap_ci_partial_eta_rank_ancova(
    y_raw: np.ndarray,
    group_dummies: np.ndarray,
    cov_matrix: np.ndarray,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int | None = 42,
) -> tuple[float, float]:
    """
    Bootstrap CI for partial eta-squared in rank-ANCOVA.

    Resamples rows with replacement, recomputes rank-ANCOVA partial eta-squared,
    and uses percentile CI to align inference with permutation-based p-values.
    """
    if n_bootstrap <= 0:
        return np.nan, np.nan

    rng = np.random.default_rng(seed)
    n = len(y_raw)
    boot_stats: list[float] = []

    for _ in range(n_bootstrap):
        idx = rng.choice(n, size=n, replace=True)
        y_boot = y_raw[idx]
        cov_boot = cov_matrix[idx]
        group_boot = group_dummies[idx] if group_dummies.size > 0 else group_dummies

        y_rank = _rank_transform_vector(y_boot)
        cov_rank = _rank_transform_matrix(cov_boot)

        _, _, df_resid, partial_eta_sq = _compute_group_f_stat(y_rank, group_boot, cov_rank)
        if np.isnan(partial_eta_sq) or df_resid <= 0:
            continue
        boot_stats.append(float(partial_eta_sq))

    n_successful = len(boot_stats)
    success_rate = n_successful / n_bootstrap

    if success_rate < MIN_BOOTSTRAP_SUCCESS_RATE:
        logger.warning(
            f"Only {n_successful}/{n_bootstrap} ({100 * success_rate:.1f}%) bootstrap iterations "
            "succeeded for rank-ANCOVA partial eta-squared CI. CI may be unreliable."
        )

    if n_successful < 100:
        logger.warning(
            f"Only {n_successful} successful bootstrap iterations. "
            "Returning NaN for CI (need at least 100)."
        )
        return np.nan, np.nan

    boot_stats = np.asarray(boot_stats, dtype=float)
    return _bootstrap_percentile_ci(boot_stats, alpha)


def _rank_transform_vector(values: np.ndarray) -> np.ndarray:
    """Rank-transform a 1D array (average ranks for ties)."""
    return stats.rankdata(values, method="average").astype(float)


def _rank_transform_matrix(matrix: np.ndarray) -> np.ndarray:
    """Rank-transform each column of a 2D matrix."""
    ranked = np.empty_like(matrix, dtype=float)
    for j in range(matrix.shape[1]):
        ranked[:, j] = stats.rankdata(matrix[:, j], method="average")
    return ranked


def _compute_group_f_stat(
    y: np.ndarray, group_dummies: np.ndarray, cov_matrix: np.ndarray
) -> tuple[float, int, int, float]:
    """
    Compute F-statistic for group effect in (rank) ANCOVA.

    Returns:
        (f_stat, df_group, df_resid, partial_eta_sq)
    """
    n = len(y)
    df_group = group_dummies.shape[1] if group_dummies.size > 0 else 0

    # Design matrices
    X_full = np.column_stack([np.ones(n), group_dummies, cov_matrix])
    X_reduced = np.column_stack([np.ones(n), cov_matrix])

    # Fit OLS via least squares
    try:
        beta_full, *_ = np.linalg.lstsq(X_full, y, rcond=None)
        beta_reduced, *_ = np.linalg.lstsq(X_reduced, y, rcond=None)
    except (np.linalg.LinAlgError, ValueError):
        return np.nan, df_group, n - X_full.shape[1], np.nan

    resid_full = y - X_full @ beta_full
    resid_reduced = y - X_reduced @ beta_reduced

    ss_full = float(resid_full @ resid_full)
    ss_reduced = float(resid_reduced @ resid_reduced)
    ss_group = max(0.0, ss_reduced - ss_full)

    df_resid = n - X_full.shape[1]
    if df_group <= 0 or df_resid <= 0:
        return np.nan, df_group, df_resid, np.nan

    ms_group = ss_group / df_group
    ms_resid = ss_full / df_resid if df_resid > 0 else np.nan
    f_stat = ms_group / ms_resid if ms_resid > 0 else np.nan

    partial_eta_sq = ss_group / (ss_group + ss_full) if (ss_group + ss_full) > 0 else np.nan

    return float(f_stat), df_group, df_resid, float(partial_eta_sq)


def _permutation_p_value_rank_ancova(
    y_raw: np.ndarray,
    group_dummies: np.ndarray,
    cov_matrix: np.ndarray,
    n_permutations: int = 1000,
    seed: int | None = 42,
) -> tuple[float, float, int, int, float]:
    """
    Permutation p-value for rank-ANCOVA using Freedman-Lane.

    Returns:
        (p_value, f_obs, df_group, df_resid, partial_eta_sq)
    """
    if n_permutations <= 0:
        return np.nan, np.nan, 0, 0, np.nan

    # Rank-transform response and covariates
    y_rank = _rank_transform_vector(y_raw)
    cov_rank = _rank_transform_matrix(cov_matrix)

    f_obs, df_group, df_resid, partial_eta_sq = _compute_group_f_stat(
        y_rank, group_dummies, cov_rank
    )
    if np.isnan(f_obs):
        return np.nan, f_obs, df_group, df_resid, partial_eta_sq

    # Reduced model fit (covariates only)
    n = len(y_rank)
    X_reduced = np.column_stack([np.ones(n), cov_rank])
    try:
        beta_reduced, *_ = np.linalg.lstsq(X_reduced, y_rank, rcond=None)
    except (np.linalg.LinAlgError, ValueError):
        return np.nan, f_obs, df_group, df_resid, partial_eta_sq
    y_hat = X_reduced @ beta_reduced
    resid = y_rank - y_hat

    rng = np.random.default_rng(seed)
    count_extreme = 0
    valid = 0

    for _ in range(n_permutations):
        resid_perm = rng.permutation(resid)
        y_perm = y_hat + resid_perm
        f_perm, _, _, _ = _compute_group_f_stat(y_perm, group_dummies, cov_rank)
        if np.isnan(f_perm):
            continue
        valid += 1
        if f_perm >= f_obs:
            count_extreme += 1

    if valid == 0:
        return np.nan, f_obs, df_group, df_resid, partial_eta_sq

    p_value = (count_extreme + 1) / (valid + 1)
    return float(p_value), f_obs, df_group, df_resid, partial_eta_sq


def _test_binary_nonparametric(
    subset: pd.DataFrame,
    histomic_col: str,
    categorical_col: str,
    cancer_type: str,
    model: str,
    covariates_used: list[str],
    groups: dict,
    group_sizes: dict[str, int],
    group_medians: dict[str, float],
    n_total: int,
    seed: int | None = 42,
) -> CategoricalAssociationResult:
    """Binary test using Mann-Whitney U + Cliff's delta (unadjusted)."""
    group_names = _binary_group_order(list(groups.keys()))
    x = np.array(groups[group_names[0]])
    y = np.array(groups[group_names[1]])

    stat, p_value = mannwhitneyu(x, y, alternative="two-sided")
    delta, ci_low, ci_high = cliffs_delta(x, y, seed=seed)

    group_means = {str(k): float(np.mean(v)) for k, v in groups.items()}

    return CategoricalAssociationResult(
        cancer_type=cancer_type,
        histomic_feature=histomic_col,
        categorical_var=categorical_col,
        test_type="mann_whitney",
        model=model,
        covariates_used=json.dumps(covariates_used),
        test_statistic=stat,
        p_value=p_value,
        effect_size_name="cliffs_delta",
        effect_size=delta,
        effect_ci_lower=ci_low,
        effect_ci_upper=ci_high,
        n_samples=n_total,
        group_sizes=json.dumps(group_sizes),
        group_medians=json.dumps(group_medians),
        group_means=json.dumps(group_means),
        df_model=1,
        df_residual=n_total - 2,
    )


def _test_multilevel_nonparametric(
    subset: pd.DataFrame,
    histomic_col: str,
    categorical_col: str,
    cancer_type: str,
    model: str,
    covariates_used: list[str],
    groups: dict,
    group_sizes: dict[str, int],
    group_medians: dict[str, float],
    n_total: int,
    n_groups: int,
    seed: int | None = 42,
) -> CategoricalAssociationResult:
    """Multi-level test using Kruskal-Wallis + eta-squared (unadjusted)."""
    group_arrays = [np.array(v) for v in groups.values()]
    stat, p_value = kruskal(*group_arrays)
    eta_sq, ci_low, ci_high = eta_squared_kw(
        stat,
        n_total,
        n_groups,
        groups=group_arrays,
        seed=seed,
    )

    group_means = {str(k): float(np.mean(v)) for k, v in groups.items()}

    return CategoricalAssociationResult(
        cancer_type=cancer_type,
        histomic_feature=histomic_col,
        categorical_var=categorical_col,
        test_type="kruskal_wallis",
        model=model,
        covariates_used=json.dumps(covariates_used),
        test_statistic=stat,
        p_value=p_value,
        effect_size_name="eta_squared",
        effect_size=eta_sq,
        effect_ci_lower=ci_low,
        effect_ci_upper=ci_high,
        n_samples=n_total,
        group_sizes=json.dumps(group_sizes),
        group_medians=json.dumps(group_medians),
        group_means=json.dumps(group_means),
        df_model=n_groups - 1,
        df_residual=n_total - n_groups,
    )


def _test_binary_rank_ancova(
    subset: pd.DataFrame,
    histomic_col: str,
    categorical_col: str,
    cancer_type: str,
    model: str,
    covariates_used: list[str],
    cov_matrix: np.ndarray,
    groups: dict,
    group_sizes: dict[str, int],
    group_medians: dict[str, float],
    n_total: int,
    *,
    n_permutations: int = 1000,
    seed: int | None = 42,
) -> CategoricalAssociationResult | None:
    """Binary test using rank-ANCOVA with permutation p-values (covariate-adjusted)."""
    group_names = _binary_group_order(list(groups.keys()))
    group_indicator = (subset[categorical_col] == group_names[0]).astype(float).values
    y = subset[histomic_col].values

    group_dummies = group_indicator.reshape(-1, 1)

    p_value, f_stat, df_group, df_resid, partial_eta_sq = _permutation_p_value_rank_ancova(
        y,
        group_dummies,
        cov_matrix,
        n_permutations=n_permutations,
        seed=seed,
    )

    if np.isnan(f_stat) or df_resid <= 0:
        return None

    ci_low, ci_high = _bootstrap_ci_partial_eta_rank_ancova(
        y,
        group_dummies,
        cov_matrix,
        seed=seed,
    )

    group_means = {str(k): float(np.mean(v)) for k, v in groups.items()}

    return CategoricalAssociationResult(
        cancer_type=cancer_type,
        histomic_feature=histomic_col,
        categorical_var=categorical_col,
        test_type="rank_ancova",
        model=model,
        covariates_used=json.dumps(covariates_used),
        test_statistic=float(f_stat),
        p_value=float(p_value),
        effect_size_name="partial_eta_squared",
        effect_size=float(partial_eta_sq),
        effect_ci_lower=ci_low,
        effect_ci_upper=ci_high,
        n_samples=n_total,
        group_sizes=json.dumps(group_sizes),
        group_medians=json.dumps(group_medians),
        group_means=json.dumps(group_means),
        df_model=df_group,
        df_residual=df_resid,
    )


def _test_multilevel_rank_ancova(
    subset: pd.DataFrame,
    histomic_col: str,
    categorical_col: str,
    cancer_type: str,
    model: str,
    covariates_used: list[str],
    cov_matrix: np.ndarray,
    groups: dict,
    group_sizes: dict[str, int],
    group_medians: dict[str, float],
    n_total: int,
    n_groups: int,
    *,
    n_permutations: int = 1000,
    seed: int | None = 42,
) -> CategoricalAssociationResult | None:
    """Multi-level test using rank-ANCOVA with permutation p-values (covariate-adjusted)."""
    y = subset[histomic_col].values
    n = len(y)

    # Create dummy variables for groups (k-1 dummies for k groups, last group is reference)
    group_labels = sorted(groups.keys(), key=str)
    group_dummies = []
    for g in group_labels[:-1]:
        dummy = (subset[categorical_col] == g).astype(float).values
        group_dummies.append(dummy)
    group_dummies = np.column_stack(group_dummies) if group_dummies else np.empty((n, 0))

    p_value, f_stat, df_group, df_resid, partial_eta_sq = _permutation_p_value_rank_ancova(
        y,
        group_dummies,
        cov_matrix,
        n_permutations=n_permutations,
        seed=seed,
    )

    if np.isnan(f_stat) or df_resid <= 0:
        return None

    ci_low, ci_high = _bootstrap_ci_partial_eta_rank_ancova(
        y,
        group_dummies,
        cov_matrix,
        seed=seed,
    )

    group_means = {str(k): float(np.mean(v)) for k, v in groups.items()}

    return CategoricalAssociationResult(
        cancer_type=cancer_type,
        histomic_feature=histomic_col,
        categorical_var=categorical_col,
        test_type="rank_ancova",
        model=model,
        covariates_used=json.dumps(covariates_used),
        test_statistic=float(f_stat),
        p_value=float(p_value),
        effect_size_name="partial_eta_squared",
        effect_size=float(partial_eta_sq),
        effect_ci_lower=ci_low,
        effect_ci_upper=ci_high,
        n_samples=n_total,
        group_sizes=json.dumps(group_sizes),
        group_medians=json.dumps(group_medians),
        group_means=json.dumps(group_means),
        df_model=df_group,
        df_residual=df_resid,
    )


def test_categorical_association(
    df: pd.DataFrame,
    histomic_col: str,
    categorical_col: str,
    cancer_type: str,
    model: str,
    covariate_cols: list[str],
    n_permutations: int = 1000,
    seed: int | None = 42,
) -> CategoricalAssociationResult | None:
    """
    Test association between histomic feature and categorical variable.

    For unadjusted models: uses nonparametric tests (Mann-Whitney U / Kruskal-Wallis).
    For covariate-adjusted models: uses rank-ANCOVA with permutation p-values
    (Freedman-Lane) for robust inference under non-normality.

    Args:
        df: DataFrame with feature and categorical columns
        histomic_col: Name of histomic feature column
        categorical_col: Name of categorical column
        cancer_type: Cancer type
        model: Model type
        covariate_cols: List of covariate column names
        n_permutations: Number of permutations for rank-ANCOVA (adjusted models)
        seed: Random seed for permutation test

    Returns:
        CategoricalAssociationResult or None if insufficient data
    """
    cols = [histomic_col, categorical_col] + covariate_cols
    subset = df[cols].dropna().copy()

    if len(subset) < 20:
        return None

    cov_matrix, _, used_covariates = build_covariate_matrix(subset, covariate_cols)
    if covariate_cols and (cov_matrix is None or len(used_covariates) == 0):
        return None

    # Adjusted models require n>=30 (more parameters to estimate)
    if cov_matrix is not None and cov_matrix.shape[1] > 0 and len(subset) < 30:
        return None

    # Check if we have too many covariates relative to sample size
    if cov_matrix is not None and cov_matrix.shape[1] >= len(subset) - 2:
        return None

    # Determine if we should use rank-ANCOVA (covariate-adjusted) or nonparametric (unadjusted)
    use_rank_ancova = cov_matrix is not None and cov_matrix.shape[1] > 0

    # Get groups from raw values (not residualized)
    groups = subset.groupby(categorical_col)[histomic_col].apply(list).to_dict()
    groups = {k: v for k, v in groups.items() if len(v) >= 5}

    if len(groups) < 2:
        return None

    # Filter subset to only include rows from groups that passed the size filter
    # This is critical for parametric tests where we create dummy variables
    valid_group_labels = set(groups.keys())
    subset = subset[subset[categorical_col].isin(valid_group_labels)].copy()

    # Rebuild covariate matrix after filtering (if using rank-ANCOVA)
    if use_rank_ancova:
        cov_matrix, _, used_covariates = build_covariate_matrix(subset, covariate_cols)
        if cov_matrix is None or cov_matrix.shape[1] == 0 or len(used_covariates) == 0:
            return None

    group_sizes = {str(k): len(v) for k, v in groups.items()}
    group_medians = {str(k): float(np.median(v)) for k, v in groups.items()}

    n_groups = len(groups)
    n_total = sum(len(v) for v in groups.values())

    if n_groups == 2:
        if use_rank_ancova:
            return _test_binary_rank_ancova(
                subset,
                histomic_col,
                categorical_col,
                cancer_type,
                model,
                used_covariates,
                cov_matrix,
                groups,
                group_sizes,
                group_medians,
                n_total,
                n_permutations=n_permutations,
                seed=seed,
            )
        return _test_binary_nonparametric(
            subset,
            histomic_col,
            categorical_col,
            cancer_type,
            model,
            used_covariates,
            groups,
            group_sizes,
            group_medians,
            n_total,
            seed=seed,
        )

    if use_rank_ancova:
        return _test_multilevel_rank_ancova(
            subset,
            histomic_col,
            categorical_col,
            cancer_type,
            model,
            used_covariates,
            cov_matrix,
            groups,
            group_sizes,
            group_medians,
            n_total,
            n_groups,
            n_permutations=n_permutations,
            seed=seed,
        )

    return _test_multilevel_nonparametric(
        subset,
        histomic_col,
        categorical_col,
        cancer_type,
        model,
        used_covariates,
        groups,
        group_sizes,
        group_medians,
        n_total,
        n_groups,
        seed=seed,
    )


def _categorical_task(
    cancer_df: pd.DataFrame,
    hist_feat: str,
    cat_var: str,
    cancer: str,
    model: str,
    covariate_cols: list[str],
    n_permutations: int,
    seed: int | None,
) -> dict | None:
    """Execute a single categorical association task (for parallel execution)."""
    result = test_categorical_association(
        cancer_df,
        hist_feat,
        cat_var,
        cancer,
        model,
        covariate_cols,
        n_permutations=n_permutations,
        seed=seed,
    )
    return asdict(result) if result else None


def run_categorical_analysis(
    df: pd.DataFrame,
    histomic_features: list,
    categorical_vars: list,
    model: str,
    covariate_cols: list[str],
    min_samples_per_cancer: int = 30,
    show_progress: bool = True,
    n_permutations: int = 1000,
    seed: int | None = 42,
    n_jobs: int = -1,
) -> pd.DataFrame:
    """
    Run categorical association tests for all combinations.

    Args:
        df: DataFrame with features and categorical variables
        histomic_features: List of histomic feature column names
        categorical_vars: List of categorical variable column names
        model: Model type
        covariate_cols: List of covariate column names
        min_samples_per_cancer: Minimum samples per cancer type
        show_progress: Whether to show progress bar
        n_permutations: Number of permutations for rank-ANCOVA (adjusted models)
        seed: Random seed for permutation test
        n_jobs: Number of parallel jobs. -1 uses all available cores.
            Use 1 for sequential execution.

    Returns:
        DataFrame with association results
    """
    cancer_types = df["cancer_type"].unique()

    # Filter to existing columns
    categorical_vars = [c for c in categorical_vars if c in df.columns]

    if not categorical_vars:
        return pd.DataFrame()

    # Pre-compute cancer DataFrames and filter by sample count
    cancer_dfs = {}
    for cancer in cancer_types:
        cancer_df = df[df["cancer_type"] == cancer]
        if len(cancer_df) >= min_samples_per_cancer:
            cancer_dfs[cancer] = cancer_df

    if not cancer_dfs:
        return pd.DataFrame()

    # Build task list with per-task seeds
    tasks = []
    for cancer, cancer_df in cancer_dfs.items():
        for hist_feat in histomic_features:
            for cat_var in categorical_vars:
                task_seed = get_task_seed(seed, cancer, hist_feat, cat_var)
                tasks.append((cancer_df, hist_feat, cat_var, cancer, task_seed))

    if not tasks:
        return pd.DataFrame()

    # Sequential execution for n_jobs=1 or small workloads
    if n_jobs == 1 or len(tasks) < 10:
        results = []
        iterator = tqdm(
            tasks,
            desc="Categorical associations",
            disable=not show_progress,
        )
        for cancer_df, hist_feat, cat_var, cancer, task_seed in iterator:
            result = _categorical_task(
                cancer_df,
                hist_feat,
                cat_var,
                cancer,
                model,
                covariate_cols,
                n_permutations,
                task_seed,
            )
            if result:
                results.append(result)
        return pd.DataFrame(results)

    # Parallel execution
    results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_categorical_task)(
            cancer_df,
            hist_feat,
            cat_var,
            cancer,
            model,
            covariate_cols,
            n_permutations,
            task_seed,
        )
        for cancer_df, hist_feat, cat_var, cancer, task_seed in tqdm(
            tasks,
            desc="Categorical associations",
            disable=not show_progress,
        )
    )

    # Filter out None results
    results = [r for r in results if r is not None]

    return pd.DataFrame(results)
