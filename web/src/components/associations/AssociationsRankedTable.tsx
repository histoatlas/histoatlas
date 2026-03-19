import { useState, useMemo } from 'react';
import type {
  AssociationTarget,
  SurvivalAssociation,
  CorrelationAssociation,
  CategoricalAssociation,
  SortState,
  EvidenceStrengthBadge,
} from '../../types';
import { formatP, formatNum, formatCI, formatHR } from '../../lib/formatters';
import { Icon } from '../ui/Icon';
import { InfoTooltip } from '../ui/InfoTooltip';
import { EvidenceBadge } from '../ui/EvidenceBadge';
import { SkeletonTable } from '../ui/Skeleton';

interface RankedTableProps {
  target: AssociationTarget;
  survivalData?: SurvivalAssociation[];
  correlationData?: CorrelationAssociation[];
  categoricalData?: CategoricalAssociation[];
  dataset?: string;
  cohort: string;
  isLoading: boolean;
}

function EffectDirection({ hr }: { hr: number | null }) {
  if (hr == null || hr <= 0) return <span className="text-xs text-zinc-400">—</span>;
  const isProtective = hr < 1;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isProtective ? 'text-blue-600' : 'text-red-600'}`}>
      <span>{isProtective ? '\u2193' : '\u2191'}</span>
      {isProtective ? 'Protective' : 'Harmful'}
    </span>
  );
}

function featureDisplayName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortRows<T>(rows: T[], sort: SortState | null, accessor: (row: T, col: string) => number | string | null): T[] {
  if (!sort) return rows;
  const { column, direction } = sort;
  return [...rows].sort((a, b) => {
    const av = accessor(a, column);
    const bv = accessor(b, column);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return direction === 'asc' ? cmp : -cmp;
  });
}

function SortableHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: SortState | null;
  onSort: (field: string) => void;
}) {
  const active = sort?.column === field;
  return (
    <th
      className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active && <Icon name={sort?.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
      </span>
    </th>
  );
}

export function AssociationsRankedTable({
  target,
  survivalData,
  correlationData,
  categoricalData,
  dataset = 'tcga',
  cohort,
  isLoading,
}: RankedTableProps) {
  const [sort, setSort] = useState<SortState | null>(null);

  const handleSort = (field: string) => {
    setSort((prev) => {
      if (prev?.column === field) {
        return prev.direction === 'desc' ? { column: field, direction: 'asc' } : null;
      }
      return { column: field, direction: 'desc' };
    });
  };

  if (isLoading) {
    return <SkeletonTable rows={10} columns={6} />;
  }

  if (target === 'survival') return (
    <SurvivalTable data={survivalData ?? []} dataset={dataset} cohort={cohort} sort={sort} onSort={handleSort} />
  );
  if (target === 'correlations') return (
    <CorrelationsTable data={correlationData ?? []} dataset={dataset} cohort={cohort} sort={sort} onSort={handleSort} />
  );
  return (
    <CategoricalTable data={categoricalData ?? []} dataset={dataset} cohort={cohort} sort={sort} onSort={handleSort} />
  );
}

function SurvivalTable({
  data,
  dataset,
  cohort,
  sort,
  onSort,
}: {
  data: SurvivalAssociation[];
  dataset: string;
  cohort: string;
  sort: SortState | null;
  onSort: (field: string) => void;
}) {
  const sorted = useMemo(() => sortRows(data, sort, (row, col) => {
    if (col === 'feature') return row.feature;
    if (col === 'hr') return row.hazardRatio;
    if (col === 'pAdj') return row.pValueAdj;
    if (col === 'nEvents') return row.nEvents;
    if (col === 'mdes') {
      if (row.hazardRatio == null) return null;
      return row.hazardRatio >= 1 ? row.mdesHrHarmful : row.mdesHrProtective;
    }
    return null;
  }), [data, sort]);

  if (data.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <SortableHeader label="Feature" field="feature" sort={sort} onSort={onSort} />
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('hr')}
            >
              <span className="inline-flex items-center gap-1">
                HR{sort?.column === 'hr' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="Hazard ratio for above-median (high) vs. below-median (low) group. HR > 1 = higher hazard in the high group; HR < 1 = protective." />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Effect</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">95% CI</th>
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('pAdj')}
            >
              <span className="inline-flex items-center gap-1">
                p<sub>adj</sub>{sort?.column === 'pAdj' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="Benjamini-Hochberg adjusted p-value, corrected within (cancer type, endpoint, model)." />
              </span>
            </th>
            <SortableHeader label="N / Events" field="nEvents" sort={sort} onSort={onSort} />
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('mdes')}
            >
              <span className="inline-flex items-center gap-1">
                MDES{sort?.column === 'mdes' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="Minimum detectable effect size at 80% power (\u03B1 = 0.05). Shows the smallest hazard ratio this analysis could reliably detect, given its sample size and event count." />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.map((row) => (
            <tr key={row.feature} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-2.5">
                <a href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(row.feature)}/`} className="text-blue-600 hover:underline">
                  {featureDisplayName(row.feature)}
                </a>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatHR(row.hazardRatio)}</td>
              <td className="px-4 py-2.5"><EffectDirection hr={row.hazardRatio} /></td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatCI(row.hrCiLower, row.hrCiUpper)}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatP(row.pValueAdj)}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">
                {row.nSamples.toLocaleString()} / {row.nEvents.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">
                {row.hazardRatio != null
                  ? row.hazardRatio >= 1
                    ? row.mdesHrHarmful != null ? `HR \u2265 ${formatHR(row.mdesHrHarmful)}` : '—'
                    : row.mdesHrProtective != null ? `HR \u2264 ${formatHR(row.mdesHrProtective)}` : '—'
                  : '—'}
              </td>
              <td className="px-4 py-2.5"><EvidenceBadge badge={row.evidenceStrengthBadge as EvidenceStrengthBadge} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-zinc-400 mt-3">
        Cox PH regression (two-sided Wald test); 95% CI (Wald); p-values BH-adjusted within (cancer type, endpoint, model); {'\u03B1'}&nbsp;=&nbsp;0.05; analyses restricted to groups with &ge; 10 events.
      </p>
    </div>
  );
}

