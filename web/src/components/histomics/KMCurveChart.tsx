import { useMemo, useState, useRef, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';
import { line, curveStepAfter, area } from 'd3-shape';
import { bisectRight } from 'd3-array';
import { formatP, formatHR, formatNum, formatCI } from '../../lib/formatters';

const GROUP_COLORS: Record<string, string> = {
  high: '#ef4444',
  low: '#3b82f6',
  'q4 (high)': '#ef4444',
  'q1 (low)': '#3b82f6',
};

export interface KMCurve {
  group: string;
  timePoints: number[];
  survivalProbs: number[];
  ciLower: number[];
  ciUpper: number[];
  censoringTimes?: number[];
  censoringProbs?: number[];
  nAtRisk?: number[];
  nSamples: number;
  nEvents: number;
  medianSurvival?: number | null;
}

interface KMCurveChartProps {
  curves: KMCurve[];
  hazardRatio?: number | null;
  hrCiLower?: number | null;
  hrCiUpper?: number | null;
  pValue?: number | null;
  pValueAdj?: number | null;
  rmstDifference?: number | null;
  rmstCiLower?: number | null;
  rmstCiUpper?: number | null;
}

function survivalAtTime(timePoints: number[], survivalProbs: number[], t: number): number | null {
  if (timePoints.length === 0) return null;
  if (t < timePoints[0]) return 1;
  const idx = bisectRight(timePoints, t) - 1;
  return survivalProbs[Math.min(idx, survivalProbs.length - 1)];
}

function ciAtTime(timePoints: number[], values: number[], t: number): number | null {
  if (timePoints.length === 0 || values.length === 0) return null;
  if (t < timePoints[0]) return null;
  const idx = bisectRight(timePoints, t) - 1;
  return values[Math.min(idx, values.length - 1)];
}

function getColor(group: string): string {
  return GROUP_COLORS[group.toLowerCase()] ?? '#6b7280';
}

/** Standard time points for the number-at-risk table (months). */
const N_AT_RISK_TIMES = [0, 12, 24, 36, 48, 60];

/**
 * Derive number at risk at fixed time points.
 * Uses nAtRisk array aligned with timePoints if available,
 * otherwise approximates from survival probability × initial N.
 */
function getAtRiskCounts(curve: KMCurve, times: number[]): (number | null)[] {
  const maxTime = curve.timePoints.length > 0 ? curve.timePoints[curve.timePoints.length - 1] : 0;
  return times.map((t) => {
    if (t > maxTime * 1.05) return null; // beyond follow-up
    if (curve.nAtRisk && curve.nAtRisk.length > 0) {
      // nAtRisk is aligned with timePoints
      if (t <= 0) return curve.nAtRisk[0] ?? curve.nSamples;
      const idx = bisectRight(curve.timePoints, t) - 1;
      return curve.nAtRisk[Math.min(Math.max(idx, 0), curve.nAtRisk.length - 1)];
    }
    // Approximate: S(t) × nSamples
    const prob = survivalAtTime(curve.timePoints, curve.survivalProbs, t);
    if (prob == null) return curve.nSamples;
    return Math.ceil(prob * curve.nSamples);
  });
}

export function KMCurveChart({ curves, hazardRatio, hrCiLower, hrCiUpper, pValue, pValueAdj, rmstDifference, rmstCiLower, rmstCiUpper }: KMCurveChartProps) {
  const width = 480;
  const height = 300;
  const margin = { top: 28, right: 16, bottom: 44, left: 44 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const { xScale, yScale, paths, ciBands, censoringMarks } = useMemo(() => {
    const allTimes = curves.flatMap((c) => c.timePoints);
    const maxTime = Math.max(...allTimes, 1);

    const xScale = scaleLinear().domain([0, maxTime]).range([0, innerW]);
    const yScale = scaleLinear().domain([0, 1]).range([innerH, 0]);

    const lineGen = line<[number, number]>()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]))
      .curve(curveStepAfter);

    const areaGen = area<[number, number, number]>()
      .x((d) => xScale(d[0]))
      .y0((d) => yScale(d[1]))
      .y1((d) => yScale(d[2]))
      .curve(curveStepAfter);

    const paths = curves.map((curve) => {
      const points: [number, number][] = curve.timePoints.map((t, i) => [
        t,
        curve.survivalProbs[i],
      ]);
      return { group: curve.group, d: lineGen(points) || '' };
    });

    const ciBands = curves.map((curve) => {
      const points: [number, number, number][] = curve.timePoints.map(
        (t, i) => [t, curve.ciLower[i], curve.ciUpper[i]],
      );
      return { group: curve.group, d: areaGen(points) || '' };
    });

    const censoringMarks = curves.map((curve) => ({
      group: curve.group,
      marks: (curve.censoringTimes ?? []).map((t, i) => ({
        x: xScale(t),
        y: yScale((curve.censoringProbs ?? [])[i] ?? 0),
      })),
    }));

    return { xScale, yScale, paths, ciBands, censoringMarks };
  }, [curves, innerW, innerH]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * width - margin.left;
      const time = xScale.invert(svgX);
      const [tMin, tMax] = xScale.domain();
      if (time < tMin || time > tMax) {
        setHoverTime(null);
      } else {
        setHoverTime(time);
      }
    },
    [xScale, width, margin.left],
  );

  const handleMouseLeave = useCallback(() => setHoverTime(null), []);

  // Median survival markers
  const medianY = yScale(0.5);

  // Crosshair data at hover time
  const crosshairData = useMemo(() => {
    if (hoverTime == null) return null;
    return curves.map((curve) => {
      const prob = survivalAtTime(curve.timePoints, curve.survivalProbs, hoverTime);
      const ciLo = ciAtTime(curve.timePoints, curve.ciLower, hoverTime);
      const ciHi = ciAtTime(curve.timePoints, curve.ciUpper, hoverTime);
      return { group: curve.group, prob, ciLo, ciHi };
    });
  }, [hoverTime, curves]);

  // Check if any median is available
  const hasMedian = curves.some((c) => c.medianSurvival != null);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="img"
        aria-label={`Kaplan-Meier survival curve comparing ${curves.length} cancer patient groups: ${hazardRatio != null ? `hazard ratio ${formatHR(hazardRatio)} (95% CI ${formatHR(hrCiLower)}-${formatHR(hrCiUpper)}), p = ${formatP(pValueAdj ?? null)}` : `${curves.reduce((s, c) => s + c.nSamples, 0)} samples`}`}
      >
        {/* Chart title */}
        <text x={margin.left} y={14} className="text-[11px] fill-zinc-700 font-semibold">
          Kaplan-Meier, Cox PH regression (two-sided)
        </text>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Y gridlines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick) => (
            <g key={tick}>
              <line
                x1={0}
                x2={innerW}
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
                className="text-[9px] fill-zinc-400"
              >
                {tick.toFixed(2)}
              </text>
            </g>
          ))}

          {/* X ticks */}
          {xScale.ticks(5).map((tick) => (
            <text
              key={tick}
              x={xScale(tick)}
              y={innerH + 14}
              textAnchor="middle"
              className="text-[9px] fill-zinc-400"
            >
              {tick}
            </text>
          ))}

          {/* Axis labels */}
          <text
            x={innerW / 2}
            y={innerH + 32}
            textAnchor="middle"
            className="text-[10px] fill-zinc-500"
          >
            Time (months)
          </text>
          <text
            x={-innerH / 2}
            y={-32}
            textAnchor="middle"
            className="text-[10px] fill-zinc-500"
            transform="rotate(-90)"
          >
            Survival probability
          </text>

          {/* CI bands */}
          {ciBands.map((band) => (
            <path
              key={`ci-${band.group}`}
              d={band.d}
              fill={getColor(band.group)}
              fillOpacity={0.12}
            />
          ))}

          {/* Median survival markers */}
          {hasMedian && (
            <g>
              {/* Dashed horizontal line at S(t) = 0.50 */}
              <line
                x1={0} x2={innerW}
                y1={medianY} y2={medianY}
                stroke="#a1a1aa" strokeWidth={0.75}
                strokeDasharray="4 3" opacity={0.6}
              />
              {/* Drop lines per curve */}
              {curves.map((c) => {
                if (c.medianSurvival == null) return null;
                const color = getColor(c.group);
                return (
                  <g key={`median-${c.group}`}>
                    <line
                      x1={xScale(c.medianSurvival)} x2={xScale(c.medianSurvival)}
                      y1={medianY} y2={innerH}
                      stroke={color} strokeWidth={1}
                      strokeDasharray="3 2" opacity={0.7}
                    />
                    <text
                      x={xScale(c.medianSurvival)} y={innerH + 24}
                      textAnchor="middle"
                      className="text-[8px] font-medium"
                      fill={color}
                    >
                      {c.medianSurvival.toFixed(0)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Curves */}
          {paths.map((path) => (
            <path
              key={path.group}
              d={path.d}
              fill="none"
              stroke={getColor(path.group)}
              strokeWidth={2}
            />
          ))}

          {/* Censoring ticks */}
          {censoringMarks.map((cm) =>
            cm.marks.map((mark, i) => (
              <line
                key={`cens-${cm.group}-${i}`}
                x1={mark.x} x2={mark.x}
                y1={mark.y - 3} y2={mark.y + 3}
                stroke={getColor(cm.group)}
                strokeWidth={1}
                opacity={0.5}
              />
            ))
          )}

          {/* Crosshair on hover */}
          {hoverTime != null && crosshairData && (
            <g>
              {/* Vertical line */}
              <line
                x1={xScale(hoverTime)} x2={xScale(hoverTime)}
                y1={0} y2={innerH}
                stroke="#71717a" strokeWidth={0.75}
                strokeDasharray="3 2"
              />
              {/* Dots on each curve */}
              {crosshairData.map((cd) => {
                if (cd.prob == null) return null;
                return (
                  <circle
                    key={cd.group}
                    cx={xScale(hoverTime)}
                    cy={yScale(cd.prob)}
                    r={3.5}
                    fill={getColor(cd.group)}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          )}

          {/* HR/p-value annotation */}
          {hazardRatio != null && (
            <g>
              <text
                x={innerW - 4} y={12}
                textAnchor="end"
                className="text-[9px] fill-zinc-600 font-medium"
              >
                HR {formatHR(hazardRatio)} (95% CI: {formatHR(hrCiLower)}, {formatHR(hrCiUpper)})
              </text>
              <text
                x={innerW - 4} y={24}
                textAnchor="end"
                className="text-[9px] fill-zinc-400"
              >
                {pValue != null ? `p = ${formatP(pValue)} · ` : ''}p_adj = {formatP(pValueAdj)}
              </text>
            </g>
          )}
          {/* RMST annotation fallback when HR is null (PH violated) */}
          {hazardRatio == null && rmstDifference != null && (
            <g>
              <text
                x={innerW - 4} y={12}
                textAnchor="end"
                className="text-[9px] fill-zinc-600 font-medium"
              >
                PH violated · RMST diff = {formatNum(rmstDifference)} days
              </text>
              <text
                x={innerW - 4} y={24}
                textAnchor="end"
                className="text-[9px] fill-zinc-400"
              >
                {formatCI(rmstCiLower ?? null, rmstCiUpper ?? null)}
              </text>
            </g>
          )}

          {/* Invisible hit area for mouse events */}
          <rect
            x={0} y={0}
            width={innerW} height={innerH}
            fill="transparent"
            className="cursor-crosshair"
          />
        </g>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap mt-1.5 text-xs text-zinc-500">
        {curves.map((c) => (
          <div key={c.group} className="flex items-center gap-1.5">
            <div
              className="w-4 h-[2px]"
              style={{ backgroundColor: getColor(c.group) }}
            />
            <span>
              {c.group} (n={c.nSamples})
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-2.5 rounded-sm bg-zinc-300 opacity-40" />
          <span>95% CI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="10" viewBox="0 0 16 10">
            <line x1="8" x2="8" y1="1" y2="9" stroke="#71717a" strokeWidth={1.5} />
          </svg>
          <span>Censored</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="10" viewBox="0 0 16 10">
            <line x1="0" x2="16" y1="5" y2="5" stroke="#a1a1aa" strokeWidth={1} strokeDasharray="3 2" />
          </svg>
          <span>Median survival</span>
        </div>
      </div>

      {/* Number-at-risk table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[10px] text-zinc-500">
          <thead>
            <tr>
              <th className="text-left font-medium text-zinc-400 pr-2 py-0.5">At risk</th>
              {N_AT_RISK_TIMES.filter((t) => t <= (xScale.domain()[1] ?? 60)).map((t) => (
                <th key={t} className="text-center font-medium text-zinc-400 px-1.5 py-0.5">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {curves.map((curve) => {
              const counts = getAtRiskCounts(curve, N_AT_RISK_TIMES);
              return (
                <tr key={curve.group}>
                  <td className="text-left pr-2 py-0.5" style={{ color: getColor(curve.group) }}>
                    {curve.group}
                  </td>
                  {N_AT_RISK_TIMES.filter((t) => t <= (xScale.domain()[1] ?? 60)).map((t, i) => (
                    <td key={t} className="text-center font-mono px-1.5 py-0.5">
                      {counts[i] != null ? counts[i] : '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hover tooltip (HTML overlay) */}
      {hoverTime != null && crosshairData && (
        <div
          className="absolute bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 pointer-events-none z-10 w-48"
          style={{
            left: `${((xScale(hoverTime) + margin.left) / width) * 100}%`,
            transform: 'translateX(-50%)',
            top: 24,
          }}
        >
          <div className="font-medium text-zinc-300 mb-1">
            t = {hoverTime.toFixed(1)} months
          </div>
          <div className="space-y-0.5">
            {crosshairData.map((cd) => {
              if (cd.prob == null) return null;
              return (
                <div key={cd.group} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getColor(cd.group) }}
                  />
                  <span className="text-[11px]">
                    S = {cd.prob.toFixed(3)}
                    {cd.ciLo != null && cd.ciHi != null && (
                      <span className="text-zinc-400 ml-1">
                        (95% CI: {cd.ciLo.toFixed(3)}, {cd.ciHi.toFixed(3)})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
