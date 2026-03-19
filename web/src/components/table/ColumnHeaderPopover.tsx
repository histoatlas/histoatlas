import { useState } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { ContinuousFilter } from './filters/ContinuousFilter';
import { CategoricalFilter } from './filters/CategoricalFilter';
import type { SortState, FeatureMetadata } from '../../types';

export type ColumnType = 'categorical' | 'continuous';

interface ColumnHeaderPopoverProps {
  column: string;
  displayName: string;
  columnType: ColumnType;
  sort: SortState | null;
  // For continuous columns
  featureMetadata?: FeatureMetadata;
  featureRange?: [number, number];
  onFeatureRangeChange?: (range: [number, number] | undefined) => void;
  // For categorical columns
  categoricalOptions?: Array<{ value: string; count: number }>;
  selectedCategoricalValues?: string[];
  onCategoricalSelectionChange?: (values: string[]) => void;
}

/**
 * Column header with popover for sorting and filtering.
 */
export function ColumnHeaderPopover({
  column,
  displayName,
  columnType,
  sort,
  featureMetadata,
  featureRange,
  onFeatureRangeChange,
  categoricalOptions,
  selectedCategoricalValues,
  onCategoricalSelectionChange,
}: ColumnHeaderPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  // Check if this column is sorted
  const isSorted = sort?.column === column;
  const sortDirection = isSorted ? sort.direction : null;

  // Check if filter is active
  const hasFilter =
    (columnType === 'continuous' && featureRange !== undefined) ||
    (columnType === 'categorical' &&
      selectedCategoricalValues &&
      selectedCategoricalValues.length > 0 &&
      categoricalOptions &&
      selectedCategoricalValues.length < categoricalOptions.length);

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        className={`flex items-center gap-1 w-full text-left text-xs font-medium transition-colors focus-ring rounded px-1 -mx-1 ${
          hasFilter ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
        }`}
      >
        <span className="truncate flex-1 text-left">{displayName}</span>
        {isSorted && (
          <svg
            className={`w-3 h-3 flex-shrink-0 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
        {hasFilter && !isSorted && (
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 flex-shrink-0" />
        )}
        {/* Chevron - always visible */}
        <svg
          className="w-3 h-3 flex-shrink-0 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 w-64 bg-white border border-zinc-200 rounded-lg shadow-lg"
          >
            {/* Column title */}
            <div className="px-3 py-2 border-b border-zinc-100">
              <span className="text-sm font-medium text-zinc-900">{displayName}</span>
            </div>

            {/* Filter UI */}
            {columnType === 'continuous' && featureMetadata && onFeatureRangeChange && (
              <ContinuousFilter
                min={featureMetadata.min}
                max={featureMetadata.max}
                histogramBins={featureMetadata.histogramBins}
                currentRange={featureRange}
                onRangeChange={onFeatureRangeChange}
              />
            )}

            {columnType === 'categorical' &&
              categoricalOptions &&
              onCategoricalSelectionChange && (
                <CategoricalFilter
                  options={categoricalOptions}
                  selectedValues={selectedCategoricalValues || []}
                  onSelectionChange={onCategoricalSelectionChange}
                />
              )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
