"""Frontend JSON export functions."""

import json
from pathlib import Path

import pandas as pd

from histoatlas._utils import get_histomic_features
from histoatlas.config.cancer_metadata import CANCER_FULL_NAMES, CANCER_TYPE_COLORS
from histoatlas.config.feature_metadata import FEATURE_METADATA


def export_atlas_coordinates(
    slides_df: pd.DataFrame,
    output_dir: Path,
    l2_umap_df: pd.DataFrame | None = None,
) -> None:
    """
    Export UMAP coordinates for all slides.

    Args:
        slides_df: DataFrame with slide data including UMAP coordinates
        output_dir: Output directory path
        l2_umap_df: Optional DataFrame with L2 UMAP coordinates
            (slide_name, cancer_type, umap_l2_1, umap_l2_2)
    """
    # Build L2 UMAP lookup: slide_name -> (umap_l2_1, umap_l2_2)
    l2_umap_lookup: dict[str, tuple[float, float]] = {}
    if l2_umap_df is not None:
        for _, row in l2_umap_df.iterrows():
            l2_umap_lookup[row["slide_name"]] = (
                float(row["umap_l2_1"]),
                float(row["umap_l2_2"]),
            )

    coords = []
    for _, row in slides_df.iterrows():
        slide_name = row["slide_name"]
        l2_coords = l2_umap_lookup.get(slide_name)

        coord_dict: dict[str, object] = {
            "slide_id": slide_name,
            "cancer_type": row["cancer_type"],
            "umap_x": float(row["umap_1"]) if pd.notna(row["umap_1"]) else None,
            "umap_y": float(row["umap_2"]) if pd.notna(row["umap_2"]) else None,
            "cluster_l1": int(row["cluster_l1"])
            if pd.notna(row["cluster_l1"]) and row["cluster_l1"] >= 0
            else None,
            "cluster_l2": int(row["cluster_l2"]) if pd.notna(row["cluster_l2"]) else None,
        }

        if l2_coords is not None:
            coord_dict["umap_l2_x"] = l2_coords[0]
            coord_dict["umap_l2_y"] = l2_coords[1]

        coords.append(coord_dict)

    with open(output_dir / "atlas_coordinates.json", "w") as f:
        json.dump(coords, f)


def export_clusters(
    slides_df: pd.DataFrame,
    output_dir: Path,
    metadata_path: Path | None = None,
    l2_names_path: Path | None = None,
) -> None:
    """
    Export cluster metadata and enrichments.

    Args:
        slides_df: DataFrame with slide data including cluster assignments
        output_dir: Output directory path
        metadata_path: Optional path to L1 cluster metadata parquet file
        l2_names_path: Optional path to L2 cluster names parquet file
    """
    clusters: dict[str, list[dict[str, object]]] = {"l1": [], "l2": []}

    # Load cluster metadata if available
    metadata_df = None
    if metadata_path and metadata_path.exists():
        metadata_df = pd.read_parquet(metadata_path)

    l2_names_df = None
    if l2_names_path and l2_names_path.exists():
        l2_names_df = pd.read_parquet(l2_names_path)

    # L1 clusters (skip sentinel -1 used when pan-cancer clustering is disabled)
    l1_clusters = slides_df["cluster_l1"].dropna().unique()
    l1_clusters = [c for c in l1_clusters if c >= 0]

    for cluster_id in sorted(l1_clusters):
        cluster_slides = slides_df[slides_df["cluster_l1"] == cluster_id]
        n_slides = len(cluster_slides)

        # Cancer type composition
        cancer_composition = cluster_slides["cancer_type"].value_counts(normalize=True).to_dict()

        # Get cluster name from metadata if available
        cluster_name = f"Cluster {int(cluster_id)}"
        if metadata_df is not None and "auto_name" in metadata_df.columns:
            name_row = metadata_df[metadata_df["cluster_id"] == cluster_id]
            if len(name_row) > 0:
                cluster_name = name_row.iloc[0]["auto_name"]

        clusters["l1"].append(
            {
                "cluster_id": int(cluster_id),
                "level": "L1",
                "name": cluster_name,
                "n_slides": n_slides,
                "cancer_composition": cancer_composition,
            }
        )

    # L2 clusters (cancer-specific)
    for cancer_type in slides_df["cancer_type"].unique():
        cancer_slides = slides_df[slides_df["cancer_type"] == cancer_type]
        l2_clusters = cancer_slides["cluster_l2"].dropna().unique()

        for cluster_id in sorted(l2_clusters):
            cluster_slides = cancer_slides[cancer_slides["cluster_l2"] == cluster_id]
            n_slides = len(cluster_slides)

            # Get L2 cluster name from names parquet if available
            l2_name = f"{cancer_type} Cluster {int(cluster_id)}"
            if l2_names_df is not None and "auto_name" in l2_names_df.columns:
                name_row = l2_names_df[
                    (l2_names_df["cancer_type"] == cancer_type)
                    & (l2_names_df["cluster_l2"] == cluster_id)
                ]
                if len(name_row) > 0:
                    l2_name = name_row.iloc[0]["auto_name"]

            clusters["l2"].append(
                {
                    "cluster_id": int(cluster_id),
                    "level": "L2",
                    "cancer_type": cancer_type,
                    "name": l2_name,
                    "n_slides": n_slides,
                }
            )

    with open(output_dir / "clusters.json", "w") as f:
        json.dump(clusters, f, indent=2)


