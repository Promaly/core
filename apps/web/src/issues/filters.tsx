import { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  StateIcon,
  cn,
  toast,
} from '@promaly/ui';
import { Bookmark, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import type { SavedView } from '../api.js';
import { PRIORITY_NAMES, type IssueContext } from './context.js';
import { useCreateSavedView, useDeleteSavedView, useSavedViews } from './data.js';

export type FilterState = {
  stateId: string[];
  assigneeId: string[];
  labelId: string[];
  priority: number[];
};

export const EMPTY_FILTERS: FilterState = {
  stateId: [],
  assigneeId: [],
  labelId: [],
  priority: [],
};

export function filtersActive(f: FilterState) {
  return (
    f.stateId.length > 0 || f.assigneeId.length > 0 || f.labelId.length > 0 || f.priority.length > 0
  );
}

export function filtersToApi(f: FilterState) {
  return {
    ...(f.stateId.length ? { stateId: f.stateId } : {}),
    ...(f.assigneeId.length ? { assigneeId: f.assigneeId } : {}),
    ...(f.labelId.length ? { labelId: f.labelId } : {}),
    ...(f.priority.length ? { priority: f.priority } : {}),
  };
}

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

type ChipProps = {
  label: string;
  count: number;
  children: React.ReactNode;
  onClear: () => void;
};

function FilterChip({ label, count, children, onClear }: ChipProps) {
  const active = count > 0;
  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={active ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('h-7 gap-1 text-[12px]', active ? 'rounded-r-none font-medium' : '')}
          >
            {active ? `${label}: ${count}` : label}
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <Button
          variant="secondary"
          size="sm"
          className="h-7 rounded-l-none border-l border-border px-1.5"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  onChange,
  context,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  context: IssueContext;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip
        label="Assignee"
        count={filters.assigneeId.length}
        onClear={() => onChange({ ...filters, assigneeId: [] })}
      >
        {context.allMembers.map((m) => (
          <DropdownMenuCheckboxItem
            key={m.accountId}
            checked={filters.assigneeId.includes(m.accountId)}
            onCheckedChange={() =>
              onChange({ ...filters, assigneeId: toggle(filters.assigneeId, m.accountId) })
            }
          >
            {m.email.split('@')[0]}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuCheckboxItem
          checked={filters.assigneeId.includes('unassigned')}
          onCheckedChange={() =>
            onChange({ ...filters, assigneeId: toggle(filters.assigneeId, 'unassigned') })
          }
        >
          Unassigned
        </DropdownMenuCheckboxItem>
      </FilterChip>

      <FilterChip
        label="Priority"
        count={filters.priority.length}
        onClear={() => onChange({ ...filters, priority: [] })}
      >
        {PRIORITY_NAMES.map((name, value) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={filters.priority.includes(value)}
            onCheckedChange={() =>
              onChange({ ...filters, priority: toggle(filters.priority, value) })
            }
          >
            {name}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      <FilterChip
        label="Label"
        count={filters.labelId.length}
        onClear={() => onChange({ ...filters, labelId: [] })}
      >
        {context.allLabels.map((l) => (
          <DropdownMenuCheckboxItem
            key={l.id}
            checked={filters.labelId.includes(l.id)}
            onCheckedChange={() => onChange({ ...filters, labelId: toggle(filters.labelId, l.id) })}
          >
            <span
              className="mr-1.5 inline-block size-2 rounded-full"
              style={{ background: l.color }}
            />
            {l.name}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      {filtersActive(filters) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[12px] text-muted-foreground"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

export function StateFilterChip({
  filters,
  onChange,
  context,
  projectId,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  context: IssueContext;
  projectId: string | undefined;
}) {
  const project = projectId ? context.projectsById.get(projectId) : undefined;
  const states = context.statesForProject(project);

  return (
    <FilterChip
      label="State"
      count={filters.stateId.length}
      onClear={() => onChange({ ...filters, stateId: [] })}
    >
      {states.map((s) => (
        <DropdownMenuCheckboxItem
          key={s.id}
          checked={filters.stateId.includes(s.id)}
          onCheckedChange={() => onChange({ ...filters, stateId: toggle(filters.stateId, s.id) })}
        >
          <StateIcon category={s.category} color={s.color} className="mr-1.5 size-3" />
          {s.name}
        </DropdownMenuCheckboxItem>
      ))}
    </FilterChip>
  );
}

export function ViewsMenu({
  filters,
  groupBy,
  sort,
  onApply,
}: {
  filters: FilterState;
  groupBy: string;
  sort: string;
  onApply: (view: SavedView) => void;
}) {
  const views = useSavedViews();
  const create = useCreateSavedView();
  const del = useDeleteSavedView();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const save = () => {
    if (!name.trim()) return;
    const body: {
      name: string;
      filters: ReturnType<typeof filtersToApi>;
      groupBy?: string;
      sort: string;
    } = {
      name: name.trim(),
      filters: filtersToApi(filters),
      sort,
    };
    if (groupBy !== 'none') body.groupBy = groupBy;
    create.mutate(body, {
      onSuccess: () => {
        setName('');
        setNaming(false);
      },
      onError: () => toast('Could not save the view.'),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[12px]">
          <Bookmark className="size-3.5" />
          Views
          {views.data && views.data.length > 0 && (
            <span className="text-faint">{views.data.length}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {views.data && views.data.length > 0 ? (
          <>
            {views.data.map((view) => (
              <div key={view.id} className="flex items-center">
                <button
                  className="flex flex-1 items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-secondary"
                  onClick={() => onApply(view)}
                >
                  {view.name}
                </button>
                <button
                  className="px-2 py-1.5 text-faint hover:text-destructive"
                  aria-label="Delete view"
                  onClick={() =>
                    del.mutate(view.id, { onError: () => toast('Could not delete the view.') })
                  }
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : (
          <p className="px-2 py-1.5 text-[12px] text-faint">No saved views yet.</p>
        )}

        {naming ? (
          <div className="flex items-center gap-1 px-2 py-1.5">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') {
                  setNaming(false);
                  setName('');
                }
              }}
              placeholder="View name…"
              className="h-6 text-[12px]"
            />
            <Button
              size="sm"
              className="h-6 px-2 text-[12px]"
              onClick={save}
              disabled={create.isPending}
            >
              Save
            </Button>
          </div>
        ) : (
          <button
            className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-secondary"
            onClick={() => setNaming(true)}
          >
            <Plus className="size-3.5" />
            Save current view
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
