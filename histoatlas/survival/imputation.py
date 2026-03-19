"""Multiple imputation for missing covariates in adjusted Cox models.

Uses MICE (Multiple Imputation by Chained Equations) via sklearn's IterativeImputer
with BayesianRidge, and pools results using Rubin's rules.
"""

import logging

import numpy as np
import pandas as pd
from scipy import stats

from histoatlas.survival._results import CoxRegressionResult

logger = logging.getLogger(__name__)

MAX_MISSING_FRACTION = 0.20


def compute_missingness_stats(
    data: pd.DataFrame,
    covariates: list[str],
    feature: str,
    time_col: str,
    event_col: str,
) -> dict:
    """Compute per-covariate missingness fractions for the analysis-eligible subset.

    Only rows where feature + outcome are non-missing are considered,
    since those are the rows that would enter the Cox model.

    Args:
        data: Full DataFrame
        covariates: Covariate column names (e.g. ["age_at_diagnosis", "sex", "stage"])
        feature: Feature column name
        time_col: Survival time column
        event_col: Event indicator column

    Returns:
        Dict with per-covariate missing fractions and sample counts.
    """
    # Restrict to rows eligible for analysis (feature + outcome present)
    mask = data[feature].notna() & data[time_col].notna() & data[event_col].notna()
    eligible = data.loc[mask]
    n_total = len(eligible)

    # Complete-case count (all covariates also present)
    complete_mask = eligible[covariates].notna().all(axis=1)
    n_complete = int(complete_mask.sum())

    result = {
        "n_total": n_total,
        "n_complete_case": n_complete,
        "pct_dropped": round(100 * (1 - n_complete / n_total), 1) if n_total > 0 else 0.0,
    }

    for cov in covariates:
        n_missing = int(eligible[cov].isna().sum())
        result[cov] = round(n_missing / n_total, 4) if n_total > 0 else 0.0

    return result


def impute_covariates(
    data: pd.DataFrame,
    feature: str,
    time_col: str,
    event_col: str,
    covariates: list[str],
    strata: list[str] | None = None,
    n_imputations: int = 5,
    random_state: int = 42,
) -> list[pd.DataFrame] | None:
    """Impute missing covariates using MICE (IterativeImputer).

    Returns None if any covariate has >20% missing (fall back to complete-case).
    Feature, survival, and strata columns are used as auxiliary variables for
    imputation but are NOT themselves imputed — only covariate columns are imputed.

    Args:
        data: DataFrame with feature, survival, covariate, and optionally strata columns
        feature: Feature column name
        time_col: Survival time column
        event_col: Event indicator column
        covariates: Covariate columns to impute
        strata: Optional strata columns (auxiliary for imputation)
        n_imputations: Number of imputed datasets to generate
        random_state: Random seed for reproducibility

    Returns:
        List of n_imputations complete DataFrames, or None if missingness is too high.
    """
    from sklearn.experimental import enable_iterative_imputer  # noqa: F401
    from sklearn.impute import IterativeImputer

    # Only keep rows where feature + outcome are non-missing
    mask = data[feature].notna() & data[time_col].notna() & data[event_col].notna()
    df = data.loc[mask].copy()

    if len(df) < 30:
        return None

    # Check missingness threshold per covariate
    for cov in covariates:
        frac_missing = df[cov].isna().mean()
        if frac_missing > MAX_MISSING_FRACTION:
            logger.info(
                f"   Imputation skipped: {cov} has {frac_missing:.1%} missing "
                f"(threshold: {MAX_MISSING_FRACTION:.0%})"
            )
            return None

    # If no missing values at all, no need to impute
    if df[covariates].notna().all().all():
        return None

    # Identify categorical vs numeric covariates and store code-to-label mappings
    categorical_info: dict[str, tuple[np.ndarray, pd.Index]] = {}
    for cov in covariates:
        if not pd.api.types.is_numeric_dtype(df[cov]):
            codes, uniques = pd.factorize(df[cov], sort=True)
            df[cov] = codes.astype(float)
            df.loc[df[cov] < 0, cov] = np.nan  # factorize uses -1 for NaN
            categorical_info[cov] = (np.arange(len(uniques)), uniques)

    # Build imputation matrix: covariates + auxiliary columns
    aux_cols = [feature, time_col, event_col]
    if strata:
        for s in strata:
            if s in df.columns:
                # Encode strata as numeric for imputer
                if not pd.api.types.is_numeric_dtype(df[s]):
                    codes = pd.factorize(df[s], sort=True)[0].astype(float)
                    codes[codes < 0] = np.nan  # factorize uses -1 for NaN
                    df[s] = codes
                aux_cols.append(s)

    impute_cols = covariates + aux_cols
    impute_matrix = df[impute_cols].values
    n_covariates = len(covariates)

    # Track which columns are covariates (to be imputed) vs auxiliary (not imputed)
    # IterativeImputer imputes all columns, so we'll restore auxiliary columns after
    aux_original = impute_matrix[:, n_covariates:].copy()

    datasets = []
    for i in range(n_imputations):
        imputer = IterativeImputer(
            max_iter=10,
            random_state=random_state + i,
            sample_posterior=True,
        )
        imputed = imputer.fit_transform(impute_matrix)

        # Restore auxiliary columns (feature, time, event, strata) — never impute these
        imputed[:, n_covariates:] = aux_original

        # Round categorical covariates to nearest valid code
        for j, cov in enumerate(covariates):
            if cov in categorical_info:
                valid_codes, _ = categorical_info[cov]
                col = imputed[:, j]
                # Clip and round to nearest valid integer code
                col = np.clip(col, valid_codes.min(), valid_codes.max())
                col = np.round(col).astype(int)
                imputed[:, j] = col

        # Build complete DataFrame
        df_imputed = df.copy()
        for j, col_name in enumerate(impute_cols):
            df_imputed[col_name] = imputed[:, j]

        # Convert categorical covariates back to original labels so that
        # downstream Cox regression treats them as categorical (one-hot encoded)
        # rather than as numeric ordinal variables
        for cov, (_, uniques) in categorical_info.items():
            codes = df_imputed[cov].astype(int)
            df_imputed[cov] = uniques.take(codes)

        datasets.append(df_imputed)

    return datasets


