import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';

import { Icon } from '../components/ui/Icon';
import { Skeleton } from '../components/ui/Skeleton';
import { useDatasets, type Dataset } from '../hooks/useDatasets';
import type { CohortSummary } from '../hooks/useCohortSummary';
import { apiPaths } from '../api/paths';
import { CANCER_TYPE_COLORS } from '../lib/colors';


/** A cohort entry enriched with its parent dataset info. */
interface CohortEntry extends CohortSummary {
  dataset: string;
  datasetDisplayName: string;
}

function SidebarSkeleton() {
  return (
    <div className="space-y-1.5 px-3">
      {Array.from({ length: 20 }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-7 w-8 rounded-md" />
          </div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3.5 w-36" />
        </div>
      ))}
    </div>
  );
}

function RightSidebarSkeleton() {
  return (
    <Skeleton className="h-16 w-full rounded-lg" />
  );
}

/** Compute the same data version hash as the server: sha256("{slides}:{features}:{clusters}")[:7] */
function useDataVersions(cohorts: CohortEntry[] | undefined) {
  const [versions, setVersions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!cohorts) return;

    let cancelled = false;

    async function computeAll() {
      const result: Record<string, string> = {};
      for (const c of cohorts!) {
        const key = `${c.dataset}:${c.id}`;
        const fingerprint = `${c.slideCount}:${c.featureCount}:${c.clusterCount}`;
        const encoded = new TextEncoder().encode(fingerprint);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        result[key] = hex.slice(0, 7);
      }
      if (!cancelled) setVersions(result);
    }

    computeAll();
    return () => { cancelled = true; };
  }, [cohorts]);

  return versions;
}

const MAX_VISIBLE_BADGES = 5;

