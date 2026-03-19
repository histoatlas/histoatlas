"""Association analysis between histomics vector and survival outcomes."""

from histoatlas.survival._results import CoxRegressionResult, KaplanMeierResult, RMSTResult
from histoatlas.survival.covariates import coarsen_stage, select_covariates
from histoatlas.survival.cox import run_cox_regression
from histoatlas.survival.imputation import (
    compute_missingness_stats,
    impute_covariates,
    pool_cox_results,
)
from histoatlas.survival.kaplan_meier import (
    compute_cluster_survival,
    compute_km_curves,
    compute_median_survival,
)
from histoatlas.survival.rmst import compute_rmst, compute_rmst_difference

__all__ = [
    # Result dataclasses
    "CoxRegressionResult",
    "KaplanMeierResult",
    "RMSTResult",
    # Covariates
    "coarsen_stage",
    "select_covariates",
    # Cox regression
    "run_cox_regression",
    # Imputation
    "compute_missingness_stats",
    "impute_covariates",
    "pool_cox_results",
    # Kaplan-Meier
    "compute_km_curves",
    "compute_cluster_survival",
    "compute_median_survival",
    # RMST
    "compute_rmst",
    "compute_rmst_difference",
]
