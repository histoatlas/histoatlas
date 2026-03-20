import { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { formatP } from '../../lib/formatters';
import type { PathwayEnrichment } from '../../types';

interface PathwayDifferenceChartProps {
  pathways: PathwayEnrichment[];
}

function truncateLabel(label: string, maxLen = 40): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + '\u2026';
}

function getCliffsDelta(p: PathwayEnrichment): number {
  return p.cliffsDelta ?? p.scoreDifference ?? 0;
}

function getCiLower(p: PathwayEnrichment): number | null {
  return p.cliffsDeltaCiLower ?? null;
}

function getCiUpper(p: PathwayEnrichment): number | null {
  return p.cliffsDeltaCiUpper ?? null;
}

export function PathwayDifferenceChart({ pathways }: PathwayDifferenceChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const top10 = useMemo(() => {
    const sorted = [...pathways].sort(
      (a, b) => Math.abs(getCliffsDelta(b)) - Math.abs(getCliffsDelta(a)),
    );
    return sorted.slice(0, 10).sort((a, b) => getCliffsDelta(b) - getCliffsDelta(a));
  }, [pathways]);

  const width = 500;
  const rowHeight = 28;
  const margin = { top: 32, right: 70, bottom: 36, left: 120 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = top10.length * rowHeight;
  const height = innerHeight + margin.top + margin.bottom;

  const { yScale, xScale } = useMemo(() => {
    const yScale = scaleBand<string>()
      .domain(top10.map((p) => p.pathwayName))
      .range([0, innerHeight])
      .padding(0.25);

    // Consider CI bounds in the domain so whiskers aren't clipped
    const allValues = top10.flatMap((p) => {
      const vals = [Math.abs(getCliffsDelta(p))];
      const lo = getCiLower(p);
      const hi = getCiUpper(p);
      if (lo != null) vals.push(Math.abs(lo));
      if (hi != null) vals.push(Math.abs(hi));
      return vals;
    });
    const maxAbs = Math.max(...allValues, 0.1);
    const pad = maxAbs * 0.15;

    const xScale = scaleLinear()
      .domain([-(maxAbs + pad), maxAbs + pad])
      .range([0, innerWidth]);

    return { yScale, xScale };
  }, [top10, innerWidth, innerHeight]);

  if (top10.length === 0) return null;

  const zeroX = xScale(0);

  return (
    <div className="relative">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="xMinYMin meet"
      role="img"
      aria-label={`Pathway activity difference chart: top ${top10.length} cancer pathways by Cliff's delta effect size. ${top10.filter(p => p.isSignificant).length} significant (p_adj < 0.05)`}
    >
      {/* Title */}
      <text
        x={margin.left}
        y={16}
        className="text-[11px] fill-zinc-700 font-semibold"
      >
        {"Pathway Activity, Top 10 by |Cliff's δ|"}
      </text>

      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {/* Reference line at 0 */}
        <line
          x1={zeroX}
          x2={zeroX}
          y1={-4}
          y2={innerHeight + 4}
          stroke="#a1a1aa"
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* X-axis ticks */}
        {xScale.ticks(5).map((tick) => (
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
              {tick.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X-axis label */}
        <text
          x={innerWidth / 2}
          y={innerHeight + 28}
          textAnchor="middle"
          className="text-[9px] fill-zinc-400"
        >
          {"Cliff's δ"}
        </text>

        {/* Baseline */}
        <line
          x1={0}
          x2={innerWidth}
          y1={innerHeight}
          y2={innerHeight}
          stroke="#e4e4e7"
          strokeWidth={1}
        />

        {/* Forest plot: point + CI whisker per pathway */}
        {top10.map((p) => {
          const y = yScale(p.pathwayName) ?? 0;
          const cy = y + yScale.bandwidth() / 2;
          const delta = getCliffsDelta(p);
          const ciLo = getCiLower(p);
          const ciHi = getCiUpper(p);
          const isSig = p.isSignificant;
          const color = isSig ? '#f59e0b' : '#a1a1aa';

          return (
            <g key={p.pathwayName}>
              {/* Row label */}
              <text
                x={-6}
                y={cy}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-[10px] fill-zinc-700"
              >
                {truncateLabel(p.pathwayName)}
              </text>

              {/* CI whisker line */}
              {ciLo != null && ciHi != null && (
                <line
                  x1={xScale(ciLo)}
                  x2={xScale(ciHi)}
                  y1={cy}
                  y2={cy}
                  stroke={color}
                  strokeWidth={1.5}
                />
              )}

              {/* CI whisker caps */}
              {ciLo != null && ciHi != null && (
                <>
                  <line
                    x1={xScale(ciLo)}
                    x2={xScale(ciLo)}
                    y1={cy - 4}
                    y2={cy + 4}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                  <line
                    x1={xScale(ciHi)}
                    x2={xScale(ciHi)}
                    y1={cy - 4}
                    y2={cy + 4}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                </>
              )}

              {/* Point estimate */}
              <circle
                cx={xScale(delta)}
                cy={cy}
                r={4}
                fill={isSig ? color : 'white'}
                stroke={color}
                strokeWidth={1.5}
              />

              {/* p-adj annotation */}
              <text
                x={innerWidth + 6}
                y={cy}
                dominantBaseline="middle"
                className={`text-[9px] ${isSig ? 'fill-zinc-700' : 'fill-zinc-400'}`}
              >
                {formatP(p.pValueAdj)}
              </text>

              {/* Hit area */}
              <rect
                x={-margin.left}
                y={y}
                width={width}
                height={yScale.bandwidth()}
                fill="transparent"
                onMouseEnter={() => setHovered(p.pathwayName)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}
      </g>
    </svg>

    {/* Tooltip */}
    {hovered && (() => {
      const p = top10.find((d) => d.pathwayName === hovered);
      if (!p) return null;
      const y = (yScale(p.pathwayName) ?? 0) + yScale.bandwidth() / 2;
      const delta = getCliffsDelta(p);
      const ciLo = getCiLower(p);
      const ciHi = getCiUpper(p);
      const anchorX = xScale(delta);
      return (
        <div
          className="absolute bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-10"
          style={{
            left: `${((anchorX + margin.left) / width) * 100}%`,
            top: `${((y + margin.top) / height) * 100}%`,
            transform: 'translate(-50%, -110%)',
          }}
        >
          <div className="font-medium text-zinc-300 mb-1">{p.pathwayName}</div>
          <div className="text-[11px]">{"Cliff's δ = "}{delta.toFixed(3)}</div>
          {ciLo != null && ciHi != null && (
            <div className="text-[11px]">95% CI [{ciLo.toFixed(3)}, {ciHi.toFixed(3)}]</div>
          )}
          <div className="text-[11px]">p_adj = {formatP(p.pValueAdj)}</div>
        </div>
      );
    })()}
    <div className="flex items-center justify-start gap-4 mt-2 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">
        <svg width="14" height="10">
          <line x1="0" x2="14" y1="5" y2="5" stroke="#f59e0b" strokeWidth="1.5" />
          <circle cx="7" cy="5" r="3.5" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" />
        </svg>
        Significant (p<sub>adj</sub> &lt; 0.05)
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="14" height="10">
          <line x1="0" x2="14" y1="5" y2="5" stroke="#a1a1aa" strokeWidth="1.5" />
          <circle cx="7" cy="5" r="3.5" fill="white" stroke="#a1a1aa" strokeWidth="1.5" />
        </svg>
        Not significant
      </span>
    </div>
    </div>
  );
}
