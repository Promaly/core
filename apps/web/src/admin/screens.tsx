import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Label as FormLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@promaly/ui';
import type { StateCategory } from '@promaly/ui';
import { useSession } from '../session.js';
import { AdminLayout } from './layout.js';
import {
  useAddTeamMember,
  useAdminProjects,
  useArchiveProject,
  useCreateLabel,
  useCreateTeam,
  useCreateWorkflowState,
  useDeleteLabel,
  useDeleteTeam,
  useDeleteWorkflowState,
  useDeleteWorkspace,
  useInvitations,
  useInviteMember,
  useLabels,
  useLeaveWorkspace,
  useMembers,
  useRemoveMember,
  useRemoveTeamMember,
  useRevokeInvitation,
  useTeamMembers,
  useTeams,
  useUpdateLabel,
  useUpdateMemberRole,
  useUpdateTeam,
  useUpdateWorkflowState,
  useUpdateWorkspace,
  useWorkflows,
  type CoreRole,
  type Invitation,
  type Label,
  type Member,
  type Team,
  type Workflow,
} from './data.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

function SkeletonRows({ cols, rows = 4 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function useConfirm(message: string) {
  return () => window.confirm(message);
}

// ── Members ───────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: Array<{ value: Exclude<CoreRole, 'owner'>; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'guest', label: 'Guest' },
];

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<CoreRole, 'owner'>>('member');
  const invite = useInviteMember();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${email}`);
          setEmail('');
          setOpen(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Invite member</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              Send an invitation link to a new workspace member.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <FormLabel htmlFor="inv-email">Email</FormLabel>
              <Input
                id="inv-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="grid gap-1.5">
              <FormLabel htmlFor="inv-role">Role</FormLabel>
              <Select value={role} onValueChange={(v) => setRole(v as Exclude<CoreRole, 'owner'>)}>
                <SelectTrigger id="inv-role">
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
            </div>
          </div>
          <DialogFooter className="mt-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({ member, currentId }: { member: Member; currentId: string }) {
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const confirm = useConfirm(`Remove ${member.email} from the workspace?`);
  const isSelf = member.accountId === currentId;

  return (
    <TableRow>
      <TableCell className="font-medium">{member.email}</TableCell>
      <TableCell>
        {member.role === 'owner' ? (
          <Badge variant="neutral">Owner</Badge>
        ) : (
          <Select
            value={member.role}
            onValueChange={(v) =>
              updateRole.mutate(
                { accountId: member.accountId, role: v as CoreRole },
                { onError: (e) => toast.error(e.message) },
              )
            }
            disabled={isSelf}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
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
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(member.joinedAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        {!isSelf && member.role !== 'owner' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={removeMember.isPending}
            onClick={() => {
              if (confirm()) {
                removeMember.mutate(member.accountId, {
                  onError: (e) => toast.error(e.message),
                });
              }
            }}
          >
            Remove
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function InvitationRow({ inv }: { inv: Invitation }) {
  const revoke = useRevokeInvitation();
  const confirm = useConfirm(`Revoke invitation for ${inv.email}?`);

  return (
    <TableRow>
      <TableCell className="font-medium">{inv.email}</TableCell>
      <TableCell className="capitalize text-muted-foreground text-xs">{inv.role}</TableCell>
      <TableCell className="text-muted-foreground text-xs">
        Expires {new Date(inv.expiresAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={revoke.isPending}
          onClick={() => {
            if (confirm()) {
              revoke.mutate(inv.id, { onError: (e) => toast.error(e.message) });
            }
          }}
        >
          Revoke
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function AdminMembersScreen() {
  const { data: session } = useSession();
  const { data: members, isPending: loadingMembers } = useMembers();
  const { data: invitations, isPending: loadingInvitations } = useInvitations();
  const currentId = session?.account.id ?? '';

  return (
    <AdminLayout section="members">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Members</h2>
        <InviteDialog />
      </div>

      <div className="mt-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingMembers ? (
              <SkeletonRows cols={4} />
            ) : members?.length ? (
              members.map((m) => <MemberRow key={m.accountId} member={m} currentId={currentId} />)
            ) : (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState title="No members" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(loadingInvitations || (invitations && invitations.length > 0)) && (
        <>
          <Separator className="my-6" />
          <h3 className="mb-3 text-[14px] font-medium">Pending invitations</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingInvitations ? (
                <SkeletonRows cols={4} rows={2} />
              ) : (
                invitations!.map((inv) => <InvitationRow key={inv.id} inv={inv} />)
              )}
            </TableBody>
          </Table>
        </>
      )}
    </AdminLayout>
  );
}

// ── Teams ─────────────────────────────────────────────────────────────────────

function CreateTeamDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const create = useCreateTeam();

  const derivedKey = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, key: key || derivedKey },
      {
        onSuccess: () => {
          toast.success('Team created');
          setName('');
          setKey('');
          setOpen(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New team</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create team</DialogTitle>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <FormLabel htmlFor="team-name">Name</FormLabel>
              <Input
                id="team-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering"
              />
            </div>
            <div className="grid gap-1.5">
              <FormLabel htmlFor="team-key">Identifier</FormLabel>
              <Input
                id="team-key"
                required
                value={key || derivedKey}
                onChange={(e) =>
                  setKey(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 5),
                  )
                }
                placeholder="ENG"
              />
            </div>
          </div>
          <DialogFooter className="mt-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTeamDialog({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team.name);
  const update = useUpdateTeam();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      { id: team.id, patch: { name } },
      {
        onSuccess: () => {
          toast.success('Team updated');
          setOpen(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit team</DialogTitle>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <FormLabel htmlFor="edit-team-name">Name</FormLabel>
              <Input
                id="edit-team-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageTeamMembersDialog({ team, members }: { team: Team; members: Member[] }) {
  const [open, setOpen] = useState(false);
  const { data: teamMembers, isPending } = useTeamMembers(open ? team.id : undefined);
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const existingIds = new Set(teamMembers?.map((m) => m.accountId) ?? []);
  const available = members.filter((m) => !existingIds.has(m.accountId));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Members</DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{team.name} members</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {isPending ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : teamMembers?.length ? (
            <ul className="divide-y">
              {teamMembers.map((m) => (
                <li key={m.accountId} className="flex items-center justify-between py-2">
                  <span className="text-sm">{m.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={removeMember.isPending}
                    onClick={() =>
                      removeMember.mutate(
                        { teamId: team.id, accountId: m.accountId },
                        { onError: (e) => toast.error(e.message) },
                      )
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}

          {available.length > 0 && (
            <div className="mt-4 flex gap-2">
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add member…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((m) => (
                    <SelectItem key={m.accountId} value={m.accountId}>
                      {m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!selectedAccountId || addMember.isPending}
                onClick={() => {
                  if (!selectedAccountId) return;
                  addMember.mutate(
                    { teamId: team.id, accountId: selectedAccountId },
                    {
                      onSuccess: () => setSelectedAccountId(''),
                      onError: (e) => toast.error(e.message),
                    },
                  );
                }}
              >
                Add
              </Button>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamRow({ team, members }: { team: Team; members: Member[] }) {
  const deleteTeam = useDeleteTeam();
  const confirm = useConfirm(`Delete team "${team.name}"? This cannot be undone.`);

  return (
    <TableRow>
      <TableCell className="font-medium">{team.name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{team.key}</TableCell>
      <TableCell className="text-muted-foreground">{team.memberCount}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              •••
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <EditTeamDialog team={team} />
            <ManageTeamMembersDialog team={team} members={members} />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                if (confirm()) {
                  deleteTeam.mutate(team.id, { onError: (e) => toast.error(e.message) });
                }
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function AdminTeamsScreen() {
  const { data: teams, isPending: loadingTeams } = useTeams();
  const { data: members } = useMembers();

  return (
    <AdminLayout section="teams">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Teams</h2>
        <CreateTeamDialog />
      </div>

      <div className="mt-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Identifier</TableHead>
              <TableHead>Members</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingTeams ? (
              <SkeletonRows cols={4} />
            ) : teams?.length ? (
              teams.map((t) => <TeamRow key={t.id} team={t} members={members ?? []} />)
            ) : (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState title="No teams" description="Create a team to organize members." />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}

// ── Workflows ─────────────────────────────────────────────────────────────────

const STATE_CATEGORIES: Array<{ value: StateCategory; label: string }> = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'unstarted', label: 'Unstarted' },
  { value: 'started', label: 'Started' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function AddStateDialog({ workflow }: { workflow: Workflow }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#94a3b8');
  const [category, setCategory] = useState<StateCategory>('unstarted');
  const create = useCreateWorkflowState();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { workflowId: workflow.id, body: { name, color, category } },
      {
        onSuccess: () => {
          toast.success('State added');
          setName('');
          setOpen(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Add state
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add state</DialogTitle>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <FormLabel htmlFor="state-name">Name</FormLabel>
              <Input
                id="state-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="In review"
              />
            </div>
            <div className="grid gap-1.5">
              <FormLabel htmlFor="state-category">Category</FormLabel>
              <Select value={category} onValueChange={(v) => setCategory(v as StateCategory)}>
                <SelectTrigger id="state-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <FormLabel htmlFor="state-color">Color</FormLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="state-color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="font-mono text-xs"
                  placeholder="#94a3b8"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add state'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const updateState = useUpdateWorkflowState();
  const deleteState = useDeleteWorkflowState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const grouped = STATE_CATEGORIES.map((cat) => ({
    category: cat,
    states: workflow.states
      .filter((s) => s.category === cat.value)
      .sort((a, b) => a.position - b.position),
  })).filter((g) => g.states.length > 0);

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{workflow.name}</span>
          {workflow.isDefault && (
            <Badge variant="neutral" className="text-xs">
              Default
            </Badge>
          )}
        </div>
        <AddStateDialog workflow={workflow} />
      </div>

      <div className="divide-y divide-border">
        {grouped.map(({ category, states }) => (
          <div key={category.value} className="px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {category.label}
            </p>
            <div className="space-y-1">
              {states.map((state) => (
                <div
                  key={state.id}
                  className="flex items-center justify-between rounded px-2 py-1 hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: state.color }} />
                    {editingId === state.id ? (
                      <Input
                        autoFocus
                        className="h-6 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => {
                          if (editName.trim() && editName !== state.name) {
                            updateState.mutate(
                              {
                                workflowId: workflow.id,
                                stateId: state.id,
                                patch: { name: editName.trim() },
                              },
                              { onError: (e) => toast.error(e.message) },
                            );
                          }
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <span
                        className="cursor-pointer text-sm"
                        onClick={() => {
                          setEditingId(state.id);
                          setEditName(state.name);
                        }}
                      >
                        {state.name}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Delete state "${state.name}"?`)) {
                        deleteState.mutate(
                          { workflowId: workflow.id, stateId: state.id },
                          { onError: (e) => toast.error(e.message) },
                        );
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {workflow.states.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No states. Add one above.
          </p>
        )}
      </div>
    </div>
  );
}

