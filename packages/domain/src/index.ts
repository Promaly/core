/** Shared business rules belong here; persistence remains behind module repositories. */
import nodemailer from 'nodemailer';
import { uuidv7 } from 'uuidv7';

export const coreRoles = ['owner', 'admin', 'member', 'guest'] as const;

export * from './authz.js';

export type CoreRole = (typeof coreRoles)[number];
export const issuePriorities = [0, 1, 2, 3, 4] as const;
export type IssuePriority = (typeof issuePriorities)[number];

export type NotificationPreferences = {
  inApp: boolean;
  email: boolean;
  mentions: boolean;
  assignments: boolean;
  comments: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  inApp: true,
  email: true,
  mentions: true,
  assignments: true,
  comments: true,
};

export function newId() {
  return uuidv7();
}

export type MailMessage = { to: string; subject: string; text: string };
export type MailPort = { send(message: MailMessage): Promise<void> };

export function createMailPort(smtpUrl: string | undefined, from?: string): MailPort {
  if (!smtpUrl) return { send: async () => undefined };
  const transporter = nodemailer.createTransport(smtpUrl);
  return { send: async (message) => void (await transporter.sendMail({ from, ...message })) };
}

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
