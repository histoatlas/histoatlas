import { MorphologyHeatmap } from '../components/mutations/MorphologyHeatmap';
import { Icon } from '../components/ui/Icon';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import { SectionCard } from '../components/ui/SectionCard';
import { Skeleton, SkeletonTable } from '../components/ui/Skeleton';
import { useGeneOverview, useMorphologyHeatmap } from '../hooks/useMutationData';
import { formatHR, formatCI, formatP } from '../lib/formatters';

interface MutationHubProps {
  gene: string;
}

export function MutationHub({ gene }: MutationHubProps) {
  const { data, isLoading, error } = useGeneOverview(gene);
  const { data: heatmapData, isLoading: isLoadingHeatmap } = useMorphologyHeatmap(gene);

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white border border-zinc-200 rounded-lg p-5 text-sm text-zinc-500">
          Failed to load mutation data. The pipeline may not have been run yet.
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Morphology heatmap, full width */}
      <SectionCard
        title="Morphology Associations Across Cancer Types"
        subtitle="Top 5 histomic features by mean |Cliff's δ| across cohorts"
        icon={<Icon name="grid-3x3" size={18} className="text-zinc-400" />}
        badge={
          <InfoTooltip text="Cliff's delta measures the probability that a randomly chosen mutant sample has a higher feature value than a randomly chosen wild-type sample. Values range from −1 to +1. Effect sizes are computed per cohort using the Mann-Whitney U test with Benjamini-Hochberg correction." />
        }
      >
        {isLoadingHeatmap ? (
          <Skeleton className="h-48 w-full" />
        ) : heatmapData ? (
          <MorphologyHeatmap data={heatmapData} gene={gene} />
        ) : null}
      </SectionCard>

      {/* Frequency + Survival side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Frequency bar chart */}
        <SectionCard
          title="Mutation Frequency by Cancer Type"
          icon={<Icon name="bar-chart" size={18} className="text-zinc-400" />}
          badge={<InfoTooltip text={`Percentage of samples carrying a non-silent ${gene.toUpperCase()} mutation in each TCGA cancer type. Bar length is proportional to the highest frequency across cohorts. Counts show mutated / total samples.`} />}
        >
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : data ? (
            <FrequencyChart frequencies={data.frequencies} />
          ) : null}
        </SectionCard>

        {/* Survival forest plot */}
        <SectionCard
          title="Survival Impact (Overall Survival)"
          subtitle="Hazard ratio: mutant vs wild-type, unadjusted Cox regression"
          icon={<Icon name="heart-pulse" size={18} className="text-zinc-400" />}
          badge={<InfoTooltip text={`Hazard ratios from unadjusted Cox proportional-hazards regression comparing overall survival of ${gene.toUpperCase()}-mutant vs wild-type patients. HR > 1 indicates worse prognosis for mutant carriers. P-values are Benjamini-Hochberg adjusted across cancer types.`} />}
        >
          {isLoading ? (
            <SkeletonTable rows={8} columns={5} />
          ) : data ? (
            <SurvivalForestTable
              entries={data.survivalForest}
              pancan={data.pancanSurvival}
            />
          ) : null}
        </SectionCard>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Frequency horizontal bar chart                                      */
/* ------------------------------------------------------------------ */

function FrequencyChart({
  frequencies,
}: {
  frequencies: { cancerType: string; frequency: number | null; nMutated: number; nTotal: number }[];
}) {
  const sorted = [...frequencies]
    .filter((f) => f.frequency != null && f.frequency > 0)
    .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));

  if (sorted.length === 0) {
    return <p className="text-sm text-zinc-500">No frequency data available.</p>;
  }

  const maxFreq = Math.max(...sorted.map((f) => f.frequency ?? 0));

  return (
    <div className="space-y-1.5">
      {sorted.map((f) => {
        const pct = ((f.frequency ?? 0) * 100).toFixed(0);
        const barWidth = ((f.frequency ?? 0) / maxFreq) * 100;
        return (
          <div key={f.cancerType} className="flex items-center gap-3 text-sm">
            <span className="w-14 text-right font-mono text-xs text-zinc-500 shrink-0">
              {f.cancerType}
            </span>
            <div className="flex-1 h-5 bg-zinc-100 rounded-sm overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-sm transition-all"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-xs text-zinc-700">{pct}%</span>
            <span className="w-16 text-right text-xs text-zinc-400">
              {f.nMutated}/{f.nTotal}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Survival forest table                                               */
/* ------------------------------------------------------------------ */

function SurvivalForestTable({
  entries,
  pancan,
}: {
  entries: {
    cancerType: string;
    hazardRatio: number | null;
    hrCiLower: number | null;
    hrCiUpper: number | null;
    pValueAdj: number | null;
    nSamples: number;
    nEvents: number;
    phFlag: string;
  }[];
  pancan: typeof entries[0] | null;
}) {
  const allEntries = pancan ? [{ ...pancan, isPancan: true }, ...entries.map((e) => ({ ...e, isPancan: false }))] : entries.map((e) => ({ ...e, isPancan: false }));

  if (allEntries.length === 0) {
    return <p className="text-sm text-zinc-500">No survival data available.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Cancer Type</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">HR</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">95% CI</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">p (adj)</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">N</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {allEntries.map((e) => (
            <tr
              key={e.cancerType}
              className={`hover:bg-zinc-50 transition-colors ${e.isPancan ? 'font-medium bg-zinc-50/50' : ''}`}
            >
              <td className="px-4 py-2.5 text-zinc-700">
                {e.isPancan ? 'Pan-Cancer' : e.cancerType}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatHR(e.hazardRatio)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-400">
                {formatCI(e.hrCiLower, e.hrCiUpper)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatP(e.pValueAdj)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-400">
                {e.nSamples}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
