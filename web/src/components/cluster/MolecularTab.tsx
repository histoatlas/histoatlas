import { useState, useMemo, type ReactNode } from "react";
import { SectionCard } from "../ui/SectionCard";
import { Icon } from "../ui/Icon";
import { PillToggle } from "../ui/PillToggle";
import { InfoTooltip } from "../ui/InfoTooltip";
import { Skeleton } from "../ui/Skeleton";
import { ExportActions } from "../ui/ExportActions";
import { MutationForestChart } from "./MutationForestChart";
import { GseaNesChart } from "./GseaNesChart";
import { PathwayDifferenceChart } from "./PathwayDifferenceChart";
import { formatP, formatNum, formatCI } from "../../lib/formatters";
import { downloadCSV } from "../../lib/export";
import type {
  AtlasDataResponse,
  ClusterEnrichments,
  MutationEnrichment,
  GseaEnrichment,
  PathwayEnrichment,
} from "../../types";
import type { IconName } from "../ui/Icon";

interface MolecularTabProps {
  clusterId: string;
  atlasData?: AtlasDataResponse;
  enrichments?: ClusterEnrichments;
  nSlides?: number;
  isLoading: boolean;
}

const SUBTABS = [
  { id: "mutation", label: "Mutation" },
  { id: "gsea", label: "GSEA" },
  { id: "pathway", label: "Pathway" },
] as const;

type SubTabId = (typeof SUBTABS)[number]["id"];

const SUBTAB_CONFIG: Record<
  SubTabId,
  { title: string; icon: IconName }
> = {
  mutation: { title: "Mutation Enrichment", icon: "dna" },
  gsea: { title: "Gene Set Enrichment (GSEA)", icon: "bar-chart" },
  pathway: { title: "Pathway Scores", icon: "workflow" },
};

function SignificanceBadge({ significant, threshold }: { significant: boolean; threshold: string }) {
  if (!significant) return null;
  return (
    <span
      title={threshold}
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 cursor-help"
    >
      Significant
    </span>
  );
}

type MutSortKey = 'mutation' | 'oddsRatio' | 'pValueAdj';
type GseaSortKey = 'pathwayName' | 'nes' | 'fdrQValue';
type PathSortKey = 'pathwayName' | 'scoreDifference' | 'cliffsDelta' | 'pValueAdj';
type SortDir = 'asc' | 'desc';

function SortableHeader({
  label,
  active,
  dir,
  onSort,
  align = 'left',
  tooltip,
}: {
  label: ReactNode;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  align?: 'left' | 'right';
  tooltip?: ReactNode;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={onSort}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {tooltip}
        {active ? (
          <Icon name={dir === 'asc' ? 'chevron-up' : 'chevron-down'} size={13} className="text-zinc-700" />
        ) : (
          <Icon name="arrow-up-down" size={13} className="text-zinc-300" />
        )}
      </span>
    </th>
  );
}

function MutationTable({ mutations }: { mutations: MutationEnrichment[] }) {
  const [sortKey, setSortKey] = useState<MutSortKey>('pValueAdj');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: MutSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'mutation' ? 'asc' : 'asc');
    }
  };

  const sorted = useMemo(
    () =>
      [...mutations].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'mutation':
            return dir * a.mutation.localeCompare(b.mutation);
          case 'oddsRatio':
            return dir * ((a.oddsRatio ?? 0) - (b.oddsRatio ?? 0));
          case 'pValueAdj':
            return dir * ((a.pValueAdj ?? 1) - (b.pValueAdj ?? 1));
          default:
            return 0;
        }
      }),
    [mutations, sortKey, sortDir],
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No mutation enrichment data available.
      </p>
    );
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <SortableHeader
              label="Mutation"
              active={sortKey === 'mutation'}
              dir={sortDir}
              onSort={() => handleSort('mutation')}
              tooltip={<InfoTooltip text="Gene with a somatic mutation tested for enrichment in this cluster (minimum 5 mutated samples required)" />}
            />
            <SortableHeader
              label="Odds Ratio"
              active={sortKey === 'oddsRatio'}
              dir={sortDir}
              onSort={() => handleSort('oddsRatio')}
              align="right"
              tooltip={<InfoTooltip text="Ratio of mutation odds inside vs. outside the cluster; >1 = enriched, <1 = depleted (Fisher's exact test, two-sided)" />}
            />
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <span className="inline-flex items-center justify-end gap-1">
                95% CI
                <InfoTooltip text="95% exact conditional confidence interval for the odds ratio" />
              </span>
            </th>
            <SortableHeader
              label={<>p<sub>adj</sub></>}
              active={sortKey === 'pValueAdj'}
              dir={sortDir}
              onSort={() => handleSort('pValueAdj')}
              align="right"
              tooltip={<InfoTooltip text="Benjamini-Hochberg adjusted p-value; correction family: all mutations tested within this cluster (α = 0.05)" />}
            />
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <span className="inline-flex items-center justify-end gap-1">
                In / Out
                <InfoTooltip text="Mutated sample counts inside / outside the cluster" />
              </span>
            </th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.map((m) => (
            <tr key={m.mutation} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-2.5 text-zinc-900">{m.mutation}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatNum(m.oddsRatio)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {m.orCiLower != null && m.orCiUpper != null
                  ? formatCI(m.orCiLower, m.orCiUpper)
                  : "N/A"}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatP(m.pValueAdj)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {m.nMutatedIn} / {m.nMutatedOut}
              </td>
              <td className="px-4 py-2.5">
                <SignificanceBadge significant={m.isSignificant} threshold="p_adj < 0.05" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-zinc-400 mt-3">
        Fisher's exact test (two-sided); odds ratio CI by exact conditional method; p-values adjusted by Benjamini-Hochberg across all mutations tested within this cluster; significance at α&nbsp;=&nbsp;0.05.
      </p>
    </div>
  );
}

