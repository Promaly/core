import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  EmptyState,
  Identifier,
  LabelDot,
  PriorityIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StateIcon,
  cn,
  toast,
  type Priority,
} from '@promaly/ui';
import { Plus } from 'lucide-react';
import type { Issue, IssueListParams, SavedView } from '../api.js';
import { ApiError } from '../api.js';
import { useIssueContext, type IssueContext } from './context.js';
import { useBulkUpdate, useIssues, useUpdateIssue } from './data.js';
import {
  EMPTY_FILTERS,
  FilterBar,
  StateFilterChip,
  ViewsMenu,
  filtersToApi,
  type FilterState,
} from './filters.js';
import { AssigneeAvatar, AssigneePicker, PriorityPicker, StatePicker } from './pickers.js';
import { NewIssueDialog } from './new-issue.js';

type Sort = NonNullable<IssueListParams['sort']>;
type GroupBy = NonNullable<IssueListParams['groupBy']>;

export function IssueListScreen({ projectKey }: { projectKey: string }) {
  const context = useIssueContext();
  const project = context.projectByKey(projectKey);
  const [sort, setSort] = useState<Sort>('manual');
  const [groupBy, setGroupBy] = useState<GroupBy>('state');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [composerOpen, setComposerOpen] = useState(false);

  const params: IssueListParams = useMemo(
    () => ({
      projectId: project?.id,
      sort,
      groupBy,
      limit: 200,
      ...filtersToApi(filters),
    }),
    [project?.id, sort, groupBy, filters],
  );
  const issues = useIssues(params);

  if (!context.loading && !project) {
    return (
      <EmptyState title="Project not found" description={`No project with key ${projectKey}.`} />
    );
  }

  const states = context.statesForProject(project);

  const applyView = (view: SavedView) => {
    setFilters({
      stateId: view.filters.stateId ?? [],
      assigneeId: view.filters.assigneeId ?? [],
      labelId: view.filters.labelId ?? [],
      priority: view.filters.priority ?? [],
    });
    if (view.groupBy && ['state', 'assignee', 'priority', 'label', 'none'].includes(view.groupBy)) {
      setGroupBy(view.groupBy as GroupBy);
    }
    if (view.sort && ['manual', 'priority', 'updated', 'created'].includes(view.sort)) {
      setSort(view.sort as Sort);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h1 className="text-[13px] font-semibold">{project?.name ?? projectKey}</h1>
        <span className="text-[13px] text-faint">{issues.data?.items.length ?? 0}</span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="h-7 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="state">Group: State</SelectItem>
              <SelectItem value="assignee">Group: Assignee</SelectItem>
              <SelectItem value="priority">Group: Priority</SelectItem>
              <SelectItem value="none">No grouping</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
            <SelectTrigger className="h-7 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual order</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="updated">Recently updated</SelectItem>
              <SelectItem value="created">Recently created</SelectItem>
            </SelectContent>
          </Select>

          <ViewsMenu filters={filters} groupBy={groupBy} sort={sort} onApply={applyView} />

          <Button size="sm" onClick={() => setComposerOpen(true)} disabled={!project}>
            <Plus className="size-3.5" /> New issue
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border px-4 py-1.5">
        <StateFilterChip
          filters={filters}
          onChange={setFilters}
          context={context}
          projectId={project?.id}
        />
        <FilterBar filters={filters} onChange={setFilters} context={context} />
      </div>

      {issues.isPending ? (
        <div className="flex flex-col gap-1.5 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[34px] w-full" />
          ))}
        </div>
      ) : issues.data && issues.data.items.length === 0 ? (
        <EmptyState
          icon={<Plus />}
          title="No issues"
          description="No issues match the current filters."
          action={
            <Button size="sm" onClick={() => setComposerOpen(true)}>
              New issue
            </Button>
          }
        />
      ) : (
        <IssueRows
          issues={issues.data?.items ?? []}
          context={context}
          states={states}
          groupBy={groupBy}
        />
      )}

      {project && (
        <NewIssueDialog
          open={composerOpen}
          onOpenChange={setComposerOpen}
          projectId={project.id}
          defaultStateId={states[0]?.id}
        />
      )}
    </div>
  );
}

