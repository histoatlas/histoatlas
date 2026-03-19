/**
 * Static mapping of TCGA cohort abbreviations to full cancer names.
 *
 * Used server-side in Astro templates where React hooks aren't available.
 * Source: TCGA study abbreviations (https://gdc.cancer.gov/resources-tcga-users/tcga-code-tables/tcga-study-abbreviations)
 */
export const COHORT_FULL_NAMES: Record<string, string> = {
  PANCAN: 'Pan-Cancer',
  ACC: 'Adrenocortical Carcinoma',
  BLCA: 'Bladder Urothelial Carcinoma',
  BRCA: 'Breast Invasive Carcinoma',
  CESC: 'Cervical Squamous Cell Carcinoma',
  CHOL: 'Cholangiocarcinoma',
  COAD: 'Colon Adenocarcinoma',
  DLBC: 'Diffuse Large B-Cell Lymphoma',
  ESCA: 'Esophageal Carcinoma',
  GBM: 'Glioblastoma Multiforme',
  HNSC: 'Head and Neck Squamous Cell Carcinoma',
  KICH: 'Kidney Chromophobe',
  KIRC: 'Kidney Renal Clear Cell Carcinoma',
  KIRP: 'Kidney Renal Papillary Cell Carcinoma',
  LAML: 'Acute Myeloid Leukemia',
  LGG: 'Brain Lower Grade Glioma',
  LIHC: 'Liver Hepatocellular Carcinoma',
  LUAD: 'Lung Adenocarcinoma',
  LUSC: 'Lung Squamous Cell Carcinoma',
  MESO: 'Mesothelioma',
  OV: 'Ovarian Serous Cystadenocarcinoma',
  PAAD: 'Pancreatic Adenocarcinoma',
  PCPG: 'Pheochromocytoma and Paraganglioma',
  PRAD: 'Prostate Adenocarcinoma',
  READ: 'Rectum Adenocarcinoma',
  SARC: 'Sarcoma',
  SKCM: 'Skin Cutaneous Melanoma',
  STAD: 'Stomach Adenocarcinoma',
  TGCT: 'Testicular Germ Cell Tumors',
  THCA: 'Thyroid Carcinoma',
  THYM: 'Thymoma',
  UCEC: 'Uterine Corpus Endometrial Carcinoma',
  UCS: 'Uterine Carcinosarcoma',
  UVM: 'Uveal Melanoma',
  HNSCC: 'Head and Neck Squamous Cell Carcinoma',
};

/**
 * Cohorts that actually exist in the HistoAtlas data.
 * Used to filter out phantom cohorts in SEO sections and internal links.
 */
export const ATLAS_COHORTS = new Set([
  // TCGA
  'ACC', 'BLCA', 'BRCA', 'CESC', 'CHOL', 'COAD', 'ESCA', 'HNSC',
  'LIHC', 'LUAD', 'LUSC', 'MESO', 'OV', 'PAAD', 'PRAD', 'READ',
  'STAD', 'THCA', 'THYM', 'UCEC', 'UCS',
  // CPTAC
  'HNSCC',
]);
