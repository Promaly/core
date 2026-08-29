import { useMemo } from 'react';
import type { Issue, Label, Member, Project, WorkflowState } from '../api.js';
import { useLabels, useMembers, useProjects, useWorkflows } from './data.js';

export const PRIORITY_NAMES = ['No priority', 'Urgent', 'High', 'Medium', 'Low'] as const;

/**
 * Resolved workspace metadata (projects, states, labels, members) with lookup
 * helpers, so screens can turn an issue's raw ids into display values.
 */
export function useIssueContext() {
  const projects = useProjects();
  const workflows = useWorkflows();
  const labels = useLabels();
  const members = useMembers();

  return useMemo(() => {
    const statesById = new Map<string, WorkflowState>();
    for (const workflow of workflows.data ?? []) {
      for (const state of workflow.states) statesById.set(state.id, state);
    }
    const projectsById = new Map((projects.data ?? []).map((p) => [p.id, p]));
    const projectsByKey = new Map((projects.data ?? []).map((p) => [p.key.toLowerCase(), p]));
    const labelsById = new Map((labels.data ?? []).map((l) => [l.id, l]));
    const membersById = new Map((members.data ?? []).map((m) => [m.accountId, m]));

    return {
      loading: projects.isPending || workflows.isPending,
      projects: projects.data ?? [],
      statesById,
      projectsById,
      projectsByKey,
      labelsById,
      membersById,
      allLabels: labels.data ?? [],
      allMembers: members.data ?? [],
      projectByKey: (keyValue: string): Project | undefined =>
        projectsByKey.get(keyValue.toLowerCase()),
      identifier: (issue: Pick<Issue, 'projectId' | 'number'>) => {
        const project = projectsById.get(issue.projectId);
        return `${project?.key ?? '???'}-${issue.number}`;
      },
      state: (stateId: string): WorkflowState | undefined => statesById.get(stateId),
      statesForProject: (project: Project | undefined): WorkflowState[] => {
        if (!project) return [];
        const workflow = (workflows.data ?? []).find((w) => w.id === project.workflowId);
        return workflow ? [...workflow.states].sort((a, b) => a.position - b.position) : [];
      },
      label: (id: string): Label | undefined => labelsById.get(id),
      member: (id: string | null): Member | undefined => (id ? membersById.get(id) : undefined),
      memberName: (id: string | null) => {
        if (!id) return 'Unassigned';
        const email = membersById.get(id)?.email;
        return email ? email.split('@')[0]! : 'Someone';
      },
    };
  }, [
    projects.data,
    projects.isPending,
    workflows.data,
    workflows.isPending,
    labels.data,
    members.data,
  ]);
}

export type IssueContext = ReturnType<typeof useIssueContext>;

export function initials(email: string) {
  const name = email.split('@')[0] ?? email;
  const parts = name.split(/[.\-_]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)).toUpperCase();
}
