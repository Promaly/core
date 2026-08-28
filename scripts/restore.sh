#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || "$2" != "--confirm" ]]; then
  echo "Usage: $0 <backup-file> --confirm" >&2
  echo "This replaces the active Promaly database. Use verify-restore.sh for a safe verification." >&2
  exit 64
fi

backup_file="$1"
if [[ ! -f "$backup_file" ]]; then
  echo "Backup file not found: $backup_file" >&2
  exit 66
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$root_dir/compose.yaml"
environment_file="$root_dir/.env"

docker compose --env-file "$environment_file" -f "$compose_file" exec -T postgres \
  pg_restore --username=promaly --dbname=promaly --clean --if-exists --no-owner --no-privileges \
  < "$backup_file"

echo "Database restore completed. Run docker compose up -d to restart Promaly services."
