"""Kaplan-Meier curve computation functions."""

import warnings
from typing import Any

import numpy as np
import pandas as pd
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.statistics import logrank_test, proportional_hazard_test

from histoatlas.survival._results import KaplanMeierResult
from histoatlas.survival.covariates import coarsen_stage, select_covariates


def compute_km_curves(
    data: pd.DataFrame,
    feature: str,
    time_col: str = "os_months",
    event_col: str = "os_status",
    stratification: str = "median",
    time_points: np.ndarray | None = None,
) -> dict[str, Any] | None:
    """
    Compute Kaplan-Meier curves for a feature.

    Args:
        data: DataFrame with feature, time, and event columns
        feature: Name of the feature column
        time_col: Name of the survival time column
        event_col: Name of the event indicator column
        stratification: 'median' for median split, 'quartile' for Q1 vs Q4
        time_points: Specific time points to evaluate (default: 100 points over range)

    Returns:
        dict with 'stratification' and 'groups' keys, or None if insufficient data
    """
    df_km = data[[feature, time_col, event_col]].dropna()

    if len(df_km) < 30:
        return None

    # Create groups based on stratification
    if stratification == "median":
        median_val = df_km[feature].median()
        df_km = df_km.copy()
        # Use strict inequality (>) for balanced splits when many samples equal the median
        df_km["group"] = (df_km[feature] > median_val).map({True: "High", False: "Low"})
    elif stratification == "quartile":
        q1, q3 = df_km[feature].quantile([0.25, 0.75])
        df_km = df_km[(df_km[feature] <= q1) | (df_km[feature] >= q3)].copy()
        df_km["group"] = (df_km[feature] >= q3).map({True: "Q4 (High)", False: "Q1 (Low)"})
    else:
        raise ValueError(f"Unknown stratification: {stratification}")

    if df_km["group"].nunique() < 2:
        return None

    # Define time points
    if time_points is None:
        max_time = df_km[time_col].max()
        time_points = np.linspace(0, max_time, 100)

    # Fit KM for each group
    results: dict[str, Any] = {"stratification": stratification, "groups": {}}
    kmf = KaplanMeierFitter()

    for group in df_km["group"].unique():
        mask = df_km["group"] == group
        T = df_km.loc[mask, time_col]
        E = df_km.loc[mask, event_col]

        kmf.fit(T, E, label=group)

        # Get survival function at specified time points
        sf = kmf.survival_function_at_times(time_points)
        ci = kmf.confidence_interval_survival_function_

        # Get CI at specified time points using step-function interpolation
        # (CI is constant between event times, just like the KM curve)
        ci_lower = []
        ci_upper = []
        ci_times = ci.index.values
        for t in time_points:
            # Find the largest CI time <= t (step-function: use value at last event time)
            valid_indices = np.where(ci_times <= t)[0]
            if len(valid_indices) == 0:
                # Before first event time: use CI at time 0 (or first available)
                idx = 0
            else:
                idx = valid_indices[-1]
            ci_lower.append(float(ci.iloc[idx, 0]))
            ci_upper.append(float(ci.iloc[idx, 1]))

        # Number at risk
        n_at_risk = []
        for t in time_points:
            n_at_risk.append(int((T >= t).sum()))

        # Censoring: observations where event == 0
        censored_mask = E == 0
        censoring_times = sorted(T[censored_mask].tolist())
        censoring_probs = kmf.survival_function_at_times(censoring_times).values.tolist()

        results["groups"][group] = KaplanMeierResult(
            group=group,
            time_points=time_points.tolist(),
            survival_probs=sf.values.tolist(),
            ci_lower=ci_lower,
            ci_upper=ci_upper,
            n_at_risk=n_at_risk,
            censoring_times=censoring_times,
            censoring_probs=censoring_probs,
            n_samples=int(mask.sum()),
            n_events=int(E.sum()),
        )

    return results


