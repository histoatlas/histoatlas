/**
 * Static API path builders.
 *
 * Maps every API endpoint to its pre-generated JSON file path.
 * Dataset-scoped endpoints are nested under /api/{dataset}/.
 * Mutations stay global at /api/mutations/.
 */
export const apiPaths = {
  // Top-level
  ready: () => '/api/ready.json',
  datasets: () => '/api/datasets.json',
  cohorts: (dataset: string) => `/api/${dataset}/cohorts.json`,
  cohortSummary: (dataset: string) => `/api/${dataset}/cohorts/summary.json`,

  // Atlas
  atlas: (dataset: string, cohort: string) => `/api/${dataset}/atlas/${cohort}.json`,

  // Slide (consolidated: detail + similar + tiles in one file)
  slide: (dataset: string, slideId: string) => `/api/${dataset}/slide/${slideId}.json`,

  // Cluster
  clusterDetail: (dataset: string, cohort: string, clusterId: string) =>
    `/api/${dataset}/cluster/${cohort}/${clusterId}.json`,
  clusterSlides: (dataset: string, cohort: string, clusterId: string) =>
    `/api/${dataset}/cluster/${cohort}/${clusterId}/slides.json`,
  clusterSurvival: (dataset: string, cohort: string, clusterId: string, endpoint: string) =>
    `/api/${dataset}/cluster/${cohort}/${clusterId}/survival/${endpoint}.json`,

  // Histomics
  histomicsFilters: (dataset: string) => `/api/${dataset}/histomics/filters.json`,
  // Consolidated: survival + km + correlations + categorical + treatment in one file
  histomicsFeature: (dataset: string, cancer: string, feature: string) =>
    `/api/${dataset}/histomics/${cancer}/${feature}.json`,
  histomicsCrossCancer: (dataset: string, feature: string, endpoint: string, model: string) =>
    `/api/${dataset}/histomics/cross-cancer/${feature}/${endpoint}/${model}.json`,

  // Associations
  associationSurvival: (dataset: string, cancer: string, endpoint: string, model: string) =>
    `/api/${dataset}/associations/survival/${cancer}/${endpoint}/${model}.json`,
  associationCorrelations: (dataset: string, cancer: string, model: string) =>
    `/api/${dataset}/associations/correlations/${cancer}/${model}.json`,
  associationCorrelationsByType: (dataset: string, cancer: string, model: string, molType: string) =>
    `/api/${dataset}/associations/correlations/${cancer}/${model}/${molType}.json`,
  // Consolidated: returns { cancerType, model, correctionMethod, categoricalVars: { [catVar]: [...] } }
  associationCategorical: (dataset: string, cancer: string, model: string) =>
    `/api/${dataset}/associations/categorical/${cancer}/${model}.json`,
  molecularFeatures: (dataset: string, cancer: string, molType: string) =>
    `/api/${dataset}/associations/molecular/features/${cancer}/${molType}.json`,

  // Sample data (for client-side scatter/violin)
  sampleData: (dataset: string, cancer: string) => `/api/${dataset}/sample-data/${cancer}.json`,

  // Mutations (global — not dataset-scoped)
  mutationGenes: () => '/api/mutations/genes.json',
  mutationOverview: (gene: string) => `/api/mutations/${gene}/overview.json`,
  mutationMorphologyHeatmap: (gene: string) =>
    `/api/mutations/${gene}/morphology-heatmap.json`,
  mutationIntersection: (gene: string, cancerSlug: string) =>
    `/api/mutations/${gene}/${cancerSlug}.json`,
  mutationKm: (gene: string, cancerSlug: string, endpoint: string) =>
    `/api/mutations/${gene}/${cancerSlug}/km/${endpoint}.json`,

  // Manifests
  datasetsManifest: () => '/api/_manifests/datasets.json',
  manifestClusterIds: (dataset: string) => `/api/${dataset}/_manifests/cluster-ids.json`,
  manifestSlideIds: (dataset: string) => `/api/${dataset}/_manifests/slide-ids.json`,
};
