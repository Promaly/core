import { describe, expect, it } from 'vitest';
import { computeRecipients, shouldNotify } from './notifications.js';

const ACTOR = 'actor-id';
const AUTHOR = 'author-id';
const ASSIGNEE = 'assignee-id';
const MENTION = 'mention-id';

describe('computeRecipients', () => {
  it('returns author + assignee + mentions minus the actor', () => {
    const result = computeRecipients({
      actorId: ACTOR,
      assigneeId: ASSIGNEE,
      authorId: AUTHOR,
      mentionIds: [MENTION],
    });
    expect(result).toEqual(new Set([AUTHOR, ASSIGNEE, MENTION]));
  });

  it('excludes the actor even if they are the author', () => {
    const result = computeRecipients({
      actorId: AUTHOR,
      assigneeId: ASSIGNEE,
      authorId: AUTHOR,
    });
    expect(result).toEqual(new Set([ASSIGNEE]));
  });

  it('excludes the actor even if they are the assignee', () => {
    const result = computeRecipients({
      actorId: ASSIGNEE,
      assigneeId: ASSIGNEE,
      authorId: AUTHOR,
    });
    expect(result).toEqual(new Set([AUTHOR]));
  });

  it('deduplicates recipients', () => {
    const result = computeRecipients({
      actorId: ACTOR,
      assigneeId: AUTHOR,
      authorId: AUTHOR,
    });
    expect(result).toEqual(new Set([AUTHOR]));
  });

  it('returns empty set when only recipient is the actor', () => {
    const result = computeRecipients({ actorId: ACTOR, authorId: ACTOR });
    expect(result.size).toBe(0);
  });

  it('handles no assignee', () => {
    const result = computeRecipients({ actorId: ACTOR, assigneeId: null, authorId: AUTHOR });
    expect(result).toEqual(new Set([AUTHOR]));
  });
});

describe('shouldNotify', () => {
  it('returns true for comment kind with default prefs', () => {
    expect(shouldNotify({}, 'comment', false)).toBe(true);
  });

  it('returns false when inApp is disabled', () => {
    expect(shouldNotify({ inApp: false }, 'comment', false)).toBe(false);
  });

  it('returns false for comment kind when comments pref is off', () => {
    expect(shouldNotify({ comments: false }, 'comment', false)).toBe(false);
  });

  it('returns false for assignment kind when assignments pref is off', () => {
    expect(shouldNotify({ assignments: false }, 'assignment', false)).toBe(false);
  });

  it('returns true for mentioned recipient even if comments pref is off', () => {
    expect(shouldNotify({ comments: false }, 'comment', true)).toBe(true);
  });

  it('returns false for mentioned recipient if mentions pref is off', () => {
    expect(shouldNotify({ comments: false, mentions: false }, 'comment', true)).toBe(false);
  });
});
