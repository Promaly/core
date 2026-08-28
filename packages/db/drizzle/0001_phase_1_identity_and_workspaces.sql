CREATE TYPE "workspace_role" AS ENUM ('owner', 'admin', 'member', 'guest');

CREATE TABLE "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "created_by" text NOT NULL REFERENCES "accounts"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspace_members" (
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "role" "workspace_role" NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("workspace_id", "account_id")
);

CREATE TABLE "auth_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "auth_sessions_account_id_idx" ON "auth_sessions" ("account_id");

CREATE TABLE "workspace_invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" "workspace_role" NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_by" text NOT NULL REFERENCES "accounts"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "workspace_invitations_workspace_id_idx" ON "workspace_invitations" ("workspace_id");

CREATE TABLE "audit_events" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "actor_id" text REFERENCES "accounts"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "audit_events_workspace_id_created_at_idx" ON "audit_events" ("workspace_id", "created_at");
