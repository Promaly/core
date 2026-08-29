# ARM64 installation

Install Docker Engine and the Docker Compose plugin on the ARM64 host, clone this
repository (or copy `compose.yaml`) into an empty directory, then:

```sh
docker compose up -d
docker compose ps
```

No `.env` and no secrets. Compose builds the multi-architecture image on first
run, generates the internal database and object-storage credentials, applies
migrations, creates the private bucket, and starts the API and worker. To run a
published release instead of building, set `PROMALY_IMAGE=ghcr.io/promaly/promaly`
and `PROMALY_VERSION=<signed tag>` in `.env`.

Expose only port 3000 through a TLS reverse proxy. Confirm readiness with
`curl http://127.0.0.1:3000/readyz`, then open the app and register the first
admin account.
