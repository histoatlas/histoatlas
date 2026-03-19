import { useMemo, useState, useRef, useCallback } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { formatP, formatNum, formatCI } from '../../lib/formatters';
import type { HistomicsCorrelation } from '../../types';

interface CorrelationForestChartProps {
  correlations: HistomicsCorrelation[];
  maxRows?: number;
  onRowClick?: (molecularFeature: string) => void;
  selectedFeature?: string;
}

export function CorrelationForestChart({ correlations, maxRows = 20, onRowClick, selectedFeature }: CorrelationForestChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const sorted = useMemo(
    () =>
      [...correlations]
        .sort((a, b) => Math.abs(b.spearmanRho ?? 0) - Math.abs(a.spearmanRho ?? 0))
        .slice(0, maxRows),
    [correlations, maxRows],
  );

  const width = 500;
  const rowHeight = 28;
  const margin = { top: 32, right: 80, bottom: 40, left: 120 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = sorted.length * rowHeight;
  const height = innerHeight + margin.top + margin.bottom;

  const { yScale, xScale } = useMemo(() => {
    const yScale = scaleBand<string>()
      .domain(sorted.map((c) => c.molecularFeature))
      .range([0, innerHeight])
      .padding(0.3);

    // Compute symmetric domain from data
    const allValues = sorted.flatMap((c) => {
      const vals: number[] = [];
      if (c.spearmanRho != null) vals.push(c.spearmanRho);
      if (c.spearmanCiLower != null) vals.push(c.spearmanCiLower);
      if (c.spearmanCiUpper != null) vals.push(c.spearmanCiUpper);
      return vals;
    });

    const absMax = allValues.length > 0 ? Math.max(...allValues.map(Math.abs)) : 0.5;
    const domainMax = Math.min(Math.max(absMax * 1.2, 0.1), 1);

    const xScale = scaleLinear()
      .domain([-domainMax, domainMax])
      .range([0, innerWidth]);

    return { yScale, xScale };
  }, [sorted, innerWidth, innerHeight]);

  if (sorted.length === 0) return null;

  const refLineX = xScale(0);

  return (
    <div ref={containerRef} className="relative" onMouseMove={handleMouseMove}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Forest plot of ${sorted.length} Spearman molecular correlations with histomic features. ${sorted.filter(c => c.isSignificant).length} significant (p_adj < 0.05)`}
      >
        {/* Title */}
        <text
          x={margin.left}
          y={16}
          className="text-[11px] fill-zinc-700 font-semibold"
        >
          Spearman Rank Correlation (two-sided)
        </text>

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* p_adj column header */}
          <text x={innerWidth + 8} y={-8} className="text-[8px] fill-zinc-500 font-medium uppercase">p_adj</text>

          {/* Reference line at ρ = 0 */}
          <line
            x1={refLineX}
            x2={refLineX}
            y1={-4}
            y2={innerHeight + 4}
            stroke="#a1a1aa"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text x={refLineX} y={-8} textAnchor="middle" className="text-[8px] fill-zinc-400">ρ = 0</text>

          {/* X-axis label */}
          <text
            x={innerWidth / 2}
            y={innerHeight + 36}
            textAnchor="middle"
            className="text-[9px] fill-zinc-400"
          >
            Spearman ρ
          </text>

          {/* X-axis ticks */}
          {xScale.ticks(7).map((tick) => (
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
          {sorted.map((c) => {
            const cy = (yScale(c.molecularFeature) ?? 0) + yScale.bandwidth() / 2;
            const isSig = c.isSignificant;
            const color = isSig ? '#f59e0b' : '#a1a1aa';
            const rho = c.spearmanRho;
            const ciLo = c.spearmanCiLower;
            const ciHi = c.spearmanCiUpper;
            const isSelected = selectedFeature === c.molecularFeature;

            // Truncate label to ~15 chars
            const label = c.molecularFeature.length > 15
              ? c.molecularFeature.slice(0, 14) + '…'
              : c.molecularFeature;

            return (
              <g key={c.molecularFeature}>
                {/* Selected row highlight */}
                {isSelected && (
                  <rect
                    x={-margin.left}
                    y={cy - yScale.bandwidth() / 2}
                    width={width}
                    height={yScale.bandwidth()}
                    fill="#eff6ff"
                  />
                )}

                {/* Row label */}
                <text
                  x={-8}
                  y={cy}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-[10px] fill-zinc-700"
                >
                  {label}
                </text>

                {/* CI whisker */}
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

                {/* ρ point */}
                {rho != null && (
                  <circle
                    cx={xScale(rho)}
                    cy={cy}
                    r={4}
                    fill={isSig ? color : 'white'}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                )}

                {/* ρ value label */}
                {rho != null && (
                  <text
                    x={xScale(rho)}
                    y={cy - 8}
                    textAnchor="middle"
                    className={`text-[8px] ${isSig ? 'fill-zinc-600' : 'fill-zinc-400'}`}
                  >
                    {formatNum(rho)}
                  </text>
                )}

                {/* p-adj annotation */}
                <text
                  x={innerWidth + 8}
                  y={cy}
                  dominantBaseline="middle"
                  className={`text-[9px] ${isSig ? 'fill-zinc-700' : 'fill-zinc-400'}`}
                >
                  {formatP(c.spearmanPAdj)}
                </text>

                {/* Hit area */}
                <rect
                  x={-margin.left}
                  y={cy - yScale.bandwidth() / 2}
                  width={width}
                  height={yScale.bandwidth()}
                  fill="transparent"
                  className={onRowClick ? 'cursor-pointer' : undefined}
                  onMouseEnter={() => setHovered(c.molecularFeature)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={onRowClick ? () => onRowClick(c.molecularFeature) : undefined}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hovered && (() => {
        const c = sorted.find((d) => d.molecularFeature === hovered);
        if (!c) return null;
        return (
          <div
            className="fixed bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-50 whitespace-nowrap"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="font-medium text-zinc-300 mb-1">{c.molecularFeature}</div>
            <div className="text-[11px]">ρ = {formatNum(c.spearmanRho)} · 95% CI (bootstrap): {formatCI(c.spearmanCiLower, c.spearmanCiUpper)}</div>
            <div className="text-[11px]">p_adj = {formatP(c.spearmanPAdj)}</div>
            <div className="text-[11px]">N = {c.nSamples}</div>
          </div>
        );
      })()}

      {/* Correction footnote */}
      <p className="text-[10px] text-zinc-400 mt-1.5">
        p-values BH-corrected within feature × molecular type × model ({correlations.length} features tested{sorted.length < correlations.length ? `; top ${sorted.length} shown` : ''})
      </p>

      {/* Legend */}
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
          95% CI (bootstrap percentile)
        </span>
      </div>
    </div>
  );
}
