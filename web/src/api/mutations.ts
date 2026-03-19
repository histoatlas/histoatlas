import type {
  GeneListResponse,
  GeneOverviewResponse,
  MorphologyHeatmapResponse,
  MutationIntersectionResponse,
  MutationKmResponse,
} from '../types';
import { apiPaths } from './paths';

export async function fetchGeneList(): Promise<GeneListResponse> {
  const res = await fetch(apiPaths.mutationGenes());
  if (!res.ok) throw new Error(`Failed to fetch gene list: ${res.statusText}`);
  return res.json();
}

export async function fetchGeneOverview(gene: string): Promise<GeneOverviewResponse> {
  const res = await fetch(apiPaths.mutationOverview(gene.toUpperCase()));
  if (!res.ok) throw new Error(`Failed to fetch gene overview: ${res.statusText}`);
  return res.json();
}

export async function fetchMutationIntersection(
  gene: string,
  cancerSlug: string,
): Promise<MutationIntersectionResponse> {
  const res = await fetch(apiPaths.mutationIntersection(gene.toUpperCase(), cancerSlug));
  if (!res.ok) throw new Error(`Failed to fetch mutation intersection: ${res.statusText}`);
  return res.json();
}

export async function fetchMutationKm(
  gene: string,
  cancerSlug: string,
  endpoint = 'os',
): Promise<MutationKmResponse> {
  const res = await fetch(apiPaths.mutationKm(gene.toUpperCase(), cancerSlug, endpoint));
  if (!res.ok) throw new Error(`Failed to fetch mutation KM data: ${res.statusText}`);
  return res.json();
}

export async function fetchMorphologyHeatmap(
  gene: string,
): Promise<MorphologyHeatmapResponse> {
  const res = await fetch(apiPaths.mutationMorphologyHeatmap(gene.toUpperCase()));
  if (!res.ok) throw new Error(`Failed to fetch morphology heatmap: ${res.statusText}`);
  return res.json();
}
