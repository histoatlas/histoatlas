import { useMemo, useState, useCallback, forwardRef } from 'react';
import { scaleLinear } from 'd3-scale';
import type { AssociationTarget, SurvivalAssociation, CorrelationAssociation, CategoricalAssociation } from '../../types';
import { formatP, formatNum } from '../../lib/formatters';
import { SkeletonTable } from '../ui/Skeleton';

interface VolcanoPlotProps {
  target: AssociationTarget;
  survivalData?: SurvivalAssociation[];
  correlationData?: CorrelationAssociation[];
  categoricalData?: CategoricalAssociation[];
  dataset?: string;
  cohort: string;
  isLoading: boolean;
}

interface VolcanoPoint {
  feature: string;
  x: number;
  y: number;
  pAdj: number | null;
  isSignificant: boolean;
  direction: 'positive' | 'negative' | 'none';
  badge: string;
  n: number;
  /** Original (un-transformed) effect size for tooltip display. */
  effectValue: number;
  ciLower: number | null;
  ciUpper: number | null;
  effectLabel: string;
}

interface TooltipState {
  clientX: number;
  clientY: number;
  point: VolcanoPoint;
}

const WIDTH = 560;
const HEIGHT = 400;
const MARGIN = { top: 20, right: 40, bottom: 50, left: 60 };
const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const SIG_THRESHOLD = -Math.log10(0.05); // ~1.3
const MAX_LABELS = 8;

function featureDisplayName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPoints(
  target: AssociationTarget,
  survivalData?: SurvivalAssociation[],
  correlationData?: CorrelationAssociation[],
  categoricalData?: CategoricalAssociation[],
): VolcanoPoint[] {
  if (target === 'survival' && survivalData) {
    return survivalData
      .filter((d) => d.hazardRatio != null && d.hazardRatio > 0 && d.pValueAdj != null && d.pValueAdj > 0)
      .map((d) => {
        const logHr = Math.log(d.hazardRatio!);
        return {
          feature: d.feature,
          x: logHr,
          y: -Math.log10(d.pValueAdj!),
          pAdj: d.pValueAdj,
          isSignificant: d.significantAdj,
          direction: logHr > 0 ? 'positive' : logHr < 0 ? 'negative' : 'none',
          badge: d.evidenceStrengthBadge,
          n: d.nSamples,
          effectValue: d.hazardRatio!,
          ciLower: d.hrCiLower,
          ciUpper: d.hrCiUpper,
          effectLabel: 'HR',
        };
      });
  }
  if (target === 'correlations' && correlationData) {
    return correlationData
      .filter((d) => d.spearmanRho != null && d.spearmanPAdj != null && d.spearmanPAdj > 0)
      .map((d) => ({
        feature: d.histomicFeature,
        x: d.spearmanRho!,
        y: -Math.log10(d.spearmanPAdj!),
        pAdj: d.spearmanPAdj,
        isSignificant: d.isSignificant,
        direction: d.spearmanRho! > 0 ? 'positive' : d.spearmanRho! < 0 ? 'negative' : 'none',
        badge: d.evidenceStrengthBadge,
        n: d.nSamples,
        effectValue: d.spearmanRho!,
        ciLower: d.spearmanCiLower,
        ciUpper: d.spearmanCiUpper,
        effectLabel: 'Spearman \u03C1',
      }));
  }
  if (target === 'categorical' && categoricalData) {
    return categoricalData
      .filter((d) => d.effectSize != null && d.pValueAdj != null && d.pValueAdj > 0)
      .map((d) => ({
        feature: d.histomicFeature,
        x: d.effectSize!,
        y: -Math.log10(d.pValueAdj!),
        pAdj: d.pValueAdj,
        isSignificant: d.isSignificant,
        direction: d.effectSize! > 0 ? 'positive' : d.effectSize! < 0 ? 'negative' : 'none',
        badge: d.evidenceStrengthBadge,
        n: d.nSamples,
        effectValue: d.effectSize!,
        ciLower: d.effectCiLower,
        ciUpper: d.effectCiUpper,
        effectLabel: d.effectSizeName,
      }));
  }
  return [];
}

function getAxisLabel(target: AssociationTarget): string {
  if (target === 'survival') return 'ln(HR)';
  if (target === 'correlations') return 'Spearman \u03C1';
  return "Cliff's \u03B4";
}

function getEffectThresholds(target: AssociationTarget): { value: number; label: string }[] {
  if (target === 'survival') {
    const v = Math.log(1.5);
    return [{ value: v, label: '|HR| = 1.5' }, { value: -v, label: '|HR| = 1.5' }];
  }
  if (target === 'correlations') return [{ value: 0.3, label: '|\u03C1| = 0.3' }, { value: -0.3, label: '|\u03C1| = 0.3' }];
  return [{ value: 0.3, label: '|\u03B4| = 0.3' }, { value: -0.3, label: '|\u03B4| = 0.3' }];
}

