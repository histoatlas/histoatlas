"""
Multi-endpoint concordance analysis for survival associations.

For each feature significant for OS (FDR < 0.05), checks whether it is also
significant (same direction) for DSS and PFS. Computes concordance rates
across endpoints to assess robustness of survival signals.

Outputs:
- supplementary/endpoint_concordance.parquet (per-feature concordance)
- json/endpoint_concordance_summary.json (aggregate rates)
"""

import json
import logging

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    ENDPOINT_CONCORDANCE,
    ENDPOINT_CONCORDANCE_SUMMARY,
    JSON_DIR,
    SURVIVAL_ASSOCIATIONS,
    ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Reference endpoint and replication endpoints
REFERENCE_ENDPOINT = "os"
REPLICATION_ENDPOINTS = ["dss", "pfs"]
FDR_THRESHOLD = 0.05


def _effect_direction(hr: float) -> str:
    """Classify hazard ratio direction."""
    if pd.isna(hr):
        return "unknown"
    if hr > 1.0:
        return "harmful"
    if hr < 1.0:
        return "protective"
    return "neutral"


def compute_endpoint_concordance(
    surv_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute endpoint concordance for OS-significant features.

    Args:
        surv_df: Survival associations dataframe with all endpoints.

    Returns:
        DataFrame with one row per (cancer_type, feature) that is OS-significant,
        plus concordance columns for DSS and PFS.
    """
    # Filter to unadjusted model for consistency (or adjusted if available)
    # Use all models present; prefer unadjusted for broad coverage
    if "model" in surv_df.columns:
        model_counts = surv_df["model"].value_counts()
        primary_model = model_counts.index[0]
        surv_df = surv_df[surv_df["model"] == primary_model].copy()
        logger.info("  Using model='%s' (%d rows)", primary_model, len(surv_df))

    # Identify OS-significant features (FDR < threshold)
    os_df = surv_df[surv_df["endpoint"] == REFERENCE_ENDPOINT].copy()
    os_sig = os_df[os_df["p_value_adj"] < FDR_THRESHOLD].copy()
    logger.info(
        "  OS-significant features (FDR < %.2f): %d / %d",
        FDR_THRESHOLD,
        len(os_sig),
        len(os_df),
    )

    if os_sig.empty:
        logger.info("  No OS-significant features found; returning empty DataFrame")
        return pd.DataFrame()

    os_sig["os_direction"] = os_sig["hazard_ratio"].apply(_effect_direction)

    records: list[dict] = []
    for _, os_row in os_sig.iterrows():
        cancer_type = os_row["cancer_type"]
        feature = os_row["feature"]
        os_hr = os_row["hazard_ratio"]
        os_dir = os_row["os_direction"]

        record = {
            "cancer_type": cancer_type,
            "feature": feature,
            "os_hr": os_hr,
            "os_p_adj": os_row["p_value_adj"],
            "os_direction": os_dir,
        }

        for endpoint in REPLICATION_ENDPOINTS:
            ep_rows = surv_df[
                (surv_df["endpoint"] == endpoint)
                & (surv_df["cancer_type"] == cancer_type)
                & (surv_df["feature"] == feature)
            ]

            if ep_rows.empty:
                record[f"{endpoint}_hr"] = np.nan
                record[f"{endpoint}_p_adj"] = np.nan
                record[f"{endpoint}_direction"] = "missing"
                record[f"{endpoint}_significant"] = False
                record[f"{endpoint}_concordant"] = False
                record[f"{endpoint}_available"] = False
            else:
                ep_row = ep_rows.iloc[0]
                ep_hr = ep_row["hazard_ratio"]
                ep_p_adj = ep_row["p_value_adj"]
                ep_dir = _effect_direction(ep_hr)
                ep_sig = ep_p_adj < FDR_THRESHOLD if pd.notna(ep_p_adj) else False

                record[f"{endpoint}_hr"] = ep_hr
                record[f"{endpoint}_p_adj"] = ep_p_adj
                record[f"{endpoint}_direction"] = ep_dir
                record[f"{endpoint}_significant"] = bool(ep_sig)
                record[f"{endpoint}_concordant"] = bool(ep_sig and ep_dir == os_dir)
                record[f"{endpoint}_available"] = True

        records.append(record)

    result_df = pd.DataFrame(records)

    # Add summary flags
    for endpoint in REPLICATION_ENDPOINTS:
        avail_col = f"{endpoint}_available"
        conc_col = f"{endpoint}_concordant"
        result_df[f"{endpoint}_concordant"] = result_df[conc_col].fillna(False)

    result_df["n_endpoints_concordant"] = sum(
        result_df[f"{ep}_concordant"].astype(int) for ep in REPLICATION_ENDPOINTS
    )
    result_df["all_endpoints_concordant"] = (
        result_df["n_endpoints_concordant"] == len(REPLICATION_ENDPOINTS)
    )

    return result_df


def compute_summary(concordance_df: pd.DataFrame) -> dict:
    """Compute aggregate concordance summary statistics.

    Args:
        concordance_df: Per-feature concordance DataFrame.

    Returns:
        Summary dict with concordance rates.
    """
    n_os_sig = len(concordance_df)
    if n_os_sig == 0:
        return {"n_os_significant": 0, "note": "No OS-significant features found"}

    summary: dict = {
        "n_os_significant": n_os_sig,
        "fdr_threshold": FDR_THRESHOLD,
        "reference_endpoint": REFERENCE_ENDPOINT,
        "replication_endpoints": REPLICATION_ENDPOINTS,
    }

    for endpoint in REPLICATION_ENDPOINTS:
        avail = concordance_df[f"{endpoint}_available"]
        sig = concordance_df[f"{endpoint}_significant"]
        conc = concordance_df[f"{endpoint}_concordant"]

        n_available = int(avail.sum())
        n_sig = int(sig.sum())
        n_conc = int(conc.sum())

        summary[f"{endpoint}_n_available"] = n_available
        summary[f"{endpoint}_n_significant"] = n_sig
        summary[f"{endpoint}_n_concordant"] = n_conc
        summary[f"{endpoint}_concordance_rate"] = (
            round(n_conc / n_available, 4) if n_available > 0 else None
        )
        summary[f"{endpoint}_significance_rate"] = (
            round(n_sig / n_available, 4) if n_available > 0 else None
        )

    n_all_conc = int(concordance_df["all_endpoints_concordant"].sum())
    summary["n_all_concordant"] = n_all_conc
    summary["all_concordance_rate"] = round(n_all_conc / n_os_sig, 4) if n_os_sig > 0 else None

    return summary


def main() -> None:
    """Compute endpoint concordance and save results."""
    ensure_dirs()
    JSON_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("MULTI-ENDPOINT CONCORDANCE ANALYSIS")
    logger.info("=" * 60)

    # Load survival associations
    logger.info("Loading survival associations...")
    surv_df = pd.read_parquet(SURVIVAL_ASSOCIATIONS)
    logger.info("  Loaded %d associations", len(surv_df))
    logger.info("  Endpoints: %s", sorted(surv_df["endpoint"].unique()))

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_types = sorted(surv_df["cancer_type"].unique())[: dry_run.n_cancer_types]
        surv_df = surv_df[surv_df["cancer_type"].isin(cancer_types)]
        logger.info("  [DRY-RUN] Subset to %d cancer types", len(cancer_types))

    # Compute concordance
    logger.info("Computing endpoint concordance...")
    concordance_df = compute_endpoint_concordance(surv_df)

    if concordance_df.empty:
        logger.info("No OS-significant features; saving empty outputs.")
        concordance_df = pd.DataFrame()
        summary = {"n_os_significant": 0}
    else:
        summary = compute_summary(concordance_df)

    # Save parquet
    concordance_df.to_parquet(ENDPOINT_CONCORDANCE, index=False)
    logger.info("Saved %s (%d rows)", ENDPOINT_CONCORDANCE.name, len(concordance_df))

    # Save summary JSON
    with open(ENDPOINT_CONCORDANCE_SUMMARY, "w") as f:
        json.dump(summary, f, indent=2)
    logger.info("Saved %s", ENDPOINT_CONCORDANCE_SUMMARY.name)

    # Print summary
    logger.info("")
    logger.info("Summary:")
    logger.info("  OS-significant features: %d", summary["n_os_significant"])
    for endpoint in REPLICATION_ENDPOINTS:
        rate_key = f"{endpoint}_concordance_rate"
        rate = summary.get(rate_key)
        n_conc = summary.get(f"{endpoint}_n_concordant", 0)
        n_avail = summary.get(f"{endpoint}_n_available", 0)
        if rate is not None:
            logger.info(
                "  %s concordance: %d/%d (%.1f%%)",
                endpoint.upper(),
                n_conc,
                n_avail,
                rate * 100,
            )
    all_rate = summary.get("all_concordance_rate")
    if all_rate is not None:
        logger.info("  All-endpoint concordance: %.1f%%", all_rate * 100)


if __name__ == "__main__":
    main()
