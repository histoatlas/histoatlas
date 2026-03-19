import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import { SectionCard } from '../components/ui/SectionCard';
import { Skeleton, SkeletonTable } from '../components/ui/Skeleton';
import { useMutationIntersection, useMutationKm } from '../hooks/useMutationData';
import { formatHR, formatCI, formatP, formatNum } from '../lib/formatters';
import type { MutationKmCurve } from '../types/mutations';

interface MutationIntersectionProps {
  gene: string;
  cancerSlug: string;
}

const ENDPOINTS = [
  { id: 'os', label: 'Overall Survival' },
  { id: 'pfs', label: 'Progression-Free' },
  { id: 'dss', label: 'Disease-Specific' },
];

export function MutationIntersection({ gene, cancerSlug }: MutationIntersectionProps) {
  const [kmEndpoint, setKmEndpoint] = useState('os');
  const { data, isLoading, error } = useMutationIntersection(gene, cancerSlug);
  const { data: kmData, isLoading: kmLoading } = useMutationKm(gene, cancerSlug, kmEndpoint);

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white border border-zinc-200 rounded-lg p-5 text-sm text-zinc-500">
          Failed to load intersection data. The pipeline may not have been run yet.
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Frequency summary tile */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile
            label="Mutation Frequency"
            value={`${((data.frequency.frequency ?? 0) * 100).toFixed(1)}%`}
            sub={`${data.frequency.nMutated} / ${data.frequency.nTotal} cases`}
            tooltip="Fraction of samples carrying at least one non-silent somatic mutation (missense, nonsense, frameshift, splice-site) in the gene."
          />
          {data.survival.length > 0 && (() => {
            const osUnadj = data.survival.find((s) => s.endpoint === 'os' && s.model === 'unadjusted');
            return osUnadj ? (
              <StatTile
                label="Hazard Ratio (OS)"
                value={formatHR(osUnadj.hazardRatio)}
                sub={`95% CI ${formatCI(osUnadj.hrCiLower, osUnadj.hrCiUpper)}`}
                tooltip="Unadjusted Cox proportional-hazards regression (overall survival). HR > 1 indicates worse prognosis for mutation carriers. 95% confidence interval: Wald method."
              />
            ) : null;
          })()}
          {data.survival.length > 0 && (() => {
            const osUnadj = data.survival.find((s) => s.endpoint === 'os' && s.model === 'unadjusted');
            return osUnadj ? (
              <StatTile
                label="p-value (adj)"
                value={formatP(osUnadj.pValueAdj)}
                sub={`${osUnadj.nEvents} events / ${osUnadj.nSamples} samples`}
                tooltip="Benjamini-Hochberg adjusted p-value from the Cox proportional-hazards model. Correction family: all (cancer type, endpoint, model) combinations. Significance threshold: α = 0.05."
              />
            ) : null;
          })()}
        </div>
      ) : null}

      {/* KM Curve */}
      <SectionCard
        title="Survival Curves"
        subtitle="Kaplan-Meier: Mutated vs Wild-type"
        icon={<Icon name="heart-pulse" size={18} className="text-zinc-400" />}
        badge={<InfoTooltip text="Kaplan-Meier survival estimates comparing mutated vs wild-type groups. Confidence intervals: 95% Greenwood formula. NR = median not reached (fewer than 50% of patients experienced the event during follow-up)." />}
        actions={
          <div className="flex gap-1">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.id}
                onClick={() => setKmEndpoint(ep.id)}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  kmEndpoint === ep.id
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {ep.label}
              </button>
            ))}
          </div>
        }
      >
        {kmLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : kmData?.curves && kmData.curves.length > 0 ? (
          <>
            <KmSummaryTable curves={kmData.curves} />
            <p className="text-xs text-zinc-400 mt-3">NR = median not reached. Median survival and 95% CI estimated via the Greenwood formula.</p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">No survival curve data available for this endpoint.</p>
        )}
      </SectionCard>

      {/* Morphology associations */}
      <SectionCard
        title="Morphology Differences"
        subtitle="Top histomic features associated with mutation status (Cliff's delta)"
        icon={<Icon name="microscope" size={18} className="text-zinc-400" />}
        badge={<InfoTooltip text="Mann-Whitney U test (two-sided) comparing histomic feature values between mutant and wild-type samples. Effect size: Cliff's delta (−1 to +1). Positive values indicate higher feature values in mutant samples. 95% bootstrap percentile confidence intervals (1,000 resamples). P-values: Benjamini-Hochberg adjusted, α = 0.05." />}
      >
        {isLoading ? (
          <SkeletonTable rows={10} columns={4} />
        ) : data?.morphology && data.morphology.length > 0 ? (
          <>
            <MorphologyTable morphology={data.morphology} />
            <p className="text-xs text-zinc-400 mt-3">Cliff's δ {'>'} 0: feature elevated in mutant samples. 95% CI: bootstrap percentile (1,000 resamples). p (adj): BH-corrected, α = 0.05.</p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">No morphology associations available.</p>
        )}
      </SectionCard>

      {/* Co-occurring mutations */}
      <SectionCard
        title="Co-occurring Mutations"
        subtitle="Fisher's exact test on mutation co-occurrence"
        icon={<Icon name="dna" size={18} className="text-zinc-400" />}
        badge={<InfoTooltip text="Fisher's exact test (two-sided) on the 2×2 contingency table of mutation status for each gene pair. OR > 1: mutations co-occur more often than expected. OR < 1: mutations are mutually exclusive. P-values: Benjamini-Hochberg adjusted within each cancer type, α = 0.05." />}
      >
        {isLoading ? (
          <SkeletonTable rows={5} columns={4} />
        ) : data?.cooccurrence && data.cooccurrence.length > 0 ? (
          <>
            <CooccurrenceTable cooccurrence={data.cooccurrence} />
            <p className="text-xs text-zinc-400 mt-3">OR = odds ratio (Fisher's exact, two-sided). co-oc = significant co-occurrence (OR {'>'} 1, p {'<'} 0.05). excl = significant mutual exclusivity (OR {'<'} 1, p {'<'} 0.05). p (adj): BH-corrected within cancer type.</p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">No co-occurrence data available.</p>
        )}
      </SectionCard>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatTile({
  label,
  value,
  sub,
  tooltip,
}: {
  label: string;
  value: string;
  sub: string;
  tooltip?: string;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wide flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </p>
      <p className="text-2xl font-semibold text-zinc-900 mt-1">{value}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
    </div>
  );
}

function KmSummaryTable({ curves }: { curves: MutationKmCurve[] }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Group</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">N</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">Events</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">Median (mo)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {curves.map((c) => (
            <tr key={c.group} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-2.5 text-zinc-700 font-medium">{c.group}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">{c.nSamples}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">{c.nEvents}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {c.medianSurvival != null ? formatNum(c.medianSurvival, 1) : 'NR'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MorphologyTable({
  morphology,
}: {
  morphology: {
    histomicFeature: string;
    effectSize: number | null;
    effectCiLower: number | null;
    effectCiUpper: number | null;
    pValueAdj: number | null;
    isSignificant: boolean;
  }[];
}) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Feature</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">Cliff's d</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">95% CI</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">p (adj)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {morphology.map((m) => (
            <tr key={m.histomicFeature} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-2.5 text-zinc-700">
                {m.histomicFeature.replace(/_/g, ' ')}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatNum(m.effectSize)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-400">
                {formatCI(m.effectCiLower, m.effectCiUpper)}
              </td>
              <td className={`px-4 py-2.5 text-right font-mono text-xs ${m.isSignificant ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                {formatP(m.pValueAdj)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CooccurrenceTable({
  cooccurrence,
}: {
  cooccurrence: {
    partnerGene: string;
    nBoth: number;
    nAOnly: number;
    nBOnly: number;
    nNeither: number;
    oddsRatio: number | null;
    pValueAdj: number | null;
  }[];
}) {
  const sorted = [...cooccurrence].sort(
    (a, b) => (a.pValueAdj ?? 1) - (b.pValueAdj ?? 1)
  );

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Gene</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">Both</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">OR</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">p (adj)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.map((c) => {
            const isSignificant = (c.pValueAdj ?? 1) < 0.05;
            const isMutuallyExclusive = (c.oddsRatio ?? 1) < 1;
            return (
              <tr key={c.partnerGene} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-2.5 text-zinc-700 font-medium">{c.partnerGene}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">{c.nBoth}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                  {formatNum(c.oddsRatio)}
                  {isSignificant && (
                    <span className={`ml-1 text-xs ${isMutuallyExclusive ? 'text-blue-600' : 'text-red-600'}`}>
                      {isMutuallyExclusive ? 'excl' : 'co-oc'}
                    </span>
                  )}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono text-xs ${isSignificant ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                  {formatP(c.pValueAdj)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
