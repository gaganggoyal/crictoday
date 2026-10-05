#!/usr/bin/env bash
# Deploy a branch or commit of cricketmatch.today on the VPS, then restart it.
# Run as root: /var/www/cricketmatch/deploy/vps/deploy.sh [ref]   (ref defaults to main)
set -euo pipefail

APP=/var/www/cricketmatch
REF="${1:-main}"
as_app() {
  runuser -u cricketmatch -- env HOME="$APP" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 "$@"
}

cd "$APP"
as_app git fetch --quiet origin "$REF"
# Ignored files (.env, node_modules, .next) stay. Local edits to tracked files stop the deploy.
as_app git checkout --quiet --detach FETCH_HEAD
as_app corepack pnpm install --frozen-lockfile
as_app corepack pnpm build
as_app corepack pnpm db migrate
systemctl restart cricketmatch
for attempt in $(seq 1 30); do
  if curl --silent --fail --output /dev/null http://127.0.0.1:3300/; then
    echo "cricketmatch.today is serving $(as_app git rev-parse --short HEAD)."
    exit 0
  fi
  sleep 1
done
echo "cricketmatch did not answer on port 3300. Check: journalctl -u cricketmatch -n 100" >&2
exit 1
