import { useMemo } from 'react';
import type { TooltipData, Cluster, FeatureMetadata } from '../../types';

interface EmbeddingTooltipProps {
  data: TooltipData | null;
  colorBy: string;
  clusters?: Cluster[];
  featureMetadata?: FeatureMetadata[];
}

/** Compute robust z-score: (value - p50) / (p95 - p05) */
function robustZScore(
  value: number | null,
  meta: FeatureMetadata
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const spread = meta.quantiles.p95 - meta.quantiles.p05;
  if (spread === 0) return 0;
  return (value - meta.quantiles.p50) / spread;
}

interface TopFeature {
  displayName: string;
  absZ: number;
  rawValue: number;
}

export function EmbeddingTooltip({
  data,
  colorBy,
  clusters,
  featureMetadata,
}: EmbeddingTooltipProps) {
  // Build cluster name lookup
  const clusterNameById = useMemo(() => {
    const lookup: Record<string, string> = {};
    clusters?.forEach((c) => {
      lookup[c.id] = c.name;
    });
    return lookup;
  }, [clusters]);

  // Build feature display name lookup and metadata by name
  const { displayNameLookup, metadataByName } = useMemo(() => {
    const names: Record<string, string> = {};
    const metas: Record<string, FeatureMetadata> = {};
    featureMetadata?.forEach((fm) => {
      names[fm.name] = fm.displayName;
      metas[fm.name] = fm;
    });
    return { displayNameLookup: names, metadataByName: metas };
  }, [featureMetadata]);

  // Compute top 5 features by absolute robust z-score
  const topFeatures = useMemo<TopFeature[]>(() => {
    if (!data) return [];
    const { features } = data.slide;
    const scored: TopFeature[] = [];

    for (const [key, value] of Object.entries(features)) {
      if (value == null || !Number.isFinite(value)) continue;
      const meta = metadataByName[key];
      if (!meta) continue;
      const z = robustZScore(value, meta);
      if (z == null) continue;
      scored.push({
        displayName: displayNameLookup[key] || key,
        absZ: Math.abs(z),
        rawValue: value,
      });
    }

    scored.sort((a, b) => b.absZ - a.absZ);
    return scored.slice(0, 5);
  }, [data?.slide.id, metadataByName, displayNameLookup]);

  if (!data) return null;

  const { slide, screenX, screenY, color } = data;

  // Get cluster display name
  const clusterDisplayName = slide.clusterId
    ? clusterNameById[slide.clusterId] || `Cluster ${slide.clusterId}`
    : null;

  // Build the color-by label and value
  let colorByLabel: string;
  let colorByValue: string;
  if (colorBy === 'cancerType') {
    colorByLabel = 'Cancer type';
    colorByValue = slide.cancerType;
  } else if (colorBy === 'clusterId') {
    colorByLabel = 'Cluster';
    colorByValue = clusterDisplayName || 'N/A';
  } else if (colorBy === 'immuneSubtype') {
    colorByLabel = 'Immune subtype';
    colorByValue = slide.immuneSubtype || 'N/A';
  } else {
    // Feature
    colorByLabel = displayNameLookup[colorBy] || colorBy;
    const val = slide.features[colorBy];
    colorByValue =
      typeof val === 'number' && Number.isFinite(val) ? val.toFixed(3) : 'N/A';
  }

  // Color dot CSS
  const dotColor = color
    ? `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    : undefined;

  // Max absZ for bar width normalization
  const maxAbsZ = topFeatures.length > 0 ? topFeatures[0].absZ : 1;

  // Position tooltip with offset from cursor, keeping it on screen
  const offset = 12;
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: screenX + offset,
    top: screenY + offset,
    transform: 'none',
    maxWidth: `calc(100vw - ${screenX + offset + 16}px)`,
  };

  return (
    <div
      style={tooltipStyle}
      className="z-50 bg-white border border-zinc-200 rounded-lg shadow-lg pointer-events-none w-64"
    >
      {/* Header: slide ID + cancer badge */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <span className="font-medium text-sm text-zinc-900 truncate">
          {slide.id}
        </span>
        <span className="flex-shrink-0 text-[11px] font-medium bg-zinc-100 text-zinc-600 rounded px-1.5 py-0.5">
          {slide.cancerType}
        </span>
      </div>

      {/* Color-by value with dot */}
      <div className="flex items-center gap-2 px-3 pb-1">
        {dotColor && (
          <span
            className="flex-shrink-0 w-2 h-2 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span className="text-xs text-zinc-600">
          <span className="font-medium">{colorByLabel}:</span> {colorByValue}
        </span>
      </div>

      {/* Immune subtype (always shown when available and not already the color-by) */}
      {colorBy !== 'immuneSubtype' && slide.immuneSubtype && (
        <div className="px-3 pb-1">
          <span className="text-xs text-zinc-500">
            Immune: {slide.immuneSubtype}
          </span>
        </div>
      )}

      {/* Cluster (show if not already the color-by) */}
      {colorBy !== 'clusterId' && clusterDisplayName && (
        <div className="px-3 pb-1">
          <span className="text-xs text-zinc-500">
            Cluster: {clusterDisplayName}
          </span>
        </div>
      )}

      {/* Top features sparkline */}
      {topFeatures.length > 0 && (
        <>
          <div className="border-t border-zinc-100 mx-3 my-1" />
          <div className="px-3 pt-1 pb-2.5">
            <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium mb-1.5">
              Top features
            </div>
            <div className="space-y-1">
              {topFeatures.map((f) => {
                const widthPct =
                  maxAbsZ > 0
                    ? Math.round((f.absZ / maxAbsZ) * 100)
                    : 0;
                return (
                  <div key={f.displayName} className="flex items-center gap-1.5">
                    {/* Bar */}
                    <div className="w-12 h-1.5 bg-zinc-100 rounded-full flex-shrink-0 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    {/* Label + value */}
                    <span className="text-[11px] text-zinc-600 truncate flex-1 min-w-0">
                      {f.displayName}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 flex-shrink-0">
                      {f.rawValue.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
