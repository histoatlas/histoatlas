#!/usr/bin/env python3
"""
Embedding and Clustering Computation for HistoAtlas.

This script computes:
1. UMAP and t-SNE embeddings
2. L1 (pan-cancer) clustering with K-means
3. L2 (cancer-specific) clustering with elbow method
4. Cluster centroids, feature profiles, and metadata
5. Bootstrap stability analysis

Outputs (in parquet/):
- slide_histomics.parquet (slide features with embeddings and cluster assignments)

Outputs (in parquet/clustering/):
- l1_clustering_metrics.parquet
- l1_cluster_metadata.parquet
- l1_cluster_centroids_features.parquet
- l1_cluster_centroids_umap.parquet
- l1_cluster_feature_profiles.parquet
- l1_cluster_cancer_composition.parquet
- l1_bootstrap_stability.parquet
- l2_cluster_results.parquet
- l2_cluster_names.parquet
- l2_umap_coordinates.parquet
"""

import logging
import warnings
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
from _config import get_dry_run_settings
from _paths import (
    SLIDE_LEVEL_FEATURES_INPUT,
)
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    adjusted_rand_score,
    calinski_harabasz_score,
    completeness_score,
    davies_bouldin_score,
    homogeneity_score,
    normalized_mutual_info_score,
    silhouette_score,
    v_measure_score,
)
from sklearn.preprocessing import StandardScaler

import histoatlas

# Suppress UMAP/t-SNE convergence and numba deprecation warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*divide by zero.*")
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*overflow.*")
warnings.filterwarnings("ignore", category=UserWarning, message=".*n_jobs.*")

# Features excluded from analysis (QC-only or uninformative)
EXCLUDED_FEATURES = frozenset(
    {
        "tissue_coverage",
        "artifact_fraction",
        "necrosis_in_tumor_fraction",
        "necrosis_contact_fraction_stroma",
        "necrosis_heterogeneity",
        "necrosis_rbc_enrichment",
        "perinecrotic_neutrophil_enrichment",
        "perinecrotic_lymphocyte_enrichment",
        "perinecrotic_myeloid_tilt",
        "tumor_contact_fraction_necrosis",
        "tumor_necrosis_proximity",
        "normal_epithelium_area_fraction",
        "tumor_contact_fraction_normal",
    }
)
logging.basicConfig(level=logging.INFO, format="%(message)s")

logger = logging.getLogger(__name__)


def _get_n_jobs() -> int:
    """Get n_jobs from HISTOATLAS_N_JOBS env var."""
    import os

    return int(os.environ.get("HISTOATLAS_N_JOBS", "1"))


@dataclass
class EmbeddingConfig:
    """Configuration for the embedding and clustering analysis."""

    input_file: Path = SLIDE_LEVEL_FEATURES_INPUT
    umap_n_neighbors: int = 15
    umap_min_dist: float = 0.1
    tsne_perplexity: float = 30.0
    tsne_n_iter: int = 1000
    random_state: int = 42
    l1_k_values: tuple[int, ...] = tuple(range(3, 26))
    l1_selected_k: int = 10
    l2_k_range: range = field(default_factory=lambda: range(2, 9))
    l2_min_samples: int = 20
    n_bootstrap: int = 50
    bootstrap_sample_fraction: float = 0.8
    metadata_cols: tuple[str, ...] = ("slide_name", "cancer_type")

    def __post_init__(self) -> None:
        """Apply dry-run settings if active."""
        dry_run = get_dry_run_settings()
        if dry_run:
            # Reduce bootstrap iterations for faster execution
            object.__setattr__(self, "n_bootstrap", dry_run.n_bootstrap)
            logger.info("[DRY-RUN] Reduced n_bootstrap to %d", dry_run.n_bootstrap)


