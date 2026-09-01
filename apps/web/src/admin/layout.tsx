import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from '@promaly/ui';
import { RequireAdmin } from './require-admin.js';

type AdminSection = 'members' | 'teams' | 'workflows' | 'labels' | 'projects' | 'workspace';

const ADMIN_NAV: { section: AdminSection; label: string; to: string }[] = [
  { section: 'members', label: 'Members', to: '/admin/members' },
  { section: 'teams', label: 'Teams', to: '/admin/teams' },
  { section: 'workflows', label: 'Workflows', to: '/admin/workflows' },
  { section: 'labels', label: 'Labels', to: '/admin/labels' },
  { section: 'projects', label: 'Projects', to: '/admin/projects' },
  { section: 'workspace', label: 'Workspace', to: '/admin/workspace' },
];

export function AdminLayout({
  section,
  children,
}: {
  section: AdminSection;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <RequireAdmin>
      <div className="flex h-full min-h-0">
        <aside className="w-44 shrink-0 border-r border-border bg-secondary/30 p-3">
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-faint">
            Settings
          </p>
          <nav className="flex flex-col gap-0.5" aria-label="Admin">
            {ADMIN_NAV.map((item) => {
              const active = item.section === section || pathname === item.to;
              return (
                <Link
                  key={item.section}
                  to={item.to as never}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-[13px] transition-colors',
                    active
                      ? 'bg-secondary font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </RequireAdmin>
  );
}
