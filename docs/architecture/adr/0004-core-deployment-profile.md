# ADR 0004: Core deployment profile is small and self-hostable

- Status: accepted
- Date: 2026-08-28

## Decision

Core requires the application, worker, PostgreSQL and S3-compatible storage. HTTPS routing is delegated to the host platform (for example, Coolify or Traefik).

## Consequences

All Core services must support ARM64 and AMD64. Valkey, Meilisearch, NATS and collaboration services remain opt-in.
