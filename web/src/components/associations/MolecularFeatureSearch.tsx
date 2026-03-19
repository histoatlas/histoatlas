import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '../ui/Icon';
import { useMolecularFeatureList } from '../../hooks/useAssociations';

interface MolecularFeatureSearchProps {
  dataset?: string;
  cohort: string;
  molecularType: string;
  value: string;
  onChange: (feature: string) => void;
}

const MAX_RESULTS = 50;

export function MolecularFeatureSearch({
  dataset = 'tcga',
  cohort,
  molecularType,
  value,
  onChange,
}: MolecularFeatureSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useMolecularFeatureList(dataset, cohort, molecularType);
  const allFeatures = data?.features ?? [];

  const filtered = useMemo(() => {
    if (!query) return allFeatures.slice(0, MAX_RESULTS);
    const lower = query.toLowerCase();
    const matches: string[] = [];
    for (const f of allFeatures) {
      if (f.toLowerCase().includes(lower)) {
        matches.push(f);
        if (matches.length >= MAX_RESULTS) break;
      }
    }
    return matches;
  }, [allFeatures, query]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  const select = useCallback(
    (feature: string) => {
      onChange(feature);
      setQuery('');
      setIsOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setHighlightIndex((i) => Math.max(i - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (filtered[highlightIndex]) select(filtered[highlightIndex]);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [isOpen, filtered, highlightIndex, select],
  );

  const displayValue = value || '';

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Icon
          name="search"
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search genes..."
          className="w-56 text-sm text-zinc-700 bg-white border border-zinc-200 rounded-md pl-8 pr-2.5 py-1 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none transition-colors"
        />
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-30 mt-1 w-56 max-h-60 overflow-y-auto bg-white border border-zinc-200 rounded-md py-1"
        >
          {isLoading && (
            <li className="px-3 py-2 text-xs text-zinc-400">Loading...</li>
          )}
          {!isLoading && filtered.length === 0 && (
            <li className="px-3 py-2 text-xs text-zinc-400">
              {query ? 'No matches' : 'No features available'}
            </li>
          )}
          {filtered.map((f, i) => (
            <li
              key={f}
              onMouseDown={(e) => {
                e.preventDefault();
                select(f);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`px-3 py-1.5 text-sm cursor-pointer ${
                i === highlightIndex
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-700 hover:bg-zinc-50'
              } ${f === value ? 'font-medium' : ''}`}
            >
              {f}
            </li>
          ))}
          {!isLoading && filtered.length === MAX_RESULTS && (
            <li className="px-3 py-1.5 text-xs text-zinc-400 border-t border-zinc-100">
              Type to narrow results...
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
