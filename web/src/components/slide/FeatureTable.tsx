import { useState, useMemo } from 'react';
import type { FeatureCategory, FeatureMetadata } from '../../types';
import { getDatasetAndCohortFromPath } from '../../hooks/useCohort';
import { formatOrdinal } from '../../lib/formatters';
import { Skeleton, SkeletonTable } from '../ui/Skeleton';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Icon } from '../ui/Icon';
import { MiniHistogram } from '../ui/MiniHistogram';

interface FeatureTableProps {
  features: Record<string, number | null> | undefined;
  percentiles: Record<string, number> | undefined;
  featureMetadata: FeatureMetadata[] | undefined;
  isLoading: boolean;
  cancerType?: string;
}

// Category display names and colors
const CATEGORY_CONFIG: Record<
  FeatureCategory,
  { label: string; color: string }
> = {
  composition: { label: 'Composition', color: '#3b82f6' },
  density: { label: 'Density', color: '#10b981' },
  morphology: { label: 'Morphology', color: '#f59e0b' },
  spatial: { label: 'Spatial', color: '#8b5cf6' },
  heterogeneity: { label: 'Heterogeneity', color: '#ef4444' },
};

export function FeatureTable({
  features,
  percentiles,
  featureMetadata,
  isLoading,
  cancerType,
}: FeatureTableProps) {
  const { dataset, cohort } = getDatasetAndCohortFromPath();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<
    Set<FeatureCategory>
  >(new Set(['composition', 'density', 'morphology', 'spatial', 'heterogeneity']));

  // Group features by category
  const groupedFeatures = useMemo(() => {
    if (!features || !featureMetadata) {
      return new Map<FeatureCategory, FeatureMetadata[]>();
    }

    const groups = new Map<FeatureCategory, FeatureMetadata[]>();

    for (const meta of featureMetadata) {
      // Filter by search query
      if (
        searchQuery &&
        !meta.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !meta.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        continue;
      }

      const category = meta.category;
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(meta);
    }

    return groups;
  }, [features, featureMetadata, searchQuery]);

  const toggleCategory = (category: FeatureCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-100">
          <Skeleton className="h-9 w-full" />
        </div>
        <SkeletonTable rows={10} columns={4} />
      </div>
    );
  }

  if (!features || !percentiles || !featureMetadata) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center text-zinc-500">
        No feature data available
      </div>
    );
  }

  const categories = Object.keys(CATEGORY_CONFIG) as FeatureCategory[];

  return (
    <div className="bg-white border border-zinc-200 rounded-lg">
      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <Icon name="bar-chart" size={18} className="text-zinc-400" />
          Histomics
          <InfoTooltip text="Quantitative features extracted from this slide. The histogram shows pancancer distribution, with the colored bar indicating where this slide falls. Percentile shows rank compared to all slides." />
        </h2>
      </div>

      {/* Search header */}
      <div className="px-4 pb-4">
        <input
          type="text"
          placeholder="Search features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search features"
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Feature groups */}
      <div>
        {categories.map((category) => {
          const categoryFeatures = groupedFeatures.get(category);
          if (!categoryFeatures || categoryFeatures.length === 0) {
            return null;
          }

          const config = CATEGORY_CONFIG[category];
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-2 bg-zinc-50 border-b border-zinc-100 hover:bg-zinc-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-sm font-medium text-zinc-700">
                    {config.label}
                  </span>
                  <span className="text-xs text-zinc-400">
                    ({categoryFeatures.length})
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Feature rows */}
              {isExpanded && (
                <div>
                  {categoryFeatures.map((meta) => {
                    const value = features[meta.name];
                    const percentile = percentiles[meta.name] ?? 0;

                    const histomicsHref = `/${dataset}/${cohort}/histomics/${encodeURIComponent(meta.name)}/`;

                    return (
                      <a
                        key={meta.name}
                        href={histomicsHref}
                        className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-50 hover:bg-blue-50 text-sm gap-4 transition-colors group"
                      >
                        {/* Feature name - no truncation */}
                        <span className="text-zinc-700 flex-shrink-0 group-hover:text-blue-700">
                          {meta.displayName}
                        </span>

                        {/* Right side: Value | Unit | Histogram | Percentile (fixed-width columns) */}
                        <div className="flex items-center">
                          {/* Value, right-aligned, fixed width */}
                          <span className="w-16 text-right font-mono text-zinc-600 tabular-nums">
                            {value !== null && value !== undefined
                              ? value.toFixed(3)
                              : '-'}
                          </span>

                          {/* Unit, left-aligned, fixed width */}
                          <span className="w-24 pl-1.5 text-left text-xs text-zinc-400">
                            {value !== null && value !== undefined && meta.unit
                              ? meta.unit
                              : ''}
                          </span>

                          {/* Histogram */}
                          <div className="w-20 ml-2">
                            {meta.histogramBins && meta.histogramBins.length > 0 ? (
                              <MiniHistogram
                                bins={meta.histogramBins}
                                percentile={percentile}
                                color={config.color}
                              />
                            ) : (
                              <div className="h-6" />
                            )}
                          </div>

                          {/* Percentile text */}
                          <span className="w-28 ml-4 text-right text-xs text-zinc-500 whitespace-nowrap">
                            {formatOrdinal(percentile)} percentile
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state when no matches */}
      {groupedFeatures.size === 0 && (
        <div className="p-8 text-center text-zinc-500">
          No features match "{searchQuery}"
        </div>
      )}
    </div>
  );
}
