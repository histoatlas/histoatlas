import { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { IMMUNE_SUBTYPE_COLORS } from '../../lib/colors';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Icon } from '../ui/Icon';
import type { ImmuneEnrichment } from '../../types';

interface ImmuneSubtypeChartProps {
  enrichments?: ImmuneEnrichment[];
  isLoading: boolean;
}

function formatP(p: number | null): string {
  if (p == null) return 'N/A';
  if (p < 0.001) return '<0.001';
  return p.toFixed(3);
}

function formatOR(or: number | null): string {
  if (or == null) return 'N/A';
  return or.toFixed(2);
}

function sigStars(p: number | null): string {
  if (p == null) return '';
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return '';
}

export function ImmuneSubtypeChart({
  enrichments,
  isLoading,
}: ImmuneSubtypeChartProps) {
  const [hoveredSubtype, setHoveredSubtype] = useState<string | null>(null);

  const width = 300;
  const height = 220;
  const margin = { top: 30, right: 10, bottom: 50, left: 35 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const { xScale, yScale, data } = useMemo(() => {
    if (!enrichments || enrichments.length === 0) {
      return {
        xScale: scaleBand<string>(),
        yScale: scaleLinear(),
        data: [],
      };
    }

    const data = enrichments.map((e) => ({
      subtype: e.immuneSubtype,
      observed: e.observed,
      expected: e.expected ?? 0,
      ratio: e.ratio,
      oddsRatio: e.oddsRatio,
      orCiLower: e.orCiLower,
      orCiUpper: e.orCiUpper,
      pValueAdj: e.pValueAdj,
      isSignificant: e.isSignificant,
      color: IMMUNE_SUBTYPE_COLORS[e.immuneSubtype] || '#808080',
    }));

    const maxVal = Math.max(
      ...data.map((d) => Math.max(d.observed, d.expected))
    );

    const xScale = scaleBand<string>()
      .domain(data.map((d) => d.subtype))
      .range([0, innerWidth])
      .padding(0.3);

    const yScale = scaleLinear()
      .domain([0, maxVal * 1.25])
      .range([innerHeight, 0]);

    return { xScale, yScale, data };
  }, [enrichments, innerWidth, innerHeight]);

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="w-full h-48" />
      </div>
    );
  }

  if (!enrichments || enrichments.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">
          Immune Subtypes
        </h2>
        <EmptyState
          title="No immune data"
          description="Immune subtype enrichment is not available for this cluster."
        />
      </div>
    );
  }

  const barWidth = xScale.bandwidth() / 2 - 1;
  const hoveredEntry = data.find((d) => d.subtype === hoveredSubtype);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
        <Icon name="shield-check" size={18} className="text-zinc-400" />
        Immune Subtypes
        <InfoTooltip text="Observed vs. expected immune subtype counts in this cluster. Brackets with significance stars indicate Fisher's exact test results (BH-adjusted)." />
      </h2>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="max-w-xs w-full"
          preserveAspectRatio="xMinYMin meet"
          onMouseLeave={() => setHoveredSubtype(null)}
          role="img"
          aria-label={`Tumor immune microenvironment subtype enrichment: ${data.length} immune subtypes tested, ${data.filter(d => d.isSignificant).length} significantly enriched (p < 0.05)`}
        >
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Y-axis gridlines */}
            {yScale.ticks(4).map((tick) => (
              <g key={tick}>
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  stroke="#e4e4e7"
                  strokeWidth={1}
                />
                <text
                  x={-4}
                  y={yScale(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-[9px] fill-zinc-500"
                >
                  {tick}
                </text>
              </g>
            ))}

            {/* Bars + brackets */}
            {data.map((d) => {
              const x = xScale(d.subtype) ?? 0;
              const isHovered = hoveredSubtype === d.subtype;
              const isDimmed = hoveredSubtype != null && !isHovered;

              // Bracket geometry
              const obsBarX = x;
              const expBarX = x + barWidth + 2;
              const bracketTop = yScale(Math.max(d.observed, d.expected)) - 6;
              const bracketLeft = obsBarX + barWidth / 2;
              const bracketRight = expBarX + barWidth / 2;

              return (
                <g key={d.subtype}>
                  {/* Invisible hit area */}
                  <rect
                    x={x - 2}
                    y={0}
                    width={xScale.bandwidth() + 4}
                    height={innerHeight + 14}
                    fill="transparent"
                    onMouseEnter={() => setHoveredSubtype(d.subtype)}
                    className="cursor-pointer"
                  />
                  {/* Hover highlight */}
                  {isHovered && (
                    <rect
                      x={x - 4}
                      y={-2}
                      width={xScale.bandwidth() + 8}
                      height={innerHeight + 4}
                      fill="#f4f4f5"
                      rx={4}
                    />
                  )}
                  {/* Observed bar */}
                  <rect
                    x={obsBarX}
                    y={yScale(d.observed)}
                    width={barWidth}
                    height={innerHeight - yScale(d.observed)}
                    fill={d.color}
                    opacity={isDimmed ? 0.3 : 1}
                    rx={1}
                    style={{ transition: 'opacity 150ms' }}
                  />
                  {/* Expected bar */}
                  <rect
                    x={expBarX}
                    y={yScale(d.expected)}
                    width={barWidth}
                    height={innerHeight - yScale(d.expected)}
                    fill={d.color}
                    opacity={isDimmed ? 0.15 : 0.3}
                    rx={1}
                    style={{ transition: 'opacity 150ms' }}
                  />

                  {/* Significance bracket */}
                  {d.isSignificant && (
                    <g opacity={isDimmed ? 0.25 : 1} style={{ transition: 'opacity 150ms' }}>
                      {/* Left arm */}
                      <line
                        x1={bracketLeft} y1={bracketTop + 4}
                        x2={bracketLeft} y2={bracketTop}
                        stroke="#27272a" strokeWidth={1}
                      />
                      {/* Horizontal bar */}
                      <line
                        x1={bracketLeft} y1={bracketTop}
                        x2={bracketRight} y2={bracketTop}
                        stroke="#27272a" strokeWidth={1}
                      />
                      {/* Right arm */}
                      <line
                        x1={bracketRight} y1={bracketTop}
                        x2={bracketRight} y2={bracketTop + 4}
                        stroke="#27272a" strokeWidth={1}
                      />
                      {/* Stars */}
                      <text
                        x={(bracketLeft + bracketRight) / 2}
                        y={bracketTop - 3}
                        textAnchor="middle"
                        className="text-[9px] fill-zinc-800 font-bold"
                      >
                        {sigStars(d.pValueAdj)}
                      </text>
                    </g>
                  )}

                  {/* X-axis label */}
                  <text
                    x={x + xScale.bandwidth() / 2}
                    y={innerHeight + 6}
                    textAnchor="end"
                    transform={`rotate(-35, ${x + xScale.bandwidth() / 2}, ${innerHeight + 6})`}
                    className={`text-[8px] font-medium ${isHovered ? 'fill-zinc-900' : 'fill-zinc-600'}`}
                  >
                    {d.subtype}
                  </text>
                </g>
              );
            })}

            {/* Baseline */}
            <line
              x1={0}
              x2={innerWidth}
              y1={innerHeight}
              y2={innerHeight}
              stroke="#a1a1aa"
              strokeWidth={1}
            />
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredEntry && hoveredSubtype && (
          <div
            className="absolute bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-10 w-52"
            style={{
              left: `${((xScale(hoveredSubtype) ?? 0) + margin.left + xScale.bandwidth() / 2) / width * 100}%`,
              transform: 'translateX(-50%)',
              bottom: '100%',
              marginBottom: -16,
            }}
          >
            <div className="font-medium mb-1">{hoveredSubtype}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-zinc-400">Observed</span>
              <span>{hoveredEntry.observed}</span>
              <span className="text-zinc-400">Expected</span>
              <span>{hoveredEntry.expected.toFixed(1)}</span>
              <span className="text-zinc-400">Odds ratio</span>
              <span>{formatOR(hoveredEntry.oddsRatio)} ({formatOR(hoveredEntry.orCiLower)}–{formatOR(hoveredEntry.orCiUpper)})</span>
              <span className="text-zinc-400">Fisher p (adj)</span>
              <span>{formatP(hoveredEntry.pValueAdj)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-zinc-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-zinc-500" />
          <span>Observed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-zinc-500 opacity-30" />
          <span>Expected</span>
        </div>
      </div>

      {/* Significance footnote */}
      <p className="text-[10px] text-zinc-400 text-center mt-1.5">
        * p &lt; 0.05 &nbsp; ** p &lt; 0.01 &nbsp; *** p &lt; 0.001 (Fisher's exact, BH-adjusted)
      </p>
    </div>
  );
}
