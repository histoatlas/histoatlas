import { useMemo, useState, useCallback } from 'react';
import { lineRadial, curveLinearClosed } from 'd3-shape';
import type { FeatureCategory, FeatureMetadata } from '../../types';
import { Skeleton } from '../ui/Skeleton';
import { Icon } from '../ui/Icon';
import { InfoTooltip } from '../ui/InfoTooltip';
import { formatOrdinal } from '../../lib/formatters';

interface HistomicFingerprintProps {
  features: Record<string, number | null> | undefined;
  percentiles: Record<string, number> | undefined;
  featureMetadata?: FeatureMetadata[];
  isLoading?: boolean;
}

const CATEGORIES: FeatureCategory[] = [
  'composition',
  'density',
  'morphology',
  'spatial',
  'heterogeneity',
];

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  composition: 'Composition',
  density: 'Density',
  morphology: 'Morphology',
  spatial: 'Spatial',
  heterogeneity: 'Heterogeneity',
};

export function HistomicFingerprint({
  features,
  percentiles,
  featureMetadata,
  isLoading,
}: HistomicFingerprintProps) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 104;

  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleAxisEnter = useCallback((index: number) => {
    setHoveredCategory(index);
  }, []);

  const handleAxisMove = useCallback((e: React.MouseEvent<SVGPathElement>) => {
    const svg = e.currentTarget.closest('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleAxisLeave = useCallback(() => {
    setHoveredCategory(null);
    setTooltipPos(null);
  }, []);

  const pathGenerator = useMemo(() => {
    return lineRadial<[number, number]>()
      .angle((d) => d[0])
      .radius((d) => d[1])
      .curve(curveLinearClosed);
  }, []);

  const { dataPath, dataPoints, categoryFeaturesList } = useMemo(() => {
    if (!percentiles || !featureMetadata) {
      return { dataPath: '', dataPoints: [], categoryFeaturesList: [] };
    }

    // Group features by category
    const featuresByCategory = new Map<FeatureCategory, FeatureMetadata[]>();
    for (const meta of featureMetadata) {
      const list = featuresByCategory.get(meta.category) ?? [];
      list.push(meta);
      featuresByCategory.set(meta.category, list);
    }

    const points: [number, number][] = [];
    const dataPoints: { x: number; y: number; angle: number; label: string; value: number }[] =
      [];
    const categoryFeaturesList: { displayName: string; percentile: number }[][] = [];

    CATEGORIES.forEach((category, i) => {
      const categoryMetas = featuresByCategory.get(category) ?? [];

      // Mean percentile across all features in this category
      let sum = 0;
      let count = 0;
      const featureDetails: { displayName: string; percentile: number }[] = [];
      for (const meta of categoryMetas) {
        const pct = percentiles[meta.name];
        if (pct != null) {
          sum += pct;
          count++;
          featureDetails.push({ displayName: meta.displayName, percentile: pct });
        }
      }
      featureDetails.sort((a, b) => b.percentile - a.percentile);
      categoryFeaturesList.push(featureDetails);

      const percentile = count > 0 ? sum / count : 50;

      const angle = (i / CATEGORIES.length) * 2 * Math.PI - Math.PI / 2;
      const radius = (percentile / 100) * maxRadius;

      points.push([angle + Math.PI / 2, radius]);

      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      dataPoints.push({
        x,
        y,
        angle,
        label: CATEGORY_LABELS[category],
        value: percentile,
      });
    });

    return { dataPath: pathGenerator(points) || '', dataPoints, categoryFeaturesList };
  }, [percentiles, featureMetadata, pathGenerator, cx, cy, maxRadius]);

  const { highFeatures, lowFeatures } = useMemo(() => {
    if (!percentiles || !featureMetadata) return { highFeatures: [], lowFeatures: [] };

    const all = featureMetadata
      .filter((meta) => percentiles[meta.name] != null)
      .map((meta) => ({
        name: meta.displayName,
        percentile: percentiles[meta.name],
        polarity: Math.abs(percentiles[meta.name] - 50),
        isHigh: percentiles[meta.name] > 50,
      }));

    const high = all.filter((f) => f.isHigh).sort((a, b) => b.polarity - a.polarity).slice(0, 3);
    const low = all.filter((f) => !f.isHigh).sort((a, b) => b.polarity - a.polarity).slice(0, 3);

    return { highFeatures: high, lowFeatures: low };
  }, [percentiles, featureMetadata]);

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="flex justify-center">
          <Skeleton className="w-48 h-48 rounded-full" />
        </div>
      </div>
    );
  }

  if (!features || !percentiles || !featureMetadata) {
    return null;
  }

  // Generate axis lines and labels
  const axes = CATEGORIES.map((category, i) => {
    const angle = (i / CATEGORIES.length) * 2 * Math.PI - Math.PI / 2;
    const x2 = cx + Math.cos(angle) * maxRadius;
    const y2 = cy + Math.sin(angle) * maxRadius;

    const labelRadius = maxRadius + 24;
    const labelX = cx + Math.cos(angle) * labelRadius;
    const labelY = cy + Math.sin(angle) * labelRadius;

    return { x2, y2, labelX, labelY, label: CATEGORY_LABELS[category] };
  });

  // Concentric circles at 25%, 50%, 75%, 100%
  const circles = [0.25, 0.5, 0.75, 1.0].map((pct) => ({
    radius: pct * maxRadius,
    label: `${pct * 100}%`,
  }));

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
        <Icon name="fingerprint" size={18} className="text-zinc-400" />
        Histomic Fingerprint
        <InfoTooltip text="Radar chart of this slide's histomic feature values (as percentiles). Each axis represents a key morphological dimension." />
      </h2>
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="flex-shrink-0 ml-4 relative">
          <svg width={size} height={size} className="overflow-visible" role="img" aria-label={`Histomic morphology fingerprint for this histopathology slide, showing percentile scores: ${dataPoints.map(p => `${p.label} ${p.value.toFixed(0)}%`).join(', ')}`}>
            {/* Concentric circles */}
            {circles.map((circle, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={circle.radius}
                fill="none"
                stroke="#e4e4e7"
                strokeWidth={1}
                style={{
                  opacity: hoveredCategory != null ? 0.3 : 1,
                  transition: 'opacity 150ms ease',
                }}
              />
            ))}

            {/* Axis lines */}
            {axes.map((axis, i) => (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={axis.x2}
                y2={axis.y2}
                stroke="#d4d4d8"
                strokeWidth={1}
                style={{
                  opacity: hoveredCategory != null && hoveredCategory !== i ? 0.3 : 1,
                  transition: 'opacity 150ms ease',
                }}
              />
            ))}

            {/* Data polygon */}
            <path
              d={dataPath}
              transform={`translate(${cx}, ${cy})`}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={2}
              style={{
                opacity: hoveredCategory != null ? 0.3 : 1,
                transition: 'opacity 150ms ease',
              }}
            />

            {/* Data points */}
            {dataPoints.map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r={4}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={2}
                style={{
                  opacity: hoveredCategory != null && hoveredCategory !== i ? 0.3 : 1,
                  transition: 'opacity 150ms ease',
                }}
              />
            ))}
            {/* Percentile labels */}
            {dataPoints.map((point, i) => (
              <text
                key={`pct-${i}`}
                x={point.x + Math.cos(point.angle) * 14}
                y={point.y + Math.sin(point.angle) * 14}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[10px] fill-zinc-900 font-bold"
                style={{
                  opacity: hoveredCategory != null && hoveredCategory !== i ? 0.3 : 1,
                  transition: 'opacity 150ms ease',
                }}
              >
                {point.value.toFixed(0)}%
              </text>
            ))}

            {/* Axis labels */}
            {axes.map((axis, i) => (
              <text
                key={i}
                x={axis.labelX}
                y={axis.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[10px] fill-zinc-600"
                style={{
                  opacity: hoveredCategory != null && hoveredCategory !== i ? 0.3 : 1,
                  transition: 'opacity 150ms ease',
                }}
              >
                {axis.label}
              </text>
            ))}

            {/* Invisible pie-slice hit zones for hover detection */}
            {CATEGORIES.map((_, i) => {
              const n = CATEGORIES.length;
              const startAngle = ((i - 0.5) / n) * 2 * Math.PI - Math.PI / 2;
              const endAngle = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
              const r = maxRadius + 28;
              const x1 = cx + Math.cos(startAngle) * r;
              const y1 = cy + Math.sin(startAngle) * r;
              const x2 = cx + Math.cos(endAngle) * r;
              const y2 = cy + Math.sin(endAngle) * r;
              const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
              const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              return (
                <path
                  key={`hit-${i}`}
                  d={d}
                  fill="transparent"
                  cursor="pointer"
                  onMouseEnter={() => handleAxisEnter(i)}
                  onMouseMove={handleAxisMove}
                  onMouseLeave={handleAxisLeave}
                />
              );
            })}
          </svg>

          {/* Category hover tooltip */}
          {hoveredCategory != null && tooltipPos && categoryFeaturesList[hoveredCategory] && (
            <div
              className="absolute pointer-events-none z-10 bg-zinc-800 text-white rounded-lg px-3 py-2 text-xs shadow-lg"
              style={{
                left: tooltipPos.x + 12,
                top: tooltipPos.y - 8,
                maxWidth: 220,
              }}
            >
              <div className="font-semibold mb-1.5">{CATEGORY_LABELS[CATEGORIES[hoveredCategory]]}</div>
              <div className="space-y-0.5">
                {categoryFeaturesList[hoveredCategory].map((f) => (
                  <div key={f.displayName} className="flex justify-between gap-3">
                    <span className="text-zinc-300 truncate">{f.displayName}</span>
                    <span className="font-mono text-white shrink-0">{formatOrdinal(f.percentile)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(highFeatures.length > 0 || lowFeatures.length > 0) && (
          <div className="flex-1 min-w-0 border-t border-zinc-100 pt-4 md:border-t-0 md:pt-2 space-y-3">
            {highFeatures.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                  High
                </h3>
                <div className="space-y-1">
                  {highFeatures.map((feat) => (
                    <div key={feat.name} className="flex items-center gap-1.5">
                      <Icon name="arrow-up" size={14} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-sm text-zinc-700 truncate">
                        {feat.name}
                        <span className="font-mono text-xs text-zinc-400 ml-1.5">
                          {formatOrdinal(feat.percentile)} percentile
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lowFeatures.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                  Low
                </h3>
                <div className="space-y-1">
                  {lowFeatures.map((feat) => (
                    <div key={feat.name} className="flex items-center gap-1.5">
                      <Icon name="arrow-down" size={14} className="text-red-500 flex-shrink-0" />
                      <span className="text-sm text-zinc-700 truncate">
                        {feat.name}
                        <span className="font-mono text-xs text-zinc-400 ml-1.5">
                          {formatOrdinal(feat.percentile)} percentile
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
