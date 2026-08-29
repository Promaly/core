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
import { ListFilter, Plus } from 'lucide-react';
import type { Issue, IssueListParams } from '../api.js';
import { ApiError } from '../api.js';
import { useIssueContext, type IssueContext } from './context.js';
import { useBulkUpdate, useIssues, useUpdateIssue } from './data.js';
import { AssigneeAvatar, AssigneePicker, PriorityPicker, StatePicker } from './pickers.js';
import { NewIssueDialog } from './new-issue.js';

type Sort = NonNullable<IssueListParams['sort']>;

export function IssueListScreen({ projectKey }: { projectKey: string }) {
  const context = useIssueContext();
  const project = context.projectByKey(projectKey);
  const [sort, setSort] = useState<Sort>('manual');
  const [grouped, setGrouped] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const params: IssueListParams = useMemo(
    () => ({ projectId: project?.id, sort, groupBy: grouped ? 'state' : 'none', limit: 200 }),
    [project?.id, sort, grouped],
  );
  const issues = useIssues(params);

  if (!context.loading && !project) {
    return (
      <EmptyState title="Project not found" description={`No project with key ${projectKey}.`} />
    );
  }

  const states = context.statesForProject(project);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h1 className="text-[13px] font-semibold">{project?.name ?? projectKey}</h1>
        <span className="text-[13px] text-faint">{issues.data?.items.length ?? 0}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGrouped((value) => !value)}
            className={cn(grouped && 'text-foreground')}
          >
            <ListFilter className="size-3.5" /> {grouped ? 'Grouped' : 'Flat'}
          </Button>
          <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
            <SelectTrigger className="h-7 w-32 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual order</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="updated">Recently updated</SelectItem>
              <SelectItem value="created">Recently created</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setComposerOpen(true)} disabled={!project}>
            <Plus className="size-3.5" /> New issue
          </Button>
        </div>
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
          title="No issues yet"
          description="Create the first issue for this project."
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
          grouped={grouped}
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
  grouped,
}: {
  issues: Issue[];
  context: IssueContext;
  states: ReturnType<IssueContext['statesForProject']>;
  grouped: boolean;
}) {
  const navigate = useNavigate();
  const update = useUpdateIssue();
  const bulk = useBulkUpdate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => {
    if (!grouped) return issues;
    const byState = new Map(states.map((s) => [s.id, [] as Issue[]]));
    const loose: Issue[] = [];
    for (const issue of issues) (byState.get(issue.stateId) ?? loose).push(issue);
    return [...states.flatMap((s) => byState.get(s.id) ?? []), ...loose];
  }, [issues, states, grouped]);

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
      {grouped
        ? states.map((state) => {
            const rows = ordered.filter((issue) => issue.stateId === state.id);
            if (rows.length === 0) return null;
            return (
              <div key={state.id}>
                <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-4 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur">
                  <StateIcon category={state.category} color={state.color} />
                  {state.name}
                  <span className="text-faint">{rows.length}</span>
                </div>
                {rows.map((issue) => (
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
            );
          })
        : ordered.map((issue) => (
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
