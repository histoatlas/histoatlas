/**
 * Known dataset path prefixes. Used to validate that a URL segment is a real
 * dataset rather than a top-level route like /mutations/ or /blog/.
 */
const KNOWN_DATASETS = new Set(['tcga', 'cptac']);

/**
 * Extract the current dataset and cohort from the URL path.
 * URL pattern: /{dataset}/{cohort}/atlas, /{dataset}/{cohort}/histomics/..., etc.
 * Falls back to dataset='tcga', cohort='PANCAN' if not found or during SSR.
 */
export function getDatasetAndCohortFromPath(): { dataset: string; cohort: string } {
  if (typeof window === 'undefined') return { dataset: 'tcga', cohort: 'PANCAN' };
  const path = window.location.pathname;
  const match = path.match(/^\/([a-z][a-z0-9]*)\/([A-Z][A-Z0-9]+)\//);
  if (match && KNOWN_DATASETS.has(match[1])) return { dataset: match[1], cohort: match[2] };
  return { dataset: 'tcga', cohort: 'PANCAN' };
}

/** @deprecated Use getDatasetAndCohortFromPath instead */
export function getCohortFromPath(): string {
  return getDatasetAndCohortFromPath().cohort;
}
