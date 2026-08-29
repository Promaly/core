import type postgres from 'postgres';

/** The least-privilege role the API and worker connect as (DML only). */
export const APP_ROLE = 'promaly_app';

/** bootstrap writes `head -c 48 /dev/urandom | od -An -tx1` — 96 hex chars. */
const APP_PASSWORD_PATTERN = /^[0-9a-f]{96}$/;

/**
 * Idempotently create (or re-sync the password of) the application role and set
 * default privileges so tables the migrations create next are usable by it.
 * Runs as the database owner, before migrations — this replaces the old
 * `docker-entrypoint-initdb.d/10-app-role.sh`, which needed a host bind mount
 * that several PaaS platforms don't provide.
 *
 * `APP_ROLE` is a fixed identifier and `password` is validated as pure hex, so
 * both are safe to inline as SQL string literals.
 */
export async function ensureAppRole(sql: postgres.Sql, password: string) {
  if (!APP_PASSWORD_PATTERN.test(password)) {
    throw new Error(
      'PROMALY_APP_PASSWORD must be the 96-hex-character value generated into the secrets volume.',
    );
  }
  await sql.unsafe(`
    DO $do$
    DECLARE
      app_role text := '${APP_ROLE}';
      app_password text := '${password}';
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
        EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L', app_role, app_password);
      ELSE
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', app_role, app_password);
      END IF;
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), app_role);
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_role);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
        app_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
        app_role
      );
    END
    $do$;
  `);
}

/**
 * Grant the application role access to every table and sequence that exists
 * now. Run *after* migrations: `ensureAppRole`'s default privileges cover
 * objects created by this migration run, and this sweep covers anything that
 * pre-dated it (e.g. re-running against a partially migrated database).
 */
export async function syncAppRoleGrants(sql: postgres.Sql) {
  await sql.unsafe(`
    DO $do$
    DECLARE
      app_role text := '${APP_ROLE}';
    BEGIN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I',
        app_role
      );
      EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
    END
    $do$;
  `);
}
