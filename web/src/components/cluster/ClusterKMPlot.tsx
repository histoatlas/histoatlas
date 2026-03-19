import { useMemo, useState, useRef, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';
import { line, area, curveStepAfter } from 'd3-shape';
import { bisectRight } from 'd3-array';
import { CLUSTER_COLORS } from '../../lib/colors';
import { useClusterSurvival } from '../../hooks/useClusterData';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { SectionCard } from '../ui/SectionCard';
import { Icon } from '../ui/Icon';
import { PillToggle } from '../ui/PillToggle';
import { InfoTooltip } from '../ui/InfoTooltip';
import { ExportActions } from '../ui/ExportActions';
import { downloadCSV } from '../../lib/export';
import { HrBadge, PValueBadge, PhBadge } from '../ui/SurvivalBadges';
import { formatP, formatNum, formatHR } from '../../lib/formatters';
import type { SurvivalEndpointSummary, ClusterSurvivalResponse, ClusterSurvivalStats } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  { id: 'os', label: 'Overall Survival' },
  { id: 'pfs', label: 'Progression-Free' },
  { id: 'dfs', label: 'Disease-Free' },
  { id: 'dss', label: 'Disease-Specific' },
] as const;

type EndpointId = (typeof ENDPOINTS)[number]['id'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClusterKMPlotProps {
  dataset?: string;
  clusterId?: string;
  cohort?: string;
  survivalSummary?: Record<string, SurvivalEndpointSummary>;
  isLoading: boolean;
}

function buildSubtitle(summary: SurvivalEndpointSummary): string {
  const hr = formatHR(summary.hazardRatio);
  const ci = `${formatHR(summary.hrCiLower)}, ${formatHR(summary.hrCiUpper)}`;
  const logP = formatP(summary.logRankPAdj);
  const coxP = formatP(summary.coxPAdj);
  return `HR ${hr} (95% CI [${ci}]) · Log-rank p_adj = ${logP} · Cox p_adj = ${coxP}`;
}


// ---------------------------------------------------------------------------
// Stats Table
// ---------------------------------------------------------------------------

function SurvivalStatsTable({
  summary,
  stats,
  nRest,
}: {
  summary: SurvivalEndpointSummary;
  stats?: ClusterSurvivalStats;
  nRest: number | null;
}) {
  // Prefer fetched stats, fall back to summary
  const hr = stats?.hazardRatio ?? summary.hazardRatio;
  const hrLo = stats?.hrCiLower ?? summary.hrCiLower;
  const hrHi = stats?.hrCiUpper ?? summary.hrCiUpper;
  const logRankPAdj = stats?.logRankPAdj ?? summary.logRankPAdj;
  const coxPAdj = stats?.coxPAdj ?? summary.coxPAdj;
  const nCluster = stats?.nCluster ?? summary.nCluster;
  const nEvents = stats?.nEventsCluster ?? summary.nEventsCluster;
  const medianCluster = stats?.medianSurvivalCluster ?? summary.medianSurvivalCluster;
  const medianRest = stats?.medianSurvivalRest ?? summary.medianSurvivalRest;
  const phFlag = stats?.coxPhFlag ?? summary.coxPhFlag;
  const phTestP = stats?.coxPhTestP ?? null;
  const logRankSig = logRankPAdj != null && logRankPAdj < 0.05;
  const coxSig = coxPAdj != null && coxPAdj < 0.05;

  const rows: { metric: string; value: React.ReactNode; tooltip?: string }[] = [
    {
      metric: 'Samples (cluster / rest)',
      value: `${nCluster.toLocaleString()}${nRest != null ? ` / ${nRest.toLocaleString()}` : ''}`,
      tooltip: 'Number of samples in the cluster vs. all other samples',
    },
    {
      metric: 'Events (cluster)',
      value: nEvents.toLocaleString(),
      tooltip: 'Number of events (deaths/progressions) observed in the cluster',
    },
    {
      metric: 'Median survival (cluster)',
      value: medianCluster != null ? `${formatNum(medianCluster, 1)} mo` : 'Not reached',
      tooltip: 'Time at which 50% of cluster samples have experienced the event',
    },
    {
      metric: 'Median survival (rest)',
      value: medianRest != null ? `${formatNum(medianRest, 1)} mo` : 'Not reached',
      tooltip: 'Time at which 50% of non-cluster samples have experienced the event',
    },
    {
      metric: 'Hazard ratio (95% CI)',
      value: <HrBadge hr={hr} lo={hrLo} hi={hrHi} />,
      tooltip: 'Cox regression hazard ratio; >1 = higher hazard for cluster vs. rest',
    },
    {
      metric: 'Log-rank p_adj',
      value: <PValueBadge p={logRankPAdj} label="p_adj" />,
      tooltip: 'Log-rank test p-value, BH-adjusted within (cancer, endpoint)',
    },
    {
      metric: 'Cox p_adj',
      value: <PValueBadge p={coxPAdj} label="p_adj" />,
      tooltip: 'Cox PH regression p-value, BH-adjusted within (cancer, endpoint)',
    },
    {
      metric: 'PH assumption',
      value: <PhBadge flag={phFlag} phTestP={phTestP} />,
      tooltip: 'Schoenfeld residuals test for proportional hazards; pass = PH holds (p ≥ 0.05)',
    },
  ];

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-zinc-50 border-b border-zinc-200">
          <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Metric
          </th>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Value
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {rows.map((row) => (
          <tr key={row.metric} className="hover:bg-zinc-50 transition-colors">
            <td className="px-4 py-2.5 text-zinc-700">
              <span className="inline-flex items-center gap-1">
                {row.metric}
                {row.tooltip && <InfoTooltip text={row.tooltip} />}
              </span>
            </td>
            <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function SurvivalSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-full bg-zinc-100 animate-pulse" />
        ))}
      </div>
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-48 mb-1" />
        <Skeleton className="h-4 w-80 mb-4" />
        <Skeleton className="w-[50%] h-56 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ClusterKMPlot({
  dataset = 'tcga',
  clusterId,
  cohort = 'PANCAN',
  survivalSummary,
  isLoading,
}: ClusterKMPlotProps) {
  const clusterIndex = clusterId ? Number(clusterId) : NaN;
  const clusterColor = !isNaN(clusterIndex)
    ? CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length]
    : '#3b82f6';

  // Filter to available endpoints
  const availableEndpoints = useMemo(
    () => ENDPOINTS.filter((ep) => survivalSummary && ep.id in survivalSummary),
    [survivalSummary],
  );

  const [activeEndpoint, setActiveEndpoint] = useState<EndpointId>('os');

  // Ensure active endpoint is valid
  const effectiveEndpoint = availableEndpoints.some((ep) => ep.id === activeEndpoint)
    ? activeEndpoint
    : (availableEndpoints[0]?.id ?? 'os');

  // Fetch detailed data for the active endpoint only
  const { data: survivalData, isLoading: detailLoading } = useClusterSurvival(
    dataset,
    clusterId,
    effectiveEndpoint,
    cohort,
  );

  if (isLoading) {
    return <SurvivalSkeleton />;
  }

  if (!survivalSummary || Object.keys(survivalSummary).length === 0) {
    return (
      <SectionCard title="Survival Analysis" icon={<Icon name="heart-pulse" size={18} className="text-zinc-400" />}>
        <EmptyState
          title="No survival data"
          description="Survival analysis is not available for this cluster."
        />
      </SectionCard>
    );
  }

  const summary = survivalSummary[effectiveEndpoint];
  const endpointLabel = ENDPOINTS.find((ep) => ep.id === effectiveEndpoint)?.label ?? effectiveEndpoint;
  const stats = survivalData?.stats;

  // Compute nRest from curves
  const nRest = survivalData
    ? survivalData.curves.find((c) => !c.group.startsWith('Cluster'))?.nSamples ?? null
    : null;

  function handleExport() {
    if (!summary) return;
    const s = stats ?? null;
    const headers = [
      'endpoint', 'n_cluster', 'n_events_cluster', 'median_cluster', 'median_rest',
      'hazard_ratio', 'hr_ci_lower', 'hr_ci_upper', 'log_rank_p_adj', 'cox_p_adj',
      'cox_ph_flag', 'cox_ph_test_p', 'cox_significant',
    ];
    const row = [
      effectiveEndpoint,
      String(s?.nCluster ?? summary.nCluster),
      String(s?.nEventsCluster ?? summary.nEventsCluster),
      String(s?.medianSurvivalCluster ?? summary.medianSurvivalCluster ?? ''),
      String(s?.medianSurvivalRest ?? summary.medianSurvivalRest ?? ''),
      String(s?.hazardRatio ?? summary.hazardRatio ?? ''),
      String(s?.hrCiLower ?? summary.hrCiLower ?? ''),
      String(s?.hrCiUpper ?? summary.hrCiUpper ?? ''),
      String(s?.logRankPAdj ?? summary.logRankPAdj ?? ''),
      String(s?.coxPAdj ?? summary.coxPAdj ?? ''),
      String(s?.coxPhFlag ?? summary.coxPhFlag),
      String(s?.coxPhTestP ?? ''),
      String(summary.coxSignificantAdj),
    ];
    downloadCSV(`${clusterId}_${effectiveEndpoint}_survival.csv`, headers, [row]);
  }

  return (
    <div className="space-y-6">
      {/* Pill toggle buttons */}
      <PillToggle
        options={availableEndpoints.map((ep) => ({ id: ep.id, label: ep.label }))}
        value={effectiveEndpoint}
        onChange={(id) => setActiveEndpoint(id as EndpointId)}
      />

      {/* Active endpoint content */}
      {summary && (
        <SectionCard
          title={endpointLabel}
          subtitle={buildSubtitle(summary)}
          icon={<Icon name="heart-pulse" size={18} className="text-zinc-400" />}
          badge={
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              n={summary.nCluster.toLocaleString()}
            </span>
          }
          actions={<ExportActions onExportCSV={handleExport} />}
        >
          {/* KM Chart */}
          <div className="mb-6 max-w-[60%]">
            {detailLoading ? (
              <Skeleton className="w-full h-56" />
            ) : survivalData && survivalData.curves.length > 0 ? (
              <KMCurve survivalData={survivalData} clusterColor={clusterColor} clusterId={clusterId} endpointLabel={endpointLabel} />
            ) : (
              <div className="text-sm text-zinc-500 py-12 text-center">
                No curve data available for this endpoint.
              </div>
            )}
          </div>

          {/* Stats Table */}
          {detailLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))}
            </div>
          ) : (
            <SurvivalStatsTable summary={summary} stats={stats} nRest={nRest} />
          )}

          {/* Footnote */}
          <p className="text-xs text-zinc-400 mt-3">
            Kaplan-Meier estimator &middot; 95% CI (Greenwood) &middot; Log-rank (two-sided) + Cox PH regression (two-sided Wald test) &middot;
            p-values BH-adjusted within (cancer, endpoint) &middot; &alpha; = 0.05 &middot;
            HR &gt; 1 = higher hazard for cluster vs. rest
          </p>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KM Curve (SVG) — internals unchanged from rigor pass
