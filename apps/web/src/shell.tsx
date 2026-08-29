import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Skeleton,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@promaly/ui';
import {
  Bell,
  ChevronsUpDown,
  FolderKanban,
  PanelLeft,
  Plus,
  Search as SearchIcon,
  SquareUser,
} from 'lucide-react';
import { authApi } from './api.js';
import { CommandPalette, useCommandPalette } from './command-palette.js';
import { useProjects } from './issues/data.js';
import { useSession, useSessionActions } from './session.js';

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/reset',
  '/invites',
  '/onboarding',
  ...(import.meta.env.DEV ? ['/kitchen-sink'] : []),
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const NAV = [
  { to: '/', label: 'Projects', icon: FolderKanban, exact: true },
  { to: '/my-work', label: 'My work', icon: SquareUser },
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/notifications', label: 'Notifications', icon: Bell },
] as const;

export function Shell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const palette = useCommandPalette();
  const publicRoute = isPublic(pathname);
  const { data: session, isPending } = useSession();
  const [railCollapsed, setRailCollapsed] = useState(false);

  useEffect(() => {
    if (!publicRoute && session === null) void navigate({ to: '/login' });
  }, [publicRoute, session, navigate]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '[') setRailCollapsed((value) => !value);
      if (event.key.toLowerCase() === 'c') void navigate({ to: '/projects/new' });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  if (publicRoute) {
    return (
      <>
        <Outlet />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (isPending || !session) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  const workspace = session.workspaces[0];
  const canAdmin = workspace?.role === 'owner' || workspace?.role === 'admin';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid h-full grid-cols-[auto_minmax(0,1fr)]">
        <Sidebar
          collapsed={railCollapsed}
          onToggle={() => setRailCollapsed((value) => !value)}
          workspaceName={workspace?.name ?? 'Workspace'}
          email={session.account.email}
          canAdmin={canAdmin}
          pathname={pathname}
        />
        <div className="flex min-w-0 flex-col">
          <Topbar
            title={NAV.find((item) => matches(item, pathname))?.label ?? titleFromPath(pathname)}
            onOpenPalette={() => palette.setOpen(true)}
          />
          <main className="min-h-0 flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}

function matches(item: { to: string; exact?: boolean }, pathname: string) {
  return item.exact ? pathname === item.to : pathname.startsWith(item.to);
}

function titleFromPath(pathname: string) {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return 'Projects';
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

function Sidebar({
  collapsed,
  onToggle,
  workspaceName,
  email,
  canAdmin,
  pathname,
}: {
  collapsed: boolean;
  onToggle: () => void;
  workspaceName: string;
  email: string;
  canAdmin: boolean;
  pathname: string;
}) {
  const nav = canAdmin
    ? [...NAV, { to: '/admin', label: 'Admin', icon: SquareUser } as const]
    : NAV;

  return (
    <aside
      className={cn(
        'flex flex-col gap-1 border-r border-border bg-secondary/40 p-2 transition-[width] duration-[var(--dur-panel)]',
        collapsed ? 'w-12' : 'w-60',
      )}
    >
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium hover:bg-secondary',
                collapsed && 'justify-center px-0',
              )}
            >
              <Avatar className="size-5 shrink-0">
                <AvatarFallback>{workspaceName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <span className="truncate">{workspaceName}</span>
                  <ChevronsUpDown className="ml-auto size-3.5 shrink-0 opacity-50" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{email}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link to="/onboarding">Create workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <SignOutItem />
          </DropdownMenuContent>
        </DropdownMenu>
        {!collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Collapse sidebar" onClick={onToggle}>
                <PanelLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Toggle sidebar <Kbd>[</Kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <nav aria-label="Primary" className="mt-1 flex flex-col gap-0.5">
        {nav.map((item) => {
          const active = matches(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && <SidebarProjects pathname={pathname} />}

      <div className="mt-auto">
        {collapsed && (
          <Button variant="ghost" size="icon" aria-label="Expand sidebar" onClick={onToggle}>
            <PanelLeft className="size-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}

function SidebarProjects({ pathname }: { pathname: string }) {
  const projects = useProjects();
  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">Projects</span>
        <Link
          to="/projects/new"
          aria-label="New project"
          className="text-faint hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </Link>
      </div>
      <div className="flex flex-col gap-0.5 overflow-y-auto">
        {projects.data?.length ? (
          projects.data.map((project) => {
            const to = `/projects/${project.key}`;
            const active = pathname.startsWith(to);
            return (
              <Link
                key={project.id}
                to="/projects/$projectKey"
                params={{ projectKey: project.key }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]',
                  active
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <span
                  className="flex size-4 shrink-0 items-center justify-center rounded text-[9px] font-semibold text-primary-foreground"
                  style={{ background: project.color ?? 'var(--primary)' }}
                >
                  {project.key.slice(0, 1)}
                </span>
                <span className="truncate">{project.name}</span>
              </Link>
            );
          })
        ) : (
          <p className="px-2 py-1 text-[13px] text-faint">
            {projects.isPending ? 'Loading…' : 'No projects yet.'}
          </p>
        )}
      </div>
    </div>
  );
}

function SignOutItem() {
  const navigate = useNavigate();
  const session = useSessionActions();
  return (
    <DropdownMenuItem
      onSelect={() => {
        void authApi.logout().finally(() => {
          session.set(null);
          void navigate({ to: '/login' });
        });
      }}
    >
      Sign out
    </DropdownMenuItem>
  );
}

function Topbar({ title, onOpenPalette }: { title: string; onOpenPalette: () => void }) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
      <h1 className="truncate text-[13px] font-medium">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onOpenPalette} className="gap-2">
          <SearchIcon className="size-3.5" />
          <span className="text-muted-foreground">Search</span>
          <Kbd>⌘K</Kbd>
        </Button>
      </div>
    </header>
  );
}

/** Skeleton row block reused by list screens while data loads. */
export function LoadingRows({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}
