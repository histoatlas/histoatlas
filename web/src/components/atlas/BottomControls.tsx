import { useState, useRef, useEffect } from 'react';

export const CATEGORICAL_OPTIONS = [
  { value: 'cancerType', label: 'Cancer Type' },
  { value: 'clusterId', label: 'Cluster' },
  { value: 'immuneSubtype', label: 'Immune Subtype' },
];

interface BottomControlsProps {
  colorBy: string;
  onColorByChange: (colorBy: string) => void;
  options?: { value: string; label: string }[];
}

export function BottomControls({
  colorBy,
  onColorByChange,
  options = CATEGORICAL_OPTIONS,
}: BottomControlsProps) {
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

  // Get display label for current colorBy value
  const getLabel = (value: string) => {
    const option = options.find((o) => o.value === value);
    return option?.label ?? value;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
          Color by
        </span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded text-sm transition-colors focus-ring"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="text-zinc-700">{getLabel(colorBy)}</span>
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
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onColorByChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 transition-colors ${
                  colorBy === option.value
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
