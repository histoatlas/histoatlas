import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/client';
import {
  fetchGeneList,
  fetchGeneOverview,
  fetchMorphologyHeatmap,
  fetchMutationIntersection,
  fetchMutationKm,
} from '../api/mutations';

export function useGeneList() {
  return useQuery({
    queryKey: queryKeys.mutationGenes,
    queryFn: fetchGeneList,
  });
}

export function useGeneOverview(gene: string | null) {
  return useQuery({
    queryKey: queryKeys.mutationOverview(gene ?? ''),
    queryFn: () => fetchGeneOverview(gene!),
    enabled: !!gene,
  });
}

export function useMutationIntersection(gene: string | null, cancerSlug: string | null) {
  return useQuery({
    queryKey: queryKeys.mutationIntersection(gene ?? '', cancerSlug ?? ''),
    queryFn: () => fetchMutationIntersection(gene!, cancerSlug!),
    enabled: !!gene && !!cancerSlug,
  });
}

export function useMutationKm(
  gene: string | null,
  cancerSlug: string | null,
  endpoint: string,
) {
  return useQuery({
    queryKey: queryKeys.mutationKm(gene ?? '', cancerSlug ?? '', endpoint),
    queryFn: () => fetchMutationKm(gene!, cancerSlug!, endpoint),
    enabled: !!gene && !!cancerSlug,
  });
}

export function useMorphologyHeatmap(gene: string | null) {
  return useQuery({
    queryKey: queryKeys.mutationMorphologyHeatmap(gene ?? ''),
    queryFn: () => fetchMorphologyHeatmap(gene!),
    enabled: !!gene,
  });
}
