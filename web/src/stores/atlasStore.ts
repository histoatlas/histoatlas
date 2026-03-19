import { create } from 'zustand';
import type { AtlasFilters, AtlasUIState, SortState, PaginationState } from '../types';

interface AtlasState extends AtlasFilters, AtlasUIState {
  // Filter actions
  setCancerTypes: (types: string[]) => void;
  setClusterIds: (ids: string[]) => void;
  setImmuneSubtypes: (subtypes: string[]) => void;
  setStages: (stages: string[]) => void;
  setGrades: (grades: string[]) => void;
  setFeatureRange: (feature: string, range: [number, number]) => void;
  clearFeatureRange: (feature: string) => void;
  setFeatureRanges: (ranges: Record<string, [number, number]>) => void;
  setColorBy: (colorBy: string) => void;
  setGlobalSearch: (search: string) => void;

  // Selection actions
  setSelectedSlideIds: (ids: string[]) => void;
  addSelectedSlideId: (id: string) => void;
  removeSelectedSlideId: (id: string) => void;
  toggleSelectedSlideId: (id: string) => void;
  selectRange: (startId: string, endId: string, orderedIds: string[]) => void;
  clearSelection: () => void;

  // UI state actions
  setSort: (sort: SortState | null) => void;
  toggleSort: (column: string) => void;
  setPagination: (pagination: Partial<PaginationState>) => void;
  setHoveredId: (id: string | null) => void;

  // Reset
  reset: () => void;
  clearFilters: () => void;
}

const DEFAULT_PAGE_SIZE = 50;

const initialFilters: AtlasFilters = {
  cancerTypes: [],
  featureRanges: {},
  colorBy: 'clusterId',
  selectedSlideIds: [],
  clusterIds: [],
  immuneSubtypes: [],
  stages: [],
  grades: [],
  globalSearch: '',
};

const initialUIState: AtlasUIState = {
  sort: null,
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
  hoveredId: null,
};

const initialState = { ...initialFilters, ...initialUIState };

export const useAtlasStore = create<AtlasState>((set) => ({
  ...initialState,

  // Filter actions
  setCancerTypes: (types) => set({ cancerTypes: types, pagination: { ...initialUIState.pagination, pageIndex: 0 } }),

  setClusterIds: (ids) => set({ clusterIds: ids, pagination: { ...initialUIState.pagination, pageIndex: 0 } }),

  setImmuneSubtypes: (subtypes) => set({ immuneSubtypes: subtypes, pagination: { ...initialUIState.pagination, pageIndex: 0 } }),

  setStages: (stages) => set({ stages, pagination: { ...initialUIState.pagination, pageIndex: 0 } }),

  setGrades: (grades) => set({ grades, pagination: { ...initialUIState.pagination, pageIndex: 0 } }),

  setFeatureRange: (feature, range) =>
    set((state) => ({
      featureRanges: { ...state.featureRanges, [feature]: range },
      pagination: { ...state.pagination, pageIndex: 0 },
    })),

  clearFeatureRange: (feature) =>
    set((state) => {
      const { [feature]: _removed, ...rest } = state.featureRanges;
      void _removed; // Intentionally unused - we're removing this key
      return { featureRanges: rest, pagination: { ...state.pagination, pageIndex: 0 } };
    }),

  setFeatureRanges: (ranges) =>
    set({
      featureRanges: ranges,
      pagination: { ...initialUIState.pagination, pageIndex: 0 },
    }),

  setColorBy: (colorBy) => set({ colorBy }),

  setGlobalSearch: (search) => set({ globalSearch: search, pagination: { ...initialUIState.pagination, pageIndex: 0 } }),

  // Selection actions
  setSelectedSlideIds: (ids) => set({ selectedSlideIds: ids }),

  addSelectedSlideId: (id) =>
    set((state) => ({
      selectedSlideIds: state.selectedSlideIds.includes(id)
        ? state.selectedSlideIds
        : [...state.selectedSlideIds, id],
    })),

  removeSelectedSlideId: (id) =>
    set((state) => ({
      selectedSlideIds: state.selectedSlideIds.filter((sid) => sid !== id),
    })),

  toggleSelectedSlideId: (id) =>
    set((state) => ({
      selectedSlideIds: state.selectedSlideIds.includes(id)
        ? state.selectedSlideIds.filter((sid) => sid !== id)
        : [...state.selectedSlideIds, id],
    })),

  selectRange: (startId, endId, orderedIds) =>
    set((state) => {
      const startIdx = orderedIds.indexOf(startId);
      const endIdx = orderedIds.indexOf(endId);
      if (startIdx === -1 || endIdx === -1) return state;

      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      const rangeIds = orderedIds.slice(from, to + 1);

      // Add range to selection (union)
      const newSelection = new Set([...state.selectedSlideIds, ...rangeIds]);
      return { selectedSlideIds: Array.from(newSelection) };
    }),

  clearSelection: () => set({ selectedSlideIds: [] }),

  // UI state actions
  setSort: (sort) => set({ sort }),

  toggleSort: (column) =>
    set((state) => {
      if (!state.sort || state.sort.column !== column) {
        return { sort: { column, direction: 'asc' } };
      }
      if (state.sort.direction === 'asc') {
        return { sort: { column, direction: 'desc' } };
      }
      return { sort: null };
    }),

  setPagination: (pagination) =>
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    })),

  setHoveredId: (id) => set({ hoveredId: id }),

  // Reset
  reset: () => set(initialState),

  clearFilters: () =>
    set({
      ...initialFilters,
      pagination: { ...initialUIState.pagination, pageIndex: 0 },
    }),
}));
