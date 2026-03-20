import { useMemo } from 'react';
import type { Slide } from '../../types';

interface DataTableBodyProps {
  slides: Slide[];
  featureNames: string[];
  selectedSlideIds: string[];
  hoveredId: string | null;
  onSelect: (id: string, event: React.MouseEvent) => void;
  onHover: (id: string | null) => void;
  onClick: (slideId: string) => void;
  /** Ref to sync horizontal scroll with header */
  scrollableRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Two-pane table body without virtualization.
 * Left pane: frozen columns (checkbox + slide ID)
 * Right pane: scrollable columns (cancer, cluster, immune, features)
 *
 * Horizontal scroll only applies to the right pane.
 * Vertical scroll is handled by the page (no internal scroll).
 */
export function DataTableBody({
  slides,
  featureNames,
  selectedSlideIds,
  hoveredId,
  onSelect,
  onHover,
  onClick,
  scrollableRef,
}: DataTableBodyProps) {
  const selectedSet = useMemo(() => new Set(selectedSlideIds), [selectedSlideIds]);

  return (
    <div className="flex">
      {/* Frozen pane - checkbox + slide ID */}
      <div className="flex-shrink-0 w-[17rem] border-r border-zinc-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
        {slides.map((slide) => {
          const isSelected = selectedSet.has(slide.id);
          const isHovered = hoveredId === slide.id;
          const rowBg = isHovered ? 'bg-blue-50' : isSelected ? 'bg-zinc-50' : 'bg-white';

          return (
            <div
              key={slide.id}
              className={`flex items-center h-9 border-b border-zinc-100 transition-colors cursor-pointer ${rowBg} ${
                !isHovered && !isSelected ? 'hover:bg-zinc-50' : ''
              }`}
              onMouseEnter={() => onHover(slide.id)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('input')) return;
                onClick(slide.id);
              }}
            >
              {/* Checkbox */}
              <div
                className="flex-shrink-0 w-10 px-2.5 py-2 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(slide.id, e);
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500"
                />
              </div>

              {/* Slide ID */}
              <div className="flex-shrink-0 w-60 px-3 py-2">
                <span className="text-xs font-mono text-zinc-900 truncate block">
                  {slide.id}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable pane - all other columns */}
      <div
        ref={scrollableRef}
        className="flex-1 overflow-x-auto"
      >
        <div style={{ minWidth: 'max-content' }}>
          {slides.map((slide) => {
            const isSelected = selectedSet.has(slide.id);
            const isHovered = hoveredId === slide.id;

            return (
              <div
                key={slide.id}
                className={`flex items-center h-9 border-b border-zinc-100 transition-colors cursor-pointer ${
                  isHovered ? 'bg-blue-50' : isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                }`}
                onMouseEnter={() => onHover(slide.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onClick(slide.id)}
              >
                {/* Cancer Type */}
                <div className="flex-shrink-0 w-36 px-3 py-2">
                  <span className="text-xs text-zinc-700 truncate block">
                    {slide.cancerType}
                  </span>
                </div>

                {/* Cluster */}
                <div className="flex-shrink-0 w-28 px-3 py-2">
                  <span className="text-xs text-zinc-700">{slide.clusterId ?? '-'}</span>
                </div>

                {/* Immune Subtype */}
                <div className="flex-shrink-0 w-36 px-3 py-2">
                  <span className="text-xs text-zinc-700">{slide.immuneSubtype ?? '-'}</span>
                </div>

                {/* Feature values */}
                {featureNames.map((featureName) => {
                  const value = slide.features[featureName];
                  return (
                    <div key={featureName} className="flex-shrink-0 w-40 px-3 py-2">
                      <span className="text-xs text-zinc-500 font-mono tabular-nums">
                        {value != null ? value.toFixed(2) : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