export const VolcanoPlot = forwardRef<SVGSVGElement, VolcanoPlotProps>(function VolcanoPlot(
  { target, survivalData, correlationData, categoricalData, dataset = 'tcga', cohort, isLoading },
  ref,
) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const points = useMemo(
    () => buildPoints(target, survivalData, correlationData, categoricalData),
    [target, survivalData, correlationData, categoricalData],
  );

  const { xScale, yScale } = useMemo(() => {
    if (points.length === 0) {
      return {
        xScale: scaleLinear().domain([-1, 1]).range([0, INNER_W]),
        yScale: scaleLinear().domain([0, 5]).range([INNER_H, 0]),
      };
    }
    const xExtent = Math.max(...points.map((p) => Math.abs(p.x)), 0.5);
    const yMax = Math.max(...points.map((p) => p.y), SIG_THRESHOLD + 1);
    return {
      xScale: scaleLinear().domain([-xExtent * 1.15, xExtent * 1.15]).range([0, INNER_W]).nice(),
      yScale: scaleLinear().domain([0, yMax * 1.1]).range([INNER_H, 0]).nice(),
    };
  }, [points]);

  const effectThresholds = getEffectThresholds(target);

  // Top significant features for labels, with greedy displacement to avoid overlap
  const labeledPoints = useMemo(() => {
    const top = [...points]
      .filter((p) => p.isSignificant)
      .sort((a, b) => b.y - a.y)
      .slice(0, MAX_LABELS);

    // Compute initial label positions and displace to avoid overlap
    const LABEL_HEIGHT = 10; // Approximate label height in SVG units
    const labels = top.map((p) => {
      const px = xScale(p.x);
      const py = yScale(p.y);
      return { point: p, px, py, labelY: py - 2 };
    });

    // Sort by SVG y-position (top of plot first = smallest y)
    labels.sort((a, b) => a.labelY - b.labelY);

    // Greedy push-down: if a label overlaps the previous one, push it down
    for (let i = 1; i < labels.length; i++) {
      const prev = labels[i - 1];
      const curr = labels[i];
      const overlap = prev.labelY + LABEL_HEIGHT - curr.labelY;
      if (overlap > 0) {
        curr.labelY = prev.labelY + LABEL_HEIGHT;
      }
    }

    return labels;
  }, [points, xScale, yScale]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, point: VolcanoPoint) => {
      setTooltip({ clientX: e.clientX, clientY: e.clientY, point });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (isLoading) {
    return <SkeletonTable rows={8} columns={4} />;
  }

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
        No associations found for the selected filters.
      </div>
    );
  }

  const xLabel = getAxisLabel(target);
  const xTicks = xScale.ticks(7);
  const yTicks = yScale.ticks(6);

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Volcano plot of histomic feature associations: ${points.length} features tested. X-axis: ${xLabel}. Y-axis: -log10(p_adj). ${points.filter(p => p.isSignificant).length} significant features.`}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Gridlines */}
          {yTicks.map((t) => (
            <line
              key={`yg-${t}`}
              x1={0}
              x2={INNER_W}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="#e4e4e7"
              strokeWidth={0.5}
            />
          ))}
          {xTicks.map((t) => (
            <line
              key={`xg-${t}`}
              x1={xScale(t)}
              x2={xScale(t)}
              y1={0}
              y2={INNER_H}
              stroke="#e4e4e7"
              strokeWidth={0.5}
            />
          ))}

          {/* Significance threshold line */}
          <line
            x1={0}
            x2={INNER_W}
            y1={yScale(SIG_THRESHOLD)}
            y2={yScale(SIG_THRESHOLD)}
            stroke="#a1a1aa"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={INNER_W + 4}
            y={yScale(SIG_THRESHOLD)}
            dominantBaseline="middle"
            className="text-[8px] fill-zinc-400"
          >
            p_adj = 0.05
          </text>

          {/* Effect threshold lines with labels */}
          {effectThresholds.map((t) => (
            <g key={`et-${t.value}`}>
              <line
                x1={xScale(t.value)}
                x2={xScale(t.value)}
                y1={0}
                y2={INNER_H}
                stroke="#a1a1aa"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text
                x={xScale(t.value)}
                y={-4}
                textAnchor="middle"
                className="text-[7px] fill-zinc-400"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Reference line at x=0 */}
          <line
            x1={xScale(0)}
            x2={xScale(0)}
            y1={0}
            y2={INNER_H}
            stroke="#d4d4d8"
            strokeWidth={1}
          />

          {/* Points */}
          {points.map((p) => {
            const cx = xScale(p.x);
            const cy = yScale(p.y);
            const fill = !p.isSignificant
              ? '#d4d4d8'
              : p.direction === 'positive'
                ? '#ef4444'
                : '#3b82f6';
            return (
              <a
                key={p.feature}
                href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(p.feature)}/`}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={fill}
                  fillOpacity={p.isSignificant ? 0.85 : 0.4}
                  stroke={fill}
                  strokeWidth={p.isSignificant ? 1.5 : 0.5}
                  className="cursor-pointer"
                  onMouseMove={(e) => handleMouseMove(e, p)}
                  onMouseLeave={handleMouseLeave}
                />
              </a>
            );
          })}

          {/* Feature labels on top significant points (with displacement + leader lines) */}
          {labeledPoints.map(({ point: p, px, py, labelY }) => {
            const anchor = p.x > 0 ? 'start' : 'end';
            const dx = p.x > 0 ? 6 : -6;
            const labelX = px + dx;
            const displacement = Math.abs(labelY - (py - 2));
            return (
              <g key={`lbl-${p.feature}`}>
                {displacement > 3 && (
                  <line
                    x1={px}
                    y1={py}
                    x2={labelX}
                    y2={labelY}
                    stroke="#d4d4d8"
                    strokeWidth={0.5}
                  />
                )}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={anchor}
                  dominantBaseline="auto"
                  className="text-[8px] fill-zinc-700 pointer-events-none"
                >
                  {featureDisplayName(p.feature).slice(0, 20)}
                </text>
              </g>
            );
          })}

          {/* X axis */}
          <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="#d4d4d8" />
          {xTicks.map((t) => (
            <text
              key={`xt-${t}`}
              x={xScale(t)}
              y={INNER_H + 16}
              textAnchor="middle"
              className="text-[9px] fill-zinc-500"
            >
              {t}
            </text>
          ))}
          <text
            x={INNER_W / 2}
            y={INNER_H + 36}
            textAnchor="middle"
            className="text-[10px] fill-zinc-600"
          >
            {xLabel}
          </text>

          {/* N annotation (top-right corner) */}
          <text
            x={INNER_W}
            y={-6}
            textAnchor="end"
            className="text-[9px] fill-zinc-500 font-medium"
          >
            n = {points.length} features
          </text>

          {/* Y axis */}
          {yTicks.map((t) => (
            <text
              key={`yt-${t}`}
              x={-8}
              y={yScale(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[9px] fill-zinc-500"
            >
              {t.toFixed(1)}
            </text>
          ))}
          <text
            x={-MARGIN.left + 14}
            y={INNER_H / 2}
            textAnchor="middle"
            transform={`rotate(-90, ${-MARGIN.left + 14}, ${INNER_H / 2})`}
            className="text-[10px] fill-zinc-600"
          >
            -log₁₀(p_adj)
          </text>
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
          <div className="font-medium">{featureDisplayName(tooltip.point.feature)}</div>
          <div className="mt-0.5 font-mono">
            {tooltip.point.effectLabel}: {formatNum(tooltip.point.effectValue, 3)}
            {tooltip.point.ciLower != null && tooltip.point.ciUpper != null && (
              <span className="text-zinc-400"> [{formatNum(tooltip.point.ciLower)}, {formatNum(tooltip.point.ciUpper)}]</span>
            )}
          </div>
          <div className="font-mono">p<sub>adj</sub>: {formatP(tooltip.point.pAdj)}</div>
          <div className="text-zinc-400">n = {tooltip.point.n}</div>
          <div className="mt-0.5 text-zinc-400">{tooltip.point.badge.charAt(0).toUpperCase() + tooltip.point.badge.slice(1)}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-start gap-4 mt-2 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#ef4444" /></svg>
          {target === 'survival' ? 'Harmful (HR > 1)' : target === 'correlations' ? 'Positive correlation (\u03C1 > 0)' : 'Higher in group A (\u03B4 > 0)'}
        </span>
        <span className="flex items-center gap-1">
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#3b82f6" /></svg>
          {target === 'survival' ? 'Protective (HR < 1)' : target === 'correlations' ? 'Negative correlation (\u03C1 < 0)' : 'Lower in group A (\u03B4 < 0)'}
        </span>
        <span className="flex items-center gap-1">
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#d4d4d8" /></svg>
          Not significant (p<sub>adj</sub> {'\u2265'} 0.05)
        </span>
      </div>

      {/* Methodology footnote */}
      {target === 'survival' && (
        <p className="text-xs text-zinc-400 mt-2">
          Cox PH regression (two-sided Wald test) &middot; HR &gt; 1 = higher hazard for above-median (high) vs. below-median (low) group &middot;
          95% CI (Wald) &middot; p-values BH-adjusted within (cancer type, endpoint, model) &middot; &alpha; = 0.05
        </p>
      )}
      {target === 'correlations' && (
        <p className="text-xs text-zinc-400 mt-2">
          Spearman rank correlation (two-sided) &middot; 95% CI by bootstrap percentile (1,000 resamples) &middot;
          p-values BH-adjusted within (cancer type, molecular feature set) &middot; &alpha; = 0.05
        </p>
      )}
      {target === 'categorical' && (
        <p className="text-xs text-zinc-400 mt-2">
          Mann-Whitney U test (two-sided) &middot; effect size: Cliff&rsquo;s &delta; &middot; 95% CI by bootstrap percentile (1,000 resamples) &middot;
          p-values BH-adjusted within (cancer type, categorical variable) &middot; &alpha; = 0.05
        </p>
      )}
    </div>
  );
});