def load_and_prepare_data(
    config: EmbeddingConfig,
) -> tuple[pd.DataFrame, list[str], np.ndarray, np.ndarray]:
    """Load parquet, identify features, impute, and standardize.

    Returns:
        df: The loaded dataframe
        feature_cols: List of feature column names
        X_imputed: Imputed feature matrix
        X_scaled: Standardized feature matrix
    """
    logger.info("\n1. Loading data...")
    df = pd.read_parquet(config.input_file)
    logger.info(f"   Loaded {len(df)} slides with {len(df.columns)} columns")

    # Drop status/fallback columns (string columns not needed downstream)
    cols_to_drop = [c for c in df.columns if c.endswith("_status") or c.endswith("_fallback")]
    df = df.drop(columns=cols_to_drop)
    logger.info(f"   Dropped {len(cols_to_drop)} status/fallback columns")

    # Strip _value suffix from feature columns
    rename_map = {c: c.removesuffix("_value") for c in df.columns if c.endswith("_value")}
    df = df.rename(columns=rename_map)

    # Drop excluded QC/necrosis features
    to_drop = [c for c in df.columns if c in EXCLUDED_FEATURES]
    df = df.drop(columns=to_drop)
    logger.info(f"   Dropped {len(to_drop)} excluded features (QC/necrosis)")

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        # Subset to top N cancer types by sample count
        cancer_counts = df["cancer_type"].value_counts()
        top_cancers = cancer_counts.head(dry_run.n_cancer_types).index.tolist()
        df = df[df["cancer_type"].isin(top_cancers)]
        logger.info(
            f"   [DRY-RUN] Subset to {len(df)} slides "
            f"({dry_run.n_cancer_types} cancer types: {top_cancers})"
        )

    # Identify feature columns
    feature_cols = [
        c
        for c in df.columns
        if c not in config.metadata_cols and df[c].dtype in ["float64", "float32", "int64", "int32"]
    ]

    # Subset features in dry-run mode
    if dry_run:
        feature_cols = feature_cols[: dry_run.n_features]
        logger.info(f"   [DRY-RUN] Subset to {len(feature_cols)} features")

    logger.info(f"   Feature columns: {len(feature_cols)}")

    # Preprocess features (log1p + winsorize) before imputation/scaling
    histoatlas.preprocess_features(df, feature_cols)

    # Prepare feature matrix
    X = df[feature_cols].values

    # Handle missing values with median imputation
    imputer = SimpleImputer(strategy="median")
    X_imputed = imputer.fit_transform(X)

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imputed)

    return df, feature_cols, X_imputed, X_scaled


def compute_embeddings(
    df: pd.DataFrame, feature_cols: list[str], config: EmbeddingConfig
) -> pd.DataFrame:
    """Compute UMAP and t-SNE embeddings.

    Returns:
        df: DataFrame with umap_1, umap_2, tsne_1, tsne_2 columns added
    """
    # UMAP embedding
    n_jobs = _get_n_jobs()
    logger.info("\n2. Computing UMAP embedding (n_jobs=%d)...", n_jobs)
    umap_embedding = histoatlas.compute_umap(
        df[feature_cols],
        n_neighbors=config.umap_n_neighbors,
        min_dist=config.umap_min_dist,
        n_components=2,
        random_state=config.random_state,
        n_jobs=n_jobs,
    )
    df["umap_1"] = umap_embedding[:, 0]
    df["umap_2"] = umap_embedding[:, 1]
    logger.info(f"   UMAP embedding computed: {umap_embedding.shape}")

    # t-SNE embedding
    logger.info("\n3. Computing t-SNE embedding...")
    tsne_embedding = histoatlas.compute_tsne(
        df[feature_cols],
        n_components=2,
        perplexity=config.tsne_perplexity,
        n_iter=config.tsne_n_iter,
        random_state=config.random_state,
    )
    df["tsne_1"] = tsne_embedding[:, 0]
    df["tsne_2"] = tsne_embedding[:, 1]
    logger.info(f"   t-SNE embedding computed: {tsne_embedding.shape}")

    return df


def _compute_within_cluster_dispersion(X: np.ndarray, labels: np.ndarray) -> float:
    """Compute total within-cluster sum of squared distances (W_k)."""
    dispersion = 0.0
    for k in np.unique(labels):
        cluster_points = X[labels == k]
        centroid = cluster_points.mean(axis=0)
        dispersion += np.sum((cluster_points - centroid) ** 2)
    return dispersion


