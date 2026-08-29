import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from './errors.js';

describe('isUniqueViolation', () => {
  it('matches a bare PostgresError', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('matches a code carried on the cause chain (DrizzleQueryError shape)', () => {
    const wrapped = Object.assign(new Error('Failed query: insert into "labels"…'), {
      cause: Object.assign(new Error('duplicate key'), { code: '23505' }),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('rejects other errors', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('nope')).toBe(false);
  });

  it('terminates on a self-referential cause', () => {
    const loop: { code?: string; cause?: unknown } = {};
    loop.cause = loop;
    expect(isUniqueViolation(loop)).toBe(false);
  });
});
