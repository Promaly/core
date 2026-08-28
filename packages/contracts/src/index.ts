import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const workspaceRoleSchema = z.enum(['owner', 'admin', 'member', 'guest']);

export const registerRequestSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
  workspaceName: z.string().trim().min(2).max(100),
  workspaceSlug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export const loginRequestSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export const accountSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});

export const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  role: workspaceRoleSchema,
});

export const authenticatedSessionSchema = z.object({
  account: accountSchema,
  workspaces: z.array(workspaceSchema),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthenticatedSession = z.infer<typeof authenticatedSessionSchema>;
