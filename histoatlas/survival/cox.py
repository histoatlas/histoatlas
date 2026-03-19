"""Cox proportional hazards regression functions."""

import logging
import warnings

import pandas as pd

from histoatlas.survival._results import CoxRegressionResult

logger = logging.getLogger(__name__)


def run_cox_regression(
    data: pd.DataFrame,
    feature: str,
    time_col: str = "os_months",
    event_col: str = "os_status",
    covariates: list | None = None,
    strata: list[str] | None = None,
    penalizer: float = 0.0,
    standardize: bool = True,
) -> CoxRegressionResult | None:
    """
    Run Cox proportional hazards regression for a single feature.

    Args:
        data: DataFrame with feature, time, and event columns
        feature: Name of the feature column
        time_col: Name of the survival time column
        event_col: Name of the event indicator column (1=event, 0=censored)
        covariates: Additional covariates to include in the model
        strata: Columns to use for stratification (separate baseline hazard per stratum).
            Strata columns are not included as regression covariates.
        penalizer: L2 penalizer for Cox regression. Default is 0.0 (no penalization)
            which yields valid Wald-based p-values and confidence intervals.
            Penalization is unnecessary here because:
            - Models have few covariates (1 feature + optional age/sex/stage)
            - Features are standardized before fitting
            - Minimum sample size (n>=30) and events (>=10) are enforced
            Note: Non-zero penalization invalidates standard Wald inference.
        standardize: Whether to z-score standardize the feature before fitting.
            Default True (HR per 1 SD). Set False for binary features (e.g.,
            mutation status) where HR should reflect per-unit (mutant vs WT) contrast.

    Returns:
        CoxRegressionResult or None if insufficient data
    """
    try:
        from lifelines import CoxPHFitter
        from lifelines.statistics import proportional_hazard_test
    except ImportError:
        raise ImportError(
            "lifelines is required for Cox regression. Install with: pip install lifelines"
        )

    # Prepare data
    cols = [feature, time_col, event_col]
    if covariates:
        cols.extend(covariates)
    if strata:
        cols.extend(strata)

    df_cox = data[cols].dropna()

    if len(df_cox) < 30:  # Minimum sample size
        return None

    if df_cox[event_col].sum() < 10:  # Minimum events
        return None

    df_cox = df_cox.copy()
    if standardize:
        # Standardize the feature for interpretable HR (per 1 SD change)
        feature_mean = df_cox[feature].mean()
        feature_std = df_cox[feature].std()
        if feature_std == 0:
            return None
        df_cox[feature] = (df_cox[feature] - feature_mean) / feature_std
    else:
        # No standardization: HR reflects per-unit change (e.g., mutant vs WT)
        feature_mean = 0.0
        feature_std = 1.0
        if df_cox[feature].std() == 0:
            return None

    # Standardize numeric covariates and one-hot encode categorical covariates
    if covariates:
        for cov in covariates:
            if pd.api.types.is_numeric_dtype(df_cox[cov]):
                # Standardize numeric covariates
                cov_std = df_cox[cov].std()
                if cov_std > 0:
                    df_cox[cov] = (df_cox[cov] - df_cox[cov].mean()) / cov_std
            else:
                # One-hot encode categorical covariates (drop first to avoid multicollinearity)
                dummies = pd.get_dummies(df_cox[cov], prefix=cov, drop_first=True)
                df_cox = pd.concat([df_cox.drop(columns=[cov]), dummies], axis=1)

    if penalizer > 0:
        logger.warning(
            f"Using penalizer={penalizer} for feature '{feature}'. "
            "Non-zero penalization invalidates Wald-based p-values and confidence intervals."
        )

    try:
        cph = CoxPHFitter(penalizer=penalizer)
        cph.fit(df_cox, duration_col=time_col, event_col=event_col, strata=strata)

        # Extract feature results
        summary = cph.summary
        hr = summary.loc[feature, "exp(coef)"]
        hr_lower = summary.loc[feature, "exp(coef) lower 95%"]
        hr_upper = summary.loc[feature, "exp(coef) upper 95%"]
        p_value = summary.loc[feature, "p"]

        # Proportional hazards test using Schoenfeld residuals
        ph_test_p = None
        ph_flag = "unknown"

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                ph_result = proportional_hazard_test(cph, df_cox, time_transform="km")

                # Get p-value for the feature
                if feature in ph_result.summary.index:
                    ph_test_p = float(ph_result.summary.loc[feature, "p"])

                # Determine PH flag based on p-value
                if ph_test_p is not None:
                    if ph_test_p < 0.01:
                        ph_flag = "fail"  # Strong evidence of PH violation
                    elif ph_test_p < 0.05:
                        ph_flag = "warn"  # Moderate evidence of PH violation
                    else:
                        ph_flag = "pass"  # No evidence of PH violation
        except Exception as e:
            logger.warning(
                f"Proportional hazards test failed for feature '{feature}': {type(e).__name__}: {e}"
            )
            ph_test_p = None
            ph_flag = "error"

        return CoxRegressionResult(
            feature=feature,
            hazard_ratio=hr,
            hr_ci_lower=hr_lower,
            hr_ci_upper=hr_upper,
            p_value=p_value,
            n_samples=len(df_cox),
            n_events=int(df_cox[event_col].sum()),
            concordance=cph.concordance_index_,
            feature_mean=feature_mean,
            feature_std=feature_std,
            ph_test_p=ph_test_p,
            ph_flag=ph_flag,
        )

    except Exception as e:
        logger.warning(f"Cox regression failed for feature '{feature}': {type(e).__name__}: {e}")
        return None
