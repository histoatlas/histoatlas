import { useMemo, useState, useCallback } from 'react';
import { lineRadial, curveLinearClosed } from 'd3-shape';
import { CLUSTER_COLORS } from '../../lib/colors';
import { formatOrdinal } from '../../lib/formatters';
import { Skeleton } from '../ui/Skeleton';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Icon } from '../ui/Icon';
import type { AtlasDataResponse, FeatureCategory } from '../../types';

interface FeatureRadarChartProps {
  clusterId?: string;
  atlasData?: AtlasDataResponse;
  isLoading: boolean;
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

export function FeatureRadarChart({
  clusterId,
  atlasData,
  isLoading,
}: FeatureRadarChartProps) {
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

  const clusterIndex = clusterId ? Number(clusterId) : NaN;
  const clusterColor = !isNaN(clusterIndex)
    ? CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length]
    : '#3b82f6';

  const pathGenerator = useMemo(() => {
    return lineRadial<[number, number]>()
      .angle((d) => d[0])
      .radius((d) => d[1])
      .curve(curveLinearClosed);
  }, []);

  const { dataPath, dataPoints, categoryFeaturesList } = useMemo(() => {
    if (!atlasData || !clusterId || !atlasData.featureMetadata) {
      return { dataPath: '', dataPoints: [], categoryFeaturesList: [] };
    }

    const clusterSlides = atlasData.slides.filter(
      (s) => s.clusterId === clusterId
    );
    if (clusterSlides.length === 0) {
      return { dataPath: '', dataPoints: [], categoryFeaturesList: [] };
    }

    const featureMeta = atlasData.featureMetadata;

    // Group features by category
    const featuresByCategory = new Map<FeatureCategory, typeof featureMeta>();
    for (const meta of featureMeta) {
      const list = featuresByCategory.get(meta.category) ?? [];
      list.push(meta);
      featuresByCategory.set(meta.category, list);
    }

    const points: [number, number][] = [];
    const dataPoints: { x: number; y: number; angle: number; label: string; value: number }[] =
      [];
    const categoryFeaturesList: { displayName: string; percentile: number }[][] = [];

    CATEGORIES.forEach((category, i) => {
      const categoryFeatures = featuresByCategory.get(category) ?? [];

      // Compute mean percentile across all features in this category
      let percentileSum = 0;
      let percentileCount = 0;
      const featureDetails: { displayName: string; percentile: number }[] = [];

      for (const meta of categoryFeatures) {
        if (meta.max === meta.min) continue;

        // Compute cluster mean for this feature
        let featureSum = 0;
        let featureN = 0;
        for (const slide of clusterSlides) {
          const val = slide.features[meta.name];
          if (val != null) {
            featureSum += val;
            featureN++;
          }
        }
        if (featureN === 0) continue;

        const mean = featureSum / featureN;
        const pct = Math.max(
          0,
          Math.min(100, ((mean - meta.min) / (meta.max - meta.min)) * 100)
        );
        percentileSum += pct;
        percentileCount++;
        featureDetails.push({ displayName: meta.displayName, percentile: pct });
      }

      featureDetails.sort((a, b) => b.percentile - a.percentile);
      categoryFeaturesList.push(featureDetails);

      const percentile = percentileCount > 0 ? percentileSum / percentileCount : 50;

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
  }, [atlasData, clusterId, pathGenerator, cx, cy, maxRadius]);


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

  if (dataPoints.length === 0) return null;

  const axes = CATEGORIES.map((category, i) => {
    const angle = (i / CATEGORIES.length) * 2 * Math.PI - Math.PI / 2;
    const x2 = cx + Math.cos(angle) * maxRadius;
    const y2 = cy + Math.sin(angle) * maxRadius;
    const labelRadius = maxRadius + 24;
    const labelX = cx + Math.cos(angle) * labelRadius;
    const labelY = cy + Math.sin(angle) * labelRadius;
    return { x2, y2, labelX, labelY, label: CATEGORY_LABELS[category] };
  });

  const circles = [0.25, 0.5, 0.75, 1.0].map((pct) => ({
    radius: pct * maxRadius,
  }));

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
        <Icon name="fingerprint" size={18} className="text-zinc-400" />
        Histomic Fingerprint
        <InfoTooltip text="Radar chart of this cluster's average histomic feature values (as percentiles). Each axis represents a key morphological dimension across all slides in the cluster." />
      </h2>
      <div className="flex justify-center">
        <div className="relative">
          <svg width={size} height={size} className="overflow-visible" role="img" aria-label={`Histomic morphology fingerprint for cancer cluster ${clusterId}, showing percentile scores: ${dataPoints.map(p => `${p.label} ${p.value.toFixed(0)}%`).join(', ')}`}>
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
              fill={`${clusterColor}33`}
              stroke={clusterColor}
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
                fill={clusterColor}
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
      </div>
    </div>
  );
}
