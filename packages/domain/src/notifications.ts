import { defaultNotificationPreferences, type NotificationPreferences } from './index.js';

export type FanoutKind = 'comment' | 'assignment' | 'mention';

/** Compute the set of account IDs that should receive a notification for an event.
 *  The actor is always excluded from their own notifications. */
export function computeRecipients(params: {
  actorId: string;
  assigneeId?: string | null;
  authorId: string;
  mentionIds?: string[];
}): Set<string> {
  const { actorId, assigneeId, authorId, mentionIds = [] } = params;
  const recipients = new Set<string>();
  recipients.add(authorId);
  if (assigneeId) recipients.add(assigneeId);
  for (const id of mentionIds) recipients.add(id);
  recipients.delete(actorId);
  return recipients;
}

/** Whether a recipient with the given prefs should receive a notification of this kind. */
export function shouldNotify(
  prefs: Partial<NotificationPreferences>,
  kind: FanoutKind,
  isMentioned: boolean,
): boolean {
  const effective: NotificationPreferences = { ...defaultNotificationPreferences, ...prefs };
  if (!effective.inApp) return false;
  // Explicit @mention always wins over the comment pref.
  if (isMentioned && effective.mentions) return true;
  if (kind === 'comment') return effective.comments;
  if (kind === 'assignment') return effective.assignments;
  if (kind === 'mention') return effective.mentions;
  return false;
}