// ---------------------------------------------------------------------------

interface KMCurveProps {
  survivalData: ClusterSurvivalResponse;
  clusterColor: string;
  clusterId?: string;
  endpointLabel?: string;
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

/** Standard time points for the number-at-risk table (months). */
const N_AT_RISK_TIMES = [0, 12, 24, 36, 48, 60];

function getAtRiskCount(
  timePoints: number[],
  survivalProbs: number[],
  nSamples: number,
  t: number,
  maxTime: number,
): number | null {
  if (t > maxTime * 1.05) return null;
  const prob = survivalAtTime(timePoints, survivalProbs, t);
  if (prob == null) return nSamples;
  return Math.ceil(prob * nSamples);
}

function KMCurve({ survivalData, clusterColor, clusterId, endpointLabel }: KMCurveProps) {
  const width = 380;
  const height = 240;
  const margin = { top: 28, right: 12, bottom: 38, left: 42 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const { xScale, yScale, paths, ciBands, censoringMarks } = useMemo(() => {
    const allTimes = survivalData.curves.flatMap((c) => c.timePoints);
    const maxTime = Math.max(...allTimes, 1);

    const xScale = scaleLinear().domain([0, maxTime]).range([0, innerWidth]);
    const yScale = scaleLinear().domain([0, 1]).range([innerHeight, 0]);

    const lineGen = line<[number, number]>()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]))
      .curve(curveStepAfter);

    const areaGen = area<[number, number, number]>()
      .x((d) => xScale(d[0]))
      .y0((d) => yScale(d[1]))
      .y1((d) => yScale(d[2]))
      .curve(curveStepAfter);

    const paths = survivalData.curves.map((curve) => {
      const points: [number, number][] = curve.timePoints.map((t, i) => [
        t,
        curve.survivalProbs[i],
      ]);
      return {
        group: curve.group,
        d: lineGen(points) || '',
      };
    });

    const ciBands = survivalData.curves.map((curve) => {
      const ciPoints: [number, number, number][] = curve.timePoints.map((t, i) => [
        t,
        curve.ciLower[i],
        curve.ciUpper[i],
      ]);
      return {
        group: curve.group,
        d: areaGen(ciPoints) || '',
      };
    });

    const censoringMarks = survivalData.curves.map((curve) => ({
      group: curve.group,
      marks: curve.censoringTimes.map((t, i) => ({
        x: xScale(t),
        y: yScale(curve.censoringProbs[i]),
      })),
    }));

    return { xScale, yScale, paths, ciBands, censoringMarks };
  }, [survivalData, innerWidth, innerHeight]);

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

  const getColor = (group: string) =>
    group.startsWith('Cluster') ? clusterColor : '#a1a1aa';

  const { medianSurvivalCluster, medianSurvivalRest } = survivalData.stats;
  const medianY = yScale(0.5);

  const crosshairData = useMemo(() => {
    if (hoverTime == null) return null;
    return survivalData.curves.map((curve) => {
      const prob = survivalAtTime(curve.timePoints, curve.survivalProbs, hoverTime);
      const ciLo = ciAtTime(curve.timePoints, curve.ciLower, hoverTime);
      const ciHi = ciAtTime(curve.timePoints, curve.ciUpper, hoverTime);
      return { group: curve.group, prob, ciLo, ciHi };
    });
  }, [hoverTime, survivalData.curves]);

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
        aria-label={`Kaplan-Meier survival curve for cancer morphology cluster ${clusterId ?? '?'}, ${endpointLabel ?? 'survival'}: ${survivalData.stats.hazardRatio != null ? `hazard ratio ${formatHR(survivalData.stats.hazardRatio)} (95% CI ${formatHR(survivalData.stats.hrCiLower)}–${formatHR(survivalData.stats.hrCiUpper)}), p = ${formatP(survivalData.stats.coxPAdj)}` : ''}, ${survivalData.curves.reduce((s, c) => s + c.nSamples, 0)} samples`}
      >
        {/* Chart title */}
        <text x={margin.left} y={14} className="text-[11px] fill-zinc-700 font-semibold">
          Kaplan-Meier — Log-rank + Cox PH (two-sided)
        </text>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Y gridlines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick) => (
            <g key={tick}>
              <line
                x1={0} x2={innerWidth}
                y1={yScale(tick)} y2={yScale(tick)}
                stroke="#e4e4e7" strokeWidth={1}
              />
              <text
                x={-4} y={yScale(tick)}
                textAnchor="end" dominantBaseline="middle"
                className="text-[9px] fill-zinc-400"
              >
                {tick.toFixed(2)}
              </text>
            </g>
          ))}

          {/* X ticks */}
          {xScale.ticks(5).map((tick) => (
            <g key={tick}>
              <line
                x1={xScale(tick)} x2={xScale(tick)}
                y1={innerHeight} y2={innerHeight + 4}
                stroke="#a1a1aa" strokeWidth={1}
              />
              <text
                x={xScale(tick)} y={innerHeight + 14}
                textAnchor="middle"
                className="text-[9px] fill-zinc-400"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text
            x={innerWidth / 2} y={innerHeight + 30}
            textAnchor="middle"
            className="text-[10px] fill-zinc-500"
          >
            Time (months)
          </text>
          <text
            x={-innerHeight / 2} y={-32}
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
          {(medianSurvivalCluster != null || medianSurvivalRest != null) && (
            <g>
              <line
                x1={0} x2={innerWidth}
                y1={medianY} y2={medianY}
                stroke="#a1a1aa" strokeWidth={0.75}
                strokeDasharray="4 3" opacity={0.6}
              />
              {medianSurvivalCluster != null && (
                <line
                  x1={xScale(medianSurvivalCluster)} x2={xScale(medianSurvivalCluster)}
                  y1={medianY} y2={innerHeight}
                  stroke={clusterColor} strokeWidth={1}
                  strokeDasharray="3 2" opacity={0.7}
                />
              )}
              {medianSurvivalRest != null && (
                <line
                  x1={xScale(medianSurvivalRest)} x2={xScale(medianSurvivalRest)}
                  y1={medianY} y2={innerHeight}
                  stroke="#a1a1aa" strokeWidth={1}
                  strokeDasharray="3 2" opacity={0.7}
                />
              )}
              {medianSurvivalCluster != null && (
                <text
                  x={xScale(medianSurvivalCluster)} y={innerHeight + 24}
                  textAnchor="middle"
                  className="text-[8px] font-medium"
                  fill={clusterColor}
                >
                  {medianSurvivalCluster.toFixed(0)}
                </text>
              )}
              {medianSurvivalRest != null && (
                <text
                  x={xScale(medianSurvivalRest)} y={innerHeight + 24}
                  textAnchor="middle"
                  className="text-[8px] font-medium fill-zinc-400"
                >
                  {medianSurvivalRest.toFixed(0)}
                </text>
              )}
            </g>
          )}

          {/* Curves */}
          {paths.map((path) => (
            <path
              key={path.group}
              d={path.d}
              fill="none"
              stroke={getColor(path.group)}
              strokeWidth={path.group.startsWith('Cluster') ? 2 : 1.5}
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
              <line
                x1={xScale(hoverTime)} x2={xScale(hoverTime)}
                y1={0} y2={innerHeight}
                stroke="#71717a" strokeWidth={0.75}
                strokeDasharray="3 2"
              />
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

          {/* Stats annotation */}
          {survivalData.stats.hazardRatio != null && (
            <g>
              <text
                x={innerWidth - 4} y={12}
                textAnchor="end"
                className="text-[9px] fill-zinc-600 font-medium"
              >
                HR {formatHR(survivalData.stats.hazardRatio)} (95% CI: {formatHR(survivalData.stats.hrCiLower)}, {formatHR(survivalData.stats.hrCiUpper)})
              </text>
              <text
                x={innerWidth - 4} y={24}
                textAnchor="end"
                className="text-[9px] fill-zinc-400"
              >
                Log-rank p_adj = {formatP(survivalData.stats.logRankPAdj)} · Cox p_adj = {formatP(survivalData.stats.coxPAdj)}
              </text>
            </g>
          )}

          {/* Invisible hit area */}
          <rect
            x={0} y={0}
            width={innerWidth} height={innerHeight}
            fill="transparent"
            className="cursor-crosshair"
          />
        </g>
      </svg>

      {/* Hover tooltip */}
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
            t = {hoverTime.toFixed(1)} mo
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
                        (95% CI: {cd.ciLo.toFixed(3)}–{cd.ciHi.toFixed(3)})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap mt-1.5 text-xs text-zinc-500">
        {survivalData.curves.map((curve) => (
          <div key={curve.group} className="flex items-center gap-1.5">
            <div
              className="w-4 h-[2px]"
              style={{ backgroundColor: getColor(curve.group) }}
            />
            <span>{curve.group} (n={curve.nSamples})</span>
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
            {survivalData.curves.map((curve) => {
              const maxTime = curve.timePoints.length > 0 ? curve.timePoints[curve.timePoints.length - 1] : 0;
              return (
                <tr key={curve.group}>
                  <td className="text-left pr-2 py-0.5" style={{ color: getColor(curve.group) }}>
                    {curve.group}
                  </td>
                  {N_AT_RISK_TIMES.filter((t) => t <= (xScale.domain()[1] ?? 60)).map((t) => {
                    const count = getAtRiskCount(curve.timePoints, curve.survivalProbs, curve.nSamples, t, maxTime);
                    return (
                      <td key={t} className="text-center font-mono px-1.5 py-0.5">
                        {count != null ? count : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