function GseaTable({ gsea }: { gsea: GseaEnrichment[] }) {
  const [sortKey, setSortKey] = useState<GseaSortKey>('fdrQValue');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: GseaSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'pathwayName' ? 'asc' : 'asc');
    }
  };

  const sorted = useMemo(
    () => [...gsea].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'pathwayName':
          return dir * a.pathwayName.localeCompare(b.pathwayName);
        case 'nes':
          return dir * ((a.nes ?? 0) - (b.nes ?? 0));
        case 'fdrQValue':
          return dir * ((a.fdrQValue ?? 1) - (b.fdrQValue ?? 1));
        default:
          return 0;
      }
    }),
    [gsea, sortKey, sortDir],
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-zinc-500">No GSEA data available.</p>;
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <SortableHeader
              label="Pathway"
              active={sortKey === 'pathwayName'}
              dir={sortDir}
              onSort={() => handleSort('pathwayName')}
              tooltip={<InfoTooltip text="Gene set from MSigDB tested for coordinated expression change in this cluster" />}
            />
            <SortableHeader
              label="NES"
              active={sortKey === 'nes'}
              dir={sortDir}
              onSort={() => handleSort('nes')}
              align="right"
              tooltip={<InfoTooltip text="Normalized Enrichment Score from 2,000 phenotype permutations; positive = upregulated in cluster, negative = downregulated; genes ranked by Welch's t-statistic" />}
            />
            <SortableHeader
              label="FDR q"
              active={sortKey === 'fdrQValue'}
              dir={sortDir}
              onSort={() => handleSort('fdrQValue')}
              align="right"
              tooltip={<InfoTooltip text="FDR q-value from pooled null NES distribution (Subramanian et al., 2005); significance threshold: q < 0.25" />}
            />
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <span className="inline-flex items-center justify-end gap-1">
                Leading Edge
                <InfoTooltip text="Number of genes in the leading-edge subset: the core genes driving the enrichment score" />
              </span>
            </th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.map((g) => (
            <tr
              key={g.pathwayName}
              className="hover:bg-zinc-50 transition-colors"
            >
              <td className="px-4 py-2.5 text-zinc-900 max-w-xs truncate">
                {g.pathwayName}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatNum(g.nes)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatP(g.fdrQValue)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {g.leadingEdgeSize} genes
              </td>
              <td className="px-4 py-2.5">
                <SignificanceBadge significant={g.isSignificant} threshold="FDR q < 0.25" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-zinc-400 mt-3">
        Gene Set Enrichment Analysis (<a href="https://doi.org/10.1073/pnas.0506580102" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Subramanian et al., 2005</a>) with Welch's t-statistic ranking and 2,000 phenotype-label permutations; FDR by pooled null NES distribution; significance at FDR q&nbsp;&lt;&nbsp;0.25.
      </p>
    </div>
  );
}

