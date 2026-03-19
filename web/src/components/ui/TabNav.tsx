import type { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string | null;
  href?: string;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <div>
      <nav className="max-w-7xl mx-auto px-6 flex gap-6" aria-label="Tabs" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const className = `relative py-3 text-sm cursor-pointer transition-colors ${
            isActive
              ? 'text-zinc-900 font-medium'
              : 'text-zinc-500 hover:text-zinc-700'
          }`;
          const content = (
            <>
              <span className="flex items-center gap-2">
                {tab.icon}
                {tab.label}
                {tab.badge != null && (
                  <span className="bg-zinc-100 text-zinc-600 text-xs rounded-full px-2 py-0.5">
                    {typeof tab.badge === 'number'
                      ? tab.badge.toLocaleString()
                      : tab.badge}
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </>
          );

          if (tab.href) {
            return (
              <a key={tab.id} href={tab.href} className={className} role="tab" aria-selected={isActive}>
                {content}
              </a>
            );
          }

          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={className}
              role="tab"
              aria-selected={isActive}
            >
              {content}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