def export_feature_metadata(slides_df: pd.DataFrame, output_dir: Path) -> None:
    """
    Export feature descriptions and metadata.

    Args:
        slides_df: DataFrame with slide features
        output_dir: Output directory path
    """
    histomic_features = get_histomic_features(slides_df)

    features: dict[str, dict[str, object]] = {}
    for feature in histomic_features:
        # Get metadata if available, otherwise generate generic
        meta: dict[str, object]
        if feature in FEATURE_METADATA:
            meta = dict(FEATURE_METADATA[feature])
        else:
            # Generate generic metadata
            meta = {
                "category": "other",
                "unit": "",
                "description_short": feature.replace("_", " ").title(),
                "description_long": f"Histomic feature: {feature}",
                "directionality": "contextual",
            }

        # Add statistics
        feature_values = slides_df[feature].dropna()
        if len(feature_values) > 0:
            meta["statistics"] = {
                "min": float(feature_values.min()),
                "max": float(feature_values.max()),
                "mean": float(feature_values.mean()),
                "median": float(feature_values.median()),
                "std": float(feature_values.std()),
                "n_valid": int(len(feature_values)),
            }
        else:
            meta["statistics"] = {
                "min": None,
                "max": None,
                "mean": None,
                "median": None,
                "std": None,
                "n_valid": 0,
            }

        features[feature] = meta

    with open(output_dir / "feature_metadata.json", "w") as f:
        json.dump(features, f, indent=2)


def export_cancer_types(slides_df: pd.DataFrame, output_dir: Path) -> None:
    """
    Export cancer type list with colors and counts.

    Args:
        slides_df: DataFrame with slide data
        output_dir: Output directory path
    """
    cancer_counts = slides_df["cancer_type"].value_counts().to_dict()

    cancer_types = []
    for cancer_type, count in sorted(cancer_counts.items(), key=lambda x: -x[1]):
        cancer_types.append(
            {
                "cancer_type": cancer_type,
                "n_slides": count,
                "color": CANCER_TYPE_COLORS.get(cancer_type, "#999999"),
                "full_name": CANCER_FULL_NAMES.get(cancer_type, cancer_type),
            }
        )

    with open(output_dir / "cancer_types.json", "w") as f:
        json.dump(cancer_types, f, indent=2)


def export_similar_slides(data_dir: Path, output_dir: Path) -> None:
    """
    Export similar slides from parquet to JSON.

    Args:
        data_dir: Directory containing similar_slides.parquet
        output_dir: Output directory path
    """
    similar_path = data_dir / "similar_slides.parquet"
    if not similar_path.exists():
        return

    similar_df = pd.read_parquet(similar_path)

    # Group by slide_id for efficient lookup
    similar_dict = {}
    for slide_id, group in similar_df.groupby("slide_id"):
        neighbors = []
        for _, row in group.sort_values("neighbor_rank").iterrows():
            neighbors.append(
                {
                    "slide_id": row["neighbor_slide_id"],
                    "rank": int(row["neighbor_rank"]),
                    "distance": float(row["distance"]),
                    "same_cancer": bool(row["same_cancer_type"]),
                }
            )
        similar_dict[slide_id] = neighbors

    with open(output_dir / "similar_slides.json", "w") as f:
        json.dump(similar_dict, f)


def export_filter_summaries(slides_df: pd.DataFrame, output_dir: Path) -> None:
    """
    Export per-feature quantiles and histogram bins for filter UI sliders.

    Args:
        slides_df: DataFrame with slide features
        output_dir: Output directory path
    """
    import numpy as np

    histomic_features = get_histomic_features(slides_df)

    summaries = {}
    for feature in histomic_features:
        values = slides_df[feature].dropna()

        if len(values) == 0:
            continue

        # Compute histogram with 20 bins
        counts, _ = np.histogram(values, bins=20)

        summaries[feature] = {
            "min": float(values.min()),
            "max": float(values.max()),
            "quantiles": {
                "p01": float(values.quantile(0.01)),
                "p05": float(values.quantile(0.05)),
                "p25": float(values.quantile(0.25)),
                "p50": float(values.quantile(0.50)),
                "p75": float(values.quantile(0.75)),
                "p95": float(values.quantile(0.95)),
                "p99": float(values.quantile(0.99)),
            },
            "histogramBins": counts.tolist(),
        }

    with open(output_dir / "filter_summaries.json", "w") as f:
        json.dump(summaries, f, indent=2)


