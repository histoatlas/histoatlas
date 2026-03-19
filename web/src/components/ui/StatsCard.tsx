import type { StatSummary } from '../../types/stats';
import { formatP, formatNum, formatCI } from '../../lib/formatters';

interface StatsCardProps {
  summary: StatSummary | null;
  title?: string;
  className?: string;
}

export function StatsCard({ summary, title, className }: StatsCardProps) {
  if (!summary) {
    return (
      <div className={`bg-white border border-zinc-200 rounded-lg p-5 ${className ?? ''}`}>
        <p className="text-sm text-zinc-500 text-center py-6">
          Select a feature to view statistics
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-zinc-200 rounded-lg p-5 ${className ?? ''}`}>
      {title && (
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">{title}</h3>
      )}
      <dl className="space-y-2.5 text-xs">
        <Row label={summary.effectLabel} value={`${formatNum(summary.effect)} ${formatCI(summary.ci[0], summary.ci[1])}`} />
        {summary.p != null && <Row label="p-value (raw)" value={formatP(summary.p)} />}
        <Row label="p-value (adj)" value={formatP(summary.pAdj)} />
        <Row label="Correction" value={summary.nTests != null ? `${summary.correctionFamily} (${summary.nTests} tests)` : summary.correctionFamily} />
        {summary.ciMethod && <Row label="CI method" value={summary.ciMethod} />}
        <Row label="N" value={String(summary.n)} />
        {summary.nEvents != null && <Row label="N events" value={String(summary.nEvents)} />}
        {summary.model && <Row label="Model" value={summary.model} />}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
