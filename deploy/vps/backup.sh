#!/usr/bin/env bash
# Nightly backup of the cricketmatch database and the pictures clubs upload, run by
# cricketmatch-backup.timer as the cricketmatch user. Keeps the newest 14 of each in
# /var/backups/cricketmatch. Restoring is in docs/deployment.md.
set -euo pipefail
umask 077

DEST="${BACKUP_DIR:-/var/backups/cricketmatch}"
KEEP="${BACKUP_KEEP:-14}"
UPLOADS="${UPLOAD_DIR:-/var/www/cricketmatch/.data/uploads}"
STAMP=$(date -u +%Y%m%d-%H%M%S)
mkdir -p "$DEST"

# DATABASE_URL is mysql://user:password@host:port/database. The password goes in a file only
# this user can read, never on a command line.
url="${DATABASE_URL:?DATABASE_URL is not set}"
rest=${url#mysql://}
credentials=${rest%%@*}
location=${rest#*@}
address=${location%%/*}
database=${location#*/}
database=${database%%\?*}
host=${address%%:*}
port=3306
[ "$address" != "$host" ] && port=${address##*:}
decode() { printf '%b' "${1//%/\\x}"; }
user=$(decode "${credentials%%:*}")
password=$(decode "${credentials#*:}")
password=${password//\\/\\\\}
password=${password//\"/\\\"}

config=$(mktemp)
trap 'rm -f "$config" "$DEST"/*.part' EXIT
printf '[client]\nuser=%s\npassword="%s"\nhost=%s\nport=%s\n' "$user" "$password" "$host" "$port" >"$config"

dump="$DEST/$database-$STAMP.sql.gz"
mysqldump --defaults-extra-file="$config" --single-transaction --quick --no-tablespaces \
  --set-gtid-purged=OFF "$database" | gzip -9 >"$dump.part"
mv "$dump.part" "$dump"
echo "database: $dump ($(du -h "$dump" | cut -f1))"

# Pictures never change once written, so each night's copy hard-links the files the last one
# already has and costs only the new ones.
if [ -d "$UPLOADS" ]; then
  latest=$(find "$DEST" -maxdepth 1 -type d -name 'uploads-*' | sort | tail -n 1)
  rsync -a --delete ${latest:+--link-dest="$latest"} "$UPLOADS/" "$DEST/uploads-$STAMP/"
  echo "pictures: $DEST/uploads-$STAMP ($(find "$DEST/uploads-$STAMP" -type f | wc -l) files)"
fi

# Keep the newest $KEEP of each; the names sort by date.
prune() {
  sort | awk -v keep="$KEEP" '{ line[NR] = $0 } END { for (i = 1; i <= NR - keep; i++) print line[i] }' |
    while IFS= read -r old; do rm -rf -- "$old"; done
}
find "$DEST" -maxdepth 1 -name "$database-*.sql.gz" | prune
find "$DEST" -maxdepth 1 -type d -name 'uploads-*' | prune
