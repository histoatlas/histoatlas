"""Correlation analysis functions for histomic-molecular associations."""

import json
from dataclasses import asdict

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from scipy import stats
from tqdm.auto import tqdm

from histoatlas.molecular._parallel import get_task_seed
from histoatlas.molecular._results import CorrelationResult


def _bootstrap_ci_spearman(
    x: np.ndarray,
    y: np.ndarray,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int | None = 42,
) -> tuple[float, float]:
    """
    Compute bootstrap percentile CI for unadjusted Spearman correlation.

    Uses batch index generation for efficiency.

    Args:
        x: First variable
        y: Second variable
        n_bootstrap: Number of bootstrap samples
        alpha: Significance level (default 0.05 for 95% CI)
        seed: Random seed for reproducibility

    Returns:
        (ci_lower, ci_upper) tuple
    """
    rng = np.random.default_rng(seed)
    n = len(x)

    # Generate all bootstrap indices at once
    boot_indices = rng.choice(n, size=(n_bootstrap, n), replace=True)
    bootstrap_rhos = []

    for i in range(n_bootstrap):
        x_boot = x[boot_indices[i]]
        y_boot = y[boot_indices[i]]

        if np.std(x_boot) < 1e-10 or np.std(y_boot) < 1e-10:
            continue

        x_rank = stats.rankdata(x_boot, method="average")
        y_rank = stats.rankdata(y_boot, method="average")
        rho_boot = np.corrcoef(x_rank, y_rank)[0, 1]
        if not np.isnan(rho_boot):
            bootstrap_rhos.append(rho_boot)

    if len(bootstrap_rhos) < n_bootstrap * 0.5:
        return np.nan, np.nan

    lower = np.percentile(bootstrap_rhos, 100 * alpha / 2)
    upper = np.percentile(bootstrap_rhos, 100 * (1 - alpha / 2))
    return lower, upper


def _analytical_p_partial_spearman(rho: float, n: int, k: int) -> float:
    """T-test p-value for partial Spearman correlation.

    Uses t = r * sqrt(df / (1 - r^2)) with df = n - 2 - k,
    matching R's ppcor::pcor.test() and Python's pingouin.partial_corr().

    Args:
        rho: Partial Spearman correlation coefficient
        n: Sample size
        k: Number of covariate columns (after one-hot encoding)

    Returns:
        Two-sided p-value
    """
    df = n - 2 - k
    if df <= 0 or np.isnan(rho):
        return np.nan
    rho2 = rho * rho
    if rho2 >= 1.0:
        return 0.0
    t_stat = rho * np.sqrt(df / (1 - rho2))
    return float(2 * stats.t.sf(np.abs(t_stat), df))


def build_covariate_matrix(
    df: pd.DataFrame, covariate_cols: list[str]
) -> tuple[np.ndarray | None, list[str], list[str]]:
    """
    Create a numeric covariate matrix with one-hot encoding for categorical columns.

    Args:
        df: DataFrame with covariate columns
        covariate_cols: List of covariate column names

    Returns:
        (covariate_matrix, column_names, used_covariates) tuple, or (None, [], [])
        if no valid covariates
    """
    if not covariate_cols:
        return None, [], []

    existing_cols = [c for c in covariate_cols if c in df.columns]
    if not existing_cols:
        return None, [], []

    cov_df = df[existing_cols].copy()
    if cov_df.empty:
        return None, [], []

    cat_cols = [
        c
        for c in cov_df.columns
        if cov_df[c].dtype == "object" or str(cov_df[c].dtype).startswith("category")
    ]
    if cat_cols:
        cov_df = pd.get_dummies(cov_df, columns=cat_cols, drop_first=True)

    cov_df = cov_df.apply(pd.to_numeric, errors="coerce")
    cov_df = cov_df.dropna(axis=1, how="all")
    if cov_df.empty:
        return None, [], []

    # Drop zero-variance columns
    variances = cov_df.var(axis=0)
    cov_df = cov_df.loc[:, variances > 0]
    if cov_df.empty:
        return None, [], []

    col_names = cov_df.columns.tolist()
    used_covariates = []
    for orig in existing_cols:
        if orig in col_names or any(col.startswith(f"{orig}_") for col in col_names):
            used_covariates.append(orig)

    return cov_df.values, col_names, used_covariates


def residualize(y: np.ndarray, covariates: np.ndarray | None) -> np.ndarray | None:
    """
    Regress out covariates from y and return residuals.

    Args:
        y: Response variable
        covariates: Covariate matrix (or None)

    Returns:
        Residuals after regressing out covariates, or None if SVD fails
        (e.g., near-singular design matrix from many tied ranks).
    """
    if covariates is None or covariates.size == 0:
        return y

    x = np.column_stack([np.ones(len(y)), covariates])
    try:
        beta, *_ = np.linalg.lstsq(x, y, rcond=None)
    except (np.linalg.LinAlgError, ValueError):
        # LinAlgError: SVD non-convergence
        # ValueError: LAPACK illegal value (e.g., DLASCL with NaN/Inf)
        return None
    residuals: np.ndarray = y - x @ beta
    return residuals


