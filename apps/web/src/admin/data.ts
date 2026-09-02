import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoreRole, NotificationPreferences } from '../api.js';
import { useWorkspaceApi, useWorkspaceId } from '../issues/data.js';

const key = {
  members: (ws: string) => ['ws', ws, 'admin', 'members'] as const,
  invitations: (ws: string) => ['ws', ws, 'admin', 'invitations'] as const,
  teams: (ws: string) => ['ws', ws, 'admin', 'teams'] as const,
  teamMembers: (ws: string, teamId: string) =>
    ['ws', ws, 'admin', 'teams', teamId, 'members'] as const,
  notifPrefs: (ws: string) => ['ws', ws, 'admin', 'notif-prefs'] as const,
  labels: (ws: string) => ['ws', ws, 'labels'] as const,
  workflows: (ws: string) => ['ws', ws, 'workflows'] as const,
};

// ── Members ───────────────────────────────────────────────────────────────────

export function useAdminMembers() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.members(ws),
    queryFn: () => client!.listMembers(),
    enabled: Boolean(client),
  });
}

export function useUpdateMemberRole() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, role }: { accountId: string; role: Exclude<CoreRole, 'owner'> }) =>
      client!.updateMemberRole(accountId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.members(ws) }),
  });
}

export function useRemoveMember() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => client!.removeMember(accountId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.members(ws) }),
  });
}

// ── Invitations ───────────────────────────────────────────────────────────────

export function useInvitations() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.invitations(ws),
    queryFn: () => client!.listInvitations(),
    enabled: Boolean(client),
  });
}

export function useCreateInvitation() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: Exclude<CoreRole, 'owner'> }) =>
      client!.createInvitation(email, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.invitations(ws) }),
  });
}

export function useRevokeInvitation() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client!.revokeInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.invitations(ws) }),
  });
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export function useTeams() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.teams(ws),
    queryFn: () => client!.listTeams().then((r) => r.items),
    enabled: Boolean(client),
  });
}

export function useCreateTeam() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; key: string }) => client!.createTeam(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.teams(ws) }),
  });
}

export function useDeleteTeam() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client!.deleteTeam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.teams(ws) }),
  });
}

export function useTeamMembers(teamId: string | undefined) {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.teamMembers(ws, teamId ?? ''),
    queryFn: () => client!.listTeamMembers(teamId!),
    enabled: Boolean(client) && Boolean(teamId),
  });
}

export function useAddTeamMember(teamId: string | undefined) {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => client!.addTeamMember(teamId!, accountId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.teamMembers(ws, teamId ?? '') }),
  });
}

export function useRemoveTeamMember(teamId: string | undefined) {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => client!.removeTeamMember(teamId!, accountId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.teamMembers(ws, teamId ?? '') }),
  });
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export function useUpdateWorkspace() {
  const client = useWorkspaceApi();
  return useMutation({
    mutationFn: (patch: { name?: string; slug?: string }) => client!.updateWorkspace(patch),
  });
}

// ── Notification preferences ──────────────────────────────────────────────────

export function useNotificationPreferences() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.notifPrefs(ws),
    queryFn: () => client!.getNotificationPreferences(),
    enabled: Boolean(client),
  });
}

export function useUpdateNotificationPreferences() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      client!.updateNotificationPreferences(patch),
    onSuccess: (data) => queryClient.setQueryData(key.notifPrefs(ws), data),
  });
}

// ── Labels ────────────────────────────────────────────────────────────────────

export function useAdminLabels() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.labels(ws),
    queryFn: () => client!.listLabels().then((r) => r.items),
    enabled: Boolean(client),
  });
}

export function useCreateLabel() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color: string }) => client!.createLabel(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.labels(ws) }),
  });
}

export function useUpdateLabel() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; color?: string } }) =>
      client!.updateLabel(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.labels(ws) }),
  });
}

export function useDeleteLabel() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client!.deleteLabel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.labels(ws) }),
  });
}

// ── Workflows ─────────────────────────────────────────────────────────────────

export function useAdminWorkflows() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.workflows(ws),
    queryFn: () => client!.listWorkflows().then((r) => r.items),
    enabled: Boolean(client),
  });
}

export function useCreateWorkflowState() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      workflowId: string;
      name: string;
      category: import('../api.js').StateCategory;
      color: string;
    }) =>
      client!.createWorkflowState(body.workflowId, {
        name: body.name,
        category: body.category,
        color: body.color,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.workflows(ws) }),
  });
}

export function useDeleteWorkflowState() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, stateId }: { workflowId: string; stateId: string }) =>
      client!.deleteWorkflowState(workflowId, stateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.workflows(ws) }),
  });
}
