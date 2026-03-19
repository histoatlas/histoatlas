"""Feature preprocessing: log-transform and winsorization.

Preprocessing pipeline (applied in order):
1. log1p on right-skewed features (densities, ratios, heterogeneity measures)
2. Winsorize at [0.5th, 99.5th] percentile (post-log)
3. StandardScaler (z-score) — handled downstream in compute_embeddings.py

Tables and tooltips always show raw values. Embeddings, clustermaps, and
statistical models always consume preprocessed values.
"""

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# The 22 features with heavy right-skew that need log1p transform.
# Source: PLAN.md §2.0 — densities, ratios, distances, heterogeneity measures.
LOG_TRANSFORM_FEATURES: frozenset[str] = frozenset(
    {
        "apoptosis_mitosis_ratio_tumor",
        "apoptotic_index_tumor",
        "eosinophil_neutrophil_ratio_peritumoral",
        "fibroblast_density_stroma",
        "fibroblast_lymphocyte_proximity_stroma",
        "interface_normalized_immune_pressure",
        "intratumoral_cancer_cell_density",
        "intratumoral_eosinophil_density",
        "intratumoral_lymphocyte_density",
        "intratumoral_myeloid_lymphoid_tilt",
        "intratumoral_neutrophil_density",
        "lymphocyte_density_heterogeneity_tumor",
        "lymphocyte_infiltration_ratio_front",
        "mitotic_index_tumor",
        "myeloid_infiltration_ratio_front",
        "peritumoral_fibroblast_enrichment",
        "stromal_cellularity_heterogeneity",
        "stromal_inflammatory_tilt",
        "stromal_lymphocyte_density",
        "tumor_cell_density_heterogeneity",
        "tumor_fibroblast_coupling_front",
        "tumor_lymphocyte_nn_distance_front",
    }
)


def preprocess_features(
    df: pd.DataFrame,
    feature_cols: list[str],
    log_features: frozenset[str] = LOG_TRANSFORM_FEATURES,
    winsorize_quantiles: tuple[float, float] = (0.005, 0.995),
) -> pd.DataFrame:
    """Apply log1p + winsorize to feature columns in-place.

    Steps:
    1. For features in ``feature_cols ∩ log_features``: apply ``np.log1p``
    2. For **all** features in ``feature_cols``: clip to
       [p_low, p_high] computed per column

    Args:
        df: DataFrame containing feature columns (modified in-place).
        feature_cols: Feature column names to preprocess.
        log_features: Set of column names that should be log-transformed.
        winsorize_quantiles: (lower, upper) quantile bounds for winsorization.

    Returns:
        The same DataFrame (modified in-place).
    """
    cols_to_log = [c for c in feature_cols if c in log_features]
    n_clipped_total = 0

    # --- Step 1: log1p on right-skewed features ---
    if cols_to_log:
        df[cols_to_log] = df[cols_to_log].apply(np.log1p)

    # --- Step 2: winsorize all features ---
    q_low, q_high = winsorize_quantiles
    for col in feature_cols:
        series = df[col]
        lo = series.quantile(q_low)
        hi = series.quantile(q_high)
        clipped = series.clip(lower=lo, upper=hi)
        n_clipped = int((series < lo).sum() + (series > hi).sum())
        n_clipped_total += n_clipped
        df[col] = clipped

    logger.info(
        "Preprocessing: %d features log-transformed, %d winsorized, %d values clipped",
        len(cols_to_log),
        len(feature_cols),
        n_clipped_total,
    )

    return df


def get_preprocessed_matrix(
    df: pd.DataFrame,
    feature_cols: list[str],
) -> np.ndarray:
    """Extract preprocessed feature matrix from df.

    Convenience wrapper that returns ``df[feature_cols].values`` as a
    float64 ndarray, suitable for downstream imputation and scaling.

    Args:
        df: DataFrame with (already preprocessed) feature columns.
        feature_cols: Feature column names.

    Returns:
        2-D numpy array of shape (n_samples, n_features).
    """
    return df[feature_cols].to_numpy(dtype=np.float64)
