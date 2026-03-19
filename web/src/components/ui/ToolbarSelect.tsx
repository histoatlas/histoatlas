interface ToolbarSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}

export function ToolbarSelect({ value, onChange, options, label }: ToolbarSelectProps) {
  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="text-sm font-medium text-zinc-900 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 cursor-pointer hover:border-zinc-300 transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
