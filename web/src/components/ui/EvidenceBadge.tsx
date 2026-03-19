import type { EvidenceStrengthBadge } from '../../types';

const BADGE_STYLES: Record<EvidenceStrengthBadge, string> = {
  strong: 'bg-green-50 text-green-700 border border-green-200',
  moderate: 'bg-amber-50 text-amber-700 border border-amber-200',
  suggestive: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
  insufficient: 'bg-zinc-50 text-zinc-400 border border-zinc-200',
};

const BADGE_LABELS: Record<EvidenceStrengthBadge, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  suggestive: 'Suggestive',
  insufficient: 'Insufficient',
};

interface EvidenceBadgeProps {
  badge: EvidenceStrengthBadge;
}

export function EvidenceBadge({ badge }: EvidenceBadgeProps) {
  return (
    <span
      title="Evidence criteria: Strong = p_adj < 0.01 + effect ≥ medium threshold + narrow CI + n ≥ 100; Moderate = p_adj < 0.05 + effect ≥ small threshold + narrow/moderate CI + n ≥ 50; Suggestive = p_adj < 0.10 or CI excludes null; Insufficient = n < 30 or missing"
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-help ${BADGE_STYLES[badge] ?? BADGE_STYLES.insufficient}`}
    >
      {BADGE_LABELS[badge] ?? badge}
    </span>
  );
}
