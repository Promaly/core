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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
  /** Optimistic-concurrency conflict — the row changed under us (spec §11). */
  get isConflict() {
    return this.status === 409 || this.status === 412;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  csrf?: boolean;
  workspaceId?: string;
  ifMatch?: number;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.csrf) headers.set('x-csrf-token', await getCsrfToken());
  if (options.workspaceId) headers.set('x-workspace-id', options.workspaceId);
  if (options.ifMatch !== undefined) headers.set('if-match', String(options.ifMatch));
  const init: RequestInit = { method: options.method ?? 'GET', headers, credentials: 'include' };
  if (options.signal) init.signal = options.signal;
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(detail.error ?? `Request failed (${response.status}).`, response.status);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export const authApi = {
  session: () => api<Session>('/v1/auth/me'),
  login: (email: string, password: string) =>
    api<Session>('/v1/auth/login', { method: 'POST', body: { email, password }, csrf: true }),
  register: (email: string, password: string, workspaceName: string) =>
    api<Session>('/v1/auth/register', {
      method: 'POST',
      body: { email, password, workspaceName },
      csrf: true,
    }),
  logout: () => api<void>('/v1/auth/logout', { method: 'POST', csrf: true }),
  requestReset: (email: string) =>
    api<void>('/v1/auth/password-reset', { method: 'POST', body: { email }, csrf: true }),
  confirmReset: (token: string, password: string) =>
    api<void>(`/v1/auth/password-reset/${token}`, {
      method: 'POST',
      body: { password },
      csrf: true,
    }),
  acceptInvite: (token: string, password: string) =>
    api<Session>(`/v1/invitations/${token}/accept`, {
      method: 'POST',
      body: { password },
      csrf: true,
    }),
  createWorkspace: (name: string) =>
    api<{ id: string; name: string; slug: string }>('/v1/workspaces', {
      method: 'POST',
      body: { name },
      csrf: true,
    }),
};

// --- Issue surface (S3/S4) -------------------------------------------------

export type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string;
  workflowId: string;
  status: string;
  icon: string | null;
  color: string | null;
  archivedAt: string | null;
};

export type WorkflowState = {
  id: string;
  workflowId: string;
  name: string;
  category: StateCategory;
  position: number;
  color: string;
};

export type Workflow = { id: string; name: string; isDefault: boolean; states: WorkflowState[] };

export type Label = { id: string; name: string; color: string; projectId: string | null };

export type Member = { accountId: string; email: string; role: string; joinedAt: string };

export type IssueLabelRef = { id: string; name: string; color: string };

export type Issue = {
  id: string;
  workspaceId: string;
  projectId: string;
  number: number;
  title: string;
  description: string;
  stateId: string;
  priority: number;
  assigneeId: string | null;
  parentIssueId: string | null;
  sortKey: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  labels: IssueLabelRef[];
};

export type SearchHit = {
  id: string;
  projectId: string;
  number: number;
  title: string;
  rank: number;
};

export type IssueListResult = {
  items: Issue[];
  nextCursor: string | null;
  groupCounts: Record<string, number>;
};

export type IssueListParams = {
  projectId?: string | undefined;
  stateId?: string[] | undefined;
  assigneeId?: string[] | undefined;
  labelId?: string[] | undefined;
  priority?: number[] | undefined;
  parentId?: string | undefined;
  q?: string | undefined;
  sort?: 'manual' | 'priority' | 'updated' | 'created' | undefined;
  groupBy?: 'state' | 'assignee' | 'priority' | 'label' | 'none' | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
};

export type IssuePatch = {
  title?: string;
  description?: string;
  stateId?: string;
  priority?: number;
  assigneeId?: string | null;
  parentIssueId?: string | null;
  labelIds?: string[];
};

export type BulkItem = {
  id: string;
  revision: number;
  stateId?: string;
  assigneeId?: string | null;
  priority?: number;
  labelIds?: string[];
};

export type BulkResult = { results: { id: string; ok: boolean; reason?: string }[] };

function qs(params: IssueListParams): string {
  const search = new URLSearchParams();
  const put = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  };
  put('projectId', params.projectId);
  put('stateId', params.stateId);
  put('assigneeId', params.assigneeId);
  put('labelId', params.labelId);
  put('priority', params.priority);
  put('parentId', params.parentId);
  put('q', params.q);
  put('sort', params.sort);
  put('groupBy', params.groupBy);
  put('cursor', params.cursor);
  put('limit', params.limit);
  const string = search.toString();
  return string ? `?${string}` : '';
}

/** Workspace-scoped API bound to one workspace id (sent as `X-Workspace-Id`). */
export function workspaceApi(workspaceId: string) {
  const scoped = <T>(path: string, options: Omit<RequestOptions, 'workspaceId'> = {}) =>
    api<T>(path, { ...options, workspaceId });

  return {
    listProjects: () => scoped<{ items: Project[] }>('/v1/projects'),
    createProject: (body: { key: string; name: string; description?: string }) =>
      scoped<Project>('/v1/projects', { method: 'POST', body, csrf: true }),
    listWorkflows: () => scoped<{ items: Workflow[] }>('/v1/workflows'),
    getWorkflow: (id: string) => scoped<Workflow>(`/v1/workflows/${id}`),
    listLabels: () => scoped<{ items: Label[] }>('/v1/labels'),
    listMembers: () => scoped<Member[]>('/v1/members'),

    listIssues: (params: IssueListParams, signal?: AbortSignal) =>
      scoped<IssueListResult>(`/v1/issues${qs(params)}`, signal ? { signal } : {}),
    getIssue: (id: string) => scoped<Issue>(`/v1/issues/${id}`),
    searchIssues: (q: string) =>
      scoped<SearchHit[]>(`/v1/search/issues?q=${encodeURIComponent(q)}`),
    listSubIssues: (id: string) => scoped<{ items: Issue[] }>(`/v1/issues/${id}/subissues`),

    createIssue: (body: { projectId: string; title: string } & IssuePatch) =>
      scoped<Issue>('/v1/issues', { method: 'POST', body, csrf: true }),
    updateIssue: (id: string, revision: number, patch: IssuePatch) =>
      scoped<Issue>(`/v1/issues/${id}`, {
        method: 'PATCH',
        body: patch,
        csrf: true,
        ifMatch: revision,
      }),
    moveIssue: (
      id: string,
      revision: number,
      destination: { beforeId?: string; afterId?: string; stateId?: string },
    ) =>
      scoped<Issue>(`/v1/issues/${id}/move`, {
        method: 'POST',
        body: destination,
        csrf: true,
        ifMatch: revision,
      }),
    bulkUpdate: (issues: BulkItem[]) =>
      scoped<BulkResult>('/v1/issues/bulk', { method: 'POST', body: { issues }, csrf: true }),
  };
}

export type WorkspaceApi = ReturnType<typeof workspaceApi>;
