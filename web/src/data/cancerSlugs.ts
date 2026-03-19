/**
 * Bidirectional mapping between TCGA cohort codes and URL-friendly slugs.
 *
 * Some slugs are SEO overrides (e.g., SKCM -> "melanoma" instead of
 * "skin-cutaneous-melanoma") to match how users actually search.
 */
import { COHORT_FULL_NAMES } from './cohortNames';

export const TCGA_TO_SLUG: Record<string, string> = {
  ACC: 'adrenocortical-carcinoma',
  BLCA: 'bladder-cancer',
  BRCA: 'breast-cancer',
  CESC: 'cervical-cancer',
  CHOL: 'cholangiocarcinoma',
  COAD: 'colorectal',
  DLBC: 'diffuse-large-b-cell-lymphoma',
  ESCA: 'esophageal-cancer',
  GBM: 'glioblastoma',
  HNSC: 'head-neck-cancer',
  KICH: 'kidney-chromophobe',
  KIRC: 'kidney-clear-cell',
  KIRP: 'kidney-papillary',
  LAML: 'acute-myeloid-leukemia',
  LGG: 'low-grade-glioma',
  LIHC: 'liver-cancer',
  LUAD: 'lung-adenocarcinoma',
  LUSC: 'lung-squamous',
  MESO: 'mesothelioma',
  OV: 'ovarian-cancer',
  PAAD: 'pancreatic-cancer',
  PCPG: 'pheochromocytoma',
  PRAD: 'prostate-cancer',
  READ: 'rectal-cancer',
  SARC: 'sarcoma',
  SKCM: 'melanoma',
  STAD: 'stomach-cancer',
  TGCT: 'testicular-cancer',
  THCA: 'thyroid-cancer',
  THYM: 'thymoma',
  UCEC: 'endometrial-cancer',
  UCS: 'uterine-carcinosarcoma',
  UVM: 'uveal-melanoma',
  HNSCC: 'head-neck-squamous-cell-carcinoma',
};

/** Inverse: slug -> TCGA code */
export const SLUG_TO_TCGA: Record<string, string> = Object.fromEntries(
  Object.entries(TCGA_TO_SLUG).map(([tcga, slug]) => [slug, tcga]),
);

/** slug -> Full display name (e.g., "breast-cancer" -> "Breast Invasive Carcinoma") */
export const SLUG_TO_FULL_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(TCGA_TO_SLUG).map(([tcga, slug]) => [slug, COHORT_FULL_NAMES[tcga] ?? tcga]),
);

/** Resolve a cancer slug to its TCGA code, or undefined if not found */
export function resolveCancerSlug(slug: string): string | undefined {
  return SLUG_TO_TCGA[slug];
}