function PathwayTable({ pathways }: { pathways: PathwayEnrichment[] }) {
  const [sortKey, setSortKey] = useState<PathSortKey>('pValueAdj');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: PathSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'pathwayName' ? 'asc' : 'asc');
    }
  };

  const sorted = useMemo(
    () => [...pathways].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'pathwayName':
          return dir * a.pathwayName.localeCompare(b.pathwayName);
        case 'scoreDifference':
          return dir * ((a.scoreDifference ?? 0) - (b.scoreDifference ?? 0));
        case 'cliffsDelta':
          return dir * ((a.cliffsDelta ?? 0) - (b.cliffsDelta ?? 0));
        case 'pValueAdj':
          return dir * ((a.pValueAdj ?? 1) - (b.pValueAdj ?? 1));
        default:
          return 0;
      }
    }),
    [pathways, sortKey, sortDir],
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No pathway enrichment data available.
      </p>
    );
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <SortableHeader
              label="Pathway"
              active={sortKey === 'pathwayName'}
              dir={sortDir}
              onSort={() => handleSort('pathwayName')}
              tooltip={<InfoTooltip text="Pathway activity (mean per-gene z-score) compared between cluster and rest via Mann-Whitney U test (two-sided); effect size: Cliff's delta" />}
            />
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <span className="inline-flex items-center justify-end gap-1">
                Score (in)
                <InfoTooltip text="Mean pathway activity z-score for samples inside the cluster" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <span className="inline-flex items-center justify-end gap-1">
                Score (out)
                <InfoTooltip text="Mean pathway activity z-score for samples outside the cluster" />
              </span>
            </th>
            <SortableHeader
              label="Difference"
              active={sortKey === 'scoreDifference'}
              dir={sortDir}
              onSort={() => handleSort('scoreDifference')}
              align="right"
              tooltip={<InfoTooltip text="Score (in) − Score (out); positive = higher pathway activity in cluster" />}
            />
            <SortableHeader
              label="Cliff's δ"
              active={sortKey === 'cliffsDelta'}
              dir={sortDir}
              onSort={() => handleSort('cliffsDelta')}
              align="right"
              tooltip={<InfoTooltip text="Cliff's delta effect size with 95% bootstrap percentile CI; ranges from −1 to +1" />}
            />
            <SortableHeader
              label={<>p<sub>adj</sub></>}
              active={sortKey === 'pValueAdj'}
              dir={sortDir}
              onSort={() => handleSort('pValueAdj')}
              align="right"
              tooltip={<InfoTooltip text="Benjamini-Hochberg adjusted p-value; correction family: all pathways tested within this cluster (α = 0.05)" />}
            />
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.map((p) => (
            <tr
              key={p.pathwayName}
              className="hover:bg-zinc-50 transition-colors"
            >
              <td className="px-4 py-2.5 text-zinc-900 max-w-xs truncate">
                {p.pathwayName}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatNum(p.meanScoreIn)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatNum(p.meanScoreOut)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatNum(p.scoreDifference)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatNum(p.cliffsDelta)} {p.cliffsDeltaCiLower != null && p.cliffsDeltaCiUpper != null ? <span className="text-zinc-400">[{formatNum(p.cliffsDeltaCiLower)}, {formatNum(p.cliffsDeltaCiUpper)}]</span> : null}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                {formatP(p.pValueAdj)}
              </td>
              <td className="px-4 py-2.5">
                <SignificanceBadge significant={p.isSignificant} threshold="p_adj < 0.05" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-zinc-400 mt-3">
        Pathway activity = mean of per-gene z-scored expression; Mann-Whitney U test (two-sided) comparing in-cluster vs. rest; effect size: Cliff's delta with 95% bootstrap percentile CI (1,000 resamples); p-values adjusted by Benjamini-Hochberg across all pathways tested within this cluster; significance at α&nbsp;=&nbsp;0.05.
      </p>
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full rounded" />
      ))}
    </div>
  );
}

