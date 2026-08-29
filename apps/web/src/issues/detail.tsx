import { Link } from '@tanstack/react-router';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  Identifier,
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
import { ApiError } from '../api.js';
import { useIssueContext } from './context.js';
import { useIssue, useSubIssues, useUpdateIssue } from './data.js';
import { AssigneePicker, PriorityPicker, StatePicker } from './pickers.js';

const md = new MarkdownIt({ linkify: true, breaks: true });

export function IssueDetailScreen({ issueId }: { issueId: string }) {
  const context = useIssueContext();
  const query = useIssue(issueId);
  const subIssues = useSubIssues(issueId);
  const update = useUpdateIssue();

  const issue = query.data;
  const [draft, setDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  useEffect(() => {
    setDraft(null);
  }, [issueId]);

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

  const patch = (body: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ issue, patch: body }, { onError: () => toast('Could not save the change.') });

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

        <h1 className="text-[19px] font-semibold">{issue.title}</h1>

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
          <h2 className="mb-2 text-[13px] font-semibold">
            Sub-issues{' '}
            {subIssues.data && subIssues.data.length > 0 && (
              <span className="text-faint">{subIssues.data.length}</span>
            )}
          </h2>
          {subIssues.data && subIssues.data.length > 0 ? (
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
          ) : (
            <p className="text-[13px] text-faint">No sub-issues.</p>
          )}
        </section>
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
        {issue.labels.length > 0 && (
          <Property label="Labels">
            <div className="flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <LabelChip key={label.id} name={label.name} color={label.color} />
              ))}
            </div>
          </Property>
        )}
        <Property label="Revision">
          <span className="font-mono text-faint">r{issue.revision}</span>
        </Property>
      </aside>
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
