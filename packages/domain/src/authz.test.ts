import { describe, expect, it } from 'vitest';
import { can, capabilities, type Capability } from './authz.js';
import { coreRoles, type CoreRole } from './index.js';

// The authoritative grant table from ADR-0007, written out independently of the
// implementation so a change to ROLE_CAPABILITIES has to be reflected here too.
const EXPECTED: Record<CoreRole, Capability[]> = {
  owner: [
    'workspace.read',
    'workspace.settings',
    'workspace.transfer',
    'member.manage',
    'project.manage',
    'issue.create',
    'issue.edit',
  ],
  admin: ['workspace.read', 'member.manage', 'project.manage', 'issue.create', 'issue.edit'],
  member: ['workspace.read', 'issue.create', 'issue.edit'],
  guest: ['workspace.read'],
};

describe('workspace capability policy', () => {
  it('grants exactly the ADR-0007 matrix for every role and capability', () => {
    for (const role of coreRoles) {
      for (const capability of capabilities) {
        expect({ role, capability, granted: can(role, capability) }).toEqual({
          role,
          capability,
          granted: EXPECTED[role].includes(capability),
        });
      }
    }
  });

  it('never lets a lower role exceed a higher one', () => {
    const rank: CoreRole[] = ['guest', 'member', 'admin', 'owner'];
    for (let i = 0; i < rank.length - 1; i += 1) {
      for (const capability of capabilities) {
        if (can(rank[i]!, capability)) {
          expect(can(rank[i + 1]!, capability)).toBe(true);
        }
      }
    }
  });
});
