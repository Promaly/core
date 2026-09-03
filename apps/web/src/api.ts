export type Session = {
  account: { id: string; email: string; createdAt: string };
  workspaces: { id: string; name: string; slug: string; role: string }[];
};

let csrfToken: string | undefined;

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch("/v1/auth/csrf", { credentials: "include" });
  if (!response.ok) throw new Error("Unable to start a secure session.");
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

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers();
  if (options.csrf) headers.set("x-csrf-token", await getCsrfToken());
  if (options.workspaceId) headers.set("x-workspace-id", options.workspaceId);
  if (options.ifMatch !== undefined)
    headers.set("if-match", String(options.ifMatch));
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
  };
  if (options.signal) init.signal = options.signal;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new ApiError(
      detail.error ?? `Request failed (${response.status}).`,
      response.status,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export const authApi = {
  session: () => api<Session>("/v1/auth/me"),
  login: (email: string, password: string) =>
    api<Session>("/v1/auth/login", {
      method: "POST",
      body: { email, password },
      csrf: true,
    }),
  register: (email: string, password: string, workspaceName: string) =>
    api<Session>("/v1/auth/register", {
      method: "POST",
      body: { email, password, workspaceName },
      csrf: true,
    }),
  logout: () => api<void>("/v1/auth/logout", { method: "POST", csrf: true }),
  requestReset: (email: string) =>
    api<void>("/v1/auth/password-reset", {
      method: "POST",
      body: { email },
      csrf: true,
    }),
  confirmReset: (token: string, password: string) =>
    api<void>(`/v1/auth/password-reset/${token}`, {
      method: "POST",
      body: { password },
      csrf: true,
    }),
  acceptInvite: (token: string, password: string) =>
    api<Session>(`/v1/invitations/${token}/accept`, {
      method: "POST",
      body: { password },
      csrf: true,
    }),
  createWorkspace: (name: string) =>
    api<{ id: string; name: string; slug: string }>("/v1/workspaces", {
      method: "POST",
      body: { name },
      csrf: true,
    }),
};

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type StateCategory =
  "backlog" | "unstarted" | "started" | "completed" | "cancelled";
export type CoreRole = "owner" | "admin" | "member" | "guest";

export type Page<T> = { items: T[]; nextCursor: string | null };

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type Workspace = { id: string; name: string; slug: string };

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string;
  workflowId: string;
  teamId: string | null;
  leadId: string | null;
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

export type Workflow = {
  id: string;
  name: string;
  isDefault: boolean;
  states: WorkflowState[];
};

export type Label = {
  id: string;
  name: string;
  color: string;
  projectId: string | null;
};

export type Member = {
  accountId: string;
  email: string;
  role: string;
  joinedAt: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type Team = {
  id: string;
  name: string;
  key: string;
  memberCount: number;
};

export type TeamMember = { accountId: string; email: string; joinedAt: string };

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
  dueAt: string | null;
  estimate: number | null;
  labels: IssueLabelRef[];
};

export type IssueRelation = {
  id: string;
  sourceIssueId: string;
  targetIssueId: string;
  type: "blocks" | "relates_to" | "duplicates";
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
  sort?: "manual" | "priority" | "updated" | "created" | undefined;
  groupBy?: "state" | "assignee" | "priority" | "label" | "none" | undefined;
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
  dueAt?: string | null;
  estimate?: number | null;
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

export type BulkResult = {
  results: { id: string; ok: boolean; reason?: string }[];
};

// Wave-A types (routes not yet implemented — shapes reserved for those screens)

export type Comment = {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  type: string;
  actorId: string;
  actorEmail: string;
  createdAt: string;
  data: Record<string, unknown>;
  commentId: string | null;
};

export type Notification = {
  id: string;
  type: string;
  actorId: string;
  issueId: string;
  commentId: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPreferences = {
  inApp: boolean;
  email: boolean;
  mentions: boolean;
  assignments: boolean;
  comments: boolean;
};

export type Attachment = {
  id: string;
  issueId: string | null;
  commentId: string | null;
  uploaderId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  createdAt: string;
};

export type SavedViewFilters = {
  stateId?: string[];
  assigneeId?: string[];
  labelId?: string[];
  priority?: number[];
  q?: string;
};

export type SavedView = {
  id: string;
  name: string;
  ownerId: string | null;
  filters: SavedViewFilters;
  groupBy: string | null;
  sort: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Query-string helper
// ---------------------------------------------------------------------------

function qs(params: IssueListParams): string {
  const search = new URLSearchParams();
  const put = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  };
  put("projectId", params.projectId);
  put("stateId", params.stateId);
  put("assigneeId", params.assigneeId);
  put("labelId", params.labelId);
  put("priority", params.priority);
  put("parentId", params.parentId);
  put("q", params.q);
  put("sort", params.sort);
  put("groupBy", params.groupBy);
  put("cursor", params.cursor);
  put("limit", params.limit);
  const string = search.toString();
  return string ? `?${string}` : "";
}

// ---------------------------------------------------------------------------
// Workspace-scoped API
// ---------------------------------------------------------------------------

/** Workspace-scoped API bound to one workspace id (sent as `X-Workspace-Id`). */
export function workspaceApi(workspaceId: string) {
  const scoped = <T>(
    path: string,
    options: Omit<RequestOptions, "workspaceId"> = {},
  ) => api<T>(path, { ...options, workspaceId });

  return {
    // --- Workspace settings -------------------------------------------------

    updateWorkspace: (patch: { name?: string; slug?: string }) =>
      scoped<Workspace>(`/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),
    deleteWorkspace: () =>
      scoped<void>(`/v1/workspaces/${workspaceId}`, {
        method: "DELETE",
        csrf: true,
      }),
    leaveWorkspace: () =>
      scoped<void>(`/v1/workspaces/${workspaceId}/leave`, {
        method: "POST",
        csrf: true,
      }),

    // --- Members ------------------------------------------------------------

    listMembers: () => scoped<Member[]>("/v1/members"),
    updateMemberRole: (accountId: string, role: CoreRole) =>
      scoped<void>(`/v1/members/${accountId}`, {
        method: "PATCH",
        body: { role },
        csrf: true,
      }),
    removeMember: (accountId: string) =>
      scoped<void>(`/v1/members/${accountId}`, {
        method: "DELETE",
        csrf: true,
      }),

    // --- Invitations --------------------------------------------------------

    listInvitations: () => scoped<Invitation[]>("/v1/invitations"),
    createInvitation: (email: string, role: Exclude<CoreRole, "owner">) =>
      scoped<Invitation>("/v1/invitations", {
        method: "POST",
        body: { email, role },
        csrf: true,
      }),
    revokeInvitation: (id: string) =>
      scoped<void>(`/v1/invitations/${id}`, { method: "DELETE", csrf: true }),

    // --- Teams --------------------------------------------------------------

    listTeams: (cursor?: string) =>
      scoped<Page<Team>>(`/v1/teams${cursor ? `?cursor=${cursor}` : ""}`),
    getTeam: (id: string) => scoped<Team>(`/v1/teams/${id}`),
    createTeam: (body: { name: string; key: string }) =>
      scoped<Team>("/v1/teams", { method: "POST", body, csrf: true }),
    updateTeam: (id: string, patch: { name?: string; key?: string }) =>
      scoped<Team>(`/v1/teams/${id}`, {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),
    deleteTeam: (id: string) =>
      scoped<void>(`/v1/teams/${id}`, { method: "DELETE", csrf: true }),
    listTeamMembers: (teamId: string) =>
      scoped<TeamMember[]>(`/v1/teams/${teamId}/members`),
    addTeamMember: (teamId: string, accountId: string) =>
      scoped<void>(`/v1/teams/${teamId}/members`, {
        method: "POST",
        body: { accountId },
        csrf: true,
      }),
    removeTeamMember: (teamId: string, accountId: string) =>
      scoped<void>(`/v1/teams/${teamId}/members/${accountId}`, {
        method: "DELETE",
        csrf: true,
      }),

    // --- Workflows & states -------------------------------------------------

    listWorkflows: () => scoped<{ items: Workflow[] }>("/v1/workflows"),
    getWorkflow: (id: string) => scoped<Workflow>(`/v1/workflows/${id}`),
    createWorkflow: (body: { name: string; isDefault?: boolean }) =>
      scoped<Workflow>("/v1/workflows", { method: "POST", body, csrf: true }),
    updateWorkflow: (
      id: string,
      patch: { name?: string; isDefault?: boolean },
    ) =>
      scoped<Workflow>(`/v1/workflows/${id}`, {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),
    createWorkflowState: (
      workflowId: string,
      body: { name: string; category: StateCategory; color: string },
    ) =>
      scoped<WorkflowState>(`/v1/workflows/${workflowId}/states`, {
        method: "POST",
        body,
        csrf: true,
      }),
    updateWorkflowState: (
      workflowId: string,
      stateId: string,
      patch: { name?: string; color?: string },
    ) =>
      scoped<WorkflowState>(`/v1/workflows/${workflowId}/states/${stateId}`, {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),
    deleteWorkflowState: (workflowId: string, stateId: string) =>
      scoped<void>(`/v1/workflows/${workflowId}/states/${stateId}`, {
        method: "DELETE",
        csrf: true,
      }),
    reorderWorkflowStates: (workflowId: string, stateIds: string[]) =>
      scoped<void>(`/v1/workflows/${workflowId}/states/reorder`, {
        method: "POST",
        body: { stateIds },
        csrf: true,
      }),

    // --- Labels -------------------------------------------------------------

    listLabels: () => scoped<{ items: Label[] }>("/v1/labels"),
    createLabel: (body: { name: string; color: string; projectId?: string }) =>
      scoped<Label>("/v1/labels", { method: "POST", body, csrf: true }),
    updateLabel: (id: string, patch: { name?: string; color?: string }) =>
      scoped<Label>(`/v1/labels/${id}`, {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),
    deleteLabel: (id: string) =>
      scoped<void>(`/v1/labels/${id}`, { method: "DELETE", csrf: true }),

    // --- Projects -----------------------------------------------------------

    listProjects: () => scoped<{ items: Project[] }>("/v1/projects"),
    createProject: (body: {
      key: string;
      name: string;
      description?: string;
      teamId?: string;
      leadId?: string;
      workflowId?: string;
      icon?: string;
      color?: string;
    }) => scoped<Project>("/v1/projects", { method: "POST", body, csrf: true }),
    updateProject: (
      id: string,
      patch: {
        name?: string;
        description?: string;
        teamId?: string | null;
        leadId?: string | null;
        workflowId?: string;
        icon?: string | null;
        color?: string | null;
      },
    ) =>
      scoped<Project>(`/v1/projects/${id}`, {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),
    archiveProject: (id: string) =>
      scoped<Project>(`/v1/projects/${id}/archive`, {
        method: "POST",
        csrf: true,
      }),
    unarchiveProject: (id: string) =>
      scoped<Project>(`/v1/projects/${id}/unarchive`, {
        method: "POST",
        csrf: true,
      }),

    // --- Issues -------------------------------------------------------------

    listIssues: (params: IssueListParams, signal?: AbortSignal) =>
      scoped<IssueListResult>(
        `/v1/issues${qs(params)}`,
        signal ? { signal } : {},
      ),
    getIssue: (id: string) => scoped<Issue>(`/v1/issues/${id}`),
    searchIssues: (q: string) =>
      scoped<SearchHit[]>(`/v1/search/issues?q=${encodeURIComponent(q)}`),
    listSubIssues: (id: string) =>
      scoped<{ items: Issue[] }>(`/v1/issues/${id}/subissues`),
    createIssue: (body: { projectId: string; title: string } & IssuePatch) =>
      scoped<Issue>("/v1/issues", { method: "POST", body, csrf: true }),
    updateIssue: (id: string, revision: number, patch: IssuePatch) =>
      scoped<Issue>(`/v1/issues/${id}`, {
        method: "PATCH",
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
        method: "POST",
        body: destination,
        csrf: true,
        ifMatch: revision,
      }),
    bulkUpdate: (issues: BulkItem[]) =>
      scoped<BulkResult>("/v1/issues/bulk", {
        method: "POST",
        body: { issues },
        csrf: true,
      }),

    // --- Relations ----------------------------------------------------------

    listRelations: (issueId: string) =>
      scoped<IssueRelation[]>(`/v1/issues/${issueId}/relations`),
    createRelation: (
      issueId: string,
      body: { targetIssueId: string; type: IssueRelation["type"] },
    ) =>
      scoped<IssueRelation>(`/v1/issues/${issueId}/relations`, {
        method: "POST",
        body,
        csrf: true,
      }),
    deleteRelation: (relationId: string) =>
      scoped<void>(`/v1/relations/${relationId}`, {
        method: "DELETE",
        csrf: true,
      }),

    // --- Comments (Wave A) --------------------------------------------------

    listComments: (issueId: string) =>
      scoped<{ items: Comment[] }>(`/v1/issues/${issueId}/comments`),
    createComment: (
      issueId: string,
      body: { body: string; mentionIds?: string[] },
    ) =>
      scoped<Comment>(`/v1/issues/${issueId}/comments`, {
        method: "POST",
        body,
        csrf: true,
      }),
    updateComment: (id: string, patch: { body: string }) =>
      scoped<Comment>(`/v1/comments/${id}`, {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),
    deleteComment: (id: string) =>
      scoped<void>(`/v1/comments/${id}`, { method: "DELETE", csrf: true }),

    // --- Timeline (Wave A) --------------------------------------------------

    listTimeline: (issueId: string, cursor?: string) =>
      scoped<Page<ActivityEvent>>(
        `/v1/issues/${issueId}/timeline${cursor ? `?cursor=${cursor}` : ""}`,
      ),

    // --- Notifications (Wave A) ---------------------------------------------

    listNotifications: (params?: {
      status?: "unread" | "read" | "all";
      cursor?: string;
    }) => {
      const search = new URLSearchParams();
      if (params?.status) search.set("status", params.status);
      if (params?.cursor) search.set("cursor", params.cursor);
      const q = search.toString();
      return scoped<Page<Notification>>(`/v1/notifications${q ? `?${q}` : ""}`);
    },
    getUnreadCount: () =>
      scoped<{ count: number }>("/v1/notifications/unread-count"),
    markNotificationRead: (id: string) =>
      scoped<void>(`/v1/notifications/${id}/read`, {
        method: "POST",
        csrf: true,
      }),
    markAllNotificationsRead: () =>
      scoped<void>("/v1/notifications/read-all", {
        method: "POST",
        csrf: true,
      }),
    getNotificationPreferences: () =>
      scoped<NotificationPreferences>("/v1/notification-preferences"),
    updateNotificationPreferences: (patch: Partial<NotificationPreferences>) =>
      scoped<NotificationPreferences>("/v1/notification-preferences", {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),

    // --- Attachments (Wave A) -----------------------------------------------

    listIssueAttachments: (issueId: string) =>
      scoped<{ items: Attachment[] }>(`/v1/issues/${issueId}/attachments`),
    listCommentAttachments: (commentId: string) =>
      scoped<{ items: Attachment[] }>(`/v1/comments/${commentId}/attachments`),
    attachmentDownloadUrl: (id: string) => `/v1/attachments/${id}/download`,
    deleteAttachment: (id: string) =>
      scoped<void>(`/v1/attachments/${id}`, { method: "DELETE", csrf: true }),

    // --- Saved views (Wave A) -----------------------------------------------

    listSavedViews: () => scoped<{ items: SavedView[] }>("/v1/saved-views"),
    createSavedView: (body: {
      name: string;
      scope: "personal" | "shared";
      filters: SavedViewFilters;
      groupBy?: string;
      sort?: string;
    }) =>
      scoped<SavedView>("/v1/saved-views", {
        method: "POST",
        body,
        csrf: true,
      }),
    updateSavedView: (
      id: string,
      patch: {
        name?: string;
        filters?: SavedViewFilters;
        groupBy?: string | null;
        sort?: string | null;
      },
    ) =>
      scoped<SavedView>(`/v1/saved-views/${id}`, {
        method: "PATCH",
        body: patch,
        csrf: true,
      }),
    deleteSavedView: (id: string) =>
      scoped<void>(`/v1/saved-views/${id}`, { method: "DELETE", csrf: true }),
  };
}

export type WorkspaceApi = ReturnType<typeof workspaceApi>;
