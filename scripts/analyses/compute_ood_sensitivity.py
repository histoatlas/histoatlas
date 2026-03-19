"""
Out-of-distribution sensitivity analysis for survival associations.

Compares survival significance rates and effect sizes between:
- The 8 in-distribution (ID) cancer types where the cell model was trained:
  LUAD, LUSC, BRCA, COAD, BLCA, OV, PAAD, MESO
- The full set of 21 cancer types (including 13 OOD types)

This assesses whether histomic features generalize to cancer types
the underlying cell detection model was not trained on.

Output:
- supplementary/ood_sensitivity.parquet
"""

import logging

import numpy as np
import pandas as pd
from _config import get_dry_run_settings, get_in_distribution_cancer_types
from _paths import (
    OOD_SENSITIVITY,
    SURVIVAL_ASSOCIATIONS,
    ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FDR_THRESHOLD = 0.05


def compute_group_stats(df: pd.DataFrame, group_label: str) -> pd.DataFrame:
    """Compute per-feature significance stats for a group of cancer types.

    Args:
        df: Survival associations for the group.
        group_label: Label for this group (e.g. "in_distribution", "all").

    Returns:
        DataFrame with one row per (feature, endpoint) with summary stats.
    """
    records: list[dict] = []

    for (feature, endpoint), group in df.groupby(["feature", "endpoint"]):
        n_cancer_types = group["cancer_type"].nunique()
        n_sig = int((group["p_value_adj"] < FDR_THRESHOLD).sum())
        n_total = len(group)

        # Effect size stats (hazard ratio)
        valid_hr = group["hazard_ratio"].dropna()
        median_hr = float(valid_hr.median()) if len(valid_hr) > 0 else np.nan
        mean_hr = float(valid_hr.mean()) if len(valid_hr) > 0 else np.nan

        # Direction consistency
        n_harmful = int((valid_hr > 1.0).sum())
        n_protective = int((valid_hr < 1.0).sum())
        dominant_direction = "harmful" if n_harmful > n_protective else "protective"
        direction_consistency = (
            max(n_harmful, n_protective) / len(valid_hr) if len(valid_hr) > 0 else np.nan
        )

        records.append(
            {
                "feature": feature,
                "endpoint": endpoint,
                "group": group_label,
                "n_cancer_types": n_cancer_types,
                "n_tests": n_total,
                "n_significant": n_sig,
                "significance_rate": n_sig / n_total if n_total > 0 else np.nan,
                "median_hr": median_hr,
                "mean_hr": mean_hr,
                "n_harmful": n_harmful,
                "n_protective": n_protective,
                "dominant_direction": dominant_direction,
                "direction_consistency": direction_consistency,
            }
        )

    return pd.DataFrame(records)


def main() -> None:
    """Run OOD sensitivity analysis and save results."""
    ensure_dirs()

    logger.info("=" * 60)
    logger.info("OUT-OF-DISTRIBUTION SENSITIVITY ANALYSIS")
    logger.info("=" * 60)

    # Check if in-distribution cancer types are configured
    IN_DISTRIBUTION_CANCER_TYPES = get_in_distribution_cancer_types()
    if not IN_DISTRIBUTION_CANCER_TYPES:
        logger.info("No in-distribution cancer types configured — writing empty output")
        empty_df = pd.DataFrame(
            columns=[
                "feature",
                "endpoint",
                "group",
                "n_cancer_types",
                "n_tests",
                "n_significant",
                "significance_rate",
                "median_hr",
                "mean_hr",
                "n_harmful",
                "n_protective",
                "dominant_direction",
                "direction_consistency",
            ]
        )
        empty_df.to_parquet(OOD_SENSITIVITY, index=False)
        logger.info("Saved empty %s", OOD_SENSITIVITY.name)
        return

    # Load survival associations
    logger.info("Loading survival associations...")
    surv_df = pd.read_parquet(SURVIVAL_ASSOCIATIONS)
    logger.info("  Loaded %d associations", len(surv_df))

    all_cancer_types = set(surv_df["cancer_type"].unique())
    id_types = IN_DISTRIBUTION_CANCER_TYPES & all_cancer_types
    ood_types = all_cancer_types - IN_DISTRIBUTION_CANCER_TYPES

    logger.info("  In-distribution types present: %s", sorted(id_types))
    logger.info("  Out-of-distribution types: %s", sorted(ood_types))

    # Apply dry-run subsetting (keep at least some of each group)
    dry_run = get_dry_run_settings()
    if dry_run:
        id_subset = sorted(id_types)[: max(2, dry_run.n_cancer_types // 2)]
        ood_subset = sorted(ood_types)[: max(1, dry_run.n_cancer_types // 2)]
        keep_types = set(id_subset) | set(ood_subset)
        surv_df = surv_df[surv_df["cancer_type"].isin(keep_types)]
        id_types = set(id_subset)
        ood_types = set(ood_subset)
        logger.info("  [DRY-RUN] Subset to %d types total", len(keep_types))

    # Compute stats for each group
    logger.info("Computing in-distribution stats...")
    id_df = surv_df[surv_df["cancer_type"].isin(id_types)]
    id_stats = compute_group_stats(id_df, "in_distribution")
    logger.info("  %d (feature, endpoint) combos", len(id_stats))

    logger.info("Computing all-types stats...")
    all_stats = compute_group_stats(surv_df, "all")
    logger.info("  %d (feature, endpoint) combos", len(all_stats))

    logger.info("Computing OOD-only stats...")
    ood_df = surv_df[surv_df["cancer_type"].isin(ood_types)]
    ood_stats = compute_group_stats(ood_df, "out_of_distribution")
    logger.info("  %d (feature, endpoint) combos", len(ood_stats))

    # Combine
    result_df = pd.concat([id_stats, ood_stats, all_stats], ignore_index=True)

    # Add comparison metrics by pivoting ID vs OOD
    comparison_records: list[dict] = []
    for (feature, endpoint), group in result_df.groupby(["feature", "endpoint"]):
        id_row = group[group["group"] == "in_distribution"]
        ood_row = group[group["group"] == "out_of_distribution"]

        if id_row.empty or ood_row.empty:
            continue

        id_row = id_row.iloc[0]
        ood_row = ood_row.iloc[0]

        comparison_records.append(
            {
                "feature": feature,
                "endpoint": endpoint,
                "group": "comparison",
                "id_significance_rate": id_row["significance_rate"],
                "ood_significance_rate": ood_row["significance_rate"],
                "significance_rate_delta": (
                    ood_row["significance_rate"] - id_row["significance_rate"]
                ),
                "id_median_hr": id_row["median_hr"],
                "ood_median_hr": ood_row["median_hr"],
                "hr_delta": (
                    ood_row["median_hr"] - id_row["median_hr"]
                    if pd.notna(ood_row["median_hr"]) and pd.notna(id_row["median_hr"])
                    else np.nan
                ),
                "direction_agreement": (
                    id_row["dominant_direction"] == ood_row["dominant_direction"]
                ),
            }
        )

    if comparison_records:
        comparison_df = pd.DataFrame(comparison_records)
        result_df = pd.concat([result_df, comparison_df], ignore_index=True)

    # Save
    result_df.to_parquet(OOD_SENSITIVITY, index=False)
    logger.info("Saved %s (%d rows)", OOD_SENSITIVITY.name, len(result_df))

    # Print summary
    logger.info("")
    id_only = result_df[result_df["group"] == "in_distribution"]
    ood_only = result_df[result_df["group"] == "out_of_distribution"]

    if not id_only.empty and not ood_only.empty:
        id_sig_rate = id_only["significance_rate"].mean()
        ood_sig_rate = ood_only["significance_rate"].mean()
        logger.info("Mean significance rate:")
        logger.info("  In-distribution:      %.1f%%", id_sig_rate * 100)
        logger.info("  Out-of-distribution:  %.1f%%", ood_sig_rate * 100)

        if comparison_records:
            comp = pd.DataFrame(comparison_records)
            n_agree = int(comp["direction_agreement"].sum())
            logger.info(
                "  Direction agreement: %d/%d (%.1f%%)",
                n_agree,
                len(comp),
                n_agree / len(comp) * 100 if len(comp) > 0 else 0,
            )


if __name__ == "__main__":
    main()
