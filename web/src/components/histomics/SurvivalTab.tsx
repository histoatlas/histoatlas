import { useState, useMemo } from 'react';
import { useHistomicsSurvival, useHistomicsKm } from '../../hooks/useHistomicsData';
import { SectionCard } from '../ui/SectionCard';
import { EvidenceBadge } from '../ui/EvidenceBadge';
import { HrBadge, PValueBadge, PhBadge } from '../ui/SurvivalBadges';
import { InfoTooltip } from '../ui/InfoTooltip';
import { ExportActions } from '../ui/ExportActions';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { Icon } from '../ui/Icon';
import { PillToggle } from '../ui/PillToggle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { KMCurveChart } from './KMCurveChart';
import { formatP, formatNum, formatCI, formatHR } from '../../lib/formatters';
import { downloadCSV } from '../../lib/export';
import type { EvidenceStrengthBadge, HistomicsSurvivalResult } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  { id: 'os', label: 'Overall Survival' },
  { id: 'pfs', label: 'Progression-Free' },
  { id: 'dss', label: 'Disease-Specific' },
  { id: 'dfs', label: 'Disease-Free' },
] as const;

type EndpointId = (typeof ENDPOINTS)[number]['id'];

const ENDPOINT_FULL_LABELS: Record<string, string> = {
  os: 'Overall Survival',
  pfs: 'Progression-Free Survival',
  dss: 'Disease-Specific Survival',
  dfs: 'Disease-Free Survival',
};

const MODELS = ['unadjusted', 'adjusted'] as const;
const MODEL_LABELS: Record<string, string> = {
  unadjusted: 'Unadjusted',
  adjusted: 'Adjusted',
};

