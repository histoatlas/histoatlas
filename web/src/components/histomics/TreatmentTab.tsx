import { useState, useMemo, useCallback } from 'react';
import { useHistomicsTreatment } from '../../hooks/useHistomicsData';
import { SectionCard } from '../ui/SectionCard';
import { Skeleton } from '../ui/Skeleton';
import { CliffsDeltaBadge, PValueBadge } from '../ui/SurvivalBadges';
import { InfoTooltip } from '../ui/InfoTooltip';
import { ExportActions } from '../ui/ExportActions';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { formatP, formatNum } from '../../lib/formatters';
import { downloadCSV } from '../../lib/export';
import type { TreatmentAssociation } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanize(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function TreatmentSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <Skeleton className="h-5 w-48 mb-1" />
      <Skeleton className="h-4 w-80 mb-4" />
      <Skeleton className="h-10 w-full mb-2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full mb-1" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Row (expandable)
// ---------------------------------------------------------------------------

function DetailRow({ row, colSpan }: { row: TreatmentAssociation; colSpan: number }) {
  const metrics: { label: string; value: React.ReactNode; tooltip: string }[] = [
    {
      label: "Cliff's δ (95% CI)",
      value: <CliffsDeltaBadge delta={row.cliffsDelta} ciLower={row.cliffsCiLower} ciUpper={row.cliffsCiUpper} />,
      tooltip: "Cliff's delta non-parametric effect size; >0 = higher feature values in treated group; 95% bootstrap percentile CI (1,000 resamples)",
    },
    {
      label: 'p-value (raw)',
      value: <PValueBadge p={row.pValue} />,
      tooltip: 'Unadjusted Mann-Whitney U p-value',
    },
    {
      label: 'p-value (adj)',
      value: <PValueBadge p={row.pValueAdj} label="p_adj" />,
      tooltip: 'BH-adjusted p-value within (cancer type, treatment variable)',
    },
    {
      label: 'N treated',
      value: <span className="font-mono text-xs text-zinc-700">{row.nTreated.toLocaleString()}</span>,
      tooltip: 'Number of treated patients with non-missing data',
    },
    {
      label: 'N untreated',
      value: <span className="font-mono text-xs text-zinc-700">{row.nUntreated.toLocaleString()}</span>,
      tooltip: 'Number of untreated patients with non-missing data',
    },
    {
      label: 'Median (treated)',
      value: <span className="font-mono text-xs text-zinc-700">{formatNum(row.medianTreated)}</span>,
      tooltip: 'Median feature value in treated group',
    },
    {
      label: 'Median (untreated)',
      value: <span className="font-mono text-xs text-zinc-700">{formatNum(row.medianUntreated)}</span>,
      tooltip: 'Median feature value in untreated group',
    },
    {
      label: 'Data completeness',
      value: (
        <span className="font-mono text-xs text-zinc-700">
          {row.dataCompleteness != null ? `${formatNum(row.dataCompleteness * 100, 0)}%` : 'N/A'}
        </span>
      ),
      tooltip: 'Proportion of cancer-type cohort with non-missing treatment annotation',
    },
  ];

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-3 bg-zinc-50">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs">
          {metrics.map((m) => (
            <div key={m.label}>
              <dt className="text-zinc-500 flex items-center gap-1 mb-0.5">
                {m.label}
                <InfoTooltip text={m.tooltip} />
              </dt>
              <dd className="text-zinc-900 font-medium">{m.value}</dd>
            </div>
          ))}
        </dl>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface TreatmentTabProps {
  dataset?: string;
  feature: string;
  cancerType: string;
}

export function TreatmentTab({ dataset = 'tcga', feature, cancerType }: TreatmentTabProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: treatData, isLoading } = useHistomicsTreatment(dataset, feature, cancerType);

  const sorted = useMemo(() => {
    if (!treatData?.associations) return [];
    return [...treatData.associations].sort(
      (a, b) => Math.abs(b.cliffsDelta ?? 0) - Math.abs(a.cliffsDelta ?? 0),
    );
  }, [treatData]);

  const totalN = useMemo(() => {
    if (!sorted.length) return 0;
    return Math.max(...sorted.map((a) => a.nTreated + a.nUntreated));
  }, [sorted]);

  const handleExport = useCallback(() => {
    if (!sorted.length) return;
    const headers = [
      'treatment', 'cliffs_delta', 'cliffs_delta_ci_lower', 'cliffs_delta_ci_upper',
      'p_value', 'p_value_adj', 'n_treated', 'n_untreated',
      'median_treated', 'median_untreated', 'data_completeness', 'is_significant',
    ];
    const rows = sorted.map((r) => [
      r.treatmentVar,
      String(r.cliffsDelta ?? ''),
      String(r.cliffsCiLower ?? ''),
      String(r.cliffsCiUpper ?? ''),
      String(r.pValue ?? ''),
      String(r.pValueAdj ?? ''),
      String(r.nTreated),
      String(r.nUntreated),
      String(r.medianTreated ?? ''),
      String(r.medianUntreated ?? ''),
      String(r.dataCompleteness ?? ''),
      String(r.isSignificant),
    ]);
    downloadCSV(`${feature}_${cancerType}_treatment_associations.csv`, headers, rows);
  }, [sorted, feature, cancerType]);

  if (isLoading) {
    return <TreatmentSkeleton />;
  }

  if (!treatData || sorted.length === 0) {
    return (
      <SectionCard title="Treatment Associations" icon={<Icon name="flask-conical" size={18} className="text-zinc-400" />}>
        <EmptyState
          title="No treatment data"
          description="Treatment associations are not available for this feature and cancer type."
        />
      </SectionCard>
    );
  }

  const COL_COUNT = 6;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Treatment Associations"
        subtitle="Mann-Whitney U test (two-sided) · Cliff's delta effect size"
        icon={<Icon name="flask-conical" size={18} className="text-zinc-400" />}
        badge={
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            n={totalN.toLocaleString()}
          </span>
        }
        actions={<ExportActions onExportCSV={handleExport} />}
      >
        {/* Exploratory caveat */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-4">
          Treatment associations are exploratory. Associations do not imply causation.
        </div>

        {/* Main table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1">
                    Treatment
                    <InfoTooltip text="Clinical treatment variable (binary: treated vs. untreated)" />
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1">
                    Cliff&apos;s &delta; (95% CI)
                    <InfoTooltip text="Cliff's delta non-parametric effect size; >0 = higher feature values in treated group; 95% bootstrap percentile CI (1,000 resamples)" />
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1">
                    p-value (adj)
                    <InfoTooltip text="BH-adjusted p-value within (cancer type, treatment variable)" />
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1">
                    N treated
                    <InfoTooltip text="Number of treated patients with non-missing data" />
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1">
                    N untreated
                    <InfoTooltip text="Number of untreated patients with non-missing data" />
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1">
                    Completeness
                    <InfoTooltip text="Proportion of patients with non-missing treatment annotation" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map((row) => {
                const isExpanded = expandedRow === row.treatmentVar;
                return (
                  <TableRow
                    key={row.treatmentVar}
                    row={row}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedRow(isExpanded ? null : row.treatmentVar)}
                    colSpan={COL_COUNT}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Methodology footnote */}
        <p className="text-xs text-zinc-400 mt-3">
          Mann-Whitney U test (two-sided) &middot; Cliff&apos;s delta with 95% bootstrap
          percentile CI (1,000 resamples) &middot; p-values BH-adjusted within
          (cancer type, treatment variable) &middot; &alpha; = 0.05 &middot; &delta; &gt; 0 = higher
          feature values in treated group &middot; Complete-case analysis
          (listwise deletion of missing values)
        </p>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Row
// ---------------------------------------------------------------------------

function TableRow({
  row,
  isExpanded,
  onToggle,
  colSpan,
}: {
  row: TreatmentAssociation;
  isExpanded: boolean;
  onToggle: () => void;
  colSpan: number;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition-colors ${
          isExpanded ? 'bg-blue-50' : 'hover:bg-zinc-50'
        }`}
      >
        <td className="px-4 py-2.5 text-zinc-900 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Icon
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={14}
              className="text-zinc-400"
            />
            {humanize(row.treatmentVar)}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <CliffsDeltaBadge delta={row.cliffsDelta} ciLower={row.cliffsCiLower} ciUpper={row.cliffsCiUpper} />
        </td>
        <td className="px-4 py-2.5">
          <PValueBadge p={row.pValueAdj} label="p_adj" />
        </td>
        <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">
          {row.nTreated.toLocaleString()}
        </td>
        <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">
          {row.nUntreated.toLocaleString()}
        </td>
        <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">
          {row.dataCompleteness != null ? `${formatNum(row.dataCompleteness * 100, 0)}%` : 'N/A'}
        </td>
      </tr>
      {isExpanded && <DetailRow row={row} colSpan={colSpan} />}
    </>
  );
}
