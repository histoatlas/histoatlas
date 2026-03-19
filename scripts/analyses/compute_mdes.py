"""
Compute Minimum Detectable Effect Size (MDES) and Evidence Strength Badges for all analyses.

MDES tells users: "With N=X samples, this analysis can detect an effect of Y with 80% power"

Evidence Strength Badges:
- Strong (green): p_adj < 0.01, |effect| > preset, CI ratio < 2, N > 100
- Moderate (yellow): p_adj < 0.05, |effect| > small threshold (Cohen's small), narrow/moderate CI, N > 50
- Suggestive (orange): p_adj < 0.1 or CI excludes null but wide
- Insufficient (gray): N < 30 or CI includes clinically irrelevant range

This adds MDES and evidence_strength columns to:
1. survival_associations.parquet - MDES for hazard ratios
2. feature_correlations.parquet - MDES for correlation coefficients
3. categorical_associations.parquet - MDES for effect sizes
"""

import json
import logging
import os

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from tqdm.auto import tqdm

from histoatlas import (
    ci_width_category,
    evidence_badge_categorical,
    evidence_badge_correlation,
    evidence_badge_survival,
    mdes_correlation,
    mdes_kruskal_wallis,
    mdes_mann_whitney,
    mdes_survival,
)
from histoatlas.molecular._parallel import get_task_seed

logger = logging.getLogger(__name__)


def _count_covariates(covariates_json: str) -> int:
    """Count covariates from JSON list string."""
    try:
        return len(json.loads(covariates_json))
    except (json.JSONDecodeError, TypeError):
        return 0


def _compute_one_mdes(test_type: str, sizes: tuple[int, ...], seed: int) -> float:
    """Compute MDES for a single unique (test_type, group_sizes) combination."""
    try:
        if test_type == "mann_whitney" and len(sizes) >= 2:
            return mdes_mann_whitney(sizes[0], sizes[1], seed=seed)
        elif test_type == "kruskal_wallis":
            return mdes_kruskal_wallis(list(sizes), seed=seed)
        else:
            return np.nan
    except Exception:
        return np.nan


def _format_categorical_mdes_interpretation(row: pd.Series) -> str:
    """Format human-readable MDES interpretation for categorical tests."""
    if pd.isna(row["mdes_effect"]):
        return "Insufficient samples"
    if row["test_type"] == "mann_whitney":
        return (
            f"Can detect |delta| >= {row['mdes_effect']:.3f} with 80% power (N={row['n_samples']})"
        )
    else:
        return f"Can detect Cohen's f >= {row['mdes_effect']:.3f} with 80% power (N={row['n_samples']})"


def _process_survival_associations(df: pd.DataFrame) -> pd.DataFrame:
    """Add MDES, CI width category, interpretation, and evidence badge to survival data."""
    logger.info("Processing %d survival associations...", len(df))

    mdes_results = pd.Series(
        [mdes_survival(n) for n in tqdm(df["n_events"], desc="Survival MDES")],
        index=df.index,
    )
    df["mdes_hr_harmful"] = mdes_results.apply(lambda x: x[0] if isinstance(x, tuple) else x)
    df["mdes_hr_protective"] = mdes_results.apply(lambda x: x[1] if isinstance(x, tuple) else x)

    df["ci_width_category"] = df.apply(
        lambda row: ci_width_category(row["hr_ci_lower"], row["hr_ci_upper"], "ratio"),
        axis=1,
    )

    df["mdes_interpretation"] = df.apply(
        lambda row: (
            f"Can detect HR >= {row['mdes_hr_harmful']:.2f} (harmful) "
            f"or <= {row['mdes_hr_protective']:.2f} (protective) with 80% power "
            f"(N={row['n_samples']}, events={row['n_events']})"
        )
        if pd.notna(row["mdes_hr_harmful"])
        else "Insufficient events for power calculation",
        axis=1,
    )

    df["evidence_strength_badge"] = df.apply(evidence_badge_survival, axis=1)

    return df


def _process_feature_correlations(df: pd.DataFrame) -> pd.DataFrame:
    """Add MDES, CI width category, interpretation, and evidence badge to correlation data."""
    logger.info("Processing %d feature correlations...", len(df))

    df["mdes_r"] = pd.Series(
        [
            mdes_correlation(
                row["n_samples"], n_covariates=_count_covariates(row["covariates_used"])
            )
            for _, row in tqdm(df.iterrows(), total=len(df), desc="Correlation MDES")
        ],
        index=df.index,
    )

    df["ci_width_category"] = df.apply(
        lambda row: ci_width_category(
            row["spearman_ci_lower"], row["spearman_ci_upper"], "additive"
        ),
        axis=1,
    )

    df["mdes_interpretation"] = df.apply(
        lambda row: f"Can detect |r| >= {row['mdes_r']:.3f} with 80% power (N={row['n_samples']})"
        if pd.notna(row["mdes_r"])
        else "Insufficient samples",
        axis=1,
    )

    df["evidence_strength_badge"] = df.apply(evidence_badge_correlation, axis=1)

    return df


