# Core deployment

Promaly Core deploys one Promaly image as both the API and worker, plus PostgreSQL and MinIO. PostgreSQL and MinIO have no host ports; expose only the API through your TLS proxy.

```sh
cp .env.example .env
# Replace every example secret and set a released PROMALY_VERSION.
docker compose run --rm app node packages/db/dist/migrate.js
docker compose up -d
```

The same image runs `apps/api/dist/main.js` for the API and `apps/worker/dist/main.js` for the worker. Validate the deployment through `https://your-promaly-host/readyz` and scrape `https://your-promaly-host/metrics` only from a trusted monitoring network.

Use immutable versioned image tags through `PROMALY_VERSION`; never use `latest`. The default production image is `ghcr.io/promaly/promaly`.
