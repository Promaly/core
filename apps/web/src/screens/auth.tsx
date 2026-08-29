import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, Input, Label } from '@promaly/ui';
import { authApi } from '../api.js';
import { useSessionActions } from '../session.js';

function AuthShell({
  title,
  subtitle,
  onSubmit,
  error,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error?: string | undefined;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold tracking-tight">Promaly</div>
          <h1 className="mt-4 text-[19px] font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
        >
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
            >
              {error}
            </p>
          )}
          {children}
        </form>
        {footer && (
          <div className="mt-4 text-center text-[13px] text-muted-foreground">{footer}</div>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = 'text',
  ...rest
}: { label: string; name: string; type?: string } & Record<string, unknown>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} {...rest} />
    </div>
  );
}

function useSubmit(fallback: string) {
  const [error, setError] = useState<string>();
  const run = <T,>(action: Promise<T>, onDone: (value: T) => void) => {
    setError(undefined);
    void action.then(onDone).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : fallback);
    });
  };
  return { error, run };
}

export function Login() {
  const navigate = useNavigate();
  const session = useSessionActions();
  const { error, run } = useSubmit('Unable to log in.');
  return (
    <AuthShell
      title="Welcome back"
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        run(
          authApi.login(String(values.get('email')), String(values.get('password'))),
          (result) => {
            session.set(result);
            void navigate({ to: '/' });
          },
        );
      }}
      footer={
        <>
          Need an account?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />
      <Button type="submit" className="mt-1 w-full">
        Log in
      </Button>
      <Link to="/reset" className="text-center text-[13px] text-muted-foreground hover:underline">
        Forgot password?
      </Link>
    </AuthShell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const session = useSessionActions();
  const { error, run } = useSubmit('Unable to register.');
  return (
    <AuthShell
      title="Create your account"
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        run(
          authApi.register(
            String(values.get('email')),
            String(values.get('password')),
            String(values.get('workspaceName')),
          ),
          (result) => {
            session.set(result);
            void navigate({ to: '/' });
          },
        );
      }}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Field label="Work email" name="email" type="email" required autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        minLength={12}
        required
        autoComplete="new-password"
      />
      <Field label="Workspace name" name="workspaceName" minLength={2} required />
      <Button type="submit" className="mt-1 w-full">
        Create account
      </Button>
    </AuthShell>
  );
}

export function Reset() {
  const [sent, setSent] = useState(false);
  const { error, run } = useSubmit('Unable to request a reset.');
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const email = String(new FormData(event.currentTarget).get('email'));
        run(authApi.requestReset(email), () => setSent(true));
      }}
      footer={
        <Link to="/login" className="text-primary hover:underline">
          Back to login
        </Link>
      }
    >
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Button type="submit" className="mt-1 w-full">
        Send reset link
      </Button>
      {sent && (
        <p role="status" className="text-[13px] text-muted-foreground">
          If that account exists, a reset link is on its way.
        </p>
      )}
    </AuthShell>
  );
}

export function ResetConfirm() {
  const { token } = useParams({ strict: false }) as { token: string };
  const navigate = useNavigate();
  const { error, run } = useSubmit('Unable to reset password.');
  return (
    <AuthShell
      title="Choose a new password"
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get('password'));
        run(authApi.confirmReset(token, password), () => void navigate({ to: '/login' }));
      }}
    >
      <Field
        label="New password"
        name="password"
        type="password"
        minLength={12}
        required
        autoComplete="new-password"
      />
      <Button type="submit" className="mt-1 w-full">
        Reset password
      </Button>
    </AuthShell>
  );
}

export function Invite() {
  const { token } = useParams({ strict: false }) as { token: string };
  const navigate = useNavigate();
  const session = useSessionActions();
  const { error, run } = useSubmit('Unable to accept invite.');
  return (
    <AuthShell
      title="Join workspace"
      subtitle="Set a password to finish creating your account."
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get('password') ?? '');
        run(authApi.acceptInvite(token, password), (result) => {
          session.set(result);
          void navigate({ to: '/' });
        });
      }}
    >
      <Field
        label="Password"
        name="password"
        type="password"
        minLength={12}
        required
        autoComplete="new-password"
      />
      <Button type="submit" className="mt-1 w-full">
        Accept invite
      </Button>
    </AuthShell>
  );
}

export function Onboarding() {
  const navigate = useNavigate();
  const session = useSessionActions();
  const { error, run } = useSubmit('Unable to create workspace.');
  return (
    <AuthShell
      title="Create your workspace"
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get('name'));
        run(authApi.createWorkspace(name), () => {
          void session.invalidate();
          void navigate({ to: '/' });
        });
      }}
    >
      <Field label="Workspace name" name="name" required />
      <Button type="submit" className="mt-1 w-full">
        Create workspace
      </Button>
    </AuthShell>
  );
}
