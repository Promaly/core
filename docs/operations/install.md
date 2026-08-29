# ARM64 installation

Install Docker Engine and the Docker Compose plugin on the ARM64 host, then copy the release Compose file and environment template to an empty deployment directory.

```sh
cp .env.example .env
# Set strong POSTGRES_PASSWORD, POSTGRES_APP_PASSWORD, and MINIO_ROOT_PASSWORD values.
# Set PROMALY_VERSION to a signed published release tag.
docker compose up -d
docker compose ps
```

Compose pulls the multi-architecture release image, runs migrations and private-bucket setup, then starts the API and worker. Expose only port 3000 through a TLS reverse proxy. Confirm readiness with `curl http://127.0.0.1:3000/readyz`.
