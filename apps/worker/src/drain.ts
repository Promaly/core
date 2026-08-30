import type { DatabaseClient } from '@promaly/db';
import type { MailPort } from '@promaly/domain';

type Sql = DatabaseClient['raw'];

export type OutboxRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export type DrainDeps = { mail: MailPort };
export type DrainResult = {
  claimed: number;
  processed: number;
  retried: number;
  deadLettered: number;
};

/**
 * Event types the worker recognises but that have no side effect yet — their
 * consumers arrive in later slices. They are marked processed on sight rather
 * than left pending forever or retried.
 */
const KNOWN_NOOP_EVENTS = new Set([
  'workspace.created',
  'workflow.seeded',
  'notification.fanout',
  'invitation.created',
  'invitation.accepted',
  'invitation.revoked',
  'membership.changed',
  'workspace.updated',
  'workspace.deleted',
  'team.created',
  'team.updated',
  'team.deleted',
  'team.members.changed',
  'workflow.created',
  'workflow.updated',
  'workflow.state.changed',
  'project.created',
  'project.updated',
  'project.archived',
  'project.unarchived',
  'label.created',
  'label.updated',
  'label.deleted',
  'issue.created',
  'issue.updated',
  'issue.archived',
  'issue.moved',
  'issue.relation.created',
  'issue.relation.deleted',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'attachment.added',
  'attachment.removed',
  'saved_view.created',
  'saved_view.updated',
  'saved_view.deleted',
]);
const MAX_ATTEMPTS = 8;
const MAX_BACKOFF_SECONDS = 300;

export class UnhandledEventError extends Error {
  constructor(type: string) {
    super(`No handler for outbox event type "${type}"`);
    this.name = 'UnhandledEventError';
  }
}

export async function dispatchEvent(event: OutboxRow, deps: DrainDeps): Promise<void> {
  if (event.type === 'email.send') {
    const { to, subject, text } = event.payload as {
      to?: string;
      subject?: string;
      text?: string;
    };
    if (!to || !subject || !text) throw new Error('email.send payload is incomplete');
    await deps.mail.send({ to, subject, text });
    return;
  }
  if (KNOWN_NOOP_EVENTS.has(event.type)) return;
  throw new UnhandledEventError(event.type);
}

/**
 * Claims a batch of due outbox events with `FOR UPDATE SKIP LOCKED`, dispatches
 * each, and either marks it processed, schedules a backoff retry, or
 * dead-letters it (permanent failure or attempts exhausted). Runs in a single
 * transaction so a crash mid-batch leaves every unfinished event still pending.
 */
export async function drainOutbox(sql: Sql, deps: DrainDeps, batchSize = 25): Promise<DrainResult> {
  const result: DrainResult = { claimed: 0, processed: 0, retried: 0, deadLettered: 0 };

  await sql.begin(async (tx) => {
    const rows = await tx<OutboxRow[]>`
      select id, type, payload, attempts
      from outbox_events
      where processed_at is null and available_at <= now()
      order by available_at, created_at
      for update skip locked
      limit ${batchSize}`;
    result.claimed = rows.length;

    for (const event of rows) {
      try {
        await dispatchEvent(event, deps);
        await tx`
          update outbox_events
          set processed_at = now(), last_error = null
          where id = ${event.id}::uuid`;
        result.processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown outbox failure';
        const attempts = event.attempts + 1;
        const permanent = error instanceof UnhandledEventError || attempts >= MAX_ATTEMPTS;

        if (permanent) {
          await tx`
            update outbox_events
            set attempts = ${attempts}, last_error = ${message}, processed_at = now()
            where id = ${event.id}::uuid`;
          result.deadLettered += 1;
        } else {
          const backoff = Math.min(2 ** attempts, MAX_BACKOFF_SECONDS);
          await tx`
            update outbox_events
            set attempts = ${attempts},
                last_error = ${message},
                available_at = now() + (${backoff} * interval '1 second')
            where id = ${event.id}::uuid`;
          result.retried += 1;
        }
      }
    }
  });

  return result;
}
