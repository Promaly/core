import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, Input, Label, toast } from '@promaly/ui';
import { useWorkspaceApi, useWorkspaceId } from '../issues/data.js';

export function Page({
  title,
  children,
  wide,
}: {
  title: string;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? 'p-6' : 'mx-auto max-w-[880px] p-6'}>
      <h2 className="sr-only">{title}</h2>
      {children}
    </section>
  );
}

export function NewProjectScreen() {
  const navigate = useNavigate();
  const client = useWorkspaceApi();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');

  const create = useMutation({
    mutationFn: () => client!.createProject({ key: key.trim().toUpperCase(), name: name.trim() }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['ws', workspaceId, 'projects'] });
      void navigate({ to: '/projects/$projectKey', params: { projectKey: project.key } });
    },
    onError: (error) =>
      toast(error instanceof Error ? error.message : 'Could not create the project.'),
  });

  const keyValid = /^[A-Z][A-Z0-9]{1,9}$/.test(key.trim().toUpperCase());

  return (
    <Page title="Create project">
      <h1 className="mb-4 text-[19px] font-semibold">Create project</h1>
      <form
        className="flex max-w-sm flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (keyValid && name.trim().length >= 2) create.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
              if (!key)
                setKey(
                  event.currentTarget.value
                    .replace(/[^A-Za-z0-9]/g, '')
                    .slice(0, 4)
                    .toUpperCase(),
                );
            }}
            placeholder="Marketing site"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-key">Key</Label>
          <Input
            id="project-key"
            value={key}
            onChange={(event) => setKey(event.currentTarget.value.toUpperCase())}
            placeholder="MKT"
            aria-invalid={key.length > 0 && !keyValid}
          />
          <span className="text-[12px] text-faint">
            2–10 chars, starts with a letter. Issues read PROJ-123.
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending || !keyValid || name.trim().length < 2}>
            Create project
          </Button>
          <Button type="button" variant="ghost" onClick={() => void navigate({ to: '/' })}>
            Cancel
          </Button>
        </div>
      </form>
    </Page>
  );
}

export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <Page title={title} wide>
      <EmptyState title={title} description={note} />
    </Page>
  );
}
