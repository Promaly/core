import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router';
import { Command } from 'cmdk';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Badge, Button, Dialog, Input, Kbd } from '@promaly/ui';
import { authApi, type Session } from './api.js';

const navigation = [
  { to: '/', label: 'Projects' },
  { to: '/my-work', label: 'My work' },
  { to: '/search', label: 'Search' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/admin', label: 'Admin' },
] as const;
function Shell() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  );
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const publicRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset' ||
    pathname.startsWith('/reset/') ||
    pathname.startsWith('/invites/');
  useEffect(() => {
    if (publicRoute) return;
    void authApi
      .session()
      .then(setSession)
      .catch(() => {
        setSession(null);
        void navigate({ to: '/login' });
      });
  }, [navigate, publicRoute]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (!event.metaKey && !event.ctrlKey && event.key.toLowerCase() === 'c')
        void navigate({ to: '/projects/new' });
      if (!event.metaKey && !event.ctrlKey && event.key.toLowerCase() === 'g')
        void navigate({ to: '/' });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
  if (!publicRoute && session === undefined) return <main className="auth">Checking session…</main>;
  return (
    <div className="app-shell">
      <aside>
        <Link to="/" className="wordmark">
          Promaly
        </Link>
        <button className="workspace" aria-label="Switch workspace">
          {session?.workspaces[0]?.name ?? 'Workspace'} ⌄
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Button tone="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          Theme: {theme}
        </Button>
      </aside>
      <main>
        <header>
          <Button tone="secondary" onClick={() => setOpen(true)}>
            Search <Kbd>⌘K</Kbd>
          </Button>
          <Badge>Beta</Badge>
        </header>
        <Outlet />
      </main>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="palette" aria-label="Command palette">
            <Command>
              <Command.Input placeholder="Search commands…" />
              <Command.List>
                {navigation.map((item) => (
                  <Command.Item
                    key={item.to}
                    onSelect={() => {
                      void navigate({ to: item.to });
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div aria-live="polite" className="toast-host" />
    </div>
  );
}
function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      {children}
    </section>
  );
}
function Projects() {
  return (
    <Page title="Projects">
      <p>There are no projects in this workspace yet.</p>
      <Link to="/projects/new">
        <Button>
          Create project <Kbd>C</Kbd>
        </Button>
      </Link>
    </Page>
  );
}
function NewProject() {
  return (
    <Page title="Create project">
      <label>
        Name
        <Input aria-label="Project name" placeholder="Project name" />
      </label>
      <Button>Create project</Button>
    </Page>
  );
}
function AuthPage({
  title,
  children,
  onSubmit,
  error,
}: {
  title: string;
  children: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  error?: string | undefined;
}) {
  return (
    <main className="auth">
      <form onSubmit={onSubmit} noValidate>
        <h1>{title}</h1>
        {error && <p role="alert">{error}</p>}
        {children}
      </form>
    </main>
  );
}
function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  return (
    <AuthPage
      title="Welcome back"
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        void authApi
          .login(String(values.get('email')), String(values.get('password')))
          .then(() => navigate({ to: '/' }))
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : 'Unable to log in.'),
          );
      }}
      error={error}
    >
      <label>
        Email
        <Input name="email" type="email" required />
      </label>
      <label>
        Password
        <Input name="password" type="password" required />
      </label>
      <Button type="submit">Log in</Button>
      <Link to="/reset">Forgot password?</Link>
    </AuthPage>
  );
}
function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  return (
    <AuthPage
      title="Create your account"
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        void authApi
          .register(
            String(values.get('email')),
            String(values.get('password')),
            String(values.get('workspaceName')),
          )
          .then(() => navigate({ to: '/' }))
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : 'Unable to register.'),
          );
      }}
      error={error}
    >
      <label>
        Work email
        <Input name="email" type="email" required />
      </label>
      <label>
        Password
        <Input name="password" type="password" minLength={12} required />
      </label>
      <label>
        Workspace name
        <Input name="workspaceName" required minLength={2} />
      </label>
      <Button type="submit">Create account</Button>
      <Link to="/login">Log in</Link>
    </AuthPage>
  );
}
function Reset() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <AuthPage
      title="Reset your password"
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const email = String(new FormData(event.currentTarget).get('email'));
        void authApi
          .requestReset(email)
          .then(() => setSent(true))
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : 'Unable to request a reset.'),
          );
      }}
    >
      <label>
        Email
        <Input name="email" type="email" required />
      </label>
      <Button type="submit">Send reset link</Button>
      {sent && <p role="status">If that account exists, a reset link is on its way.</p>}
    </AuthPage>
  );
}
function Invite() {
  const { token } = useParams({ strict: false }) as { token: string };
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  return (
    <AuthPage
      title="Join workspace"
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get('password') ?? '');
        void authApi
          .acceptInvite(token, password)
          .then(() => navigate({ to: '/' }))
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : 'Unable to accept invite.'),
          );
      }}
    >
      <label>
        Password
        <Input name="password" type="password" minLength={12} />
      </label>
      <Button type="submit">Accept invite</Button>
    </AuthPage>
  );
}
function ResetConfirm() {
  const { token } = useParams({ strict: false }) as { token: string };
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  return (
    <AuthPage
      title="Choose a new password"
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get('password'));
        void authApi
          .confirmReset(token, password)
          .then(() => navigate({ to: '/login' }))
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : 'Unable to reset password.'),
          );
      }}
    >
      <label>
        New password
        <Input name="password" type="password" minLength={12} required />
      </label>
      <Button type="submit">Reset password</Button>
    </AuthPage>
  );
}
function Onboarding() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  return (
    <AuthPage
      title="Create your workspace"
      onSubmit={(event) => {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get('name'));
        void authApi
          .createWorkspace(name)
          .then(() => navigate({ to: '/' }))
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : 'Unable to create workspace.'),
          );
      }}
      error={error}
    >
      <label>
        Workspace name
        <Input name="name" required />
      </label>
      <Button type="submit">Create workspace</Button>
    </AuthPage>
  );
}
const rootRoute = createRootRoute({ component: Shell });
const routes = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: Projects }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/my-work',
    component: () => <Page title="My work" />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/search',
    component: () => <Page title="Search" />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/notifications',
    component: () => <Page title="Notifications" />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin',
    component: () => <Page title="Admin" />,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/projects/new', component: NewProject }),
  createRoute({ getParentRoute: () => rootRoute, path: '/login', component: Login }),
  createRoute({ getParentRoute: () => rootRoute, path: '/register', component: Register }),
  createRoute({ getParentRoute: () => rootRoute, path: '/reset', component: Reset }),
  createRoute({ getParentRoute: () => rootRoute, path: '/reset/$token', component: ResetConfirm }),
  createRoute({ getParentRoute: () => rootRoute, path: '/invites/$token', component: Invite }),
  createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', component: Onboarding }),
]);
export const router = createRouter({ routeTree: routes });
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
