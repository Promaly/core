import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
// `$onUpdate` keeps updated_at current on every Drizzle `.update()` — the write
// path for all repositories. Raw-SQL writers must set it explicitly.
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

export const workspaceRole = pgEnum('workspace_role', ['owner', 'admin', 'member', 'guest']);
export const workflowStateCategory = pgEnum('workflow_state_category', [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'cancelled',
]);
export const projectStatus = pgEnum('project_status', ['active', 'archived']);
export const issueRelationType = pgEnum('issue_relation_type', [
  'blocks',
  'relates_to',
  'duplicates',
]);

export const systemMetadata = pgTable('system_metadata', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => accounts.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.accountId] })],
);
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('auth_sessions_account_id_idx').on(t.accountId)],
);
export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: workspaceRole('role').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('workspace_invitations_workspace_id_idx').on(t.workspaceId)],
);
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => accounts.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    ipAddress: text('ip_address'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_events_workspace_id_created_at_idx').on(t.workspaceId, t.createdAt)],
);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
});
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    key: text('key').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('teams_workspace_key_unique').on(t.workspaceId, t.key),
    check('teams_key_format', sql`${t.key} ~ '^[A-Z]{2,5}$'`),
  ],
);
export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.accountId] })],
);
export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => accounts.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const workflowStates = pgTable(
  'workflow_states',
  {
    id: uuid('id').primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: workflowStateCategory('category').notNull(),
    position: integer('position').notNull(),
    color: text('color').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('workflow_states_workflow_position_unique').on(t.workflowId, t.position)],
);
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    leadId: uuid('lead_id').references(() => accounts.id, { onDelete: 'set null' }),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id),
    status: projectStatus('status').notNull().default('active'),
    icon: text('icon'),
    color: text('color'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('projects_workspace_key_unique').on(t.workspaceId, t.key)],
);
export const projectIssueCounters = pgTable('project_issue_counters', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  nextNumber: integer('next_number').notNull().default(1),
});
export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('labels_scope_name_unique').on(
      t.workspaceId,
      sql`coalesce(${t.projectId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`lower(${t.name})`,
    ),
  ],
);
export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    stateId: uuid('state_id')
      .notNull()
      .references(() => workflowStates.id),
    priority: smallint('priority').notNull().default(0),
    assigneeId: uuid('assignee_id').references(() => accounts.id, { onDelete: 'set null' }),
    parentIssueId: uuid('parent_issue_id').references((): AnyPgColumn => issues.id, {
      onDelete: 'set null',
    }),
    sortKey: text('sort_key').notNull(),
    revision: integer('revision').notNull().default(1),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))`,
    ),
  },
  (t) => [
    uniqueIndex('issues_project_number_unique').on(t.projectId, t.number),
    index('issues_workspace_project_state_idx').on(t.workspaceId, t.projectId, t.stateId),
    index('issues_search_tsv_idx').using('gin', t.searchTsv),
    index('issues_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
    check('issues_priority_range', sql`${t.priority} between 0 and 4`),
  ],
);
export const issueLabels = pgTable(
  'issue_labels',
  {
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })],
);
export const issueRelations = pgTable(
  'issue_relations',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceIssueId: uuid('source_issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    type: issueRelationType('type').notNull(),
    targetIssueId: uuid('target_issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('issue_relations_source_type_target_unique').on(
      t.sourceIssueId,
      t.type,
      t.targetIssueId,
    ),
    check('issue_relations_not_self', sql`${t.sourceIssueId} <> ${t.targetIssueId}`),
  ],
);
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => accounts.id),
    body: text('body').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('comments_issue_created_at_idx').on(t.issueId, t.createdAt)],
);
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => accounts.id),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [check('attachments_one_parent', sql`(${t.issueId} is null) <> (${t.commentId} is null)`)],
);
export const activityEvents = pgTable(
  'activity_events',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => accounts.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    data: jsonb('data').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('activity_events_issue_created_at_idx').on(t.issueId, t.createdAt)],
);
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => accounts.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
    commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'set null' }),
    data: jsonb('data').notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_recipient_read_created_idx').on(t.recipientId, t.readAt, t.createdAt),
  ],
);
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    prefs: jsonb('prefs').notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.accountId] })],
);
export const savedViews = pgTable(
  'saved_views',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id').references(() => accounts.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    filters: jsonb('filters').notNull().default({}),
    groupBy: text('group_by').notNull().default('none'),
    sort: jsonb('sort').notNull().default({}),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('saved_views_workspace_id_idx').on(t.workspaceId)],
);
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: createdAt(),
    availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
    attempts: integer('attempts').notNull().default(0),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastError: text('last_error'),
  },
  (t) => [index('outbox_events_pending_idx').on(t.processedAt, t.availableAt)],
);
