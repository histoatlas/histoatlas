import { useMemo, useState, useCallback, forwardRef } from 'react';
import { scaleLinear, scaleLog, scaleBand } from 'd3-scale';
import type { AssociationTarget, SurvivalAssociation, CorrelationAssociation, CategoricalAssociation } from '../../types';
import { formatP, formatNum, formatHR } from '../../lib/formatters';
import { SkeletonTable } from '../ui/Skeleton';

interface AssociationsForestPlotProps {
  target: AssociationTarget;
  survivalData?: SurvivalAssociation[];
  correlationData?: CorrelationAssociation[];
  categoricalData?: CategoricalAssociation[];
  dataset?: string;
  cohort: string;
  isLoading: boolean;
}

interface ForestRow {
  feature: string;
  effect: number;
  ciLower: number | null;
  ciUpper: number | null;
  pAdj: number | null;
  isSignificant: boolean;
  badge: string;
  n: number;
}

interface TooltipState {
  clientX: number;
  clientY: number;
  row: ForestRow;
}

const WIDTH = 500;
const ROW_HEIGHT = 24;
const MARGIN = { top: 32, right: 80, bottom: 40, left: 160 };

function featureDisplayName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}

function buildRows(
  target: AssociationTarget,
  survivalData?: SurvivalAssociation[],
  correlationData?: CorrelationAssociation[],
  categoricalData?: CategoricalAssociation[],
): ForestRow[] {
  if (target === 'survival' && survivalData) {
    return survivalData
      .filter((d) => d.hazardRatio != null && d.hazardRatio > 0)
      .map((d) => ({
        feature: d.feature,
        effect: d.hazardRatio!,
        ciLower: d.hrCiLower,
        ciUpper: d.hrCiUpper,
        pAdj: d.pValueAdj,
        isSignificant: d.significantAdj,
        badge: d.evidenceStrengthBadge,
        n: d.nSamples,
      }))
      .sort((a, b) => Math.abs(Math.log(b.effect)) - Math.abs(Math.log(a.effect)));
  }
  if (target === 'correlations' && correlationData) {
    return correlationData
      .filter((d) => d.spearmanRho != null)
      .map((d) => ({
        feature: d.histomicFeature,
        effect: d.spearmanRho!,
        ciLower: d.spearmanCiLower,
        ciUpper: d.spearmanCiUpper,
        pAdj: d.spearmanPAdj,
        isSignificant: d.isSignificant,
        badge: d.evidenceStrengthBadge,
        n: d.nSamples,
      }))
      .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  }
  if (target === 'categorical' && categoricalData) {
    return categoricalData
      .filter((d) => d.effectSize != null)
      .map((d) => ({
        feature: d.histomicFeature,
        effect: d.effectSize!,
        ciLower: d.effectCiLower,
        ciUpper: d.effectCiUpper,
        pAdj: d.pValueAdj,
        isSignificant: d.isSignificant,
        badge: d.evidenceStrengthBadge,
        n: d.nSamples,
      }))
      .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  }
  return [];
}

const BADGE_COLORS: Record<string, string> = {
  strong: '#10b981',
  moderate: '#3b82f6',
  suggestive: '#f59e0b',
  insufficient: '#a1a1aa',
};