export function AdminWorkflowsScreen() {
  const { data: workflows, isPending } = useWorkflows();

  return (
    <AdminLayout section="workflows">
      <h2 className="text-[17px] font-semibold">Workflows</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Manage workflow states for issue tracking.
      </p>

      <div className="mt-5 space-y-4">
        {isPending ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : workflows?.length ? (
          workflows.map((wf) => <WorkflowCard key={wf.id} workflow={wf} />)
        ) : (
          <EmptyState
            title="No workflows"
            description="Create a workflow to manage issue states."
          />
        )}
      </div>
    </AdminLayout>
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────

function LabelDialog({
  initial,
  onSave,
  isPending,
  trigger,
}: {
  initial?: { name: string; color: string };
  onSave: (data: { name: string; color: string }) => void;
  isPending: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name, color });
    setOpen(false);
    if (!initial) {
      setName('');
      setColor('#6366f1');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{initial ? 'Edit label' : 'New label'}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <FormLabel htmlFor="lbl-name">Name</FormLabel>
              <Input
                id="lbl-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bug"
              />
            </div>
            <div className="grid gap-1.5">
              <FormLabel htmlFor="lbl-color">Color</FormLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="lbl-color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LabelRow({ label }: { label: Label }) {
  const update = useUpdateLabel();
  const remove = useDeleteLabel();
  const confirm = useConfirm(`Delete label "${label.name}"?`);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: label.color }} />
          <span className="font-medium">{label.name}</span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{label.color}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <LabelDialog
            initial={{ name: label.name, color: label.color }}
            onSave={(data) =>
              update.mutate(
                { id: label.id, patch: data },
                { onError: (e) => toast.error(e.message) },
              )
            }
            isPending={update.isPending}
            trigger={
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm()) {
                remove.mutate(label.id, { onError: (e) => toast.error(e.message) });
              }
            }}
          >
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AdminLabelsScreen() {
  const { data: labels, isPending } = useLabels();
  const create = useCreateLabel();

  return (
    <AdminLayout section="labels">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Labels</h2>
        <LabelDialog
          onSave={(data) =>
            create.mutate(data, {
              onSuccess: () => toast.success('Label created'),
              onError: (e) => toast.error(e.message),
            })
          }
          isPending={create.isPending}
          trigger={<Button size="sm">New label</Button>}
        />
      </div>

      <div className="mt-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Color</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <SkeletonRows cols={3} />
            ) : labels?.length ? (
              labels.map((lbl) => <LabelRow key={lbl.id} label={lbl} />)
            ) : (
              <TableRow>
                <TableCell colSpan={3}>
                  <EmptyState title="No labels" description="Create labels to categorize issues." />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function AdminProjectsScreen() {
  const { data: projects, isPending } = useAdminProjects();
  const archive = useArchiveProject();

  return (
    <AdminLayout section="projects">
      <h2 className="text-[17px] font-semibold">Projects</h2>

      <div className="mt-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Identifier</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <SkeletonRows cols={4} />
            ) : projects?.length ? (
              projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    {p.archivedAt ? (
                      <Badge variant="neutral">Archived</Badge>
                    ) : (
                      <Badge>Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.key}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={archive.isPending}
                      onClick={() =>
                        archive.mutate(
                          { id: p.id, archive: !p.archivedAt },
                          { onError: (e) => toast.error(e.message) },
                        )
                      }
                    >
                      {p.archivedAt ? 'Unarchive' : 'Archive'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState title="No projects" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────────

function DangerAction({
  label,
  description,
  confirmMessage,
  onConfirm,
  isPending,
}: {
  label: string;
  description: string;
  confirmMessage: string;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/30 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        variant="danger"
        size="sm"
        disabled={isPending}
        onClick={() => {
          if (window.confirm(confirmMessage)) onConfirm();
        }}
      >
        {isPending ? 'Loading…' : label}
      </Button>
    </div>
  );
}

export function AdminWorkspaceScreen() {
  const { data: session } = useSession();
  const ws = session?.workspaces[0];
  const [name, setName] = useState(ws?.name ?? '');
  const [slug, setSlug] = useState(ws?.slug ?? '');
  const update = useUpdateWorkspace();
  const deleteWs = useDeleteWorkspace();
  const leaveWs = useLeaveWorkspace();
  const navigate = useNavigate();

  const currentRole = ws?.role;
  const isOwner = currentRole === 'owner';

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      { name, slug },
      {
        onSuccess: () => toast.success('Workspace updated'),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <AdminLayout section="workspace">
      <h2 className="text-[17px] font-semibold">Workspace</h2>

      <form onSubmit={handleRename} className="mt-5 max-w-md space-y-4">
        <div className="grid gap-1.5">
          <FormLabel htmlFor="ws-name">Name</FormLabel>
          <Input
            id="ws-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My workspace"
          />
        </div>
        <div className="grid gap-1.5">
          <FormLabel htmlFor="ws-slug">URL slug</FormLabel>
          <Input
            id="ws-slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="my-workspace"
          />
        </div>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      <Separator className="my-8" />

      <h3 className="mb-3 text-[14px] font-medium text-destructive">Danger zone</h3>
      <div className="max-w-md space-y-3">
        {!isOwner && (
          <DangerAction
            label="Leave workspace"
            description="You will lose access to all projects and issues."
            confirmMessage="Are you sure you want to leave this workspace? You'll lose access immediately."
            onConfirm={() =>
              leaveWs.mutate(undefined, {
                onSuccess: () => void navigate({ to: '/' }),
                onError: (e) => toast.error(e.message),
              })
            }
            isPending={leaveWs.isPending}
          />
        )}
        {isOwner && (
          <DangerAction
            label="Delete workspace"
            description="Permanently delete this workspace and all its data. This cannot be undone."
            confirmMessage={`Delete workspace "${ws?.name}"? All projects, issues, and members will be permanently removed.`}
            onConfirm={() =>
              deleteWs.mutate(undefined, {
                onSuccess: () => void navigate({ to: '/' }),
                onError: (e) => toast.error(e.message),
              })
            }
            isPending={deleteWs.isPending}
          />
        )}
      </div>
    </AdminLayout>
  );
}
