import { useState, useMemo, useCallback } from 'react';
import { useAtlasData } from '../../hooks/useAtlasData';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { SkeletonTable } from '../ui/Skeleton';
import { formatNum } from '../../lib/formatters';
import type { FeatureCategory } from '../../types';

const CATEGORY_COLORS: Record<FeatureCategory, { bg: string; text: string }> = {
  composition: { bg: 'bg-blue-100', text: 'text-blue-700' },
  density: { bg: 'bg-amber-100', text: 'text-amber-700' },
  morphology: { bg: 'bg-purple-100', text: 'text-purple-700' },
  spatial: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  heterogeneity: { bg: 'bg-rose-100', text: 'text-rose-700' },
};

type SortKey = 'displayName' | 'category' | 'unit' | 'p50' | 'range';
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

function CategoryBadge({ category }: { category: FeatureCategory }) {
  const colors = CATEGORY_COLORS[category] ?? { bg: 'bg-zinc-100', text: 'text-zinc-600' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {category}
    </span>
  );
}

interface HistomicsTableProps {
  dataset?: string;
  cohort?: string;
}

const CATEGORY_ORDER: FeatureCategory[] = ['composition', 'density', 'morphology', 'spatial', 'heterogeneity'];

export function HistomicsTable({ dataset = 'tcga', cohort = 'PANCAN' }: HistomicsTableProps) {
  const { data, isLoading, error } = useAtlasData(dataset, cohort);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<FeatureCategory | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('displayName');
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

  const categoryCounts = useMemo(() => {
    if (!data?.featureMetadata) return new Map<FeatureCategory, number>();
    const counts = new Map<FeatureCategory, number>();
    for (const f of data.featureMetadata) {
      counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
    }
    return counts;
  }, [data?.featureMetadata]);

  const features = useMemo(() => {
    if (!data?.featureMetadata) return [];
    let items = [...data.featureMetadata];

    if (activeCategory) {
      items = items.filter((f) => f.category === activeCategory);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (f) =>
          f.displayName.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'displayName':
          return dir * a.displayName.localeCompare(b.displayName);
        case 'category':
          return dir * a.category.localeCompare(b.category);
        case 'unit':
          return dir * a.unit.localeCompare(b.unit);
        case 'p50':
          return dir * (a.quantiles.p50 - b.quantiles.p50);
        case 'range':
          return dir * (a.max - a.min - (b.max - b.min));
        default:
          return 0;
      }
    });

    return items;
  }, [data?.featureMetadata, search, activeCategory, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <SkeletonTable rows={10} columns={5} />
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

  const totalCount = data?.featureMetadata?.length ?? 0;

  return (
    <>
      {/* Search bar + category pills */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
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
            placeholder="Search features..."
            aria-label="Search features"
            className="w-full h-9 pl-8 pr-3 text-sm bg-white border border-zinc-200 rounded-md text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-300"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_ORDER.map((cat) => {
            const count = categoryCounts.get(cat) ?? 0;
            if (count === 0) return null;
            const isActive = activeCategory === cat;
            const colors = CATEGORY_COLORS[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? `${colors.bg} ${colors.text} ring-1 ring-current`
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {cat}
                <span className={isActive ? 'opacity-70' : 'text-zinc-400'}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <SortHeader label="Name" sortKey="displayName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <SortHeader label="Category" sortKey="category" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <SortHeader label="Unit" sortKey="unit" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <SortHeader label="Median" sortKey="p50" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <SortHeader label="Range" sortKey="range" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {features.map((f) => (
              <tr
                key={f.name}
                className="hover:bg-zinc-50 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <a
                    href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(f.name)}/`}
                    className="text-blue-600 hover:underline"
                  >
                    {f.displayName}
                  </a>
                </td>
                <td className="px-4 py-2.5">
                  <CategoryBadge category={f.category} />
                </td>
                <td className="px-4 py-2.5 text-zinc-600">{f.unit}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                  {formatNum(f.quantiles.p50)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                  {formatNum(f.min)} - {formatNum(f.max)}
                </td>
              </tr>
            ))}
            {features.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  No features matching "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(search || activeCategory) && (
        <p className="mt-3 text-xs text-zinc-400">
          Showing {features.length} of {totalCount} features
        </p>
      )}
    </>
  );
}
