#!/usr/bin/env python3
"""
Feature Redundancy Analysis for HistoAtlas.

Computes a 40x40 Spearman correlation matrix across all histomic features,
PCA variance explained, and Variance Inflation Factors (VIF) to quantify
feature redundancy.

Outputs (in parquet/feature_redundancy/):
- feature_correlation_matrix.parquet   — pairwise Spearman rho
- pca_variance_explained.parquet       — per-component variance explained
- vif_scores.parquet                   — VIF per feature
- summary.json                         — effective dimensionality, 90% threshold
"""

import json
import logging
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import PARQUET_DIR, SLIDE_HISTOMICS, ensure_dirs
from scipy.stats import spearmanr
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

from histoatlas._utils import get_histomic_features

# Suppress RuntimeWarnings from correlation edge cases (constant columns)
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

OUTPUT_DIR = PARQUET_DIR / "feature_redundancy"


@dataclass
class Config:
    """Configuration for feature redundancy analysis."""

    variance_threshold: float = 0.90  # cumulative variance threshold for effective dim

    def __post_init__(self) -> None:
        dry_run = get_dry_run_settings()
        if dry_run:
            logger.info("[DRY-RUN] Feature redundancy analysis (subset data)")


def compute_correlation_matrix(X: np.ndarray, feature_names: list[str]) -> pd.DataFrame:
    """Compute pairwise Spearman correlation matrix.

    Returns:
        DataFrame with features as both index and columns.
    """
    logger.info("Computing %dx%d Spearman correlation matrix...", len(feature_names), len(feature_names))
    rho_matrix, _ = spearmanr(X)
    # spearmanr returns a scalar if only 2 features; reshape for consistency
    if X.shape[1] == 2:
        rho_matrix = np.array([[1.0, rho_matrix], [rho_matrix, 1.0]])
    return pd.DataFrame(rho_matrix, index=feature_names, columns=feature_names)


def compute_pca_variance(X_scaled: np.ndarray, feature_names: list[str]) -> pd.DataFrame:
    """Compute PCA and return variance explained per component.

    Returns:
        DataFrame with columns: component, variance_explained, cumulative_variance.
    """
    n_components = min(X_scaled.shape[0], X_scaled.shape[1])
    logger.info("Computing PCA with %d components...", n_components)
    pca = PCA(n_components=n_components)
    pca.fit(X_scaled)

    cumulative = np.cumsum(pca.explained_variance_ratio_)
    return pd.DataFrame(
        {
            "component": range(1, n_components + 1),
            "variance_explained": pca.explained_variance_ratio_,
            "cumulative_variance": cumulative,
        }
    )


def compute_vif_scores(X_scaled: np.ndarray, feature_names: list[str]) -> pd.DataFrame:
    """Compute Variance Inflation Factor for each feature.

    VIF_j = 1 / (1 - R^2_j), where R^2_j is the R-squared from regressing
    feature j on all other features.

    Returns:
        DataFrame with columns: feature, vif.
    """
    logger.info("Computing VIF for %d features...", len(feature_names))
    n_features = X_scaled.shape[1]
    vif_values = []

    for j in range(n_features):
        y = X_scaled[:, j]
        X_others = np.delete(X_scaled, j, axis=1)
        # Fit OLS via normal equation: beta = (X'X)^-1 X'y
        try:
            beta = np.linalg.lstsq(X_others, y, rcond=None)[0]
            y_hat = X_others @ beta
            ss_res = np.sum((y - y_hat) ** 2)
            ss_tot = np.sum((y - y.mean()) ** 2)
            r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
            vif = 1.0 / (1.0 - r_squared) if r_squared < 1.0 else np.inf
        except np.linalg.LinAlgError:
            vif = np.nan
        vif_values.append(vif)

    return pd.DataFrame({"feature": feature_names, "vif": vif_values})


def main() -> None:
    """Run feature redundancy analysis."""
    logger.info("=" * 60)
    logger.info("FEATURE REDUNDANCY ANALYSIS")
    logger.info("=" * 60)

    config = Config()
    ensure_dirs()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load data
    logger.info("\n1. Loading data...")
    df = pd.read_parquet(SLIDE_HISTOMICS)
    logger.info("   Loaded %d slides", len(df))

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        cancer_counts = df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(dry_run.n_cancer_types).index.tolist()
        df = df[df["cancer_type"].isin(top_cancers)]
        logger.info("   [DRY-RUN] Subset to %d slides", len(df))

    # Identify feature columns
    feature_cols = get_histomic_features(df)
    if dry_run:
        feature_cols = feature_cols[: dry_run.n_features]
    logger.info("   Features: %d", len(feature_cols))

    # Prepare feature matrix
    X = df[feature_cols].values
    imputer = SimpleImputer(strategy="median")
    X_imputed = imputer.fit_transform(X)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imputed)

    # 2. Correlation matrix
    logger.info("\n2. Spearman correlation matrix...")
    corr_df = compute_correlation_matrix(X_imputed, feature_cols)
    corr_df.to_parquet(OUTPUT_DIR / "feature_correlation_matrix.parquet")
    logger.info("   Saved feature_correlation_matrix.parquet")

    # 3. PCA variance explained
    logger.info("\n3. PCA variance explained...")
    pca_df = compute_pca_variance(X_scaled, feature_cols)
    pca_df.to_parquet(OUTPUT_DIR / "pca_variance_explained.parquet", index=False)
    logger.info("   Saved pca_variance_explained.parquet")

    # 4. VIF scores
    logger.info("\n4. Variance Inflation Factors...")
    vif_df = compute_vif_scores(X_scaled, feature_cols)
    vif_df.to_parquet(OUTPUT_DIR / "vif_scores.parquet", index=False)
    logger.info("   Saved vif_scores.parquet")

    # 5. Summary
    logger.info("\n5. Computing summary statistics...")
    cumvar = pca_df["cumulative_variance"].values
    effective_dim = int(np.searchsorted(cumvar, config.variance_threshold) + 1)
    n_highly_correlated = int(
        ((corr_df.abs() > 0.8) & (corr_df.abs() < 1.0)).sum().sum() // 2
    )
    n_high_vif = int((vif_df["vif"] > 10).sum())

    summary = {
        "n_features": len(feature_cols),
        "effective_dimensionality_90pct": effective_dim,
        "total_features": len(feature_cols),
        "n_pairs_abs_rho_gt_0.8": n_highly_correlated,
        "n_features_vif_gt_10": n_high_vif,
        "median_vif": float(vif_df["vif"].median()),
        "max_vif": float(vif_df["vif"].max()),
        "variance_threshold": config.variance_threshold,
    }

    summary_path = OUTPUT_DIR / "summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    logger.info("   Saved summary.json")

    logger.info("\n   Effective dimensionality (90%% variance): %d / %d features", effective_dim, len(feature_cols))
    logger.info("   Feature pairs with |rho| > 0.8: %d", n_highly_correlated)
    logger.info("   Features with VIF > 10: %d", n_high_vif)

    logger.info("\n" + "=" * 60)
    logger.info("FEATURE REDUNDANCY ANALYSIS COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
