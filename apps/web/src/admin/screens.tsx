import { AdminLayout } from './layout.js';

export function AdminMembersScreen() {
  return (
    <AdminLayout section="members">
      <h2 className="text-[17px] font-semibold">Members</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Member management arrives in Wave B.</p>
    </AdminLayout>
  );
}

export function AdminTeamsScreen() {
  return (
    <AdminLayout section="teams">
      <h2 className="text-[17px] font-semibold">Teams</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Team management arrives in Wave B.</p>
    </AdminLayout>
  );
}

export function AdminWorkflowsScreen() {
  return (
    <AdminLayout section="workflows">
      <h2 className="text-[17px] font-semibold">Workflows</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Workflow editor arrives in Wave B.</p>
    </AdminLayout>
  );
}

export function AdminLabelsScreen() {
  return (
    <AdminLayout section="labels">
      <h2 className="text-[17px] font-semibold">Labels</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Label management arrives in Wave B.</p>
    </AdminLayout>
  );
}

export function AdminProjectsScreen() {
  return (
    <AdminLayout section="projects">
      <h2 className="text-[17px] font-semibold">Projects</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Project settings arrive in Wave B.</p>
    </AdminLayout>
  );
}

export function AdminWorkspaceScreen() {
  return (
    <AdminLayout section="workspace">
      <h2 className="text-[17px] font-semibold">Workspace</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Workspace settings arrive in Wave B.</p>
    </AdminLayout>
  );
}
