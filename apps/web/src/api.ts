export type Session = {
  account: { id: string; email: string; createdAt: string };
  workspaces: { id: string; name: string; slug: string; role: string }[];
};

let csrfToken: string | undefined;

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/v1/auth/csrf', { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to start a secure session.');
  csrfToken = ((await response.json()) as { csrfToken: string }).csrfToken;
  return csrfToken;
}

export async function api<T>(path: string, init: RequestInit = {}, csrf = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (csrf) headers.set('x-csrf-token', await getCsrfToken());
  if (init.body) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status}).`);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export const authApi = {
  session: () => api<Session>('/v1/auth/me'),
  login: (email: string, password: string) =>
    api<Session>(
      '/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      true,
    ),
  register: (email: string, password: string, workspaceName: string) =>
    api<Session>(
      '/v1/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, workspaceName }) },
      true,
    ),
  logout: () => api<void>('/v1/auth/logout', { method: 'POST' }, true),
  requestReset: (email: string) =>
    api<void>('/v1/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) }, true),
  confirmReset: (token: string, password: string) =>
    api<void>(
      `/v1/auth/password-reset/${token}`,
      { method: 'POST', body: JSON.stringify({ password }) },
      true,
    ),
  acceptInvite: (token: string, password: string) =>
    api<Session>(
      `/v1/invitations/${token}/accept`,
      { method: 'POST', body: JSON.stringify({ password }) },
      true,
    ),
  createWorkspace: (name: string) =>
    api<{ id: string; name: string; slug: string }>(
      '/v1/workspaces',
      { method: 'POST', body: JSON.stringify({ name }) },
      true,
    ),
};
