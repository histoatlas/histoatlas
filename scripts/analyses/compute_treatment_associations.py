#!/usr/bin/env python3
"""
Compute Treatment Response Associations for HistoAtlas.

Tests associations between histomic features and treatment/response variables:
- Radiation therapy (yes/no)
- Neoadjuvant treatment (yes/no)
- Tumor recurrence after initial treatment (yes/no)

Uses Mann-Whitney U test with Cliff's delta effect size and bootstrap CI.
Benjamini-Hochberg correction applied per cancer type and treatment variable.

Output:
- treatment_associations.parquet
"""

import logging
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from scipy.stats import mannwhitneyu
from tqdm.auto import tqdm

from histoatlas import apply_bh_correction, get_histomic_features, select_case_representative_slides
from histoatlas.molecular.categorical import cliffs_delta

# Suppress RuntimeWarnings from Mann-Whitney U edge cases and divide-by-zero in effect sizes
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")
warnings.filterwarnings("ignore", message=".*divide by zero.*")

logger = logging.getLogger(__name__)


TREATMENT_COLUMN_MAP: dict[str, str] = {
    "RADIATION_THERAPY": "radiation_therapy",
    "HISTORY_NEOADJUVANT_TRTYN": "neoadjuvant_treatment",
    "NEW_TUMOR_EVENT_AFTER_INITIAL_TREATMENT": "tumor_recurrence",
}

TREATMENT_YES_VALUES: frozenset[str] = frozenset(
    {
        "Yes",
        "Yes (Pharmaceutical Treatment Prior To Resection)",
    }
)


@dataclass
class Config:
    """Configuration for treatment association analysis."""

    min_samples_with_treatment: int = 30  # per cancer type
    min_group_size: int = 5  # per treatment group
    min_total_samples: int = 20  # per association test

    @property
    def slides_path(self) -> Path:
        from _paths import SLIDE_HISTOMICS

        return SLIDE_HISTOMICS

    @property
    def patient_path(self) -> Path:
        from _paths import CLINICAL_PATIENT

        return CLINICAL_PATIENT

    @property
    def output_path(self) -> Path:
        from _paths import TREATMENT_ASSOCIATIONS

        return TREATMENT_ASSOCIATIONS


@dataclass
class TreatmentAssociationResult:
    """Result of treatment response association test."""

    cancer_type: str
    histomic_feature: str
    treatment_var: str  # 'radiation_therapy', 'neoadjuvant', 'tumor_recurrence'
    test_statistic: float
    p_value: float
    cliffs_delta: float
    cliffs_delta_ci_lower: float
    cliffs_delta_ci_upper: float
    n_treated: int
    n_untreated: int
    median_treated: float
    median_untreated: float
    data_completeness: float  # Proportion of cohort with treatment data


def test_treatment_association(
    df: pd.DataFrame,
    histomic_col: str,
    treatment_col: str,
    cancer_type: str,
    treatment_var_name: str,
    config: Config,
) -> TreatmentAssociationResult | None:
    """Test association between histomic feature and treatment/response."""
    mask = df[histomic_col].notna() & df[treatment_col].notna()
    subset = df.loc[mask].copy()

    if len(subset) < config.min_total_samples:
        return None

    # Get treated vs untreated groups
    treated = subset[subset[treatment_col] == 1][histomic_col].values
    untreated = subset[subset[treatment_col] == 0][histomic_col].values

    if len(treated) < config.min_group_size or len(untreated) < config.min_group_size:
        return None

    # Mann-Whitney U test
    stat, p_value = mannwhitneyu(treated, untreated, alternative="two-sided")

    # Cliff's delta with bootstrap CI
    delta, ci_lower, ci_upper = cliffs_delta(treated, untreated)

    # Data completeness
    total_cancer = len(df)
    completeness = len(subset) / total_cancer if total_cancer > 0 else 0

    return TreatmentAssociationResult(
        cancer_type=cancer_type,
        histomic_feature=histomic_col,
        treatment_var=treatment_var_name,
        test_statistic=stat,
        p_value=p_value,
        cliffs_delta=delta,
        cliffs_delta_ci_lower=ci_lower,
        cliffs_delta_ci_upper=ci_upper,
        n_treated=len(treated),
        n_untreated=len(untreated),
        median_treated=np.median(treated),
        median_untreated=np.median(untreated),
        data_completeness=completeness,
    )


