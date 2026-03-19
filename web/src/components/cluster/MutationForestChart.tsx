import { useMemo, useState } from 'react';
import { scaleBand, scaleLog } from 'd3-scale';
import { formatP, formatNum } from '../../lib/formatters';
import type { MutationEnrichment } from '../../types';

interface MutationForestChartProps {
  mutations: MutationEnrichment[];
}

export function MutationForestChart({ mutations }: MutationForestChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...mutations].sort((a, b) => (a.pValueAdj ?? 1) - (b.pValueAdj ?? 1)),
    [mutations],
  );

  const width = 500;
  const rowHeight = 28;
  const margin = { top: 32, right: 80, bottom: 40, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = sorted.length * rowHeight;
  const height = innerHeight + margin.top + margin.bottom;

  const { yScale, xScale } = useMemo(() => {
    const yScale = scaleBand<string>()
      .domain(sorted.map((m) => m.mutation))
      .range([0, innerHeight])
      .padding(0.3);

    // Compute domain from data — use CIs if available, else OR values
    const allValues = sorted.flatMap((m) => {
      const vals: number[] = [];
      if (m.oddsRatio != null && m.oddsRatio > 0) vals.push(m.oddsRatio);
      if (m.orCiLower != null && m.orCiLower > 0) vals.push(m.orCiLower);
      if (m.orCiUpper != null && m.orCiUpper > 0) vals.push(m.orCiUpper);
      return vals;
    });

    const minVal = allValues.length > 0 ? Math.min(...allValues) : 0.1;
    const maxVal = allValues.length > 0 ? Math.max(...allValues) : 10;

    const xScale = scaleLog()
      .domain([Math.min(minVal * 0.5, 0.1), Math.max(maxVal * 2, 10)])
      .range([0, innerWidth])
      .clamp(true);

    return { yScale, xScale };
  }, [sorted, innerWidth, innerHeight]);

  if (sorted.length === 0) return null;

  const refLineX = xScale(1);

  return (
    <div className="relative">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="xMinYMin meet"
      role="img"
      aria-label={`Cancer gene mutation enrichment forest plot: ${sorted.length} mutations tested, ${sorted.filter(m => m.isSignificant).length} significantly enriched (p_adj < 0.05)`}
    >
      {/* Title */}
      <text
        x={margin.left}
        y={16}
        className="text-[11px] fill-zinc-700 font-semibold"
      >
        Mutation Enrichment — Fisher's exact test (two-sided)
      </text>

      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {/* p_adj column header */}
        <text x={innerWidth + 8} y={-8} className="text-[8px] fill-zinc-500 font-medium uppercase">p_adj</text>

        {/* Reference line at OR = 1 */}
        <line
          x1={refLineX}
          x2={refLineX}
          y1={-4}
          y2={innerHeight + 4}
          stroke="#a1a1aa"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text x={refLineX} y={-8} textAnchor="middle" className="text-[8px] fill-zinc-400">OR = 1</text>
        {/* X-axis label */}
        <text
          x={innerWidth / 2}
          y={innerHeight + 36}
          textAnchor="middle"
          className="text-[9px] fill-zinc-400"
        >
          Odds Ratio (log scale)
        </text>

        {/* X-axis ticks */}
        {[0.1, 0.5, 1, 2, 5, 10].filter(
          (t) => t >= xScale.domain()[0] && t <= xScale.domain()[1],
        ).map((tick) => (
          <g key={tick}>
            <line
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={innerHeight}
              y2={innerHeight + 4}
              stroke="#a1a1aa"
              strokeWidth={1}
            />
            <text
              x={xScale(tick)}
              y={innerHeight + 16}
              textAnchor="middle"
              className="text-[9px] fill-zinc-500"
            >
              {tick}
            </text>
          </g>
        ))}

        {/* Baseline */}
        <line
          x1={0}
          x2={innerWidth}
          y1={innerHeight}
          y2={innerHeight}
          stroke="#e4e4e7"
          strokeWidth={1}
        />

        {/* Data rows */}
        {sorted.map((m) => {
          const cy = (yScale(m.mutation) ?? 0) + yScale.bandwidth() / 2;
          const isSig = m.isSignificant;
          const color = isSig ? '#f59e0b' : '#a1a1aa';
          const or = m.oddsRatio;
          const ciLo = m.orCiLower;
          const ciHi = m.orCiUpper;

          return (
            <g key={m.mutation}>
              {/* Row label */}
              <text
                x={-8}
                y={cy}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-[10px] fill-zinc-700"
              >
                {m.mutation}
              </text>

              {/* CI whisker */}
              {ciLo != null && ciHi != null && ciLo > 0 && ciHi > 0 && (
                <line
                  x1={xScale(ciLo)}
                  x2={xScale(ciHi)}
                  y1={cy}
                  y2={cy}
                  stroke={color}
                  strokeWidth={1.5}
                />
              )}
              {/* CI end caps */}
              {ciLo != null && ciHi != null && ciLo > 0 && ciHi > 0 && (
                <>
                  <line x1={xScale(ciLo)} x2={xScale(ciLo)} y1={cy - 3} y2={cy + 3} stroke={color} strokeWidth={1} />
                  <line x1={xScale(ciHi)} x2={xScale(ciHi)} y1={cy - 3} y2={cy + 3} stroke={color} strokeWidth={1} />
                </>
              )}

              {/* OR point */}
              {or != null && or > 0 && (
                <circle
                  cx={xScale(or)}
                  cy={cy}
                  r={4}
                  fill={isSig ? color : 'white'}
                  stroke={color}
                  strokeWidth={1.5}
                />
              )}

              {/* OR value label */}
              {or != null && or > 0 && (
                <text
                  x={xScale(or)}
                  y={cy - 8}
                  textAnchor="middle"
                  className={`text-[8px] ${isSig ? 'fill-zinc-600' : 'fill-zinc-400'}`}
                >
                  {formatNum(or)}
                </text>
              )}

              {/* p-adj annotation */}
              <text
                x={innerWidth + 8}
                y={cy}
                dominantBaseline="middle"
                className={`text-[9px] ${isSig ? 'fill-zinc-700' : 'fill-zinc-400'}`}
              >
                {formatP(m.pValueAdj)}
              </text>

              {/* Hit area */}
              <rect
                x={-margin.left}
                y={cy - yScale.bandwidth() / 2}
                width={width}
                height={yScale.bandwidth()}
                fill="transparent"
                onMouseEnter={() => setHovered(m.mutation)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}
      </g>
    </svg>

    {/* Tooltip */}
    {hovered && (() => {
      const m = sorted.find((d) => d.mutation === hovered);
      if (!m) return null;
      const cy = (yScale(m.mutation) ?? 0) + yScale.bandwidth() / 2;
      const or = m.oddsRatio;
      const anchorX = or != null && or > 0 ? xScale(or) : innerWidth / 2;
      return (
        <div
          className="absolute bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-10"
          style={{
            left: `${((anchorX + margin.left) / width) * 100}%`,
            top: `${((cy + margin.top) / height) * 100}%`,
            transform: 'translate(-50%, -110%)',
          }}
        >
          <div className="font-medium text-zinc-300 mb-1">{m.mutation}</div>
          <div className="text-[11px]">OR = {formatNum(or ?? null)} · 95% CI (exact): [{formatNum(m.orCiLower ?? null)}, {formatNum(m.orCiUpper ?? null)}]</div>
          <div className="text-[11px]">p_adj = {formatP(m.pValueAdj)}</div>
          <div className="text-[11px] text-zinc-400">Mutated: {m.nMutatedIn} in cluster / {m.nMutatedOut} in rest</div>
        </div>
      );
    })()}
    <div className="flex items-center justify-start gap-4 mt-2 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">
        <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" /></svg>
        Significant (p<sub>adj</sub> &lt; 0.05)
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="white" stroke="#a1a1aa" strokeWidth="1.5" /></svg>
        Not significant
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="16" height="10"><line x1="0" x2="16" y1="5" y2="5" stroke="#f59e0b" strokeWidth="1.5" /></svg>
        95% CI
      </span>
    </div>
    </div>
  );
}
