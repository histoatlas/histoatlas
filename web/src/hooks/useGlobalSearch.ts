import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAtlasData } from './useAtlasData';
import { getDatasetAndCohortFromPath } from './useCohort';
import { useCohortSummary } from './useCohortSummary';

export interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: 'slide' | 'cluster' | 'feature' | 'cohort';
  href: string;
}

export interface GroupedResults {
  cohorts: SearchResult[];
  clusters: SearchResult[];
  slides: SearchResult[];
  features: SearchResult[];
}

const SECTION_CAPS = { cohorts: 5, clusters: 5, slides: 10, features: 5 } as const;

export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { dataset, cohort } = getDatasetAndCohortFromPath();
  const { data: atlasData } = useAtlasData(dataset, cohort, isOpen);
  const { data: cohortData } = useCohortSummary(dataset);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keyboard shortcut: / to focus, Esc to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const groupedResults: GroupedResults = useMemo(() => {
    const empty: GroupedResults = { cohorts: [], clusters: [], slides: [], features: [] };
    if (query.length < 2) return empty;
    const q = query.toLowerCase();

    // Search cohorts
    const cohorts: SearchResult[] = [];
    if (cohortData) {
      for (const c of cohortData) {
        if (cohorts.length >= SECTION_CAPS.cohorts) break;
        if (c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
          cohorts.push({
            id: c.id,
            label: c.id,
            sublabel: c.name,
            type: 'cohort',
            href: `/${dataset}/${c.id}/atlas/`,
          });
        }
      }
    }

    if (!atlasData) return { ...empty, cohorts };

    // Search clusters
    const clusters: SearchResult[] = [];
    for (const cluster of atlasData.clusters) {
      if (clusters.length >= SECTION_CAPS.clusters) break;
      if (
        cluster.id.toLowerCase().includes(q) ||
        cluster.name.toLowerCase().includes(q)
      ) {
        clusters.push({
          id: cluster.id,
          label: cluster.name,
          sublabel: `${cluster.slideIds.length} slides`,
          type: 'cluster',
          href: `/${dataset}/${cohort}/cluster/${cluster.id}/`,
        });
      }
    }

    // Search slides by ID and cancerType
    const slides: SearchResult[] = [];
    for (const slide of atlasData.slides) {
      if (slides.length >= SECTION_CAPS.slides) break;
      if (
        slide.id.toLowerCase().includes(q) ||
        slide.cancerType.toLowerCase().includes(q)
      ) {
        slides.push({
          id: slide.id,
          label: slide.id,
          sublabel: slide.cancerType,
          type: 'slide',
          href: `/${dataset}/${slide.cancerType}/slide/${slide.id}/`,
        });
      }
    }

    // Search features
    const features: SearchResult[] = [];
    if (atlasData.featureMetadata) {
      for (const meta of atlasData.featureMetadata) {
        if (features.length >= SECTION_CAPS.features) break;
        if (
          meta.name.toLowerCase().includes(q) ||
          meta.displayName.toLowerCase().includes(q) ||
          meta.category.toLowerCase().includes(q)
        ) {
          features.push({
            id: meta.name,
            label: meta.displayName,
            sublabel: meta.category,
            type: 'feature',
            href: `/${dataset}/${cohort}/histomics/${encodeURIComponent(meta.name)}/`,
          });
        }
      }
    }

    return { cohorts, clusters, slides, features };
  }, [atlasData, cohortData, query, dataset, cohort]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(
    () => [
      ...groupedResults.cohorts,
      ...groupedResults.clusters,
      ...groupedResults.slides,
      ...groupedResults.features,
    ],
    [groupedResults],
  );

  const totalCount = flatResults.length;

  const navigateUp = useCallback(() => {
    setActiveIndex((i) => (i > 0 ? i - 1 : totalCount - 1));
  }, [totalCount]);

  const navigateDown = useCallback(() => {
    setActiveIndex((i) => (i < totalCount - 1 ? i + 1 : 0));
  }, [totalCount]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      window.location.href = result.href;
      setIsOpen(false);
      setQuery('');
    },
    [],
  );

  const selectActive = useCallback(() => {
    if (flatResults[activeIndex]) {
      selectResult(flatResults[activeIndex]);
    }
  }, [flatResults, activeIndex, selectResult]);

  return {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    groupedResults,
    flatResults,
    activeIndex,
    setActiveIndex,
    navigateUp,
    navigateDown,
    selectResult,
    selectActive,
    inputRef,
  };
}

export type GlobalSearch = ReturnType<typeof useGlobalSearch>;

function isInputFocused(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  );
}
