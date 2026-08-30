import type { CoreRole } from './index.js';

export const capabilities = [
  'workspace.read',
  'workspace.settings',
  'workspace.transfer',
  'member.manage',
  'project.manage',
  'issue.create',
  'issue.edit',
  'comment.create',
  'comment.moderate',
  'saved_view.manage_shared',
] as const;

export type Capability = (typeof capabilities)[number];

export const ROLE_CAPABILITIES: Readonly<Record<CoreRole, readonly Capability[]>> = {
  owner: capabilities,
  admin: [
    'workspace.read',
    'member.manage',
    'project.manage',
    'issue.create',
    'issue.edit',
    'comment.create',
    'comment.moderate',
    'saved_view.manage_shared',
  ],
  member: ['workspace.read', 'issue.create', 'issue.edit', 'comment.create'],
  guest: ['workspace.read'],
};

export function can(role: CoreRole, capability: Capability) {
  return ROLE_CAPABILITIES[role].includes(capability);
}
