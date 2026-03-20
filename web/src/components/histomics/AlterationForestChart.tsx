import { useMemo, useState, useCallback } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { formatP, formatNum, formatCI } from '../../lib/formatters';
import type { HistomicsCategoricalAssociation } from '../../types';

interface AlterationForestChartProps {
  mutations: HistomicsCategoricalAssociation[];
  maxRows?: number;
  onRowClick?: (categoricalVar: string) => void;
  selectedFeature?: string;
}

export function AlterationForestChart({ mutations, maxRows = 20, onRowClick, selectedFeature }: AlterationForestChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const sorted = useMemo(
    () =>
      [...mutations]
        .sort((a, b) => Math.abs(b.effectSize ?? 0) - Math.abs(a.effectSize ?? 0))
        .slice(0, maxRows),
    [mutations, maxRows],
  );

  const width = 500;
  const rowHeight = 28;
  const margin = { top: 32, right: 80, bottom: 40, left: 120 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = sorted.length * rowHeight;
  const height = innerHeight + margin.top + margin.bottom;

  const labels = useMemo(
    () => sorted.map((m) => m.categoricalVar.replace('mut_', '').toUpperCase()),
    [sorted],
  );

  const { yScale, xScale } = useMemo(() => {
    const yScale = scaleBand<string>()
      .domain(labels)
      .range([0, innerHeight])
      .padding(0.3);

    const allValues = sorted.flatMap((m) => {
      const vals: number[] = [];
      if (m.effectSize != null) vals.push(m.effectSize);
      if (m.effectCiLower != null) vals.push(m.effectCiLower);
      if (m.effectCiUpper != null) vals.push(m.effectCiUpper);
      return vals;
    });

    const absMax = allValues.length > 0 ? Math.max(...allValues.map(Math.abs)) : 0.5;
    const domainMax = Math.min(Math.max(absMax * 1.2, 0.1), 1);

    const xScale = scaleLinear()
      .domain([-domainMax, domainMax])
      .range([0, innerWidth]);

    return { yScale, xScale };
  }, [sorted, labels, innerWidth, innerHeight]);

  if (sorted.length === 0) return null;

  const refLineX = xScale(0);

  return (
    <div className="relative" onMouseMove={handleMouseMove}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Forest plot of cancer gene mutation associations. ${sorted.length} mutations tested, ${sorted.filter(m => m.isSignificant).length} significant.`}
      >
        {/* Title */}
        <text
          x={margin.left}
          y={16}
          className="text-[11px] fill-zinc-700 font-semibold"
        >
          Mutation Associations, Mann-Whitney U test (two-sided)
        </text>
        <text
          x={width - margin.right}
          y={16}
          textAnchor="end"
          className="text-[9px] fill-zinc-500 font-medium"
        >
          n = {sorted.length} mutations
        </text>

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* p_adj column header */}
          <text x={innerWidth + 8} y={-8} className="text-[8px] fill-zinc-500 font-medium uppercase">p_adj</text>

          {/* Reference line at δ = 0 */}
          <line
            x1={refLineX}
            x2={refLineX}
            y1={-4}
            y2={innerHeight + 4}
            stroke="#a1a1aa"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text x={refLineX} y={-8} textAnchor="middle" className="text-[8px] fill-zinc-400">δ = 0</text>

          {/* X-axis label */}
          <text
            x={innerWidth / 2}
            y={innerHeight + 36}
            textAnchor="middle"
            className="text-[9px] fill-zinc-400"
          >
            Cliff's δ
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
          {sorted.map((m, i) => {
            const label = labels[i];
            const cy = (yScale(label) ?? 0) + yScale.bandwidth() / 2;
            const isSig = m.isSignificant;
            const color = isSig ? '#f59e0b' : '#a1a1aa';
            const delta = m.effectSize;
            const ciLo = m.effectCiLower;
            const ciHi = m.effectCiUpper;

            const displayLabel = label.length > 15
              ? label.slice(0, 14) + '…'
              : label;

            return (
              <g key={m.categoricalVar}>
                {/* Selected row highlight */}
                {selectedFeature === m.categoricalVar && (
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
                  {displayLabel}
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

                {/* δ point */}
                {delta != null && (
                  <circle
                    cx={xScale(delta)}
                    cy={cy}
                    r={4}
                    fill={isSig ? color : 'white'}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                )}

                {/* δ value label with CI */}
                {delta != null && (
                  <text
                    x={xScale(delta)}
                    y={cy - 8}
                    textAnchor="middle"
                    className={`text-[8px] ${isSig ? 'fill-zinc-600' : 'fill-zinc-400'}`}
                  >
                    {formatNum(delta)}{ciLo != null && ciHi != null ? ` ${formatCI(ciLo, ciHi)}` : ''}
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
                  className={onRowClick ? 'cursor-pointer' : undefined}
                  onMouseEnter={() => setHovered(m.categoricalVar)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={onRowClick ? () => onRowClick(m.categoricalVar) : undefined}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hovered && (() => {
        const m = sorted.find((d) => d.categoricalVar === hovered);
        if (!m) return null;
        const gene = m.categoricalVar.replace('mut_', '').toUpperCase();
        return (
          <div
            className="fixed bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-50 whitespace-nowrap"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="font-medium text-zinc-300 mb-1">{gene}</div>
            <div className="text-[11px]">δ = {formatNum(m.effectSize)} · 95% CI (bootstrap): {formatCI(m.effectCiLower, m.effectCiUpper)}</div>
            <div className="text-[11px]">p<sub>adj</sub> = {formatP(m.pValueAdj)}</div>
            <div className="text-[11px]">N = {m.nSamples}</div>
          </div>
        );
      })()}

      {/* Correction footnote */}
      <p className="text-[10px] text-zinc-400 mt-1.5">
        p-values BH-corrected within feature × mutation × model ({mutations.length} mutations tested{sorted.length < mutations.length ? `; top ${sorted.length} shown` : ''})
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
