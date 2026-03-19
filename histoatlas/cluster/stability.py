"""Cluster stability analysis functions."""

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score


def compute_bootstrap_stability_fast(
    X: np.ndarray,
    original_labels: np.ndarray,
    k: int,
    n_bootstrap: int = 50,
    sample_fraction: float = 0.8,
    random_state: int = 42,
) -> dict:
    """
    Compute cluster stability via bootstrap sampling.

    For each bootstrap iteration:
    1. Sample a fraction of data
    2. Re-cluster the sample
    3. Compare to original labels using ARI

    Args:
        X: Feature matrix (n_samples x n_features)
        original_labels: Original cluster labels
        k: Number of clusters
        n_bootstrap: Number of bootstrap iterations (default 50)
        sample_fraction: Fraction of data to sample (default 0.8)
        random_state: Random seed for reproducibility

    Returns:
        dict with 'mean_ari', 'std_ari', 'ari_scores', 'mean_jaccard', 'jaccard_scores'
    """
    rng = np.random.default_rng(random_state)
    n_samples = len(X)
    sample_size = int(n_samples * sample_fraction)

    ari_scores = []
    jaccard_scores = []

    for _ in range(n_bootstrap):
        # Bootstrap sample
        indices = rng.choice(n_samples, size=sample_size, replace=False)
        X_sample = X[indices]
        original_sample_labels = original_labels[indices]

        # Re-cluster
        kmeans = KMeans(n_clusters=k, random_state=rng.integers(10000), n_init=10)
        new_labels = kmeans.fit_predict(X_sample)

        # Compute ARI
        ari = adjusted_rand_score(original_sample_labels, new_labels)
        ari_scores.append(ari)

        # Compute Jaccard index for each cluster pair
        jaccard_per_cluster = []
        for orig_cluster in range(k):
            orig_mask = original_sample_labels == orig_cluster
            if orig_mask.sum() == 0:
                continue

            # Find best matching new cluster
            best_jaccard = 0
            for new_cluster in range(k):
                new_mask = new_labels == new_cluster
                intersection = (orig_mask & new_mask).sum()
                union = (orig_mask | new_mask).sum()
                if union > 0:
                    jaccard = intersection / union
                    best_jaccard = max(best_jaccard, jaccard)

            jaccard_per_cluster.append(best_jaccard)

        if jaccard_per_cluster:
            jaccard_scores.append(np.mean(jaccard_per_cluster))

    return {
        "mean_ari": float(np.mean(ari_scores)),
        "std_ari": float(np.std(ari_scores)),
        "ari_scores": ari_scores,
        "mean_jaccard": float(np.mean(jaccard_scores)) if jaccard_scores else np.nan,
        "jaccard_scores": jaccard_scores,
    }
