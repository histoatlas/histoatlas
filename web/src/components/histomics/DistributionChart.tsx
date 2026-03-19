import { useState, useMemo, useCallback } from 'react';
import { scaleLinear, scaleOrdinal } from 'd3-scale';
import { extent } from 'd3-array';
import { area, curveBasis } from 'd3-shape';

const CANCER_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#e11d48',
];
const OTHER_COLOR = '#a1a1aa';
const SINGLE_COLOR = '#3b82f6';
const MAX_CANCER_TYPES = 10;

interface DistributionChartProps {
  values: number[];
  /** Cancer type per value (same length as values). */
  cancerTypes: string[];
  isPancan: boolean;
  /** Feature name for x-axis label. */
  featureLabel?: string;
}

/** Gaussian KDE with Silverman bandwidth. */
function gaussianKde(values: number[], nPoints = 60): { x: number; density: number }[] {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const bandwidth = 1.06 * std * n ** -0.2;

  if (bandwidth === 0 || !isFinite(bandwidth)) {
    return [{ x: mean, density: 1 }];
  }

  const [min, max] = extent(values) as [number, number];
  const pad = (max - min) * 0.1 || bandwidth;
  const step = (max - min + 2 * pad) / (nPoints - 1);

  const points: { x: number; density: number }[] = [];
  for (let i = 0; i < nPoints; i++) {
    const x = min - pad + i * step;
    let density = 0;
    for (const v of values) {
      const z = (x - v) / bandwidth;
      density += Math.exp(-0.5 * z * z);
    }
    density /= n * bandwidth * Math.sqrt(2 * Math.PI);
    points.push({ x, density });
  }
  return points;
}