def compute_gap_statistic(
    X: np.ndarray, k_values: tuple[int, ...], n_references: int = 20, random_state: int = 42
) -> dict[int, dict[str, float]]:
    """Compute gap statistic for each k using the Tibshirani method.

    Compares within-cluster dispersion to that expected under a uniform
    reference distribution over the range of each feature.

    Args:
        X: Standardized feature matrix (n_samples, n_features).
        k_values: Values of k to evaluate.
        n_references: Number of reference datasets (B).
        random_state: Random seed for reproducibility.

    Returns:
        Dict mapping k -> {gap, se, log_wk, expected_log_wk}.
    """
    rng = np.random.RandomState(random_state)
    n_samples, n_features = X.shape

    # Precompute feature ranges for uniform reference generation
    feat_min = X.min(axis=0)
    feat_max = X.max(axis=0)

    gap_results: dict[int, dict[str, float]] = {}

    for k in k_values:
        # Observed within-cluster dispersion
        kmeans = KMeans(n_clusters=k, random_state=random_state, n_init=10)
        labels = kmeans.fit_predict(X)
        log_wk = np.log(max(_compute_within_cluster_dispersion(X, labels), 1e-300))

        # Reference dispersions from uniform null
        ref_log_wks = []
        for _ in range(n_references):
            X_ref = rng.uniform(feat_min, feat_max, size=(n_samples, n_features))
            ref_kmeans = KMeans(n_clusters=k, random_state=random_state, n_init=5)
            ref_labels = ref_kmeans.fit_predict(X_ref)
            ref_wk = _compute_within_cluster_dispersion(X_ref, ref_labels)
            ref_log_wks.append(np.log(max(ref_wk, 1e-300)))

        expected_log_wk = float(np.mean(ref_log_wks))
        # Tibshirani SE: sd * sqrt(1 + 1/B)
        se = float(np.std(ref_log_wks, ddof=0) * np.sqrt(1.0 + 1.0 / n_references))
        gap = expected_log_wk - log_wk

        gap_results[k] = {
            "gap": gap,
            "se": se,
            "log_wk": log_wk,
            "expected_log_wk": expected_log_wk,
        }
        logger.info("   k=%d: Gap=%.4f (SE=%.4f)", k, gap, se)

    return gap_results


def run_l1_clustering(
    X_scaled: np.ndarray, config: EmbeddingConfig
) -> tuple[dict[int, dict], pd.DataFrame]:
    """Run K-means clustering for multiple k values and compute metrics.

    The L1 clustering consists in deriving pan-tumor clusters of samples sharing similar
    histological features.

    Returns:
        cluster_results: Dict mapping k -> {labels, model, centroids}
        metrics_df: DataFrame with clustering metrics for each k
    """
    logger.info("\n4. Computing L1 clustering (pan-cancer)...")
    cluster_results = {}
    cluster_metrics = []

    for k in config.l1_k_values:
        kmeans = KMeans(n_clusters=k, random_state=config.random_state, n_init=10)
        labels = kmeans.fit_predict(X_scaled)

        cluster_results[k] = {
            "labels": labels,
            "model": kmeans,
            "centroids": kmeans.cluster_centers_,
        }

        sil_score = silhouette_score(X_scaled, labels)
        ch_score = calinski_harabasz_score(X_scaled, labels)
        db_score = davies_bouldin_score(X_scaled, labels)

        cluster_metrics.append(
            {
                "k": k,
                "silhouette": sil_score,
                "calinski_harabasz": ch_score,
                "davies_bouldin": db_score,
            }
        )
        logger.info(f"   k={k}: Silhouette={sil_score:.3f}")

    # Compute gap statistic (Tibshirani method)
    dry_run = get_dry_run_settings()
    n_references = 5 if dry_run else 20
    logger.info("\n4b. Computing gap statistic (B=%d reference datasets)...", n_references)
    gap_results = compute_gap_statistic(
        X_scaled, config.l1_k_values, n_references=n_references, random_state=config.random_state
    )

    # Merge gap statistic into metrics
    for metric in cluster_metrics:
        k = metric["k"]
        metric["gap"] = gap_results[k]["gap"]
        metric["gap_se"] = gap_results[k]["se"]
        metric["log_wk"] = gap_results[k]["log_wk"]
        metric["expected_log_wk"] = gap_results[k]["expected_log_wk"]

    metrics_df = pd.DataFrame(cluster_metrics)
    return cluster_results, metrics_df