def _export_l1_mutation_enrichments(
    sig_df: pd.DataFrame,
) -> dict[str, list[dict[str, object]]]:
    """Extract top L1 mutation enrichments keyed by cluster_id."""
    result: dict[str, list[dict[str, object]]] = {}
    for cluster_id in sig_df["cluster_id"].unique():
        cluster_sig = sig_df[sig_df["cluster_id"] == cluster_id]
        top = cluster_sig.nlargest(5, "odds_ratio")[
            ["mutation", "odds_ratio", "p_value_adj"]
        ].to_dict("records")
        result[str(int(cluster_id))] = top
    return result


def _export_l2_mutation_enrichments(
    sig_df: pd.DataFrame,
) -> dict[str, list[dict[str, object]]]:
    """Extract top L2 mutation enrichments keyed by {cancer_type}_{cluster_id}."""
    result: dict[str, list[dict[str, object]]] = {}
    for (cancer_type, cluster_id), group in sig_df.groupby(["cancer_type", "cluster_id"]):
        top = group.nlargest(5, "odds_ratio")[["mutation", "odds_ratio", "p_value_adj"]].to_dict(
            "records"
        )
        result[f"{cancer_type}_{int(cluster_id)}"] = top
    return result


def _export_l1_pathway_enrichments(
    sig_df: pd.DataFrame, effect_col: str
) -> dict[str, list[dict[str, object]]]:
    """Extract top L1 pathway enrichments keyed by cluster_id."""
    result: dict[str, list[dict[str, object]]] = {}
    for cluster_id in sig_df["cluster_id"].unique():
        cluster_sig = sig_df[sig_df["cluster_id"] == cluster_id]
        top = cluster_sig.nlargest(5, effect_col)[
            ["pathway_name", effect_col, "p_value_adj"]
        ].to_dict("records")
        for record in top:
            if effect_col != "cliffs_delta":
                record["cliffs_delta"] = record.pop(effect_col)
        result[str(int(cluster_id))] = top
    return result


def _export_l2_pathway_enrichments(
    sig_df: pd.DataFrame, effect_col: str
) -> dict[str, list[dict[str, object]]]:
    """Extract top L2 pathway enrichments keyed by {cancer_type}_{cluster_id}."""
    result: dict[str, list[dict[str, object]]] = {}
    for (cancer_type, cluster_id), group in sig_df.groupby(["cancer_type", "cluster_id"]):
        top = group.nlargest(5, effect_col)[["pathway_name", effect_col, "p_value_adj"]].to_dict(
            "records"
        )
        for record in top:
            if effect_col != "cliffs_delta":
                record["cliffs_delta"] = record.pop(effect_col)
        result[f"{cancer_type}_{int(cluster_id)}"] = top
    return result


def _export_l1_immune_enrichments(
    sig_df: pd.DataFrame,
) -> dict[str, list[dict[str, object]]]:
    """Extract top L1 immune enrichments keyed by cluster_id."""
    result: dict[str, list[dict[str, object]]] = {}
    for cluster_id in sig_df["cluster_id"].unique():
        cluster_sig = sig_df[sig_df["cluster_id"] == cluster_id]
        top = cluster_sig.nlargest(3, "odds_ratio")[
            ["immune_subtype", "odds_ratio", "p_value_adj"]
        ].to_dict("records")
        result[str(int(cluster_id))] = top
    return result


def _export_l2_immune_enrichments(
    sig_df: pd.DataFrame,
) -> dict[str, list[dict[str, object]]]:
    """Extract top L2 immune enrichments keyed by {cancer_type}_{cluster_id}."""
    result: dict[str, list[dict[str, object]]] = {}
    for (cancer_type, cluster_id), group in sig_df.groupby(["cancer_type", "cluster_id"]):
        top = group.nlargest(3, "odds_ratio")[
            ["immune_subtype", "odds_ratio", "p_value_adj"]
        ].to_dict("records")
        result[f"{cancer_type}_{int(cluster_id)}"] = top
    return result


