import { useMemo } from 'react';
import { scaleLinear, scaleBand } from 'd3-scale';
import { area, curveBasis } from 'd3-shape';
import type { ViolinGroup } from '../../types';

const GROUP_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
const MIN_KDE_N = 10;

/** Simple seeded PRNG (mulberry32). */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

interface ViolinPlotChartProps {
  groups: ViolinGroup[];
  yLabel: string;
  title?: string;
}

/** Gaussian KDE with Silverman bandwidth. */
function gaussianKde(values: number[], nPoints = 50): { x: number; density: number }[] {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const bandwidth = 1.06 * std * n ** -0.2;

  if (bandwidth === 0 || !isFinite(bandwidth)) {
    return [{ x: mean, density: 1 }];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
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

export function ViolinPlotChart({ groups, yLabel, title = 'Distribution Comparison' }: ViolinPlotChartProps) {
  const width = 480;
  const height = 320;
  const margin = { top: 28, right: 16, bottom: 44, left: 52 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const { yScale, xBand, violins } = useMemo(() => {
    const allValues = groups.flatMap((g) => g.values);
    const yMin = Math.min(...allValues);
    const yMax = Math.max(...allValues);
    const yPad = (yMax - yMin) * 0.05 || 1;

    const yScale = scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerH, 0]);
    const xBand = scaleBand()
      .domain(groups.map((g) => g.name))
      .range([0, innerW])
      .padding(0.2);

    const violins = groups.map((g, gi) => {
      const color = GROUP_COLORS[gi % GROUP_COLORS.length];

      if (g.n < MIN_KDE_N) {
        // Pre-compute jitter offsets so they are stable across re-renders
        const rng = mulberry32(hashString(g.name));
        const jitter = g.values.map(() => (rng() - 0.5));
        return { group: g, color, kde: null, maxDensity: 0, jitter };
      }

      const kde = gaussianKde(g.values);
      const maxDensity = Math.max(...kde.map((p) => p.density));
      return { group: g, color, kde, maxDensity, jitter: [] as number[] };
    });

    // Normalize all violins to the same max width
    const globalMaxDensity = Math.max(...violins.map((v) => v.maxDensity), 1e-10);
    for (const v of violins) {
      v.maxDensity = globalMaxDensity;
    }

    return { yScale, xBand, violins };
  }, [groups, innerW, innerH]);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Violin plot of ${yLabel} distribution across ${groups.length} cancer sample groups showing kernel density and median values`}
      >
        {/* Chart title */}
        <text x={margin.left} y={14} className="text-[11px] fill-zinc-700 font-semibold">
          {title}
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

          {/* Y label */}
          <text
            x={-innerH / 2}
            y={-40}
            textAnchor="middle"
            className="text-[10px] fill-zinc-600"
            transform="rotate(-90)"
          >
            {yLabel}
          </text>

          {/* Violins */}
          {violins.map((v) => {
            const cx = (xBand(v.group.name) ?? 0) + xBand.bandwidth() / 2;
            const halfW = xBand.bandwidth() / 2;

            if (!v.kde) {
              // Jittered dots (jitter is pre-computed in useMemo for stability)
              return (
                <g key={v.group.name}>
                  {v.group.values.map((val, i) => (
                    <circle
                      key={i}
                      cx={cx + v.jitter[i] * halfW * 0.8}
                      cy={yScale(val)}
                      r={2}
                      fill={v.color}
                      fillOpacity={0.6}
                    />
                  ))}
                  {/* Label */}
                  <text
                    x={cx}
                    y={innerH + 14}
                    textAnchor="middle"
                    className="text-[9px] fill-zinc-600"
                  >
                    {v.group.name}
                  </text>
                  <text
                    x={cx}
                    y={innerH + 26}
                    textAnchor="middle"
                    className="text-[8px] fill-zinc-400"
                  >
                    (n={v.group.n})
                  </text>
                </g>
              );
            }

            // Build symmetric violin path
            const densityScale = scaleLinear()
              .domain([0, v.maxDensity])
              .range([0, halfW]);

            const areaGen = area<{ x: number; density: number }>()
              .y((d) => yScale(d.x))
              .x0((d) => cx - densityScale(d.density))
              .x1((d) => cx + densityScale(d.density))
              .curve(curveBasis);

            const violinPath = areaGen(v.kde) || '';

            // Box plot overlay
            const { q1, q3, median } = v.group;
            const iqr = q3 - q1;
            const whiskerLo = Math.max(
              Math.min(...v.group.values),
              q1 - 1.5 * iqr,
            );
            const whiskerHi = Math.min(
              Math.max(...v.group.values),
              q3 + 1.5 * iqr,
            );
            const boxW = 8;

            return (
              <g key={v.group.name}>
                {/* Violin shape */}
                <path d={violinPath} fill={v.color} fillOpacity={0.2} stroke={v.color} strokeWidth={1} />

                {/* Whiskers */}
                <line x1={cx} x2={cx} y1={yScale(whiskerLo)} y2={yScale(whiskerHi)} stroke="#71717a" strokeWidth={1} />
                <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yScale(whiskerLo)} y2={yScale(whiskerLo)} stroke="#71717a" strokeWidth={1} />
                <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yScale(whiskerHi)} y2={yScale(whiskerHi)} stroke="#71717a" strokeWidth={1} />

                {/* Box */}
                <rect
                  x={cx - boxW / 2}
                  y={yScale(q3)}
                  width={boxW}
                  height={yScale(q1) - yScale(q3)}
                  fill="white"
                  stroke="#71717a"
                  strokeWidth={1}
                />

                {/* Median */}
                <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yScale(median)} y2={yScale(median)} stroke="#18181b" strokeWidth={2} />

                {/* Label */}
                <text x={cx} y={innerH + 14} textAnchor="middle" className="text-[9px] fill-zinc-600">
                  {v.group.name}
                </text>
                <text x={cx} y={innerH + 26} textAnchor="middle" className="text-[8px] fill-zinc-400">
                  (n={v.group.n})
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Box plot legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14">
            <rect x="2" y="3" width="10" height="8" fill="white" stroke="#71717a" strokeWidth="1" />
            <line x1="2" y1="7" x2="12" y2="7" stroke="#18181b" strokeWidth="2" />
          </svg>
          Median / IQR
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14">
            <line x1="7" y1="1" x2="7" y2="13" stroke="#71717a" strokeWidth="1" />
            <line x1="4" y1="1" x2="10" y2="1" stroke="#71717a" strokeWidth="1" />
            <line x1="4" y1="13" x2="10" y2="13" stroke="#71717a" strokeWidth="1" />
          </svg>
          Whiskers (1.5× IQR)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14">
            <path d="M2,12 Q4,2 7,2 Q10,2 12,12" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="1" />
          </svg>
          KDE (Gaussian, Silverman)
        </span>
      </div>
    </div>
  );
}
