interface SegmentedOption {
  id: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5">
      {options.map((option) => (
        <button
          type="button"
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            value === option.id
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
