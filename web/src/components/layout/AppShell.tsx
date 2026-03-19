import type { ReactNode } from 'react';

interface AppShellProps {
  topNav?: ReactNode;
  contextBar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AppShell({ topNav, contextBar, children, footer }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      {topNav}
      {contextBar}
      <div className="flex-1">{children}</div>
      {footer}
    </div>
  );
}
