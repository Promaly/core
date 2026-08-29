import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  toast,
} from '@promaly/ui';
import { useCreateIssue } from './data.js';

export function NewIssueDialog({
  open,
  onOpenChange,
  projectId,
  defaultStateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  defaultStateId?: string | undefined;
}) {
  const create = useCreateIssue();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const submit = (openAfter: boolean) => {
    if (title.trim().length === 0) return;
    create.mutate(
      {
        projectId,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(defaultStateId ? { stateId: defaultStateId } : {}),
      },
      {
        onSuccess: (issue) => {
          setTitle('');
          setDescription('');
          onOpenChange(false);
          if (openAfter) void navigate({ to: '/issues/$issueId', params: { issueId: issue.id } });
        },
        onError: () => toast('Could not create the issue.'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue-title">Title</Label>
            <Input
              id="issue-title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Something to do"
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue-description">Description</Label>
            <Textarea
              id="issue-description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder="Markdown supported"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => submit(true)}
              disabled={create.isPending || title.trim().length === 0}
            >
              Create &amp; open
            </Button>
            <Button type="submit" disabled={create.isPending || title.trim().length === 0}>
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
