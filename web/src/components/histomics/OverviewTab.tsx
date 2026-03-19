import { useMemo } from 'react';
import {
  useHistomicsSurvival,
  useHistomicsCorrelations,
  useHistomicsCategorical,
} from '../../hooks/useHistomicsData';
import { useAtlasData } from '../../hooks/useAtlasData';
import { SectionCard } from '../ui/SectionCard';
import { EvidenceBadge } from '../ui/EvidenceBadge';
import { Skeleton } from '../ui/Skeleton';
import { Icon } from '../ui/Icon';
import { formatP, formatNum, formatCI } from '../../lib/formatters';
import { ALL_FEATURES } from '../../data/featureGlossary';
import { DistributionChart } from './DistributionChart';
import type { EvidenceStrengthBadge } from '../../types';

const ENDPOINT_LABELS: Record<string, string> = {
  os: 'OS',
  pfs: 'PFS',
  dss: 'DSS',
  dfs: 'DFS',
};

interface OverviewTabProps {
  dataset?: string;
  feature: string;
  cancerType: string;
}

export function OverviewTab({ dataset = 'tcga', feature, cancerType }: OverviewTabProps) {
  const { data: atlasData } = useAtlasData(dataset, cancerType);
  const { data: survivalData, isLoading: survLoading } = useHistomicsSurvival(dataset, feature, cancerType);
  const { data: corrData, isLoading: corrLoading } = useHistomicsCorrelations(
    dataset,
    feature,
    cancerType,
    null,
    'unadjusted'
  );
  const { data: catData, isLoading: catLoading } = useHistomicsCategorical(
    dataset,
    feature,
    cancerType,
    'unadjusted'
  );

  // Survival summary: one row per endpoint (unadjusted model)
  const survivalSummary = useMemo(() => {
    if (!survivalData?.results) return [];
    return ['os', 'pfs', 'dss', 'dfs']
      .map((ep) => survivalData.results.find((r) => r.endpoint === ep && r.model === 'unadjusted'))
      .filter(Boolean);
  }, [survivalData]);

  // Top 5 correlations by |rho|
  const topCorrelations = useMemo(() => {
    if (!corrData?.correlations) return [];
    return [...corrData.correlations]
      .sort((a, b) => Math.abs(b.spearmanRho ?? 0) - Math.abs(a.spearmanRho ?? 0))
      .slice(0, 5);
  }, [corrData]);

  // Top 5 mutations by |effect size|
  const topMutations = useMemo(() => {
    if (!catData?.associations) return [];
    return catData.associations
      .filter((a) => a.categoricalVar.startsWith('mut_'))
      .sort((a, b) => Math.abs(b.effectSize ?? 0) - Math.abs(a.effectSize ?? 0))
      .slice(0, 5);
  }, [catData]);

  // Look up feature in glossary
  const glossaryEntry = useMemo(
    () => ALL_FEATURES.find((f) => f.name === feature),
    [feature]
  );

  // Extract feature values, cancer types, and sample count
  const featureDistribution = useMemo(() => {
    if (!atlasData?.slides) return null;
    const vals: number[] = [];
    const types: string[] = [];
    for (const s of atlasData.slides) {
      const v = s.features[feature];
      if (v != null) {
        vals.push(v);
        types.push(s.cancerType);
      }
    }
    if (vals.length === 0) return null;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1));
    return { values: vals, cancerTypes: types, n: vals.length, mean, median, sd };
  }, [atlasData?.slides, feature]);

  const isLoading = survLoading || corrLoading || catLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Distribution chart */}
      {featureDistribution && (
        <SectionCard
          title="Distribution"
          subtitle={`n = ${featureDistribution.n.toLocaleString()} · mean ${formatNum(featureDistribution.mean)} · median ${formatNum(featureDistribution.median)} · SD (sample) ${formatNum(featureDistribution.sd)}`}
          icon={<Icon name="bar-chart" size={18} className="text-zinc-400" />}
        >
          <DistributionChart
            values={featureDistribution.values}
            cancerTypes={featureDistribution.cancerTypes}
            isPancan={cancerType === 'PANCAN'}
            featureLabel={glossaryEntry?.displayName ?? feature}
          />
        </SectionCard>
      )}

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Survival summary */}
      <SectionCard title="Survival" subtitle="Cox PH (unadjusted)" icon={<Icon name="heart-pulse" size={18} className="text-zinc-400" />}>
        {survivalSummary.length === 0 ? (
          <div className="text-xs text-zinc-500 py-4 text-center">No survival data.</div>
        ) : (
          <div className="space-y-3">
            {survivalSummary.map((r) => (
              <div key={r!.endpoint} className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-medium w-10">
                  {ENDPOINT_LABELS[r!.endpoint] ?? r!.endpoint}
                </span>
                <span className="font-mono text-zinc-900">
                  HR {formatNum(r!.hazardRatio)} {formatCI(r!.hrCiLower, r!.hrCiUpper)}
                </span>
                <EvidenceBadge badge={r!.evidenceStrengthBadge as EvidenceStrengthBadge} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Top correlations */}
      <SectionCard title="Top Correlations" subtitle="Spearman rank (two-sided)" icon={<Icon name="scatter-chart" size={18} className="text-zinc-400" />}>
        {topCorrelations.length === 0 ? (
          <div className="text-xs text-zinc-500 py-4 text-center">No correlations.</div>
        ) : (
          <div className="space-y-2.5">
            {topCorrelations.map((c) => (
              <div key={`${c.molecularFeature}-${c.molecularType}`} className="flex items-center justify-between text-xs gap-2">
                <span className="text-zinc-900 font-medium truncate flex-1" title={c.molecularFeature}>
                  {c.molecularFeature}
                </span>
                <span className="font-mono text-zinc-600 shrink-0">
                  ρ = {formatNum(c.spearmanRho)}
                </span>
                <EvidenceBadge badge={c.evidenceStrengthBadge as EvidenceStrengthBadge} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Top mutations */}
      <SectionCard title="Top Alterations" subtitle="Mann-Whitney U (two-sided)" icon={<Icon name="git-branch" size={18} className="text-zinc-400" />}>
        {topMutations.length === 0 ? (
          <div className="text-xs text-zinc-500 py-4 text-center">No alterations.</div>
        ) : (
          <div className="space-y-2.5">
            {topMutations.map((m) => (
              <div key={m.categoricalVar} className="flex items-center justify-between text-xs gap-2">
                <span className="text-zinc-900 font-medium">
                  {m.categoricalVar.replace('mut_', '').toUpperCase()}
                </span>
                <span className="font-mono text-zinc-600 shrink-0">
                  {m.effectSizeName} {formatNum(m.effectSize)}
                </span>
                <EvidenceBadge badge={m.evidenceStrengthBadge as EvidenceStrengthBadge} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
    </div>
  );
}
