"""Feature metadata for the 38 histomics features computed by histotyper.

Each entry maps a feature name to its category (matching frontend FeatureCategory),
unit, and short/long descriptions. Source of truth: HISTOMICS_SPECIFICATIONS.md v13.
"""

FEATURE_METADATA: dict[str, dict[str, str]] = {
    # =========================================================================
    # A · Tissue composition
    # =========================================================================
    "tumor_area_fraction": {
        "category": "composition",
        "unit": "fraction",
        "description_short": "Tumor area fraction",
        "description_long": "Fraction of tissue area occupied by tumor epithelium",
    },
    "stroma_area_fraction": {
        "category": "composition",
        "unit": "fraction",
        "description_short": "Stroma area fraction",
        "description_long": "Fraction of tissue area occupied by stroma",
    },
    # =========================================================================
    # B · Topology
    # =========================================================================
    "largest_tumor_component_share": {
        "category": "spatial",
        "unit": "fraction",
        "description_short": "Largest tumor component share",
        "description_long": "Fraction of total tumor area contained in the largest connected component",
    },
    "tumor_region_solidity": {
        "category": "spatial",
        "unit": "ratio",
        "description_short": "Tumor region solidity",
        "description_long": "Solidity of the tumor region (area / convex hull area), measuring compactness",
    },
    "tumor_stroma_interface_density": {
        "category": "spatial",
        "unit": "mm/mm²",
        "description_short": "Tumor-stroma interface density",
        "description_long": "Length of tumor-stroma boundary per unit tumor area",
    },
    "tumor_front_fraction": {
        "category": "spatial",
        "unit": "fraction",
        "description_short": "Tumor front fraction",
        "description_long": "Fraction of tumor area within the invasive front zone",
    },
    # =========================================================================
    # C · Boundary contacts
    # =========================================================================
    "tumor_contact_fraction_stroma": {
        "category": "spatial",
        "unit": "fraction",
        "description_short": "Tumor-stroma contact fraction",
        "description_long": "Fraction of tumor boundary in contact with stroma",
    },
    # =========================================================================
    # D · Absolute densities
    # =========================================================================
    "intratumoral_cancer_cell_density": {
        "category": "density",
        "unit": "cells/mm²",
        "description_short": "Intratumoral cancer cell density",
        "description_long": "Density of cancer cells within the tumor epithelium",
    },
    "intratumoral_lymphocyte_density": {
        "category": "density",
        "unit": "cells/mm²",
        "description_short": "Intratumoral lymphocyte density",
        "description_long": "Density of lymphocytes within the tumor epithelium",
    },
    "stromal_lymphocyte_density": {
        "category": "density",
        "unit": "cells/mm²",
        "description_short": "Stromal lymphocyte density",
        "description_long": "Density of lymphocytes within the stromal compartment",
    },
    "intratumoral_neutrophil_density": {
        "category": "density",
        "unit": "cells/mm²",
        "description_short": "Intratumoral neutrophil density",
        "description_long": "Density of neutrophils within the tumor epithelium",
    },
    "intratumoral_eosinophil_density": {
        "category": "density",
        "unit": "cells/mm²",
        "description_short": "Intratumoral eosinophil density",
        "description_long": "Density of eosinophils within the tumor epithelium",
    },
    "fibroblast_density_stroma": {
        "category": "density",
        "unit": "cells/mm²",
        "description_short": "Stromal fibroblast density",
        "description_long": "Density of fibroblasts within the stromal compartment",
    },
    # =========================================================================
    # E · Immune geography
    # =========================================================================
    "lymphocyte_infiltration_ratio_front": {
        "category": "spatial",
        "unit": "ratio",
        "description_short": "Lymphocyte infiltration ratio (front)",
        "description_long": "Ratio of intratumoral to stromal lymphocyte density at the invasive front",
    },
    "myeloid_infiltration_ratio_front": {
        "category": "spatial",
        "unit": "ratio",
        "description_short": "Myeloid infiltration ratio (front)",
        "description_long": "Ratio of intratumoral to stromal myeloid cell density at the invasive front",
    },
    "deep_intratumoral_lymphocyte_fraction": {
        "category": "spatial",
        "unit": "fraction",
        "description_short": "Deep intratumoral lymphocyte fraction",
        "description_long": "Fraction of intratumoral lymphocytes located in the deep tumor core (away from front)",
    },
    "peritumoral_immune_richness": {
        "category": "spatial",
        "unit": "score",
        "description_short": "Peritumoral immune richness",
        "description_long": "Diversity of immune cell types in the peritumoral zone",
    },
    "immune_desert_fraction": {
        "category": "spatial",
        "unit": "fraction",
        "description_short": "Immune desert fraction",
        "description_long": "Fraction of tumor area devoid of immune cells",
    },
    "intratumoral_myeloid_lymphoid_tilt": {
        "category": "spatial",
        "unit": "ratio",
        "description_short": "Intratumoral myeloid-lymphoid tilt",
        "description_long": "Ratio of myeloid to lymphoid cells within the tumor, indicating innate vs adaptive immune balance",
    },
    "interface_normalized_immune_pressure": {
        "category": "spatial",
        "unit": "cells/mm",
        "description_short": "Interface-normalized immune pressure",
        "description_long": "Immune cell count at the tumor-stroma interface normalized by interface length",
    },
    # =========================================================================
    # F · Invasion
    # =========================================================================
    "invasion_depth_p75": {
        "category": "spatial",
        "unit": "mm",
        "description_short": "Invasion depth (75th percentile)",
        "description_long": "75th percentile of tumor invasion depth from the nearest tissue boundary",
    },
    "tumor_fibroblast_coupling_front": {
        "category": "spatial",
        "unit": "score",
        "description_short": "Tumor-fibroblast coupling at front",
        "description_long": "Co-localization of tumor cells and fibroblasts at the invasive front",
    },
    # =========================================================================
    # G · Stromal features
    # =========================================================================
    "peritumoral_fibroblast_enrichment": {
        "category": "spatial",
        "unit": "ratio",
        "description_short": "Peritumoral fibroblast enrichment",
        "description_long": "Ratio of fibroblast density in peritumoral stroma vs distal stroma",
    },
    "stromal_inflammatory_tilt": {
        "category": "spatial",
        "unit": "ratio",
        "description_short": "Stromal inflammatory tilt",
        "description_long": "Ratio of immune cells to fibroblasts in the stromal compartment",
    },
    "fibroblast_lymphocyte_proximity_stroma": {
        "category": "spatial",
        "unit": "μm",
        "description_short": "Fibroblast-lymphocyte proximity (stroma)",
        "description_long": "Median nearest-neighbor distance between fibroblasts and lymphocytes in stroma",
    },
    # =========================================================================
    # H · Granulocyte ratio
    # =========================================================================
    "eosinophil_neutrophil_ratio_peritumoral": {
        "category": "composition",
        "unit": "ratio",
        "description_short": "Eosinophil-neutrophil ratio (peritumoral)",
        "description_long": "Ratio of eosinophils to neutrophils in the peritumoral zone",
    },
    # =========================================================================
    # J · Kinetics
    # =========================================================================
    "mitotic_index_tumor": {
        "category": "morphology",
        "unit": "mitoses/mm²",
        "description_short": "Mitotic index (tumor)",
        "description_long": "Density of mitotic figures within the tumor epithelium",
    },
    "apoptotic_index_tumor": {
        "category": "morphology",
        "unit": "apoptoses/mm²",
        "description_short": "Apoptotic index (tumor)",
        "description_long": "Density of apoptotic cells within the tumor epithelium",
    },
    "apoptosis_mitosis_ratio_tumor": {
        "category": "morphology",
        "unit": "ratio",
        "description_short": "Apoptosis-mitosis ratio (tumor)",
        "description_long": "Ratio of apoptotic to mitotic events in the tumor, indicating growth dynamics",
    },
    # =========================================================================
    # K · Heterogeneity
    # =========================================================================
    "tumor_cell_density_heterogeneity": {
        "category": "heterogeneity",
        "unit": "CV",
        "description_short": "Tumor cell density heterogeneity",
        "description_long": "Coefficient of variation of tumor cell density across spatial tiles",
    },
    "lymphocyte_density_heterogeneity_tumor": {
        "category": "heterogeneity",
        "unit": "CV",
        "description_short": "Lymphocyte density heterogeneity (tumor)",
        "description_long": "Coefficient of variation of lymphocyte density across tumor tiles",
    },
    "stromal_cellularity_heterogeneity": {
        "category": "heterogeneity",
        "unit": "CV",
        "description_short": "Stromal cellularity heterogeneity",
        "description_long": "Coefficient of variation of total cell density across stromal tiles",
    },
    # =========================================================================
    # L · Nearest-neighbor distance
    # =========================================================================
    "tumor_lymphocyte_nn_distance_front": {
        "category": "spatial",
        "unit": "μm",
        "description_short": "Tumor-lymphocyte NN distance (front)",
        "description_long": "Median nearest-neighbor distance from tumor cells to lymphocytes at the invasive front",
    },
    # =========================================================================
    # M · Nuclear morphology
    # =========================================================================
    "tumor_nuclear_area_median": {
        "category": "morphology",
        "unit": "μm²",
        "description_short": "Tumor nuclear area (median)",
        "description_long": "Median nuclear area of tumor cells",
    },
    "tumor_pleomorphism_index": {
        "category": "morphology",
        "unit": "CV",
        "description_short": "Tumor pleomorphism index",
        "description_long": "Coefficient of variation of tumor nuclear area, indicating nuclear size heterogeneity",
    },
    "tumor_nuclear_eccentricity_median": {
        "category": "morphology",
        "unit": "ratio",
        "description_short": "Tumor nuclear eccentricity (median)",
        "description_long": "Median eccentricity of tumor nuclei (0 = circle, 1 = line)",
    },
    "tumor_nuclear_irregularity_median": {
        "category": "morphology",
        "unit": "score",
        "description_short": "Tumor nuclear irregularity (median)",
        "description_long": "Median nuclear contour irregularity of tumor cells",
    },
    "tumor_nuclear_irregularity_iqr": {
        "category": "morphology",
        "unit": "score",
        "description_short": "Tumor nuclear irregularity (IQR)",
        "description_long": "Interquartile range of nuclear contour irregularity, measuring irregularity variability",
    },
}
