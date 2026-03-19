import { useCallback, useEffect, useRef } from 'react';
import { useAtlasStore } from '../stores/atlasStore';
import type { SortState } from '../types';

const MANAGED_KEYS = ['ct', 'cl', 'im', 'st', 'gr', 'c', 'p', 's', 'q', 'fr', 'sel'] as const;

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseListParam(params: URLSearchParams, key: string): string[] {
  const all = params.getAll(key);
  if (all.length > 1) {
    return all.flatMap((value) => parseCsv(value));
  }
  return parseCsv(params.get(key));
}

function parseSort(value: string | null): SortState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.column !== 'string') return null;
    if (parsed.direction !== 'asc' && parsed.direction !== 'desc') return null;
    return { column: parsed.column, direction: parsed.direction };
  } catch {
    return null;
  }
}

function serializeFeatureRanges(ranges: Record<string, [number, number]>): string {
  return Object.entries(ranges)
    .map(([feature, [min, max]]) => `${feature}:${min}:${max}`)
    .join(';');
}

function deserializeFeatureRanges(raw: string | null): Record<string, [number, number]> {
  if (!raw) return {};
  const result: Record<string, [number, number]> = {};
  for (const entry of raw.split(';')) {
    const [feature, minRaw, maxRaw] = entry.split(':');
    const min = Number.parseFloat(minRaw ?? '');
    const max = Number.parseFloat(maxRaw ?? '');
    if (feature && Number.isFinite(min) && Number.isFinite(max)) {
      result[feature] = [min, max];
    }
  }
  return result;
}

/**
 * Bidirectional sync between atlas store and URL query params.
 * This keeps atlas links shareable without relying on router-specific adapters.
 */
export function useAtlasURLSync() {
  const isInitialized = useRef(false);

  const {
    cancerTypes,
    clusterIds,
    immuneSubtypes,
    stages,
    grades,
    colorBy,
    globalSearch,
    sort,
    pagination,
    featureRanges,
    setCancerTypes,
    setClusterIds,
    setImmuneSubtypes,
    setStages,
    setGrades,
    setColorBy,
    setGlobalSearch,
    setSort,
    setPagination,
    setFeatureRanges,
    setSelectedSlideIds,
  } = useAtlasStore();

  useEffect(() => {
    if (isInitialized.current || typeof window === 'undefined') return;
    isInitialized.current = true;

    const params = new URLSearchParams(window.location.search);

    const urlCancerTypes = parseListParam(params, 'ct');
    const urlClusterIds = parseListParam(params, 'cl');
    const urlImmuneSubtypes = parseListParam(params, 'im');
    const urlStages = parseListParam(params, 'st');
    const urlGrades = parseListParam(params, 'gr');
    const urlColorBy = params.get('c');
    const urlPage = Number.parseInt(params.get('p') ?? '0', 10);
    const urlSort = parseSort(params.get('s'));
    const urlSearch = params.get('q') ?? '';
    const urlFeatureRanges = deserializeFeatureRanges(params.get('fr'));
    const urlSelectedIds = parseListParam(params, 'sel');

    if (urlCancerTypes.length > 0) setCancerTypes(urlCancerTypes);
    if (urlClusterIds.length > 0) setClusterIds(urlClusterIds);
    if (urlImmuneSubtypes.length > 0) setImmuneSubtypes(urlImmuneSubtypes);
    if (urlStages.length > 0) setStages(urlStages);
    if (urlGrades.length > 0) setGrades(urlGrades);
    if (urlColorBy && urlColorBy !== 'clusterId') setColorBy(urlColorBy);
    if (Number.isFinite(urlPage) && urlPage > 0) setPagination({ pageIndex: urlPage });
    if (urlSort) setSort(urlSort);
    if (urlSearch) setGlobalSearch(urlSearch);
    if (Object.keys(urlFeatureRanges).length > 0) setFeatureRanges(urlFeatureRanges);
    if (urlSelectedIds.length > 0) setSelectedSlideIds(urlSelectedIds);
  }, [
    setCancerTypes,
    setClusterIds,
    setImmuneSubtypes,
    setStages,
    setGrades,
    setColorBy,
    setPagination,
    setSort,
    setGlobalSearch,
    setFeatureRanges,
    setSelectedSlideIds,
  ]);

  const syncToUrl = useCallback(() => {
    if (!isInitialized.current || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    MANAGED_KEYS.forEach((key) => params.delete(key));

    if (cancerTypes.length > 0) params.set('ct', cancerTypes.join(','));
    if (clusterIds.length > 0) params.set('cl', clusterIds.join(','));
    if (immuneSubtypes.length > 0) params.set('im', immuneSubtypes.join(','));
    if (stages.length > 0) params.set('st', stages.join(','));
    if (grades.length > 0) params.set('gr', grades.join(','));
    if (colorBy !== 'clusterId') params.set('c', colorBy);
    if (pagination.pageIndex !== 0) params.set('p', String(pagination.pageIndex));
    if (sort) params.set('s', JSON.stringify(sort));
    if (globalSearch.trim().length > 0) params.set('q', globalSearch.trim());

    const serializedRanges = serializeFeatureRanges(featureRanges);
    if (serializedRanges.length > 0) params.set('fr', serializedRanges);

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, [
    cancerTypes,
    clusterIds,
    immuneSubtypes,
    stages,
    grades,
    colorBy,
    globalSearch,
    sort,
    pagination.pageIndex,
    featureRanges,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(syncToUrl, 150);
    return () => window.clearTimeout(timeoutId);
  }, [syncToUrl]);
}
