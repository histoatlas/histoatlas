import { useState, useCallback, useMemo } from 'react';
import { useClusterSlides } from '../../hooks/useClusterData';
import { CANCER_TYPE_COLORS, IMMUNE_SUBTYPE_COLORS } from '../../lib/colors';
import { DataTablePagination } from '../table/DataTablePagination';
import { SkeletonTable } from '../ui/Skeleton';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Icon } from '../ui/Icon';

interface ClusterSlidesTableProps {
  dataset?: string;
  clusterId?: string;
  cohort?: string;
}

type SortColumn = 'id' | 'cancerType' | 'immuneSubtype' | 'x' | 'y';
type SortOrder = 'asc' | 'desc';

interface ClusterSlide {
  id: string;
  cancerType: string;
  x: number | null;
  y: number | null;
  immuneSubtype?: string | null;
}

const ALL_COLUMNS: { key: SortColumn; label: string; width: string }[] = [
  { key: 'id', label: 'Slide ID', width: 'w-64' },
  { key: 'cancerType', label: 'Cancer Type', width: 'w-28' },
  { key: 'immuneSubtype', label: 'Immune Subtype', width: 'w-28' },
  { key: 'x', label: 'UMAP X', width: 'w-20' },
  { key: 'y', label: 'UMAP Y', width: 'w-20' },
];

const PAGE_SIZE = 20;

export function ClusterSlidesTable({ dataset = 'tcga', clusterId, cohort = 'PANCAN' }: ClusterSlidesTableProps) {
  const isPancan = cohort === 'PANCAN';
  const columns = isPancan ? ALL_COLUMNS : ALL_COLUMNS.filter((c) => c.key !== 'cancerType');
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const { data, isLoading } = useClusterSlides(dataset, clusterId, cohort);

  // Client-side sorting and pagination
  const allSlides: ClusterSlide[] = useMemo(() => {
    if (!data) return [];
    return data;
  }, [data]);

  const sortedSlides = useMemo(() => {
    const sorted = [...allSlides];
    sorted.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'string'
        ? aVal.localeCompare(bVal as string)
        : (aVal as number) - (bVal as number);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [allSlides, sortColumn, sortOrder]);

  const total = sortedSlides.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagedSlides = sortedSlides.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (column === sortColumn) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(column);
        setSortOrder('asc');
      }
      setPage(1);
    },
    [sortColumn]
  );

  const handlePageChange = useCallback((pageIndex: number) => {
    setPage(pageIndex + 1); // component is 0-based
  }, []);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-200">
        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <Icon name="layers" size={18} className="text-zinc-400" />
          Member Slides
          <InfoTooltip text="All slides assigned to this cluster with their cancer type, immune subtype, and UMAP coordinates." />
        </h2>
      </div>

      {isLoading ? (
        <SkeletonTable rows={10} columns={5} />
      ) : pagedSlides.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-zinc-500">
          No slides found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 select-none ${col.width}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortColumn === col.key && (
                          <SortArrow direction={sortOrder} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pagedSlides.map((slide) => (
                  <tr
                    key={slide.id}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <a
                        href={`/${dataset}/${slide.cancerType}/slide/${slide.id}/`}
                        className="font-mono text-xs text-blue-600 hover:underline truncate block max-w-[240px]"
                      >
                        {slide.id}
                      </a>
                    </td>
                    {isPancan && (
                      <td className="px-4 py-2.5">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{
                            backgroundColor:
                              CANCER_TYPE_COLORS[slide.cancerType] || '#808080',
                          }}
                        >
                          {slide.cancerType}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      {slide.immuneSubtype ? (
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{
                            backgroundColor:
                              IMMUNE_SUBTYPE_COLORS[slide.immuneSubtype] ||
                              '#808080',
                          }}
                        >
                          {slide.immuneSubtype}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">
                      {slide.x != null ? slide.x.toFixed(2) : <span className="text-zinc-400">N/A</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">
                      {slide.y != null ? slide.y.toFixed(2) : <span className="text-zinc-400">N/A</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataTablePagination
            pageIndex={page - 1}
            totalPages={totalPages}
            totalRows={total}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}

function SortArrow({ direction }: { direction: SortOrder }) {
  return (
    <Icon
      name={direction === 'asc' ? 'chevron-up' : 'chevron-down'}
      size={13}
      className="text-zinc-700"
    />
  );
}
