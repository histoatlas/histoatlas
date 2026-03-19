"""Batch effect assessment functions for HistoAtlas.

Implements PVCA (Principal Variance Component Analysis) and silhouette-based
assessment to quantify batch effects from tissue source site (TSS).
"""

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_samples, silhouette_score
from sklearn.preprocessing import StandardScaler


def compute_pvca(
    features: np.ndarray,
    batch_labels: np.ndarray,
    biological_labels: np.ndarray | None = None,
    n_components: int = 10,
    threshold: float = 0.8,
) -> dict:
    """
    Compute Principal Variance Component Analysis (PVCA).

    PVCA decomposes variance in PCA space to attribute it to different sources:
    - Batch (e.g., TSS)
    - Biological factors (e.g., cancer type)
    - Residual/unexplained

    Args:
        features: Feature matrix (n_samples x n_features)
        batch_labels: Array of batch labels (e.g., TSS codes)
        biological_labels: Optional array of biological labels (e.g., cancer type)
        n_components: Number of PCA components to use (default 10)
        threshold: Cumulative variance threshold for PC selection (default 0.8)

    Returns:
        Dictionary with variance components and proportions
    """
    # Handle NaN values
    nan_mask = np.any(np.isnan(features), axis=1)
    if nan_mask.any():
        features = features[~nan_mask]
        batch_labels = batch_labels[~nan_mask]
        if biological_labels is not None:
            biological_labels = biological_labels[~nan_mask]

    n_samples = len(features)
    if n_samples < 50:
        return {
            "batch_variance_proportion": np.nan,
            "biological_variance_proportion": np.nan,
            "residual_variance_proportion": np.nan,
            "n_samples": n_samples,
            "n_pcs_used": 0,
            "error": "Insufficient samples for PVCA",
        }

    # Standardize features
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    # PCA
    n_components = min(n_components, n_samples - 1, features.shape[1])
    pca = PCA(n_components=n_components)
    pcs = pca.fit_transform(features_scaled)
    explained_variance = pca.explained_variance_ratio_

    # Select PCs explaining at least threshold of variance
    cumvar = np.cumsum(explained_variance)
    n_pcs_used = np.searchsorted(cumvar, threshold) + 1
    n_pcs_used = min(n_pcs_used, n_components)

    # Compute variance attributed to batch for each PC
    batch_variance = np.zeros(n_pcs_used)
    biological_variance = np.zeros(n_pcs_used)
    residual_variance = np.zeros(n_pcs_used)

    for i in range(n_pcs_used):
        pc_values = pcs[:, i]
        total_var = np.var(pc_values)

        if total_var == 0:
            continue

        # Batch effect (one-way ANOVA R² / eta-squared)
        # η² = SS_between / SS_total
        # Note: np.var() uses ddof=0 by default, so SS_total = var * n
        unique_batches = np.unique(batch_labels)
        if len(unique_batches) > 1:
            groups = [pc_values[batch_labels == b] for b in unique_batches]
            groups = [g for g in groups if len(g) > 0]
            if len(groups) > 1:
                ss_between = sum(len(g) * (np.mean(g) - np.mean(pc_values)) ** 2 for g in groups)
                ss_total = total_var * n_samples
                batch_variance[i] = ss_between / ss_total if ss_total > 0 else 0.0

        # Biological effect (one-way ANOVA R² / eta-squared)
        if biological_labels is not None:
            unique_bio = np.unique(biological_labels)
            if len(unique_bio) > 1:
                groups = [pc_values[biological_labels == b] for b in unique_bio]
                groups = [g for g in groups if len(g) > 0]
                if len(groups) > 1:
                    ss_between = sum(
                        len(g) * (np.mean(g) - np.mean(pc_values)) ** 2 for g in groups
                    )
                    ss_total = total_var * n_samples
                    biological_variance[i] = ss_between / ss_total if ss_total > 0 else 0.0

        # Residual is what's left
        residual_variance[i] = 1.0 - batch_variance[i] - biological_variance[i]
        residual_variance[i] = max(0, residual_variance[i])

    # Weight by explained variance
    weights = explained_variance[:n_pcs_used] / explained_variance[:n_pcs_used].sum()

    batch_prop = np.sum(batch_variance * weights)
    biological_prop = np.sum(biological_variance * weights) if biological_labels is not None else 0
    residual_prop = np.sum(residual_variance * weights)

    # Normalize to sum to 1
    total = batch_prop + biological_prop + residual_prop
    if total > 0:
        batch_prop /= total
        biological_prop /= total
        residual_prop /= total

    return {
        "batch_variance_proportion": float(batch_prop),
        "biological_variance_proportion": float(biological_prop),
        "residual_variance_proportion": float(residual_prop),
        "n_samples": n_samples,
        "n_pcs_used": n_pcs_used,
        "cumulative_variance_explained": float(cumvar[n_pcs_used - 1]),
        "per_pc_batch_variance": batch_variance.tolist(),
        "per_pc_biological_variance": biological_variance.tolist(),
        "explained_variance_ratio": explained_variance[:n_pcs_used].tolist(),
    }


