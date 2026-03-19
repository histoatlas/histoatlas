"""Clustering of histomics vectors."""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score


def find_optimal_k_elbow(
    X: np.ndarray,
    k_range: range,
    min_samples_per_cluster: int = 10,
) -> pd.DataFrame:
    """
    Find optimal k using elbow method with multiple metrics.

    Args:
        X: Feature matrix (n_samples x n_features)
        k_range: Range of k values to test
        min_samples_per_cluster: Minimum samples per cluster

    Returns:
        DataFrame with k, inertia, silhouette, calinski_harabasz, davies_bouldin scores
    """
    results = []

    for k in k_range:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X)

        # Check minimum cluster sizes
        unique, counts = np.unique(labels, return_counts=True)
        if min(counts) < min_samples_per_cluster:
            continue

        metrics = {
            "k": k,
            "inertia": kmeans.inertia_,
            "silhouette": silhouette_score(X, labels),
            "calinski_harabasz": calinski_harabasz_score(X, labels),
            "davies_bouldin": davies_bouldin_score(X, labels),
        }
        results.append(metrics)

    return pd.DataFrame(results)


def select_optimal_k_elbow(metrics_df: pd.DataFrame) -> int:
    """
    Select optimal k using the elbow method on inertia.

    Uses the maximum distance from the line connecting first and last points.

    Args:
        metrics_df: DataFrame with k and inertia columns

    Returns:
        Optimal k value
    """
    if len(metrics_df) < 3:
        return int(metrics_df["k"].iloc[0])

    k_vals = metrics_df["k"].values
    inertia_vals = metrics_df["inertia"].values

    # Guard against constant values (division by zero)
    k_range = k_vals.max() - k_vals.min()
    inertia_range = inertia_vals.max() - inertia_vals.min()

    if k_range == 0 or inertia_range == 0:
        return int(k_vals[0])

    # Normalize to [0, 1] range
    k_norm = (k_vals - k_vals.min()) / k_range
    inertia_norm = (inertia_vals - inertia_vals.min()) / inertia_range

    # Line from first to last point
    p1 = np.array([k_norm[0], inertia_norm[0]])
    p2 = np.array([k_norm[-1], inertia_norm[-1]])

    # Distance from each point to the line
    distances = []
    for i in range(len(k_vals)):
        point = np.array([k_norm[i], inertia_norm[i]])
        # Distance from point to line p1-p2
        d = np.abs(np.cross(p2 - p1, p1 - point)) / np.linalg.norm(p2 - p1)
        distances.append(d)

    # Return k with maximum distance
    optimal_idx = np.argmax(distances)
    return int(k_vals[optimal_idx])


