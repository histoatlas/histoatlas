/**
 * Gene metadata for the 8 tracked driver mutations in HistoAtlas.
 *
 * Used for gene hub pages, SEO, and navigation.
 */

export type GeneEntry = {
  symbol: string;
  slug: string;
  fullName: string;
  geneType: 'Tumor Suppressor' | 'Oncogene';
  summary: string;
};

export const TRACKED_GENES: GeneEntry[] = [
  {
    symbol: 'TP53',
    slug: 'tp53',
    fullName: 'Tumor Protein P53',
    geneType: 'Tumor Suppressor',
    summary:
      'TP53 encodes the p53 protein, the most frequently mutated gene in human cancer. It acts as a tumor suppressor by regulating cell cycle arrest, apoptosis, and DNA repair in response to cellular stress.',
  },
  {
    symbol: 'KRAS',
    slug: 'kras',
    fullName: 'Kirsten Rat Sarcoma Viral Oncogene Homolog',
    geneType: 'Oncogene',
    summary:
      'KRAS encodes a GTPase that activates the RAS/MAPK signaling pathway, promoting cell growth and survival. KRAS mutations are common in lung, colorectal, and pancreatic cancers.',
  },
  {
    symbol: 'BRAF',
    slug: 'braf',
    fullName: 'B-Raf Proto-Oncogene',
    geneType: 'Oncogene',
    summary:
      'BRAF is a serine/threonine kinase in the MAPK signaling pathway. The V600E mutation is the most common, found in melanoma, thyroid, and colorectal cancers. BRAF inhibitors are approved targeted therapies.',
  },
  {
    symbol: 'EGFR',
    slug: 'egfr',
    fullName: 'Epidermal Growth Factor Receptor',
    geneType: 'Oncogene',
    summary:
      'EGFR is a tyrosine kinase receptor that drives cell proliferation when activated. Activating mutations in EGFR are key therapeutic targets in non-small cell lung cancer with multiple approved inhibitors.',
  },
  {
    symbol: 'PIK3CA',
    slug: 'pik3ca',
    fullName: 'Phosphatidylinositol-4,5-Bisphosphate 3-Kinase Catalytic Subunit Alpha',
    geneType: 'Oncogene',
    summary:
      'PIK3CA encodes the catalytic subunit of PI3K, a lipid kinase central to the PI3K/AKT/mTOR pathway. Mutations are frequent in breast, endometrial, and head and neck cancers.',
  },
  {
    symbol: 'PTEN',
    slug: 'pten',
    fullName: 'Phosphatase and Tensin Homolog',
    geneType: 'Tumor Suppressor',
    summary:
      'PTEN is a phosphatase that negatively regulates the PI3K/AKT pathway. Loss of PTEN function leads to uncontrolled cell growth and is common in endometrial, prostate, and brain cancers.',
  },
  {
    symbol: 'IDH1',
    slug: 'idh1',
    fullName: 'Isocitrate Dehydrogenase 1',
    geneType: 'Oncogene',
    summary:
      'IDH1 mutations produce the oncometabolite 2-hydroxyglutarate, which alters DNA methylation and blocks cell differentiation. IDH1 mutations define a distinct subtype of glioma and AML with better prognosis.',
  },
  {
    symbol: 'ARID1A',
    slug: 'arid1a',
    fullName: 'AT-Rich Interaction Domain 1A',
    geneType: 'Tumor Suppressor',
    summary:
      'ARID1A is a subunit of the SWI/SNF chromatin remodeling complex. Loss-of-function mutations alter gene expression programs and are frequent in ovarian clear cell, endometrial, and gastric cancers.',
  },
];

/** Lookup by slug (e.g., "tp53" -> GeneEntry) */
export const GENE_BY_SLUG: Record<string, GeneEntry> = Object.fromEntries(
  TRACKED_GENES.map((g) => [g.slug, g]),
);

/** Lookup by symbol (e.g., "TP53" -> GeneEntry) */
export const GENE_BY_SYMBOL: Record<string, GeneEntry> = Object.fromEntries(
  TRACKED_GENES.map((g) => [g.symbol, g]),
);
