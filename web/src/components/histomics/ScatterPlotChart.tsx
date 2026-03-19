import { useMemo, useState, useRef } from 'react';
import { scaleLinear } from 'd3-scale';
import { formatP, formatNum, formatCI } from '../../lib/formatters';

interface ScatterPlotChartProps {
  histomicValues: number[];
  molecularValues: number[];
  regression: { slope: number; intercept: number; xRange: [number, number] };
  n: number;
  xLabel: string;
  yLabel: string;
  spearmanRho?: number | null;
  spearmanCiLower?: number | null;
  spearmanCiUpper?: number | null;
  spearmanPAdj?: number | null;
}

export function ScatterPlotChart({
  histomicValues,
  molecularValues,
  regression,
  n,
  xLabel,
  yLabel,
  spearmanRho,
  spearmanCiLower,
  spearmanCiUpper,
  spearmanPAdj,
}: ScatterPlotChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 480;
  const height = 320;
  const margin = { top: 28, right: 16, bottom: 44, left: 52 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const { xScale, yScale } = useMemo(() => {
    const xMin = Math.min(...histomicValues);
    const xMax = Math.max(...histomicValues);
    const yMin = Math.min(...molecularValues);
    const yMax = Math.max(...molecularValues);
    const xPad = (xMax - xMin) * 0.05 || 1;
    const yPad = (yMax - yMin) * 0.05 || 1;

    return {
      xScale: scaleLinear().domain([xMin - xPad, xMax + xPad]).range([0, innerW]),
      yScale: scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerH, 0]),
    };
  }, [histomicValues, molecularValues, innerW, innerH]);

  const regLine = useMemo(() => {
    const [x0, x1] = regression.xRange;
    const y0 = regression.slope * x0 + regression.intercept;
    const y1 = regression.slope * x1 + regression.intercept;
    return { x1: xScale(x0), y1: yScale(y0), x2: xScale(x1), y2: yScale(y1) };
  }, [regression, xScale, yScale]);

  return (
    <div className="relative overflow-visible">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Scatter plot of histomic feature ${xLabel} vs molecular marker ${yLabel}: ${n} samples${spearmanRho != null ? `, Spearman ρ = ${formatNum(spearmanRho)} (95% CI ${formatCI(spearmanCiLower ?? null, spearmanCiUpper ?? null)}), p = ${formatP(spearmanPAdj ?? null)}` : ''}`}
      >
        {/* Chart title */}
        <text x={margin.left} y={14} className="text-[11px] fill-zinc-700 font-semibold">
          Spearman Rank Correlation (two-sided)
        </text>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Y gridlines */}
          {yScale.ticks(5).map((tick) => (
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

          {/* X gridlines */}
          {xScale.ticks(5).map((tick) => (
            <line
              key={tick}
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={0}
              y2={innerH}
              stroke="#e4e4e7"
              strokeWidth={1}
            />
          ))}

          {/* Points */}
          {histomicValues.map((hv, i) => (
            <circle
              key={i}
              cx={xScale(hv)}
              cy={yScale(molecularValues[i])}
              r={2.5}
              fill="#3b82f6"
              fillOpacity={hoveredIdx === i ? 0.9 : 0.5}
              stroke={hoveredIdx === i ? '#1d4ed8' : 'none'}
              strokeWidth={hoveredIdx === i ? 1 : 0}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-crosshair"
            />
          ))}

          {/* Regression line */}
          <line
            x1={regLine.x1}
            y1={regLine.y1}
            x2={regLine.x2}
            y2={regLine.y2}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
          {/* OLS disclaimer */}
          <text
            x={regLine.x2}
            y={regLine.y2 - 6}
            textAnchor="end"
            className="text-[7px] fill-zinc-400 italic"
          >
            OLS line for visual reference only
          </text>

          {/* X ticks */}
          {xScale.ticks(5).map((tick) => (
            <text
              key={tick}
              x={xScale(tick)}
              y={innerH + 14}
              textAnchor="middle"
              className="text-[9px] fill-zinc-500"
            >
              {tick.toPrecision(3)}
            </text>
          ))}

          {/* Y ticks */}
          {yScale.ticks(5).map((tick) => (
            <text
              key={tick}
              x={-4}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[9px] fill-zinc-500"
            >
              {tick.toPrecision(3)}
            </text>
          ))}

          {/* Axis labels */}
          <text
            x={innerW / 2}
            y={innerH + 34}
            textAnchor="middle"
            className="text-[10px] fill-zinc-600"
          >
            {xLabel}
          </text>
          <text
            x={-innerH / 2}
            y={-40}
            textAnchor="middle"
            className="text-[10px] fill-zinc-600"
            transform="rotate(-90)"
          >
            {yLabel}
          </text>

          {/* Stat annotation (top-right) */}
          {spearmanRho != null ? (
            <>
              <text
                x={innerW - 4}
                y={12}
                textAnchor="end"
                className="text-[10px] fill-zinc-700"
              >
                ρ = {formatNum(spearmanRho)} · 95% CI (bootstrap): {formatCI(spearmanCiLower ?? null, spearmanCiUpper ?? null)}
              </text>
              <text
                x={innerW - 4}
                y={24}
                textAnchor="end"
                className="text-[10px] fill-zinc-400"
              >
                p_adj = {formatP(spearmanPAdj ?? null)} · N = {n}
              </text>
            </>
          ) : (
            <text
              x={innerW - 4}
              y={12}
              textAnchor="end"
              className="text-[10px] fill-zinc-400"
            >
              N = {n}
            </text>
          )}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoveredIdx != null && (
        <div
          className="absolute bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-10"
          style={{
            left: `${((xScale(histomicValues[hoveredIdx]) + margin.left) / width) * 100}%`,
            top: `${((yScale(molecularValues[hoveredIdx]) + margin.top) / height) * 100}%`,
            transform: 'translate(-50%, -110%)',
          }}
        >
          <div className="text-[11px]">{xLabel}: {histomicValues[hoveredIdx].toPrecision(4)}</div>
          <div className="text-[11px]">{yLabel}: {molecularValues[hoveredIdx].toPrecision(4)}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10"><circle cx="5" cy="5" r="3" fill="#3b82f6" fillOpacity="0.5" /></svg>
          Samples
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
          OLS regression
        </span>
      </div>
    </div>
  );
}