def _map_treatment_values(patient_df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Map original treatment columns to binary 0/1 values.

    Returns:
        Tuple of (modified patient_df, list of available treatment column names).
    """
    available_treatment_cols = []
    for orig_col, new_col in TREATMENT_COLUMN_MAP.items():
        if orig_col in patient_df.columns:
            patient_df[new_col] = patient_df[orig_col].map(
                lambda x: 1 if x in TREATMENT_YES_VALUES else (0 if x == "No" else np.nan)
            )
            available_treatment_cols.append(new_col)
    return patient_df, available_treatment_cols


def load_data(config: Config) -> tuple[pd.DataFrame, list[str]]:
    """Load slides and patient data, merge treatment variables.

    Returns:
        Tuple of (merged dataframe, list of histomic feature column names).
    """
    logger.info("Loading data...")

    slides_df = pd.read_parquet(config.slides_path)
    if "case_id" not in slides_df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")

    # Enforce one slide per case to avoid pseudo-replication
    slides_df, case_meta = select_case_representative_slides(slides_df)
    logger.info(
        "Case selection: %d slides -> %d cases (dropped %d duplicates)",
        case_meta["n_rows_in"],
        case_meta["n_rows_out"],
        case_meta["n_duplicates_dropped"],
    )

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        # Subset cancer types
        cancer_counts = slides_df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(dry_run.n_cancer_types).index.tolist()
        slides_df = slides_df[slides_df["cancer_type"].isin(top_cancers)]
        logger.info(
            f"[DRY-RUN] Subset to {len(slides_df)} cases ({dry_run.n_cancer_types} cancers)"
        )

    patient_df = pd.read_parquet(config.patient_path)
    if "case_id" not in patient_df.columns:
        for col in ["patientId", "patient_id"]:
            if col in patient_df.columns:
                patient_df["case_id"] = patient_df[col]
                break
        else:
            raise ValueError(
                "Patient data must contain a 'case_id', 'patientId', or 'patient_id' column."
            )

    # Extract histomic features (numeric only, excluding metadata/QC/embedding columns)
    histomic_features = get_histomic_features(slides_df)

    # Subset features in dry-run mode
    if dry_run:
        histomic_features = histomic_features[: dry_run.n_features]
        logger.info(f"[DRY-RUN] Subset to {len(histomic_features)} features")

    logger.info("Cases: %d", len(slides_df))
    logger.info("Histomic features: %d", len(histomic_features))

    # Map treatment variables
    patient_df, available_treatment_cols = _map_treatment_values(patient_df)

    # Merge treatment variables from patient data
    merged_df = slides_df.copy()
    if available_treatment_cols:
        merged_df = merged_df.merge(
            patient_df[["case_id", *available_treatment_cols]], on="case_id", how="left"
        )

    logger.info("Merged dataset: %d cases", len(merged_df))
    logger.info("Treatment variables: %s", available_treatment_cols)

    return merged_df, histomic_features


def _test_one_task(
    cancer_df: pd.DataFrame,
    hist_feat: str,
    treatment_var: str,
    cancer: str,
    config: Config,
) -> dict | None:
    """Test a single (cancer, treatment, feature) combination."""
    result = test_treatment_association(
        cancer_df, hist_feat, treatment_var, cancer, treatment_var, config
    )
    return asdict(result) if result else None


def compute_treatment_associations(
    df: pd.DataFrame,
    histomic_features: list[str],
    treatment_vars: list[str],
    config: Config,
) -> list[dict]:
    """Compute associations between histomic features and treatment variables.

    Returns:
        List of result dictionaries.
    """
    import os

    from joblib import Parallel, delayed

    n_jobs = int(os.environ.get("HISTOATLAS_N_JOBS", "1"))
    logger.info("Computing treatment response associations (n_jobs=%d)...", n_jobs)

    from _cohorts import build_cancer_cohorts

    cohorts = build_cancer_cohorts(df, list(df["cancer_type"].unique()))

    # Build list of tasks: (cancer_df, hist_feat, treatment_var, cancer)
    tasks = []
    for treatment_var in treatment_vars:
        if treatment_var not in df.columns:
            continue

        for cancer, (cancer_df, _strata) in cohorts.items():
            n_with_data = cancer_df[treatment_var].notna().sum()
            if n_with_data < config.min_samples_with_treatment:
                continue

            for hist_feat in histomic_features:
                tasks.append((cancer_df, hist_feat, treatment_var, cancer))

    logger.info("   Dispatching %d treatment association tasks (n_jobs=%d)", len(tasks), n_jobs)

    task_results = Parallel(n_jobs=n_jobs, backend="loky")(
        delayed(_test_one_task)(cancer_df, hist_feat, treatment_var, cancer, config)
        for cancer_df, hist_feat, treatment_var, cancer in tqdm(
            tasks, desc="Treatment associations"
        )
    )

    return [r for r in task_results if r is not None]


def save_results(results: list[dict], config: Config) -> None:
    """Apply BH correction and save results to parquet."""
    from _paths import PRECOMPUTED_STATS_DIR, ensure_dirs

    logger.info("Saving results...")

    ensure_dirs()
    PRECOMPUTED_STATS_DIR.mkdir(parents=True, exist_ok=True)

    if not results:
        logger.info("No treatment associations computed (insufficient data)")
        pd.DataFrame().to_parquet(config.output_path, index=False)
        logger.info("Saved empty %s", config.output_path.name)
        return

    results_df = pd.DataFrame(results)

    results_df = apply_bh_correction(
        results_df, p_col="p_value", groupby_cols=["cancer_type", "treatment_var"]
    )
    results_df["is_significant"] = results_df["p_value_adj"] < 0.05

    logger.info("Total associations: %d", len(results_df))
    logger.info("Significant (p_adj < 0.05): %d", results_df["is_significant"].sum())

    results_df.to_parquet(config.output_path, index=False)
    logger.info("Saved %s", config.output_path.name)


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    logger.info("=" * 60)
    logger.info("TREATMENT RESPONSE ASSOCIATIONS")
    logger.info("=" * 60)

    config = Config()

    merged_df, histomic_features = load_data(config)

    treatment_vars = list(TREATMENT_COLUMN_MAP.values())
    results = compute_treatment_associations(merged_df, histomic_features, treatment_vars, config)

    save_results(results, config)

    logger.info("=" * 60)
    logger.info("TREATMENT ASSOCIATIONS COMPLETE")
    logger.info("=" * 60)
    logger.info("Output: %s", config.output_path.name)


if __name__ == "__main__":
    main()