def _process_categorical_associations(df: pd.DataFrame, n_jobs: int) -> pd.DataFrame:
    """Add MDES, CI width category, interpretation, and evidence badge to categorical data."""
    logger.info("Processing %d categorical associations...", len(df))

    # Parse group_sizes once and build a key for deduplication
    def _parse_sizes(gs_json: str) -> tuple[int, ...] | None:
        try:
            return tuple(json.loads(gs_json).values())
        except Exception:
            return None

    df["_sizes_tuple"] = df["group_sizes"].map(_parse_sizes)

    # Extract unique (test_type, sizes_tuple) combinations that need simulation
    simulation_mask = df["test_type"].isin(["mann_whitney", "kruskal_wallis"])
    unique_combos = (
        df.loc[simulation_mask, ["test_type", "_sizes_tuple"]]
        .dropna(subset=["_sizes_tuple"])
        .drop_duplicates()
    )

    # Build task list with deterministic seeds
    base_seed = 42
    tasks = []
    task_keys = []
    for _, row in unique_combos.iterrows():
        test_type = row["test_type"]
        sizes = row["_sizes_tuple"]
        key = (test_type, sizes)
        task_seed = get_task_seed(base_seed, test_type, str(sizes))
        tasks.append((test_type, sizes, task_seed))
        task_keys.append(key)

    logger.info(
        "  %d unique (test_type, group_sizes) combos to simulate (%d total rows)",
        len(tasks),
        len(df),
    )

    # Compute MDES for unique combos in parallel
    if tasks:
        if n_jobs == 1 or len(tasks) < 10:
            results = [
                _compute_one_mdes(tt, sz, sd) for tt, sz, sd in tqdm(tasks, desc="Categorical MDES")
            ]
        else:
            results = Parallel(n_jobs=n_jobs, backend="loky")(
                delayed(_compute_one_mdes)(tt, sz, sd)
                for tt, sz, sd in tqdm(tasks, desc="Categorical MDES")
            )

        # Build lookup from unique combo → MDES value
        lookup = dict(zip(task_keys, results))
    else:
        lookup = {}

    # Map back to full DataFrame
    df["mdes_effect"] = df.apply(
        lambda row: lookup.get((row["test_type"], row["_sizes_tuple"]), np.nan),
        axis=1,
    )
    df.drop(columns=["_sizes_tuple"], inplace=True)

    df["ci_width_category"] = df.apply(
        lambda row: ci_width_category(row["effect_ci_lower"], row["effect_ci_upper"], "additive"),
        axis=1,
    )

    df["mdes_interpretation"] = df.apply(_format_categorical_mdes_interpretation, axis=1)

    df["evidence_strength_badge"] = df.apply(evidence_badge_categorical, axis=1)

    return df


def _print_badge_distribution(df: pd.DataFrame) -> None:
    """Print evidence badge distribution for an analysis."""
    badge_counts = df["evidence_strength_badge"].value_counts()
    logger.info("   Evidence badges:")
    for badge, count in badge_counts.items():
        logger.info("     %s: %d (%.1f%%)", badge, count, count / len(df) * 100)


def main() -> None:
    """Orchestrate MDES computation and evidence badge assignment for all analyses."""
    from _paths import (
        CATEGORICAL_ASSOCIATIONS,
        FEATURE_CORRELATIONS,
        PRECOMPUTED_STATS_DIR,
        SURVIVAL_ASSOCIATIONS,
    )

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    n_jobs = int(os.environ.get("HISTOATLAS_N_JOBS", "-1"))
    logger.info("=" * 60)
    logger.info("COMPUTING MDES AND EVIDENCE STRENGTH BADGES (n_jobs=%d)", n_jobs)
    logger.info("=" * 60)

    # 1. Survival associations
    logger.info("1. Adding MDES and evidence badges to survival associations...")
    survival_df = pd.read_parquet(SURVIVAL_ASSOCIATIONS)
    survival_df = _process_survival_associations(survival_df)
    survival_df.to_parquet(SURVIVAL_ASSOCIATIONS, index=False)
    logger.info("   Updated %d survival associations", len(survival_df))
    logger.info(
        "   MDES range: harmful HR %.2f-%.2f, protective HR %.2f-%.2f",
        survival_df["mdes_hr_harmful"].min(),
        survival_df["mdes_hr_harmful"].max(),
        survival_df["mdes_hr_protective"].min(),
        survival_df["mdes_hr_protective"].max(),
    )
    _print_badge_distribution(survival_df)

    # 2. Feature correlations
    logger.info("2. Adding MDES and evidence badges to feature correlations...")
    corr_df = pd.read_parquet(FEATURE_CORRELATIONS)
    corr_df = _process_feature_correlations(corr_df)
    corr_df.to_parquet(FEATURE_CORRELATIONS, index=False)
    logger.info("   Updated %d correlations", len(corr_df))
    logger.info("   MDES range: %.3f - %.3f", corr_df["mdes_r"].min(), corr_df["mdes_r"].max())
    _print_badge_distribution(corr_df)

    # 2b. Proteomics correlations (optional, CPTAC-only)
    proteomics_path = PRECOMPUTED_STATS_DIR / "proteomics_correlations.parquet"
    if proteomics_path.exists():
        logger.info("2b. Adding MDES and evidence badges to proteomics correlations...")
        prot_df = pd.read_parquet(proteomics_path)
        prot_df = _process_feature_correlations(prot_df)
        prot_df.to_parquet(proteomics_path, index=False)
        logger.info("   Updated %d proteomics correlations", len(prot_df))
        _print_badge_distribution(prot_df)

    # 3. Categorical associations
    logger.info("3. Adding MDES and evidence badges to categorical associations...")
    cat_df = pd.read_parquet(CATEGORICAL_ASSOCIATIONS)
    cat_df = _process_categorical_associations(cat_df, n_jobs=n_jobs)
    cat_df.to_parquet(CATEGORICAL_ASSOCIATIONS, index=False)
    logger.info("   Updated %d categorical associations", len(cat_df))
    _print_badge_distribution(cat_df)


if __name__ == "__main__":
    main()
