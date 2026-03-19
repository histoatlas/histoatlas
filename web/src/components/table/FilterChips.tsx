interface FilterChipsProps {
  featureRanges: Record<string, [number, number]>;
  onClearFeatureRange: (feature: string) => void;
  onClearAll: () => void;
}

/**
 * Row of active filter chips shown above the table when filters are active.
 */
export function FilterChips({
  featureRanges,
  onClearFeatureRange,
  onClearAll,
}: FilterChipsProps) {
  const features = Object.keys(featureRanges);

  return (
    <div className="flex items-center gap-2 mb-3">
      {features.map((feature) => {
        const [min, max] = featureRanges[feature];
        return (
          <span
            key={feature}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white text-zinc-700 text-xs rounded-full border border-zinc-200"
          >
            <span className="truncate max-w-32">
              {feature}: {min.toFixed(1)}-{max.toFixed(1)}
            </span>
            <button
              onClick={() => onClearFeatureRange(feature)}
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
      })}
      <button
        onClick={onClearAll}
        className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
