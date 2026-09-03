import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CoreRole,
  Invitation,
  Label,
  Member,
  NotificationPreferences,
  Project,
  Team,
  TeamMember,
  Workflow,
} from '../api.js';
import { useWorkspaceApi, useWorkspaceId } from '../issues/data.js';

// ── Query keys ──────────────────────────────────────────────────────────────

const key = {
  members: (ws: string) => ['ws', ws, 'members'] as const,
  invitations: (ws: string) => ['ws', ws, 'invitations'] as const,
  teams: (ws: string) => ['ws', ws, 'teams'] as const,
  teamMembers: (ws: string, teamId: string) => ['ws', ws, 'team', teamId, 'members'] as const,
  workflows: (ws: string) => ['ws', ws, 'workflows'] as const,
  labels: (ws: string) => ['ws', ws, 'labels'] as const,
  projects: (ws: string) => ['ws', ws, 'projects'] as const,
};

// ── Members ──────────────────────────────────────────────────────────────────

export function useMembers() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.members(ws ?? ''),
    queryFn: () => client!.listMembers(),
    enabled: Boolean(client),
  });
}

export function useInvitations() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.invitations(ws ?? ''),
    queryFn: () => client!.listInvitations(),
    enabled: Boolean(client),
  });
}

export function useInviteMember() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: Exclude<CoreRole, 'owner'> }) =>
      client!.createInvitation(email, role),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.invitations(ws) }),
  });
}

export function useUpdateMemberRole() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, role }: { accountId: string; role: CoreRole }) =>
      client!.updateMemberRole(accountId, role),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.members(ws) }),
  });
}

export function useRemoveMember() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => client!.removeMember(accountId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.members(ws) }),
  });
}

export function useRevokeInvitation() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client!.revokeInvitation(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.invitations(ws) }),
  });
}

// ── Teams ────────────────────────────────────────────────────────────────────

export function useTeams() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.teams(ws ?? ''),
    queryFn: () => client!.listTeams().then((r) => r.items),
    enabled: Boolean(client),
  });
}

export function useTeamMembers(teamId: string | undefined) {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.teamMembers(ws ?? '', teamId ?? ''),
    queryFn: () => client!.listTeamMembers(teamId!),
    enabled: Boolean(client) && Boolean(teamId),
  });
}

export function useCreateTeam() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; key: string }) => client!.createTeam(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.teams(ws) }),
  });
}

export function useUpdateTeam() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; key?: string } }) =>
      client!.updateTeam(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.teams(ws) }),
  });
}

export function useDeleteTeam() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client!.deleteTeam(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.teams(ws) }),
  });
}

export function useAddTeamMember() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, accountId }: { teamId: string; accountId: string }) =>
      client!.addTeamMember(teamId, accountId),
    onSuccess: (_data, { teamId }) =>
      void qc.invalidateQueries({ queryKey: key.teamMembers(ws, teamId) }),
  });
}

export function useRemoveTeamMember() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, accountId }: { teamId: string; accountId: string }) =>
      client!.removeTeamMember(teamId, accountId),
    onSuccess: (_data, { teamId }) =>
      void qc.invalidateQueries({ queryKey: key.teamMembers(ws, teamId) }),
  });
}

// ── Workflows ─────────────────────────────────────────────────────────────────

export function useWorkflows() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.workflows(ws ?? ''),
    queryFn: () => client!.listWorkflows().then((r) => r.items),
    enabled: Boolean(client),
  });
}

export function useCreateWorkflowState() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workflowId,
      body,
    }: {
      workflowId: string;
      body: { name: string; category: Workflow['states'][number]['category']; color: string };
    }) => client!.createWorkflowState(workflowId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.workflows(ws) }),
  });
}

export function useUpdateWorkflowState() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workflowId,
      stateId,
      patch,
    }: {
      workflowId: string;
      stateId: string;
      patch: { name?: string; color?: string };
    }) => client!.updateWorkflowState(workflowId, stateId, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.workflows(ws) }),
  });
}

export function useDeleteWorkflowState() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, stateId }: { workflowId: string; stateId: string }) =>
      client!.deleteWorkflowState(workflowId, stateId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.workflows(ws) }),
  });
}

// ── Labels ────────────────────────────────────────────────────────────────────

export function useLabels() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: key.labels(ws ?? ''),
    queryFn: () => client!.listLabels().then((r) => r.items),
    enabled: Boolean(client),
  });
}

export function useCreateLabel() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color: string }) => client!.createLabel(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.labels(ws) }),
  });
}

export function useUpdateLabel() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; color?: string } }) =>
      client!.updateLabel(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.labels(ws) }),
  });
}

export function useDeleteLabel() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client!.deleteLabel(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.labels(ws) }),
  });
}

// ── Projects (admin) ─────────────────────────────────────────────────────────

export function useAdminProjects() {
  const ws = useWorkspaceId();
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: [...key.projects(ws ?? ''), 'all'] as const,
    queryFn: () =>
      client!
        .listProjects()
        .then((r) => r.items)
        .then(async (active) => {
          // Fetch archived separately — API doesn't expose includeArchived yet
          // so we merge with what we have
          return active;
        }),
    enabled: Boolean(client),
  });
}

export function useArchiveProject() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      archive ? client!.archiveProject(id) : client!.unarchiveProject(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key.projects(ws) }),
  });
}

// ── Workspace settings ────────────────────────────────────────────────────────

export function useUpdateWorkspace() {
  const client = useWorkspaceApi();
  return useMutation({
    mutationFn: (patch: { name?: string; slug?: string }) => client!.updateWorkspace(patch),
  });
}

export function useDeleteWorkspace() {
  const client = useWorkspaceApi();
  return useMutation({ mutationFn: () => client!.deleteWorkspace() });
}

export function useLeaveWorkspace() {
  const client = useWorkspaceApi();
  return useMutation({ mutationFn: () => client!.leaveWorkspace() });
}

// Re-export types used by screens
export type { Member, Invitation, Team, TeamMember, Workflow, Label, Project, CoreRole, NotificationPreferences };

// ── Notification preferences ──────────────────────────────────────────────────

export function useNotificationPreferences() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  return useQuery({
    queryKey: ['ws', ws, 'notif-prefs'] as const,
    queryFn: () => client!.getNotificationPreferences(),
    enabled: Boolean(client),
  });
}

export function useUpdateNotificationPreferences() {
  const ws = useWorkspaceId() ?? '';
  const client = useWorkspaceApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      client!.updateNotificationPreferences(patch),
    onSuccess: (data) => qc.setQueryData(['ws', ws, 'notif-prefs'] as const, data),
  });
}
