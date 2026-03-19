"""Compute histomics embeddings using UMAP and t-SNE for visualization."""

import numpy as np
import pandas as pd


def compute_umap(
    features: np.ndarray | pd.DataFrame,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    n_components: int = 2,
    metric: str = "euclidean",
    random_state: int = 42,
    n_jobs: int = 1,
) -> np.ndarray:
    """
    Compute UMAP embedding of histomic features.

    Args:
        features: Feature matrix (n_samples x n_features)
        n_neighbors: Number of neighbors for UMAP (default 15)
        min_dist: Minimum distance parameter for UMAP (default 0.1)
        n_components: Number of output dimensions (default 2)
        metric: Distance metric (default 'euclidean')
        random_state: Random seed for reproducibility
        n_jobs: Number of parallel jobs for nearest-neighbor search (default 1)

    Returns:
        UMAP embedding array (n_samples x n_components)
    """
    try:
        from umap import UMAP
    except ImportError:
        raise ImportError("umap-learn is required for UMAP. Install with: pip install umap-learn")

    # Convert to numpy if DataFrame
    if isinstance(features, pd.DataFrame):
        features = features.values

    # Handle NaN values with median imputation
    features_clean = features.copy()
    for i in range(features_clean.shape[1]):
        col = features_clean[:, i]
        mask = np.isnan(col)
        if mask.any():
            median_val = np.nanmedian(col)
            # If entire column is NaN, use 0
            if np.isnan(median_val):
                median_val = 0.0
            features_clean[mask, i] = median_val

    # Standardize features
    means = np.mean(features_clean, axis=0)
    stds = np.std(features_clean, axis=0)
    stds[stds == 0] = 1  # Avoid division by zero
    features_normalized = (features_clean - means) / stds

    # Compute UMAP
    umap_model = UMAP(
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        n_components=n_components,
        metric=metric,
        random_state=random_state,
        n_jobs=n_jobs,
    )

    embedding: np.ndarray = umap_model.fit_transform(features_normalized)

    return embedding


def compute_tsne(
    features: np.ndarray | pd.DataFrame,
    n_components: int = 2,
    perplexity: float = 30.0,
    learning_rate: str | float = "auto",
    n_iter: int = 1000,
    random_state: int = 42,
) -> np.ndarray:
    """
    Compute t-SNE embedding of histomic features.

    Args:
        features: Feature matrix (n_samples x n_features)
        n_components: Number of output dimensions (default 2)
        perplexity: Perplexity parameter (default 30.0)
        learning_rate: Learning rate or 'auto' (default 'auto')
        n_iter: Number of iterations (default 1000)
        random_state: Random seed for reproducibility

    Returns:
        t-SNE embedding array (n_samples x n_components)
    """
    from sklearn.manifold import TSNE

    # Convert to numpy if DataFrame
    if isinstance(features, pd.DataFrame):
        features = features.values

    # Handle NaN values with median imputation
    features_clean = features.copy()
    for i in range(features_clean.shape[1]):
        col = features_clean[:, i]
        mask = np.isnan(col)
        if mask.any():
            median_val = np.nanmedian(col)
            # If entire column is NaN, use 0
            if np.isnan(median_val):
                median_val = 0.0
            features_clean[mask, i] = median_val

    # Standardize features
    means = np.mean(features_clean, axis=0)
    stds = np.std(features_clean, axis=0)
    stds[stds == 0] = 1
    features_normalized = (features_clean - means) / stds

    # Compute t-SNE
    tsne_model = TSNE(
        n_components=n_components,
        perplexity=perplexity,
        learning_rate=learning_rate,
        max_iter=n_iter,
        random_state=random_state,
        init="pca",
    )

    embedding: np.ndarray = tsne_model.fit_transform(features_normalized)

    return embedding
