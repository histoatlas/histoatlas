import { useState } from 'react';
import type { StatWarning, WarningSeverity } from '../../types/stats';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface AssumptionChecksProps {
  warnings: StatWarning[];
}

const SEVERITY_STYLES: Record<WarningSeverity, { bg: string; text: string; icon: IconName }> = {
  info: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'info' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'warning' },
  error: { bg: 'bg-red-50', text: 'text-red-700', icon: 'circle-x' },
};

export function AssumptionChecks({ warnings }: AssumptionChecksProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {warnings.map((w, i) => (
        <WarningRow key={`${w.type}-${i}`} warning={w} />
      ))}
    </div>
  );
}

function WarningRow({ warning }: { warning: StatWarning }) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLES[warning.severity];

  return (
    <div className={`${style.bg} rounded-md px-3 py-2`}>
      <button
        className={`flex items-center gap-2 w-full text-left text-xs ${style.text}`}
        onClick={() => warning.detail && setExpanded(!expanded)}
        disabled={!warning.detail}
      >
        <Icon name={style.icon} size={14} className="shrink-0" />
        <span className="flex-1">{warning.message}</span>
        {warning.detail && (
          <Icon
            name="chevron-right"
            size={12}
            className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        )}
      </button>
      {expanded && warning.detail && (
        <p className={`text-[11px] mt-1 ml-6 ${style.text} opacity-80`}>
          {warning.detail}
        </p>
      )}
    </div>
  );
}
