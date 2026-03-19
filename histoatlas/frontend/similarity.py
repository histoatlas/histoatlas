"""Slide similarity (KNN) computation functions."""

import numpy as np
from sklearn.neighbors import NearestNeighbors
from tqdm.auto import tqdm

from histoatlas.frontend._results import SimilarSlide


def compute_knn_batch(
    features: np.ndarray,
    slide_ids: np.ndarray,
    cancer_types: np.ndarray,
    k: int = 10,
    batch_size: int = 1000,
    show_progress: bool = True,
    n_jobs: int = 1,
) -> list[SimilarSlide]:
    """
    Compute K nearest neighbors for all slides using batch processing.

    Uses sklearn's NearestNeighbors for efficient computation with ball tree.

    Args:
        features: Feature matrix (n_samples x n_features)
        slide_ids: Array of slide identifiers
        cancer_types: Array of cancer type labels
        k: Number of nearest neighbors (default 10)
        batch_size: Batch size for processing (default 1000)
        show_progress: Whether to show progress bar
        n_jobs: Number of parallel jobs for NearestNeighbors (default 1)

    Returns:
        List of SimilarSlide objects
    """
    n_samples = len(slide_ids)
    results = []

    # Handle NaN values by replacing with column medians
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

    # Standardize features for fair distance computation
    means = np.mean(features_clean, axis=0)
    stds = np.std(features_clean, axis=0)
    stds[stds == 0] = 1  # Avoid division by zero
    features_normalized = (features_clean - means) / stds

    # Fit NearestNeighbors model
    # k+1 because the query point itself will be the nearest neighbor
    nn_model = NearestNeighbors(
        n_neighbors=k + 1, metric="euclidean", algorithm="ball_tree", n_jobs=n_jobs
    )
    nn_model.fit(features_normalized)

    # Query in batches for memory efficiency
    iterator = range(0, n_samples, batch_size)
    if show_progress:
        iterator = tqdm(iterator, desc="KNN batches")

    for start_idx in iterator:
        end_idx = min(start_idx + batch_size, n_samples)
        batch_features = features_normalized[start_idx:end_idx]

        distances, indices = nn_model.kneighbors(batch_features)

        for i, batch_i in enumerate(range(start_idx, end_idx)):
            query_slide_id = slide_ids[batch_i]
            query_cancer = cancer_types[batch_i]

            rank = 1
            for j in range(len(indices[i])):
                neighbor_idx = indices[i, j]

                # Skip self-match
                if neighbor_idx == batch_i:
                    continue

                if rank > k:
                    break

                neighbor_slide_id = slide_ids[neighbor_idx]
                neighbor_cancer = cancer_types[neighbor_idx]
                dist = distances[i, j]

                results.append(
                    SimilarSlide(
                        slide_id=str(query_slide_id),
                        neighbor_rank=rank,
                        neighbor_slide_id=str(neighbor_slide_id),
                        distance=float(dist),
                        same_cancer_type=bool(query_cancer == neighbor_cancer),
                    )
                )
                rank += 1

    return results


def compute_cancer_specific_knn(
    features: np.ndarray,
    slide_ids: np.ndarray,
    cancer_types: np.ndarray,
    k: int = 10,
    show_progress: bool = True,
    n_jobs: int = 1,
) -> list[SimilarSlide]:
    """
    Compute K nearest neighbors within each cancer type.

    This provides cancer-specific similar slides which may be more biologically
    meaningful than pan-cancer neighbors.

    Args:
        features: Feature matrix (n_samples x n_features)
        slide_ids: Array of slide identifiers
        cancer_types: Array of cancer type labels
        k: Number of nearest neighbors (default 10)
        show_progress: Whether to show progress bar
        n_jobs: Number of parallel jobs for NearestNeighbors (default 1)

    Returns:
        List of SimilarSlide objects
    """
    results = []
    unique_cancers = np.unique(cancer_types)

    iterator = unique_cancers
    if show_progress:
        iterator = tqdm(unique_cancers, desc="Cancer-specific KNN")

    for cancer in iterator:
        cancer_mask = cancer_types == cancer
        cancer_indices = np.where(cancer_mask)[0]

        if len(cancer_indices) <= k:
            continue

        cancer_features = features[cancer_mask].copy()
        cancer_slide_ids = slide_ids[cancer_mask]

        # Handle NaN values
        for i in range(cancer_features.shape[1]):
            col = cancer_features[:, i]
            nan_mask = np.isnan(col)
            if nan_mask.any():
                median_val = np.nanmedian(col)
                # If entire column is NaN, use 0
                if np.isnan(median_val):
                    median_val = 0.0
                cancer_features[nan_mask, i] = median_val

        # Standardize within cancer type
        means = np.mean(cancer_features, axis=0)
        stds = np.std(cancer_features, axis=0)
        stds[stds == 0] = 1
        cancer_features_norm = (cancer_features - means) / stds

        # Fit KNN model
        nn_model = NearestNeighbors(
            n_neighbors=min(k + 1, len(cancer_indices)),
            metric="euclidean",
            algorithm="ball_tree",
            n_jobs=n_jobs,
        )
        nn_model.fit(cancer_features_norm)

        distances, indices = nn_model.kneighbors(cancer_features_norm)

        for i in range(len(cancer_indices)):
            query_slide_id = cancer_slide_ids[i]

            rank = 1
            for j in range(len(indices[i])):
                neighbor_local_idx = indices[i, j]

                # Skip self-match
                if neighbor_local_idx == i:
                    continue

                if rank > k:
                    break

                neighbor_slide_id = cancer_slide_ids[neighbor_local_idx]
                dist = distances[i, j]

                results.append(
                    SimilarSlide(
                        slide_id=str(query_slide_id),
                        neighbor_rank=rank,
                        neighbor_slide_id=str(neighbor_slide_id),
                        distance=float(dist),
                        same_cancer_type=True,
                    )
                )
                rank += 1

    return results
