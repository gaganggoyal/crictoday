#!/usr/bin/env bash
# Run by cricketmatch-sync.timer. curl reads the header from stdin, so CRON_SECRET never
# appears in the process list.
set -euo pipefail
printf 'header = "Authorization: Bearer %s"\n' "${CRON_SECRET:?CRON_SECRET is not set}" |
  curl --fail --silent --show-error --max-time 300 --config - \
    --request POST http://127.0.0.1:3300/api/cron/sync
echo