function CancerTypeBadge({ id }: { id: string }) {
  const color = CANCER_TYPE_COLORS[id] || '#6B7280';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}18`, color, borderColor: `${color}30`, borderWidth: 1 }}
    >
      {id}
    </span>
  );
}

function CohortCard({
  entry,
  dataVersion,
  pinned = false,
  cancerTypes,
}: {
  entry: CohortEntry;
  dataVersion?: string;
  pinned?: boolean;
  cancerTypes: string[];
}) {
  const visible = cancerTypes.slice(0, MAX_VISIBLE_BADGES);
  const remaining = cancerTypes.length - visible.length;

  return (
    <a
      href={`/${entry.dataset}/${entry.id}/atlas/`}
      className="block bg-white border border-zinc-200 rounded-lg p-5 hover:border-zinc-300 transition-colors"
    >
      {/* Row 1: Title + download button */}
      <div className="flex items-start justify-between gap-4">
        <span className="text-xl text-blue-600 font-semibold">
          {entry.datasetDisplayName} {entry.id}
        </span>
        <button
          type="button"
          className="shrink-0 flex items-center gap-1.5 border border-zinc-300 rounded-md px-3 py-1 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400 transition-colors text-xs font-medium cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Download action — placeholder for now
          }}
        >
          <Icon name="download" size={14} />
          Download
        </button>
      </div>

      {/* Row 2: Subtitle */}
      <div className="text-base text-zinc-600 mt-1">{entry.name}</div>

      {/* Row 3: Cancer type badges */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {visible.map((id) => (
          <CancerTypeBadge key={id} id={id} />
        ))}
        {remaining > 0 && (
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-400">
            +{remaining} more
          </span>
        )}
      </div>

      {/* Row 4: Metadata */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-3">
        <Icon name="layers" size={14} />
        <span>{entry.slideCount.toLocaleString()}</span>
        {dataVersion && (
          <>
            <span className="text-zinc-300">·</span>
            <span className="font-mono" title="Data version">v{dataVersion}</span>
          </>
        )}
      </div>
    </a>
  );
}

type SortOption = 'name' | 'slides' | 'clusters' | 'features';

const SORT_LABELS: Record<SortOption, string> = {
  name: 'Name',
  slides: 'Most slides',
  clusters: 'Most clusters',
  features: 'Most features',
};

function sortCohorts(types: CohortEntry[], sort: SortOption): CohortEntry[] {
  return [...types].sort((a, b) => {
    switch (sort) {
      case 'name': return a.id.localeCompare(b.id) || a.dataset.localeCompare(b.dataset);
      case 'slides': return b.slideCount - a.slideCount;
      case 'clusters': return b.clusterCount - a.clusterCount;
      case 'features': return b.featureCount - a.featureCount;
    }
  });
}

/** Merge cohort summaries from multiple datasets into a flat list. */
function useAllCohorts(datasets: Dataset[] | undefined) {
  // Dynamically fetch cohort summaries for every dataset in the registry.
  // useQueries supports a variable-length array, avoiding the need to
  // hardcode dataset IDs as separate hook calls.
  const queries = useQueries({
    queries: (datasets ?? []).map((ds) => ({
      queryKey: ['cohorts', ds.id, 'summary'] as const,
      queryFn: async () => {
        const res = await fetch(apiPaths.cohortSummary(ds.id));
        if (!res.ok) throw new Error(`Failed to load cohort summaries for ${ds.id}`);
        return res.json() as Promise<CohortSummary[]>;
      },
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  });

  const isLoading = !datasets || queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error ?? null;

  const entries: CohortEntry[] | undefined = useMemo(() => {
    if (!datasets) return undefined;

    const result: CohortEntry[] = [];
    for (let i = 0; i < datasets.length; i++) {
      const ds = datasets[i];
      const cohorts = queries[i]?.data;
      if (!cohorts) continue;
      for (const c of cohorts) {
        result.push({
          ...c,
          dataset: ds.id,
          datasetDisplayName: ds.displayName,
        });
      }
    }
    return result.length > 0 ? result : undefined;
  }, [datasets, queries]);

  return { data: entries, isLoading, error };
}

/** Sidebar filter item. */
function FilterButton({
  label,
  active,
  count,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between py-1.5 px-2 rounded transition-colors relative cursor-pointer ${
        active ? 'bg-zinc-100 text-zinc-900' : 'hover:bg-zinc-50 text-zinc-700'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1 bottom-1 w-1 rounded-full bg-blue-500" />
      )}
      <span className="flex items-center gap-2 pl-1">
        {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
        <span className="text-sm font-medium">{label}</span>
      </span>
      {count != null && (
        <span className="text-xs font-mono text-zinc-500 tabular-nums bg-zinc-100 rounded-full px-2 py-0.5">{count.toLocaleString()}</span>
      )}
    </button>
  );
}

export function CohortListing() {
  const { data: datasets } = useDatasets();
  const { data: allEntries, isLoading, error } = useAllCohorts(datasets);
  const dataVersions = useDataVersions(allEntries);
  const [sort, setSort] = useState<SortOption>('slides');
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Lock body scroll when mobile filter drawer is open
  useEffect(() => {
    if (mobileFilterOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileFilterOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!mobileFilterOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileFilterOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileFilterOpen]);

  // Separate PANCAN entries from cancer types
  const pancanEntries = useMemo(() => {
    if (!allEntries) return [];
    return allEntries.filter((c) => c.id === 'PANCAN');
  }, [allEntries]);

  const allTypes = useMemo(() => {
    if (!allEntries) return [];
    return allEntries.filter((c) => c.id !== 'PANCAN');
  }, [allEntries]);

  // Unique cancer type IDs for sidebar
  const uniqueCancerTypes = useMemo(() => {
    const types = new Map<string, number>();
    for (const c of allTypes) {
      types.set(c.id, (types.get(c.id) ?? 0) + c.slideCount);
    }
    return Array.from(types.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, slideCount]) => ({ id, slideCount }));
  }, [allTypes]);

  // Filtered by both dataset and cancer type selections
  const filteredTypes = useMemo(() => {
    let result = allTypes;
    if (selectedDatasets.size > 0) {
      result = result.filter((c) => selectedDatasets.has(c.dataset));
    }
    if (selectedTypes.size > 0) {
      result = result.filter((c) => selectedTypes.has(c.id));
    }
    return result;
  }, [allTypes, selectedDatasets, selectedTypes]);

  const sortedTypes = useMemo(() => sortCohorts(filteredTypes, sort), [filteredTypes, sort]);

  const totalSlides = useMemo(
    () => filteredTypes.reduce((sum, c) => sum + c.slideCount, 0),
    [filteredTypes],
  );

  const toggleDataset = useCallback((id: string) => {
    setSelectedDatasets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleType = useCallback((id: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSort = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value as SortOption);
  }, []);

  const noFiltersActive = selectedDatasets.size === 0 && selectedTypes.size === 0;
  const activeFilterCount = selectedDatasets.size + selectedTypes.size;

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">Failed to load cohorts</div>
          <div className="text-zinc-500 text-sm mb-4">{(error as Error).message}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Datasets filter */}
      {datasets && datasets.length > 1 && (
        <div className="px-6 pt-4 pb-4">
          <div className="text-xs font-semibold text-zinc-500 tracking-tight mb-2 pl-3">Datasets</div>
          <nav className="space-y-0.5">
            {datasets.map((ds) => (
              <FilterButton
                key={ds.id}
                label={ds.displayName}
                active={selectedDatasets.has(ds.id)}
                count={ds.slideCount}
                onClick={() => toggleDataset(ds.id)}
              />
            ))}
          </nav>
        </div>
      )}

      <div className="border-t border-zinc-200 mx-6" />

      {/* Cancer types filter */}
      <div className="px-6 pt-4 pb-4">
        <div className="text-xs font-semibold text-zinc-500 tracking-tight mb-2 pl-3">Cancer types</div>
        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <nav className="space-y-0.5">
            {uniqueCancerTypes.map((c) => (
              <FilterButton
                key={c.id}
                label={c.id}
                active={selectedTypes.has(c.id)}
                count={c.slideCount}
                color={CANCER_TYPE_COLORS[c.id] || '#6B7280'}
                onClick={() => toggleType(c.id)}
              />
            ))}
          </nav>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="hidden md:block w-72 shrink-0 bg-white border-r border-zinc-200 sticky top-0 h-screen overflow-y-auto">
          <div className="px-6 pt-6 pb-4">
            <div className="text-lg font-bold text-zinc-900">Filter by</div>
          </div>

          <div className="border-t border-zinc-200 mx-6" />

          {sidebarContent}
        </aside>

        {/* Center + Right columns */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex gap-6">
            {/* Center column: cohort cards */}
            <div className="flex-1 min-w-0">
              {/* Toolbar */}
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                {isLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : (
                  <div className="text-lg">
                    <span className="font-bold text-zinc-900">{filteredTypes.length} cohorts</span>
                    <span className="text-zinc-400 text-sm ml-2">({totalSlides.toLocaleString()} slides)</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen(true)}
                    className="md:hidden flex items-center gap-1.5 border border-zinc-300 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors cursor-pointer"
                  >
                    <Icon name="filter" size={14} />
                    Filter
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <label htmlFor="sort-select" className="text-sm text-zinc-500">Sort by:</label>
                  <select
                    id="sort-select"
                    value={sort}
                    onChange={handleSort}
                    className="text-sm font-medium border border-zinc-300 rounded-md px-2.5 py-1.5 bg-white text-zinc-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-300"
                  >
                    {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoading ? (
                <CardsSkeleton />
              ) : (
                <div className="space-y-3">
                  {/* PANCAN entries pinned at top (hidden when filtering) */}
                  {noFiltersActive && pancanEntries.map((pancan) => (
                    <CohortCard
                      key={`${pancan.dataset}:${pancan.id}`}
                      entry={pancan}
                      dataVersion={dataVersions[`${pancan.dataset}:${pancan.id}`]}
                      cancerTypes={allTypes.filter((c) => c.dataset === pancan.dataset).map((c) => c.id)}
                      pinned
                    />
                  ))}

                  {/* Cancer type cards */}
                  {sortedTypes.map((c) => (
                    <CohortCard
                      key={`${c.dataset}:${c.id}`}
                      entry={c}
                      dataVersion={dataVersions[`${c.dataset}:${c.id}`]}
                      cancerTypes={[c.id]}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right sidebar — hidden on smaller viewports to prevent overlap */}
            <div className="hidden lg:block w-72 shrink-0">
              <div className="sticky top-5 space-y-4">
                {isLoading ? (
                  <RightSidebarSkeleton />
                ) : (
                  <>
                    <div className="bg-white border border-zinc-200 rounded-lg p-5">
                      <div className="text-sm font-medium tracking-tight text-zinc-900">How is the atlas built?</div>
                      <a href="/methods/" className="text-sm font-medium tracking-tight text-blue-600 hover:underline">Explore methodology</a>
                    </div>

                    <a
                      href="/about/#citation"
                      className="block rounded-lg p-4 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-200/60 hover:border-amber-300 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600 shrink-0">
                          <Icon name="quote" size={16} />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-amber-900">Cite this work</div>
                          <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
                            If you use HistoAtlas data or results in your research, please cite the reference paper.
                          </p>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 mt-2 group-hover:underline">
                            View citation
                            <Icon name="arrow-right" size={12} />
                          </span>
                        </div>
                      </div>
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFilterOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setMobileFilterOpen(false)}
          />
          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white overflow-y-auto md:hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="text-lg font-bold text-zinc-900">Filter by</div>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                aria-label="Close filters"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="border-t border-zinc-200 mx-6" />

            {sidebarContent}
          </div>
        </>
      )}
    </div>
  );
}