const STRATIFICATIONS = [
  { id: 'median', label: 'Median' },
  { id: 'quartile', label: 'Q1 vs Q4' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSubtitle(result: HistomicsSurvivalResult): string {
  const phFailed = result.phFlag !== 'pass';
  if (phFailed && result.rmstDifference != null) {
    const diff = formatNum(result.rmstDifference);
    const ci = formatCI(result.rmstCiLower, result.rmstCiUpper);
    return `PH violated · RMST diff = ${diff} days ${ci}`;
  }
  const hr = formatHR(result.hazardRatio);
  const ci =
    result.hrCiLower != null && result.hrCiUpper != null
      ? `${formatHR(result.hrCiLower)}, ${formatHR(result.hrCiUpper)}`
      : 'N/A';
  const p = formatP(result.pValueAdj);
  return `HR ${hr} (95% CI [${ci}]) · Cox p_adj = ${p}`;
}

// ---------------------------------------------------------------------------
// Stats Table
// ---------------------------------------------------------------------------

function SurvivalStatsTable({ result }: { result: HistomicsSurvivalResult }) {
  const rows: { metric: string; value: React.ReactNode; tooltip: string }[] = [
    {
      metric: 'Evidence',
      value: <EvidenceBadge badge={result.evidenceStrengthBadge as EvidenceStrengthBadge} />,
      tooltip: 'Composite evidence strength based on effect size, significance, and sample size',
    },
    {
      metric: 'Hazard ratio (95% CI)',
      value: <HrBadge hr={result.hazardRatio} lo={result.hrCiLower} hi={result.hrCiUpper} />,
      tooltip: 'Cox regression hazard ratio; >1 = higher hazard for the above-median (high) vs. below-median (low) group',
    },
    {
      metric: 'p-value (raw)',
      value: <PValueBadge p={result.pValue} />,
      tooltip: 'Unadjusted Cox regression p-value',
    },
    {
      metric: 'p-value (adj)',
      value: <PValueBadge p={result.pValueAdj} label="p_adj" />,
      tooltip: 'BH-adjusted p-value within (cancer, endpoint, model)',
    },
    {
      metric: 'N samples',
      value: <span className="font-mono text-xs text-zinc-700">{result.nSamples.toLocaleString()}</span>,
      tooltip: 'Total number of samples in the analysis',
    },
    {
      metric: 'N events',
      value: <span className="font-mono text-xs text-zinc-700">{result.nEvents.toLocaleString()}</span>,
      tooltip: 'Number of events (deaths/progressions) observed',
    },
    {
      metric: 'Concordance (C)',
      value: (
        <span className="font-mono text-xs text-zinc-700">
          {result.concordance != null ? formatNum(result.concordance) : 'N/A'}
        </span>
      ),
      tooltip: "Harrell's C-statistic; 0.5 = random, 1.0 = perfect discrimination",
    },
    {
      metric: 'PH assumption',
      value: <PhBadge flag={result.phFlag} />,
      tooltip: 'Schoenfeld residuals test; pass = PH holds (p ≥ 0.05)',
    },
    {
      metric: 'MDES (80% power)',
      value: (() => {
        const hr = result.hazardRatio;
        const harmful = result.mdesHrHarmful;
        const protective = result.mdesHrProtective;
        if (hr != null) {
          const mdes = hr >= 1 ? harmful : protective;
          const prefix = hr >= 1 ? '\u2265' : '\u2264';
          return mdes != null
            ? <span className="font-mono text-xs text-zinc-700">HR {prefix} {formatHR(mdes)}</span>
            : <span className="text-xs text-zinc-400">N/A</span>;
        }
        if (harmful != null || protective != null) {
          return (
            <span className="font-mono text-xs text-zinc-700">
              {harmful != null ? `HR \u2265 ${formatHR(harmful)}` : '-'} / {protective != null ? `HR \u2264 ${formatHR(protective)}` : '-'}
            </span>
          );
        }
        return <span className="text-xs text-zinc-400">N/A</span>;
      })(),
      tooltip: 'Minimum detectable effect size at 80% power (\u03B1 = 0.05). The smallest hazard ratio this analysis could reliably detect, given its sample size and number of events.',
    },
  ];

  // Conditionally add RMST: insert after PH row when PH fails (prominent), otherwise append at end
  if (result.rmstDifference != null) {
    const rmstRow = {
      metric: 'RMST difference',
      value: (
        <span className="font-mono text-xs text-zinc-700">
          {formatNum(result.rmstDifference)} {formatCI(result.rmstCiLower, result.rmstCiUpper)}
        </span>
      ),
      tooltip: 'Restricted mean survival time difference (high − low); p-value by permutation test (5,000 permutations); 95% CI by bootstrap percentile method (1,000 resamples)',
    };
    const phFailed = result.phFlag !== 'pass';
    if (phFailed) {
      // Insert right after the PH assumption row
      const phRowIndex = rows.findIndex((r) => r.metric === 'PH assumption');
      rows.splice(phRowIndex + 1, 0, rmstRow);
    } else {
      rows.push(rmstRow);
    }
  }

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
            <td className="px-4 py-2.5 text-zinc-600">
              <span className="inline-flex items-center gap-1">
                {row.metric}
                <InfoTooltip text={row.tooltip} />
              </span>
            </td>
            <td className="px-4 py-2.5">{row.value}</td>
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
      {/* Pill placeholders */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-28 rounded-full bg-zinc-100 animate-pulse" />
          ))}
        </div>
        <div className="h-8 w-48 rounded-full bg-zinc-100 animate-pulse" />
      </div>
      {/* Card skeleton */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-48 mb-1" />
        <Skeleton className="h-4 w-80 mb-4" />
        <Skeleton className="w-[50%] h-56 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
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

interface SurvivalTabProps {
  dataset?: string;
  feature: string;
  cancerType: string;
}

export function SurvivalTab({ dataset = 'tcga', feature, cancerType }: SurvivalTabProps) {
  const [endpoint, setEndpoint] = useState<EndpointId>('os');
  const [model, setModel] = useState<string>('unadjusted');
  const [stratification, setStratification] = useState<string>('median');

  const { data: survivalData, isLoading: survivalLoading } = useHistomicsSurvival(dataset, feature, cancerType);

  // Filter to available endpoints
  const availableEndpoints = useMemo(() => {
    if (!survivalData) return [];
    const present = new Set(survivalData.results.map((r) => r.endpoint));
    return ENDPOINTS.filter((ep) => present.has(ep.id));
  }, [survivalData]);

  // Ensure active endpoint is valid
  const effectiveEndpoint = availableEndpoints.some((ep) => ep.id === endpoint)
    ? endpoint
    : (availableEndpoints[0]?.id ?? 'os');

  const { data: kmData, isLoading: kmLoading, isError: kmError } = useHistomicsKm(dataset, feature, cancerType, effectiveEndpoint, stratification);

  // Find the matching result for current endpoint + model
  const result = survivalData?.results.find(
    (r) => r.endpoint === effectiveEndpoint && r.model === model,
  );

  if (survivalLoading) {
    return <SurvivalSkeleton />;
  }

  if (!survivalData || survivalData.results.length === 0) {
    return (
      <SectionCard title="Survival Analysis" icon={<Icon name="heart-pulse" size={18} className="text-zinc-400" />}>
        <EmptyState
          title="No survival data"
          description="Survival analysis is not available for this feature and cancer type."
        />
      </SectionCard>
    );
  }

  const endpointLabel = ENDPOINT_FULL_LABELS[effectiveEndpoint] ?? effectiveEndpoint;

  function handleExport() {
    if (!result) return;
    const headers = [
      'endpoint', 'model', 'n_samples', 'n_events', 'hazard_ratio', 'hr_ci_lower', 'hr_ci_upper',
      'p_value', 'p_value_adj', 'concordance', 'ph_flag', 'evidence_strength',
      'mdes_hr_harmful', 'mdes_hr_protective',
      'rmst_difference', 'rmst_ci_lower', 'rmst_ci_upper',
    ];
    const row = [
      effectiveEndpoint,
      model,
      String(result.nSamples),
      String(result.nEvents),
      String(result.hazardRatio ?? ''),
      String(result.hrCiLower ?? ''),
      String(result.hrCiUpper ?? ''),
      String(result.pValue ?? ''),
      String(result.pValueAdj ?? ''),
      String(result.concordance ?? ''),
      result.phFlag,
      result.evidenceStrengthBadge,
      String(result.mdesHrHarmful ?? ''),
      String(result.mdesHrProtective ?? ''),
      String(result.rmstDifference ?? ''),
      String(result.rmstCiLower ?? ''),
      String(result.rmstCiUpper ?? ''),
    ];
    downloadCSV(`${feature}_${effectiveEndpoint}_${model}_survival.csv`, headers, [row]);
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Endpoint pills (left) + Model segmented control (right) */}
      <div className="flex items-center justify-between">
        <PillToggle
          options={availableEndpoints.map((ep) => ({ id: ep.id, label: ep.label }))}
          value={effectiveEndpoint}
          onChange={(id) => setEndpoint(id as EndpointId)}
        />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <SegmentedControl
              options={STRATIFICATIONS.map((s) => ({ id: s.id, label: s.label }))}
              value={stratification}
              onChange={setStratification}
            />
            <InfoTooltip text="Median: split at 50th percentile (equal groups). Q1 vs Q4: bottom 25% vs top 25% (middle 50% excluded). Cox regression statistics are from the continuous model and do not change with stratification." />
          </div>
          <div className="flex items-center gap-1.5">
            <SegmentedControl
              options={MODELS.map((m) => ({ id: m, label: MODEL_LABELS[m] }))}
              value={model}
              onChange={setModel}
            />
            <InfoTooltip text="Unadjusted: Cox PH with the histomic feature only. Adjusted: Cox PH with age, sex, stage as covariates, stratified by TSS. Complete-case analysis." />
          </div>
        </div>
      </div>

      {/* Row 2: Main content card */}
      {result ? (
        <SectionCard
          title={endpointLabel}
          subtitle={buildSubtitle(result)}
          icon={<Icon name="heart-pulse" size={18} className="text-zinc-400" />}
          badge={
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              n={result.nSamples.toLocaleString()}
            </span>
          }
          actions={<ExportActions onExportCSV={handleExport} />}
        >
          {/* Model description */}
          <p className="text-xs text-zinc-500 -mt-2 mb-4">
            {model === 'adjusted'
              ? 'Cox PH adjusted for age at diagnosis (z-scored), sex, and pathological stage (indicator-coded), stratified by tissue source site. Complete-case analysis.'
              : 'Cox PH with the histomic feature as the sole predictor (no covariates).'}
          </p>

          {/* KM Chart */}
          <div className="mb-6 max-w-[60%]">
            {kmLoading ? (
              <Skeleton className="w-full h-56" />
            ) : kmError && stratification !== 'median' ? (
              <div className="text-sm text-zinc-500 py-12 text-center">
                Q1 vs Q4 not available for this endpoint. Try the median stratification.
              </div>
            ) : kmData && kmData.curves.length > 0 ? (
              <KMCurveChart
                curves={kmData.curves}
                hazardRatio={result.hazardRatio}
                hrCiLower={result.hrCiLower}
                hrCiUpper={result.hrCiUpper}
                pValue={result.pValue}
                pValueAdj={result.pValueAdj}
                rmstDifference={result.rmstDifference}
                rmstCiLower={result.rmstCiLower}
                rmstCiUpper={result.rmstCiUpper}
              />
            ) : (
              <div className="text-sm text-zinc-500 py-12 text-center">
                No KM curve data available for this endpoint.
              </div>
            )}
          </div>

          {/* Stats Table */}
          <SurvivalStatsTable result={result} />

          {/* Methodology footnote */}
          <p className="text-xs text-zinc-400 mt-3">
            Kaplan-Meier estimator &middot; 95% CI (Greenwood) &middot; Cox PH regression (two-sided Wald test) &middot;
            p-values BH-adjusted within (cancer, endpoint, model) &middot; &alpha; = 0.05 &middot;
            HR &gt; 1 = higher hazard for high vs. low group &middot;
            {stratification === 'median'
              ? ' Groups split at median (50th percentile).'
              : ' Groups: Q4 (top 25%) vs Q1 (bottom 25%); middle 50% excluded.'}{' '}
            Concordance: Harrell&rsquo;s C-statistic &middot;
            RMST difference: truncation at &tau; = minimum of max follow-up across groups; permutation p-value (5,000 permutations), bootstrap percentile CI (1,000 resamples) &middot;
            Analyses restricted to groups with &ge; 10 events.
          </p>
        </SectionCard>
      ) : (
        <SectionCard title={endpointLabel} icon={<Icon name="heart-pulse" size={18} className="text-zinc-400" />}>
          <div className="text-sm text-zinc-500 py-8 text-center">
            {model === 'adjusted'
              ? 'The adjusted model requires age, sex, and pathological stage as covariates, which are unavailable or too sparse for this cohort. Try the unadjusted model.'
              : 'No data for this endpoint/model combination.'}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
