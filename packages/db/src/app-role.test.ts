import { describe, expect, it, vi } from 'vitest';
import { ensureAppRole } from './app-role.js';

describe('ensureAppRole', () => {
  it('rejects a password that is not the generated 96-hex secret', async () => {
    const sql = vi.fn() as never;
    await expect(ensureAppRole(sql, 'too-short')).rejects.toThrow(/96-hex/);
    await expect(ensureAppRole(sql, 'coolify-injected-value')).rejects.toThrow(/96-hex/);
  });

  it('runs one statement for a valid secret', async () => {
    const unsafe = vi.fn().mockResolvedValue(undefined);
    const sql = { unsafe } as unknown as Parameters<typeof ensureAppRole>[0];
    await ensureAppRole(sql, 'a'.repeat(96));
    expect(unsafe).toHaveBeenCalledOnce();
    expect(unsafe.mock.calls[0]![0]).toContain('promaly_app');
  });
});
