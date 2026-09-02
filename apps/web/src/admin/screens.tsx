import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  LabelChip,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  StateIcon,
  Switch,
  toast,
  type StateCategory,
} from '@promaly/ui';
import { Trash2, UserPlus, X } from 'lucide-react';
import { useSession } from '../session.js';
import { AdminLayout } from './layout.js';
import {
  useAddTeamMember,
  useAdminLabels,
  useAdminMembers,
  useAdminWorkflows,
  useCreateInvitation,
  useCreateLabel,
  useCreateTeam,
  useCreateWorkflowState,
  useDeleteLabel,
  useDeleteTeam,
  useDeleteWorkflowState,
  useInvitations,
  useNotificationPreferences,
  useRemoveMember,
  useRemoveTeamMember,
  useRevokeInvitation,
  useTeamMembers,
  useTeams,
  useUpdateLabel,
  useUpdateMemberRole,
  useUpdateNotificationPreferences,
  useUpdateWorkspace,
} from './data.js';
import type { CoreRole } from '../api.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[17px] font-semibold">{children}</h2>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

const ROLE_OPTIONS: { value: Exclude<CoreRole, 'owner'>; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'guest', label: 'Guest' },
];

// ── Workspace screen ──────────────────────────────────────────────────────────

export function AdminWorkspaceScreen() {
  const { data: session } = useSession();
  const ws = session?.workspaces[0];
  const [name, setName] = useState(ws?.name ?? '');
  const [slug, setSlug] = useState(ws?.slug ?? '');
  const update = useUpdateWorkspace();

  const handleSave = () => {
    update.mutate(
      { name, slug },
      {
        onSuccess: () => toast.success('Workspace updated.'),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <AdminLayout section="workspace">
      <SectionTitle>Workspace settings</SectionTitle>
      <p className="mb-6 mt-1 text-[13px] text-muted-foreground">
        Manage your workspace name and URL.
      </p>

      <div className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Acme Inc."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-slug">URL slug</Label>
          <Input
            id="ws-slug"
            value={slug}
            onChange={(e) => setSlug(e.currentTarget.value)}
            placeholder="acme"
          />
          <p className="text-[12px] text-muted-foreground">
            Used in shareable links. Only lowercase letters, numbers, and hyphens.
          </p>
        </div>
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </AdminLayout>
  );
}

// ── Members screen ────────────────────────────────────────────────────────────

export function AdminMembersScreen() {
  const { data: session } = useSession();
  const myId = session?.account.id;
  const myRole = session?.workspaces[0]?.role;

  const members = useAdminMembers();
  const invitations = useInvitations();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<CoreRole, 'owner'>>('member');

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    createInvitation.mutate(
      { email: inviteEmail.trim(), role: inviteRole },
      {
        onSuccess: () => {
          setInviteEmail('');
          toast.success(`Invitation sent to ${inviteEmail.trim()}.`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const pendingInvitations = invitations.data?.filter((inv) => inv.acceptedAt === null) ?? [];

  return (
    <AdminLayout section="members">
      <SectionTitle>Members</SectionTitle>
      <p className="mb-6 mt-1 text-[13px] text-muted-foreground">
        Manage who has access to this workspace.
      </p>

      {/* Invite form */}
      <div className="mb-8 max-w-lg">
        <SubTitle>Invite people</SubTitle>
        <div className="flex gap-2">
          <Input
            placeholder="colleague@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            className="flex-1"
          />
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as Exclude<CoreRole, 'owner'>)}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleInvite} disabled={createInvitation.isPending}>
            <UserPlus className="mr-1.5 size-4" />
            Invite
          </Button>
        </div>
      </div>

      {/* Members list */}
      <div className="mb-8">
        <SubTitle>Members ({members.data?.length ?? '…'})</SubTitle>
        {members.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {members.data?.map((m) => (
              <div key={m.accountId} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex-1 text-[13px]">{m.email}</span>
                {m.role === 'owner' ? (
                  <span className="text-[12px] text-muted-foreground">Owner</span>
                ) : (
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      updateRole.mutate({
                        accountId: m.accountId,
                        role: v as Exclude<CoreRole, 'owner'>,
                      })
                    }
                    disabled={myRole !== 'owner' && myRole !== 'admin'}
                  >
                    <SelectTrigger className="h-7 w-24 text-[12px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {m.accountId !== myId && m.role !== 'owner' && (
                  <button
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      removeMember.mutate(m.accountId, {
                        onError: (err) => toast.error(err.message),
                      })
                    }
                    aria-label={`Remove ${m.email}`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div>
          <SubTitle>Pending invitations</SubTitle>
          <div className="divide-y divide-border rounded-md border border-border">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex-1 text-[13px]">{inv.email}</span>
                <span className="text-[12px] capitalize text-muted-foreground">{inv.role}</span>
                <span className="text-[12px] text-muted-foreground">
                  Expires {new Date(inv.expiresAt).toLocaleDateString()}
                </span>
                <button
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    revokeInvitation.mutate(inv.id, {
                      onError: (err) => toast.error(err.message),
                    })
                  }
                  aria-label="Revoke invitation"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// ── Teams screen ──────────────────────────────────────────────────────────────

function TeamMembersPanel({
  teamId,
  allMembers,
  onClose,
}: {
  teamId: string;
  allMembers: { accountId: string; email: string }[];
  onClose: () => void;
}) {
  const teamMembers = useTeamMembers(teamId);
  const addMember = useAddTeamMember(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const memberIds = new Set(teamMembers.data?.map((m) => m.accountId) ?? []);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Team members</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {teamMembers.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : teamMembers.data?.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No members yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {teamMembers.data?.map((m) => (
                <div key={m.accountId} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 text-[13px]">{m.email}</span>
                  <button
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember.mutate(m.accountId)}
                    aria-label="Remove"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div>
            <SubTitle>Add member</SubTitle>
            <div className="flex flex-col gap-1">
              {allMembers
                .filter((m) => !memberIds.has(m.accountId))
                .map((m) => (
                  <button
                    key={m.accountId}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-secondary"
                    onClick={() => addMember.mutate(m.accountId)}
                  >
                    <UserPlus className="size-3.5 text-muted-foreground" />
                    {m.email}
                  </button>
                ))}
              {allMembers.filter((m) => !memberIds.has(m.accountId)).length === 0 && (
                <p className="text-[13px] text-muted-foreground">All members are on this team.</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminTeamsScreen() {
  const teams = useTeams();
  const members = useAdminMembers();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [managingTeamId, setManagingTeamId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim() || !newKey.trim()) return;
    createTeam.mutate(
      { name: newName.trim(), key: newKey.trim().toUpperCase() },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewName('');
          setNewKey('');
          toast.success('Team created.');
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <AdminLayout section="teams">
      <div className="mb-6 flex items-center justify-between">
        <SectionTitle>Teams</SectionTitle>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New team
        </Button>
      </div>

      {teams.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !teams.data || teams.data.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No teams yet. Create one to group members and projects.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {teams.data.map((team) => (
            <div key={team.id} className="flex items-center gap-3 px-3 py-3">
              <div className="flex-1">
                <span className="text-[13px] font-medium">{team.name}</span>
                <span className="ml-2 text-[12px] text-muted-foreground">{team.key}</span>
              </div>
              <span className="text-[12px] text-muted-foreground">
                {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-[12px]"
                onClick={() => setManagingTeamId(team.id)}
              >
                Manage
              </Button>
              <button
                className="rounded p-1 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  deleteTeam.mutate(team.id, { onError: (err) => toast.error(err.message) })
                }
                aria-label={`Delete ${team.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create team dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Name</Label>
              <Input
                id="team-name"
                value={newName}
                onChange={(e) => setNewName(e.currentTarget.value)}
                placeholder="Engineering"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-key">Key</Label>
              <Input
                id="team-key"
                value={newKey}
                onChange={(e) => setNewKey(e.currentTarget.value.toUpperCase())}
                placeholder="ENG"
                maxLength={8}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createTeam.isPending}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team members panel */}
      {managingTeamId && (
        <TeamMembersPanel
          teamId={managingTeamId}
          allMembers={members.data ?? []}
          onClose={() => setManagingTeamId(null)}
        />
      )}
    </AdminLayout>
  );
}

// ── Labels screen ─────────────────────────────────────────────────────────────

const LABEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          className="size-5 rounded-full ring-offset-background transition-all focus:outline-none"
          style={{
            background: c,
            boxShadow: value === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
          }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
    </div>
  );
}

export function AdminLabelsScreen() {
  const labels = useAdminLabels();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]!);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createLabel.mutate(
      { name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          setNewName('');
          setNewColor(LABEL_COLORS[0]!);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const commitEdit = () => {
    if (!editingId) return;
    updateLabel.mutate(
      { id: editingId, patch: { name: editName, color: editColor } },
      {
        onSuccess: () => setEditingId(null),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <AdminLayout section="labels">
      <SectionTitle>Labels</SectionTitle>
      <p className="mb-6 mt-1 text-[13px] text-muted-foreground">
        Labels help categorize issues across projects.
      </p>

      {/* Create form */}
      <div className="mb-8 max-w-md">
        <SubTitle>New label</SubTitle>
        <div className="space-y-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Label name"
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <Button onClick={handleCreate} disabled={createLabel.isPending || !newName.trim()}>
            Add label
          </Button>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Labels list */}
      {labels.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : !labels.data || labels.data.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No labels yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {labels.data.map((label) =>
            editingId === label.id ? (
              <div key={label.id} className="flex items-center gap-3 px-3 py-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="h-7 flex-1 text-[13px]"
                  autoFocus
                />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <Button size="sm" className="h-7 text-[12px]" onClick={commitEdit}>
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[12px]"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div key={label.id} className="flex items-center gap-3 px-3 py-2.5">
                <LabelChip color={label.color} name={label.name} />
                <span className="flex-1 text-[13px]">{label.name}</span>
                <button
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                  onClick={() => startEdit(label.id, label.name, label.color)}
                >
                  Edit
                </button>
                <button
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    deleteLabel.mutate(label.id, { onError: (err) => toast.error(err.message) })
                  }
                  aria-label={`Delete ${label.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </AdminLayout>
  );
}

// ── Workflows screen ──────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: StateCategory; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'unstarted', label: 'Unstarted' },
  { value: 'started', label: 'Started' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATE_COLORS = ['#94a3b8', '#64748b', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444', '#f97316'];

export function AdminWorkflowsScreen() {
  const workflows = useAdminWorkflows();
  const createState = useCreateWorkflowState();
  const deleteState = useDeleteWorkflowState();

  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newStateName, setNewStateName] = useState('');
  const [newStateCategory, setNewStateCategory] = useState<StateCategory>('unstarted');
  const [newStateColor, setNewStateColor] = useState(STATE_COLORS[0]!);

  const handleAddState = (workflowId: string) => {
    if (!newStateName.trim()) return;
    createState.mutate(
      { workflowId, name: newStateName.trim(), category: newStateCategory, color: newStateColor },
      {
        onSuccess: () => {
          setAddingTo(null);
          setNewStateName('');
          setNewStateCategory('unstarted');
          setNewStateColor(STATE_COLORS[0]!);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <AdminLayout section="workflows">
      <SectionTitle>Workflows</SectionTitle>
      <p className="mb-6 mt-1 text-[13px] text-muted-foreground">
        Workflows define the lifecycle states for issues in your workspace.
      </p>

      {workflows.isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {workflows.data?.map((workflow) => (
            <div key={workflow.id} className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-[14px] font-medium">{workflow.name}</span>
                {workflow.isDefault && (
                  <span className="text-[11px] text-muted-foreground">Default</span>
                )}
              </div>
              <div className="divide-y divide-border">
                {workflow.states.map((state) => (
                  <div key={state.id} className="flex items-center gap-3 px-4 py-2.5">
                    <StateIcon category={state.category} color={state.color} />
                    <span className="flex-1 text-[13px]">{state.name}</span>
                    <span className="text-[12px] capitalize text-muted-foreground">
                      {state.category}
                    </span>
                    <button
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        deleteState.mutate(
                          { workflowId: workflow.id, stateId: state.id },
                          { onError: (err) => toast.error(err.message) },
                        )
                      }
                      aria-label={`Delete ${state.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add state */}
              {addingTo === workflow.id ? (
                <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
                  <Input
                    value={newStateName}
                    onChange={(e) => setNewStateName(e.currentTarget.value)}
                    placeholder="State name"
                    autoFocus
                    className="h-8 text-[13px]"
                    onKeyDown={(e) => e.key === 'Escape' && setAddingTo(null)}
                  />
                  <div className="flex gap-2">
                    <Select
                      value={newStateCategory}
                      onValueChange={(v) => setNewStateCategory(v as StateCategory)}
                    >
                      <SelectTrigger className="h-8 flex-1 text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      {STATE_COLORS.map((c) => (
                        <button
                          key={c}
                          className="size-5 rounded-full"
                          style={{
                            background: c,
                            boxShadow:
                              newStateColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                          }}
                          onClick={() => setNewStateColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-[12px]"
                      onClick={() => handleAddState(workflow.id)}
                      disabled={createState.isPending}
                    >
                      Add state
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[12px]"
                      onClick={() => setAddingTo(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-border px-4 py-2">
                  <button
                    className="text-[12px] text-muted-foreground hover:text-foreground"
                    onClick={() => setAddingTo(workflow.id)}
                  >
                    + Add state
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

// ── Projects screen ───────────────────────────────────────────────────────────

export function AdminProjectsScreen() {
  return (
    <AdminLayout section="projects">
      <SectionTitle>Projects</SectionTitle>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Create and manage projects from the{' '}
        <a href="/" className="underline underline-offset-2 hover:text-foreground">
          Projects home
        </a>
        .
      </p>
    </AdminLayout>
  );
}

// ── Notification preferences (bonus — accessible via members screen nav) ──────

export function AdminNotificationsScreen() {
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const toggle = (key: keyof import('../api.js').NotificationPreferences) => {
    if (!prefs.data) return;
    update.mutate({ [key]: !prefs.data[key] }, { onError: (err) => toast.error(err.message) });
  };

  const rows: {
    key: keyof import('../api.js').NotificationPreferences;
    label: string;
    desc: string;
  }[] = [
    { key: 'inApp', label: 'In-app notifications', desc: 'Show the notification badge and inbox.' },
    { key: 'email', label: 'Email notifications', desc: 'Receive an email digest.' },
    { key: 'mentions', label: 'Mentions', desc: 'Notify when someone @-mentions you.' },
    { key: 'assignments', label: 'Assignments', desc: 'Notify when an issue is assigned to you.' },
    { key: 'comments', label: 'Comments', desc: 'Notify when someone comments on your issues.' },
  ];

  return (
    <AdminLayout section="members">
      <SectionTitle>Notification preferences</SectionTitle>
      <p className="mb-6 mt-1 text-[13px] text-muted-foreground">
        Choose how you want to be notified.
      </p>
      <div className="max-w-md space-y-4">
        {rows.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium">{label}</p>
              <p className="text-[12px] text-muted-foreground">{desc}</p>
            </div>
            <Switch
              checked={prefs.data?.[key] ?? false}
              onCheckedChange={() => toggle(key)}
              disabled={prefs.isPending || update.isPending}
            />
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
