import { Icon } from '../ui/Icon';

interface StatsContextBannerProps {
  nTests: number;
  correctionMethod: string;
  nSignificant: number;
  onExportCsv: () => void;
  onExportSvg: () => void;
  showSvgExport: boolean;
}

function formatMethod(method: string): string {
  if (method === 'BH' || method === 'benjamini-hochberg') return 'Benjamini-Hochberg correction';
  if (method === 'bonferroni') return 'Bonferroni correction';
  return `${method} correction`;
}

export function StatsContextBanner({
  nTests,
  correctionMethod,
  nSignificant,
  onExportCsv,
  onExportSvg,
  showSvgExport,
}: StatsContextBannerProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5 text-sm text-zinc-600">
        <Icon name="database" size={14} className="text-zinc-400 shrink-0" />
        <span>
          {nTests} features tested
          <span className="text-zinc-300 mx-1.5">&middot;</span>
          {formatMethod(correctionMethod)}
          <span className="text-zinc-300 mx-1.5">&middot;</span>
          <span className={nSignificant > 0 ? 'font-medium text-zinc-900' : ''}>
            {nSignificant} significant
          </span>
          {' '}
          <span className="text-zinc-400">(&#945; = 0.05)</span>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onExportCsv}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors"
        >
          <Icon name="download" size={13} />
          CSV
        </button>
        {showSvgExport && (
          <button
            onClick={onExportSvg}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            <Icon name="download" size={13} />
            SVG
          </button>
        )}
      </div>
    </div>
  );
}
