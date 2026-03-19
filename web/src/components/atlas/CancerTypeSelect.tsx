import { useState, useRef, useEffect } from 'react';
import { CANCER_TYPE_COLORS } from '../../lib/colors';

interface CancerTypeSelectProps {
  allTypes: string[];
  selectedTypes: string[];
  counts: Map<string, number>;
  onChange: (types: string[]) => void;
}

export function CancerTypeSelect({
  allTypes,
  selectedTypes,
  counts,
  onChange,
}: CancerTypeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSet = new Set(selectedTypes);
  const allSelected = selectedTypes.length === allTypes.length;
  const noneSelected = selectedTypes.length === 0;

  const handleToggle = (type: string) => {
    if (selectedSet.has(type)) {
      onChange(selectedTypes.filter((t) => t !== type));
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    onChange([...allTypes]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const buttonLabel = noneSelected
    ? 'All cancer types'
    : selectedTypes.length === 1
      ? selectedTypes[0]
      : `${selectedTypes.length} types`;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm hover:border-zinc-400 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-zinc-700">{buttonLabel}</span>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header with actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 bg-zinc-50">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Cancer Types
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                disabled={allSelected}
                className="text-xs text-blue-600 hover:text-blue-700 disabled:text-zinc-400"
              >
                Select All
              </button>
              <span className="text-zinc-300">|</span>
              <button
                onClick={handleClearAll}
                disabled={noneSelected}
                className="text-xs text-blue-600 hover:text-blue-700 disabled:text-zinc-400"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Type list */}
          <div className="overflow-y-auto flex-1 py-1">
            {allTypes.map((type) => {
              const isSelected = selectedSet.has(type);
              const count = counts.get(type) || 0;
              const color = CANCER_TYPE_COLORS[type] || '#808080';

              return (
                <label
                  key={type}
                  className="flex items-center gap-3 px-3 py-1.5 hover:bg-zinc-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(type)}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-zinc-700 flex-1">{type}</span>
                  <span className="text-xs text-zinc-400">{count}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