export function DistributionChart({ values, cancerTypes, isPancan, featureLabel }: DistributionChartProps) {
  const width = 480;
  const height = 172;
  const margin = { top: 4, right: 12, bottom: 40, left: 44 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const [hoveredBin, setHoveredBin] = useState<number | null>(null);

  const handleBinEnter = useCallback((bi: number) => setHoveredBin(bi), []);
  const handleBinLeave = useCallback(() => setHoveredBin(null), []);

  const chartData = useMemo(() => {
    if (values.length === 0) return null;

    const [min, max] = extent(values) as [number, number];
    // Sturges' rule, clamped to 15-40
    const binCount = Math.max(15, Math.min(40, Math.ceil(Math.log2(values.length) + 1)));
    const binWidth = (max - min) / binCount || 1;

    const xScale = scaleLinear()
      .domain([min - binWidth * 0.5, max + binWidth * 0.5])
      .range([0, innerW]);

    // Build bins
    const bins: { x0: number; x1: number; counts: Record<string, number>; total: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      const x0 = min + i * binWidth;
      const x1 = x0 + binWidth;
      bins.push({ x0, x1, counts: {}, total: 0 });
    }

    // Determine top cancer types for PANCAN
    let topTypes: string[] = [];
    let colorScale: ReturnType<typeof scaleOrdinal<string, string>> | null = null;
    if (isPancan) {
      const typeCounts: Record<string, number> = {};
      for (const ct of cancerTypes) {
        typeCounts[ct] = (typeCounts[ct] ?? 0) + 1;
      }
      topTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_CANCER_TYPES)
        .map(([ct]) => ct);
      const allTypes = [...topTypes, 'Other'];
      colorScale = scaleOrdinal<string, string>()
        .domain(allTypes)
        .range([...CANCER_COLORS.slice(0, topTypes.length), OTHER_COLOR]);
    }

    const topTypesSet = new Set(topTypes);

    // Fill bins
    for (let vi = 0; vi < values.length; vi++) {
      const v = values[vi];
      let bi = Math.floor((v - min) / binWidth);
      if (bi >= binCount) bi = binCount - 1;
      if (bi < 0) bi = 0;
      const group = isPancan
        ? (topTypesSet.has(cancerTypes[vi]) ? cancerTypes[vi] : 'Other')
        : '_all';
      bins[bi].counts[group] = (bins[bi].counts[group] ?? 0) + 1;
      bins[bi].total += 1;
    }

    // Normalize histogram to density: density = count / (n * binWidth)
    const n = values.length;
    const maxDensityHist = Math.max(...bins.map((b) => b.total / (n * binWidth)), 1e-10);

    // KDE for single cancer mode
    let kde: { x: number; density: number }[] | null = null;
    if (!isPancan && n >= 10) {
      kde = gaussianKde(values);
    }
    const maxDensityKde = kde ? Math.max(...kde.map((p) => p.density), 1e-10) : 0;

    // Unified density y-scale for both histogram and KDE
    const maxDensity = Math.max(maxDensityHist, maxDensityKde, 1e-10);
    const yScale = scaleLinear().domain([0, maxDensity]).range([innerH, 0]).nice();

    // Stats
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    return {
      bins,
      xScale,
      yScale,
      kde,
      colorScale,
      topTypes,
      binWidth,
      mean,
      median,
      n,
    };
  }, [values, cancerTypes, isPancan, innerW, innerH]);

  if (!chartData || values.length === 0) {
    return (
      <div className="text-xs text-zinc-500 py-8 text-center">No data available for this feature.</div>
    );
  }

  const { bins, xScale, yScale, kde, colorScale, topTypes, binWidth, mean, median, n: totalN } = chartData;

  // Stacking order for PANCAN
  const stackKeys = isPancan ? [...topTypes, 'Other'] : ['_all'];

  // Build KDE path (using unified density yScale)
  let kdePath = '';
  if (kde && !isPancan) {
    const areaGen = area<{ x: number; density: number }>()
      .x((d) => xScale(d.x))
      .y0(innerH)
      .y1((d) => yScale(d.density))
      .curve(curveBasis);
    kdePath = areaGen(kde) ?? '';
  }

  // Tooltip data for hovered bin
  const hoveredData = hoveredBin != null ? bins[hoveredBin] : null;

  return (
    <div className="max-w-2xl relative overflow-visible">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Distribution of histomic feature ${featureLabel ?? 'feature'} across ${totalN} cancer samples: median ${median.toPrecision(3)}, mean ${mean.toPrecision(3)}`}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Y gridlines */}
          {yScale.ticks(4).map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={innerW}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#e4e4e7"
              strokeWidth={1}
            />
          ))}

          {/* Y axis ticks */}
          {yScale.ticks(4).map((tick) => (
            <text
              key={tick}
              x={-4}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[9px] fill-zinc-500"
            >
              {tick.toPrecision(2)}
            </text>
          ))}

          {/* Y axis label */}
          <text
            x={-innerH / 2}
            y={-32}
            textAnchor="middle"
            className="text-[9px] fill-zinc-500"
            transform="rotate(-90)"
          >
            Density
          </text>

          {/* Histogram bars */}
          {bins.map((bin, bi) => {
            const x0 = xScale(bin.x0);
            const x1 = xScale(bin.x1);
            const barW = Math.max(x1 - x0 - 1, 1);
            const isHovered = hoveredBin === bi;
            const isDimmed = hoveredBin != null && !isHovered;

            if (isPancan) {
              // Stacked bars (density-normalized)
              let cumDensity = 0;
              return (
                <g key={bi}>
                  {stackKeys.map((key) => {
                    const count = bin.counts[key] ?? 0;
                    if (count === 0) return null;
                    const countDensity = count / (totalN * binWidth);
                    const y0 = yScale(cumDensity);
                    const y1 = yScale(cumDensity + countDensity);
                    cumDensity += countDensity;
                    return (
                      <rect
                        key={key}
                        x={x0 + 0.5}
                        y={y1}
                        width={barW}
                        height={y0 - y1}
                        fill={colorScale!(key)}
                        fillOpacity={isDimmed ? 0.3 : isHovered ? 0.9 : 0.7}
                        stroke={colorScale!(key)}
                        strokeWidth={0.5}
                        style={{ transition: 'fill-opacity 100ms' }}
                      />
                    );
                  })}
                  {/* Transparent hit area covering full bin height */}
                  <rect
                    x={x0}
                    y={0}
                    width={x1 - x0}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => handleBinEnter(bi)}
                    onMouseLeave={handleBinLeave}
                  />
                </g>
              );
            }

            // Single color bars (density-normalized)
            const density = bin.total / (totalN * binWidth);
            return (
              <g key={bi}>
                <rect
                  x={x0 + 0.5}
                  y={yScale(density)}
                  width={barW}
                  height={innerH - yScale(density)}
                  fill={SINGLE_COLOR}
                  fillOpacity={isDimmed ? 0.3 : isHovered ? 0.9 : 0.7}
                  stroke={SINGLE_COLOR}
                  strokeWidth={0.5}
                  style={{ transition: 'fill-opacity 100ms' }}
                />
                {/* Transparent hit area */}
                <rect
                  x={x0}
                  y={0}
                  width={x1 - x0}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => handleBinEnter(bi)}
                  onMouseLeave={handleBinLeave}
                />
              </g>
            );
          })}

          {/* KDE overlay for single cancer */}
          {kdePath && (
            <path
              d={kdePath}
              fill={SINGLE_COLOR}
              fillOpacity={0.15}
              stroke={SINGLE_COLOR}
              strokeWidth={1.5}
              className="pointer-events-none"
            />
          )}

          {/* Mean line (dashed) */}
          <line
            x1={xScale(mean)}
            x2={xScale(mean)}
            y1={0}
            y2={innerH}
            stroke="#71717a"
            strokeWidth={1}
            strokeDasharray="3 2"
            className="pointer-events-none"
          />

          {/* Median line (solid) */}
          <line
            x1={xScale(median)}
            x2={xScale(median)}
            y1={0}
            y2={innerH}
            stroke="#18181b"
            strokeWidth={1.5}
            className="pointer-events-none"
          />

          {/* X axis ticks */}
          {xScale.ticks(6).map((tick) => (
            <g key={tick}>
              <line
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={innerH}
                y2={innerH + 3}
                stroke="#a1a1aa"
                strokeWidth={1}
              />
              <text
                x={xScale(tick)}
                y={innerH + 12}
                textAnchor="middle"
                className="text-[9px] fill-zinc-500"
              >
                {tick.toPrecision(3)}
              </text>
            </g>
          ))}

          {/* X axis line */}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#d4d4d8" strokeWidth={1} />

          {/* X axis label */}
          {featureLabel && (
            <text
              x={innerW / 2}
              y={innerH + 28}
              textAnchor="middle"
              className="text-[9px] fill-zinc-500"
            >
              {featureLabel}
            </text>
          )}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoveredBin != null && hoveredData && (
        <div
          className="absolute bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-10"
          style={{
            left: `${((xScale((hoveredData.x0 + hoveredData.x1) / 2) + margin.left) / width) * 100}%`,
            top: `${((yScale(isPancan ? hoveredData.total / (totalN * binWidth) : hoveredData.total / (totalN * binWidth)) + margin.top) / height) * 100}%`,
            transform: 'translate(-50%, -110%)',
          }}
        >
          <div className="text-[11px] font-medium mb-0.5">
            {hoveredData.x0.toPrecision(3)} – {hoveredData.x1.toPrecision(3)}
          </div>
          {isPancan ? (
            <div className="space-y-px">
              {stackKeys.map((key) => {
                const count = hoveredData.counts[key] ?? 0;
                if (count === 0) return null;
                return (
                  <div key={key} className="flex items-center gap-1.5 text-[10px]">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-sm shrink-0"
                      style={{ backgroundColor: colorScale!(key) }}
                    />
                    <span className="text-zinc-300">{key}</span>
                    <span className="ml-auto font-mono">{count}</span>
                  </div>
                );
              })}
              <div className="border-t border-zinc-600 mt-1 pt-1 text-[10px] font-mono">
                Total: {hoveredData.total}
              </div>
            </div>
          ) : (
            <div className="text-[11px] font-mono">
              Count: {hoveredData.total}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <svg width="12" height="8" className="shrink-0">
            <line x1="0" x2="12" y1="4" y2="4" stroke="#18181b" strokeWidth={1.5} />
          </svg>
          Median
        </span>
        <span className="flex items-center gap-1">
          <svg width="12" height="8" className="shrink-0">
            <line x1="0" x2="12" y1="4" y2="4" stroke="#71717a" strokeWidth={1} strokeDasharray="3 2" />
          </svg>
          Mean
        </span>
        {!isPancan && kde && (
          <>
            <span className="text-zinc-300">|</span>
            <span className="flex items-center gap-1">
              <svg width="14" height="8" className="shrink-0">
                <path d="M0,7 Q3,1 7,1 Q11,1 14,7" fill={SINGLE_COLOR} fillOpacity="0.15" stroke={SINGLE_COLOR} strokeWidth="1" />
              </svg>
              KDE (Gaussian, Silverman)
            </span>
          </>
        )}
        {isPancan && colorScale && (
          <>
            <span className="text-zinc-300">|</span>
            {stackKeys.map((key) => (
              <span key={key} className="flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: colorScale(key), opacity: 0.7 }}
                />
                {key}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
