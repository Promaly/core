import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  Identifier,
  LabelDot,
  PriorityIcon,
  Skeleton,
  StateIcon,
  cn,
  toast,
  type Priority,
} from '@promaly/ui';
import { Plus } from 'lucide-react';
import { ApiError, type Issue } from '../api.js';
import { useIssueContext, type IssueContext } from './context.js';
import { useIssues, useMoveIssue } from './data.js';
import { AssigneeAvatar } from './pickers.js';
import { NewIssueDialog } from './new-issue.js';

export function BoardScreen({ projectKey }: { projectKey: string }) {
  const context = useIssueContext();
  const project = context.projectByKey(projectKey);
  const [composerOpen, setComposerOpen] = useState(false);
  const issues = useIssues(
    useMemo(
      () => ({
        projectId: project?.id,
        sort: 'manual' as const,
        groupBy: 'none' as const,
        limit: 500,
      }),
      [project?.id],
    ),
  );
  const move = useMoveIssue();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!context.loading && !project) {
    return (
      <EmptyState title="Project not found" description={`No project with key ${projectKey}.`} />
    );
  }

  const states = context.statesForProject(project);
  const columns = states.map((state) => ({
    state,
    items: (issues.data?.items ?? [])
      .filter((issue) => issue.stateId === state.id)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
  }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const all = issues.data?.items ?? [];
    const dragged = all.find((issue) => issue.id === active.id);
    if (!dragged) return;

    const overId = String(over.id);
    const overIssue = all.find((issue) => issue.id === overId);
    const targetStateId = overIssue ? overIssue.stateId : overId; // column droppable id === stateId
    if (!states.some((state) => state.id === targetStateId)) return;
    if (overIssue?.id === dragged.id) return;

    const destination: { stateId?: string; beforeId?: string; afterId?: string } = {};
    if (targetStateId !== dragged.stateId) destination.stateId = targetStateId;
    if (overIssue && overIssue.id !== dragged.id) destination.beforeId = overIssue.id;
    if (Object.keys(destination).length === 0) return;

    move.mutate(
      { issue: dragged, destination },
      {
        onError: (error) =>
          toast(
            error instanceof ApiError && error.isConflict
              ? 'That issue moved elsewhere — refresh the board.'
              : 'Could not move the issue.',
          ),
      },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-[13px] font-semibold">{project?.name ?? projectKey} · Board</span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setComposerOpen(true)} disabled={!project}>
            <Plus className="size-3.5" /> New issue
          </Button>
        </div>
      </div>
      {issues.isPending ? (
        <div className="flex gap-4 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-64" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto p-4">
            {columns.map(({ state, items }) => (
              <section
                key={state.id}
                className="flex w-72 shrink-0 flex-col rounded-md border border-border bg-secondary/30"
              >
                <header className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-muted-foreground">
                  <StateIcon category={state.category} color={state.color} />
                  {state.name}
                  <span className="text-faint">{items.length}</span>
                </header>
                <SortableContext
                  id={state.id}
                  items={items.map((issue) => issue.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-1 flex-col gap-2 p-2" data-column={state.id}>
                    {items.map((issue) => (
                      <BoardCard key={issue.id} issue={issue} context={context} />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded border border-dashed border-border py-6 text-center text-[12px] text-faint">
                        Empty
                      </div>
                    )}
                  </div>
                </SortableContext>
              </section>
            ))}
          </div>
        </DndContext>
      )}
      {project && (
        <NewIssueDialog open={composerOpen} onOpenChange={setComposerOpen} projectId={project.id} />
      )}
    </div>
  );
}

function BoardCard({ issue, context }: { issue: Issue; context: IssueContext }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-md border border-border bg-card p-3 text-[13px]',
        isDragging && 'opacity-60 shadow-[var(--shadow-popover)]',
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between">
        <Identifier value={context.identifier(issue)} />
        <PriorityIcon value={issue.priority as Priority} />
      </div>
      <Link
        to="/issues/$issueId"
        params={{ issueId: issue.id }}
        className="mt-1 line-clamp-2 block hover:underline"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {issue.title}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1">
          {issue.labels.slice(0, 3).map((label) => (
            <LabelDot key={label.id} color={label.color} />
          ))}
        </div>
        <AssigneeAvatar email={context.member(issue.assigneeId)?.email ?? null} />
      </div>
    </div>
  );
}
