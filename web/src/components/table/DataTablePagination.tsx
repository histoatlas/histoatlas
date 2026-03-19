interface DataTablePaginationProps {
  pageIndex: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
}

/**
 * Pagination controls for the data table.
 */
export function DataTablePagination({
  pageIndex,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
}: DataTablePaginationProps) {
  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex < totalPages - 1;

  const startRow = pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 bg-zinc-50">
      {/* Row range */}
      <div className="text-xs text-zinc-500">
        {totalRows > 0 ? (
          <>
            <span className="font-medium text-zinc-700">
              {startRow.toLocaleString()}–{endRow.toLocaleString()}
            </span>{' '}
            of {totalRows.toLocaleString()}
          </>
        ) : (
          <span className="text-zinc-400">No results</span>
        )}
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={!canGoPrev}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors focus-ring ${
            canGoPrev
              ? 'text-zinc-700 hover:bg-zinc-200'
              : 'text-zinc-300 cursor-not-allowed'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </button>

        <span className="px-2 py-1 text-xs text-zinc-500">
          {totalPages > 0 ? pageIndex + 1 : 0} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={!canGoNext}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors focus-ring ${
            canGoNext
              ? 'text-zinc-700 hover:bg-zinc-200'
              : 'text-zinc-300 cursor-not-allowed'
          }`}
        >
          Next
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
