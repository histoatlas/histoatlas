import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAtlasStore } from '../../stores/atlasStore';
import { DataTableHeader } from './DataTableHeader';
import { DataTableBody } from './DataTableBody';
import { DataTablePagination } from './DataTablePagination';
import { FilterChips } from './FilterChips';
import { EmptyState, NoResultsIcon } from '../ui/EmptyState';
import { SkeletonTable } from '../ui/Skeleton';
import type { Slide, FeatureMetadata } from '../../types';

interface DataTableProps {
  /** All slides (unfiltered) */
  allSlides: Slide[];
  /** Filtered and sorted slides (before pagination) */
  sortedSlides: Slide[];
  /** Paginated slides for current page */
  paginatedSlides: Slide[];
  /** Total number of pages */
  totalPages: number;
  /** Feature metadata for column headers */
  featureMetadata: FeatureMetadata[];
  /** Feature names to display as columns */
  featureNames: string[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a slide is clicked */
  onSlideClick: (slideId: string) => void;
  /** Search query to filter displayed slides */
  searchQuery?: string;
}

/**
 * Main data table component with filtering, sorting, pagination, and selection.
 * Uses a two-pane layout with frozen columns (checkbox + slide ID) on the left.
 */
export function DataTable({
  allSlides,
  sortedSlides,
  paginatedSlides,
  totalPages,
  featureMetadata,
  featureNames,
  isLoading,
  onSlideClick,
  searchQuery = '',
}: DataTableProps) {
  // Local state for shift-click range selection
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Shared ref for horizontal scroll sync between header and body
  const scrollableRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // Store state
  const {
    sort,
    pagination,
    hoveredId,
    selectedSlideIds,
    cancerTypes,
    clusterIds,
    immuneSubtypes,
    featureRanges,
    setPagination,
    setHoveredId,
    setSelectedSlideIds,
    toggleSelectedSlideId,
    selectRange,
    clearSelection,
    setCancerTypes,
    setClusterIds,
    setImmuneSubtypes,
    setFeatureRange,
    clearFeatureRange,
    clearFilters,
  } = useAtlasStore();

  // Filter paginated slides by search query
  const displayedSlides = useMemo(() => {
    if (!searchQuery.trim()) return paginatedSlides;
    const query = searchQuery.trim().toLowerCase();
    return paginatedSlides.filter((s) => s.id.toLowerCase().includes(query));
  }, [paginatedSlides, searchQuery]);

  // Filtered slide IDs for select all
  const filteredSlideIds = useMemo(() => sortedSlides.map((s) => s.id), [sortedSlides]);

  // Bi-directional horizontal scroll sync between header and body
  useEffect(() => {
    const bodyEl = scrollableRef.current;
    const headerEl = headerScrollRef.current;
    if (!bodyEl || !headerEl) return;

    let isSyncing = false;

    const handleBodyScroll = () => {
      if (isSyncing) return;
      isSyncing = true;
      headerEl.scrollLeft = bodyEl.scrollLeft;
      requestAnimationFrame(() => { isSyncing = false; });
    };

    const handleHeaderScroll = () => {
      if (isSyncing) return;
      isSyncing = true;
      bodyEl.scrollLeft = headerEl.scrollLeft;
      requestAnimationFrame(() => { isSyncing = false; });
    };

    bodyEl.addEventListener('scroll', handleBodyScroll);
    headerEl.addEventListener('scroll', handleHeaderScroll);

    return () => {
      bodyEl.removeEventListener('scroll', handleBodyScroll);
      headerEl.removeEventListener('scroll', handleHeaderScroll);
    };
  }, [paginatedSlides]);

  // Handle row selection with modifier keys
  const handleSelect = useCallback(
    (id: string, event: React.MouseEvent) => {
      if (event.shiftKey && lastSelectedId) {
        selectRange(lastSelectedId, id, filteredSlideIds);
      } else if (event.metaKey || event.ctrlKey) {
        toggleSelectedSlideId(id);
      } else {
        setSelectedSlideIds([id]);
      }
      setLastSelectedId(id);
    },
    [lastSelectedId, filteredSlideIds, selectRange, toggleSelectedSlideId, setSelectedSlideIds]
  );

  const handleSelectAll = useCallback(() => {
    setSelectedSlideIds(filteredSlideIds);
  }, [filteredSlideIds, setSelectedSlideIds]);

  const handleFeatureRangeChange = useCallback(
    (feature: string, range: [number, number] | undefined) => {
      if (range === undefined) {
        clearFeatureRange(feature);
      } else {
        setFeatureRange(feature, range);
      }
    },
    [setFeatureRange, clearFeatureRange]
  );

  const handlePageChange = useCallback(
    (pageIndex: number) => {
      setPagination({ pageIndex });
    },
    [setPagination]
  );

  const hasActiveFilters = Object.keys(featureRanges).length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
        <SkeletonTable rows={8} columns={6} />
      </div>
    );
  }

  // Empty state
  if (sortedSlides.length === 0) {
    return (
      <div className="flex flex-col">
        {hasActiveFilters && (
          <FilterChips
            featureRanges={featureRanges}
            onClearFeatureRange={clearFeatureRange}
            onClearAll={clearFilters}
          />
        )}
        <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white flex items-center justify-center py-16">
          <EmptyState
            icon={<NoResultsIcon />}
            title="No slides match your filters"
            description="Try adjusting your filter criteria to see more results."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Filter chips (if any active) */}
      {hasActiveFilters && (
        <FilterChips
          featureRanges={featureRanges}
          onClearFeatureRange={clearFeatureRange}
          onClearAll={clearFilters}
        />
      )}

      {/* Table */}
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
        {/* Header */}
        <DataTableHeader
          slides={allSlides}
          featureMetadata={featureMetadata}
          featureNames={featureNames}
          sort={sort}
          featureRanges={featureRanges}
          onFeatureRangeChange={handleFeatureRangeChange}
          cancerTypes={cancerTypes}
          onCancerTypesChange={setCancerTypes}
          clusterIds={clusterIds}
          onClusterIdsChange={setClusterIds}
          immuneSubtypes={immuneSubtypes}
          onImmuneSubtypesChange={setImmuneSubtypes}
          selectedSlideIds={selectedSlideIds}
          filteredSlideIds={filteredSlideIds}
          onSelectAll={handleSelectAll}
          onClearSelection={clearSelection}
          headerScrollRef={headerScrollRef}
        />

        {/* Body */}
        <DataTableBody
          slides={displayedSlides}
          featureNames={featureNames}
          selectedSlideIds={selectedSlideIds}
          hoveredId={hoveredId}
          onSelect={handleSelect}
          onHover={setHoveredId}
          onClick={onSlideClick}
          scrollableRef={scrollableRef}
        />

        {/* Pagination */}
        <DataTablePagination
          pageIndex={pagination.pageIndex}
          totalPages={totalPages}
          totalRows={sortedSlides.length}
          pageSize={pagination.pageSize}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
