# Core deployment

Promaly Core deploys one Promaly image as both the API and worker, plus PostgreSQL and MinIO. PostgreSQL and MinIO have no host ports; expose only the API through your TLS proxy.

```sh
cp .env.example .env
# Replace every example secret and set a released PROMALY_VERSION.
docker compose up -d
```

The `migrate` and `createbuckets` one-shot services complete before the API and worker begin. The migrator connects with the PostgreSQL owner URL; the API and worker use the restricted `promaly_app` role, which has DML privileges only. The same image runs `apps/api/dist/main.js` for the API and `apps/worker/dist/main.js` for the worker. Validate the deployment through `https://your-promaly-host/readyz`. Metrics bind only to the Compose network loopback address and are not published to the host.

Use immutable versioned image tags through `PROMALY_VERSION`; never use `latest`. The default production image is `ghcr.io/promaly/promaly`.

## Upgrade and rollback

Before upgrading, pull the intended release and run the migration job explicitly to review its output: `docker compose pull` followed by `docker compose run --rm migrate`. Then run `docker compose up -d`. Migrations are forward-only: a rollback means deploying the prior application image only after verifying that it is compatible with the migrated schema; restore a tested backup for schema/data rollback.