def pool_cox_results(
    results: list[CoxRegressionResult],
) -> tuple[CoxRegressionResult, float]:
    """Pool multiple Cox regression results using Rubin's rules.

    Combines log(HR) estimates and standard errors across imputed datasets
    to produce a single pooled result with correct variance.

    Args:
        results: List of CoxRegressionResult from each imputed dataset

    Returns:
        Tuple of (pooled CoxRegressionResult, fraction_missing_information)
    """
    m = len(results)

    if m == 1:
        return results[0], 0.0

    # Extract log(HR) and back-calculate SE from CI
    log_hrs = np.array([np.log(r.hazard_ratio) for r in results])
    ses = np.array([(np.log(r.hr_ci_upper) - np.log(r.hr_ci_lower)) / (2 * 1.96) for r in results])

    # Rubin's rules
    pooled_log_hr = np.mean(log_hrs)
    within_var = np.mean(ses**2)
    between_var = np.var(log_hrs, ddof=1)
    total_var = within_var + (1 + 1 / m) * between_var

    pooled_se = np.sqrt(total_var)

    # Pooled HR and CI
    pooled_hr = np.exp(pooled_log_hr)
    pooled_ci_lower = np.exp(pooled_log_hr - 1.96 * pooled_se)
    pooled_ci_upper = np.exp(pooled_log_hr + 1.96 * pooled_se)

    # Pooled p-value (Wald test)
    if pooled_se > 0:
        z = pooled_log_hr / pooled_se
        pooled_p = float(2 * (1 - stats.norm.cdf(abs(z))))
    else:
        # All imputations produced identical results with zero variance
        pooled_p = results[0].p_value

    # Fraction of missing information
    fmi = (between_var + between_var / m) / total_var if total_var > 0 else 0.0

    # Pool other quantities: concordance (mean), PH test p (median)
    pooled_concordance = float(np.mean([r.concordance for r in results]))

    ph_ps = [r.ph_test_p for r in results if r.ph_test_p is not None]
    pooled_ph_test_p = float(np.median(ph_ps)) if ph_ps else None

    # Determine pooled PH flag from median p-value
    if pooled_ph_test_p is not None:
        if pooled_ph_test_p < 0.01:
            pooled_ph_flag = "fail"
        elif pooled_ph_test_p < 0.05:
            pooled_ph_flag = "warn"
        else:
            pooled_ph_flag = "pass"
    else:
        pooled_ph_flag = "unknown"

    pooled_result = CoxRegressionResult(
        feature=results[0].feature,
        hazard_ratio=pooled_hr,
        hr_ci_lower=pooled_ci_lower,
        hr_ci_upper=pooled_ci_upper,
        p_value=pooled_p,
        n_samples=results[0].n_samples,  # Same eligible rows across imputations
        n_events=results[0].n_events,
        concordance=pooled_concordance,
        feature_mean=results[0].feature_mean,
        feature_std=results[0].feature_std,
        ph_test_p=pooled_ph_test_p,
        ph_flag=pooled_ph_flag,
    )

    return pooled_result, float(fmi)
