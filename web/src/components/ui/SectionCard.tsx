import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, subtitle, icon, badge, actions, children, className }: SectionCardProps) {
  return (
    <div className={`bg-white border border-zinc-200 rounded-lg p-5 ${className ?? ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            {icon}
            {title}
            {badge}
          </h2>
          {subtitle && (
            <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
