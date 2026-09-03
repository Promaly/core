import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  LabelChip,
  PriorityIcon,
  StateIcon,
  Textarea,
  toast,
  type Priority,
} from '@promaly/ui';
import { PRIORITY_NAMES, useIssueContext } from './context.js';
import { useCreateIssue } from './data.js';
import {
  AssigneeAvatar,
  AssigneePicker,
  LabelPicker,
  PriorityPicker,
  StatePicker,
} from './pickers.js';

export function NewIssueDialog({
  open,
  onOpenChange,
  projectId,
  defaultStateId,
  parentIssueId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  defaultStateId?: string | undefined;
  parentIssueId?: string | undefined;
}) {
  const context = useIssueContext();
  const create = useCreateIssue();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stateId, setStateId] = useState(defaultStateId ?? '');
  const [priority, setPriority] = useState<number>(0);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  const titleRef = useRef<HTMLInputElement>(null);

  const project = context.projectsById.get(projectId);
  const states = context.statesForProject(project);
  const currentState = states.find((s) => s.id === stateId);
  const selectedLabels = labelIds.map((id) => context.labelsById.get(id)).filter(Boolean);
  const allLabels = context.allLabels.filter((l) => !l.projectId || l.projectId === projectId);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setPriority(0);
    setAssigneeId(null);
    setLabelIds([]);
    const initial =
      defaultStateId ?? states.find((s) => s.category === 'unstarted')?.id ?? states[0]?.id ?? '';
    setStateId(initial);
    setTimeout(() => titleRef.current?.focus(), 0);
  }, [open]);

  const placeholderIssue = {
    id: '',
    projectId,
    number: 0,
    title: '',
    description: '',
    stateId,
    priority,
    assigneeId,
    parentIssueId: parentIssueId ?? null,
    labels: selectedLabels.map((l) => ({
      id: l!.id,
      name: l!.name,
      color: l!.color,
    })),
    revision: 0,
    sortKey: '',
    completedAt: null,
    startedAt: null,
    archivedAt: null,
    dueAt: null,
    estimate: null,
    workspaceId: '',
    createdAt: '',
    updatedAt: '',
  };

  const doCreate = (openAfter: boolean) => {
    if (!title.trim()) return;
    const body: Parameters<typeof create.mutate>[0] = {
      projectId,
      title: title.trim(),
    };
    if (description.trim()) body.description = description.trim();
    if (stateId) body.stateId = stateId;
    if (priority !== 0) body.priority = priority;
    if (assigneeId) body.assigneeId = assigneeId;
    if (labelIds.length) body.labelIds = labelIds;
    if (parentIssueId) body.parentIssueId = parentIssueId;

    create.mutate(body, {
      onSuccess: (issue) => {
        onOpenChange(false);
        if (openAfter)
          void navigate({
            to: '/issues/$issueId',
            params: { issueId: issue.id },
          });
      },
      onError: () => toast('Could not create the issue.'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col gap-0 p-0"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            doCreate(false);
          }
        }}
      >
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-[14px]">
            {parentIssueId ? 'Create sub-issue' : 'New issue'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
          <Input
            ref={titleRef}
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            className="border-0 px-0 text-[15px] font-medium shadow-none focus-visible:ring-0"
          />

          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            className="min-h-[80px] resize-none text-[13px]"
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatePicker
              issue={placeholderIssue}
              states={states}
              onPick={setStateId}
              asChild={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] hover:bg-secondary"
                >
                  <StateIcon
                    category={currentState?.category ?? 'unstarted'}
                    color={currentState?.color}
                  />
                  <span className="text-muted-foreground">{currentState?.name ?? 'Status'}</span>
                </button>
              }
            />

            <PriorityPicker
              issue={placeholderIssue}
              onPick={setPriority}
              asChild={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] hover:bg-secondary"
                >
                  <PriorityIcon value={priority as Priority} />
                  <span className="text-muted-foreground">{PRIORITY_NAMES[priority]}</span>
                </button>
              }
            />

            <AssigneePicker
              issue={placeholderIssue}
              context={context}
              onPick={setAssigneeId}
              asChild={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] hover:bg-secondary"
                >
                  <AssigneeAvatar email={context.member(assigneeId)?.email ?? null} />
                  <span className="text-muted-foreground">
                    {assigneeId ? context.memberName(assigneeId) : 'Assignee'}
                  </span>
                </button>
              }
            />

            {allLabels.length > 0 && (
              <LabelPicker
                issue={placeholderIssue}
                labels={allLabels}
                onToggle={(labelId, active) => {
                  setLabelIds((prev) =>
                    active ? prev.filter((id) => id !== labelId) : [...prev, labelId],
                  );
                }}
                asChild={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] hover:bg-secondary"
                  >
                    <span className="text-muted-foreground">Labels</span>
                  </button>
                }
              />
            )}

            {selectedLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedLabels.map(
                  (l) => l && <LabelChip key={l.id} name={l.name} color={l.color} />,
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => doCreate(true)}
            disabled={!title.trim() || create.isPending}
          >
            Create &amp; open
          </Button>
          <Button
            size="sm"
            onClick={() => doCreate(false)}
            disabled={!title.trim() || create.isPending}
          >
            Create <span className="ml-1 text-[10px] opacity-60">⌘↵</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
