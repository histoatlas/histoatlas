import { useState, useMemo, useCallback } from 'react';

interface CategoricalFilterProps {
  options: Array<{ value: string; count: number }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}

/**
 * Categorical filter with search, select all/none, and checkbox list.
 */
export function CategoricalFilter({
  options,
  selectedValues,
  onSelectionChange,
}: CategoricalFilterProps) {
  const [search, setSearch] = useState('');

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter((opt) => opt.value.toLowerCase().includes(term));
  }, [options, search]);

  // Check if no filtering is applied (all or none selected = no filter)
  const isFiltered = selectedValues.length > 0 && selectedValues.length < options.length;

  const handleToggle = useCallback(
    (value: string) => {
      if (selectedValues.includes(value)) {
        onSelectionChange(selectedValues.filter((v) => v !== value));
      } else {
        onSelectionChange([...selectedValues, value]);
      }
    },
    [selectedValues, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    const filteredValues = filteredOptions.map((opt) => opt.value);
    const newSelection = new Set([...selectedValues, ...filteredValues]);
    onSelectionChange(Array.from(newSelection));
  }, [filteredOptions, selectedValues, onSelectionChange]);

  const handleClearAll = useCallback(() => {
    if (search.trim()) {
      // Only clear filtered options
      const filteredValues = new Set(filteredOptions.map((opt) => opt.value));
      onSelectionChange(selectedValues.filter((v) => !filteredValues.has(v)));
    } else {
      onSelectionChange([]);
    }
  }, [search, filteredOptions, selectedValues, onSelectionChange]);

  return (
    <div className="p-3 space-y-2">
      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded focus-ring"
      />

      {/* Select all / Clear buttons */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={handleSelectAll}
          className="text-zinc-600 hover:text-zinc-900"
        >
          Select all
        </button>
        <span className="text-zinc-300">|</span>
        <button
          onClick={handleClearAll}
          className="text-zinc-600 hover:text-zinc-900"
        >
          Clear
        </button>
        {isFiltered && (
          <>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-500">
              {selectedValues.length} selected
            </span>
          </>
        )}
      </div>

      {/* Options list */}
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filteredOptions.map(({ value, count }) => {
          const isSelected = selectedValues.includes(value);
          return (
            <label
              key={value}
              className="flex items-center gap-2 px-1 py-1 rounded hover:bg-zinc-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(value)}
                className="w-4 h-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500"
              />
              <span className="flex-1 text-sm text-zinc-700 truncate">
                {value}
              </span>
              <span className="text-xs text-zinc-400">{count}</span>
            </label>
          );
        })}

        {filteredOptions.length === 0 && (
          <div className="text-sm text-zinc-400 py-2 text-center">
            No matches
          </div>
        )}
      </div>
    </div>
  );
}
