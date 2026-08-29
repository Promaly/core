# Backup and restore

Promaly Core's database is backed up with PostgreSQL's custom `pg_dump` format. Phase 0 does not yet persist attachments; when attachment storage is introduced, its S3 backup must be completed alongside this procedure.

## Create a backup

Start Core Compose from the repository root, then run:

```sh
./scripts/backup.sh
```

Backups and SHA-256 manifests are written to the git-ignored `backups/` directory by default. Store that directory in encrypted, off-host storage.

Also back up the `promaly-secrets` volume — it holds the generated database and
object-storage passwords. A database dump restored against a fresh `promaly-secrets`
volume will not authenticate.

```sh
docker run --rm -v promaly_promaly-secrets:/s -v "$PWD/backups":/out alpine \
  tar czf /out/promaly-secrets.tgz -C /s .
```

## Verify a backup

This restores into a temporary, clean database and deletes that temporary database when done. It does not touch the live `promaly` database.

```sh
./scripts/verify-restore.sh backups/promaly-<timestamp>.dump
```

## Restore the live database

Stop application traffic first. This is destructive and intentionally requires an explicit confirmation:

```sh
./scripts/restore.sh backups/promaly-<timestamp>.dump --confirm
```

Restart Core Compose and confirm `/readyz` returns 200. Perform this verification before every release and at least quarterly in a separate environment.
