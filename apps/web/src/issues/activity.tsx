import { useRef, useState } from 'react';
import { Avatar, AvatarFallback, Button, Separator, Skeleton, Textarea, toast } from '@promaly/ui';
import type { ActivityEvent } from '../api.js';
import { useSession } from '../session.js';
import { initials } from './context.js';
import {
  useCreateComment,
  useDeleteComment,
  useTimeline,
  useUpdateComment,
} from './data.js';

// ── Activity event formatting ─────────────────────────────────────────────────

function activityText(event: ActivityEvent): string {
  const d = event.data as Record<string, unknown>;
  switch (event.type) {
    case 'issue.created':
      return 'created this issue';
    case 'issue.state_changed':
      return `changed state to ${String(d.toName ?? '')}`;
    case 'issue.priority_changed':
      return `changed priority to ${String(d.toName ?? '')}`;
    case 'issue.assigned':
      return d.toEmail ? `assigned to ${String(d.toEmail)}` : 'unassigned';
    case 'issue.title_changed':
      return 'updated the title';
    case 'issue.description_changed':
      return 'updated the description';
    case 'issue.label_added':
      return `added label ${String(d.labelName ?? '')}`;
    case 'issue.label_removed':
      return `removed label ${String(d.labelName ?? '')}`;
    case 'issue.archived':
      return 'archived this issue';
    case 'comment.updated':
      return 'edited a comment';
    case 'comment.deleted':
      return 'deleted a comment';
    default:
      return event.type.replace(/[._]/g, ' ');
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// ── Comment block ─────────────────────────────────────────────────────────────

function CommentBlock({
  event,
  currentAccountId,
  issueId,
}: {
  event: ActivityEvent;
  currentAccountId: string;
  issueId: string;
}) {
  const [editing, setEditing] = useState(false);
  const data = event.data as { body?: string; authorId?: string };
  const [draft, setDraft] = useState(data.body ?? '');
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const commentId = event.commentId!;
  const isAuthor = event.actorId === currentAccountId;

  function handleSave() {
    if (!draft.trim()) return;
    updateComment.mutate(
      { commentId, body: draft.trim(), issueId },
      {
        onSuccess: () => setEditing(false),
        onError: () => toast('Could not save the comment.'),
      },
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar className="mt-0.5 size-6 shrink-0">
        <AvatarFallback className="text-[10px]">{initials(event.actorEmail)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-[13px] font-medium">
            {event.actorEmail.split('@')[0]}
          </span>
          <span className="text-[12px] text-faint">{relativeTime(event.createdAt)}</span>
          {(event.data as { editedAt?: string }).editedAt && (
            <span className="text-[12px] text-faint">(edited)</span>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              autoFocus
              className="min-h-[80px] text-[13px]"
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={updateComment.isPending || !draft.trim()}
                onClick={handleSave}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
              {data.body}
            </p>
            {isAuthor && (
              <div className="-ml-1 mt-1 flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[12px] text-faint hover:text-foreground"
                  onClick={() => {
                    setDraft(data.body ?? '');
                    setEditing(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[12px] text-faint hover:text-destructive"
                  disabled={deleteComment.isPending}
                  onClick={() => {
                    if (window.confirm('Delete this comment?')) {
                      deleteComment.mutate(
                        { commentId, issueId },
                        { onError: () => toast('Could not delete the comment.') },
                      );
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Activity event row ────────────────────────────────────────────────────────

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <Avatar className="size-5 shrink-0">
        <AvatarFallback className="text-[9px]">{initials(event.actorEmail)}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground">
        {event.actorEmail.split('@')[0]}
      </span>
      <span>{activityText(event)}</span>
      <span className="ml-auto shrink-0 text-faint">{relativeTime(event.createdAt)}</span>
    </div>
  );
}

// ── Comment composer ──────────────────────────────────────────────────────────

function CommentComposer({
  issueId,
  authorEmail,
}: {
  issueId: string;
  authorEmail: string;
}) {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const create = useCreateComment(issueId);

  function submit() {
    if (!body.trim()) return;
    create.mutate(body.trim(), {
      onSuccess: () => setBody(''),
      onError: () => toast('Could not post the comment.'),
    });
  }

  return (
    <div className="flex gap-3">
      <Avatar className="mt-0.5 size-6 shrink-0">
        <AvatarFallback className="text-[10px]">{initials(authorEmail)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-2">
        <Textarea
          ref={textareaRef}
          placeholder="Leave a comment… (⌘↵ to submit)"
          className="min-h-[80px] text-[13px]"
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
        />
        {body.trim() && (
          <div className="flex justify-end">
            <Button size="sm" disabled={create.isPending} onClick={submit}>
              {create.isPending ? 'Posting…' : 'Comment'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

const COMMENT_TYPES = new Set(['comment.created']);

export function ActivityFeed({ issueId }: { issueId: string }) {
  const { data: session } = useSession();
  const { data: entries, isPending } = useTimeline(issueId);
  const currentAccountId = session?.account.id ?? '';
  const authorEmail = session?.account.email ?? '';

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold">Activity</h2>

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="space-y-4">
          {entries.map((event) =>
            COMMENT_TYPES.has(event.type) && event.commentId ? (
              <CommentBlock
                key={event.id}
                event={event}
                currentAccountId={currentAccountId}
                issueId={issueId}
              />
            ) : (
              <ActivityRow key={event.id} event={event} />
            ),
          )}
        </div>
      ) : (
        <p className="text-[13px] text-faint">No activity yet.</p>
      )}

      <Separator className="my-5" />
      <CommentComposer issueId={issueId} authorEmail={authorEmail} />
    </section>
  );
}
