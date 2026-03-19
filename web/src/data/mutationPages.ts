/**
 * Static registry of gene × cancer mutation pages.
 *
 * Pipeline-confirmed frequencies from mutation_frequency data (>= 5%).
 * Literature-based frequencies retained for cancer types not yet in the
 * slide-level pipeline (GBM, LGG, SKCM, SARC).
 * Controls which intersection pages exist, drives sitemap and internal links.
 */

export type MutationPageEntry = {
  geneSlug: string;
  cancerSlug: string;
  tcgaCode: string;
  frequency: number;
};

/**
 * All gene × cancer pairs with mutation frequency >= 5%.
 * Sorted by gene, then by frequency descending.
 */
export const MUTATION_PAGES: MutationPageEntry[] = [
  // TP53 (23 cancer types)
  { geneSlug: 'tp53', cancerSlug: 'ovarian-cancer', tcgaCode: 'OV', frequency: 0.92 },
  { geneSlug: 'tp53', cancerSlug: 'uterine-carcinosarcoma', tcgaCode: 'UCS', frequency: 0.91 },
  { geneSlug: 'tp53', cancerSlug: 'esophageal-cancer', tcgaCode: 'ESCA', frequency: 0.89 },
  { geneSlug: 'tp53', cancerSlug: 'rectal-cancer', tcgaCode: 'READ', frequency: 0.86 },
  { geneSlug: 'tp53', cancerSlug: 'lung-squamous', tcgaCode: 'LUSC', frequency: 0.84 },
  { geneSlug: 'tp53', cancerSlug: 'head-neck-cancer', tcgaCode: 'HNSC', frequency: 0.74 },
  { geneSlug: 'tp53', cancerSlug: 'colorectal', tcgaCode: 'COAD', frequency: 0.61 },
  { geneSlug: 'tp53', cancerSlug: 'pancreatic-cancer', tcgaCode: 'PAAD', frequency: 0.60 },
  { geneSlug: 'tp53', cancerSlug: 'lung-adenocarcinoma', tcgaCode: 'LUAD', frequency: 0.51 },
  { geneSlug: 'tp53', cancerSlug: 'low-grade-glioma', tcgaCode: 'LGG', frequency: 0.50 },
  { geneSlug: 'tp53', cancerSlug: 'bladder-cancer', tcgaCode: 'BLCA', frequency: 0.49 },
  { geneSlug: 'tp53', cancerSlug: 'stomach-cancer', tcgaCode: 'STAD', frequency: 0.48 },
  { geneSlug: 'tp53', cancerSlug: 'endometrial-cancer', tcgaCode: 'UCEC', frequency: 0.38 },
  { geneSlug: 'tp53', cancerSlug: 'breast-cancer', tcgaCode: 'BRCA', frequency: 0.35 },
  { geneSlug: 'tp53', cancerSlug: 'sarcoma', tcgaCode: 'SARC', frequency: 0.32 },
  { geneSlug: 'tp53', cancerSlug: 'liver-cancer', tcgaCode: 'LIHC', frequency: 0.31 },
  { geneSlug: 'tp53', cancerSlug: 'glioblastoma', tcgaCode: 'GBM', frequency: 0.28 },
  { geneSlug: 'tp53', cancerSlug: 'adrenocortical-carcinoma', tcgaCode: 'ACC', frequency: 0.20 },
  { geneSlug: 'tp53', cancerSlug: 'mesothelioma', tcgaCode: 'MESO', frequency: 0.17 },
  { geneSlug: 'tp53', cancerSlug: 'melanoma', tcgaCode: 'SKCM', frequency: 0.15 },
  { geneSlug: 'tp53', cancerSlug: 'prostate-cancer', tcgaCode: 'PRAD', frequency: 0.13 },
  { geneSlug: 'tp53', cancerSlug: 'cholangiocarcinoma', tcgaCode: 'CHOL', frequency: 0.11 },
  { geneSlug: 'tp53', cancerSlug: 'cervical-cancer', tcgaCode: 'CESC', frequency: 0.08 },

  // KRAS (10 cancer types)
  { geneSlug: 'kras', cancerSlug: 'pancreatic-cancer', tcgaCode: 'PAAD', frequency: 0.64 },
  { geneSlug: 'kras', cancerSlug: 'colorectal', tcgaCode: 'COAD', frequency: 0.48 },
  { geneSlug: 'kras', cancerSlug: 'rectal-cancer', tcgaCode: 'READ', frequency: 0.38 },
  { geneSlug: 'kras', cancerSlug: 'lung-adenocarcinoma', tcgaCode: 'LUAD', frequency: 0.30 },
  { geneSlug: 'kras', cancerSlug: 'endometrial-cancer', tcgaCode: 'UCEC', frequency: 0.19 },
  { geneSlug: 'kras', cancerSlug: 'uterine-carcinosarcoma', tcgaCode: 'UCS', frequency: 0.11 },
  { geneSlug: 'kras', cancerSlug: 'stomach-cancer', tcgaCode: 'STAD', frequency: 0.08 },
  { geneSlug: 'kras', cancerSlug: 'thyroid-cancer', tcgaCode: 'THCA', frequency: 0.06 },
  { geneSlug: 'kras', cancerSlug: 'cholangiocarcinoma', tcgaCode: 'CHOL', frequency: 0.06 },
  { geneSlug: 'kras', cancerSlug: 'cervical-cancer', tcgaCode: 'CESC', frequency: 0.05 },

  // PIK3CA (13 cancer types)
  { geneSlug: 'pik3ca', cancerSlug: 'endometrial-cancer', tcgaCode: 'UCEC', frequency: 0.50 },
  { geneSlug: 'pik3ca', cancerSlug: 'uterine-carcinosarcoma', tcgaCode: 'UCS', frequency: 0.36 },
  { geneSlug: 'pik3ca', cancerSlug: 'breast-cancer', tcgaCode: 'BRCA', frequency: 0.35 },
  { geneSlug: 'pik3ca', cancerSlug: 'colorectal', tcgaCode: 'COAD', frequency: 0.31 },
  { geneSlug: 'pik3ca', cancerSlug: 'cervical-cancer', tcgaCode: 'CESC', frequency: 0.28 },
  { geneSlug: 'pik3ca', cancerSlug: 'bladder-cancer', tcgaCode: 'BLCA', frequency: 0.21 },
  { geneSlug: 'pik3ca', cancerSlug: 'head-neck-cancer', tcgaCode: 'HNSC', frequency: 0.17 },
  { geneSlug: 'pik3ca', cancerSlug: 'stomach-cancer', tcgaCode: 'STAD', frequency: 0.16 },
  { geneSlug: 'pik3ca', cancerSlug: 'lung-squamous', tcgaCode: 'LUSC', frequency: 0.12 },
  { geneSlug: 'pik3ca', cancerSlug: 'rectal-cancer', tcgaCode: 'READ', frequency: 0.12 },
  { geneSlug: 'pik3ca', cancerSlug: 'esophageal-cancer', tcgaCode: 'ESCA', frequency: 0.09 },
  { geneSlug: 'pik3ca', cancerSlug: 'lung-adenocarcinoma', tcgaCode: 'LUAD', frequency: 0.06 },
  { geneSlug: 'pik3ca', cancerSlug: 'cholangiocarcinoma', tcgaCode: 'CHOL', frequency: 0.06 },

  // ARID1A (13 cancer types)
  { geneSlug: 'arid1a', cancerSlug: 'endometrial-cancer', tcgaCode: 'UCEC', frequency: 0.44 },
  { geneSlug: 'arid1a', cancerSlug: 'stomach-cancer', tcgaCode: 'STAD', frequency: 0.24 },
  { geneSlug: 'arid1a', cancerSlug: 'bladder-cancer', tcgaCode: 'BLCA', frequency: 0.24 },
  { geneSlug: 'arid1a', cancerSlug: 'colorectal', tcgaCode: 'COAD', frequency: 0.13 },
  { geneSlug: 'arid1a', cancerSlug: 'cholangiocarcinoma', tcgaCode: 'CHOL', frequency: 0.11 },
  { geneSlug: 'arid1a', cancerSlug: 'uterine-carcinosarcoma', tcgaCode: 'UCS', frequency: 0.09 },
  { geneSlug: 'arid1a', cancerSlug: 'liver-cancer', tcgaCode: 'LIHC', frequency: 0.08 },
  { geneSlug: 'arid1a', cancerSlug: 'esophageal-cancer', tcgaCode: 'ESCA', frequency: 0.07 },
  { geneSlug: 'arid1a', cancerSlug: 'ovarian-cancer', tcgaCode: 'OV', frequency: 0.06 },
  { geneSlug: 'arid1a', cancerSlug: 'rectal-cancer', tcgaCode: 'READ', frequency: 0.06 },
  { geneSlug: 'arid1a', cancerSlug: 'cervical-cancer', tcgaCode: 'CESC', frequency: 0.06 },
  { geneSlug: 'arid1a', cancerSlug: 'lung-squamous', tcgaCode: 'LUSC', frequency: 0.06 },
  { geneSlug: 'arid1a', cancerSlug: 'lung-adenocarcinoma', tcgaCode: 'LUAD', frequency: 0.05 },

  // PTEN (12 cancer types)
  { geneSlug: 'pten', cancerSlug: 'endometrial-cancer', tcgaCode: 'UCEC', frequency: 0.67 },
  { geneSlug: 'pten', cancerSlug: 'glioblastoma', tcgaCode: 'GBM', frequency: 0.31 },
  { geneSlug: 'pten', cancerSlug: 'uterine-carcinosarcoma', tcgaCode: 'UCS', frequency: 0.17 },
  { geneSlug: 'pten', cancerSlug: 'prostate-cancer', tcgaCode: 'PRAD', frequency: 0.12 },
  { geneSlug: 'pten', cancerSlug: 'melanoma', tcgaCode: 'SKCM', frequency: 0.12 },
  { geneSlug: 'pten', cancerSlug: 'lung-squamous', tcgaCode: 'LUSC', frequency: 0.11 },
  { geneSlug: 'pten', cancerSlug: 'low-grade-glioma', tcgaCode: 'LGG', frequency: 0.08 },
  { geneSlug: 'pten', cancerSlug: 'cervical-cancer', tcgaCode: 'CESC', frequency: 0.07 },
  { geneSlug: 'pten', cancerSlug: 'colorectal', tcgaCode: 'COAD', frequency: 0.07 },
  { geneSlug: 'pten', cancerSlug: 'stomach-cancer', tcgaCode: 'STAD', frequency: 0.06 },
  { geneSlug: 'pten', cancerSlug: 'rectal-cancer', tcgaCode: 'READ', frequency: 0.06 },
  { geneSlug: 'pten', cancerSlug: 'breast-cancer', tcgaCode: 'BRCA', frequency: 0.06 },

  // BRAF (7 cancer types)
  { geneSlug: 'braf', cancerSlug: 'thyroid-cancer', tcgaCode: 'THCA', frequency: 0.58 },
  { geneSlug: 'braf', cancerSlug: 'melanoma', tcgaCode: 'SKCM', frequency: 0.51 },
  { geneSlug: 'braf', cancerSlug: 'colorectal', tcgaCode: 'COAD', frequency: 0.16 },
  { geneSlug: 'braf', cancerSlug: 'lung-adenocarcinoma', tcgaCode: 'LUAD', frequency: 0.08 },
  { geneSlug: 'braf', cancerSlug: 'low-grade-glioma', tcgaCode: 'LGG', frequency: 0.05 },
  { geneSlug: 'braf', cancerSlug: 'rectal-cancer', tcgaCode: 'READ', frequency: 0.05 },
  { geneSlug: 'braf', cancerSlug: 'stomach-cancer', tcgaCode: 'STAD', frequency: 0.05 },

  // EGFR (5 cancer types)
  { geneSlug: 'egfr', cancerSlug: 'glioblastoma', tcgaCode: 'GBM', frequency: 0.26 },
  { geneSlug: 'egfr', cancerSlug: 'lung-adenocarcinoma', tcgaCode: 'LUAD', frequency: 0.13 },
  { geneSlug: 'egfr', cancerSlug: 'endometrial-cancer', tcgaCode: 'UCEC', frequency: 0.07 },
  { geneSlug: 'egfr', cancerSlug: 'head-neck-cancer', tcgaCode: 'HNSC', frequency: 0.06 },
  { geneSlug: 'egfr', cancerSlug: 'lung-squamous', tcgaCode: 'LUSC', frequency: 0.05 },

  // IDH1 (3 cancer types)
  { geneSlug: 'idh1', cancerSlug: 'low-grade-glioma', tcgaCode: 'LGG', frequency: 0.77 },
  { geneSlug: 'idh1', cancerSlug: 'cholangiocarcinoma', tcgaCode: 'CHOL', frequency: 0.14 },
  { geneSlug: 'idh1', cancerSlug: 'glioblastoma', tcgaCode: 'GBM', frequency: 0.06 },
];

/** Get all intersection pages for a given gene slug */
export function getMutationPagesForGene(geneSlug: string): MutationPageEntry[] {
  return MUTATION_PAGES.filter((p) => p.geneSlug === geneSlug).sort(
    (a, b) => b.frequency - a.frequency,
  );
}

/** Get all intersection pages for a given cancer slug */
export function getMutationPagesForCancer(cancerSlug: string): MutationPageEntry[] {
  return MUTATION_PAGES.filter((p) => p.cancerSlug === cancerSlug).sort(
    (a, b) => b.frequency - a.frequency,
  );
}

/** Check if a specific gene × cancer page exists */
export function hasMutationPage(geneSlug: string, cancerSlug: string): boolean {
  return MUTATION_PAGES.some((p) => p.geneSlug === geneSlug && p.cancerSlug === cancerSlug);
}
