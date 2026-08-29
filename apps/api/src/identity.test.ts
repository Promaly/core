import { describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { createIdentityService } from './identity.js';

function selectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({ limit: async () => rows }),
      innerJoin: () => ({ where: () => ({ limit: async () => rows }) }),
    }),
  };
}

describe('identity service hardening', () => {
  it('performs Argon2 verification when the email does not exist', async () => {
    const verify = vi.spyOn(argon2, 'verify').mockResolvedValue(false);
    const database = { db: { select: () => selectChain([]) } } as never;
    const identity = createIdentityService(database);

    await expect(
      identity.login({ email: 'missing@example.com', password: 'a-secure-password' }, {}),
    ).rejects.toThrow('Invalid email or password.');
    expect(verify).toHaveBeenCalledOnce();
    verify.mockRestore();
  });

  it('does not update last_seen_at for a fresh session', async () => {
    let selectCount = 0;
    const freshSession = {
      sessionId: 'session-id',
      accountId: 'account-id',
      email: 'owner@example.com',
      accountCreatedAt: new Date('2026-08-28T00:00:00.000Z'),
      lastSeenAt: new Date(),
    };
    const database = {
      db: {
        select: () => {
          selectCount += 1;
          if (selectCount === 1) return selectChain([freshSession]);
          return { from: () => ({ innerJoin: () => ({ where: async () => [] }) }) };
        },
        update: () => {
          throw new Error('last_seen_at should not be updated');
        },
      },
    } as never;
    const identity = createIdentityService(database);

    await expect(identity.getSession('opaque-token')).resolves.toMatchObject({
      account: { id: 'account-id' },
      workspaces: [],
    });
  });
});
