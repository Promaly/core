import { Link } from '@tanstack/react-router';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  EmptyState,
  Identifier,
  Input,
  LabelChip,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@promaly/ui';
import { Link2, Plus, Unlink } from 'lucide-react';
import type { IssueRelation } from '../api.js';
import { ApiError } from '../api.js';
import { useIssueContext } from './context.js';
import {
  useCreateIssue,
  useCreateRelation,
  useDeleteRelation,
  useIssue,
  useIssueSearch,
  useLabels,
  useRelations,
  useSubIssues,
  useUpdateIssue,
} from './data.js';
import { AssigneePicker, LabelPicker, PriorityPicker, StatePicker } from './pickers.js';
import { ActivityFeed } from './activity.js';
import { NewIssueDialog } from './new-issue.js';

const md = new MarkdownIt({ linkify: true, breaks: true });

const RELATION_LABELS: Record<IssueRelation['type'], string> = {
  blocks: 'Blocks',
  relates_to: 'Relates to',
  duplicates: 'Duplicates',
};

export function IssueDetailScreen({ issueId }: { issueId: string }) {
  const context = useIssueContext();
  const query = useIssue(issueId);
  const subIssues = useSubIssues(issueId);
  const relations = useRelations(issueId);
  const deleteRelation = useDeleteRelation(issueId);
  const createRelation = useCreateRelation(issueId);
  const { data: allLabels } = useLabels();
  const update = useUpdateIssue();
  const createSubIssue = useCreateIssue();

  const issue = query.data;
  const [draft, setDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sub-issue quick-create
  const [subTitle, setSubTitle] = useState('');

  // New sub-issue dialog
  const [showNewSubIssue, setShowNewSubIssue] = useState(false);

  // Add relation
  const [showRelationPicker, setShowRelationPicker] = useState(false);
  const [relationQuery, setRelationQuery] = useState('');
  const [relationType, setRelationType] = useState<IssueRelation['type']>('relates_to');
  const searchResults = useIssueSearch(relationQuery.length > 1 ? relationQuery : '');

  useEffect(() => {
    setDraft(null);
    setEditingTitle(false);
  }, [issueId]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const previewHtml = useMemo(
    () => DOMPurify.sanitize(md.render(draft ?? issue?.description ?? '')),
    [draft, issue?.description],
  );

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-[960px] p-6">
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (query.isError || !issue) {
    return <EmptyState title="Issue not found" description="It may have been archived or moved." />;
  }

  const project = context.projectsById.get(issue.projectId);
  const states = context.statesForProject(project);
  const dirty = draft !== null && draft !== issue.description;

  const save = () => {
    if (draft === null) return;
    update.mutate(
      { issue, patch: { description: draft } },
      {
        onSuccess: () => {
          setDraft(null);
          toast('Description saved.');
        },
        onError: (error) =>
          toast(
            error instanceof ApiError && error.isConflict
              ? 'This issue changed elsewhere — reopen to get the latest.'
              : 'Could not save the description.',
          ),
      },
    );
  };

  const saveTitle = () => {
    if (!titleDraft.trim() || titleDraft === issue.title) {
      setEditingTitle(false);
      return;
    }
    update.mutate(
      { issue, patch: { title: titleDraft.trim() } },
      {
        onSuccess: () => setEditingTitle(false),
        onError: () => {
          toast('Could not save the title.');
          setEditingTitle(false);
        },
      },
    );
  };

  const patch = (body: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ issue, patch: body }, { onError: () => toast('Could not save the change.') });

  const toggleLabel = (labelId: string, active: boolean) => {
    const current = issue.labels.map((l) => l.id);
    const next = active ? current.filter((id) => id !== labelId) : [...current, labelId];
    patch({ labelIds: next });
  };

  const submitSubIssue = () => {
    if (!subTitle.trim()) return;
    createSubIssue.mutate(
      { projectId: issue.projectId, title: subTitle.trim(), parentIssueId: issue.id },
      {
        onSuccess: () => setSubTitle(''),
        onError: () => toast('Could not create sub-issue.'),
      },
    );
  };

  const submitRelation = (targetIssueId: string) => {
    createRelation.mutate(
      { targetIssueId, type: relationType },
      {
        onSuccess: () => {
          setShowRelationPicker(false);
          setRelationQuery('');
        },
        onError: () => toast('Could not add relation.'),
      },
    );
  };

  return (
    <div className="mx-auto grid max-w-[1000px] grid-cols-[minmax(0,1fr)_260px] gap-8 p-6">
      <div className="min-w-0">
        <nav className="mb-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          {project && (
            <Link
              to="/projects/$projectKey"
              params={{ projectKey: project.key }}
              className="hover:underline"
            >
              {project.name}
            </Link>
          )}
          <span>/</span>
          <span>{context.identifier(issue)}</span>
        </nav>

        {editingTitle ? (
          <Input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.currentTarget.value)}
            className="mb-2 text-[19px] font-semibold"
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <h1
            className="cursor-text text-[19px] font-semibold hover:bg-secondary/40 rounded px-1 -mx-1"
            onClick={() => {
              setTitleDraft(issue.title);
              setEditingTitle(true);
            }}
            title="Click to edit title"
          >
            {issue.title}
          </h1>
        )}

        <div className="mt-4">
          <Tabs value={mode} onValueChange={(value) => setMode(value as 'write' | 'preview')}>
            <div className="mb-2 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="write">Write</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              {dirty && (
                <Button size="sm" onClick={save} disabled={update.isPending}>
                  Save
                </Button>
              )}
            </div>
            <TabsContent value="write">
              <Textarea
                aria-label="Issue description"
                className="min-h-[200px]"
                value={draft ?? issue.description}
                onChange={(event) => setDraft(event.currentTarget.value)}
                placeholder="Add a description in Markdown…"
              />
            </TabsContent>
            <TabsContent value="preview">
              {previewHtml.trim() ? (
                <article
                  className="prose-sm max-w-none rounded-md border border-border p-3 text-[13px] leading-relaxed [&_a]:text-primary [&_a]:underline [&_code]:font-mono [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-[13px] text-faint">Nothing to preview.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Separator className="my-6" />

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">
              Sub-issues{' '}
              {subIssues.data && subIssues.data.length > 0 && (
                <span className="text-faint">{subIssues.data.length}</span>
              )}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewSubIssue(true)}
              className="h-6 gap-1 px-2 text-[12px]"
            >
              <Plus className="size-3" />
              Add
            </Button>
          </div>
          {subIssues.data && subIssues.data.length > 0 && (
            <ul className="flex flex-col">
              {subIssues.data.map((sub) => (
                <li key={sub.id}>
                  <Link
                    to="/issues/$issueId"
                    params={{ issueId: sub.id }}
                    className="flex items-center gap-2 border-b border-border/60 py-1.5 text-[13px] hover:bg-secondary/40"
                  >
                    <Identifier value={context.identifier(sub)} className="w-16" />
                    <span className="truncate">{sub.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="Quick add sub-issue…"
              value={subTitle}
              onChange={(e) => setSubTitle(e.currentTarget.value)}
              className="h-8 text-[13px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSubIssue();
                if (e.key === 'Escape') setSubTitle('');
              }}
            />
            {subTitle.trim() && (
              <Button
                size="sm"
                onClick={submitSubIssue}
                disabled={createSubIssue.isPending}
                className="h-8"
              >
                Add
              </Button>
            )}
          </div>
        </section>

        <Separator className="my-6" />

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">Relations</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRelationPicker((v) => !v)}
              className="h-6 gap-1 px-2 text-[12px]"
            >
              <Link2 className="size-3" />
              Add
            </Button>
          </div>

          {showRelationPicker && (
            <div className="mb-3 flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex gap-2">
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.currentTarget.value as IssueRelation['type'])}
                  className="h-8 rounded border border-border bg-background px-2 text-[12px] text-foreground"
                >
                  <option value="relates_to">Relates to</option>
                  <option value="blocks">Blocks</option>
                  <option value="duplicates">Duplicates</option>
                </select>
                <Input
                  placeholder="Search by title or identifier…"
                  value={relationQuery}
                  onChange={(e) => setRelationQuery(e.currentTarget.value)}
                  className="h-8 flex-1 text-[13px]"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setShowRelationPicker(false);
                    setRelationQuery('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              {relationQuery.length > 1 && searchResults.data && (
                <ul className="flex flex-col rounded-md border border-border">
                  {searchResults.data.length === 0 ? (
                    <li className="px-3 py-2 text-[13px] text-faint">No issues found.</li>
                  ) : (
                    searchResults.data.slice(0, 8).map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-secondary"
                          onClick={() => submitRelation(hit.id)}
                          disabled={createRelation.isPending}
                        >
                          <span className="font-mono text-[11px] text-faint">
                            {hit.projectId.slice(0, 4)}-{hit.number}
                          </span>
                          <span className="truncate">{hit.title}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}

          {relations.data && relations.data.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {relations.data.map((rel) => {
                const targetId =
                  rel.sourceIssueId === issueId ? rel.targetIssueId : rel.sourceIssueId;
                return (
                  <li key={rel.id} className="flex items-center gap-2 text-[13px]">
                    <span className="w-20 shrink-0 text-[12px] text-faint">
                      {RELATION_LABELS[rel.type]}
                    </span>
                    <Link
                      to="/issues/$issueId"
                      params={{ issueId: targetId }}
                      className="flex-1 truncate hover:underline"
                    >
                      <Identifier value={targetId.slice(0, 8)} className="mr-1.5" />
                    </Link>
                    <button
                      className="text-faint hover:text-destructive"
                      aria-label="Remove relation"
                      onClick={() =>
                        deleteRelation.mutate(rel.id, {
                          onError: () => toast('Could not remove the relation.'),
                        })
                      }
                    >
                      <Unlink className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            !showRelationPicker && <p className="text-[13px] text-faint">No relations.</p>
          )}
        </section>

        <Separator className="my-6" />

        <ActivityFeed issueId={issueId} />
      </div>

      <aside className="flex flex-col gap-4 text-[13px]">
        <Property label="Status">
          <StatePicker issue={issue} states={states} onPick={(stateId) => patch({ stateId })} />
        </Property>
        <Property label="Priority">
          <PriorityPicker issue={issue} onPick={(priority) => patch({ priority })} />
        </Property>
        <Property label="Assignee">
          <AssigneePicker
            issue={issue}
            context={context}
            onPick={(assigneeId) => patch({ assigneeId })}
          />
        </Property>
        <Property label="Labels">
          <LabelPicker
            issue={issue}
            labels={(allLabels ?? []).map((l) => ({ id: l.id, name: l.name, color: l.color }))}
            onToggle={toggleLabel}
          />
          {issue.labels.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <LabelChip key={label.id} name={label.name} color={label.color} />
              ))}
            </div>
          )}
        </Property>
        <Property label="Due date">
          <DueDatePicker issue={issue} onPick={(dueAt) => patch({ dueAt })} />
        </Property>
        <Property label="Estimate">
          <EstimatePicker issue={issue} onPick={(estimate) => patch({ estimate })} />
        </Property>
        <Property label="Revision">
          <span className="font-mono text-faint">r{issue.revision}</span>
        </Property>
      </aside>

      <NewIssueDialog
        open={showNewSubIssue}
        onOpenChange={setShowNewSubIssue}
        projectId={issue.projectId}
        parentIssueId={issue.id}
      />
    </div>
  );
}

function DueDatePicker({
  issue,
  onPick,
}: {
  issue: { id: string; dueAt: string | null };
  onPick: (dueAt: string | null) => void;
}) {
  const value = issue.dueAt ? issue.dueAt.slice(0, 10) : '';
  const isOverdue =
    issue.dueAt &&
    new Date(issue.dueAt) < new Date() &&
    issue.dueAt.slice(0, 10) !== new Date().toISOString().slice(0, 10);
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onPick(e.currentTarget.value || null)}
      className={[
        'h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground w-full',
        isOverdue ? 'text-destructive border-destructive/50' : '',
      ].join(' ')}
    />
  );
}

const ESTIMATES = [1, 2, 3, 5, 8, 13, 21];

function EstimatePicker({
  issue,
  onPick,
}: {
  issue: { id: string; estimate: number | null };
  onPick: (estimate: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {ESTIMATES.map((pt) => (
        <button
          key={pt}
          type="button"
          onClick={() => onPick(issue.estimate === pt ? null : pt)}
          className={[
            'h-7 min-w-[28px] rounded px-1.5 text-[12px] font-medium transition-colors',
            issue.estimate === pt
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          ].join(' ')}
        >
          {pt}
        </button>
      ))}
    </div>
  );
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</span>
      {children}
    </div>
  );
}
