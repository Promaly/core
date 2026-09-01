import {
  Avatar,
  AvatarFallback,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  LabelDot,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PriorityIcon,
  StateIcon,
  cn,
  type Priority,
} from '@promaly/ui';
import { Check, Tag } from 'lucide-react';
import { type ReactNode } from 'react';
import type { Issue, IssueLabelRef, WorkflowState } from '../api.js';
import { PRIORITY_NAMES, initials, type IssueContext } from './context.js';

function PickerShell({
  trigger,
  children,
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild aria-label={label}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>{children}</Command>
      </PopoverContent>
    </Popover>
  );
}

export function StatePicker({
  issue,
  states,
  onPick,
  asChild,
}: {
  issue: Issue;
  states: WorkflowState[];
  onPick: (stateId: string) => void;
  asChild?: ReactNode;
}) {
  const current = states.find((s) => s.id === issue.stateId);
  return (
    <PickerShell
      label="Change status"
      trigger={
        asChild ?? (
          <button className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[13px] hover:bg-secondary">
            <StateIcon category={current?.category ?? 'backlog'} color={current?.color} />
            <span className="text-muted-foreground">{current?.name ?? 'No status'}</span>
          </button>
        )
      }
    >
      <CommandList>
        <CommandGroup>
          {states.map((state) => (
            <CommandItem key={state.id} value={state.name} onSelect={() => onPick(state.id)}>
              <StateIcon category={state.category} color={state.color} />
              <span className="flex-1">{state.name}</span>
              {state.id === issue.stateId && <Check className="size-3.5" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </PickerShell>
  );
}

export function PriorityPicker({
  issue,
  onPick,
  asChild,
}: {
  issue: Issue;
  onPick: (priority: number) => void;
  asChild?: ReactNode;
}) {
  return (
    <PickerShell
      label="Change priority"
      trigger={
        asChild ?? (
          <button className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[13px] hover:bg-secondary">
            <PriorityIcon value={issue.priority as Priority} />
            <span className="text-muted-foreground">{PRIORITY_NAMES[issue.priority]}</span>
          </button>
        )
      }
    >
      <CommandList>
        <CommandGroup>
          {PRIORITY_NAMES.map((name, value) => (
            <CommandItem key={name} value={name} onSelect={() => onPick(value)}>
              <PriorityIcon value={value as Priority} />
              <span className="flex-1">{name}</span>
              {value === issue.priority && <Check className="size-3.5" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </PickerShell>
  );
}

export function AssigneePicker({
  issue,
  context,
  onPick,
  asChild,
}: {
  issue: Issue;
  context: IssueContext;
  onPick: (assigneeId: string | null) => void;
  asChild?: ReactNode;
}) {
  const current = context.member(issue.assigneeId);
  return (
    <PickerShell
      label="Change assignee"
      trigger={
        asChild ?? (
          <button className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[13px] hover:bg-secondary">
            <AssigneeAvatar email={current?.email ?? null} />
            <span className="text-muted-foreground">
              {current ? current.email.split('@')[0] : 'Unassigned'}
            </span>
          </button>
        )
      }
    >
      <CommandInput placeholder="Assign to…" />
      <CommandList>
        <CommandEmpty>No members.</CommandEmpty>
        <CommandGroup>
          <CommandItem value="Unassigned" onSelect={() => onPick(null)}>
            <AssigneeAvatar email={null} />
            <span className="flex-1">Unassigned</span>
            {!issue.assigneeId && <Check className="size-3.5" />}
          </CommandItem>
          {context.allMembers.map((member) => (
            <CommandItem
              key={member.accountId}
              value={member.email}
              onSelect={() => onPick(member.accountId)}
            >
              <AssigneeAvatar email={member.email} />
              <span className="flex-1 truncate">{member.email}</span>
              {member.accountId === issue.assigneeId && <Check className="size-3.5" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </PickerShell>
  );
}

export function LabelPicker({
  issue,
  labels,
  onToggle,
  asChild,
}: {
  issue: Issue;
  labels: IssueLabelRef[];
  onToggle: (labelId: string, active: boolean) => void;
  asChild?: ReactNode;
}) {
  const currentIds = new Set(issue.labels.map((l) => l.id));
  return (
    <PickerShell
      label="Change labels"
      trigger={
        asChild ?? (
          <button className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[13px] hover:bg-secondary">
            <Tag className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {issue.labels.length > 0
                ? issue.labels.map((l) => l.name).join(', ')
                : 'No labels'}
            </span>
          </button>
        )
      }
    >
      <CommandInput placeholder="Filter labels…" />
      <CommandList>
        <CommandEmpty>No labels found.</CommandEmpty>
        <CommandGroup>
          {labels.map((label) => {
            const active = currentIds.has(label.id);
            return (
              <CommandItem
                key={label.id}
                value={label.name}
                onSelect={() => onToggle(label.id, active)}
              >
                <LabelDot color={label.color} />
                <span className="flex-1">{label.name}</span>
                {active && <Check className="size-3.5" />}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </PickerShell>
  );
}

export function AssigneeAvatar({ email, className }: { email: string | null; className?: string }) {
  if (!email) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-5 shrink-0 rounded-full border border-dashed border-input',
          className,
        )}
      />
    );
  }
  return (
    <Avatar className={cn('size-5', className)}>
      <AvatarFallback>{initials(email)}</AvatarFallback>
    </Avatar>
  );
}