def compute_silhouette_by_batch(
    features: np.ndarray,
    batch_labels: np.ndarray,
    sample_size: int | None = None,
    random_state: int = 42,
) -> dict:
    """
    Compute silhouette score treating batches as clusters.

    A high silhouette score indicates samples cluster by batch, suggesting
    strong batch effects. A low/negative score indicates batch effects
    are well-controlled.

    Args:
        features: Feature matrix (n_samples x n_features)
        batch_labels: Array of batch labels
        sample_size: Optional subsample size for large datasets
        random_state: Random seed for subsampling

    Returns:
        Dictionary with silhouette metrics
    """
    # Handle NaN values
    nan_mask = np.any(np.isnan(features), axis=1)
    if nan_mask.any():
        features = features[~nan_mask]
        batch_labels = batch_labels[~nan_mask]

    n_samples = len(features)

    # Filter out batches with < 2 samples
    unique_batches, batch_counts = np.unique(batch_labels, return_counts=True)
    valid_batches = unique_batches[batch_counts >= 2]

    if len(valid_batches) < 2:
        return {
            "silhouette_score": np.nan,
            "n_samples": n_samples,
            "n_batches": len(valid_batches),
            "error": "Need at least 2 batches with 2+ samples",
        }

    valid_mask = np.isin(batch_labels, valid_batches)
    features = features[valid_mask]
    batch_labels = batch_labels[valid_mask]
    n_samples = len(features)

    # Subsample if needed
    if sample_size and n_samples > sample_size:
        rng = np.random.default_rng(random_state)
        idx = rng.choice(n_samples, size=sample_size, replace=False)
        features = features[idx]
        batch_labels = batch_labels[idx]
        n_samples = sample_size

    # Standardize features
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    # Compute silhouette score
    try:
        score = silhouette_score(features_scaled, batch_labels, metric="euclidean")
        sample_scores = silhouette_samples(features_scaled, batch_labels, metric="euclidean")

        # Per-batch mean silhouette
        batch_silhouettes = {}
        for batch in np.unique(batch_labels):
            mask = batch_labels == batch
            batch_silhouettes[str(batch)] = float(np.mean(sample_scores[mask]))

    except Exception as e:
        return {
            "silhouette_score": np.nan,
            "n_samples": n_samples,
            "n_batches": len(np.unique(batch_labels)),
            "error": str(e),
        }

    return {
        "silhouette_score": float(score),
        "silhouette_interpretation": _interpret_silhouette(score),
        "n_samples": n_samples,
        "n_batches": len(np.unique(batch_labels)),
        "per_batch_silhouette": batch_silhouettes,
        "silhouette_std": float(np.std(sample_scores)),
    }


def _interpret_silhouette(score: float) -> str:
    """Interpret silhouette score for batch effects."""
    if score > 0.5:
        return "strong_batch_effects"
    elif score > 0.25:
        return "moderate_batch_effects"
    elif score > 0.0:
        return "weak_batch_effects"
    else:
        return "minimal_batch_effects"


def compute_batch_effect_summary(
    df: pd.DataFrame,
    feature_cols: list[str],
    batch_col: str = "tss",
    biological_col: str = "cancer_type",
) -> dict:
    """
    Compute comprehensive batch effect summary.

    Args:
        df: DataFrame with features and batch/biological labels
        feature_cols: List of feature column names
        batch_col: Column name for batch labels
        biological_col: Column name for biological labels

    Returns:
        Dictionary with PVCA and silhouette results
    """
    # Extract data
    features = df[feature_cols].values
    batch_labels = df[batch_col].values if batch_col in df.columns else None
    biological_labels = df[biological_col].values if biological_col in df.columns else None

    results = {
        "n_slides": len(df),
        "n_features": len(feature_cols),
    }

    if batch_labels is None:
        results["error"] = f"Batch column '{batch_col}' not found"
        return results

    # PVCA
    pvca_results = compute_pvca(features, batch_labels, biological_labels)
    results["pvca"] = pvca_results

    # Silhouette by batch
    silhouette_results = compute_silhouette_by_batch(features, batch_labels, sample_size=5000)
    results["silhouette"] = silhouette_results

    # Overall assessment
    batch_var = pvca_results.get("batch_variance_proportion", 0)
    sil_score = silhouette_results.get("silhouette_score", 0)

    if batch_var > 0.3 or sil_score > 0.3:
        results["overall_assessment"] = "concerning"
        results["recommendation"] = "Consider batch correction before downstream analysis"
    elif batch_var > 0.15 or sil_score > 0.15:
        results["overall_assessment"] = "moderate"
        results["recommendation"] = "Monitor batch effects in subgroup analyses"
    else:
        results["overall_assessment"] = "acceptable"
        results["recommendation"] = "Batch effects appear well-controlled"

    return results


def compute_per_cancer_batch_effects(
    df: pd.DataFrame,
    feature_cols: list[str],
    batch_col: str = "tss",
    min_samples: int = 50,
) -> pd.DataFrame:
    """
    Compute batch effect metrics per cancer type.

    Args:
        df: DataFrame with features and batch labels
        feature_cols: List of feature column names
        batch_col: Column name for batch labels
        min_samples: Minimum samples per cancer type

    Returns:
        DataFrame with per-cancer batch effect metrics
    """
    results = []

    for cancer_type in df["cancer_type"].unique():
        cancer_df = df[df["cancer_type"] == cancer_type]

        if len(cancer_df) < min_samples:
            continue

        if batch_col not in cancer_df.columns:
            continue

        features = cancer_df[feature_cols].values
        batch_labels = cancer_df[batch_col].values

        # PVCA (no biological label within cancer type)
        pvca = compute_pvca(features, batch_labels, biological_labels=None)

        # Silhouette
        sil = compute_silhouette_by_batch(features, batch_labels)

        results.append(
            {
                "cancer_type": cancer_type,
                "n_samples": len(cancer_df),
                "n_tss": len(np.unique(batch_labels[pd.notna(batch_labels)])),
                "pvca_batch_variance": pvca.get("batch_variance_proportion"),
                "pvca_residual_variance": pvca.get("residual_variance_proportion"),
                "silhouette_score": sil.get("silhouette_score"),
                "silhouette_interpretation": sil.get("silhouette_interpretation"),
            }
        )

    return pd.DataFrame(results)
