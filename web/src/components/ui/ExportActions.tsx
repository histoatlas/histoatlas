import { Icon } from './Icon';

interface ExportActionsProps {
  onExportCSV: () => void;
}

export function ExportActions({ onExportCSV }: ExportActionsProps) {
  return (
    <button
      onClick={onExportCSV}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
    >
      <Icon name="download" size={16} />
      Export
    </button>
  );
}
