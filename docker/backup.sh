#!/bin/sh
# Writes a timestamped custom-format pg_dump to BACKUP_DIR and prunes old dumps.
#
# Compose mode (default): dumps through the running `postgres` service, so it
# works in production where Postgres publishes no host port.
#   docker/backup.sh
# URL mode: dumps any reachable database with a local pg_dump of the same or a
# newer major version (managed Postgres, a restore drill target).
#   BACKUP_DATABASE_URL=postgresql://... docker/backup.sh
#
# Settings: BACKUP_DIR (default ./backups), BACKUP_RETENTION_DAYS (default 14),
# COMPOSE_FILES (default "-f docker-compose.yml -f docker-compose.prod.yml").
set -eu

backup_dir="${BACKUP_DIR:-./backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
compose_files="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.prod.yml}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_dir}/metsys-${timestamp}.dump"
partial="${target}.partial"

mkdir -p "${backup_dir}"
umask 077

if [ -n "${BACKUP_DATABASE_URL:-}" ]; then
  pg_dump --format=custom --no-owner --dbname="${BACKUP_DATABASE_URL}" >"${partial}"
else
  # shellcheck disable=SC2086 # compose_files is a deliberate list of flags.
  docker compose ${compose_files} exec -T postgres \
    sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >"${partial}"
fi

# A dump that pg_restore cannot list is corrupt; never keep it as a backup.
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "${partial}" >/dev/null
else
  # shellcheck disable=SC2086
  docker compose ${compose_files} exec -T postgres pg_restore --list <"${partial}" >/dev/null
fi

mv "${partial}" "${target}"
echo "Wrote ${target}"

find "${backup_dir}" -name 'metsys-*.dump' -type f -mtime "+${retention_days}" -print -delete
