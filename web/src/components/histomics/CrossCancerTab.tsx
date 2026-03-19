import { useState } from 'react';
import { useHistomicsCrossCancer } from '../../hooks/useHistomicsData';
import { SectionCard } from '../ui/SectionCard';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { Icon } from '../ui/Icon';
import { PillToggle } from '../ui/PillToggle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { InfoTooltip } from '../ui/InfoTooltip';
import { ExportActions } from '../ui/ExportActions';
import { SurvivalForestChart } from './SurvivalForestChart';
import { downloadCSV } from '../../lib/export';
import { formatHR, formatP, formatNum } from '../../lib/formatters';

const ENDPOINTS = [
  { id: 'os', label: 'Overall Survival' },
  { id: 'pfs', label: 'Progression-Free' },
  { id: 'dss', label: 'Disease-Specific' },
  { id: 'dfs', label: 'Disease-Free' },
] as const;

type EndpointId = (typeof ENDPOINTS)[number]['id'];

const MODELS = ['unadjusted', 'adjusted'] as const;
const MODEL_LABELS: Record<string, string> = {
  unadjusted: 'Unadjusted',
  adjusted: 'Adjusted',
};

interface CrossCancerTabProps {
  dataset?: string;
  feature: string;
}

function CrossCancerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-28 rounded-full bg-zinc-100 animate-pulse" />
          ))}
        </div>
        <div className="h-8 w-48 rounded-full bg-zinc-100 animate-pulse" />
      </div>
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-64 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CrossCancerTab({ dataset = 'tcga', feature }: CrossCancerTabProps) {
  const [endpoint, setEndpoint] = useState<EndpointId>('os');
  const [model, setModel] = useState<string>('unadjusted');

  const { data, isLoading, isError } = useHistomicsCrossCancer(dataset, feature, endpoint, model);

  function handleExport() {
    if (!data) return;
    const headers = [
      'cancer_type', 'hazard_ratio', 'hr_ci_lower', 'hr_ci_upper',
      'p_value_adj', 'n_samples', 'n_events', 'concordance', 'ph_flag',
      'evidence_strength',
    ];
    const allRows = [...data.results, ...(data.pancan ? [data.pancan] : [])];
    const csvRows = allRows.map((r) => [
      r.cancerType,
      String(r.hazardRatio ?? ''),
      String(r.hrCiLower ?? ''),
      String(r.hrCiUpper ?? ''),
      String(r.pValueAdj ?? ''),
      String(r.nSamples),
      String(r.nEvents),
      String(r.concordance ?? ''),
      r.phFlag,
      r.evidenceStrengthBadge,
    ]);
    downloadCSV(`${feature}_${endpoint}_${model}_cross_cancer.csv`, headers, csvRows);
  }

  if (isLoading) {
    return <CrossCancerSkeleton />;
  }

  if (isError) {
    return (
      <SectionCard title="Cross-Cancer Survival" icon={<Icon name="globe" size={18} className="text-zinc-400" />}>
        <EmptyState
          title="Failed to load data"
          description="Could not fetch cross-cancer survival results. Please try again later."
        />
      </SectionCard>
    );
  }

  if (!data || data.results.length === 0) {
    return (
      <SectionCard title="Cross-Cancer Survival" icon={<Icon name="globe" size={18} className="text-zinc-400" />}>
        <EmptyState
          title="No cross-cancer data"
          description={model === 'adjusted'
            ? 'The adjusted model requires age, sex, and pathological stage as covariates, which are unavailable or too sparse for this cohort. Try the unadjusted model instead.'
            : 'Cross-cancer survival analysis is not available for this feature.'}
        />
      </SectionCard>
    );
  }

  const nSig = data.results.filter((r) => r.pValueAdj != null && r.pValueAdj < 0.05).length;

  return (
    <div className="space-y-6">
      {/* Row 1: Endpoint pills (left) + Model toggle (right) */}
      <div className="flex items-center justify-between">
        <PillToggle
          options={ENDPOINTS.map((ep) => ({ id: ep.id, label: ep.label }))}
          value={endpoint}
          onChange={(id) => setEndpoint(id as EndpointId)}
        />

        <div className="flex items-center gap-1.5">
          <SegmentedControl
            options={MODELS.map((m) => ({ id: m, label: MODEL_LABELS[m] }))}
            value={model}
            onChange={setModel}
          />
          <InfoTooltip text="Unadjusted: Cox PH with the histomic feature only. Adjusted: Cox PH with the histomic feature plus age at diagnosis (z-scored) and sex (indicator-coded) as covariates. If age/sex are unavailable for a cancer type, the model runs without that covariate." />
        </div>
      </div>

      {/* Row 2: Forest plot card */}
      <SectionCard
        title="Hazard Ratio Across Cancer Types"
        subtitle={<>{data.results.length} cancer types &middot; {nSig} significant (p<sub>adj</sub> &lt; 0.05)</>}
        icon={<Icon name="globe" size={18} className="text-zinc-400" />}
        actions={<ExportActions onExportCSV={handleExport} />}
      >
        <p className="text-xs text-zinc-500 -mt-2 mb-4">
          {model === 'adjusted'
            ? 'Cox PH adjusted for age at diagnosis (z-scored) and sex (indicator-coded). If age/sex are unavailable for a cancer type, the model runs without that covariate.'
            : 'Cox PH with the histomic feature as the sole predictor (no covariates). Feature dichotomized at the median.'}
        </p>

        <div className="mb-6 max-w-[66%]">
          <SurvivalForestChart results={data.results} pancan={data.pancan} />
        </div>

        <p className="text-xs text-zinc-400 mt-3">
          Cox PH regression (two-sided Wald test) &middot; Feature dichotomized at median &middot;
          HR &gt; 1 = higher hazard for above-median group &middot;
          p-values BH-adjusted within (cancer, endpoint, model) &middot; &alpha; = 0.05 &middot; analyses restricted to groups with &ge; 10 events
        </p>
      </SectionCard>
    </div>
  );
}