def _rank_transform_matrix(matrix: np.ndarray) -> np.ndarray:
    """
    Rank-transform each column of a 2D matrix (Spearman-style).

    Args:
        matrix: 2D array of covariates

    Returns:
        Rank-transformed matrix with the same shape
    """
    ranked = np.empty_like(matrix, dtype=float)
    for j in range(matrix.shape[1]):
        ranked[:, j] = stats.rankdata(matrix[:, j], method="average")
    return ranked


def _bootstrap_ci_partial_spearman(
    x_raw: np.ndarray,
    y_raw: np.ndarray,
    cov_matrix: np.ndarray,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int | None = 42,
) -> tuple[float, float]:
    """
    Compute bootstrap percentile confidence interval for partial Spearman correlation.

    Resamples observations with replacement and recomputes the full partial Spearman
    (rank -> residualize -> correlate) for each bootstrap sample.

    Args:
        x_raw: Raw x values
        y_raw: Raw y values
        cov_matrix: Covariate matrix
        n_bootstrap: Number of bootstrap samples
        alpha: Significance level (default 0.05 for 95% CI)
        seed: Random seed for reproducibility

    Returns:
        (ci_lower, ci_upper) tuple
    """
    rng = np.random.default_rng(seed)
    n = len(x_raw)
    bootstrap_rhos = []

    for _ in range(n_bootstrap):
        # Resample indices with replacement
        indices = rng.choice(n, size=n, replace=True)
        x_boot = x_raw[indices]
        y_boot = y_raw[indices]
        cov_boot = cov_matrix[indices]

        # Rank the bootstrap sample (including covariates)
        x_rank = stats.rankdata(x_boot, method="average")
        y_rank = stats.rankdata(y_boot, method="average")
        cov_rank = _rank_transform_matrix(cov_boot)

        # Residualize ranks
        x_rank_adj = residualize(x_rank, cov_rank)
        y_rank_adj = residualize(y_rank, cov_rank)

        # Skip if residualization failed or zero variance
        if x_rank_adj is None or y_rank_adj is None:
            continue
        if np.std(x_rank_adj) < 1e-10 or np.std(y_rank_adj) < 1e-10:
            continue

        rho_boot = np.corrcoef(x_rank_adj, y_rank_adj)[0, 1]
        if not np.isnan(rho_boot):
            bootstrap_rhos.append(rho_boot)

    if len(bootstrap_rhos) == 0 or len(bootstrap_rhos) < n_bootstrap * 0.5:
        # No successful iterations or too many failed, return NaN
        return np.nan, np.nan

    lower = np.percentile(bootstrap_rhos, 100 * alpha / 2)
    upper = np.percentile(bootstrap_rhos, 100 * (1 - alpha / 2))
    return lower, upper


def compute_correlation(
    df: pd.DataFrame,
    histomic_col: str,
    molecular_col: str,
    cancer_type: str,
    molecular_type: str,
    target_set_id: str,
    model: str,
    covariate_cols: list[str],
    n_bootstrap: int = 1000,
    seed: int | None = 42,
) -> CorrelationResult | None:
    """
    Compute Spearman correlation between histomic and molecular features.

    Args:
        df: DataFrame with both features
        histomic_col: Name of histomic feature column
        molecular_col: Name of molecular feature column
        cancer_type: Cancer type
        molecular_type: Type of molecular feature
        target_set_id: Identifier for the target set
        model: Model type ('unadjusted' or 'adjusted')
        covariate_cols: List of covariate column names to adjust for
        n_bootstrap: Number of bootstrap samples for CI
        seed: Random seed for reproducibility

    Returns:
        CorrelationResult or None if insufficient data
    """
    cols = [histomic_col, molecular_col] + covariate_cols
    subset = df[cols].dropna()
    x_raw = subset[histomic_col].values
    y_raw = subset[molecular_col].values
    n = len(x_raw)

    if n < 10:
        return None

    cov_matrix, _, used_covariates = build_covariate_matrix(subset, covariate_cols)
    if covariate_cols and (cov_matrix is None or len(used_covariates) == 0):
        return None
    if cov_matrix is not None and cov_matrix.shape[1] >= n - 2:
        return None

    # Compute Spearman correlation
    if cov_matrix is None:
        # Check for constant arrays (would produce NaN correlation)
        if np.std(x_raw) < 1e-10 or np.std(y_raw) < 1e-10:
            return None

        # Unadjusted Spearman: use scipy analytical p-value
        # (Permutation p-values floor at 1/(n_perm+1), causing banding in volcano plots.
        # The analytical t-approximation is accurate for n >= 10 and avoids this issue.)
        spearman_rho, spearman_p = stats.spearmanr(x_raw, y_raw)
        # Bootstrap CI (consistent with partial Spearman, correct for ties)
        spearman_ci = _bootstrap_ci_spearman(
            x_raw, y_raw, n_bootstrap=n_bootstrap, alpha=0.05, seed=seed
        )
    else:
        # Partial Spearman: residualize ranks of all variables (including covariates)
        x_rank = stats.rankdata(x_raw, method="average")
        y_rank = stats.rankdata(y_raw, method="average")
        cov_rank = _rank_transform_matrix(cov_matrix)
        x_rank_adj = residualize(x_rank, cov_rank)
        y_rank_adj = residualize(y_rank, cov_rank)

        # SVD non-convergence in residualize (near-singular design matrix)
        if x_rank_adj is None or y_rank_adj is None:
            return None

        if np.std(x_rank_adj) < 1e-10 or np.std(y_rank_adj) < 1e-10:
            return None

        # Compute Pearson correlation on residualized ranks (= partial Spearman)
        spearman_rho = np.corrcoef(x_rank_adj, y_rank_adj)[0, 1]

        # Analytical t-test p-value (same formula as R's ppcor::pcor.test())
        k = cov_rank.shape[1]
        spearman_p = _analytical_p_partial_spearman(spearman_rho, n, k)

        # Bootstrap CI (more accurate than Fisher z-transform for partial Spearman)
        spearman_ci = _bootstrap_ci_partial_spearman(
            x_raw,
            y_raw,
            cov_matrix,
            n_bootstrap=n_bootstrap,
            alpha=0.05,
            seed=seed,
        )

    return CorrelationResult(
        cancer_type=cancer_type,
        histomic_feature=histomic_col,
        molecular_feature=molecular_col,
        molecular_type=molecular_type,
        target_set_id=target_set_id,
        model=model,
        covariates_used=json.dumps(used_covariates),
        spearman_rho=spearman_rho,
        spearman_p=spearman_p,
        spearman_ci_lower=spearman_ci[0],
        spearman_ci_upper=spearman_ci[1],
        n_samples=n,
    )