def generate_l1_cluster_metadata(
    df: pd.DataFrame,
    X_scaled: np.ndarray,
    feature_cols: list[str],
    l1_cluster_names: dict[int, str],
    global_means: pd.Series,
    global_stds: pd.Series,
    selected_k: int,
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """Generate centroids, profiles, and metadata for each L1 cluster.

    Returns:
        l1_metadata: List of metadata dicts per cluster
        l1_centroids_feature: List of feature-space centroid dicts
        l1_centroids_umap: List of UMAP-space centroid dicts
        l1_feature_profiles: List of z-score profile dicts
    """
    logger.info("\n5. Computing L1 cluster metadata and centroids...")

    l1_metadata = []
    l1_centroids_feature = []
    l1_centroids_umap = []
    l1_feature_profiles = []

    for cluster_id in range(selected_k):
        cluster_mask = df["cluster_l1"] == cluster_id
        cluster_df = df[cluster_mask]

        # Auto-generated name
        auto_name = l1_cluster_names.get(cluster_id, f"Cluster {cluster_id}")

        # Top cancer types
        cancer_counts = cluster_df["cancer_type"].value_counts()
        top_3_cancers = ", ".join(cancer_counts.head(3).index.tolist())

        l1_metadata.append(
            {
                "cluster_id": cluster_id,
                "auto_name": auto_name,
                "n_samples": int(cluster_mask.sum()),
                "top_3_cancers": top_3_cancers,
            }
        )

        # Feature space centroid
        feature_centroid = X_scaled[cluster_mask].mean(axis=0)
        l1_centroids_feature.append(
            {
                "cluster_id": cluster_id,
                "cluster_name": auto_name,
                **{feat: val for feat, val in zip(feature_cols, feature_centroid)},
            }
        )

        # UMAP space centroid
        umap_centroid = cluster_df[["umap_1", "umap_2"]].mean().values
        l1_centroids_umap.append(
            {
                "cluster_id": cluster_id,
                "cluster_name": auto_name,
                "umap_1": umap_centroid[0],
                "umap_2": umap_centroid[1],
                "n_samples": int(cluster_mask.sum()),
            }
        )

        # Feature profile (z-scores)
        cluster_means = cluster_df[feature_cols].mean()
        z_scores = (cluster_means - global_means) / global_stds.replace(0, 1)
        l1_feature_profiles.append({"cluster_id": cluster_id, **z_scores.to_dict()})

    return l1_metadata, l1_centroids_feature, l1_centroids_umap, l1_feature_profiles


def compute_cancer_composition(df: pd.DataFrame, selected_k: int) -> list[dict]:
    """Compute cancer type enrichment per L1 cluster.

    Returns:
        composition_data: List of composition dicts
    """
    logger.info("\n6. Computing L1 cluster cancer composition...")
    cancer_types_unique = sorted(df["cancer_type"].unique())
    composition_data = []

    for cluster_id in range(selected_k):
        cluster_mask = df["cluster_l1"] == cluster_id
        cluster_df = df[cluster_mask]
        cancer_counts = cluster_df["cancer_type"].value_counts()

        for cancer_type in cancer_types_unique:
            count = cancer_counts.get(cancer_type, 0)
            proportion = count / len(cluster_df) if len(cluster_df) > 0 else 0
            global_proportion = (df["cancer_type"] == cancer_type).sum() / len(df)
            enrichment = (
                np.log2(proportion / global_proportion)
                if proportion > 0 and global_proportion > 0
                else np.nan
            )

            composition_data.append(
                {
                    "cluster_id": cluster_id,
                    "cancer_type": cancer_type,
                    "count": count,
                    "proportion": proportion,
                    "global_proportion": global_proportion,
                    "log2_enrichment": enrichment,
                }
            )

    return composition_data


def run_bootstrap_stability(
    X_scaled: np.ndarray, cluster_results: dict[int, dict], config: EmbeddingConfig
) -> pd.DataFrame:
    """Compute bootstrap stability (ARI/Jaccard) for each k.

    Returns:
        stability_df: DataFrame with stability metrics per k
    """
    logger.info("\n7. Computing bootstrap stability analysis...")
    stability_results = []

    for k in config.l1_k_values:
        labels = cluster_results[k]["labels"]

        stability = histoatlas.compute_bootstrap_stability_fast(
            X_scaled,
            labels,
            k,
            n_bootstrap=config.n_bootstrap,
            sample_fraction=config.bootstrap_sample_fraction,
            random_state=config.random_state,
        )

        stability_results.append(
            {
                "k": k,
                "ari_mean": stability["mean_ari"],
                "ari_std": stability["std_ari"],
                "jaccard_mean": stability["mean_jaccard"],
            }
        )
        logger.info(f"   k={k}: ARI={stability['mean_ari']:.3f}±{stability['std_ari']:.3f}")

    return pd.DataFrame(stability_results)


def run_l2_clustering(
    df: pd.DataFrame, X_scaled: np.ndarray, feature_cols: list[str], config: EmbeddingConfig
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Run cancer-specific clustering with elbow method.

    The L2 clustering consists in creating cancer-type-specific clusters of samples sharing
    similar morphological features (e.g. BRCA tumors with an immune-hot landscape).

    Returns:
        df: DataFrame with cluster_l2 column added
        l2_results_df: DataFrame with L2 clustering results per cancer
        l2_names_df: DataFrame with L2 cluster names
    """
    logger.info("\n8. Computing L2 clustering (cancer-specific)...")
    df["cluster_l2"] = -1
    l2_results = []
    l2_cluster_names_all = []

    for cancer_type in sorted(df["cancer_type"].unique()):
        cancer_mask = df["cancer_type"] == cancer_type
        cancer_indices = df[cancer_mask].index
        n_samples = len(cancer_indices)

        if n_samples < config.l2_min_samples:
            # Too few samples
            df.loc[cancer_indices, "cluster_l2"] = 0
            l2_results.append(
                {
                    "cancer_type": cancer_type,
                    "n_samples": n_samples,
                    "optimal_k": 1,
                    "silhouette": np.nan,
                    "calinski_harabasz": np.nan,
                    "davies_bouldin": np.nan,
                    "note": "n<20, single cluster",
                }
            )
            l2_cluster_names_all.append(
                {
                    "cancer_type": cancer_type,
                    "cluster_l2": 0,
                    "auto_name": "All samples",
                    "n_samples": n_samples,
                }
            )
            continue

        X_cancer = X_scaled[cancer_mask]

        # Find optimal k using elbow method
        metrics_df_l2 = histoatlas.find_optimal_k_elbow(X_cancer, config.l2_k_range)
        if len(metrics_df_l2) < 2:
            df.loc[cancer_indices, "cluster_l2"] = 0
            l2_results.append(
                {
                    "cancer_type": cancer_type,
                    "n_samples": n_samples,
                    "optimal_k": 1,
                    "silhouette": np.nan,
                    "calinski_harabasz": np.nan,
                    "davies_bouldin": np.nan,
                    "note": "insufficient k range",
                }
            )
            l2_cluster_names_all.append(
                {
                    "cancer_type": cancer_type,
                    "cluster_l2": 0,
                    "auto_name": "All samples",
                    "n_samples": n_samples,
                }
            )
            continue

        optimal_k = histoatlas.select_optimal_k_elbow(metrics_df_l2)

        # Apply clustering
        kmeans_l2 = KMeans(n_clusters=optimal_k, random_state=config.random_state, n_init=10)
        l2_labels = kmeans_l2.fit_predict(X_cancer)
        df.loc[cancer_indices, "cluster_l2"] = l2_labels

        # Get metrics for optimal k
        optimal_metrics = metrics_df_l2[metrics_df_l2["k"] == optimal_k].iloc[0]

        l2_results.append(
            {
                "cancer_type": cancer_type,
                "n_samples": n_samples,
                "optimal_k": optimal_k,
                "silhouette": optimal_metrics["silhouette"],
                "calinski_harabasz": optimal_metrics["calinski_harabasz"],
                "davies_bouldin": optimal_metrics["davies_bouldin"],
                "note": "",
            }
        )

        # Generate L2 cluster names
        cancer_df = df[cancer_mask]
        cancer_means = cancer_df[feature_cols].mean()
        cancer_stds = cancer_df[feature_cols].std()

        for cluster_id in range(optimal_k):
            cluster_mask_l2 = cancer_df["cluster_l2"] == cluster_id
            cluster_df = cancer_df[cluster_mask_l2]

            if len(cluster_df) == 0:
                continue

            auto_name = histoatlas.generate_l2_cluster_name(
                cluster_df, cancer_means, cancer_stds, feature_cols, top_n=2
            )

            l2_cluster_names_all.append(
                {
                    "cancer_type": cancer_type,
                    "cluster_l2": cluster_id,
                    "auto_name": auto_name,
                    "n_samples": len(cluster_df),
                }
            )

    l2_results_df = pd.DataFrame(l2_results)
    l2_names_df = pd.DataFrame(l2_cluster_names_all)

    return df, l2_results_df, l2_names_df


def compute_l2_umap_embeddings(
    df: pd.DataFrame, feature_cols: list[str], config: EmbeddingConfig
) -> pd.DataFrame:
    """Compute per-cancer-type UMAP embeddings for L2 visualization.

    Each cancer type gets its own UMAP embedding computed from its subset of
    slides. This produces a more informative layout than subsetting the pan-cancer
    L1 UMAP.

    Returns:
        DataFrame with columns (slide_name, cancer_type, umap_l2_1, umap_l2_2)
    """
    n_jobs = _get_n_jobs()
    logger.info("\n   Computing L2 UMAP embeddings (per cancer type, n_jobs=%d)...", n_jobs)
    rows = []

    for cancer_type in sorted(df["cancer_type"].unique()):
        cancer_mask = df["cancer_type"] == cancer_type
        cancer_df = df[cancer_mask]
        n_samples = len(cancer_df)

        if n_samples < 3:
            # Cannot run UMAP with fewer than 3 samples
            for slide_name in cancer_df["slide_name"]:
                rows.append(
                    {
                        "slide_name": slide_name,
                        "cancer_type": cancer_type,
                        "umap_l2_1": 0.0,
                        "umap_l2_2": 0.0,
                    }
                )
            logger.info(f"   {cancer_type}: {n_samples} samples (skipped, <3)")
            continue

        # Cap n_neighbors at n_samples - 1
        n_neighbors = min(config.umap_n_neighbors, n_samples - 1)

        umap_embedding = histoatlas.compute_umap(
            cancer_df[feature_cols],
            n_neighbors=n_neighbors,
            min_dist=config.umap_min_dist,
            n_components=2,
            random_state=config.random_state,
            n_jobs=n_jobs,
        )

        for i, slide_name in enumerate(cancer_df["slide_name"].values):
            rows.append(
                {
                    "slide_name": slide_name,
                    "cancer_type": cancer_type,
                    "umap_l2_1": float(umap_embedding[i, 0]),
                    "umap_l2_2": float(umap_embedding[i, 1]),
                }
            )
        logger.info(f"   {cancer_type}: {n_samples} samples, n_neighbors={n_neighbors}")

    return pd.DataFrame(rows)


def compute_cluster_cancer_type_overlap(
    cluster_labels: np.ndarray, cancer_type_labels: np.ndarray
) -> dict:
    """Compute agreement metrics between L1 clusters and cancer-type labels.

    Returns:
        Dictionary with ARI, NMI, V-measure, homogeneity, and completeness scores.
    """
    logger.info("\n   Computing L1 cluster vs cancer-type overlap metrics...")
    overlap = {
        "adjusted_rand_index": float(adjusted_rand_score(cluster_labels, cancer_type_labels)),
        "normalized_mutual_info": float(
            normalized_mutual_info_score(cluster_labels, cancer_type_labels)
        ),
        "v_measure": float(v_measure_score(cluster_labels, cancer_type_labels)),
        "homogeneity": float(homogeneity_score(cluster_labels, cancer_type_labels)),
        "completeness": float(completeness_score(cluster_labels, cancer_type_labels)),
    }
    logger.info("   ARI  = %.4f", overlap["adjusted_rand_index"])
    logger.info("   NMI  = %.4f", overlap["normalized_mutual_info"])
    logger.info("   V    = %.4f", overlap["v_measure"])
    logger.info("   Hom  = %.4f", overlap["homogeneity"])
    logger.info("   Comp = %.4f", overlap["completeness"])
    return overlap


def save_results(
    df: pd.DataFrame,
    metrics_df: pd.DataFrame,
    l1_metadata: list[dict],
    l1_centroids_feature: list[dict],
    l1_centroids_umap: list[dict],
    l1_feature_profiles: list[dict],
    composition_data: list[dict],
    stability_df: pd.DataFrame,
    l2_results_df: pd.DataFrame,
    l2_names_df: pd.DataFrame,
    l2_umap_df: pd.DataFrame,
    cluster_cancer_overlap: dict | None = None,
) -> None:
    """Save all output parquet files and cluster-cancer overlap JSON."""
    import json

    from _paths import (
        CLUSTERING_DIR,
        L1_BOOTSTRAP_STABILITY,
        L1_CLUSTER_CANCER_COMPOSITION,
        L1_CLUSTER_CENTROIDS_FEATURES,
        L1_CLUSTER_CENTROIDS_UMAP,
        L1_CLUSTER_FEATURE_PROFILES,
        L1_CLUSTER_METADATA,
        L1_CLUSTERING_METRICS,
        L2_CLUSTER_NAMES,
        L2_CLUSTER_RESULTS,
        L2_UMAP_COORDINATES,
        SLIDE_HISTOMICS,
        ensure_dirs,
    )

    logger.info("\n9. Saving results...")

    # Ensure output directories exist
    ensure_dirs()
    CLUSTERING_DIR.mkdir(parents=True, exist_ok=True)

    # L1 clustering metrics
    metrics_df.to_parquet(L1_CLUSTERING_METRICS, index=False)
    logger.info("   Saved %s", L1_CLUSTERING_METRICS.name)

    # L1 metadata
    pd.DataFrame(l1_metadata).to_parquet(L1_CLUSTER_METADATA, index=False)
    logger.info("   Saved %s", L1_CLUSTER_METADATA.name)

    # L1 centroids (features)
    pd.DataFrame(l1_centroids_feature).to_parquet(L1_CLUSTER_CENTROIDS_FEATURES, index=False)
    logger.info("   Saved %s", L1_CLUSTER_CENTROIDS_FEATURES.name)

    # L1 centroids (UMAP)
    pd.DataFrame(l1_centroids_umap).to_parquet(L1_CLUSTER_CENTROIDS_UMAP, index=False)
    logger.info("   Saved %s", L1_CLUSTER_CENTROIDS_UMAP.name)

    # L1 feature profiles
    pd.DataFrame(l1_feature_profiles).to_parquet(L1_CLUSTER_FEATURE_PROFILES, index=False)
    logger.info("   Saved %s", L1_CLUSTER_FEATURE_PROFILES.name)

    # L1 cancer composition
    pd.DataFrame(composition_data).to_parquet(L1_CLUSTER_CANCER_COMPOSITION, index=False)
    logger.info("   Saved %s", L1_CLUSTER_CANCER_COMPOSITION.name)

    # L1 bootstrap stability
    stability_df.to_parquet(L1_BOOTSTRAP_STABILITY, index=False)
    logger.info("   Saved %s", L1_BOOTSTRAP_STABILITY.name)

    # L2 results
    l2_results_df.to_parquet(L2_CLUSTER_RESULTS, index=False)
    logger.info("   Saved %s", L2_CLUSTER_RESULTS.name)

    # L2 cluster names
    l2_names_df.to_parquet(L2_CLUSTER_NAMES, index=False)
    logger.info("   Saved %s", L2_CLUSTER_NAMES.name)

    # L2 UMAP coordinates
    l2_umap_df.to_parquet(L2_UMAP_COORDINATES, index=False)
    logger.info("   Saved %s", L2_UMAP_COORDINATES.name)

    # L1 cluster vs cancer-type overlap metrics
    if cluster_cancer_overlap is not None:
        overlap_path = CLUSTERING_DIR / "l1_cluster_cancer_type_overlap.json"
        with open(overlap_path, "w") as f:
            json.dump(cluster_cancer_overlap, f, indent=2)
        logger.info("   Saved %s", overlap_path.name)

    # Final embeddings (slide histomics)
    if "case_id" not in df.columns:
        raise ValueError(
            "slide_level_features.parquet must contain a 'case_id' column. "
            "Add case_id during data preparation before running the pipeline."
        )
    df.to_parquet(SLIDE_HISTOMICS, index=False)
    logger.info("   Saved %s", SLIDE_HISTOMICS.name)


def main() -> None:
    """Run the embedding and clustering pipeline."""
    logger.info("=" * 60)
    logger.info("EMBEDDING AND CLUSTERING COMPUTATION")
    logger.info("=" * 60)

    config = EmbeddingConfig()

    # 1. Load and prepare data
    df, feature_cols, _, X_scaled = load_and_prepare_data(config)

    # 2-3. Compute embeddings
    df = compute_embeddings(df, feature_cols, config)

    # 4. L1 clustering (only if pan-cancer analyses are enabled)
    from _config import include_pancan

    if include_pancan():
        cluster_results, metrics_df = run_l1_clustering(X_scaled, config)
        df["cluster_l1"] = cluster_results[config.l1_selected_k]["labels"]
        logger.info(f"   Selected k={config.l1_selected_k} for L1 clustering")
        logger.info(f"   Cluster distribution:\n{df['cluster_l1'].value_counts().sort_index()}")

        # Compute cluster–cancer-type overlap metrics (ARI, NMI, V-measure)
        cluster_cancer_overlap = compute_cluster_cancer_type_overlap(
            df["cluster_l1"].values, df["cancer_type"].values
        )

        # Generate L1 cluster names
        global_means = df[feature_cols].mean()
        global_stds = df[feature_cols].std()

        l1_cluster_names = histoatlas.generate_cluster_names_for_k(
            config.l1_selected_k,
            cluster_results[config.l1_selected_k]["labels"],
            df,
            feature_cols,
            global_means,
            global_stds,
            top_n=2,
        )

        # 5. L1 cluster metadata and centroids
        l1_metadata, l1_centroids_feature, l1_centroids_umap, l1_feature_profiles = (
            generate_l1_cluster_metadata(
                df,
                X_scaled,
                feature_cols,
                l1_cluster_names,
                global_means,
                global_stds,
                config.l1_selected_k,
            )
        )

        # 6. L1 cancer composition
        composition_data = compute_cancer_composition(df, config.l1_selected_k)

        # 7. Bootstrap stability
        stability_df = run_bootstrap_stability(X_scaled, cluster_results, config)
    else:
        logger.info("   L1 clustering disabled (include_pancan=false)")
        df["cluster_l1"] = -1
        metrics_df = pd.DataFrame()
        cluster_cancer_overlap = None
        l1_metadata = []
        l1_centroids_feature = []
        l1_centroids_umap = []
        l1_feature_profiles = []
        composition_data = []
        stability_df = pd.DataFrame()

    # 8. L2 clustering
    df, l2_results_df, l2_names_df = run_l2_clustering(df, X_scaled, feature_cols, config)

    # 8b. L2 UMAP embeddings (per cancer type)
    l2_umap_df = compute_l2_umap_embeddings(df, feature_cols, config)

    # 9. Save all results
    save_results(
        df,
        metrics_df,
        l1_metadata,
        l1_centroids_feature,
        l1_centroids_umap,
        l1_feature_profiles,
        composition_data,
        stability_df,
        l2_results_df,
        l2_names_df,
        l2_umap_df,
        cluster_cancer_overlap=cluster_cancer_overlap,
    )

    # Final summary
    logger.info("\n" + "=" * 60)
    logger.info("COMPUTATION COMPLETE")
    logger.info("=" * 60)
    logger.info("\nOutput files (in parquet/clustering/):")
    logger.info("  - slide_histomics.parquet")
    logger.info("  - l1_clustering_metrics.parquet")
    logger.info("  - l1_cluster_metadata.parquet")
    logger.info("  - l1_cluster_centroids_features.parquet")
    logger.info("  - l1_cluster_centroids_umap.parquet")
    logger.info("  - l1_cluster_feature_profiles.parquet")
    logger.info("  - l1_cluster_cancer_composition.parquet")
    logger.info("  - l1_cluster_cancer_type_overlap.json")
    logger.info("  - l1_bootstrap_stability.parquet")
    logger.info("  - l2_cluster_results.parquet")
    logger.info("  - l2_cluster_names.parquet")
    logger.info("  - l2_umap_coordinates.parquet")


if __name__ == "__main__":
    main()
