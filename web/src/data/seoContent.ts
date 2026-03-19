/**
 * SEO content for Tier 1 histomics features with proven search demand.
 *
 * Each entry provides optimized titles, meta descriptions, educational intros,
 * and FAQs for features targeted in Sprint 1 SEO optimization.
 */

type Tier1SeoContent = {
  searchKeyword: string;
  pancanTitle: string;
  perCancerTitle: (cancer: string) => string;
  pancanMetaDescription: string;
  perCancerMetaDescription: (cancer: string) => string;
  educationalIntro: string;
  faqs: { question: string; answer: string }[];
  relatedFeatures: string[];
};

export const TIER1_SEO_CONTENT: Record<string, Tier1SeoContent> = {
  mitotic_index_tumor: {
    searchKeyword: 'Mitotic Index',
    pancanTitle:
      'Mitotic Index in Cancer: Survival Impact & Cross-Cancer Data | HistoAtlas',
    perCancerTitle: (cancer: string) =>
      `Mitotic Index in ${cancer}: Survival & Molecular Associations | HistoAtlas`,
    pancanMetaDescription:
      'What is mitotic index? Explore survival impact, molecular correlations, and mutation associations across 33 cancer types. Data from 11,000+ TCGA slides.',
    perCancerMetaDescription: (cancer: string) =>
      `Mitotic index in ${cancer}: survival curves, molecular correlations & mutation data from TCGA. Free research platform.`,
    educationalIntro: `
      <p>
        The <strong>mitotic index</strong> measures how rapidly tumor cells are dividing. It is defined as the
        number of cells undergoing mitosis (cell division) relative to the total number of tumor cells observed.
        A high mitotic index indicates aggressive tumor growth, while a low value suggests slower proliferation.
      </p>
      <p>
        In traditional pathology, the mitotic index is counted as the number of mitotic figures per 10
        high-power fields (HPF). HistoAtlas computes a normalized variant: <strong>mitoses per 1,000 tumor
        cells</strong>, calculated as:
      </p>
      <p class="formula-block"><span data-tex="\\text{Mitotic Index} = \\frac{N_{\\text{mitoses}}}{N_{\\text{tumor cells}}} \\times 1{,}000"></span></p>
      <p>
        Normalizing by tumor cell count rather than area reduces dependence on sample size and tumor fraction,
        making values comparable across slides, centers, and cancer types.
      </p>
      <p>
        Mitotic index is a key component of several clinical grading systems. In <strong>breast cancer</strong>,
        it is one of three elements of the Nottingham histological grade (along with tubule formation and nuclear
        pleomorphism). In <strong>gastrointestinal stromal tumors (GISTs)</strong>, mitotic count directly
        determines risk stratification. High mitotic activity is also prognostic in melanoma, soft tissue sarcomas,
        and neuroendocrine tumors.
      </p>
      <p>
        Manual mitotic counting is labor-intensive and suffers from inter-observer variability. HistoAtlas uses
        deep learning to detect mitotic figures computationally from standard H&amp;E-stained whole slide images
        across all 33 TCGA cancer types — enabling consistent, reproducible quantification at a scale no manual
        approach can achieve. Explore below how mitotic index associates with patient survival, molecular
        subtypes, and driver mutations across cancers.
      </p>
    `,
    faqs: [
      {
        question: 'What is mitotic index?',
        answer:
          'Mitotic index is a measure of cell proliferation that counts the number of cells undergoing mitosis (cell division) in a tumor sample. It reflects how fast a tumor is growing and is used as a prognostic marker in many cancer types.',
      },
      {
        question: 'How do you calculate mitotic index?',
        answer:
          'Traditionally, mitotic index is calculated by counting mitotic figures per 10 high-power fields (HPF) under a microscope. HistoAtlas uses a normalized formula: (number of mitotic figures in tumor ÷ number of tumor cells) × 1,000, which makes values comparable across different slides and cancer types.',
      },
      {
        question: 'How is mitotic index used in cancer grading?',
        answer:
          'Mitotic index is a component of the Nottingham grading system for breast cancer, risk stratification for GISTs (gastrointestinal stromal tumors), and prognostic scoring in melanoma, sarcomas, and neuroendocrine tumors. Higher mitotic index generally indicates more aggressive disease.',
      },
      {
        question: 'What is the mitotic index formula?',
        answer:
          'The HistoAtlas mitotic index formula is: MI = (N_mitoses / N_tumor_cells) × 1,000, where N_mitoses is the number of detected mitotic figures within the tumor epithelium and N_tumor_cells is the total count of tumor cells. This normalization reduces variability from sample size differences.',
      },
    ],
    relatedFeatures: [
      'apoptotic_index_tumor',
      'apoptosis_mitosis_ratio_tumor',
      'intratumoral_cancer_cell_density',
    ],
  },

  tumor_pleomorphism_index: {
    searchKeyword: 'Nuclear Pleomorphism',
    pancanTitle:
      'Nuclear Pleomorphism in Cancer: Survival Impact & Cross-Cancer Data | HistoAtlas',
    perCancerTitle: (cancer: string) =>
      `Nuclear Pleomorphism in ${cancer}: Survival & Molecular Associations | HistoAtlas`,
    pancanMetaDescription:
      'What is nuclear pleomorphism? Survival impact, molecular correlations, and cross-cancer comparisons across 33 cancer types from 11,000+ TCGA slides.',
    perCancerMetaDescription: (cancer: string) =>
      `Nuclear pleomorphism in ${cancer}: survival curves, molecular correlations & mutation data from TCGA. Free research platform.`,
    educationalIntro: `
      <p>
        <strong>Nuclear pleomorphism</strong> refers to variability in the size and shape of tumor cell nuclei.
        When tumor cells display a wide range of nuclear sizes — from small, uniform nuclei to large, irregular
        ones — the tumor is described as pleomorphic. Nuclear pleomorphism is one of the most important
        histological features assessed by pathologists when grading cancers.
      </p>
      <p>
        In breast cancer, nuclear pleomorphism is scored on a 1–3 scale as part of the <strong>Nottingham
        histological grade</strong>: <strong>Score 1</strong> (mild) — nuclei are small and uniform with
        minimal variation; <strong>Score 2</strong> (moderate) — nuclei show moderate size variation with
        visible nucleoli; <strong>Score 3</strong> (marked) — nuclei vary dramatically in size and shape with
        prominent nucleoli and frequent irregular contours.
      </p>
      <p>
        Traditional pleomorphism scoring is categorical (1/2/3) and subjective, leading to significant
        inter-observer variability. HistoAtlas bridges this gap by computing a <strong>continuous pleomorphism
        index</strong> — the coefficient of variation (CV) of tumor nuclear area. This captures the same
        biological signal (nuclear size heterogeneity) as a precise, reproducible number:
      </p>
      <p class="formula-block"><span data-tex="\\text{Pleomorphism Index} = \\frac{\\operatorname{IQR}(A_{\\text{nuc}})}{\\operatorname{median}(A_{\\text{nuc}}) + \\varepsilon}"></span></p>
      <p>
        where <span data-tex="A_{\\text{nuc}}"></span> is the nuclear area of each tumor cell. Normalizing by
        the median reduces correlation with absolute nuclear size, making the metric interpretable as
        "relative pleomorphism" that is comparable across cancer types.
      </p>
    `,
    faqs: [
      {
        question: 'What is nuclear pleomorphism?',
        answer:
          'Nuclear pleomorphism is the variation in size and shape of cell nuclei within a tumor. Greater variation (more pleomorphism) generally indicates a higher-grade, more aggressive cancer. It is one of three components of the Nottingham histological grading system for breast cancer.',
      },
      {
        question: 'What does nuclear pleomorphism score 2 mean?',
        answer:
          'A nuclear pleomorphism score of 2 (moderate) means the tumor nuclei show moderate variation in size — they are larger than normal cells, may have visible nucleoli, but the variation is not extreme. In the Nottingham system, score 2 is intermediate between well-differentiated (score 1) and poorly-differentiated (score 3) tumors.',
      },
      {
        question: 'What does nuclear pleomorphism score 3 mean?',
        answer:
          'A nuclear pleomorphism score of 3 (marked) indicates dramatic variation in nuclear size and shape, with very large nuclei, prominent nucleoli, and irregular contours. Score 3 is associated with poorly differentiated, aggressive tumors and contributes to a higher Nottingham grade.',
      },
    ],
    relatedFeatures: [
      'tumor_nuclear_area_median',
      'tumor_nuclear_eccentricity_median',
      'tumor_nuclear_irregularity_median',
    ],
  },

  intratumoral_lymphocyte_density: {
    searchKeyword: 'Tumor Infiltrating Lymphocytes',
    pancanTitle:
      'Tumor Infiltrating Lymphocytes (TILs) in Cancer: Survival Impact & Cross-Cancer Data | HistoAtlas',
    perCancerTitle: (cancer: string) =>
      `Tumor Infiltrating Lymphocytes in ${cancer}: Survival & Molecular Associations | HistoAtlas`,
    pancanMetaDescription:
      'What are tumor infiltrating lymphocytes (TILs)? Explore TIL density, survival impact, and molecular correlations across 33 TCGA cancer types.',
    perCancerMetaDescription: (cancer: string) =>
      `TIL density in ${cancer}: survival curves, molecular correlations & mutation data from TCGA. Free research platform.`,
    educationalIntro: `
      <p>
        <strong>Tumor infiltrating lymphocytes (TILs)</strong> are immune cells — primarily T cells and
        B cells — that have migrated from the bloodstream into the tumor tissue. Their presence indicates
        that the immune system has recognized the tumor and is mounting a response. TIL density is one of
        the strongest prognostic biomarkers across multiple cancer types.
      </p>
      <p>
        In clinical practice, TILs are scored visually on H&amp;E-stained slides, typically as a percentage
        of the stromal area occupied by lymphocytes. The International TILs Working Group classifies TIL
        levels as: <strong>absent</strong> (no lymphocytes), <strong>non-brisk</strong> (focal or patchy
        lymphocytic infiltrate), and <strong>brisk</strong> (dense, diffuse lymphocytic infiltrate throughout
        the tumor). Brisk TIL infiltration is associated with better prognosis in breast cancer, melanoma,
        and colorectal cancer.
      </p>
      <p>
        An important distinction is <em>where</em> the lymphocytes are located. <strong>Intratumoral
        TILs</strong> are lymphocytes that have penetrated into the tumor epithelium itself — they are in
        direct contact with cancer cells. <strong>Stromal TILs</strong> are found in the surrounding stroma
        but have not crossed into the tumor nests. HistoAtlas measures both compartments separately:
        intratumoral lymphocyte density (this feature) and
        <a href="/tcga/PANCAN/histomics/stromal_lymphocyte_density/">stromal lymphocyte density</a>.
      </p>
      <p>
        HistoAtlas measures intratumoral lymphocyte density as <strong>cells per mm²</strong> — a continuous,
        quantitative measurement computed by deep learning cell detection across the entire tumor area. This
        overcomes the limitations of traditional categorical scoring (absent/non-brisk/brisk), which suffers
        from inter-observer variability and loses granular information. The formula is:
      </p>
      <p class="formula-block"><span data-tex="\\text{Density} = \\frac{N_{\\text{lymph}}^{\\text{IT}}}{A(\\Omega_{\\text{Tumor}})}"></span></p>
      <p>
        where <span data-tex="N_{\\text{lymph}}^{\\text{IT}}"></span> is the count of lymphocytes within the
        tumor epithelium and <span data-tex="A(\\Omega_{\\text{Tumor}})"></span> is the tumor area in mm².
      </p>
    `,
    faqs: [
      {
        question: 'What are tumor infiltrating lymphocytes?',
        answer:
          'Tumor infiltrating lymphocytes (TILs) are immune cells — mainly T cells and B cells — that have migrated from the blood into the tumor. Their presence indicates an active immune response against the cancer. Higher TIL levels are associated with better outcomes in many cancer types including breast, colorectal, and melanoma.',
      },
      {
        question: 'What does tumor infiltrating lymphocytes brisk mean?',
        answer:
          'Brisk TIL infiltration means there is a dense, diffuse lymphocytic infiltrate throughout the tumor. This is the highest category of TIL scoring and is associated with a strong anti-tumor immune response and generally better prognosis, particularly in melanoma and triple-negative breast cancer.',
      },
      {
        question:
          'What is the difference between intratumoral and stromal TILs?',
        answer:
          'Intratumoral TILs are lymphocytes that have penetrated into the tumor epithelium and are in direct contact with cancer cells. Stromal TILs are in the surrounding connective tissue but have not crossed into the tumor nests. Both are clinically relevant, but intratumoral TILs may reflect more direct immune engagement with the tumor.',
      },
    ],
    relatedFeatures: [
      'stromal_lymphocyte_density',
      'immune_desert_fraction',
      'deep_intratumoral_lymphocyte_fraction',
    ],
  },

  fibroblast_density_stroma: {
    searchKeyword: 'Cancer Associated Fibroblasts',
    pancanTitle:
      'Cancer Associated Fibroblasts (CAFs) in Cancer: Survival Impact & Cross-Cancer Data | HistoAtlas',
    perCancerTitle: (cancer: string) =>
      `Cancer Associated Fibroblasts in ${cancer}: Survival & Molecular Associations | HistoAtlas`,
    pancanMetaDescription:
      'What are cancer associated fibroblasts (CAFs)? Explore CAF density, survival impact, and molecular correlations across 33 TCGA cancer types.',
    perCancerMetaDescription: (cancer: string) =>
      `CAF density in ${cancer}: survival curves, molecular correlations & mutation data from TCGA. Free research platform.`,
    educationalIntro: `
      <p>
        <strong>Cancer associated fibroblasts (CAFs)</strong> are activated fibroblasts found in the tumor
        stroma — the connective tissue surrounding cancer cells. Unlike normal quiescent fibroblasts, CAFs
        are reprogrammed by tumor-derived signals to support cancer growth through multiple mechanisms:
        extracellular matrix (ECM) remodeling, secretion of growth factors, immune modulation, and promotion
        of angiogenesis.
      </p>
      <p>
        CAFs are central players in the <strong>desmoplastic reaction</strong> — the dense fibrotic stroma
        that characterizes many solid tumors, particularly pancreatic, breast, and colorectal cancers. They
        deposit and cross-link collagen, creating a stiff extracellular matrix that can physically exclude
        immune cells from the tumor (immune exclusion) and impede drug delivery. CAFs also secrete
        cytokines like TGF-β and IL-6 that promote epithelial-to-mesenchymal transition (EMT) and
        tumor cell invasion.
      </p>
      <p>
        HistoAtlas measures <strong>stromal fibroblast density</strong> as the number of fibroblasts per mm²
        of stromal area:
      </p>
      <p class="formula-block"><span data-tex="\\text{Density} = \\frac{N_{\\text{fibro}}^{\\text{S}}}{A(\\Omega_{\\text{Stroma}})}"></span></p>
      <p>
        This cell-level quantification from H&amp;E captures stromal cellularity in an interpretable, continuous
        metric across all 33 TCGA cancer types.
      </p>
      <p>
        Fibroblast density captures overall stromal cellularity, but the spatial distribution of fibroblasts
        also matters. HistoAtlas measures <a href="/tcga/PANCAN/histomics/peritumoral_fibroblast_enrichment/">
        peritumoral fibroblast enrichment</a> (whether fibroblasts concentrate near the tumor boundary) and
        <a href="/tcga/PANCAN/histomics/fibroblast_lymphocyte_proximity_stroma/">fibroblast-lymphocyte proximity</a>
        (spatial relationship between fibroblasts and immune cells). Together, these features characterize the
        stromal compartment across cancers.
      </p>
    `,
    faqs: [
      {
        question: 'What are cancer associated fibroblasts?',
        answer:
          'Cancer associated fibroblasts (CAFs) are activated fibroblasts in the tumor stroma that have been reprogrammed by cancer cells to support tumor growth. They remodel the extracellular matrix, secrete growth factors, modulate the immune response, and promote angiogenesis — making them key players in the tumor microenvironment.',
      },
      {
        question: 'What role do CAFs play in tumor progression?',
        answer:
          'CAFs promote tumor progression through multiple mechanisms: they deposit dense collagen (desmoplastic reaction), create physical barriers to immune cell infiltration, secrete pro-tumorigenic cytokines (TGF-β, IL-6), promote epithelial-to-mesenchymal transition (EMT), and support angiogenesis. High CAF density is associated with poor prognosis in many cancer types.',
      },
    ],
    relatedFeatures: [
      'peritumoral_fibroblast_enrichment',
      'fibroblast_lymphocyte_proximity_stroma',
      'stromal_inflammatory_tilt',
    ],
  },
};

