import type {
  ClusterDetail,
  ClusterSlide,
  ClusterSurvivalResponse,
} from '../types';
import { apiPaths } from './paths';

export async function fetchClusterDetail(
  dataset: string,
  clusterId: string,
  cohort = 'PANCAN'
): Promise<ClusterDetail> {
  const response = await fetch(apiPaths.clusterDetail(dataset, cohort, clusterId));
  if (!response.ok) {
    if (response.status === 404) throw new Error('Cluster not found');
    throw new Error(`Failed to fetch cluster: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch all slides for a cluster. Static files contain the full slide list
 * (no server-side pagination). Client-side sorting/pagination is done in hooks.
 */
export async function fetchClusterSlides(
  dataset: string,
  clusterId: string,
  _page = 1,
  _pageSize = 20,
  _sort?: string,
  _order?: string,
  cohort = 'PANCAN'
): Promise<ClusterSlide[]> {
  const response = await fetch(apiPaths.clusterSlides(dataset, cohort, clusterId));
  if (!response.ok) {
    if (response.status === 404) throw new Error('Cluster not found');
    throw new Error(`Failed to fetch cluster slides: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchClusterSurvival(
  dataset: string,
  clusterId: string,
  endpoint = 'os',
  cohort = 'PANCAN'
): Promise<ClusterSurvivalResponse> {
  const response = await fetch(apiPaths.clusterSurvival(dataset, cohort, clusterId, endpoint));
  if (!response.ok) {
    if (response.status === 404) throw new Error('Cluster not found');
    throw new Error(
      `Failed to fetch cluster survival: ${response.statusText}`
    );
  }
  return response.json();
}
