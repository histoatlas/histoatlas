import { useState, useMemo, useRef, useCallback } from 'react';
import {
  useHistomicsCorrelations,
  useHistomicsScatter,
  useHistomicsViolin,
  useHistomicsCategorical,
} from '../../hooks/useHistomicsData';
import { SectionCard } from '../ui/SectionCard';
import { SignificanceBadge } from '../ui/SurvivalBadges';
import { Icon } from '../ui/Icon';
import { PillToggle } from '../ui/PillToggle';
import { InfoTooltip } from '../ui/InfoTooltip';
import { ExportActions } from '../ui/ExportActions';
import { Skeleton } from '../ui/Skeleton';
import { CorrelationForestChart } from './CorrelationForestChart';
import { ScatterPlotChart } from './ScatterPlotChart';
import { ViolinPlotChart } from './ViolinPlotChart';
import { formatP, formatNum, formatCI } from '../../lib/formatters';
import { downloadCSV, downloadSvg } from '../../lib/export';
import type { HistomicsCorrelation } from '../../types';
import type { IconName } from '../ui/Icon';

const MOLECULAR_SUBTABS = [
  { id: 'expression', label: 'Expression' },
  { id: 'pathway', label: 'Pathways' },
  { id: 'immune_score', label: 'Immune' },
  { id: 'cnv', label: 'CNV' },
] as const;

type SubTabId = (typeof MOLECULAR_SUBTABS)[number]['id'];

const SUBTAB_CONFIG: Record<SubTabId, { title: string; icon: IconName }> = {
  expression: { title: 'Gene Expression Correlations', icon: 'dna' },
  pathway: { title: 'Pathway Correlations', icon: 'workflow' },
  immune_score: { title: 'Immune Score Correlations', icon: 'shield-check' },
  cnv: { title: 'Copy Number Correlations', icon: 'activity' },
};

const TEST_LABELS: Record<string, string> = {
  kruskal_wallis: 'Kruskal-Wallis',
  mann_whitney_u: 'Mann-Whitney U',
};

const EFFECT_LABELS: Record<string, string> = {
  eta_squared: 'η²',
  cliffs_delta: "Cliff's δ",
};

