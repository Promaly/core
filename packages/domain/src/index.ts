/** Shared business rules belong here; persistence remains behind module repositories. */
export const coreRoles = ['owner', 'admin', 'member', 'guest'] as const;

export type CoreRole = (typeof coreRoles)[number];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createWorkspaceSlug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return slug.slice(0, 42) || 'workspace';
}
