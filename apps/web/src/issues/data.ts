import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  workspaceApi,
  type Issue,
  type IssueListParams,
  type IssueListResult,
  type IssuePatch,
  type SavedViewFilters,
  type WorkspaceApi,
} from '../api.js';
import { useSession } from '../session.js';

/** The active workspace id — the first (and, in Phase 1, only) membership. */
export function useWorkspaceId(): string | undefined {
  const { data: session } = useSession();
  return session?.workspaces[0]?.id;
}

export function useWorkspaceApi(): WorkspaceApi | undefined {
  const workspaceId = useWorkspaceId();
  return useMemo(() => (workspaceId ? workspaceApi(workspaceId) : undefined), [workspaceId]);
}

const key = {
  projects: (ws: string) => ['ws', ws, 'projects'] as const,
  workflows: (ws: string) => ['ws', ws, 'workflows'] as const,
  labels: (ws: string) => ['ws', ws, 'labels'] as const,
  members: (ws: string) => ['ws', ws, 'members'] as const,
  issues: (ws: string, params: IssueListParams) => ['ws', ws, 'issues', params] as const,
  issue: (ws: string, id: string) => ['ws', ws, 'issue', id] as const,
  subIssues: (ws: string, id: string) => ['ws', ws, 'issue', id, 'sub'] as const,
  search: (ws: string, q: string) => ['ws', ws, 'search', q] as const,
  savedViews: (ws: string) => ['ws', ws, 'saved-views'] as const,
};

export function useProjects() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.projects(ws ?? ''),
    queryFn: () => client!.listProjects().then((r) => r.items),
    enabled: Boolean(client),
    staleTime: 60_000,
  });
}

export function useWorkflows() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.workflows(ws ?? ''),
    queryFn: () => client!.listWorkflows().then((r) => r.items),
    enabled: Boolean(client),
    staleTime: 60_000,
  });
}

export function useLabels() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.labels(ws ?? ''),
    queryFn: () => client!.listLabels().then((r) => r.items),
    enabled: Boolean(client),
    staleTime: 60_000,
  });
}

export function useMembers() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.members(ws ?? ''),
    queryFn: () => client!.listMembers(),
    enabled: Boolean(client),
    staleTime: 60_000,
  });
}

export function useIssues(params: IssueListParams) {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.issues(ws ?? '', params),
    queryFn: ({ signal }) => client!.listIssues(params, signal),
    enabled:
      Boolean(client) &&
      (params.projectId !== undefined || params.q !== undefined || 'assigneeId' in params),
    placeholderData: (previous) => previous,
  });
}

export function useIssue(id: string | undefined) {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.issue(ws ?? '', id ?? ''),
    queryFn: () => client!.getIssue(id!),
    enabled: Boolean(client) && Boolean(id),
  });
}

export function useSubIssues(id: string | undefined) {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.subIssues(ws ?? '', id ?? ''),
    queryFn: () => client!.listSubIssues(id!).then((r) => r.items),
    enabled: Boolean(client) && Boolean(id),
  });
}

export function useIssueSearch(q: string) {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.search(ws ?? '', q),
    queryFn: () => client!.searchIssues(q),
    enabled: Boolean(client) && q.trim().length > 1,
  });
}

/** Patch every cached issue-list and detail entry that holds this issue. */
function writeIssue(queryClient: QueryClient, ws: string, next: Issue) {
  queryClient.setQueryData(key.issue(ws, next.id), next);
  queryClient.setQueriesData<IssueListResult>({ queryKey: ['ws', ws, 'issues'] }, (current) =>
    current
      ? { ...current, items: current.items.map((issue) => (issue.id === next.id ? next : issue)) }
      : current,
  );
}

export function useUpdateIssue() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issue, patch }: { issue: Issue; patch: IssuePatch }) =>
      client!.updateIssue(issue.id, issue.revision, patch),
    onMutate: async ({ issue, patch }) => {
      await queryClient.cancelQueries({ queryKey: key.issue(ws, issue.id) });
      const previous = queryClient.getQueryData<Issue>(key.issue(ws, issue.id));
      writeIssue(queryClient, ws, { ...issue, ...patch, labels: issue.labels });
      return { previous, issue };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) writeIssue(queryClient, ws, context.previous);
    },
    onSuccess: (server) => writeIssue(queryClient, ws, server),
    onSettled: (_data, _error, { issue }) => {
      void queryClient.invalidateQueries({ queryKey: ['ws', ws, 'issues'] });
      void queryClient.invalidateQueries({ queryKey: key.issue(ws, issue.id) });
    },
  });
}

export function useMoveIssue() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      issue,
      destination,
    }: {
      issue: Issue;
      destination: { beforeId?: string; afterId?: string; stateId?: string };
    }) => client!.moveIssue(issue.id, issue.revision, destination),
    onSuccess: (server) => writeIssue(queryClient, ws, server),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ws', ws, 'issues'] }),
  });
}

export function useCreateIssue() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { projectId: string; title: string } & IssuePatch) =>
      client!.createIssue(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ws', ws, 'issues'] }),
  });
}

export function useBulkUpdate() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issues: Parameters<WorkspaceApi['bulkUpdate']>[0]) => client!.bulkUpdate(issues),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ws', ws, 'issues'] }),
  });
}

export function useSavedViews() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.savedViews(ws),
    queryFn: () => client!.listSavedViews().then((r) => r.items),
    enabled: Boolean(client),
    staleTime: 30_000,
  });
}

export function useCreateSavedView() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      filters: SavedViewFilters;
      groupBy?: string;
      sort?: string;
    }) => client!.createSavedView({ scope: 'personal', ...body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.savedViews(ws) }),
  });
}

export function useDeleteSavedView() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client!.deleteSavedView(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.savedViews(ws) }),
  });
}