function CorrelationsTable({
  data,
  dataset,
  cohort,
  sort,
  onSort,
}: {
  data: CorrelationAssociation[];
  dataset: string;
  cohort: string;
  sort: SortState | null;
  onSort: (field: string) => void;
}) {
  const sorted = useMemo(() => sortRows(data, sort, (row, col) => {
    if (col === 'feature') return row.histomicFeature;
    if (col === 'rho') return row.spearmanRho != null ? Math.abs(row.spearmanRho) : null;
    if (col === 'pAdj') return row.spearmanPAdj;
    if (col === 'n') return row.nSamples;
    return null;
  }), [data, sort]);

  if (data.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <SortableHeader label="Feature" field="feature" sort={sort} onSort={onSort} />
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('rho')}
            >
              <span className="inline-flex items-center gap-1">
                {'\u03C1'}{sort?.column === 'rho' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="Spearman rank correlation coefficient; positive = positive association, negative = inverse (two-sided test)" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <span className="inline-flex items-center gap-1">
                95% CI
                <InfoTooltip text="95% bootstrap percentile confidence interval for Spearman \u03C1 (1,000 resamples)" />
              </span>
            </th>
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('pAdj')}
            >
              <span className="inline-flex items-center gap-1">
                p<sub>adj</sub>{sort?.column === 'pAdj' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="BH-adjusted p-value; correction family: all features tested for this cancer type and molecular feature set (\u03B1 = 0.05)" />
              </span>
            </th>
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('n')}
            >
              <span className="inline-flex items-center gap-1">
                N{sort?.column === 'n' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="Number of samples with complete data for both features" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.map((row) => (
            <tr key={row.histomicFeature} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-2.5">
                <a href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(row.histomicFeature)}/`} className="text-blue-600 hover:underline">
                  {featureDisplayName(row.histomicFeature)}
                </a>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatNum(row.spearmanRho, 3)}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatCI(row.spearmanCiLower, row.spearmanCiUpper, 3)}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatP(row.spearmanPAdj)}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{row.nSamples.toLocaleString()}</td>
              <td className="px-4 py-2.5"><EvidenceBadge badge={row.evidenceStrengthBadge as EvidenceStrengthBadge} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-zinc-400 mt-3">
        Spearman rank correlation (two-sided); 95% CI by bootstrap percentile method (1,000 resamples); p-values BH-adjusted within (cancer type, molecular feature set); {'\u03B1'}&nbsp;=&nbsp;0.05.
      </p>
    </div>
  );
}

function CategoricalTable({
  data,
  dataset,
  cohort,
  sort,
  onSort,
}: {
  data: CategoricalAssociation[];
  dataset: string;
  cohort: string;
  sort: SortState | null;
  onSort: (field: string) => void;
}) {
  const sorted = useMemo(() => sortRows(data, sort, (row, col) => {
    if (col === 'feature') return row.histomicFeature;
    if (col === 'effect') return row.effectSize != null ? Math.abs(row.effectSize) : null;
    if (col === 'pAdj') return row.pValueAdj;
    if (col === 'n') return row.nSamples;
    return null;
  }), [data, sort]);

  if (data.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <SortableHeader label="Feature" field="feature" sort={sort} onSort={onSort} />
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('effect')}
            >
              <span className="inline-flex items-center gap-1">
                Cliff&rsquo;s {'\u03B4'}{sort?.column === 'effect' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="Cliff's \u03B4; positive = higher values in the mutant/affected group; range [\u22121, 1]" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <span className="inline-flex items-center gap-1">
                95% CI
                <InfoTooltip text="95% bootstrap percentile confidence interval for Cliff's \u03B4" />
              </span>
            </th>
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('pAdj')}
            >
              <span className="inline-flex items-center gap-1">
                p<sub>adj</sub>{sort?.column === 'pAdj' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="BH-adjusted p-value from Mann-Whitney U test (two-sided); correction family: all features tested for this cancer type and categorical variable (\u03B1 = 0.05)" />
              </span>
            </th>
            <th
              className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none"
              onClick={() => onSort('n')}
            >
              <span className="inline-flex items-center gap-1">
                N{sort?.column === 'n' && <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />}
                <InfoTooltip text="Total number of samples across both groups" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.map((row) => (
            <tr key={row.histomicFeature} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-2.5">
                <a href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(row.histomicFeature)}/`} className="text-blue-600 hover:underline">
                  {featureDisplayName(row.histomicFeature)}
                </a>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatNum(row.effectSize, 3)}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatCI(row.effectCiLower, row.effectCiUpper, 3)}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{formatP(row.pValueAdj)}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{row.nSamples.toLocaleString()}</td>
              <td className="px-4 py-2.5"><EvidenceBadge badge={row.evidenceStrengthBadge as EvidenceStrengthBadge} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-zinc-400 mt-3">
        Mann-Whitney U test (two-sided); effect size: Cliff&rsquo;s {'\u03B4'}; 95% CI by bootstrap percentile method; p-values BH-adjusted within (cancer type, categorical variable); {'\u03B1'}&nbsp;=&nbsp;0.05.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
      No associations found for the selected filters.
    </div>
  );
}
