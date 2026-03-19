import { useMemo } from 'react';
import { useAtlasStore } from '../stores/atlasStore';
import { filterSlides, sortSlides, paginateSlides } from '../lib/filtering';
import type { Slide } from '../types';

interface FilteredSlidesResult {
  /** All slides matching current filters (before pagination) */
  filteredSlides: Slide[];
  /** Set of filtered slide IDs for fast lookup */
  filteredIds: Set<string>;
  /** Sorted slides (before pagination) */
  sortedSlides: Slide[];
  /** Paginated slides for table display */
  paginatedSlides: Slide[];
  /** Total number of pages */
  totalPages: number;
}

/**
 * Memoized filtering, sorting, and pagination of slides based on Zustand store state.
 */
export function useFilteredSlides(slides: Slide[] | undefined): FilteredSlidesResult {
  const cancerTypes = useAtlasStore((state) => state.cancerTypes);
  const clusterIds = useAtlasStore((state) => state.clusterIds);
  const immuneSubtypes = useAtlasStore((state) => state.immuneSubtypes);
  const stages = useAtlasStore((state) => state.stages);
  const grades = useAtlasStore((state) => state.grades);
  const featureRanges = useAtlasStore((state) => state.featureRanges);
  const globalSearch = useAtlasStore((state) => state.globalSearch);
  const sort = useAtlasStore((state) => state.sort);
  const pagination = useAtlasStore((state) => state.pagination);

  // Filter slides
  const { filteredSlides, filteredIds } = useMemo(() => {
    if (!slides || slides.length === 0) {
      return { filteredSlides: [], filteredIds: new Set<string>() };
    }

    const filtered = filterSlides(slides, {
      cancerTypes,
      clusterIds,
      immuneSubtypes,
      stages,
      grades,
      featureRanges,
      globalSearch,
    });
    const ids = new Set(filtered.map((s) => s.id));

    return { filteredSlides: filtered, filteredIds: ids };
  }, [slides, cancerTypes, clusterIds, immuneSubtypes, stages, grades, featureRanges, globalSearch]);

  // Sort filtered slides
  const sortedSlides = useMemo(() => {
    return sortSlides(filteredSlides, sort);
  }, [filteredSlides, sort]);

  // Paginate sorted slides
  const { paginatedSlides, totalPages } = useMemo(() => {
    const { pageIndex, pageSize } = pagination;
    const paginated = paginateSlides(sortedSlides, pageIndex, pageSize);
    const pages = Math.ceil(sortedSlides.length / pageSize);
    return { paginatedSlides: paginated, totalPages: pages };
  }, [sortedSlides, pagination]);

  return {
    filteredSlides,
    filteredIds,
    sortedSlides,
    paginatedSlides,
    totalPages,
  };
}
