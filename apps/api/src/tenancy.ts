import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import type { CoreRole } from '@promaly/domain';
import { createWorkspaceSlug, newId, normalizeEmail } from '@promaly/domain';
import {
  accounts,
  auditEvents,
  emit,
  type DatabaseClient,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from '@promaly/db';
import { ConflictError } from './identity.js';
import { provisionWorkspace } from './provisioning.js';

const invitationDurationMs = 1000 * 60 * 60 * 24 * 7;

export class TenancyNotFoundError extends Error {}
export class LastOwnerError extends Error {}
export class InvitationAcceptanceError extends Error {}

type Metadata = { ipAddress?: string };
type InvitationRole = Exclude<CoreRole, 'owner'>;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function inviteToken() {
  return randomBytes(32).toString('base64url');
}

export type TenancyService = ReturnType<typeof createTenancyService>;

export function createTenancyService(database: DatabaseClient) {
  const { db } = database;

  async function ownerCount(workspaceId: string) {
    const row = (
      await db
        .select({ value: count() })
        .from(workspaceMembers)
        .where(
          and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')),
        )
    )[0];
    return row?.value ?? 0;
  }

  return {
    async createWorkspace(
      accountId: string,
      input: { name: string; slug?: string | undefined },
      metadata: Metadata,
    ) {
      const workspaceId = newId();
      const slug = input.slug ?? createWorkspaceSlug(input.name);
      try {
        await db.transaction((transaction) =>
          provisionWorkspace(transaction, {
            workspaceId,
            ownerId: accountId,
            name: input.name.trim(),
            slug,
            source: 'workspace-management',
            ipAddress: metadata.ipAddress,
          }),
        );
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
      return { id: workspaceId, name: input.name.trim(), slug, role: 'owner' as const };
    },

    async updateWorkspace(
      workspaceId: string,
      actorId: string,
      input: { name?: string | undefined; slug?: string | undefined },
      metadata: Metadata,
    ) {
      try {
        return await db.transaction(async (transaction) => {
          const updated = await transaction
            .update(workspaces)
            .set({ name: input.name?.trim(), slug: input.slug })
            .where(eq(workspaces.id, workspaceId))
            .returning({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug });
          const workspace = updated[0];
          if (!workspace) throw new TenancyNotFoundError('Workspace not found.');
          await transaction.insert(auditEvents).values({
            id: newId(),
            workspaceId,
            actorId,
            action: 'workspace.updated',
            targetType: 'workspace',
            targetId: workspaceId,
            metadata: input,
            ipAddress: metadata.ipAddress,
          });
          await emit(transaction, {
            id: newId(),
            workspaceId,
            aggregateType: 'workspace',
            aggregateId: workspaceId,
            type: 'workspace.updated',
            payload: input,
          });
          return workspace;
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
    },

    async deleteWorkspace(workspaceId: string, actorId: string) {
      const members = (
        await db
          .select({ value: count() })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, workspaceId))
      )[0]?.value;
      if (members === 0 || members === undefined)
        throw new TenancyNotFoundError('Workspace not found.');
      if (members > 1) throw new ConflictError('Remove other members before deleting a workspace.');
      await db.transaction(async (transaction) => {
        await transaction.delete(workspaces).where(eq(workspaces.id, workspaceId));
        // This event deliberately has no workspaceId so it survives the workspace cascade.
        await emit(transaction, {
          id: newId(),
          aggregateType: 'workspace',
          aggregateId: workspaceId,
          type: 'workspace.deleted',
          payload: { actorId },
        });
      });
    },

    async listMembers(workspaceId: string) {
      return db
        .select({
          accountId: accounts.id,
          email: accounts.email,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.joinedAt,
        })
        .from(workspaceMembers)
        .innerJoin(accounts, eq(accounts.id, workspaceMembers.accountId))
        .where(eq(workspaceMembers.workspaceId, workspaceId));
    },

    async updateMemberRole(
      workspaceId: string,
      actorId: string,
      accountId: string,
      role: CoreRole,
      metadata: Metadata,
    ) {
      const existing = (
        await db
          .select({ role: workspaceMembers.role })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.accountId, accountId),
            ),
          )
          .limit(1)
      )[0];
      if (!existing) throw new TenancyNotFoundError('Member not found.');
      if (existing.role === 'owner' && role !== 'owner' && (await ownerCount(workspaceId)) <= 1) {
        throw new LastOwnerError('A workspace must retain at least one owner.');
      }
      await db.transaction(async (transaction) => {
        await transaction
          .update(workspaceMembers)
          .set({ role })
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.accountId, accountId),
            ),
          );
        await transaction.insert(auditEvents).values({
          id: newId(),
          workspaceId,
          actorId,
          action: 'membership.role_changed',
          targetType: 'member',
          targetId: accountId,
          metadata: { previousRole: existing.role, role },
          ipAddress: metadata.ipAddress,
        });
        await emit(transaction, {
          id: newId(),
          workspaceId,
          aggregateType: 'membership',
          aggregateId: accountId,
          type: 'membership.changed',
          payload: { accountId, previousRole: existing.role, role },
        });
      });
    },

    async removeMember(
      workspaceId: string,
      actorId: string,
      accountId: string,
      metadata: Metadata,
    ) {
      const existing = (
        await db
          .select({ role: workspaceMembers.role })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.accountId, accountId),
            ),
          )
          .limit(1)
      )[0];
      if (!existing) throw new TenancyNotFoundError('Member not found.');
      if (existing.role === 'owner' && (await ownerCount(workspaceId)) <= 1) {
        throw new LastOwnerError('A workspace must retain at least one owner.');
      }
      await db.transaction(async (transaction) => {
        await transaction
          .delete(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.accountId, accountId),
            ),
          );
        await transaction.insert(auditEvents).values({
          id: newId(),
          workspaceId,
          actorId,
          action: 'membership.removed',
          targetType: 'member',
          targetId: accountId,
          metadata: { role: existing.role },
          ipAddress: metadata.ipAddress,
        });
        await emit(transaction, {
          id: newId(),
          workspaceId,
          aggregateType: 'membership',
          aggregateId: accountId,
          type: 'membership.changed',
          payload: { accountId, action: 'removed', role: existing.role },
        });
      });
    },

    async createInvitation(
      workspaceId: string,
      actorId: string,
      emailInput: string,
      role: InvitationRole,
      metadata: Metadata,
    ) {
      const email = normalizeEmail(emailInput);
      const token = inviteToken();
      const invitation = { id: newId(), expiresAt: new Date(Date.now() + invitationDurationMs) };
      await db.transaction(async (transaction) => {
        const member = (
          await transaction
            .select({ id: workspaceMembers.accountId })
            .from(workspaceMembers)
            .innerJoin(accounts, eq(accounts.id, workspaceMembers.accountId))
            .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(accounts.email, email)))
            .limit(1)
        )[0];
        if (member) {
          throw new ConflictError('That person is already a member of this workspace.');
        }
        // A re-invite supersedes any earlier pending one (its token stops working).
        await transaction
          .delete(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.workspaceId, workspaceId),
              eq(workspaceInvitations.email, email),
              isNull(workspaceInvitations.acceptedAt),
            ),
          );
        await transaction.insert(workspaceInvitations).values({
          ...invitation,
          workspaceId,
          email,
          role,
          tokenHash: hashToken(token),
          createdBy: actorId,
        });
        await transaction.insert(auditEvents).values({
          id: newId(),
          workspaceId,
          actorId,
          action: 'invitation.created',
          targetType: 'invitation',
          targetId: invitation.id,
          metadata: { email, role },
          ipAddress: metadata.ipAddress,
        });
        await emit(transaction, {
          id: newId(),
          workspaceId,
          aggregateType: 'invitation',
          aggregateId: invitation.id,
          type: 'invitation.created',
          payload: { email, role },
        });
        await emit(transaction, {
          id: newId(),
          workspaceId,
          aggregateType: 'invitation',
          aggregateId: invitation.id,
          type: 'email.send',
          payload: {
            to: email,
            subject: 'You are invited to Promaly',
            text: `Use this invitation token within seven days: ${token}`,
          },
        });
      });
      return { ...invitation, email, role };
    },

    async listInvitations(workspaceId: string) {
      return db
        .select({
          id: workspaceInvitations.id,
          email: workspaceInvitations.email,
          role: workspaceInvitations.role,
          expiresAt: workspaceInvitations.expiresAt,
          acceptedAt: workspaceInvitations.acceptedAt,
          createdAt: workspaceInvitations.createdAt,
        })
        .from(workspaceInvitations)
        .where(eq(workspaceInvitations.workspaceId, workspaceId));
    },

    async revokeInvitation(
      workspaceId: string,
      actorId: string,
      invitationId: string,
      metadata: Metadata,
    ) {
      await db.transaction(async (transaction) => {
        const deleted = await transaction
          .delete(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.workspaceId, workspaceId),
              eq(workspaceInvitations.id, invitationId),
              isNull(workspaceInvitations.acceptedAt),
            ),
          )
          .returning({ id: workspaceInvitations.id, email: workspaceInvitations.email });
        const invitation = deleted[0];
        if (!invitation) throw new TenancyNotFoundError('Invitation not found.');
        await transaction.insert(auditEvents).values({
          id: newId(),
          workspaceId,
          actorId,
          action: 'invitation.revoked',
          targetType: 'invitation',
          targetId: invitationId,
          metadata: { email: invitation.email },
          ipAddress: metadata.ipAddress,
        });
        await emit(transaction, {
          id: newId(),
          workspaceId,
          aggregateType: 'invitation',
          aggregateId: invitationId,
          type: 'invitation.revoked',
          payload: { email: invitation.email },
        });
      });
    },

    async acceptInvitation(
      token: string,
      authenticatedAccountId: string | undefined,
      password: string | undefined,
      metadata: Metadata,
    ) {
      const now = new Date();
      return db.transaction(async (transaction) => {
        const invitation = (
          await transaction
            .select()
            .from(workspaceInvitations)
            .where(
              and(
                eq(workspaceInvitations.tokenHash, hashToken(token)),
                isNull(workspaceInvitations.acceptedAt),
                gt(workspaceInvitations.expiresAt, now),
              ),
            )
            .limit(1)
        )[0];
        if (!invitation)
          throw new InvitationAcceptanceError('This invitation is invalid or expired.');

        const existingAccount = (
          await transaction
            .select({ id: accounts.id })
            .from(accounts)
            .where(eq(accounts.email, invitation.email))
            .limit(1)
        )[0];
        if (existingAccount && existingAccount.id !== authenticatedAccountId) {
          throw new InvitationAcceptanceError(
            'Sign in as the invited email address to accept this invitation.',
          );
        }
        if (!existingAccount && !password) {
          throw new InvitationAcceptanceError(
            'A password is required to create the invited account.',
          );
        }
        const accountId = existingAccount?.id ?? newId();
        if (!existingAccount) {
          const passwordHash = await argon2.hash(password!, {
            type: argon2.argon2id,
            memoryCost: 19_456,
            timeCost: 2,
            parallelism: 1,
          });
          await transaction
            .insert(accounts)
            .values({ id: accountId, email: invitation.email, passwordHash });
        }
        const accepted = await transaction
          .update(workspaceInvitations)
          .set({ acceptedAt: now })
          .where(
            and(
              eq(workspaceInvitations.id, invitation.id),
              isNull(workspaceInvitations.acceptedAt),
            ),
          )
          .returning({ id: workspaceInvitations.id });
        if (!accepted[0])
          throw new InvitationAcceptanceError('This invitation has already been accepted.');
        await transaction
          .insert(workspaceMembers)
          .values({ workspaceId: invitation.workspaceId, accountId, role: invitation.role })
          .onConflictDoNothing();
        await transaction.insert(auditEvents).values({
          id: newId(),
          workspaceId: invitation.workspaceId,
          actorId: authenticatedAccountId ?? accountId,
          action: 'invitation.accepted',
          targetType: 'member',
          targetId: accountId,
          metadata: { invitationId: invitation.id, role: invitation.role },
          ipAddress: metadata.ipAddress,
        });
        await emit(transaction, {
          id: newId(),
          workspaceId: invitation.workspaceId,
          aggregateType: 'membership',
          aggregateId: accountId,
          type: 'invitation.accepted',
          payload: { invitationId: invitation.id, accountId, role: invitation.role },
        });
        return { workspaceId: invitation.workspaceId, accountId, role: invitation.role };
      });
    },
  };
}
