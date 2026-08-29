# Promaly Core

Promaly is a lightweight, self-hosted work-management platform for teams — an alternative to Linear and Jira.

## Current status

Phase 0 foundations are complete and hardened. Phase 1 (identity, tenancy, project management) is in progress; only the identity slice has landed.

## Quick start

Requires Node.js 24+ and pnpm 11.5.2+.

```sh
pnpm install
cp .env.example .env
pnpm dev
```

The API responds at `http://localhost:3000/healthz`. `readyz` returns 503 until both PostgreSQL and MinIO are configured and reachable. Prometheus-compatible process metrics are available only on the loopback listener at `http://127.0.0.1:9090/metrics`.

To run the single image locally:

```sh
docker build -t promaly:dev .
docker run --rm -p 3000:3000 promaly:dev
```

For a self-hosted deployment, no configuration is required:

```sh
docker compose up -d
```

The image builds on first run, internal database and object-storage credentials
are generated automatically, migrations and private-bucket creation happen
before the API starts, and the first admin account is created in the web UI.
`.env` is optional — see `.env.example` for the operator overrides (public port,
SMTP, running a published image).

See [Core deployment](docs/operations/core-deployment.md), [installation](docs/operations/install.md), [status](docs/status.md), and [backup and restore](docs/operations/backup-and-restore.md) before deploying real data.

The web client is built against [the interaction spec](docs/upstream-notes/interaction-spec.md).

## Repository layout

- `apps/api` — Fastify HTTP API and future WebSocket gateway
- `apps/worker` — placeholder process until Phase 1 background work arrives
- `packages/config` — validated runtime configuration
- `packages/contracts` — shared API contracts
- `packages/domain` — business rules and permissions
- `packages/db` — Drizzle schema, forward-only migrations and PostgreSQL access
- `compose.yaml` — single-image Core deployment with PostgreSQL and MinIO
- `docs/architecture/adr` — accepted architecture decisions
