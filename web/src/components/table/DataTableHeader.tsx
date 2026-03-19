import { useMemo } from 'react';
import { ColumnHeaderPopover } from './ColumnHeaderPopover';
import type { Slide, SortState, FeatureMetadata } from '../../types';
import { getCancerTypeCounts } from '../../lib/filtering';

interface DataTableHeaderProps {
  slides: Slide[];
  featureMetadata: FeatureMetadata[];
  featureNames: string[];
  sort: SortState | null;
  // Filter state
  featureRanges: Record<string, [number, number]>;
  onFeatureRangeChange: (feature: string, range: [number, number] | undefined) => void;
  cancerTypes: string[];
  onCancerTypesChange: (types: string[]) => void;
  clusterIds: string[];
  onClusterIdsChange: (ids: string[]) => void;
  immuneSubtypes: string[];
  onImmuneSubtypesChange: (subtypes: string[]) => void;
  // Selection
  selectedSlideIds: string[];
  filteredSlideIds: string[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  /** Ref to the header's scrollable container for external scroll sync */
  headerScrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Two-pane table header matching the body layout.
 * Left pane: frozen columns (checkbox + slide ID)
 * Right pane: scrollable columns (synced with body horizontal scroll)
 */
export function DataTableHeader({
  slides,
  featureMetadata,
  featureNames,
  sort,
  featureRanges,
  onFeatureRangeChange,
  cancerTypes,
  onCancerTypesChange,
  clusterIds,
  onClusterIdsChange,
  immuneSubtypes,
  onImmuneSubtypesChange,
  selectedSlideIds,
  filteredSlideIds,
  onSelectAll,
  onClearSelection,
  headerScrollRef,
}: DataTableHeaderProps) {
  // Build categorical options with counts
  const cancerTypeOptions = useMemo(() => {
    const counts = getCancerTypeCounts(slides);
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [slides]);

  const clusterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slide of slides) {
      if (slide.clusterId) {
        counts.set(slide.clusterId, (counts.get(slide.clusterId) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [slides]);

  const immuneSubtypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slide of slides) {
      if (slide.immuneSubtype) {
        counts.set(slide.immuneSubtype, (counts.get(slide.immuneSubtype) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [slides]);

  // Feature metadata lookup
  const featureMetadataMap = useMemo(() => {
    const map = new Map<string, FeatureMetadata>();
    for (const meta of featureMetadata) {
      map.set(meta.name, meta);
    }
    return map;
  }, [featureMetadata]);

  // Check select all state
  const allSelected =
    filteredSlideIds.length > 0 &&
    filteredSlideIds.every((id) => selectedSlideIds.includes(id));
  const someSelected =
    selectedSlideIds.length > 0 &&
    !allSelected &&
    filteredSlideIds.some((id) => selectedSlideIds.includes(id));

  const handleCheckboxClick = () => {
    if (allSelected || someSelected) {
      onClearSelection();
    } else {
      onSelectAll();
    }
  };

  return (
    <div className="flex border-b border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
      {/* Frozen header - checkbox + slide ID */}
      <div className="flex-shrink-0 w-[17rem] flex border-r border-zinc-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] bg-zinc-50">
        {/* Checkbox column */}
        <div className="flex-shrink-0 w-10 px-2.5 py-2.5 flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={handleCheckboxClick}
            className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500"
          />
        </div>

        {/* Slide ID column */}
        <div className="flex-shrink-0 w-60 px-3 py-2.5">
          <ColumnHeaderPopover
            column="id"
            displayName="Slide ID"
            columnType="categorical"
            sort={sort}
          />
        </div>
      </div>

      {/* Scrollable header - all other columns */}
      <div
        ref={headerScrollRef}
        className="flex-1 overflow-x-auto scrollbar-hide"
      >
        <div className="flex" style={{ minWidth: 'max-content' }}>
          {/* Cancer Type column */}
          <div className="flex-shrink-0 w-36 px-3 py-2.5 border-r border-zinc-100">
            <ColumnHeaderPopover
              column="cancerType"
              displayName="Cancer"
              columnType="categorical"
              sort={sort}
              categoricalOptions={cancerTypeOptions}
              selectedCategoricalValues={cancerTypes}
              onCategoricalSelectionChange={onCancerTypesChange}
            />
          </div>

          {/* Cluster column */}
          <div className="flex-shrink-0 w-28 px-3 py-2.5 border-r border-zinc-100">
            <ColumnHeaderPopover
              column="clusterId"
              displayName="Cluster"
              columnType="categorical"
              sort={sort}
              categoricalOptions={clusterOptions}
              selectedCategoricalValues={clusterIds}
              onCategoricalSelectionChange={onClusterIdsChange}
            />
          </div>

          {/* Immune Subtype column */}
          <div className="flex-shrink-0 w-36 px-3 py-2.5 border-r border-zinc-100">
            <ColumnHeaderPopover
              column="immuneSubtype"
              displayName="Immune"
              columnType="categorical"
              sort={sort}
              categoricalOptions={immuneSubtypeOptions}
              selectedCategoricalValues={immuneSubtypes}
              onCategoricalSelectionChange={onImmuneSubtypesChange}
            />
          </div>

          {/* Feature columns */}
          {featureNames.map((featureName, index) => {
            const metadata = featureMetadataMap.get(featureName);
            const isLastColumn = index === featureNames.length - 1;
            return (
              <div key={featureName} className={`flex-shrink-0 w-40 px-3 py-2.5 ${!isLastColumn ? 'border-r border-zinc-100' : ''}`}>
                <ColumnHeaderPopover
                  column={featureName}
                  displayName={metadata?.unit ? `${metadata.displayName || featureName} (${metadata.unit})` : (metadata?.displayName || featureName)}
                  columnType="continuous"
                  sort={sort}
                  featureMetadata={metadata}
                  featureRange={featureRanges[featureName]}
                  onFeatureRangeChange={(range) => onFeatureRangeChange(featureName, range)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
