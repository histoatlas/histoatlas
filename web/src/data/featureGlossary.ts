/**
 * Static glossary of all histomics features.
 *
 * Source of truth: histoatlas/config/feature_metadata.py
 * Each entry includes a KaTeX formula, description, unit, and section grouping.
 */

export type GlossaryFeature = {
  id: number;
  name: string;
  displayName: string;
  section: string;
  unit: string;
  formula: string;
  description: string;
  optional: boolean;
};

export type GlossarySection = {
  key: string;
  label: string;
  features: GlossaryFeature[];
};

export type NotationEntry = {
  symbol: string;
  tex: string;
  definition: string;
};

export type NotationCategory = {
  label: string;
  entries: NotationEntry[];
};

/** Shared notation legend — defines every symbol used across all 38 formulas. */
export const NOTATION_LEGEND: NotationCategory[] = [
  {
    label: 'Spatial domains',
    entries: [
      { symbol: 'Ω', tex: '\\Omega', definition: 'Total tissue area on the slide' },
      { symbol: 'Ω_Tumor', tex: '\\Omega_{\\text{Tumor}}', definition: 'Tumor epithelium compartment' },
      { symbol: 'Ω_Stroma', tex: '\\Omega_{\\text{Stroma}}', definition: 'Stromal compartment' },
      { symbol: 'Ω_Front', tex: '\\Omega_{\\text{Front}}', definition: 'Invasive front zone (within distance d of tumor-stroma boundary)' },
      { symbol: 'Ω_desert', tex: '\\Omega_{\\text{desert}}', definition: 'Tumor subregion devoid of immune cells' },
    ],
  },
  {
    label: 'Operators',
    entries: [
      { symbol: 'A(·)', tex: 'A(\\cdot)', definition: 'Area (mm\u00B2)' },
      { symbol: 'L(·)', tex: 'L(\\cdot)', definition: 'Boundary length (mm)' },
      { symbol: 'N', tex: 'N_{\\text{type}}^{\\text{comp}}', definition: 'Cell count of a given type within a compartment' },
      { symbol: 'ρ', tex: '\\rho_{\\text{type}}^{\\text{comp}}', definition: 'Cell density = N / A (cells/mm\u00B2)' },
    ],
  },
  {
    label: 'Boundaries',
    entries: [
      { symbol: '∂_Tumor', tex: '\\partial_{\\text{Tumor}}', definition: 'Full tumor boundary' },
      { symbol: '∂_T-S', tex: '\\partial_{\\text{T-S}}', definition: 'Tumor-stroma interface' },
    ],
  },
  {
    label: 'Statistics & morphology',
    entries: [
      { symbol: 'CV(·)', tex: '\\operatorname{CV}(\\cdot)', definition: 'Coefficient of variation = \u03C3 / \u03BC' },
      { symbol: 'd_NN', tex: 'd_{\\text{NN}}^{a \\to b}', definition: 'Nearest-neighbor distance from cell type a to cell type b' },
      { symbol: 'C_max', tex: 'C_{\\max}', definition: 'Largest connected component of the tumor mask' },
      { symbol: 'A_nuc', tex: 'A_{\\text{nuc}}', definition: 'Nuclear area of a tumor cell (\u03BCm\u00B2)' },
      { symbol: 'e_nuc', tex: 'e_{\\text{nuc}}', definition: 'Nuclear eccentricity \u2208 [0, 1] (0 = circle, 1 = line)' },
      { symbol: 'P_nuc / P_ell', tex: 'P_{\\text{nuc}},\\; P_{\\text{ell}}', definition: 'Perimeter of nucleus / its best-fit ellipse' },
    ],
  },
];

