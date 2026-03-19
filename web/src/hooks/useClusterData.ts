import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/client';
import {
  fetchClusterDetail,
  fetchClusterSlides,
  fetchClusterSurvival,
} from '../api/cluster';

export function useClusterDetail(dataset: string, clusterId: string | undefined, cohort = 'PANCAN') {
  return useQuery({
    queryKey: queryKeys.cluster(dataset, clusterId ?? '', cohort),
    queryFn: () => fetchClusterDetail(dataset, clusterId!, cohort),
    enabled: !!clusterId,
  });
}

/**
 * Fetches the full slide list for a cluster. Sorting and pagination
 * are handled client-side by the consuming component.
 */
export function useClusterSlides(
  dataset: string,
  clusterId: string | undefined,
  cohort = 'PANCAN'
) {
  return useQuery({
    queryKey: queryKeys.clusterSlides(dataset, clusterId ?? '', cohort),
    queryFn: () => fetchClusterSlides(dataset, clusterId!, 1, 20, undefined, undefined, cohort),
    enabled: !!clusterId,
  });
}

export function useClusterSurvival(
  dataset: string,
  clusterId: string | undefined,
  endpoint = 'os',
  cohort = 'PANCAN'
) {
  return useQuery({
    queryKey: queryKeys.clusterSurvival(dataset, clusterId ?? '', endpoint, cohort),
    queryFn: () => fetchClusterSurvival(dataset, clusterId!, endpoint, cohort),
    enabled: !!clusterId,
  });
}
