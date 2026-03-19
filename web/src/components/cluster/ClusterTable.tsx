import { useState, useMemo, useCallback } from 'react';
import { useAtlasData } from '../../hooks/useAtlasData';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { SkeletonTable } from '../ui/Skeleton';
import { CANCER_TYPE_COLORS } from '../../lib/colors';
import type { Cluster, Slide } from '../../types';

type SortKey = 'name' | 'id' | 'slides';
type SortDir = 'asc' | 'desc';

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = currentSort === sortKey;
  const iconName: IconName = active
    ? currentDir === 'asc'
      ? 'chevron-up'
      : 'chevron-down'
    : 'arrow-up-down';

  return (
    <button
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 cursor-pointer hover:text-zinc-700 select-none uppercase"
    >
      <span>{label}</span>
      {active && (
        <Icon name={iconName} size={14} />
      )}
    </button>
  );
}

function getTopCancerTypes(
  cluster: Cluster,
  slides: Slide[],
  topN = 3
): Array<{ type: string; count: number; color: string }> {
  const counts: Record<string, number> = {};
  for (const slideId of cluster.slideIds) {
    const slide = slides.find((s) => s.id === slideId);
    if (slide) {
      counts[slide.cancerType] = (counts[slide.cancerType] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([type, count]) => ({
      type,
      count,
      color: CANCER_TYPE_COLORS[type] || '#808080',
    }));
}

interface ClusterTableProps {
  dataset?: string;
  cohort?: string;
}

export function ClusterTable({ dataset = 'tcga', cohort = 'PANCAN' }: ClusterTableProps) {
  const { data, isLoading, error } = useAtlasData(dataset, cohort);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  const clusterCancerTypes = useMemo(() => {
    if (!data?.clusters || !data?.slides) return new Map<string, Array<{ type: string; count: number; color: string }>>();
    const map = new Map<string, Array<{ type: string; count: number; color: string }>>();
    for (const cluster of data.clusters) {
      map.set(cluster.id, getTopCancerTypes(cluster, data.slides));
    }
    return map;
  }, [data?.clusters, data?.slides]);

  const clusters = useMemo(() => {
    if (!data?.clusters) return [];
    let items = [...data.clusters];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'id':
          return dir * a.id.localeCompare(b.id);
        case 'slides':
          return dir * (a.slideIds.length - b.slideIds.length);
        default:
          return 0;
      }
    });

    return items;
  }, [data?.clusters, search, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <SkeletonTable rows={8} columns={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">
            Failed to load data
          </div>
          <div className="text-zinc-500 text-sm mb-4">{error.message}</div>
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

  const totalCount = data?.clusters?.length ?? 0;

  return (
    <>
      {/* Search bar */}
      <div className="mb-4">
        <div className="relative w-72">
          <Icon
            name="search"
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clusters..."
            className="w-full h-9 pl-8 pr-3 text-sm bg-white border border-zinc-200 rounded-md text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-300"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <SortHeader label="Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <SortHeader label="ID" sortKey="id" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <SortHeader label="Slides" sortKey="slides" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Top Cancer Types</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {clusters.map((c) => {
              const topTypes = clusterCancerTypes.get(c.id) ?? [];
              return (
                <tr
                  key={c.id}
                  className="hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <a
                      href={`/${dataset}/${cohort}/cluster/${encodeURIComponent(c.id)}/`}
                      className="text-blue-600 hover:underline"
                    >
                      {c.name}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">
                    {c.id}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-700">
                    {c.slideIds.length.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {topTypes.map(({ type, color }) => (
                        <span
                          key={type}
                          className="px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: color }}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {clusters.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  No clusters matching "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {search && (
        <p className="mt-3 text-xs text-zinc-400">
          Showing {clusters.length} of {totalCount} clusters
        </p>
      )}
    </>
  );
}