function CorrelationsTable({
  correlations,
  selectedRow,
  onRowClick,
  molecularType,
}: {
  correlations: HistomicsCorrelation[];
  selectedRow: HistomicsCorrelation | null;
  onRowClick: (row: HistomicsCorrelation | null) => void;
  molecularType: string;
}) {
  if (correlations.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">
        No correlations found.
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
                  Molecular Feature
                  <InfoTooltip text="Gene/pathway tested for rank correlation with this histomic feature" />
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center justify-end gap-1">
                  ρ
                  <InfoTooltip text="Spearman rank correlation coefficient; positive = positive association, negative = inverse (two-sided test)" />
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center justify-end gap-1">
                  95% CI
                  <InfoTooltip text="95% bootstrap percentile confidence interval for Spearman ρ (1,000 resamples)" />
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center justify-end gap-1">
                  p<sub>adj</sub>
                  <InfoTooltip text={`BH-adjusted p-value; correction family: all ${molecularType} features tested for this cancer type (α = 0.05)`} />
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span className="inline-flex items-center justify-end gap-1">
                  N
                  <InfoTooltip text="Number of samples with complete data for both features" />
                </span>
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {correlations.map((row) => {
              const isSelected = selectedRow?.molecularFeature === row.molecularFeature;
              return (
                <tr
                  key={`${row.molecularFeature}-${row.molecularType}`}
                  onClick={() => onRowClick(isSelected ? null : row)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <td className="px-4 py-2.5 text-zinc-900">{row.molecularFeature}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                    {formatNum(row.spearmanRho)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                    {formatCI(row.spearmanCiLower, row.spearmanCiUpper)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                    {formatP(row.spearmanPAdj)}
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
        Spearman rank correlation (two-sided); 95% CI by bootstrap percentile method (1,000 resamples); p-values by analytical t-test (t-distribution approximation); adjusted by Benjamini-Hochberg across all {molecularType} features tested for this cancer type; significance at α&nbsp;=&nbsp;0.05.
      </p>
    </div>
  );
}

interface MolecularTabProps {
  dataset?: string;
  feature: string;
  cancerType: string;
}

export function MolecularTab({ dataset = 'tcga', feature, cancerType }: MolecularTabProps) {
  const [subTab, setSubTab] = useState<SubTabId>('expression');
  const [selectedRow, setSelectedRow] = useState<HistomicsCorrelation | null>(null);
  const scatterRef = useRef<HTMLDivElement>(null);
  const scatterChartRef = useRef<HTMLDivElement>(null);

  const { data: corrData, isLoading: corrLoading } = useHistomicsCorrelations(
    dataset,
    feature,
    cancerType,
    subTab,
    'unadjusted',
  );

  // Immune subtype violin + Kruskal-Wallis (only when Immune sub-tab is active)
  const isImmuneTab = subTab === 'immune_score';
  const { data: violinData, isLoading: violinLoading, isError: violinError } = useHistomicsViolin(
    dataset,
    isImmuneTab ? feature : null,
    isImmuneTab ? cancerType : null,
    isImmuneTab ? 'immune_subtype' : null,
  );
  const { data: categoricalData } = useHistomicsCategorical(
    dataset,
    isImmuneTab ? feature : null,
    isImmuneTab ? cancerType : null,
  );
  const immuneSubtypeTest = useMemo(() => {
    if (!categoricalData?.associations) return null;
    return categoricalData.associations.find(
      (a) => a.categoricalVar === 'immune_subtype',
    ) ?? null;
  }, [categoricalData]);

  // Scatter plot for selected row
  const { data: scatterData, isLoading: scatterLoading } = useHistomicsScatter(
    dataset,
    selectedRow ? feature : null,
    selectedRow ? cancerType : null,
    selectedRow?.molecularFeature ?? null,
    selectedRow?.molecularType ?? null,
  );

  // Sort correlations by |rho|
  const sortedCorrelations = useMemo(() => {
    if (!corrData?.correlations) return [];
    const sorted = [...corrData.correlations].sort(
      (a, b) => Math.abs(b.spearmanRho ?? 0) - Math.abs(a.spearmanRho ?? 0),
    );
    // Deduplicate: keep first (highest |ρ|) entry per molecularFeature
    const seen = new Set<string>();
    return sorted.filter((c) => {
      if (seen.has(c.molecularFeature)) return false;
      seen.add(c.molecularFeature);
      return true;
    });
  }, [corrData]);

  const handleForestRowClick = useCallback(
    (molecularFeature: string) => {
      const match = sortedCorrelations.find((c) => c.molecularFeature === molecularFeature);
      if (!match) return;
      const isToggleOff = selectedRow?.molecularFeature === molecularFeature;
      setSelectedRow(isToggleOff ? null : match);
      if (!isToggleOff) {
        // Scroll to scatter after React renders the card
        requestAnimationFrame(() => {
          scatterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    },
    [sortedCorrelations, selectedRow],
  );

  const nSignificant = sortedCorrelations.filter((c) => c.isSignificant).length;
  const config = SUBTAB_CONFIG[subTab];

  return (
    <div className="space-y-6">
      {/* Sub-filter pills */}
      <PillToggle
        options={MOLECULAR_SUBTABS.map((st) => ({
          id: st.id,
          label: st.label,
          icon: <Icon name={SUBTAB_CONFIG[st.id].icon} size={16} />,
        }))}
        value={subTab}
        onChange={(id) => { setSubTab(id as SubTabId); setSelectedRow(null); }}
      />

      {/* Immune subtype violin card (Immune sub-tab only) */}
      {isImmuneTab && (() => {
        const testLabel = immuneSubtypeTest ? (TEST_LABELS[immuneSubtypeTest.testType] ?? immuneSubtypeTest.testType) : null;
        const effectLabel = immuneSubtypeTest ? (EFFECT_LABELS[immuneSubtypeTest.effectSizeName] ?? immuneSubtypeTest.effectSizeName) : null;
        return (
        <SectionCard
          title="Distribution by Immune Subtype"
          subtitle={
            immuneSubtypeTest && testLabel ? (
              <span className="inline-flex items-center gap-2">
                {testLabel} p<sub>adj</sub> = {formatP(immuneSubtypeTest.pValueAdj)}, {effectLabel} = {formatNum(immuneSubtypeTest.effectSize)}
                <SignificanceBadge significant={immuneSubtypeTest.isSignificant} threshold="p_adj < 0.05" />
              </span>
            ) : undefined
          }
          icon={<Icon name="shield-check" size={18} className="text-zinc-400" />}
        >
          {violinLoading || (!violinData && !violinError) ? (
            <Skeleton className="w-full h-64" />
          ) : violinData && violinData.groups.length > 0 ? (
            <>
              <div className="max-w-[66%]">
                <ViolinPlotChart
                  groups={violinData.groups}
                  yLabel={feature}
                  title={`Immune Subtype, ${testLabel ?? 'Kruskal-Wallis'} test`}
                />
              </div>
              {immuneSubtypeTest && (
                <p className="text-xs text-zinc-400 mt-3">
                  {testLabel} test (two-sided); effect size: {effectLabel} = {formatNum(immuneSubtypeTest.effectSize)}
                  {immuneSubtypeTest.effectCiLower != null && immuneSubtypeTest.effectCiUpper != null && (
                    <> ({formatCI(immuneSubtypeTest.effectCiLower, immuneSubtypeTest.effectCiUpper)})</>
                  )}; p<sub>adj</sub> = {formatP(immuneSubtypeTest.pValueAdj)} (BH-adjusted across all categorical variables; α&nbsp;=&nbsp;0.05); N&nbsp;=&nbsp;{immuneSubtypeTest.nSamples}.
                </p>
              )}
            </>
          ) : (
            <div className="text-sm text-zinc-500 py-8 text-center">
              No immune subtype data available for this feature.
            </div>
          )}
        </SectionCard>
        );
      })()}

      {/* Main correlations card */}
      <SectionCard
        title={config.title}
        subtitle={corrLoading ? undefined : `${nSignificant} of ${sortedCorrelations.length} features significantly correlated`}
        icon={<Icon name={config.icon} size={18} className="text-zinc-400" />}
        actions={
          sortedCorrelations.length > 0 ? (
            <ExportActions
              onExportCSV={() =>
                downloadCSV(
                  `${feature}_${cancerType}_${subTab}_correlations.csv`,
                  ['molecular_feature', 'spearman_rho', 'ci_lower', 'ci_upper', 'p_adj', 'n_samples', 'significant'],
                  sortedCorrelations.map((c) => [
                    c.molecularFeature,
                    String(c.spearmanRho ?? ''),
                    String(c.spearmanCiLower ?? ''),
                    String(c.spearmanCiUpper ?? ''),
                    String(c.spearmanPAdj ?? ''),
                    String(c.nSamples),
                    String(c.isSignificant),
                  ]),
                )
              }
            />
          ) : undefined
        }
      >
        {corrLoading ? (
          <Skeleton className="w-full h-48" />
        ) : sortedCorrelations.length === 0 ? (
          <div className="text-sm text-zinc-500 py-8 text-center">
            No correlations found.
          </div>
        ) : (
          <>
            {/* Forest chart */}
            <div className="mb-6 max-w-[66%]">
              <CorrelationForestChart
                correlations={sortedCorrelations}
                onRowClick={handleForestRowClick}
                selectedFeature={selectedRow?.molecularFeature}
              />
            </div>

            {/* Click hint */}
            {!selectedRow && (
              <p className="flex items-center gap-1.5 text-xs text-zinc-400 mb-4">
                <Icon name="mouse-pointer-click" size={14} />
                Click any row in the chart or table to view the underlying scatter plot
              </p>
            )}

            {/* Correlations table */}
            <CorrelationsTable
              correlations={sortedCorrelations}
              selectedRow={selectedRow}
              onRowClick={setSelectedRow}
              molecularType={subTab}
            />
          </>
        )}
      </SectionCard>

      {/* Scatter plot detail */}
      {selectedRow && (
        <div ref={scatterRef}>
        <SectionCard
          title={`${feature} vs ${selectedRow.molecularFeature}`}
          icon={<Icon name="scatter-chart" size={18} className="text-zinc-400" />}
          actions={
            scatterData ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const svg = scatterChartRef.current?.querySelector('svg');
                    if (svg) downloadSvg(svg as SVGSVGElement, `${feature}_vs_${selectedRow.molecularFeature}_scatter.svg`);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <Icon name="download" size={16} />
                  Save Figure
                </button>
                <button
                  onClick={() => {
                    const { caseIds, histomicValues, molecularValues } = scatterData.points;
                    const hasCaseIds = caseIds && caseIds.length === histomicValues.length;
                    downloadCSV(
                      `${feature}_vs_${selectedRow.molecularFeature}_scatter.csv`,
                      hasCaseIds
                        ? ['case_id', feature, selectedRow.molecularFeature]
                        : [feature, selectedRow.molecularFeature],
                      histomicValues.map((h, i) =>
                        hasCaseIds
                          ? [caseIds[i], String(h), String(molecularValues[i])]
                          : [String(h), String(molecularValues[i])],
                      ),
                    );
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <Icon name="download" size={16} />
                  Download Raw Data
                </button>
              </div>
            ) : undefined
          }
        >
          {scatterLoading ? (
            <Skeleton className="w-full h-64" />
          ) : scatterData ? (
            <div ref={scatterChartRef} className="max-w-lg">
              <ScatterPlotChart
                histomicValues={scatterData.points.histomicValues}
                molecularValues={scatterData.points.molecularValues}
                regression={scatterData.regression}
                n={scatterData.n}
                xLabel={feature}
                yLabel={selectedRow.molecularFeature}
                spearmanRho={selectedRow.spearmanRho}
                spearmanCiLower={selectedRow.spearmanCiLower}
                spearmanCiUpper={selectedRow.spearmanCiUpper}
                spearmanPAdj={selectedRow.spearmanPAdj}
              />
            </div>
          ) : (
            <div className="text-sm text-zinc-500 py-8 text-center">
              No scatter data available.
            </div>
          )}
        </SectionCard>
        </div>
      )}
    </div>
  );
}
