import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Button, EmptyState, Input, Label } from '@promaly/ui';
import { FolderKanban } from 'lucide-react';

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

export function ProjectsScreen() {
  return (
    <Page title="Projects" wide>
      <EmptyState
        icon={<FolderKanban />}
        title="No projects yet"
        description="Projects group issues, workflows, and labels for a team."
        action={
          <Button asChild>
            <Link to="/projects/new">Create project</Link>
          </Button>
        }
      />
    </Page>
  );
}

export function NewProjectScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  return (
    <Page title="Create project">
      <h1 className="mb-4 text-[19px] font-semibold">Create project</h1>
      <form
        className="flex max-w-sm flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          // Wiring to POST /v1/projects lands with the S6 issue surface.
          void navigate({ to: '/' });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="Marketing site"
            required
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={name.trim().length < 2}>
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
