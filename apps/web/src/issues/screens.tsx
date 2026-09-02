import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button, EmptyState, Identifier, Input, Skeleton, StateIcon } from '@promaly/ui';
import { FolderKanban, Search as SearchIcon } from 'lucide-react';
import { useSession } from '../session.js';
import { useIssueContext } from './context.js';
import { useIssues, useIssueSearch, useProjects } from './data.js';
import { AssigneeAvatar } from './pickers.js';

export function ProjectsScreen() {
  const projects = useProjects();
  const navigate = useNavigate();

  if (projects.isPending) {
    return (
      <div className="mx-auto grid max-w-[880px] gap-3 p-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!projects.data || projects.data.length === 0) {
    return (
      <EmptyState
        icon={<FolderKanban />}
        title="Create your first project"
        description="Projects are the home for your issues, board, and team workflow."
        action={<Button onClick={() => void navigate({ to: '/projects/new' })}>New project</Button>}
      />
    );
  }

  return (
    <div className="mx-auto grid max-w-[880px] gap-3 p-6 sm:grid-cols-2">
      {projects.data.map((project) => (
        <Link
          key={project.id}
          to="/projects/$projectKey"
          params={{ projectKey: project.key }}
          className="flex flex-col gap-1 rounded-md border border-border p-4 hover:bg-secondary/40"
        >
          <div className="flex items-center gap-2">
            <span
              className="flex size-6 items-center justify-center rounded text-[11px] font-semibold text-primary-foreground"
              style={{ background: project.color ?? 'var(--primary)' }}
            >
              {project.key.slice(0, 2)}
            </span>
            <span className="font-medium">{project.name}</span>
            <Identifier value={project.key} className="ml-auto" />
          </div>
          {project.description && (
            <p className="line-clamp-2 text-[13px] text-muted-foreground">{project.description}</p>
          )}
        </Link>
      ))}
    </div>
  );
}

export function MyWorkScreen() {
  const { data: session } = useSession();
  const me = session?.account.id;
  const context = useIssueContext();
  const issues = useIssues(me ? { assigneeId: [me], sort: 'updated', limit: 100 } : {});

  return (
    <div className="mx-auto max-w-[880px] p-6">
      <h1 className="mb-4 text-[19px] font-semibold">My work</h1>
      {issues.isPending ? (
        <ListSkeleton />
      ) : !issues.data || issues.data.items.length === 0 ? (
        <EmptyState
          title="Nothing assigned"
          description="Issues assigned to you will show up here."
        />
      ) : (
        <ul className="flex flex-col">
          {issues.data.items.map((issue) => {
            const state = context.state(issue.stateId);
            return (
              <li key={issue.id}>
                <Link
                  to="/issues/$issueId"
                  params={{ issueId: issue.id }}
                  className="flex items-center gap-2 border-b border-border/60 py-2 text-[13px] hover:bg-secondary/40"
                >
                  <StateIcon category={state?.category ?? 'backlog'} color={state?.color} />
                  <Identifier value={context.identifier(issue)} className="w-16" />
                  <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                  <AssigneeAvatar email={context.member(issue.assigneeId)?.email ?? null} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const context = useIssueContext();
  const results = useIssueSearch(query);

  return (
    <div className="mx-auto max-w-[880px] p-6">
      <h1 className="mb-4 text-[19px] font-semibold">Search</h1>
      <div className="relative mb-4">
        <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input
          className="pl-8"
          placeholder="Search issues by title or description…"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          autoFocus
        />
      </div>
      {query.trim().length <= 1 ? (
        <p className="text-[13px] text-faint">Type at least two characters.</p>
      ) : results.isPending ? (
        <ListSkeleton />
      ) : !results.data || results.data.length === 0 ? (
        <p className="text-[13px] text-faint">No matching issues.</p>
      ) : (
        <ul className="flex flex-col">
          {results.data.map((hit) => (
            <li key={hit.id}>
              <Link
                to="/issues/$issueId"
                params={{ issueId: hit.id }}
                className="flex items-center gap-2 border-b border-border/60 py-2 text-[13px] hover:bg-secondary/40"
              >
                <Identifier value={context.identifier(hit)} className="w-16" />
                <span className="min-w-0 flex-1 truncate">{hit.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}
