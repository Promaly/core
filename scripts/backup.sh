#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [backup-directory]" >&2
  exit 64
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$root_dir/compose.yaml"
environment_file="$root_dir/.env"
backup_dir="${1:-$root_dir/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/promaly-$timestamp.dump"
manifest_file="$backup_dir/promaly-$timestamp.manifest.json"

mkdir -p "$backup_dir"

docker compose --env-file "$environment_file" -f "$compose_file" exec -T postgres \
  pg_dump --username=promaly --dbname=promaly --format=custom --no-owner --no-privileges \
  > "$backup_file"

if command -v shasum >/dev/null 2>&1; then
  checksum="$(shasum -a 256 "$backup_file" | awk '{print $1}')"
else
  checksum="$(sha256sum "$backup_file" | awk '{print $1}')"
fi

printf '{"format":"pg_dump_custom","created_at":"%s","file":"%s","sha256":"%s"}\n' \
  "$timestamp" "$(basename "$backup_file")" "$checksum" > "$manifest_file"

echo "Database backup created: $backup_file"
echo "Manifest created: $manifest_file"