def compute_cluster_survival(
    data: pd.DataFrame,
    cluster_col: str,
    cluster_id: int,
    time_col: str = "os_months",
    event_col: str = "os_status",
    time_points: np.ndarray | None = None,
    compute_adjusted: bool = True,
    strata: list[str] | None = None,
) -> dict[str, Any] | None:
    """
    Compute complete survival analysis for a cluster.

    Includes KM curves, Cox regression (unadjusted and adjusted for age, sex,
    stage; stratified by TSS), and log-rank test.

    Args:
        data: DataFrame with cluster, time, and event columns
        cluster_col: Name of cluster column
        cluster_id: Cluster identifier to analyze
        time_col: Name of survival time column
        event_col: Name of event indicator column
        time_points: Specific time points for KM curves
        compute_adjusted: Whether to compute adjusted Cox model
        strata: Columns to use for Cox stratification (separate baseline hazard
            per stratum). Strata columns are not included as regression covariates.

    Returns:
        dict with 'km_curves', 'cox_unadjusted', 'cox_adjusted', 'logrank' keys
    """
    # Create binary indicator for cluster membership
    df = data.copy()
    df["_in_cluster"] = (df[cluster_col] == cluster_id).astype(int)

    cols = ["_in_cluster", time_col, event_col]
    if strata:
        cols.extend(strata)
    df_analysis = df[cols].dropna()

    if len(df_analysis) < 30:
        return None

    # Check cluster size
    n_in_cluster = df_analysis["_in_cluster"].sum()
    n_outside_cluster = len(df_analysis) - n_in_cluster

    if n_in_cluster < 10:
        return None

    if n_outside_cluster < 10:
        return None

    # Check minimum events in each group (at least 5 events per group for stable estimates)
    MIN_EVENTS_PER_GROUP = 5
    n_events_in_cluster = df_analysis.loc[df_analysis["_in_cluster"] == 1, event_col].sum()
    n_events_outside = df_analysis.loc[df_analysis["_in_cluster"] == 0, event_col].sum()

    if n_events_in_cluster < MIN_EVENTS_PER_GROUP:
        return None

    if n_events_outside < MIN_EVENTS_PER_GROUP:
        return None

    results: dict[str, Any] = {}

    # KM curves
    if time_points is None:
        max_time = df_analysis[time_col].max()
        time_points = np.linspace(0, max_time, 100)

    kmf = KaplanMeierFitter()
    km_results: dict[str, Any] = {"groups": {}}

    for in_cluster in [0, 1]:
        mask = df_analysis["_in_cluster"] == in_cluster
        T = df_analysis.loc[mask, time_col]
        E = df_analysis.loc[mask, event_col]

        label = f"Cluster {cluster_id}" if in_cluster == 1 else "Other"
        kmf.fit(T, E, label=label)

        sf = kmf.survival_function_at_times(time_points)

        # CI extraction (same step-function interpolation as compute_km_curves)
        ci = kmf.confidence_interval_survival_function_
        ci_lower = []
        ci_upper = []
        ci_times = ci.index.values
        for t in time_points:
            valid_indices = np.where(ci_times <= t)[0]
            idx = 0 if len(valid_indices) == 0 else valid_indices[-1]
            ci_lower.append(float(ci.iloc[idx, 0]))
            ci_upper.append(float(ci.iloc[idx, 1]))

        # Censoring: observations where event == 0
        censored_mask = E == 0
        censoring_times = sorted(T[censored_mask].tolist())
        censoring_probs = kmf.survival_function_at_times(censoring_times).values.tolist()

        km_results["groups"][label] = {
            "time_points": time_points.tolist(),
            "survival_probs": sf.values.tolist(),
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "censoring_times": censoring_times,
            "censoring_probs": censoring_probs,
            "n_samples": int(mask.sum()),
            "n_events": int(E.sum()),
        }

    results["km_curves"] = km_results

    # Log-rank test
    T_in = df_analysis.loc[df_analysis["_in_cluster"] == 1, time_col]
    E_in = df_analysis.loc[df_analysis["_in_cluster"] == 1, event_col]
    T_out = df_analysis.loc[df_analysis["_in_cluster"] == 0, time_col]
    E_out = df_analysis.loc[df_analysis["_in_cluster"] == 0, event_col]

    logrank_result = logrank_test(T_in, T_out, E_in, E_out)
    results["logrank"] = {
        "test_statistic": float(logrank_result.test_statistic),
        "p_value": float(logrank_result.p_value),
    }

    # Compute cluster-specific counts from analysis data
    n_in_cluster = int(df_analysis["_in_cluster"].sum())
    n_events_in_cluster = int(df_analysis.loc[df_analysis["_in_cluster"] == 1, event_col].sum())

    # Unadjusted Cox
    try:
        cph = CoxPHFitter(penalizer=0.0)
        cph.fit(df_analysis, duration_col=time_col, event_col=event_col, strata=strata)
        summary = cph.summary

        # Proportional hazards test using Schoenfeld residuals
        ph_test_p = None
        ph_flag = "unknown"
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                ph_result = proportional_hazard_test(cph, df_analysis, time_transform="km")
                if "_in_cluster" in ph_result.summary.index:
                    ph_test_p = float(ph_result.summary.loc["_in_cluster", "p"])
                if ph_test_p is not None:
                    if ph_test_p < 0.01:
                        ph_flag = "fail"
                    elif ph_test_p < 0.05:
                        ph_flag = "warn"
                    else:
                        ph_flag = "pass"
        except Exception:
            ph_test_p = None
            ph_flag = "error"

        hr = float(summary.loc["_in_cluster", "exp(coef)"])
        hr_lower = float(summary.loc["_in_cluster", "exp(coef) lower 95%"])
        hr_upper = float(summary.loc["_in_cluster", "exp(coef) upper 95%"])
        p_value = float(summary.loc["_in_cluster", "p"])

        if ph_flag in {"warn", "fail", "error", "unknown"}:
            hr = np.nan
            hr_lower = np.nan
            hr_upper = np.nan
            p_value = np.nan

        results["cox_unadjusted"] = {
            "hazard_ratio": hr,
            "hr_ci_lower": hr_lower,
            "hr_ci_upper": hr_upper,
            "p_value": p_value,
            "ph_test_p": ph_test_p,
            "ph_flag": ph_flag,
            "n_cluster": n_in_cluster,
            "n_events_cluster": n_events_in_cluster,
            "n_total": len(df_analysis),
            "n_events_total": int(df_analysis[event_col].sum()),
        }
    except Exception:
        results["cox_unadjusted"] = None

    # Adjusted Cox (age + sex + stage; stratified by TSS)
    if compute_adjusted:
        adj_cols = ["_in_cluster", time_col, event_col]
        if strata:
            adj_cols.extend(strata)

        # Coarsen substages (IA/IB/... → I/II/III/IV) before one-hot encoding.
        # Apply to df (not data) because df is used to build df_adj below.
        df = coarsen_stage(df)

        # Covariates: age, sex, stage (only if non-null data exists)
        covariates_used = select_covariates(df)
        adj_cols.extend(covariates_used)

        # TSS as additional stratification variable (separate baseline hazard)
        adj_strata = list(strata) if strata else []
        if "tss" in df.columns:
            adj_cols.append("tss")
            adj_strata.append("tss")

        if covariates_used:  # Have actual covariates
            df_adj = df[adj_cols].dropna()
            if len(df_adj) >= 30:
                try:
                    df_adj = df_adj.copy()

                    # Standardize age if present
                    if "age_at_diagnosis" in df_adj.columns:
                        age_std = df_adj["age_at_diagnosis"].std()
                        if age_std > 0:
                            df_adj["age_at_diagnosis"] = (
                                df_adj["age_at_diagnosis"] - df_adj["age_at_diagnosis"].mean()
                            ) / age_std

                    # One-hot encode categorical covariates (sex, stage)
                    for cov in ["sex", "stage"]:
                        if cov in df_adj.columns and (
                            df_adj[cov].dtype == "object" or df_adj[cov].dtype.name == "category"
                        ):
                            dummies = pd.get_dummies(df_adj[cov], prefix=cov, drop_first=True)
                            df_adj = pd.concat([df_adj.drop(columns=[cov]), dummies], axis=1)

                    cph_adj = CoxPHFitter(penalizer=0.0)
                    cph_adj.fit(
                        df_adj,
                        duration_col=time_col,
                        event_col=event_col,
                        strata=adj_strata if adj_strata else None,
                    )
                    summary_adj = cph_adj.summary

                    # Proportional hazards test (adjusted model)
                    ph_test_p = None
                    ph_flag = "unknown"
                    try:
                        with warnings.catch_warnings():
                            warnings.simplefilter("ignore")
                            ph_result = proportional_hazard_test(
                                cph_adj, df_adj, time_transform="km"
                            )
                            if "_in_cluster" in ph_result.summary.index:
                                ph_test_p = float(ph_result.summary.loc["_in_cluster", "p"])
                            if ph_test_p is not None:
                                if ph_test_p < 0.01:
                                    ph_flag = "fail"
                                elif ph_test_p < 0.05:
                                    ph_flag = "warn"
                                else:
                                    ph_flag = "pass"
                    except Exception:
                        ph_test_p = None
                        ph_flag = "error"

                    # Compute cluster-specific counts for adjusted model
                    n_in_cluster_adj = int(df_adj["_in_cluster"].sum())
                    n_events_in_cluster_adj = int(
                        df_adj.loc[df_adj["_in_cluster"] == 1, event_col].sum()
                    )

                    hr = float(summary_adj.loc["_in_cluster", "exp(coef)"])
                    hr_lower = float(summary_adj.loc["_in_cluster", "exp(coef) lower 95%"])
                    hr_upper = float(summary_adj.loc["_in_cluster", "exp(coef) upper 95%"])
                    p_value = float(summary_adj.loc["_in_cluster", "p"])

                    if ph_flag in {"warn", "fail", "error", "unknown"}:
                        hr = np.nan
                        hr_lower = np.nan
                        hr_upper = np.nan
                        p_value = np.nan

                    results["cox_adjusted"] = {
                        "hazard_ratio": hr,
                        "hr_ci_lower": hr_lower,
                        "hr_ci_upper": hr_upper,
                        "p_value": p_value,
                        "ph_test_p": ph_test_p,
                        "ph_flag": ph_flag,
                        "covariates": covariates_used,
                        "n_cluster": n_in_cluster_adj,
                        "n_events_cluster": n_events_in_cluster_adj,
                        "n_total": len(df_adj),
                        "n_events_total": int(df_adj[event_col].sum()),
                    }
                except Exception:
                    results["cox_adjusted"] = None
            else:
                results["cox_adjusted"] = None
        else:
            results["cox_adjusted"] = None

    return results


def compute_median_survival(
    data: pd.DataFrame, time_col: str, event_col: str, group_mask: pd.Series
) -> float | None:
    """Compute median survival time for a group using KaplanMeierFitter."""
    df_group = data[group_mask]
    if len(df_group) < 5:
        return None

    T = df_group[time_col]
    E = df_group[event_col]

    kmf = KaplanMeierFitter()
    try:
        kmf.fit(T, E)
        return kmf.median_survival_time_
    except Exception:
        return None