def export_enrichment_summaries(data_dir: Path, output_dir: Path) -> None:
    """
    Export cluster enrichment summaries for quick frontend access.

    Output structure separates L1 (pan-cancer) and L2 (cancer-specific) enrichments:
    - L1 keys: cluster_id as string (e.g. "0", "1")
    - L2 keys: "{cancer_type}_{cluster_id}" composite (e.g. "BRCA_0", "LUAD_1")

    Args:
        data_dir: Directory containing enrichment parquet files
        output_dir: Output directory path
    """
    enrichments: dict[str, dict[str, dict[str, list[dict[str, object]]]]] = {
        "l1": {"mutation": {}, "pathway": {}, "immune": {}},
        "l2": {"mutation": {}, "pathway": {}, "immune": {}},
    }

    # Mutation enrichments
    mutation_path = data_dir / "cluster_mutation_enrichment.parquet"
    if mutation_path.exists():
        mut_df = pd.read_parquet(mutation_path)
        if mut_df.empty or "is_significant" not in mut_df.columns:
            sig_mut = pd.DataFrame()
        else:
            sig_mut = mut_df[mut_df["is_significant"]]

        if "cluster_level" in sig_mut.columns:
            l1_sig = sig_mut[sig_mut["cluster_level"] == "L1"]
            l2_sig = sig_mut[sig_mut["cluster_level"] == "L2"]
        else:
            l1_sig = sig_mut
            l2_sig = pd.DataFrame()

        if not l1_sig.empty:
            enrichments["l1"]["mutation"] = _export_l1_mutation_enrichments(l1_sig)
        if not l2_sig.empty:
            enrichments["l2"]["mutation"] = _export_l2_mutation_enrichments(l2_sig)

    # Pathway enrichments
    pathway_path = data_dir / "cluster_pathway_enrichment.parquet"
    if pathway_path.exists():
        path_df = pd.read_parquet(pathway_path)
        if path_df.empty or "is_significant" not in path_df.columns:
            sig_path = pd.DataFrame()
        else:
            sig_path = path_df[path_df["is_significant"]]

        effect_col = (
            "cliffs_delta" if "cliffs_delta" in path_df.columns else "standardized_difference"
        )

        if "cluster_level" in sig_path.columns:
            l1_sig = sig_path[sig_path["cluster_level"] == "L1"]
            l2_sig = sig_path[sig_path["cluster_level"] == "L2"]
        else:
            l1_sig = sig_path
            l2_sig = pd.DataFrame()

        if not l1_sig.empty:
            enrichments["l1"]["pathway"] = _export_l1_pathway_enrichments(l1_sig, effect_col)
        if not l2_sig.empty:
            enrichments["l2"]["pathway"] = _export_l2_pathway_enrichments(l2_sig, effect_col)

    # Immune enrichments
    immune_path = data_dir / "cluster_immune_enrichment.parquet"
    if immune_path.exists():
        imm_df = pd.read_parquet(immune_path)
        if imm_df.empty or "is_significant" not in imm_df.columns:
            sig_imm = pd.DataFrame()
        else:
            sig_imm = imm_df[imm_df["is_significant"]]

        if "cluster_level" in sig_imm.columns:
            l1_sig = sig_imm[sig_imm["cluster_level"] == "L1"]
            l2_sig = sig_imm[sig_imm["cluster_level"] == "L2"]
        else:
            l1_sig = sig_imm
            l2_sig = pd.DataFrame()

        if not l1_sig.empty:
            enrichments["l1"]["immune"] = _export_l1_immune_enrichments(l1_sig)
        if not l2_sig.empty:
            enrichments["l2"]["immune"] = _export_l2_immune_enrichments(l2_sig)

    with open(output_dir / "enrichment_summaries.json", "w") as f:
        json.dump(enrichments, f, indent=2)


def export_treatment_associations(data_dir: Path, output_dir: Path) -> None:
    """
    Export treatment associations summary for frontend.

    Args:
        data_dir: Directory containing treatment_associations.parquet
        output_dir: Output directory path
    """
    treatment_path = data_dir / "treatment_associations.parquet"
    if not treatment_path.exists():
        return

    df = pd.read_parquet(treatment_path)
    if df.empty or "treatment_var" not in df.columns:
        with open(output_dir / "treatment_associations.json", "w") as f:
            json.dump({}, f)
        return

    # Group by treatment variable
    summary: dict[str, dict[str, list[dict[str, object]]]] = {}

    for treatment_var in df["treatment_var"].unique():
        treatment_df = df[df["treatment_var"] == treatment_var]
        sig_df = treatment_df[treatment_df["is_significant"]]

        summary[treatment_var] = {
            "n_tests": len(treatment_df),
            "n_significant": len(sig_df),
            "top_associations_by_cancer": {},
        }

        # Top associations per cancer type
        for cancer_type in sig_df["cancer_type"].unique():
            cancer_sig = sig_df[sig_df["cancer_type"] == cancer_type]
            top_assoc = cancer_sig.nlargest(5, "cliffs_delta", keep="all")[
                ["histomic_feature", "cliffs_delta", "p_value_adj", "n_treated", "n_untreated"]
            ].to_dict("records")
            summary[treatment_var]["top_associations_by_cancer"][cancer_type] = top_assoc

    with open(output_dir / "treatment_associations.json", "w") as f:
        json.dump(summary, f, indent=2)
