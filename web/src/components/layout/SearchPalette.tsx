import { useEffect, useRef } from 'react';
import type { GlobalSearch, SearchResult } from '../../hooks/useGlobalSearch';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';

interface SearchPaletteProps {
  search: GlobalSearch;
}

const TYPE_ICON: Record<SearchResult['type'], IconName> = {
  cohort: 'database',
  cluster: 'layers',
  slide: 'image',
  feature: 'bar-chart',
};

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  cohort: 'Cohorts',
  cluster: 'Clusters',
  slide: 'Slides',
  feature: 'Features',
};

const SECTION_ORDER: SearchResult['type'][] = ['cohort', 'cluster', 'slide', 'feature'];

export function SearchPalette({ search }: SearchPaletteProps) {
  const {
    query,
    setQuery,
    setIsOpen,
    groupedResults,
    flatResults,
    activeIndex,
    setActiveIndex,
    navigateUp,
    navigateDown,
    selectActive,
    selectResult,
    inputRef,
  } = search;

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when palette opens
  useEffect(() => {
    // Small delay to ensure the element is mounted
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, [inputRef]);

  // Lock body scroll while palette is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector('[data-active="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateDown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateUp();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectActive();
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
      setQuery('');
    }
  }

  // Build flat index offset per section
  let flatOffset = 0;
  const sectionOffsets: Record<string, number> = {};
  for (const type of SECTION_ORDER) {
    const key = type === 'cohort' ? 'cohorts' : type === 'cluster' ? 'clusters' : type === 'slide' ? 'slides' : 'features';
    sectionOffsets[type] = flatOffset;
    flatOffset += groupedResults[key].length;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="w-full max-w-xl bg-zinc-900 rounded-xl shadow-2xl border border-zinc-700/50 overflow-hidden animate-scale-in"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-zinc-700/50">
          <Icon name="search" size={16} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cohorts, slides, clusters, features..."
            aria-label="Search cohorts, slides, clusters"
            className="flex-1 h-12 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">Search across all cohorts, slides, clusters, and features</p>
              <p className="text-xs text-zinc-600 mt-2">
                Tip: press <kbd className="font-mono bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5">/</kbd> to open search from anywhere
              </p>
            </div>
          ) : flatResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No results for &lsquo;{query}&rsquo;
            </div>
          ) : (
            SECTION_ORDER.map((type) => {
              const key = type === 'cohort' ? 'cohorts' : type === 'cluster' ? 'clusters' : type === 'slide' ? 'slides' : 'features';
              const items = groupedResults[key];
              if (items.length === 0) return null;
              const offset = sectionOffsets[type];

              return (
                <div key={type}>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500 px-4 pt-3 pb-1.5 font-medium">
                    {TYPE_LABEL[type]}
                  </div>
                  {items.map((result, i) => {
                    const flatIdx = offset + i;
                    const isActive = flatIdx === activeIndex;
                    return (
                      <button
                        key={result.id}
                        data-active={isActive}
                        onClick={() => {
                          window.posthog?.capture('search_result_selected', {
                            result_type: result.type,
                            result_label: result.label,
                            query,
                          });
                          selectResult(result);
                        }}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${
                          isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                        }`}
                      >
                        <Icon
                          name={TYPE_ICON[result.type]}
                          size={16}
                          className="text-zinc-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-zinc-200 truncate block">
                            {result.label}
                          </span>
                          {result.sublabel && (
                            <span className="text-xs text-zinc-500 truncate block">
                              {result.sublabel}
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <span className="text-xs text-zinc-500 shrink-0">
                            Jump to
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-700/50 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