export const AssociationsForestPlot = forwardRef<SVGSVGElement, AssociationsForestPlotProps>(
  function AssociationsForestPlot(
    { target, survivalData, correlationData, categoricalData, dataset = 'tcga', cohort, isLoading },
    ref,
  ) {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    const rows = useMemo(
      () => buildRows(target, survivalData, correlationData, categoricalData),
      [target, survivalData, correlationData, categoricalData],
    );

    const isLogScale = target === 'survival';
    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = rows.length * ROW_HEIGHT;
    const height = innerHeight + MARGIN.top + MARGIN.bottom;

    const xScale = useMemo(() => {
      if (rows.length === 0) {
        return isLogScale
          ? scaleLog().domain([0.5, 2]).range([0, innerWidth])
          : scaleLinear().domain([-1, 1]).range([0, innerWidth]);
      }

      const allVals = rows.flatMap((r) => {
        const vals = [r.effect];
        if (r.ciLower != null) vals.push(r.ciLower);
        if (r.ciUpper != null) vals.push(r.ciUpper);
        return vals;
      });

      if (isLogScale) {
        const positiveVals = allVals.filter((v) => v > 0);
        if (positiveVals.length === 0) return scaleLog().domain([0.5, 2]).range([0, innerWidth]);
        const rawMin = Math.min(...positiveVals);
        const rawMax = Math.max(...positiveVals);
        const minVal = Math.max(rawMin / 1.3, 0.01);
        // Ensure maxVal > minVal even when all values are very small
        const maxVal = Math.max(Math.min(rawMax * 1.3, 10), minVal * 2);
        return scaleLog().domain([minVal, maxVal]).range([0, innerWidth]).clamp(true);
      }

      const absMax = Math.max(...allVals.map(Math.abs), 0.1);
      const domainMax = Math.min(absMax * 1.2, 1);
      return scaleLinear().domain([-domainMax, domainMax]).range([0, innerWidth]).nice();
    }, [rows, isLogScale, innerWidth]);

    const yScale = useMemo(
      () =>
        scaleBand<string>()
          .domain(rows.map((r) => r.feature))
          .range([0, innerHeight])
          .padding(0.3),
      [rows, innerHeight],
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent, row: ForestRow) => {
        setTooltip({ clientX: e.clientX, clientY: e.clientY, row });
      },
      [],
    );

    const handleMouseLeave = useCallback(() => setTooltip(null), []);

    if (isLoading) {
      return <SkeletonTable rows={10} columns={4} />;
    }

    if (rows.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
          No associations found for the selected filters.
        </div>
      );
    }

    const nullEffect = isLogScale ? 1 : 0;
    const xTicks = isLogScale
      ? [0.1, 0.25, 0.5, 1, 2, 4, 10].filter(
          (t) => t >= (xScale.domain()[0] as number) && t <= (xScale.domain()[1] as number),
        )
      : (xScale as ReturnType<typeof scaleLinear>).ticks(7);

    const xLabel = isLogScale ? 'Hazard Ratio (log scale)' : target === 'correlations' ? 'Spearman \u03C1' : "Cliff's \u03B4";

    return (
      <div className="relative overflow-x-auto"
        onMouseMove={(e) => {
          if (tooltip) setTooltip({ ...tooltip, clientX: e.clientX, clientY: e.clientY });
        }}
      >
        <svg
          ref={ref}
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="w-full"
          preserveAspectRatio="xMinYMin meet"
          role="img"
          aria-label={`Forest plot of histomic feature associations across ${rows.length} cancer morphology features. ${rows.filter(r => r.isSignificant).length} significant (p_adj < 0.05).`}
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Reference line at null effect */}
            <line
              x1={xScale(nullEffect)}
              x2={xScale(nullEffect)}
              y1={-4}
              y2={innerHeight + 4}
              stroke="#d4d4d8"
              strokeWidth={1}
              strokeDasharray="4 3"
            />

            {/* Baseline */}
            <line
              x1={0}
              x2={innerWidth}
              y1={innerHeight}
              y2={innerHeight}
              stroke="#e4e4e7"
            />

            {/* X axis ticks + labels */}
            {xTicks.map((t) => (
              <g key={`xt-${t}`}>
                <line
                  x1={xScale(t)}
                  x2={xScale(t)}
                  y1={innerHeight}
                  y2={innerHeight + 4}
                  stroke="#a1a1aa"
                />
                <text
                  x={xScale(t)}
                  y={innerHeight + 16}
                  textAnchor="middle"
                  className="text-[9px] fill-zinc-500"
                >
                  {isLogScale ? t : t.toFixed(1)}
                </text>
              </g>
            ))}
            <text
              x={innerWidth / 2}
              y={innerHeight + 32}
              textAnchor="middle"
              className="text-[10px] fill-zinc-600"
            >
              {xLabel}
            </text>

            {/* Rows */}
            {rows.map((row) => {
              const cy = (yScale(row.feature) ?? 0) + yScale.bandwidth() / 2;
              const cx = xScale(row.effect);
              const color = row.isSignificant ? '#f59e0b' : '#a1a1aa';
              const ciL = row.ciLower != null ? xScale(Math.max(row.ciLower, xScale.domain()[0] as number)) : null;
              const ciU = row.ciUpper != null ? xScale(Math.min(row.ciUpper, xScale.domain()[1] as number)) : null;

              return (
                <g key={row.feature}>
                  {/* Hit area */}
                  <a href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(row.feature)}/`}>
                    <rect
                      x={-MARGIN.left}
                      y={cy - ROW_HEIGHT / 2}
                      width={WIDTH}
                      height={ROW_HEIGHT}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleMouseMove(e, row)}
                      onMouseLeave={handleMouseLeave}
                    />
                  </a>

                  {/* Row label */}
                  <text
                    x={-8}
                    y={cy}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="text-[10px] fill-zinc-700 pointer-events-none"
                  >
                    {truncate(featureDisplayName(row.feature), 22)}
                  </text>

                  {/* CI whisker */}
                  {ciL != null && ciU != null && (
                    <line
                      x1={ciL}
                      x2={ciU}
                      y1={cy}
                      y2={cy}
                      stroke={color}
                      strokeWidth={1.5}
                      className="pointer-events-none"
                    />
                  )}

                  {/* Point estimate */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={row.isSignificant ? color : 'white'}
                    stroke={color}
                    strokeWidth={1.5}
                    className="pointer-events-none"
                  />

                  {/* Value label above dot */}
                  <text
                    x={cx}
                    y={cy - 8}
                    textAnchor="middle"
                    className="text-[8px] fill-zinc-500 pointer-events-none"
                  >
                    {isLogScale ? formatHR(row.effect) : formatNum(row.effect, 2)}
                  </text>

                  {/* p-adj on right */}
                  <text
                    x={innerWidth + 8}
                    y={cy}
                    dominantBaseline="middle"
                    className="text-[9px] fill-zinc-400 pointer-events-none"
                  >
                    {formatP(row.pAdj)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed pointer-events-none bg-zinc-800 text-white text-xs rounded shadow-lg px-3 py-2 z-50"
            style={{
              left: tooltip.clientX,
              top: tooltip.clientY,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="font-medium">{featureDisplayName(tooltip.row.feature)}</div>
            <div className="mt-0.5 font-mono">
              {isLogScale
                ? `HR: ${formatHR(tooltip.row.effect)} [${formatHR(tooltip.row.ciLower)} – ${formatHR(tooltip.row.ciUpper)}]`
                : `${target === 'correlations' ? 'Spearman ρ' : "Cliff's δ"}: ${formatNum(tooltip.row.effect, 3)} [${formatNum(tooltip.row.ciLower, 3)} – ${formatNum(tooltip.row.ciUpper, 3)}]`}
            </div>
            <div className="font-mono">p<sub>adj</sub>: {formatP(tooltip.row.pAdj)}</div>
            <div className="text-zinc-400">N = {tooltip.row.n}</div>
            <div className="mt-0.5">
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: `${BADGE_COLORS[tooltip.row.badge] ?? '#a1a1aa'}20`,
                  color: BADGE_COLORS[tooltip.row.badge] ?? '#a1a1aa',
                }}
              >
                {tooltip.row.badge.charAt(0).toUpperCase() + tooltip.row.badge.slice(1)}
              </span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-start gap-4 mt-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" /></svg>
            Significant (p<sub>adj</sub> &lt; 0.05)
          </span>
          <span className="flex items-center gap-1">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="white" stroke="#a1a1aa" strokeWidth="1.5" /></svg>
            Not significant
          </span>
        </div>
      </div>
    );
  },
);
