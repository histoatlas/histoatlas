"""Frontend data export and filtering utilities."""

from histoatlas.frontend._results import SimilarSlide
from histoatlas.frontend.export import (
    export_atlas_coordinates,
    export_cancer_types,
    export_clusters,
    export_enrichment_summaries,
    export_feature_metadata,
    export_filter_summaries,
    export_similar_slides,
    export_treatment_associations,
)
from histoatlas.frontend.filters import (
    compute_categorical_bitsets,
    compute_feature_bitsets,
    compute_quantile_bins,
    compute_range_lookup,
    encode_bitset_base64,
    pack_bitset,
)
from histoatlas.frontend.similarity import compute_cancer_specific_knn, compute_knn_batch

__all__ = [
    # Result dataclass
    "SimilarSlide",
    # Filters
    "pack_bitset",
    "encode_bitset_base64",
    "compute_quantile_bins",
    "compute_feature_bitsets",
    "compute_categorical_bitsets",
    "compute_range_lookup",
    # Similarity
    "compute_knn_batch",
    "compute_cancer_specific_knn",
    # Export
    "export_atlas_coordinates",
    "export_clusters",
    "export_feature_metadata",
    "export_cancer_types",
    "export_similar_slides",
    "export_filter_summaries",
    "export_enrichment_summaries",
    "export_treatment_associations",
]