FEATURE_LABELS: dict[str, tuple[str, str]] = {
    # Composition
    "tumor_area_fraction": ("Tumor-Dense", "Tumor-Sparse"),
    "stroma_area_fraction": ("Stroma-Rich", "Stroma-Poor"),
    # Topology
    "largest_tumor_component_share": ("Contiguous-Tumor", "Fragmented-Tumor"),
    "tumor_region_solidity": ("Compact-Tumor", "Diffuse-Tumor"),
    "tumor_stroma_interface_density": ("High-Interface", "Low-Interface"),
    "tumor_front_fraction": ("Front-Dominant", "Core-Dominant"),
    # Boundary
    "tumor_contact_fraction_stroma": ("Stroma-Contact", "Stroma-Isolated"),
    # Densities
    "intratumoral_cancer_cell_density": ("Tumor-Packed", "Tumor-Sparse"),
    "intratumoral_lymphocyte_density": ("TIL-High", "TIL-Low"),
    "stromal_lymphocyte_density": ("Stromal-Lymph-High", "Stromal-Lymph-Low"),
    "intratumoral_neutrophil_density": ("Neutrophil-Rich", "Neutrophil-Poor"),
    "intratumoral_eosinophil_density": ("Eosinophil-Rich", "Eosinophil-Poor"),
    "fibroblast_density_stroma": ("Fibroblast-Dense", "Fibroblast-Sparse"),
    # Immune geography
    "lymphocyte_infiltration_ratio_front": ("Front-Infiltrated", "Front-Excluded"),
    "myeloid_infiltration_ratio_front": ("Myeloid-Infiltrated", "Myeloid-Excluded"),
    "deep_intratumoral_lymphocyte_fraction": ("Deep-Infiltrated", "Periphery-Restricted"),
    "peritumoral_immune_richness": ("Immune-Diverse", "Immune-Monotone"),
    "immune_desert_fraction": ("Immune-Desert", "Immune-Infiltrated"),
    "intratumoral_myeloid_lymphoid_tilt": ("Myeloid-Skewed", "Lymphoid-Skewed"),
    "interface_normalized_immune_pressure": ("High-Immune-Pressure", "Low-Immune-Pressure"),
    # Invasion
    "invasion_depth_p75": ("Deep-Invasion", "Shallow-Invasion"),
    "tumor_fibroblast_coupling_front": ("CAF-Coupled", "CAF-Decoupled"),
    # Stromal
    "peritumoral_fibroblast_enrichment": ("Peritumoral-Fibro", "Diffuse-Fibro"),
    "stromal_inflammatory_tilt": ("Inflamed-Stroma", "Quiescent-Stroma"),
    "fibroblast_lymphocyte_proximity_stroma": ("Fibro-Lymph-Close", "Fibro-Lymph-Distant"),
    # Granulocyte
    "eosinophil_neutrophil_ratio_peritumoral": ("Eosinophil-Skewed", "Neutrophil-Skewed"),
    # Kinetics
    "mitotic_index_tumor": ("High-Mitotic", "Low-Mitotic"),
    "apoptotic_index_tumor": ("High-Apoptotic", "Low-Apoptotic"),
    "apoptosis_mitosis_ratio_tumor": ("Apoptosis-Dominant", "Growth-Dominant"),
    # Heterogeneity
    "tumor_cell_density_heterogeneity": ("Hetero-Density", "Homo-Density"),
    "lymphocyte_density_heterogeneity_tumor": ("Hetero-Immune", "Homo-Immune"),
    "stromal_cellularity_heterogeneity": ("Hetero-Stroma", "Homo-Stroma"),
    # NN distance
    "tumor_lymphocyte_nn_distance_front": ("Lymph-Distant", "Lymph-Proximal"),
    # Nuclear morphology
    "tumor_nuclear_area_median": ("Large-Nuclei", "Small-Nuclei"),
    "tumor_pleomorphism_index": ("Pleomorphic", "Uniform"),
    "tumor_nuclear_eccentricity_median": ("Elongated-Nuclei", "Round-Nuclei"),
    "tumor_nuclear_irregularity_median": ("Irregular-Nuclei", "Regular-Nuclei"),
    "tumor_nuclear_irregularity_iqr": ("Variable-Irregularity", "Consistent-Shape"),
}

IMMUNE_FEATURES = [
    "intratumoral_lymphocyte_density",
    "stromal_lymphocyte_density",
    "immune_desert_fraction",
    "deep_intratumoral_lymphocyte_fraction",
    "peritumoral_immune_richness",
]

STROMAL_FEATURES = [
    "stroma_area_fraction",
    "fibroblast_density_stroma",
    "peritumoral_fibroblast_enrichment",
]

# immune_desert_fraction is inverted: high value = low immune activity
_INVERTED_FEATURES = {"immune_desert_fraction"}


def _classify_axis(z_scores: pd.Series, features: list[str], labels: tuple[str, str, str]) -> str:
    """Classify a cluster along an axis (immune or stromal) from mean z-score."""
    available = [f for f in features if f in z_scores.index]
    if not available:
        return labels[2]  # mid/mixed fallback

    values = []
    for f in available:
        z = z_scores[f]
        values.append(-z if f in _INVERTED_FEATURES else z)

    mean_z = float(np.mean(values))
    if mean_z > 0.5:
        return labels[0]
    elif mean_z < -0.5:
        return labels[1]
    else:
        return labels[2]


def _dominant_feature(
    z_scores: pd.Series,
    skip_features: set[str],
) -> str | None:
    """Return human-readable label for the most extreme z-score feature."""
    candidates = z_scores.drop(labels=[f for f in skip_features if f in z_scores.index])
    if candidates.empty:
        return None

    abs_z = candidates.abs()
    top_feat = abs_z.idxmax()
    top_z = float(z_scores[top_feat])

    if abs(top_z) < 0.5:
        return None

    if top_feat in FEATURE_LABELS:
        pos_label, neg_label = FEATURE_LABELS[top_feat]
        return pos_label if top_z > 0 else neg_label

    # Fallback: humanize the feature name
    name = str(top_feat).replace("_", " ").title()
    prefix = "High" if top_z > 0 else "Low"
    return f"{prefix}-{name}"


