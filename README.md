# Promaly Core

Promaly is a lightweight, self-hosted work-management platform for teams — an alternative to Linear and Jira.

## Current status

Phase 0 foundations are in place: a strict TypeScript pnpm monorepo, API and worker applications, validated runtime configuration, database migrations, Core Compose services, health/readiness/metrics endpoints, backup tooling, CI, and recorded architecture decisions. Product features begin with identity, tenancy and issue-management Core.

## Quick start

Requires Node.js 22+ and pnpm 11+.

```sh
pnpm install
cp .env.example .env
pnpm dev
```

The API responds at `http://localhost:3000/healthz`. `readyz` returns 503 until both PostgreSQL and MinIO are configured and reachable. Prometheus-compatible process metrics are available at `/metrics`.

To run the single image locally:

```sh
docker build -t promaly:dev .
docker run --rm -p 3000:3000 promaly:dev
```

For a self-hosted deployment, copy `.env.example` to `.env`, set strong secrets and a versioned `PROMALY_VERSION`, then run the migration once before starting Compose:

```sh
docker compose run --rm app node packages/db/dist/migrate.js
docker compose up -d
```

See [Core deployment](docs/operations/core-deployment.md) and [backup and restore](docs/operations/backup-and-restore.md) before deploying real data.

## Repository layout

- `apps/api` — Fastify HTTP API and future WebSocket gateway
- `apps/worker` — durable background work processing
- `packages/config` — validated runtime configuration
- `packages/contracts` — shared API contracts
- `packages/domain` — business rules and permissions
- `packages/db` — Drizzle schema, forward-only migrations and PostgreSQL access
- `compose.yaml` — single-image Core deployment with PostgreSQL and MinIO
- `docs/architecture/adr` — accepted architecture decisions
