import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AuthenticatedSession, LoginRequest, RegisterRequest } from '@promaly/contracts';
import {
  accounts,
  authSessions,
  emit,
  isUniqueViolation,
  passwordResetTokens,
  type DatabaseClient,
  workspaceMembers,
  workspaces,
} from '@promaly/db';
import { createWorkspaceSlug, newId, normalizeEmail } from '@promaly/domain';
import { provisionWorkspace } from './provisioning.js';

// Sessions do not slide their expiry: this is an absolute cap, not an idle timeout.
const sessionDurationMs = 1000 * 60 * 60 * 24 * 90;
const passwordResetDurationMs = 1000 * 60 * 60;
const sessionLastSeenWriteIntervalMs = 1000 * 60 * 5;
// This valid Argon2id hash is intentionally for a value no caller can authenticate with.
const missingAccountPasswordHash =
  '$argon2id$v=19$m=19456,p=1,t=2$pn87qjOfMYWvo/46XJdaRA$EEivLs+0OA317DRW3CTBCODzsfInAdFcekTUBvQ6VZE';

export class AuthenticationError extends Error {}
export class ConflictError extends Error {}
export class PasswordResetError extends Error {}

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
    currentToken?: string | undefined,
  ): Promise<AuthenticatedSession & { token: SessionToken }>;
  startSession(
    accountId: string,
    metadata: RequestMetadata,
  ): Promise<AuthenticatedSession & { token: SessionToken }>;
  getSession(token: string): Promise<AuthenticatedSession | null>;
  logout(token: string): Promise<void>;
  logoutAll(accountId: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
};

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createOpaqueToken() {
  return randomBytes(32).toString('base64url');
}

function createSessionToken(): SessionToken {
  return {
    value: createOpaqueToken(),
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
      id: newId(),
      accountId,
      tokenHash: hashSessionToken(token.value),
      expiresAt: token.expiresAt,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return token;
  }

  async function revokeSession(rawToken: string) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(authSessions.tokenHash, hashSessionToken(rawToken)), isNull(authSessions.revokedAt)),
      );
  }

  async function issueSession(accountId: string, metadata: RequestMetadata) {
    const token = await createSession(accountId, metadata);
    const session = await getSession(token.value);
    if (!session) {
      throw new Error('Failed to create an authenticated session.');
    }
    return { ...session, token };
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

      const accountId = newId();
      const workspaceId = newId();
      const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });

      try {
        await db.transaction(async (transaction) => {
          await transaction.insert(accounts).values({ id: accountId, email, passwordHash });
          await provisionWorkspace(transaction, {
            workspaceId,
            ownerId: accountId,
            name: input.workspaceName.trim(),
            slug,
            source: 'registration',
            ipAddress: metadata.ipAddress,
          });
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError('This workspace URL is already in use.');
        }

        throw error;
      }

      return issueSession(accountId, metadata);
    },

    async login(input, metadata, currentToken) {
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

      // Session fixation: retire any token the client presented before minting a new one.
      if (currentToken) await revokeSession(currentToken);
      return issueSession(account.id, metadata);
    },

    async startSession(accountId, metadata) {
      return issueSession(accountId, metadata);
    },

    getSession,

    async logout(token) {
      await revokeSession(token);
    },

    async logoutAll(accountId) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.accountId, accountId), isNull(authSessions.revokedAt)));
    },

    async requestPasswordReset(rawEmail) {
      const email = normalizeEmail(rawEmail);
      const account = (
        await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.email, email))
          .limit(1)
      )[0];
      // Always return success so this endpoint cannot reveal whether an account exists.
      if (!account) return;

      const token = createOpaqueToken();
      await db.transaction(async (transaction) => {
        await transaction.insert(passwordResetTokens).values({
          id: newId(),
          accountId: account.id,
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + passwordResetDurationMs),
        });
        await emit(transaction, {
          id: newId(),
          aggregateType: 'account',
          aggregateId: account.id,
          type: 'email.send',
          payload: {
            to: email,
            subject: 'Reset your Promaly password',
            text: `Use this password reset token within one hour: ${token}`,
          },
        });
      });
    },

    async resetPassword(token, password) {
      const now = new Date();
      const tokenHash = hashSessionToken(token);

      // Cheap validity check first: an invalid or spent token must never reach
      // the (expensive) Argon2 hash on this unauthenticated endpoint.
      const pending = (
        await db
          .select({ id: passwordResetTokens.id })
          .from(passwordResetTokens)
          .where(
            and(
              eq(passwordResetTokens.tokenHash, tokenHash),
              isNull(passwordResetTokens.usedAt),
              gt(passwordResetTokens.expiresAt, now),
            ),
          )
          .limit(1)
      )[0];
      if (!pending) {
        throw new PasswordResetError('This password reset link is invalid or expired.');
      }

      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });

      await db.transaction(async (transaction) => {
        // Consume atomically; a concurrent request loses the race here.
        const consumed = await transaction
          .update(passwordResetTokens)
          .set({ usedAt: now })
          .where(and(eq(passwordResetTokens.id, pending.id), isNull(passwordResetTokens.usedAt)))
          .returning({ accountId: passwordResetTokens.accountId });
        const reset = consumed[0];
        if (!reset) {
          throw new PasswordResetError('This password reset link is invalid or expired.');
        }

        await transaction
          .update(accounts)
          .set({ passwordHash })
          .where(eq(accounts.id, reset.accountId));
        await transaction
          .update(authSessions)
          .set({ revokedAt: now })
          .where(and(eq(authSessions.accountId, reset.accountId), isNull(authSessions.revokedAt)));
      });
    },
  };
}