/** Check if a feature name is Tier 1 */
export function isTier1Feature(featureName: string): boolean {
  return featureName in TIER1_SEO_CONTENT;
}

/** Maps each Tier 2 feature to its biologically closest Tier 1 hub. */
export const TIER2_TO_TIER1_HUB: Record<string, string> = {
  // A · Tissue Composition → CAFs
  tumor_area_fraction: 'fibroblast_density_stroma',
  stroma_area_fraction: 'fibroblast_density_stroma',
  // B · Topology → CAFs
  largest_tumor_component_share: 'fibroblast_density_stroma',
  tumor_region_solidity: 'fibroblast_density_stroma',
  tumor_stroma_interface_density: 'fibroblast_density_stroma',
  tumor_front_fraction: 'fibroblast_density_stroma',
  // C · Boundary Contacts → CAFs
  tumor_contact_fraction_stroma: 'fibroblast_density_stroma',
  // D · Absolute Densities (cancer cells → Mitotic Index)
  intratumoral_cancer_cell_density: 'mitotic_index_tumor',
  // D · Absolute Densities (immune cells → TILs)
  stromal_lymphocyte_density: 'intratumoral_lymphocyte_density',
  intratumoral_neutrophil_density: 'intratumoral_lymphocyte_density',
  intratumoral_eosinophil_density: 'intratumoral_lymphocyte_density',
  // E · Immune Geography → TILs
  lymphocyte_infiltration_ratio_front: 'intratumoral_lymphocyte_density',
  myeloid_infiltration_ratio_front: 'intratumoral_lymphocyte_density',
  deep_intratumoral_lymphocyte_fraction: 'intratumoral_lymphocyte_density',
  peritumoral_immune_richness: 'intratumoral_lymphocyte_density',
  immune_desert_fraction: 'intratumoral_lymphocyte_density',
  intratumoral_myeloid_lymphoid_tilt: 'intratumoral_lymphocyte_density',
  interface_normalized_immune_pressure: 'intratumoral_lymphocyte_density',
  // F · Invasion → CAFs
  invasion_depth_p75: 'fibroblast_density_stroma',
  tumor_fibroblast_coupling_front: 'fibroblast_density_stroma',
  // G · Stromal Features → CAFs
  peritumoral_fibroblast_enrichment: 'fibroblast_density_stroma',
  stromal_inflammatory_tilt: 'fibroblast_density_stroma',
  fibroblast_lymphocyte_proximity_stroma: 'fibroblast_density_stroma',
  // H · Granulocyte Ratio → TILs
  eosinophil_neutrophil_ratio_peritumoral: 'intratumoral_lymphocyte_density',
  // J · Kinetics → Mitotic Index
  apoptotic_index_tumor: 'mitotic_index_tumor',
  apoptosis_mitosis_ratio_tumor: 'mitotic_index_tumor',
  // K · Heterogeneity (split across hubs)
  tumor_cell_density_heterogeneity: 'mitotic_index_tumor',
  lymphocyte_density_heterogeneity_tumor: 'intratumoral_lymphocyte_density',
  stromal_cellularity_heterogeneity: 'fibroblast_density_stroma',
  // L · Nearest-Neighbor Distance → TILs
  tumor_lymphocyte_nn_distance_front: 'intratumoral_lymphocyte_density',
  // M · Nuclear Morphology → Pleomorphism
  tumor_nuclear_area_median: 'tumor_pleomorphism_index',
  tumor_nuclear_eccentricity_median: 'tumor_pleomorphism_index',
  tumor_nuclear_irregularity_median: 'tumor_pleomorphism_index',
  tumor_nuclear_irregularity_iqr: 'tumor_pleomorphism_index',
};

/** SEO-friendly labels for Tier 1 hub anchor text. */
export const TIER1_HUB_LABEL: Record<string, string> = {
  mitotic_index_tumor: 'Mitotic Index',
  tumor_pleomorphism_index: 'Nuclear Pleomorphism',
  intratumoral_lymphocyte_density: 'Tumor Infiltrating Lymphocytes (TILs)',
  fibroblast_density_stroma: 'Cancer Associated Fibroblasts (CAFs)',
};
