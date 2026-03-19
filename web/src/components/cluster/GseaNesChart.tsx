import { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { formatP } from '../../lib/formatters';
import type { GseaEnrichment } from '../../types';

interface GseaNesChartProps {
  gsea: GseaEnrichment[];
}

function truncateLabel(label: string, maxLen = 40): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + '\u2026';
}

export function GseaNesChart({ gsea }: GseaNesChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const top10 = useMemo(() => {
    const sorted = [...gsea].sort((a, b) => Math.abs(b.nes ?? 0) - Math.abs(a.nes ?? 0));
    return sorted.slice(0, 10).sort((a, b) => (b.nes ?? 0) - (a.nes ?? 0));
  }, [gsea]);

  const width = 500;
  const rowHeight = 28;
  const margin = { top: 32, right: 70, bottom: 36, left: 120 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = top10.length * rowHeight;
  const height = innerHeight + margin.top + margin.bottom;

  const { yScale, xScale } = useMemo(() => {
    const yScale = scaleBand<string>()
      .domain(top10.map((g) => g.pathwayName))
      .range([0, innerHeight])
      .padding(0.25);

    const maxAbs = Math.max(
      ...top10.map((g) => Math.abs(g.nes ?? 0)),
      1,
    );
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
      aria-label={`Gene set enrichment analysis (GSEA) chart showing top ${top10.length} pathways by normalized enrichment score. ${top10.filter(g => g.isSignificant).length} significant (FDR < 0.25)`}
    >
      {/* Title */}
      <text
        x={margin.left}
        y={16}
        className="text-[11px] fill-zinc-700 font-semibold"
      >
        Gene Set Enrichment — Top 10 by absolute NES
      </text>

      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {/* Reference line at NES = 0 */}
        <line
          x1={zeroX}
          x2={zeroX}
          y1={-4}
          y2={innerHeight + 4}
          stroke="#a1a1aa"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={zeroX}
          y={-8}
          textAnchor="middle"
          className="text-[8px] fill-zinc-400"
        >
          NES = 0
        </text>

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
              {tick.toFixed(1)}
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
          Normalized Enrichment Score
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

        {/* Bars */}
        {top10.map((g) => {
          const y = yScale(g.pathwayName) ?? 0;
          const nes = g.nes ?? 0;
          const isSig = g.isSignificant;
          const barColor = nes >= 0 ? '#3b82f6' : '#ef4444';
          const barX = nes >= 0 ? zeroX : xScale(nes);
          const barW = Math.abs(xScale(nes) - zeroX);

          return (
            <g key={g.pathwayName}>
              {/* Row label */}
              <text
                x={-6}
                y={y + yScale.bandwidth() / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-[10px] fill-zinc-700"
              >
                {truncateLabel(g.pathwayName)}
              </text>

              {/* Bar */}
              <rect
                x={barX}
                y={y}
                width={barW}
                height={yScale.bandwidth()}
                fill={barColor}
                opacity={isSig ? 0.85 : 0.4}
                rx={2}
              />

              {/* FDR annotation */}
              <text
                x={innerWidth + 6}
                y={y + yScale.bandwidth() / 2}
                dominantBaseline="middle"
                className={`text-[9px] ${isSig ? 'fill-zinc-700' : 'fill-zinc-400'}`}
              >
                FDR q = {formatP(g.fdrQValue)}
              </text>

              {/* Hit area */}
              <rect
                x={-margin.left}
                y={y}
                width={width}
                height={yScale.bandwidth()}
                fill="transparent"
                onMouseEnter={() => setHovered(g.pathwayName)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}
      </g>
    </svg>

    {/* Tooltip */}
    {hovered && (() => {
      const g = top10.find((d) => d.pathwayName === hovered);
      if (!g) return null;
      const y = (yScale(g.pathwayName) ?? 0) + yScale.bandwidth() / 2;
      const nes = g.nes ?? 0;
      const anchorX = xScale(nes);
      return (
        <div
          className="absolute bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-10"
          style={{
            left: `${((anchorX + margin.left) / width) * 100}%`,
            top: `${((y + margin.top) / height) * 100}%`,
            transform: 'translate(-50%, -110%)',
          }}
        >
          <div className="font-medium text-zinc-300 mb-1">{g.pathwayName}</div>
          <div className="text-[11px]">NES = {nes.toFixed(3)}</div>
          <div className="text-[11px]">FDR q = {formatP(g.fdrQValue)}</div>
          <div className="text-[11px] text-zinc-400">Leading edge: {g.leadingEdgeSize} genes</div>
        </div>
      );
    })()}
    <div className="flex items-center justify-start gap-4 mt-2 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">
        <svg width="10" height="10"><rect width="10" height="10" rx="2" fill="#3b82f6" opacity="0.85" /></svg>
        Upregulated in cluster
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="10"><rect width="10" height="10" rx="2" fill="#ef4444" opacity="0.85" /></svg>
        Downregulated
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="10"><rect width="10" height="10" rx="2" fill="#a1a1aa" opacity="0.4" /></svg>
        Faded = not significant (FDR q &ge; 0.25)
      </span>
    </div>
    </div>
  );
}
