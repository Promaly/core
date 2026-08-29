import { describe, expect, it } from 'vitest';
import { can, capabilities, ROLE_CAPABILITIES } from './authz.js';
import { coreRoles } from './index.js';

describe('workspace capability policy', () => {
  it('has an explicit decision for every role and capability', () => {
    for (const role of coreRoles) {
      for (const capability of capabilities) {
        expect(can(role, capability)).toBe(ROLE_CAPABILITIES[role].includes(capability));
      }
    }
  });

  it('does not grant workspace administration to members or guests', () => {
    expect(can('member', 'project.manage')).toBe(false);
    expect(can('guest', 'issue.edit')).toBe(false);
    expect(can('owner', 'workspace.transfer')).toBe(true);
  });
});
