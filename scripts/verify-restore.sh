#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-file>" >&2
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
verify_database="promaly_restore_verify_$(date -u +%Y%m%d%H%M%S)"

cleanup() {
  docker compose --env-file "$environment_file" -f "$compose_file" exec -T postgres \
    dropdb --if-exists --username=promaly "$verify_database" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose --env-file "$environment_file" -f "$compose_file" exec -T postgres \
  createdb --username=promaly "$verify_database"
docker compose --env-file "$environment_file" -f "$compose_file" exec -T postgres \
  pg_restore --username=promaly --dbname="$verify_database" --no-owner --no-privileges < "$backup_file"

table_count="$(docker compose --env-file "$environment_file" -f "$compose_file" exec -T postgres \
  psql --username=promaly --dbname="$verify_database" --tuples-only --no-align \
  --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")"

if [[ "$table_count" -lt 1 ]]; then
  echo "Restore verification failed: no public tables were restored." >&2
  exit 1
fi

echo "Restore verification passed using clean database: $verify_database"
