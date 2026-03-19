import { formatP, formatNum, formatCI, formatHR } from '../../lib/formatters';

export function SignificanceBadge({ significant, threshold }: { significant: boolean; threshold: string }) {
  if (!significant) return null;
  return (
    <span
      title={threshold}
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 cursor-help"
    >
      Significant
    </span>
  );
}

export function CliffsDeltaBadge({
  delta,
  ciLower,
  ciUpper,
}: {
  delta: number | null;
  ciLower: number | null;
  ciUpper: number | null;
}) {
  if (delta == null) return <span className="text-zinc-500">N/A</span>;
  return (
    <span className="font-mono text-xs text-zinc-700">
      {formatNum(delta)} {formatCI(ciLower, ciUpper)}
    </span>
  );
}

export function PhBadge({ flag, phTestP }: { flag: string; phTestP?: number | null }) {
  const style =
    flag === 'pass' ? 'bg-green-50 text-green-700 border-green-200'
    : flag === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : flag === 'fail' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-zinc-50 text-zinc-500 border-zinc-200';
  const label =
    flag === 'pass' ? 'pass'
    : flag === 'warn' ? 'borderline'
    : flag === 'fail' ? 'violated'
    : 'unknown';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${style}`}>
      {label}
      {phTestP != null && <span className="ml-1 font-normal opacity-75">p={formatP(phTestP)}</span>}
    </span>
  );
}

export function HrBadge({ hr, lo, hi }: { hr: number | null; lo: number | null; hi: number | null }) {
  if (hr == null) return <span className="text-zinc-500">N/A</span>;
  return (
    <span className="font-mono text-xs text-zinc-700">
      {formatHR(hr)} [{formatHR(lo)}, {formatHR(hi)}]
    </span>
  );
}

export function PValueBadge({ p, label = 'p' }: { p: number | null; label?: string }) {
  if (p == null) return <span className="text-zinc-500">N/A</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-zinc-700">{formatP(p)}</span>
      {p < 0.05 && <SignificanceBadge significant={true} threshold={`${label} < 0.05`} />}
    </span>
  );
}
