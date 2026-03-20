import { QueryClient } from '@tanstack/react-query';
import type { AtlasDataResponse } from '../types';
import { apiPaths } from './paths';

// QueryClient with aggressive caching for static bundle data
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60, // 1 hour - data is largely static
      gcTime: 1000 * 60 * 60 * 24, // 24 hours cache
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Fetch atlas data (embedding coordinates, clusters, metadata)
export async function fetchAtlasData(dataset: string, cohort = 'PANCAN'): Promise<AtlasDataResponse> {
  const response = await fetch(apiPaths.atlas(dataset, cohort));
  if (!response.ok) {
    throw new Error(`Failed to fetch atlas data: ${response.statusText}`);
  }
  return response.json();
}

// Query keys for TanStack Query
export const queryKeys = {
  atlas: (dataset: string, cohort: string) => ['atlas', dataset, cohort] as const,
  slide: (dataset: string, id: string) => ['slide', dataset, id] as const,
  cluster: (dataset: string, id: string, cohort = 'PANCAN') => ['cluster', dataset, id, cohort] as const,
  clusterSlides: (
    dataset: string,
    id: string,
    cohort = 'PANCAN'
  ) => ['cluster', dataset, id, 'slides', cohort] as const,
  clusterSurvival: (dataset: string, id: string, endpoint: string, cohort = 'PANCAN') =>
    ['cluster', dataset, id, 'survival', endpoint, cohort] as const,
  associationFilters: (dataset: string) => ['associations', dataset, 'filters'] as const,
  survivalAssociations: (dataset: string, cancer: string, endpoint: string, model: string) =>
    ['associations', dataset, 'survival', cancer, endpoint, model] as const,
  correlationAssociations: (
    dataset: string,
    cancer: string,
    molType: string | null,
    model: string
  ) => ['associations', dataset, 'correlations', cancer, molType, model] as const,
  categoricalAssociations: (dataset: string, cancer: string, catVar: string) =>
    ['associations', dataset, 'categorical', cancer, catVar] as const,
  molecularAssociations: (dataset: string, cancer: string, molFeature: string, molType: string, model: string) =>
    ['associations', dataset, 'molecular', cancer, molFeature, molType, model] as const,
  molecularFeatureList: (dataset: string, cancer: string, molType: string) =>
    ['associations', dataset, 'molecular', 'features', cancer, molType] as const,
  associationKm: (
    dataset: string,
    cancer: string,
    feature: string,
    endpoint: string,
    strat: string
  ) => ['associations', dataset, 'km', cancer, feature, endpoint, strat] as const,
  // Histomics feature detail
  histomicsFilters: (dataset: string) => ['histomics', dataset, 'filters'] as const,
  histomicsSurvival: (dataset: string, feature: string, cancer: string) =>
    ['histomics', dataset, 'survival', feature, cancer] as const,
  histomicsKm: (dataset: string, feature: string, cancer: string, endpoint: string, stratification: string) =>
    ['histomics', dataset, 'km', feature, cancer, endpoint, stratification] as const,
  histomicsCorrelations: (
    dataset: string,
    feature: string,
    cancer: string,
    molType: string | null,
    model = 'unadjusted'
  ) => ['histomics', dataset, 'correlations', feature, cancer, molType, model] as const,
  histomicsCategorical: (dataset: string, feature: string, cancer: string, model = 'unadjusted') =>
    ['histomics', dataset, 'categorical', feature, cancer, model] as const,
  histomicsScatter: (dataset: string, feature: string, cancer: string, molFeature: string, molType: string) =>
    ['histomics', dataset, 'scatter', feature, cancer, molFeature, molType] as const,
  histomicsViolin: (dataset: string, feature: string, cancer: string, catVar: string) =>
    ['histomics', dataset, 'violin', feature, cancer, catVar] as const,
  histomicsTreatment: (dataset: string, feature: string, cancer: string) =>
    ['histomics', dataset, 'treatment', feature, cancer] as const,
  histomicsCrossCancer: (dataset: string, feature: string, endpoint: string, model: string) =>
    ['histomics', dataset, 'cross-cancer', feature, endpoint, model] as const,
  // Mutation pages (global, no dataset param)
  mutationGenes: ['mutations', 'genes'] as const,
  mutationOverview: (gene: string) => ['mutations', 'overview', gene] as const,
  mutationIntersection: (gene: string, cancer: string) =>
    ['mutations', 'intersection', gene, cancer] as const,
  mutationKm: (gene: string, cancer: string, endpoint: string) =>
    ['mutations', 'km', gene, cancer, endpoint] as const,
  mutationMorphologyHeatmap: (gene: string) =>
    ['mutations', 'morphology-heatmap', gene] as const,
};
