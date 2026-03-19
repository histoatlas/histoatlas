import { useState, useCallback, useMemo } from "react";
import { Icon } from "../ui/Icon";
import { DownloadDialog } from "./DownloadDialog";
import type { Slide } from "../../types";

interface DataTableToolbarProps {
  selectedCount: number;
  filteredSlides: Slide[];
  selectedSlideIds: string[];
  featureNames: string[];
  featureRanges: Record<string, [number, number]>;
  onClearFeatureRange: (feature: string) => void;
  onClearAll: () => void;
  dataVersion?: string;
  dataUpdatedAt?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

/**
 * Format a date as relative time (e.g., "2 days ago", "last week", "3 months ago")
 */
function formatRelativeTime(isoDate: string): string | null {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "last week";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "last month";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  if (diffDays < 730) return "last year";
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * GitHub commit-bar style toolbar above the data table.
 */
export function DataTableToolbar({
  selectedCount,
  filteredSlides,
  selectedSlideIds,
  featureNames,
  featureRanges,
  onClearFeatureRange,
  onClearAll,
  dataVersion,
  dataUpdatedAt,
  searchQuery,
  onSearchChange,
}: DataTableToolbarProps) {
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const handleDownload = useCallback(() => {
    setIsDownloadOpen(true);
  }, []);

  const relativeTime = useMemo(
    () => (dataUpdatedAt ? formatRelativeTime(dataUpdatedAt) : null),
    [dataUpdatedAt]
  );

  const activeFeatureFilters = Object.keys(featureRanges);
  const hasActiveFilters = activeFeatureFilters.length > 0;

  return (
    <div className="bg-zinc-100 border border-zinc-200 rounded-t-lg">
      {/* Main row */}
      <div className="flex items-center justify-between px-4 py-2.5">
        {/* Left side: version info or selection count */}
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          {selectedCount > 0 ? (
            <span className="font-medium text-zinc-700">
              {selectedCount.toLocaleString()} selected
            </span>
          ) : (
            <>
              <Icon name="clock" size={14} className="text-zinc-400" />
              {dataVersion && (
                <span className="font-mono text-zinc-500">{dataVersion}</span>
              )}
              {relativeTime && (
                <span className="text-zinc-400">· {relativeTime}</span>
              )}
            </>
          )}
        </div>

        {/* Right side: search + download */}
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <Icon
              name="search"
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Go to slide"
              aria-label="Go to slide"
              className="w-64 h-9 pl-8 pr-3 text-sm bg-white border border-zinc-200 rounded-md text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-300"
            />
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 h-9 px-3.5 text-sm font-semibold text-white bg-[#248637] hover:bg-[#1e7030] rounded-md transition-colors focus-ring cursor-pointer"
          >
            <Icon name="download" size={15} />
            Download
          </button>
        </div>
      </div>

      {/* Filter chips row (if any active) */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-zinc-200">
          {activeFeatureFilters.map((feature) => {
            const [min, max] = featureRanges[feature];
            return (
              <FilterChip
                key={feature}
                label={`${feature}: ${min.toFixed(1)}-${max.toFixed(1)}`}
                onRemove={() => onClearFeatureRange(feature)}
              />
            );
          })}
          <button
            onClick={onClearAll}
            className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Download dialog */}
      <DownloadDialog
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        filteredSlides={filteredSlides}
        selectedSlideIds={selectedSlideIds}
        featureNames={featureNames}
      />
    </div>
  );
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white text-zinc-700 text-xs rounded-full border border-zinc-200">
      <span className="truncate max-w-32">{label}</span>
      <button
        onClick={onRemove}
        className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-zinc-100 rounded-full transition-colors"
        aria-label="Clear filter"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </span>
  );
}