function IssueRows({
  issues,
  context,
  states,
  groupBy,
}: {
  issues: Issue[];
  context: IssueContext;
  states: ReturnType<IssueContext['statesForProject']>;
  groupBy: GroupBy;
}) {
  const navigate = useNavigate();
  const update = useUpdateIssue();
  const bulk = useBulkUpdate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  type Group = { key: string; label: string; items: Issue[] };

  const groups = useMemo((): Group[] => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', items: issues }];
    }
    if (groupBy === 'state') {
      const byState = new Map(
        states.map((s) => [s.id, { key: s.id, label: s.name, items: [] as Issue[] }]),
      );
      const loose: Issue[] = [];
      for (const issue of issues) {
        const g = byState.get(issue.stateId);
        if (g) g.items.push(issue);
        else loose.push(issue);
      }
      const result = states.map((s) => byState.get(s.id)!).filter((g) => g.items.length > 0);
      if (loose.length) result.push({ key: '__loose__', label: 'Other', items: loose });
      return result;
    }
    if (groupBy === 'assignee') {
      const byAssignee = new Map<string, Group>();
      for (const issue of issues) {
        const k = issue.assigneeId ?? '__unassigned__';
        if (!byAssignee.has(k)) {
          byAssignee.set(k, {
            key: k,
            label: k === '__unassigned__' ? 'Unassigned' : context.memberName(k),
            items: [],
          });
        }
        byAssignee.get(k)!.items.push(issue);
      }
      const sorted = [...byAssignee.values()].sort((a, b) => {
        if (a.key === '__unassigned__') return 1;
        if (b.key === '__unassigned__') return -1;
        return a.label.localeCompare(b.label);
      });
      return sorted;
    }
    if (groupBy === 'priority') {
      const names = ['No priority', 'Urgent', 'High', 'Medium', 'Low'];
      const byPriority = new Map<number, Group>();
      for (const issue of issues) {
        const p = issue.priority ?? 0;
        if (!byPriority.has(p)) {
          byPriority.set(p, { key: String(p), label: names[p] ?? 'Unknown', items: [] });
        }
        byPriority.get(p)!.items.push(issue);
      }
      return [0, 1, 2, 3, 4]
        .map((p) => byPriority.get(p))
        .filter((g): g is Group => !!g && g.items.length > 0);
    }
    if (groupBy === 'label') {
      const byLabel = new Map<string, Group>();
      const unlabeled: Issue[] = [];
      for (const issue of issues) {
        if (issue.labels.length === 0) {
          unlabeled.push(issue);
        } else {
          const label = issue.labels[0]!;
          if (!byLabel.has(label.id)) {
            byLabel.set(label.id, { key: label.id, label: label.name, items: [] });
          }
          byLabel.get(label.id)!.items.push(issue);
        }
      }
      const result = [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
      if (unlabeled.length)
        result.push({ key: '__unlabeled__', label: 'No label', items: unlabeled });
      return result;
    }
    return [{ key: 'all', label: '', items: issues }];
  }, [issues, groupBy, states, context]);

  const ordered = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, ordered.length - 1)));
  }, [ordered.length]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const patch = useCallback(
    (issue: Issue, body: Parameters<typeof update.mutate>[0]['patch']) => {
      update.mutate(
        { issue, patch: body },
        {
          onError: (error) =>
            toast(
              error instanceof ApiError && error.isConflict
                ? 'That issue changed elsewhere — refresh and retry.'
                : 'Could not save the change.',
            ),
        },
      );
    },
    [update],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable || event.metaKey || event.ctrlKey) return;
      const active = ordered[activeIndex];
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, ordered.length - 1));
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'x' && active) {
        event.preventDefault();
        toggleSelect(active.id);
      } else if (event.key === 'Enter' && active) {
        void navigate({ to: '/issues/$issueId', params: { issueId: active.id } });
      } else if (event.key === 'Escape') {
        setSelected(new Set());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ordered, activeIndex, navigate, toggleSelect]);

  const anySelected = selected.size > 0;

  return (
    <div className="relative flex-1 overflow-auto" ref={listRef} tabIndex={-1}>
      {groups.map((group) => (
        <div key={group.key}>
          {groupBy !== 'none' && (
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-4 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur">
              {groupBy === 'state' &&
                (() => {
                  const s = states.find((st) => st.id === group.key);
                  return s ? <StateIcon category={s.category} color={s.color} /> : null;
                })()}
              {group.label}
              <span className="text-faint">{group.items.length}</span>
            </div>
          )}
          {group.items.map((issue) => (
            <Row
              key={issue.id}
              issue={issue}
              context={context}
              states={states}
              active={ordered[activeIndex]?.id === issue.id}
              selected={selected.has(issue.id)}
              anySelected={anySelected}
              onSelect={() => toggleSelect(issue.id)}
              onPatch={patch}
            />
          ))}
        </div>
      ))}

      {anySelected && (
        <div
          role="status"
          className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-3 rounded-md border border-border bg-popover px-3 py-2 text-[13px] shadow-[var(--shadow-popover)]"
        >
          <span>{selected.size} selected</span>
          {states
            .filter((state) => state.category === 'completed')
            .slice(0, 1)
            .map((done) => (
              <Button
                key={done.id}
                size="sm"
                variant="secondary"
                disabled={bulk.isPending}
                onClick={() => {
                  const targets = ordered.filter((issue) => selected.has(issue.id));
                  bulk.mutate(
                    targets.map((issue) => ({
                      id: issue.id,
                      revision: issue.revision,
                      stateId: done.id,
                    })),
                    {
                      onSuccess: () => setSelected(new Set()),
                      onError: () => toast('Bulk update failed.'),
                    },
                  );
                }}
              >
                Mark {done.name}
              </Button>
            ))}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({
  issue,
  context,
  states,
  active,
  selected,
  anySelected,
  onSelect,
  onPatch,
}: {
  issue: Issue;
  context: IssueContext;
  states: ReturnType<IssueContext['statesForProject']>;
  active: boolean;
  selected: boolean;
  anySelected: boolean;
  onSelect: () => void;
  onPatch: (
    issue: Issue,
    patch: { stateId?: string; priority?: number; assigneeId?: string | null },
  ) => void;
}) {
  const state = context.state(issue.stateId);
  return (
    <div
      className={cn(
        'group flex h-[34px] items-center gap-2 border-b border-border/60 px-4 text-[13px]',
        active ? 'border-l-2 border-l-primary bg-secondary/60 pl-[14px]' : 'hover:bg-secondary/40',
      )}
    >
      <span
        className={cn(
          'flex w-4 shrink-0 items-center',
          selected || anySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          aria-label={`Select ${context.identifier(issue)}`}
        />
      </span>

      <StatePicker
        issue={issue}
        states={states}
        onPick={(stateId) => onPatch(issue, { stateId })}
        asChild={
          <button className="shrink-0" aria-label="Change status">
            <StateIcon category={state?.category ?? 'backlog'} color={state?.color} />
          </button>
        }
      />

      <Identifier value={context.identifier(issue)} className="w-16 shrink-0" />

      <Link
        to="/issues/$issueId"
        params={{ issueId: issue.id }}
        className="min-w-0 flex-1 truncate hover:underline"
      >
        {issue.title}
      </Link>

      <div className="flex shrink-0 items-center gap-1.5">
        {issue.labels.slice(0, 3).map((label) => (
          <LabelDot key={label.id} color={label.color} />
        ))}
      </div>

      {issue.dueAt && (
        <span
          className={[
            'hidden shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium md:block',
            new Date(issue.dueAt) < new Date()
              ? 'bg-destructive/10 text-destructive'
              : 'bg-secondary text-faint',
          ].join(' ')}
        >
          {issue.dueAt.slice(0, 10)}
        </span>
      )}

      <PriorityPicker
        issue={issue}
        onPick={(priority) => onPatch(issue, { priority })}
        asChild={
          <button className="shrink-0" aria-label="Change priority">
            <PriorityIcon value={issue.priority as Priority} />
          </button>
        }
      />

      <AssigneePicker
        issue={issue}
        context={context}
        onPick={(assigneeId) => onPatch(issue, { assigneeId })}
        asChild={
          <button className="shrink-0" aria-label="Change assignee">
            <AssigneeAvatar email={context.member(issue.assigneeId)?.email ?? null} />
          </button>
        }
      />

      <span className="hidden w-16 shrink-0 text-right text-[12px] text-faint md:block">
        {relativeTime(issue.updatedAt)}
      </span>
    </div>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}
