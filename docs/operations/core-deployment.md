# Core deployment

Promaly Core deploys one Promaly image as both the API and worker, plus PostgreSQL and MinIO. PostgreSQL and MinIO have no host ports; expose only the API through your TLS proxy.

```sh
docker compose up -d
```

That is the whole install. No `.env`, no secrets to set.

**Credentials.** The one-shot `bootstrap` service generates the PostgreSQL and MinIO passwords on first run into the `promaly-secrets` volume and never overwrites them. They are not in `compose.yaml`, in `docker inspect`, or in git. Every service reads them from files at start through a small shell wrapper — the stores get `POSTGRES_PASSWORD` / `MINIO_ROOT_PASSWORD` set from the files (any value a hosting platform injects is overwritten), and the API and worker build their `DATABASE_URL` the same way. Back up the `promaly-secrets` volume alongside the database.

**Startup order.** `bootstrap` → `postgres` + `minio` → `migrate` (connects as the owner role, creates the restricted `promaly_app` role, applies migrations) and `createbuckets` → `app` + `worker` (`promaly_app`, DML only). Compose enforces this with health and completion conditions. The `migrate` step is idempotent — re-running it repairs the role and grants, so a redeploy fixes a database left half-initialised by an earlier failed attempt.

**First admin.** Open the app and register — the first account owns the first workspace.

**Overrides.** `.env` is optional and carries only operator choices: `PROMALY_PORT`, `SMTP_URL` / `SMTP_FROM`, `LOG_LEVEL`, `METRICS_TOKEN`, and `PROMALY_IMAGE` / `PROMALY_VERSION` to run a published release instead of building from this checkout. See `.env.example`. Metrics bind to the Compose network but are never published to the host; set `METRICS_TOKEN` before a sidecar scrapes them. Validate through `https://your-promaly-host/readyz`.

## Upgrade and rollback

From a source checkout: `git pull` then `docker compose up -d --build`. Running a
published image: bump `PROMALY_VERSION` in `.env`, then `docker compose pull` and
`docker compose up -d`. To review the migration before it runs against live data,
`docker compose run --rm migrate` first.

Migrations are forward-only. A rollback means deploying the prior image only after
confirming it is compatible with the migrated schema; otherwise restore a tested
backup (database dump **and** the `promaly-secrets` volume).
