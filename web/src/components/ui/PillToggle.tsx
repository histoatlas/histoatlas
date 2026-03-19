import type { ReactNode } from 'react';

interface PillOption {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface PillToggleProps {
  options: PillOption[];
  value: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
}

export function PillToggle({ options, value, onChange, size = 'md' }: PillToggleProps) {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-2.5 py-1'
    : 'text-sm px-3 py-1.5';

  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          type="button"
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`${sizeClasses} rounded-full transition-colors ${
            value === option.id
              ? 'bg-zinc-900 text-white border border-zinc-900'
              : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
          }${option.icon ? ' flex items-center gap-1.5' : ''}`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
