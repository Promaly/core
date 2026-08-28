import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AuthenticatedSession, LoginRequest, RegisterRequest } from '@promaly/contracts';
import {
  accounts,
  auditEvents,
  authSessions,
  type DatabaseClient,
  workspaceMembers,
  workspaces,
} from '@promaly/db';
import { createWorkspaceSlug, normalizeEmail } from '@promaly/domain';

const sessionDurationMs = 1000 * 60 * 60 * 24 * 30;
const sessionLastSeenWriteIntervalMs = 1000 * 60 * 5;
// This valid Argon2id hash is intentionally for a value no caller can authenticate with.
const missingAccountPasswordHash =
  '$argon2id$v=19$m=19456,p=1,t=2$pn87qjOfMYWvo/46XJdaRA$EEivLs+0OA317DRW3CTBCODzsfInAdFcekTUBvQ6VZE';

export class AuthenticationError extends Error {}
export class ConflictError extends Error {}

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type SessionToken = {
  value: string;
  expiresAt: Date;
};

export type IdentityService = {
  register(
    input: RegisterRequest,
    metadata: RequestMetadata,
  ): Promise<AuthenticatedSession & { token: SessionToken }>;
  login(
    input: LoginRequest,
    metadata: RequestMetadata,
  ): Promise<AuthenticatedSession & { token: SessionToken }>;
  getSession(token: string): Promise<AuthenticatedSession | null>;
  logout(token: string): Promise<void>;
};

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createSessionToken(): SessionToken {
  return {
    value: randomBytes(32).toString('base64url'),
    expiresAt: new Date(Date.now() + sessionDurationMs),
  };
}

function toIso(date: Date) {
  return date.toISOString();
}

export function createIdentityService(database: DatabaseClient): IdentityService {
  const { db } = database;

  async function createSession(accountId: string, metadata: RequestMetadata) {
    const token = createSessionToken();
    await db.insert(authSessions).values({
      id: randomUUID(),
      accountId,
      tokenHash: hashSessionToken(token.value),
      expiresAt: token.expiresAt,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return token;
  }

  async function getSession(token: string): Promise<AuthenticatedSession | null> {
    const now = new Date();
    const tokenHash = hashSessionToken(token);
    const sessions = await db
      .select({
        sessionId: authSessions.id,
        accountId: accounts.id,
        email: accounts.email,
        accountCreatedAt: accounts.createdAt,
        lastSeenAt: authSessions.lastSeenAt,
      })
      .from(authSessions)
      .innerJoin(accounts, eq(accounts.id, authSessions.accountId))
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, now),
        ),
      )
      .limit(1);
    const session = sessions[0];

    if (!session) {
      return null;
    }

    if (now.getTime() - session.lastSeenAt.getTime() >= sessionLastSeenWriteIntervalMs) {
      await db
        .update(authSessions)
        .set({ lastSeenAt: now })
        .where(eq(authSessions.id, session.sessionId));
    }

    const memberships = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.accountId, session.accountId));

    return {
      account: {
        id: session.accountId,
        email: session.email,
        createdAt: toIso(session.accountCreatedAt),
      },
      workspaces: memberships,
    };
  }

  return {
    async register(input, metadata) {
      const email = normalizeEmail(input.email);
      const slug = createWorkspaceSlug(input.workspaceSlug ?? input.workspaceName);
      const existing = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError('An account already exists for this email address.');
      }

      const accountId = randomUUID();
      const workspaceId = randomUUID();
      const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });

      try {
        await db.transaction(async (transaction) => {
          await transaction.insert(accounts).values({ id: accountId, email, passwordHash });
          await transaction.insert(workspaces).values({
            id: workspaceId,
            name: input.workspaceName.trim(),
            slug,
            createdBy: accountId,
          });
          await transaction.insert(workspaceMembers).values({
            workspaceId,
            accountId,
            role: 'owner',
          });
          await transaction.insert(auditEvents).values({
            id: randomUUID(),
            workspaceId,
            actorId: accountId,
            action: 'workspace.created',
            targetType: 'workspace',
            targetId: workspaceId,
            metadata: { source: 'registration' },
            ipAddress: metadata.ipAddress,
          });
        });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === '23505'
        ) {
          throw new ConflictError('This workspace URL is already in use.');
        }

        throw error;
      }

      const token = await createSession(accountId, metadata);
      const session = await getSession(token.value);

      if (!session) {
        throw new Error('Failed to create an authenticated session.');
      }

      return { ...session, token };
    },

    async login(input, metadata) {
      const email = normalizeEmail(input.email);
      const rows = await db
        .select({ id: accounts.id, passwordHash: accounts.passwordHash })
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      const account = rows[0];

      const passwordHash = account?.passwordHash ?? missingAccountPasswordHash;
      const passwordMatches = await argon2.verify(passwordHash, input.password);

      if (!account || !passwordMatches) {
        throw new AuthenticationError('Invalid email or password.');
      }

      const token = await createSession(account.id, metadata);
      const session = await getSession(token.value);

      if (!session) {
        throw new Error('Failed to create an authenticated session.');
      }

      return { ...session, token };
    },

    getSession,

    async logout(token) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(eq(authSessions.tokenHash, hashSessionToken(token)), isNull(authSessions.revokedAt)),
        );
    },
  };
}