def _cancer_enrichment_tag(
    labels: np.ndarray,
    cluster_id: int,
    df: pd.DataFrame,
) -> str | None:
    """Return cancer enrichment parenthetical, or None."""
    if "cancer_type" not in df.columns:
        return None

    cluster_mask = labels == cluster_id
    cancer_counts = df.loc[cluster_mask, "cancer_type"].value_counts(normalize=True)

    if cancer_counts.empty:
        return None

    top1 = cancer_counts.iloc[0]
    top1_name = str(cancer_counts.index[0])

    if top1 >= 0.4:
        return f"({top1_name}-enriched)"

    if len(cancer_counts) >= 2:
        top2 = cancer_counts.iloc[1]
        top2_name = str(cancer_counts.index[1])
        if top1 >= 0.25 and top2 >= 0.25:
            return f"({top1_name}/{top2_name})"

    return None


def generate_cluster_names_for_k(
    k: int,
    labels: np.ndarray,
    df: pd.DataFrame,
    feature_cols: list[str],
    global_means: pd.Series,
    global_stds: pd.Series,
    top_n: int = 2,
) -> dict[int, str]:
    """
    Auto-generate structured names for L1 clusters.

    Names follow the pattern:
        Immune-Hot, Stroma-Low, High-Mitotic (BRCA-enriched)

    Args:
        k: Number of clusters
        labels: Cluster labels array
        df: DataFrame with features (must include feature_cols, may include cancer_type)
        feature_cols: List of feature column names
        global_means: Global mean for each feature
        global_stds: Global std for each feature
        top_n: Unused, kept for API compatibility

    Returns:
        Dictionary mapping cluster_id to cluster name
    """
    cluster_names = {}
    skip_features = set(IMMUNE_FEATURES) | set(STROMAL_FEATURES)
    global_stds_safe = global_stds.replace(0, 1)

    for cluster_id in range(k):
        cluster_mask = labels == cluster_id
        cluster_means = df.loc[cluster_mask, feature_cols].mean()
        z_scores = (cluster_means - global_means) / global_stds_safe

        parts = []

        immune = _classify_axis(
            z_scores, IMMUNE_FEATURES, ("Immune-Hot", "Immune-Cold", "Immune-Mixed")
        )
        parts.append(immune)

        stromal = _classify_axis(
            z_scores, STROMAL_FEATURES, ("Stroma-High", "Stroma-Low", "Stroma-Mid")
        )
        parts.append(stromal)

        dominant = _dominant_feature(z_scores, skip_features)
        if dominant:
            parts.append(dominant)

        name = ", ".join(parts)

        enrichment = _cancer_enrichment_tag(labels, cluster_id, df)
        if enrichment:
            name = f"{name} {enrichment}"

        cluster_names[cluster_id] = name

    return cluster_names


def generate_l2_cluster_name(
    cluster_df: pd.DataFrame,
    cancer_means: pd.Series,
    cancer_stds: pd.Series,
    feature_cols: list[str],
    top_n: int = 2,
) -> str:
    """
    Generate structured name for an L2 (cancer-specific) cluster.

    Same immune/stromal/dominant-feature logic as L1, but z-scores are
    relative to the cancer type and no cancer enrichment tag is added.

    Args:
        cluster_df: DataFrame of samples in this cluster
        cancer_means: Mean of each feature for this cancer type
        cancer_stds: Std of each feature for this cancer type
        feature_cols: List of feature column names
        top_n: Unused, kept for API compatibility

    Returns:
        Cluster name string
    """
    cluster_means = cluster_df[feature_cols].mean()
    cancer_stds_safe = cancer_stds.replace(0, 1)
    z_scores = (cluster_means - cancer_means) / cancer_stds_safe

    skip_features = set(IMMUNE_FEATURES) | set(STROMAL_FEATURES)

    parts = []

    immune = _classify_axis(
        z_scores, IMMUNE_FEATURES, ("Immune-Hot", "Immune-Cold", "Immune-Mixed")
    )
    parts.append(immune)

    stromal = _classify_axis(
        z_scores, STROMAL_FEATURES, ("Stroma-High", "Stroma-Low", "Stroma-Mid")
    )
    parts.append(stromal)

    dominant = _dominant_feature(z_scores, skip_features)
    if dominant:
        parts.append(dominant)

    return ", ".join(parts)
