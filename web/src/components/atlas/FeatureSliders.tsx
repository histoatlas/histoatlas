import { useState, useMemo } from 'react';
import { FeatureSlider } from './FeatureSlider';
import type { FeatureMetadata, FeatureCategory } from '../../types';

interface FeatureSlidersProps {
  features: FeatureMetadata[];
  featureRanges: Record<string, [number, number]>;
  onRangeChange: (feature: string, range: [number, number] | undefined) => void;
}

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  composition: 'Cell Composition',
  density: 'Cell Density',
  morphology: 'Morphology',
  spatial: 'Spatial Patterns',
  heterogeneity: 'Heterogeneity',
};

const CATEGORY_ORDER: FeatureCategory[] = [
  'composition',
  'density',
  'morphology',
  'spatial',
  'heterogeneity',
];

export function FeatureSliders({
  features,
  featureRanges,
  onRangeChange,
}: FeatureSlidersProps) {
  const [expandedCategories, setExpandedCategories] = useState<
    Set<FeatureCategory>
  >(new Set(['composition'])); // Default expand first category

  // Group features by category
  const groupedFeatures = useMemo(() => {
    const groups = new Map<FeatureCategory, FeatureMetadata[]>();

    for (const category of CATEGORY_ORDER) {
      groups.set(category, []);
    }

    for (const feature of features) {
      const category = feature.category;
      const group = groups.get(category);
      if (group) {
        group.push(feature);
      }
    }

    // Remove empty categories
    for (const [category, featureList] of groups) {
      if (featureList.length === 0) {
        groups.delete(category);
      }
    }

    return groups;
  }, [features]);

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

  // Count active filters per category
  const activeFilterCounts = useMemo(() => {
    const counts = new Map<FeatureCategory, number>();
    for (const [category, featureList] of groupedFeatures) {
      let count = 0;
      for (const feature of featureList) {
        if (featureRanges[feature.name] !== undefined) {
          count++;
        }
      }
      counts.set(category, count);
    }
    return counts;
  }, [groupedFeatures, featureRanges]);

  if (features.length === 0) {
    return (
      <div className="text-sm text-zinc-500 py-4">No features available</div>
    );
  }

  return (
    <div className="space-y-2">
      {CATEGORY_ORDER.filter((c) => groupedFeatures.has(c)).map((category) => {
        const featureList = groupedFeatures.get(category)!;
        const isExpanded = expandedCategories.has(category);
        const activeCount = activeFilterCounts.get(category) || 0;

        return (
          <div key={category} className="border border-zinc-200 rounded-lg">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 text-zinc-500 transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span className="text-sm font-medium text-zinc-700">
                  {CATEGORY_LABELS[category]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  {featureList.length} features
                </span>
                {activeCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                    {activeCount}
                  </span>
                )}
              </div>
            </button>

            {/* Feature sliders */}
            {isExpanded && (
              <div className="px-3 pb-2 border-t border-zinc-100">
                {featureList.map((feature) => (
                  <FeatureSlider
                    key={feature.name}
                    feature={feature}
                    value={featureRanges[feature.name]}
                    onChange={(range) => onRangeChange(feature.name, range)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
