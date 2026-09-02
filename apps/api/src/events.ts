import type { FastifyReply } from 'fastify';

export type WorkspaceEvent = { type: 'issue.changed' } | { type: 'notification.created' };

type Subscriber = { reply: FastifyReply; workspaceId: string };

/** In-process SSE broadcaster — one entry per connected client. */
export class EventBroadcaster {
  private readonly subscribers = new Set<Subscriber>();

  subscribe(workspaceId: string, reply: FastifyReply): () => void {
    const sub: Subscriber = { reply, workspaceId };
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  emit(workspaceId: string, event: WorkspaceEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const sub of this.subscribers) {
      if (sub.workspaceId === workspaceId) {
        try {
          sub.reply.raw.write(payload);
        } catch {
          this.subscribers.delete(sub);
        }
      }
    }
  }
}
