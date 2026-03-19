import { useMemo } from 'react';
import { ColorLegend } from './ColorLegend';
import { FeatureSliders } from './FeatureSliders';
import type { Slide, FeatureMetadata } from '../../types';
import type { LegendInfo } from '../../hooks/useColorScale';
import { getCancerTypeCounts } from '../../lib/filtering';

interface SidebarProps {
  legend: LegendInfo;
  filteredSlides: Slide[];
  totalSlides: number;
  featureMetadata: FeatureMetadata[];
  featureRanges: Record<string, [number, number]>;
  onFeatureRangeChange: (feature: string, range: [number, number] | undefined) => void;
}

export function Sidebar({
  legend,
  filteredSlides,
  totalSlides,
  featureMetadata,
  featureRanges,
  onFeatureRangeChange,
}: SidebarProps) {
  return (
    <aside className="w-72 flex-shrink-0 bg-white border-l border-zinc-200 flex flex-col overflow-hidden">
      {/* Selection stats */}
      <div className="p-4 border-b border-zinc-100">
        <SelectionStats
          filteredSlides={filteredSlides}
          totalSlides={totalSlides}
        />
      </div>

      {/* Color legend */}
      <div className="p-4 border-b border-zinc-100">
        <ColorLegend legend={legend} />
      </div>

      {/* Feature filters */}
      {featureMetadata.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-zinc-700 mb-3">
            Feature Filters
          </h3>
          <FeatureSliders
            features={featureMetadata}
            featureRanges={featureRanges}
            onRangeChange={onFeatureRangeChange}
          />
        </div>
      )}
    </aside>
  );
}

interface SelectionStatsProps {
  filteredSlides: Slide[];
  totalSlides: number;
}

function SelectionStats({ filteredSlides, totalSlides }: SelectionStatsProps) {
  const isFiltered = filteredSlides.length < totalSlides;
  const percentage = totalSlides > 0
    ? ((filteredSlides.length / totalSlides) * 100).toFixed(1)
    : '0';

  // Cancer type breakdown for filtered slides
  const cancerBreakdown = useMemo(() => {
    const counts = getCancerTypeCounts(filteredSlides);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [filteredSlides]);

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-zinc-900">
          {filteredSlides.length.toLocaleString()}
        </span>
        <span className="text-sm text-zinc-500">
          {isFiltered ? `of ${totalSlides.toLocaleString()}` : 'slides'}
        </span>
      </div>

      {isFiltered && (
        <div className="mt-1 text-xs text-zinc-500">{percentage}% of total</div>
      )}

      {/* Top cancer types */}
      {cancerBreakdown.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Top Cancer Types
          </div>
          {cancerBreakdown.map(([type, count]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-zinc-700">{type}</span>
              <span className="text-zinc-400">{count}</span>
            </div>
          ))}
          {cancerBreakdown.length < getCancerTypeCounts(filteredSlides).size && (
            <div className="text-xs text-zinc-400">
              +{getCancerTypeCounts(filteredSlides).size - cancerBreakdown.length} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
