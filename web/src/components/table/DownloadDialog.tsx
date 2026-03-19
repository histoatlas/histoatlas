import { useState, useCallback } from 'react';
import {
  useFloating,
  useClick,
  useDismiss,
  useInteractions,
  FloatingOverlay,
  FloatingFocusManager,
} from '@floating-ui/react';
import type { Slide } from '../../types';

interface DownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filteredSlides: Slide[];
  selectedSlideIds: string[];
  featureNames: string[];
}

type DownloadScope = 'selected' | 'filtered';
type DownloadColumns = 'all' | 'metadata';

/**
 * Dialog for configuring and triggering CSV download.
 */
export function DownloadDialog({
  isOpen,
  onClose,
  filteredSlides,
  selectedSlideIds,
  featureNames,
}: DownloadDialogProps) {
  const [scope, setScope] = useState<DownloadScope>('filtered');
  const [columns, setColumns] = useState<DownloadColumns>('all');

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => !open && onClose(),
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, { outsidePressEvent: 'mousedown' });
  const { getFloatingProps } = useInteractions([click, dismiss]);

  const hasSelection = selectedSlideIds.length > 0;

  const handleDownload = useCallback(() => {
    // Determine slides to export
    const slidesToExport =
      scope === 'selected' && hasSelection
        ? filteredSlides.filter((s) => selectedSlideIds.includes(s.id))
        : filteredSlides;

    // Build CSV header
    const metadataColumns = ['id', 'cancerType', 'clusterId', 'immuneSubtype', 'x', 'y'];
    const allColumns =
      columns === 'all' ? [...metadataColumns, ...featureNames] : metadataColumns;

    // Statistical metadata header
    const metadataHeader = [
      `# HistoAtlas Export`,
      `# Date: ${new Date().toISOString()}`,
      `# Rows: ${slidesToExport.length}`,
      `# UMAP: n_neighbors=15, min_dist=0.1, metric=euclidean`,
      `# Clustering: K-means, bootstrap stability`,
      `# Features: z-scored histomic measurements`,
    ];

    // Build CSV content
    const header = allColumns.join(',');
    const rows = slidesToExport.map((slide) => {
      return allColumns
        .map((col) => {
          if (col === 'id') return slide.id;
          if (col === 'cancerType') return slide.cancerType;
          if (col === 'clusterId') return slide.clusterId ?? '';
          if (col === 'immuneSubtype') return slide.immuneSubtype ?? '';
          if (col === 'x') return slide.x.toString();
          if (col === 'y') return slide.y.toString();
          return (slide.features[col] ?? '').toString();
        })
        .join(',');
    });

    const csv = [...metadataHeader, header, ...rows].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slides_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    onClose();
  }, [scope, columns, filteredSlides, selectedSlideIds, featureNames, hasSelection, onClose]);

  if (!isOpen) return null;

  return (
    <FloatingOverlay
      lockScroll
      className="z-50 bg-black/20 flex items-center justify-center"
    >
      <FloatingFocusManager context={context}>
        <div
          ref={refs.setFloating}
          {...getFloatingProps()}
          className="w-96 bg-white rounded-lg shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
            <h2 className="text-base font-medium text-zinc-900">Download Data</h2>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded focus-ring"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Scope selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700">
                Rows to include
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 p-2 rounded hover:bg-zinc-50 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'filtered'}
                    onChange={() => setScope('filtered')}
                    className="text-zinc-600 focus:ring-zinc-500"
                  />
                  <span className="text-sm text-zinc-700">
                    All filtered rows ({filteredSlides.length.toLocaleString()})
                  </span>
                </label>
                <label
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                    hasSelection ? 'hover:bg-zinc-50' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'selected'}
                    onChange={() => setScope('selected')}
                    disabled={!hasSelection}
                    className="text-zinc-600 focus:ring-zinc-500"
                  />
                  <span className="text-sm text-zinc-700">
                    Selected rows only ({selectedSlideIds.length.toLocaleString()})
                  </span>
                </label>
              </div>
            </div>

            {/* Columns selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700">
                Columns to include
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 p-2 rounded hover:bg-zinc-50 cursor-pointer">
                  <input
                    type="radio"
                    name="columns"
                    checked={columns === 'all'}
                    onChange={() => setColumns('all')}
                    className="text-zinc-600 focus:ring-zinc-500"
                  />
                  <span className="text-sm text-zinc-700">
                    All columns (metadata + {featureNames.length} features)
                  </span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded hover:bg-zinc-50 cursor-pointer">
                  <input
                    type="radio"
                    name="columns"
                    checked={columns === 'metadata'}
                    onChange={() => setColumns('metadata')}
                    className="text-zinc-600 focus:ring-zinc-500"
                  />
                  <span className="text-sm text-zinc-700">Metadata only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 bg-zinc-50 rounded-b-lg">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 rounded focus-ring"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded focus-ring"
            >
              Download CSV
            </button>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingOverlay>
  );
}
