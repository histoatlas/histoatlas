import { useState, useMemo, useRef, useCallback } from 'react';
import { useHistomicsCategorical, useHistomicsViolin } from '../../hooks/useHistomicsData';
import { SectionCard } from '../ui/SectionCard';
import { Icon } from '../ui/Icon';
import { InfoTooltip } from '../ui/InfoTooltip';
import { ExportActions } from '../ui/ExportActions';
import { Skeleton } from '../ui/Skeleton';
import { AlterationForestChart } from './AlterationForestChart';
import { ViolinPlotChart } from './ViolinPlotChart';
import { SignificanceBadge } from '../ui/SurvivalBadges';
import { formatP, formatNum, formatCI } from '../../lib/formatters';
import { downloadCSV } from '../../lib/export';
import { hasMutationPage } from '../../data/mutationPages';
import { TCGA_TO_SLUG } from '../../data/cancerSlugs';
import type { HistomicsCategoricalAssociation } from '../../types';

function MutationsTable({
  mutations,
  selectedRow,
  onRowClick,
  cancerType,
}: {
  mutations: HistomicsCategoricalAssociation[];
  selectedRow: HistomicsCategoricalAssociation | null;
  onRowClick: (row: HistomicsCategoricalAssociation | null) => void;
  cancerType: string;
}) {
  if (mutations.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">
        No mutation associations found.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center gap-1">
                  Mutation
                  <InfoTooltip text="Gene tested for association with this histomic feature (mutated vs. wild-type); minimum 5 samples per group" />
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center justify-end gap-1">
                  Cliff's δ
                  <InfoTooltip text="Cliff's delta effect size from Mann-Whitney U test (two-sided); range [−1, 1]; positive = higher feature values in mutated group" />
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center justify-end gap-1">
                  95% CI
                  <InfoTooltip text="95% bootstrap percentile confidence interval for Cliff's delta (1,000 resamples)" />
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center justify-end gap-1">
                  p<sub>adj</sub>
                  <InfoTooltip text="BH-adjusted p-value; correction family: all mutations tested for this feature × cancer type (α = 0.05)" />
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center justify-end gap-1">
                  N
                  <InfoTooltip text="Total samples with mutation status and feature data" />
                </span>
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {mutations.map((row) => {
              const isSelected = selectedRow?.categoricalVar === row.categoricalVar;
              const mutLabel = row.categoricalVar.replace('mut_', '').toUpperCase();
              const geneSlug = row.categoricalVar.replace('mut_', '');
              const cancerSlug = TCGA_TO_SLUG[cancerType];
              const hasPage = cancerSlug ? hasMutationPage(geneSlug, cancerSlug) : false;
              return (
                <tr
                  key={row.categoricalVar}
                  onClick={() => onRowClick(isSelected ? null : row)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <td className="px-4 py-2.5 text-zinc-900">
                    {hasPage ? (
                      <a
                        href={`/mutations/${geneSlug}/${cancerSlug}/`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {mutLabel}
                      </a>
                    ) : mutLabel}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                    {formatNum(row.effectSize)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                    {formatCI(row.effectCiLower, row.effectCiUpper)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                    {formatP(row.pValueAdj)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                    {row.nSamples}
                  </td>
                  <td className="px-4 py-2.5">
                    <SignificanceBadge significant={row.isSignificant} threshold="p_adj < 0.05" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400 mt-3">
        Mann-Whitney U test (two-sided); effect size: Cliff's delta with 95% bootstrap percentile CI (1,000 resamples); p-values adjusted by Benjamini-Hochberg across all mutations tested for this feature × cancer type; significance at α&nbsp;=&nbsp;0.05.
      </p>
    </div>
  );
}

interface AlterationsTabProps {
  dataset?: string;
  feature: string;
  cancerType: string;
}

export function AlterationsTab({ dataset = 'tcga', feature, cancerType }: AlterationsTabProps) {
  const [selectedRow, setSelectedRow] = useState<HistomicsCategoricalAssociation | null>(null);
  const violinRef = useRef<HTMLDivElement>(null);

  const { data: catData, isLoading: catLoading } = useHistomicsCategorical(
    dataset,
    feature,
    cancerType,
    'unadjusted'
  );

  // Violin for selected mutation
  const { data: violinData, isLoading: violinLoading } = useHistomicsViolin(
    dataset,
    selectedRow ? feature : null,
    selectedRow ? cancerType : null,
    selectedRow?.categoricalVar ?? null,
  );

  // Filter to mutation rows only, sorted by |effect size|, deduplicated per gene
  const mutations = useMemo(() => {
    if (!catData?.associations) return [];
    const sorted = catData.associations
      .filter((a) => a.categoricalVar.startsWith('mut_'))
      .sort((a, b) => Math.abs(b.effectSize ?? 0) - Math.abs(a.effectSize ?? 0));
    const seen = new Set<string>();
    return sorted.filter((a) => {
      if (seen.has(a.categoricalVar)) return false;
      seen.add(a.categoricalVar);
      return true;
    });
  }, [catData]);

  const handleForestRowClick = useCallback(
    (categoricalVar: string) => {
      const match = mutations.find((m) => m.categoricalVar === categoricalVar);
      if (!match) return;
      const isToggleOff = selectedRow?.categoricalVar === categoricalVar;
      setSelectedRow(isToggleOff ? null : match);
      if (!isToggleOff) {
        requestAnimationFrame(() => {
          violinRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    },
    [mutations, selectedRow],
  );

  const nSignificant = mutations.filter((m) => m.isSignificant).length;

  // Group sizes for violin subtitle
  const violinSubtitle = useMemo(() => {
    if (!selectedRow) return '';
    const gs = selectedRow.groupSizes;
    const nMut = gs['Mutant'] ?? gs['mutant'] ?? '?';
    const nWt = gs['WT'] ?? gs['wt'] ?? gs['Wild-type'] ?? gs['wild-type'] ?? '?';
    return `N mutated = ${nMut}, N wild-type = ${nWt}`;
  }, [selectedRow]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Mutation Associations"
        subtitle={`${nSignificant} of ${mutations.length} mutations significantly associated`}
        icon={<Icon name="git-branch" size={18} className="text-zinc-400" />}
        actions={
          mutations.length > 0 ? (
            <ExportActions
              onExportCSV={() =>
                downloadCSV(
                  `${feature}_${cancerType}_mutation_associations.csv`,
                  ['mutation', 'cliffs_delta', 'ci_lower', 'ci_upper', 'p_adj', 'n_samples', 'significant'],
                  mutations.map((m) => [
                    m.categoricalVar.replace('mut_', '').toUpperCase(),
                    String(m.effectSize ?? ''),
                    String(m.effectCiLower ?? ''),
                    String(m.effectCiUpper ?? ''),
                    String(m.pValueAdj ?? ''),
                    String(m.nSamples),
                    String(m.isSignificant),
                  ]),
                )
              }
            />
          ) : undefined
        }
      >
        {catLoading ? (
          <Skeleton className="w-full h-48" />
        ) : mutations.length === 0 ? (
          <div className="text-sm text-zinc-500 py-8 text-center">
            No mutation associations found.
          </div>
        ) : (
          <>
            {/* Forest chart */}
            <div className="mb-6 max-w-[66%]">
              <AlterationForestChart
                mutations={mutations}
                onRowClick={handleForestRowClick}
                selectedFeature={selectedRow?.categoricalVar}
              />
            </div>

            {/* Click hint */}
            {!selectedRow && (
              <p className="flex items-center gap-1.5 text-xs text-zinc-400 mb-4">
                <Icon name="mouse-pointer-click" size={14} />
                Click any row in the chart or table to view the underlying violin plot
              </p>
            )}

            {/* Mutations table */}
            <MutationsTable
              mutations={mutations}
              selectedRow={selectedRow}
              onRowClick={setSelectedRow}
              cancerType={cancerType}
            />
          </>
        )}
      </SectionCard>

      {/* Violin detail */}
      {selectedRow && (
        <div ref={violinRef}>
          <SectionCard
            title={`${selectedRow.categoricalVar.replace('mut_', '').toUpperCase()} — Mutated vs Wild-type`}
            subtitle={violinSubtitle}
            icon={<Icon name="bar-chart" size={18} className="text-zinc-400" />}
          >
            {violinLoading ? (
              <Skeleton className="w-full h-64" />
            ) : violinData && violinData.groups.length > 0 ? (
              <div className="max-w-[66%]">
                <ViolinPlotChart groups={violinData.groups} yLabel={feature} title="Mutation Association — Mann-Whitney U test (two-sided)" />
              </div>
            ) : (
              <div className="text-sm text-zinc-500 py-8 text-center">
                No violin data available.
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
