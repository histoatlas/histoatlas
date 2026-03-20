import { useMemo, useState, useCallback } from 'react';
import { scaleBand, scaleLog, scaleLinear } from 'd3-scale';
import { formatP, formatNum, formatHR } from '../../lib/formatters';
import type { CrossCancerSurvivalResult } from '../../types';

interface SurvivalForestChartProps {
  results: CrossCancerSurvivalResult[];
  pancan: CrossCancerSurvivalResult | null;
}

export function SurvivalForestChart({ results, pancan }: SurvivalForestChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  // Results are already sorted by HR ascending from the API
  const rows = results;
  const hasPancan = pancan != null;
  const totalRows = rows.length + (hasPancan ? 1 : 0);

  const width = 580;
  const rowHeight = 28;
  const margin = { top: 32, right: 160, bottom: 40, left: 64 };
  const pancanGap = hasPancan ? 16 : 0;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = totalRows * rowHeight + pancanGap;
  const height = innerHeight + margin.top + margin.bottom;

  const { yScale, xScale, logTicks } = useMemo(() => {
    // Build domain labels: cancer types + optional PANCAN
    const labels = rows.map((r) => r.cancerType);
    if (hasPancan) labels.push('PANCAN');

    const yScale = scaleBand<string>()
      .domain(labels)
      .range([0, innerHeight])
      .padding(0.3);

    // Collect all HR values + CI bounds for domain
    const allValues: number[] = [];
    const allRows = hasPancan ? [...rows, pancan!] : rows;
    for (const r of allRows) {
      if (r.hazardRatio != null && r.hazardRatio > 0) allValues.push(r.hazardRatio);
      if (r.hrCiLower != null && r.hrCiLower > 0) allValues.push(r.hrCiLower);
      if (r.hrCiUpper != null && r.hrCiUpper > 0) allValues.push(r.hrCiUpper);
    }

    if (allValues.length === 0) {
      allValues.push(0.5, 2);
    }

    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    // Expand domain slightly for padding
    const domainLo = Math.max(minVal / 1.3, 0.1);
    const domainHi = maxVal * 1.3;

    const xScale = scaleLog()
      .domain([domainLo, domainHi])
      .range([0, innerWidth])
      .clamp(true);

    // Generate nice tick values for log scale
    const logTicks = xScale.ticks(6).filter((t) => t > 0);
    // Ensure 1 is always included
    if (!logTicks.includes(1)) {
      logTicks.push(1);
      logTicks.sort((a, b) => a - b);
    }

    return { yScale, xScale, logTicks };
  }, [rows, pancan, hasPancan, innerWidth, innerHeight]);

  // Compute point radii proportional to sqrt(nSamples)
  const allNSamples = [...rows, ...(pancan ? [pancan] : [])].map((r) => r.nSamples);
  const maxN = Math.max(...allNSamples, 1);
  const getRadius = (n: number) => {
    const minR = 3;
    const maxR = 7;
    return minR + (maxR - minR) * Math.sqrt(n / maxN);
  };

  if (rows.length === 0) return null;

  const refLineX = xScale(1);
  // Y position where PANCAN separator line should be drawn
  const pancanSepY = hasPancan
    ? (yScale('PANCAN') ?? innerHeight) - pancanGap / 2
    : 0;

  function renderRow(r: CrossCancerSurvivalResult, isPancan: boolean) {
    const yKey = isPancan ? 'PANCAN' : r.cancerType;
    const cy = (yScale(yKey) ?? 0) + yScale.bandwidth() / 2;
    const isSig = r.pValueAdj != null && r.pValueAdj < 0.05;
    const color = isSig ? '#f59e0b' : '#a1a1aa';
    const hr = r.hazardRatio;
    const ciLo = r.hrCiLower;
    const ciHi = r.hrCiUpper;

    return (
      <g key={r.cancerType}>
        {/* Row label */}
        <text
          x={-8}
          y={cy}
          textAnchor="end"
          dominantBaseline="middle"
          className={`text-[10px] ${isPancan ? 'fill-zinc-900 font-semibold' : 'fill-zinc-700'}`}
        >
          {r.cancerType}
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

        {/* HR point or PANCAN diamond, sized by sample count */}
        {hr != null && hr > 0 && (
          isPancan ? (
            <polygon
              points={`${xScale(hr)},${cy - 6} ${xScale(hr) + 5},${cy} ${xScale(hr)},${cy + 6} ${xScale(hr) - 5},${cy}`}
              fill={isSig ? color : 'white'}
              stroke={color}
              strokeWidth={1.5}
            />
          ) : (
            <circle
              cx={xScale(hr)}
              cy={cy}
              r={getRadius(r.nSamples)}
              fill={isSig ? color : 'white'}
              stroke={color}
              strokeWidth={1.5}
            />
          )
        )}

        {/* HR value label with CI */}
        {hr != null && hr > 0 && (
          <text
            x={xScale(hr)}
            y={cy - 8}
            textAnchor="middle"
            className={`text-[8px] ${isSig ? 'fill-zinc-600' : 'fill-zinc-400'}`}
          >
            {formatHR(hr)}{ciLo != null && ciHi != null ? ` [${formatHR(ciLo)}\u2013${formatHR(ciHi)}]` : ''}
          </text>
        )}

        {/* Right-side annotations: p_adj, N, C-index */}
        <text
          x={innerWidth + 8}
          y={cy}
          dominantBaseline="middle"
          className={`text-[9px] ${isSig ? 'fill-zinc-700' : 'fill-zinc-400'}`}
        >
          {formatP(r.pValueAdj)}
        </text>
        <text
          x={innerWidth + 56}
          y={cy}
          dominantBaseline="middle"
          className="text-[9px] fill-zinc-500 font-mono"
        >
          {r.nSamples.toLocaleString()}
        </text>
        <text
          x={innerWidth + 100}
          y={cy}
          dominantBaseline="middle"
          className="text-[9px] fill-zinc-500 font-mono"
        >
          {r.concordance != null ? formatNum(r.concordance) : '-'}
        </text>

        {/* Hit area */}
        <rect
          x={-margin.left}
          y={cy - yScale.bandwidth() / 2}
          width={width}
          height={yScale.bandwidth()}
          fill="transparent"
          onMouseEnter={() => setHovered(r.cancerType)}
          onMouseLeave={() => setHovered(null)}
        />
      </g>
    );
  }

  const hoveredRow = hovered
    ? [...rows, ...(pancan ? [pancan] : [])].find((r) => r.cancerType === hovered)
    : null;

  return (
    <div className="relative" onMouseMove={handleMouseMove}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Forest plot of survival hazard ratios across ${rows.length} cancer types. ${rows.filter(r => r.pValueAdj != null && r.pValueAdj < 0.05).length} significant.`}
      >
        {/* Title */}
        <text
          x={margin.left}
          y={16}
          className="text-[11px] fill-zinc-700 font-semibold"
        >
          Hazard Ratio by Cancer Type, Cox PH (two-sided, median split)
        </text>
        <text
          x={width - margin.right}
          y={16}
          textAnchor="end"
          className="text-[9px] fill-zinc-500 font-medium"
        >
          n = {rows.length} cancer types
        </text>

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Column headers */}
          <text
            x={innerWidth + 8}
            y={-8}
            className="text-[8px] fill-zinc-500 font-medium uppercase"
          >
            p_adj
          </text>
          <text
            x={innerWidth + 56}
            y={-8}
            className="text-[8px] fill-zinc-500 font-medium uppercase"
          >
            N
          </text>
          <text
            x={innerWidth + 100}
            y={-8}
            className="text-[8px] fill-zinc-500 font-medium uppercase"
          >
            C-index
          </text>

          {/* Reference line at HR = 1 */}
          <line
            x1={refLineX}
            x2={refLineX}
            y1={-4}
            y2={innerHeight + 4}
            stroke="#a1a1aa"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={refLineX}
            y={-8}
            textAnchor="middle"
            className="text-[8px] fill-zinc-400"
          >
            HR = 1
          </text>

          {/* X-axis label */}
          <text
            x={innerWidth / 2}
            y={innerHeight + 36}
            textAnchor="middle"
            className="text-[9px] fill-zinc-400"
          >
            Hazard Ratio (log scale)
          </text>

          {/* X-axis ticks */}
          {logTicks.map((tick) => (
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
                {formatNum(tick, tick >= 1 ? 1 : 2)}
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

          {/* PANCAN separator */}
          {hasPancan && (
            <line
              x1={-margin.left + 8}
              x2={innerWidth + margin.right - 8}
              y1={pancanSepY}
              y2={pancanSepY}
              stroke="#d4d4d8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Data rows */}
          {rows.map((r) => renderRow(r, false))}
          {pancan && renderRow(pancan, true)}
        </g>
      </svg>

      {/* Tooltip */}
      {hoveredRow && (
        <div
          className="fixed bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-50 whitespace-nowrap"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            transform: 'translate(-50%, -120%)',
          }}
        >
          <div className="font-medium text-zinc-300 mb-1">{hoveredRow.cancerType}</div>
          <div className="text-[11px]">
            HR = {formatHR(hoveredRow.hazardRatio)} · 95% CI: [{formatHR(hoveredRow.hrCiLower)}, {formatHR(hoveredRow.hrCiUpper)}]
          </div>
          <div className="text-[11px]">p<sub>adj</sub> = {formatP(hoveredRow.pValueAdj)}</div>
          <div className="text-[11px]">
            N = {hoveredRow.nSamples.toLocaleString()} ({hoveredRow.nEvents.toLocaleString()} events)
          </div>
          {hoveredRow.concordance != null && (
            <div className="text-[11px]">C-index = {formatNum(hoveredRow.concordance)}</div>
          )}
        </div>
      )}

      {/* Correction footnote */}
      <p className="text-[10px] text-zinc-400 mt-1.5">
        p-values BH-corrected within feature × endpoint × model ({rows.length} cancer types tested)
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
          95% CI
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10"><polygon points="5,1 9,5 5,9 1,5" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" /></svg>
          Pan-cancer pooled
        </span>
        <span className="text-zinc-400">Point size ∝ sample size</span>
      </div>
    </div>
  );
}