const FEATURES: GlossaryFeature[] = [
  // ── A · Tissue Composition ──────────────────────────────────────────
  {
    id: 1,
    name: 'tumor_area_fraction',
    displayName: 'Tumor area fraction',
    section: 'A · Tissue Composition',
    unit: 'fraction',
    formula: '\\frac{A(\\Omega_{\\text{Tumor}})}{A(\\Omega)}',
    description: 'Fraction of tissue area occupied by tumor epithelium.',
    optional: false,
  },
  {
    id: 2,
    name: 'stroma_area_fraction',
    displayName: 'Stroma area fraction',
    section: 'A · Tissue Composition',
    unit: 'fraction',
    formula: '\\frac{A(\\Omega_{\\text{Stroma}})}{A(\\Omega)}',
    description: 'Fraction of tissue area occupied by stroma.',
    optional: false,
  },
  // ── B · Topology ────────────────────────────────────────────────────
  {
    id: 3,
    name: 'largest_tumor_component_share',
    displayName: 'Largest tumor component share',
    section: 'B · Topology',
    unit: 'fraction',
    formula: '\\frac{A(C_{\\max})}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Fraction of total tumor area contained in the largest connected component.',
    optional: false,
  },
  {
    id: 4,
    name: 'tumor_region_solidity',
    displayName: 'Tumor region solidity',
    section: 'B · Topology',
    unit: 'ratio',
    formula: '\\frac{A(\\Omega_{\\text{Tumor}})}{A\\bigl(\\operatorname{ConvexHull}(\\Omega_{\\text{Tumor}})\\bigr)}',
    description: 'Solidity of the tumor region (area / convex hull area), measuring compactness.',
    optional: false,
  },
  {
    id: 5,
    name: 'tumor_stroma_interface_density',
    displayName: 'Tumor-stroma interface density',
    section: 'B · Topology',
    unit: 'mm/mm²',
    formula: '\\frac{L(\\partial_{\\text{T-S}})}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Length of tumor-stroma boundary per unit tumor area.',
    optional: false,
  },
  {
    id: 6,
    name: 'tumor_front_fraction',
    displayName: 'Tumor front fraction',
    section: 'B · Topology',
    unit: 'fraction',
    formula: '\\frac{A(\\Omega_{\\text{Front}})}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Fraction of tumor area within the invasive front zone.',
    optional: false,
  },

  // ── C · Boundary Contacts ───────────────────────────────────────────
  {
    id: 7,
    name: 'tumor_contact_fraction_stroma',
    displayName: 'Tumor-stroma contact fraction',
    section: 'C · Boundary Contacts',
    unit: 'fraction',
    formula: '\\frac{L(\\partial_{\\text{T-S}})}{L(\\partial_{\\text{Tumor}})}',
    description: 'Fraction of tumor boundary in contact with stroma.',
    optional: false,
  },
  // ── D · Absolute Densities ──────────────────────────────────────────
  {
    id: 8,
    name: 'intratumoral_cancer_cell_density',
    displayName: 'Intratumoral cancer cell density',
    section: 'D · Absolute Densities',
    unit: 'cells/mm²',
    formula: '\\frac{N_{\\text{cancer}}}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Density of cancer cells within the tumor epithelium.',
    optional: false,
  },
  {
    id: 9,
    name: 'intratumoral_lymphocyte_density',
    displayName: 'Intratumoral lymphocyte density',
    section: 'D · Absolute Densities',
    unit: 'cells/mm²',
    formula: '\\frac{N_{\\text{lymph}}^{\\text{IT}}}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Density of lymphocytes within the tumor epithelium.',
    optional: false,
  },
  {
    id: 10,
    name: 'stromal_lymphocyte_density',
    displayName: 'Stromal lymphocyte density',
    section: 'D · Absolute Densities',
    unit: 'cells/mm²',
    formula: '\\frac{N_{\\text{lymph}}^{\\text{S}}}{A(\\Omega_{\\text{Stroma}})}',
    description: 'Density of lymphocytes within the stromal compartment.',
    optional: false,
  },
  {
    id: 11,
    name: 'intratumoral_neutrophil_density',
    displayName: 'Intratumoral neutrophil density',
    section: 'D · Absolute Densities',
    unit: 'cells/mm²',
    formula: '\\frac{N_{\\text{neutro}}^{\\text{IT}}}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Density of neutrophils within the tumor epithelium.',
    optional: false,
  },
  {
    id: 12,
    name: 'intratumoral_eosinophil_density',
    displayName: 'Intratumoral eosinophil density',
    section: 'D · Absolute Densities',
    unit: 'cells/mm²',
    formula: '\\frac{N_{\\text{eosino}}^{\\text{IT}}}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Density of eosinophils within the tumor epithelium.',
    optional: false,
  },
  {
    id: 13,
    name: 'fibroblast_density_stroma',
    displayName: 'Stromal fibroblast density',
    section: 'D · Absolute Densities',
    unit: 'cells/mm²',
    formula: '\\frac{N_{\\text{fibro}}^{\\text{S}}}{A(\\Omega_{\\text{Stroma}})}',
    description: 'Density of fibroblasts within the stromal compartment.',
    optional: false,
  },

  // ── E · Immune Geography ────────────────────────────────────────────
  {
    id: 14,
    name: 'lymphocyte_infiltration_ratio_front',
    displayName: 'Lymphocyte infiltration ratio (front)',
    section: 'E · Immune Geography',
    unit: 'ratio',
    formula: '\\frac{\\rho_{\\text{lymph}}^{\\text{IT,front}}}{\\rho_{\\text{lymph}}^{\\text{S,front}}}',
    description: 'Ratio of intratumoral to stromal lymphocyte density at the invasive front.',
    optional: false,
  },
  {
    id: 15,
    name: 'myeloid_infiltration_ratio_front',
    displayName: 'Myeloid infiltration ratio (front)',
    section: 'E · Immune Geography',
    unit: 'ratio',
    formula: '\\frac{\\rho_{\\text{myeloid}}^{\\text{IT,front}}}{\\rho_{\\text{myeloid}}^{\\text{S,front}}}',
    description: 'Ratio of intratumoral to stromal myeloid cell density at the invasive front.',
    optional: false,
  },
  {
    id: 16,
    name: 'deep_intratumoral_lymphocyte_fraction',
    displayName: 'Deep intratumoral lymphocyte fraction',
    section: 'E · Immune Geography',
    unit: 'fraction',
    formula: '\\frac{N_{\\text{lymph}}^{\\text{deep}}}{N_{\\text{lymph}}^{\\text{IT}}}',
    description: 'Fraction of intratumoral lymphocytes located in the deep tumor core (away from front).',
    optional: false,
  },
  {
    id: 17,
    name: 'peritumoral_immune_richness',
    displayName: 'Peritumoral immune richness',
    section: 'E · Immune Geography',
    unit: 'score',
    formula: 'H = -\\sum_{c} p_c \\,\\ln p_c',
    description: 'Shannon entropy of immune cell types in the peritumoral zone, where p_c is the proportion of immune cell type c.',
    optional: false,
  },
  {
    id: 18,
    name: 'immune_desert_fraction',
    displayName: 'Immune desert fraction',
    section: 'E · Immune Geography',
    unit: 'fraction',
    formula: '\\frac{A(\\Omega_{\\text{desert}})}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Fraction of tumor area devoid of immune cells.',
    optional: false,
  },
  {
    id: 19,
    name: 'intratumoral_myeloid_lymphoid_tilt',
    displayName: 'Intratumoral myeloid-lymphoid tilt',
    section: 'E · Immune Geography',
    unit: 'ratio',
    formula: '\\frac{N_{\\text{myeloid}}^{\\text{IT}}}{N_{\\text{lymphoid}}^{\\text{IT}}}',
    description: 'Ratio of myeloid to lymphoid cells within the tumor, indicating innate vs adaptive immune balance.',
    optional: false,
  },
  {
    id: 20,
    name: 'interface_normalized_immune_pressure',
    displayName: 'Interface-normalized immune pressure',
    section: 'E · Immune Geography',
    unit: 'cells/mm',
    formula: '\\frac{N_{\\text{immune}}^{\\partial}}{L(\\partial_{\\text{T-S}})}',
    description: 'Immune cell count at the tumor-stroma interface normalized by interface length.',
    optional: false,
  },

  // ── F · Invasion ────────────────────────────────────────────────────
  {
    id: 21,
    name: 'invasion_depth_p75',
    displayName: 'Invasion depth (75th percentile)',
    section: 'F · Invasion',
    unit: 'mm',
    formula: 'P_{75}(d_{\\text{invasion}})',
    description: '75th percentile of tumor invasion depth, where d_invasion is the distance from each tumor pixel to the nearest tissue boundary.',
    optional: false,
  },
  {
    id: 22,
    name: 'tumor_fibroblast_coupling_front',
    displayName: 'Tumor-fibroblast coupling at front',
    section: 'F · Invasion',
    unit: 'score',
    formula: '\\hat{K}_{\\text{T-F}}^{\\text{front}}(r)',
    description: 'Normalized bivariate Ripley\u2019s K measuring co-localization of tumor cells and fibroblasts at the invasive front, where r is the evaluation radius.',
    optional: false,
  },

  // ── G · Stromal Features ────────────────────────────────────────────
  {
    id: 23,
    name: 'peritumoral_fibroblast_enrichment',
    displayName: 'Peritumoral fibroblast enrichment',
    section: 'G · Stromal Features',
    unit: 'ratio',
    formula: '\\frac{\\rho_{\\text{fibro}}^{\\text{peri}}}{\\rho_{\\text{fibro}}^{\\text{distal}}}',
    description: 'Ratio of fibroblast density in peritumoral stroma vs distal stroma.',
    optional: false,
  },
  {
    id: 24,
    name: 'stromal_inflammatory_tilt',
    displayName: 'Stromal inflammatory tilt',
    section: 'G · Stromal Features',
    unit: 'ratio',
    formula: '\\frac{N_{\\text{immune}}^{\\text{S}}}{N_{\\text{fibro}}^{\\text{S}}}',
    description: 'Ratio of immune cells to fibroblasts in the stromal compartment.',
    optional: false,
  },
  {
    id: 25,
    name: 'fibroblast_lymphocyte_proximity_stroma',
    displayName: 'Fibroblast-lymphocyte proximity (stroma)',
    section: 'G · Stromal Features',
    unit: 'μm',
    formula: '\\operatorname{median}(d_{\\text{NN}}^{\\text{fibro} \\to \\text{lymph}})',
    description: 'Median nearest-neighbor distance between fibroblasts and lymphocytes in stroma.',
    optional: false,
  },

  // ── H · Granulocyte Ratio ──────────────────────────────────────────
  {
    id: 26,
    name: 'eosinophil_neutrophil_ratio_peritumoral',
    displayName: 'Eosinophil-neutrophil ratio (peritumoral)',
    section: 'H · Granulocyte Ratio',
    unit: 'ratio',
    formula: '\\frac{N_{\\text{eosino}}^{\\text{peri}}}{N_{\\text{neutro}}^{\\text{peri}}}',
    description: 'Ratio of eosinophils to neutrophils in the peritumoral zone.',
    optional: false,
  },

  // ── J · Kinetics ────────────────────────────────────────────────────
  {
    id: 27,
    name: 'mitotic_index_tumor',
    displayName: 'Mitotic index (tumor)',
    section: 'J · Kinetics',
    unit: 'mitoses/mm²',
    formula: '\\frac{N_{\\text{mitoses}}}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Density of mitotic figures within the tumor epithelium.',
    optional: true,
  },
  {
    id: 28,
    name: 'apoptotic_index_tumor',
    displayName: 'Apoptotic index (tumor)',
    section: 'J · Kinetics',
    unit: 'apoptoses/mm²',
    formula: '\\frac{N_{\\text{apoptoses}}}{A(\\Omega_{\\text{Tumor}})}',
    description: 'Density of apoptotic cells within the tumor epithelium.',
    optional: true,
  },
  {
    id: 29,
    name: 'apoptosis_mitosis_ratio_tumor',
    displayName: 'Apoptosis-mitosis ratio (tumor)',
    section: 'J · Kinetics',
    unit: 'ratio',
    formula: '\\frac{N_{\\text{apoptoses}}}{N_{\\text{mitoses}}}',
    description: 'Ratio of apoptotic to mitotic events in the tumor, indicating growth dynamics.',
    optional: false,
  },

  // ── K · Heterogeneity ──────────────────────────────────────────────
  {
    id: 30,
    name: 'tumor_cell_density_heterogeneity',
    displayName: 'Tumor cell density heterogeneity',
    section: 'K · Heterogeneity',
    unit: 'CV',
    formula: '\\operatorname{CV}(\\rho_{\\text{cancer}}^{\\text{tile}})',
    description: 'Coefficient of variation of tumor cell density across spatial tiles.',
    optional: false,
  },
  {
    id: 31,
    name: 'lymphocyte_density_heterogeneity_tumor',
    displayName: 'Lymphocyte density heterogeneity (tumor)',
    section: 'K · Heterogeneity',
    unit: 'CV',
    formula: '\\operatorname{CV}(\\rho_{\\text{lymph}}^{\\text{tile,IT}})',
    description: 'Coefficient of variation of lymphocyte density across tumor tiles.',
    optional: false,
  },
  {
    id: 32,
    name: 'stromal_cellularity_heterogeneity',
    displayName: 'Stromal cellularity heterogeneity',
    section: 'K · Heterogeneity',
    unit: 'CV',
    formula: '\\operatorname{CV}(\\rho_{\\text{total}}^{\\text{tile,S}})',
    description: 'Coefficient of variation of total cell density across stromal tiles.',
    optional: false,
  },

  // ── L · Nearest-Neighbor Distance ──────────────────────────────────
  {
    id: 33,
    name: 'tumor_lymphocyte_nn_distance_front',
    displayName: 'Tumor-lymphocyte NN distance (front)',
    section: 'L · Nearest-Neighbor Distance',
    unit: 'μm',
    formula: '\\operatorname{median}(d_{\\text{NN}}^{\\text{tumor} \\to \\text{lymph, front}})',
    description: 'Median nearest-neighbor distance from tumor cells to lymphocytes at the invasive front.',
    optional: false,
  },

  // ── M · Nuclear Morphology ─────────────────────────────────────────
  {
    id: 34,
    name: 'tumor_nuclear_area_median',
    displayName: 'Tumor nuclear area (median)',
    section: 'M · Nuclear Morphology',
    unit: 'μm²',
    formula: '\\operatorname{median}(A_{\\text{nuc}})',
    description: 'Median nuclear area of tumor cells.',
    optional: false,
  },
  {
    id: 35,
    name: 'tumor_pleomorphism_index',
    displayName: 'Tumor pleomorphism index',
    section: 'M · Nuclear Morphology',
    unit: 'CV',
    formula: '\\operatorname{CV}(A_{\\text{nuc}})',
    description: 'Coefficient of variation of tumor nuclear area, indicating nuclear size heterogeneity.',
    optional: false,
  },
  {
    id: 36,
    name: 'tumor_nuclear_eccentricity_median',
    displayName: 'Tumor nuclear eccentricity (median)',
    section: 'M · Nuclear Morphology',
    unit: 'ratio',
    formula: '\\operatorname{median}(e_{\\text{nuc}})',
    description: 'Median eccentricity of tumor nuclei (0 = circle, 1 = line).',
    optional: false,
  },
  {
    id: 37,
    name: 'tumor_nuclear_irregularity_median',
    displayName: 'Tumor nuclear irregularity (median)',
    section: 'M · Nuclear Morphology',
    unit: 'score',
    formula: '\\operatorname{median}\\!\\biggl(\\frac{P_{\\text{nuc}}}{P_{\\text{ell}}}\\biggr)',
    description: 'Median ratio of nuclear perimeter to best-fit ellipse perimeter, measuring contour irregularity.',
    optional: false,
  },
  {
    id: 38,
    name: 'tumor_nuclear_irregularity_iqr',
    displayName: 'Tumor nuclear irregularity (IQR)',
    section: 'M · Nuclear Morphology',
    unit: 'score',
    formula: '\\operatorname{IQR}\\!\\biggl(\\frac{P_{\\text{nuc}}}{P_{\\text{ell}}}\\biggr)',
    description: 'Interquartile range of nuclear contour irregularity, measuring irregularity variability.',
    optional: false,
  },
];

/** Features grouped by section, preserving order. */
export const GLOSSARY_SECTIONS: GlossarySection[] = (() => {
  const sectionMap = new Map<string, GlossaryFeature[]>();
  for (const f of FEATURES) {
    const existing = sectionMap.get(f.section);
    if (existing) {
      existing.push(f);
    } else {
      sectionMap.set(f.section, [f]);
    }
  }
  return Array.from(sectionMap.entries()).map(([label, features]) => ({
    key: label.split(' · ')[0],
    label,
    features,
  }));
})();

/** Flat list of all features for search. */
export const ALL_FEATURES = FEATURES;
