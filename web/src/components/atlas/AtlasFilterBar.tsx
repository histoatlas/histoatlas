import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAtlasStore } from '../../stores/atlasStore';
import { CancerTypeSelect } from './CancerTypeSelect';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { FeatureSliders } from './FeatureSliders';
import { Icon } from '../ui/Icon';
import type { Slide, Cluster, ImmuneSubtype, FeatureMetadata } from '../../types';

interface AtlasFilterBarProps {
  slides: Slide[];
  clusters: Cluster[];
  cancerTypes: string[];
  immuneSubtypes: ImmuneSubtype[];
  featureMetadata: FeatureMetadata[];
  filteredCount: number;
  totalCount: number;
  isMultiCancerType: boolean;
}

export function AtlasFilterBar({
  slides,
  clusters,
  cancerTypes,
  immuneSubtypes,
  featureMetadata,
  filteredCount,
  totalCount,
  isMultiCancerType,
}: AtlasFilterBarProps) {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);

  const {
    cancerTypes: selectedCancerTypes,
    clusterIds: selectedClusterIds,
    immuneSubtypes: selectedImmuneSubtypes,
    stages: selectedStages,
    grades: selectedGrades,
    featureRanges,
    globalSearch,
    setCancerTypes,
    setClusterIds,
    setImmuneSubtypes,
    setStages,
    setGrades,
    setFeatureRange,
    clearFeatureRange,
    setGlobalSearch,
    clearFilters,
  } = useAtlasStore();

  // Close features popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        featuresRef.current &&
        !featuresRef.current.contains(event.target as Node)
      ) {
        setFeaturesOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cancer type counts
  const cancerTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slide of slides) {
      counts.set(slide.cancerType, (counts.get(slide.cancerType) || 0) + 1);
    }
    return counts;
  }, [slides]);

  // Cluster counts
  const clusterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slide of slides) {
      if (slide.clusterId) {
        counts.set(slide.clusterId, (counts.get(slide.clusterId) || 0) + 1);
      }
    }
    return counts;
  }, [slides]);

  // Cluster display names
  const clusterDisplayNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const cluster of clusters) {
      names[cluster.id] = cluster.name;
    }
    return names;
  }, [clusters]);

  // All cluster IDs
  const allClusterIds = useMemo(() => clusters.map((c) => c.id), [clusters]);

  // Immune subtype counts
  const immuneSubtypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slide of slides) {
      if (slide.immuneSubtype) {
        counts.set(
          slide.immuneSubtype,
          (counts.get(slide.immuneSubtype) || 0) + 1
        );
      }
    }
    return counts;
  }, [slides]);

  // Immune subtype display names
  const immuneSubtypeDisplayNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const ist of immuneSubtypes) {
      names[ist.id] = ist.name;
    }
    return names;
  }, [immuneSubtypes]);

  // All immune subtype IDs
  const allImmuneSubtypeIds = useMemo(
    () => immuneSubtypes.map((ist) => ist.id),
    [immuneSubtypes]
  );

  // Stage counts and options
  const { stageCounts, allStages } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slide of slides) {
      if (slide.stage) {
        counts.set(slide.stage, (counts.get(slide.stage) || 0) + 1);
      }
    }
    const sorted = Array.from(counts.keys()).sort();
    return { stageCounts: counts, allStages: sorted };
  }, [slides]);

  // Grade counts and options
  const { gradeCounts, allGrades } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slide of slides) {
      if (slide.grade) {
        counts.set(slide.grade, (counts.get(slide.grade) || 0) + 1);
      }
    }
    const sorted = Array.from(counts.keys()).sort();
    return { gradeCounts: counts, allGrades: sorted };
  }, [slides]);

  // Active feature range count
  const activeFeatureCount = Object.keys(featureRanges).length;

  // Total active filter count
  const totalActiveFilters =
    selectedCancerTypes.length +
    selectedClusterIds.length +
    selectedImmuneSubtypes.length +
    selectedStages.length +
    selectedGrades.length +
    activeFeatureCount +
    (globalSearch.length > 0 ? 1 : 0);

  const isFiltered = filteredCount < totalCount;

  // Feature range change handler
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

  // Remove individual filter pill
  const removeCancerType = (type: string) => {
    setCancerTypes(selectedCancerTypes.filter((t) => t !== type));
  };

  const removeCluster = (id: string) => {
    setClusterIds(selectedClusterIds.filter((c) => c !== id));
  };

  const removeImmuneSubtype = (subtype: string) => {
    setImmuneSubtypes(selectedImmuneSubtypes.filter((s) => s !== subtype));
  };

  const removeStage = (stage: string) => {
    setStages(selectedStages.filter((s) => s !== stage));
  };

  const removeGrade = (grade: string) => {
    setGrades(selectedGrades.filter((g) => g !== grade));
  };

  const removeSearch = () => {
    setGlobalSearch('');
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Filters + Search */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Cancer type dropdown */}
        {isMultiCancerType && (
          <CancerTypeSelect
            allTypes={cancerTypes}
            selectedTypes={selectedCancerTypes}
            counts={cancerTypeCounts}
            onChange={setCancerTypes}
          />
        )}

        {/* Cluster dropdown */}
        {clusters.length > 0 && (
          <MultiSelectDropdown
            label="Cluster"
            icon="waypoints"
            allOptions={allClusterIds}
            selectedOptions={selectedClusterIds}
            displayNames={clusterDisplayNames}
            counts={clusterCounts}
            onChange={setClusterIds}
          />
        )}

        {/* Immune subtype dropdown */}
        {immuneSubtypes.length > 0 && (
          <MultiSelectDropdown
            label="Immune Subtype"
            icon="shield-check"
            allOptions={allImmuneSubtypeIds}
            selectedOptions={selectedImmuneSubtypes}
            displayNames={immuneSubtypeDisplayNames}
            counts={immuneSubtypeCounts}
            onChange={setImmuneSubtypes}
          />
        )}

        {/* Stage dropdown */}
        {allStages.length > 0 && (
          <MultiSelectDropdown
            label="Stage"
            icon="activity"
            allOptions={allStages}
            selectedOptions={selectedStages}
            counts={stageCounts}
            onChange={setStages}
          />
        )}

        {/* Grade dropdown */}
        {allGrades.length > 0 && (
          <MultiSelectDropdown
            label="Grade"
            icon="bar-chart"
            allOptions={allGrades}
            selectedOptions={selectedGrades}
            counts={gradeCounts}
            onChange={setGrades}
          />
        )}

        {/* Features popover trigger */}
        {featureMetadata.length > 0 && (
          <div ref={featuresRef} className="relative">
            <button
              onClick={() => setFeaturesOpen(!featuresOpen)}
              className="flex items-center gap-2 px-3 h-9 bg-white border border-zinc-200 rounded-lg text-sm hover:border-zinc-300 transition-colors"
            >
              <Icon
                name="sliders-horizontal"
                size={14}
                className="text-zinc-400"
              />
              <span className="text-zinc-700">Features</span>
              {activeFeatureCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  {activeFeatureCount}
                </span>
              )}
              <Icon
                name="chevron-down"
                size={14}
                className={`text-zinc-400 transition-transform ${featuresOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {featuresOpen && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto p-3">
                <FeatureSliders
                  features={featureMetadata}
                  featureRanges={featureRanges}
                  onRangeChange={handleFeatureRangeChange}
                />
              </div>
            )}
          </div>
        )}

        {/* Search input — pushed right */}
        <div className="relative ml-auto">
          <Icon
            name="search"
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search slides..."
            aria-label="Search slides"
            className="w-64 h-9 pl-8 pr-3 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-300"
          />
          {globalSearch && (
            <button
              onClick={removeSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Active filter summary */}
      {isFiltered && totalActiveFilters > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">
            Showing{' '}
            <span className="font-medium text-zinc-700">
              {filteredCount.toLocaleString()}
            </span>{' '}
            of {totalCount.toLocaleString()} slides
          </span>

          <span className="text-zinc-300">·</span>

          {/* Cancer type pills */}
          {selectedCancerTypes.map((type) => (
            <span
              key={`ct-${type}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs"
            >
              {type}
              <button
                onClick={() => removeCancerType(type)}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="Remove filter"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}

          {/* Cluster pills */}
          {selectedClusterIds.map((id) => (
            <span
              key={`cl-${id}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs"
            >
              {clusterDisplayNames[id] || id}
              <button
                onClick={() => removeCluster(id)}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="Remove filter"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}

          {/* Immune subtype pills */}
          {selectedImmuneSubtypes.map((subtype) => (
            <span
              key={`is-${subtype}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs"
            >
              {immuneSubtypeDisplayNames[subtype] || subtype}
              <button
                onClick={() => removeImmuneSubtype(subtype)}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="Remove filter"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}

          {/* Stage pills */}
          {selectedStages.map((stage) => (
            <span
              key={`st-${stage}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs"
            >
              {stage}
              <button
                onClick={() => removeStage(stage)}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="Remove filter"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}

          {/* Grade pills */}
          {selectedGrades.map((grade) => (
            <span
              key={`gr-${grade}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs"
            >
              {grade}
              <button
                onClick={() => removeGrade(grade)}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="Remove filter"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}

          {/* Feature range pills */}
          {activeFeatureCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs">
              {activeFeatureCount} feature{activeFeatureCount > 1 ? 's' : ''}{' '}
              filtered
            </span>
          )}

          {/* Search pill */}
          {globalSearch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs">
              &ldquo;{globalSearch}&rdquo;
              <button
                onClick={removeSearch}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="Remove filter"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          )}

          <span className="text-zinc-300">·</span>

          <button
            onClick={clearFilters}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