def _correlation_task(
    cancer_df: pd.DataFrame,
    hist_feat: str,
    mol_feat: str,
    cancer: str,
    molecular_type: str,
    target_set_id: str,
    model: str,
    covariate_cols: list[str],
    n_bootstrap: int,
    seed: int | None,
) -> dict | None:
    """Execute a single correlation task (for parallel execution)."""
    result = compute_correlation(
        cancer_df,
        hist_feat,
        mol_feat,
        cancer,
        molecular_type,
        target_set_id,
        model,
        covariate_cols,
        n_bootstrap=n_bootstrap,
        seed=seed,
    )
    return asdict(result) if result else None


def run_correlation_analysis(
    df: pd.DataFrame,
    histomic_features: list,
    molecular_features: list,
    molecular_type: str,
    target_set_id: str,
    model: str,
    covariate_cols: list[str],
    min_samples_per_cancer: int = 30,
    show_progress: bool = True,
    n_bootstrap: int = 1000,
    seed: int | None = 42,
    n_jobs: int = -1,
) -> pd.DataFrame:
    """
    Run correlation analysis for all histomic x molecular pairs, per cancer type.

    Args:
        df: DataFrame with histomic and molecular features
        histomic_features: List of histomic feature column names
        molecular_features: List of molecular feature column names
        molecular_type: Type of molecular features
        target_set_id: Identifier for the target set
        model: Model type
        covariate_cols: List of covariate column names
        min_samples_per_cancer: Minimum samples per cancer type
        show_progress: Whether to show progress bar
        n_bootstrap: Number of bootstrap samples for CI
        seed: Random seed for reproducibility
        n_jobs: Number of parallel jobs. -1 uses all available cores.
            Use 1 for sequential execution.

    Returns:
        DataFrame with correlation results
    """
    cancer_types = df["cancer_type"].unique()

    # Filter out molecular features that don't exist
    molecular_features = [m for m in molecular_features if m in df.columns]

    if not molecular_features:
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
            for mol_feat in molecular_features:
                task_seed = get_task_seed(seed, cancer, hist_feat, mol_feat)
                tasks.append((cancer_df, hist_feat, mol_feat, cancer, task_seed))

    if not tasks:
        return pd.DataFrame()

    # Sequential execution for n_jobs=1 or small workloads
    if n_jobs == 1 or len(tasks) < 10:
        results = []
        iterator = tqdm(
            tasks,
            desc=f"Correlations ({molecular_type})",
            disable=not show_progress,
        )
        for cancer_df, hist_feat, mol_feat, cancer, task_seed in iterator:
            result = _correlation_task(
                cancer_df,
                hist_feat,
                mol_feat,
                cancer,
                molecular_type,
                target_set_id,
                model,
                covariate_cols,
                n_bootstrap,
                task_seed,
            )
            if result:
                results.append(result)
        return pd.DataFrame(results)

    # Parallel execution
    results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_correlation_task)(
            cancer_df,
            hist_feat,
            mol_feat,
            cancer,
            molecular_type,
            target_set_id,
            model,
            covariate_cols,
            n_bootstrap,
            task_seed,
        )
        for cancer_df, hist_feat, mol_feat, cancer, task_seed in tqdm(
            tasks,
            desc=f"Correlations ({molecular_type})",
            disable=not show_progress,
        )
    )

    # Filter out None results
    results = [r for r in results if r is not None]

    return pd.DataFrame(results)
