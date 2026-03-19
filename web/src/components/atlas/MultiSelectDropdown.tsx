import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';

interface MultiSelectDropdownProps {
  label: string;
  icon: IconName;
  allOptions: string[];
  selectedOptions: string[];
  displayNames?: Record<string, string>;
  counts?: Map<string, number>;
  onChange: (selected: string[]) => void;
}

export function MultiSelectDropdown({
  label,
  icon,
  allOptions,
  selectedOptions,
  displayNames,
  counts,
  onChange,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useRef(
    `multiselect-panel-${label.replace(/\s+/g, '-').toLowerCase()}`
  ).current;

  // Close on outside click
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

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const selectedSet = useMemo(
    () => new Set(selectedOptions),
    [selectedOptions]
  );

  const allSelected = useMemo(() => {
    if (selectedOptions.length !== allOptions.length) return false;
    const optionSet = new Set(allOptions);
    return selectedOptions.every((opt) => optionSet.has(opt));
  }, [selectedOptions, allOptions]);

  const noneSelected = selectedOptions.length === 0;

  const handleToggle = useCallback(
    (option: string) => {
      if (selectedSet.has(option)) {
        onChange(selectedOptions.filter((o) => o !== option));
      } else {
        onChange([...selectedOptions, option]);
      }
    },
    [selectedSet, selectedOptions, onChange]
  );

  const getDisplayName = (option: string) => displayNames?.[option] ?? option;

  const buttonLabel = noneSelected
    ? label
    : selectedOptions.length === 1
      ? getDisplayName(selectedOptions[0])
      : `${selectedOptions.length} selected`;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? panelId : undefined}
        className="flex items-center gap-2 px-3 h-9 bg-white border border-zinc-200 rounded-lg text-sm hover:border-zinc-300 transition-colors"
      >
        <Icon name={icon} size={14} className="text-zinc-400" />
        <span className="text-zinc-700">{buttonLabel}</span>
        {!noneSelected && (
          <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
            {selectedOptions.length}
          </span>
        )}
        <Icon
          name="chevron-down"
          size={14}
          className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute top-full left-0 mt-1 w-72 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-72 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 bg-zinc-50">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {label}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onChange([...allOptions])}
                disabled={allSelected}
                className="text-xs text-blue-600 hover:text-blue-700 disabled:text-zinc-400"
              >
                Select All
              </button>
              <span className="text-zinc-300">|</span>
              <button
                onClick={() => onChange([])}
                disabled={noneSelected}
                className="text-xs text-blue-600 hover:text-blue-700 disabled:text-zinc-400"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1 py-1">
            {allOptions.map((option) => {
              const isSelected = selectedSet.has(option);
              const count = counts?.get(option);

              return (
                <label
                  key={option}
                  className="flex items-center gap-3 px-3 py-1.5 hover:bg-zinc-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(option)}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-zinc-700 flex-1">
                    {getDisplayName(option)}
                  </span>
                  {count !== undefined && (
                    <span className="text-xs text-zinc-400">{count}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