export function MolecularTab({
  clusterId,
  atlasData,
  enrichments,
  nSlides,
  isLoading,
}: MolecularTabProps) {
  const [subTab, setSubTab] = useState<SubTabId>("mutation");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {SUBTABS.map((st) => (
            <div key={st.id} className="h-8 w-20 rounded-full bg-zinc-100 animate-pulse" />
          ))}
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-5">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="w-full h-48 mb-4" />
          <TableSkeleton />
        </div>
      </div>
    );
  }

  const mutations = enrichments?.mutations ?? [];
  const gsea = enrichments?.gsea ?? [];
  const pathways = enrichments?.pathways ?? [];

  const significantMutations = mutations.filter((m) => m.isSignificant).length;
  const significantGsea = gsea.filter((g) => g.isSignificant).length;
  const significantPathways = pathways.filter((p) => p.isSignificant).length;

  const config = SUBTAB_CONFIG[subTab];

  function getSubtitle(): string {
    switch (subTab) {
      case "mutation":
        return `${significantMutations} of ${mutations.length} mutations significantly enriched`;
      case "gsea":
        return `${significantGsea} of ${gsea.length} pathways significant`;
      case "pathway":
        return `${significantPathways} of ${pathways.length} pathways with significant score differences`;
    }
  }

  function getExportAction() {
    switch (subTab) {
      case "mutation":
        return mutations.length > 0 ? (
          <ExportActions
            onExportCSV={() =>
              downloadCSV(
                `${clusterId}_mutation_enrichment.csv`,
                ["mutation", "odds_ratio", "ci_lower", "ci_upper", "p_adj", "n_mutated_in", "n_mutated_out", "significant"],
                mutations.map((m) => [
                  m.mutation,
                  String(m.oddsRatio ?? ""),
                  String(m.orCiLower ?? ""),
                  String(m.orCiUpper ?? ""),
                  String(m.pValueAdj ?? ""),
                  String(m.nMutatedIn),
                  String(m.nMutatedOut),
                  String(m.isSignificant),
                ]),
              )
            }
          />
        ) : null;
      case "gsea":
        return gsea.length > 0 ? (
          <ExportActions
            onExportCSV={() =>
              downloadCSV(
                `${clusterId}_gsea.csv`,
                ["pathway", "nes", "fdr_q", "leading_edge_size", "leading_edge_genes", "significant"],
                gsea.map((g) => [
                  g.pathwayName,
                  String(g.nes ?? ""),
                  String(g.fdrQValue ?? ""),
                  String(g.leadingEdgeSize),
                  g.leadingEdgeGenes.join(";"),
                  String(g.isSignificant),
                ]),
              )
            }
          />
        ) : null;
      case "pathway":
        return pathways.length > 0 ? (
          <ExportActions
            onExportCSV={() =>
              downloadCSV(
                `${clusterId}_pathway_scores.csv`,
                ["pathway", "mean_score_in", "mean_score_out", "score_difference", "p_adj", "significant"],
                pathways.map((p) => [
                  p.pathwayName,
                  String(p.meanScoreIn ?? ""),
                  String(p.meanScoreOut ?? ""),
                  String(p.scoreDifference ?? ""),
                  String(p.pValueAdj ?? ""),
                  String(p.isSignificant),
                ]),
              )
            }
          />
        ) : null;
    }
  }

  return (
    <div className="space-y-6">
      {/* Pill toggle buttons */}
      <PillToggle
        options={SUBTABS.map((st) => ({
          id: st.id,
          label: st.label,
          icon: <Icon name={SUBTAB_CONFIG[st.id].icon} size={16} />,
        }))}
        value={subTab}
        onChange={(id) => setSubTab(id as SubTabId)}
      />

      {/* Active sub-tab content */}
      <SectionCard
        title={config.title}
        subtitle={getSubtitle()}
        icon={<Icon name={config.icon} size={18} className="text-zinc-400" />}
        badge={
          nSlides != null ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              n={nSlides.toLocaleString()}
            </span>
          ) : undefined
        }
        actions={getExportAction()}
      >
        {/* Chart */}
        {subTab === "mutation" && mutations.length > 0 && (
          <div className="mb-6 max-w-[66%]">
            <MutationForestChart mutations={mutations} />
          </div>
        )}
        {subTab === "gsea" && gsea.length > 0 && (
          <div className="mb-6 max-w-[66%]">
            <GseaNesChart gsea={gsea} />
          </div>
        )}
        {subTab === "pathway" && pathways.length > 0 && (
          <div className="mb-6 max-w-[66%]">
            <PathwayDifferenceChart pathways={pathways} />
          </div>
        )}

        {/* Table */}
        {subTab === "mutation" && <MutationTable mutations={mutations} />}
        {subTab === "gsea" && <GseaTable gsea={gsea} />}
        {subTab === "pathway" && <PathwayTable pathways={pathways} />}
      </SectionCard>
    </div>
  );
}
