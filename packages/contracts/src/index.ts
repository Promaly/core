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

export const invitationRequestSchema = z.object({
  email: z.email().max(254),
  role: workspaceRoleSchema.exclude(['owner']),
});

export const invitationAcceptRequestSchema = z.object({
  password: z.string().min(12).max(128).optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.email().max(254),
});

export const passwordResetConfirmSchema = z.object({
  password: z.string().min(12).max(128),
});

export const workspaceCreateRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export const workspaceUpdateRequestSchema = workspaceCreateRequestSchema
  .partial()
  .refine(
    (value) => value.name !== undefined || value.slug !== undefined,
    'At least one workspace field is required.',
  );

export const memberRoleUpdateRequestSchema = z.object({
  role: workspaceRoleSchema,
});

export const workflowStateCategorySchema = z.enum([
  'backlog',
  'unstarted',
  'started',
  'completed',
  'cancelled',
]);

export const teamCreateRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  key: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,5}$/),
});
export const teamUpdateRequestSchema = teamCreateRequestSchema
  .partial()
  .refine(
    (value) => value.name !== undefined || value.key !== undefined,
    'At least one team field is required.',
  );
export const teamMemberRequestSchema = z.object({ accountId: z.uuid() });

export const workflowCreateRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  isDefault: z.boolean().optional(),
});
export const workflowUpdateRequestSchema = workflowCreateRequestSchema
  .partial()
  .refine(
    (value) => value.name !== undefined || value.isDefault !== undefined,
    'At least one workflow field is required.',
  );
export const workflowStateCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: workflowStateCategorySchema,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/),
});
export const workflowStateUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.color !== undefined,
    'State changes required.',
  );
export const workflowStateReorderRequestSchema = z.object({
  stateIds: z.array(z.uuid()).min(2).max(100),
});

export const projectCreateRequestSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(20_000).optional(),
  teamId: z.uuid().optional(),
  leadId: z.uuid().optional(),
  workflowId: z.uuid().optional(),
  icon: z.string().trim().max(32).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
export const projectUpdateRequestSchema = projectCreateRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Project changes required.');

export const labelCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/),
  projectId: z.uuid().optional(),
});
export const labelUpdateRequestSchema = labelCreateRequestSchema
  .omit({ projectId: true })
  .partial()
  .refine(
    (value) => value.name !== undefined || value.color !== undefined,
    'Label changes required.',
  );

export const issuePrioritySchema = z.int().min(0).max(4);
export const issueCreateRequestSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(100_000).optional(),
  stateId: z.uuid().optional(),
  priority: issuePrioritySchema.optional(),
  assigneeId: z.uuid().nullable().optional(),
  parentIssueId: z.uuid().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  labelIds: z.array(z.uuid()).max(50).optional(),
});
export const issueUpdateRequestSchema = issueCreateRequestSchema
  .omit({ projectId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Issue changes required.');
export const issueArchiveRequestSchema = z.object({});
export const issueRelationTypeSchema = z.enum(['blocks', 'relates_to', 'duplicates']);
export const issueRelationCreateRequestSchema = z.object({
  targetIssueId: z.uuid(),
  type: issueRelationTypeSchema,
});
export const issueBulkRequestSchema = z.object({
  issues: z
    .array(
      z.object({
        id: z.uuid(),
        revision: z.int().positive(),
        stateId: z.uuid().optional(),
        assigneeId: z.uuid().nullable().optional(),
        priority: issuePrioritySchema.optional(),
        labelIds: z.array(z.uuid()).max(50).optional(),
      }),
    )
    .min(1)
    .max(100),
});
export const issueMoveRequestSchema = z
  .object({
    beforeId: z.uuid().optional(),
    afterId: z.uuid().optional(),
    stateId: z.uuid().optional(),
  })
  .refine(
    (value) =>
      value.beforeId !== undefined || value.afterId !== undefined || value.stateId !== undefined,
    'A destination is required.',
  );

export const phase1EventTypes = [
  'workspace.created',
  'workflow.seeded',
  'notification.fanout',
  'email.send',
  'invitation.created',
  'invitation.accepted',
  'invitation.revoked',
  'membership.changed',
  'workspace.updated',
  'workspace.deleted',
  'team.created',
  'team.updated',
  'team.deleted',
  'team.members.changed',
  'workflow.created',
  'workflow.updated',
  'workflow.state.changed',
  'project.created',
  'project.updated',
  'project.archived',
  'project.unarchived',
  'label.created',
  'label.updated',
  'label.deleted',
  'issue.created',
  'issue.updated',
  'issue.archived',
  'issue.moved',
  'issue.relation.created',
  'issue.relation.deleted',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'attachment.added',
  'attachment.removed',
  'saved_view.created',
  'saved_view.updated',
  'saved_view.deleted',
] as const;
export type Phase1EventType = (typeof phase1EventTypes)[number];

// --- Comments -------------------------------------------------------------

export const commentCreateRequestSchema = z.object({
  body: z.string().trim().min(1).max(50_000),
});
export const commentUpdateRequestSchema = commentCreateRequestSchema;

export type CommentCreateRequest = z.infer<typeof commentCreateRequestSchema>;

// --- Notification preferences -------------------------------------------

export const notificationPreferencesUpdateSchema = z
  .object({
    inApp: z.boolean().optional(),
    email: z.boolean().optional(),
    mentions: z.boolean().optional(),
    assignments: z.boolean().optional(),
    comments: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one preference is required.');

// --- Saved views -------------------------------------------------------

/** Filter shape shared by the issue list query and stored saved views. */
export const savedViewFiltersSchema = z
  .object({
    stateId: z.array(z.uuid()).max(50).optional(),
    // `'none'` is the sentinel for "unassigned".
    assigneeId: z
      .array(z.union([z.uuid(), z.literal('none')]))
      .max(50)
      .optional(),
    labelId: z.array(z.uuid()).max(50).optional(),
    priority: z.array(issuePrioritySchema).max(5).optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();

export const savedViewGroupBySchema = z.enum(['none', 'state', 'assignee', 'priority', 'label']);
export const savedViewSortSchema = z.object({
  field: z.enum(['manual', 'priority', 'updated', 'created']),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const savedViewCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  projectId: z.uuid().optional(),
  scope: z.enum(['personal', 'shared']).default('personal'),
  filters: savedViewFiltersSchema.default({}),
  groupBy: savedViewGroupBySchema.default('none'),
  sort: savedViewSortSchema.default({ field: 'manual' }),
});
export const savedViewUpdateRequestSchema = savedViewCreateRequestSchema
  .omit({ scope: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Saved view changes required.');

export type SavedViewFilters = z.infer<typeof savedViewFiltersSchema>;
export type SavedViewCreateRequest = z.infer<typeof savedViewCreateRequestSchema>;
