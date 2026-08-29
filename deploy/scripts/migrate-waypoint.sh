#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${WAYPOINT_MIGRATION_ENV:-/etc/waypoint/migration.env}"
RELEASE_DIR="${WAYPOINT_RELEASE_DIR:-/opt/waypoint/current}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Migration environment is not readable: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
cd "$RELEASE_DIR"
exec /usr/bin/node server/db/migrate.js
