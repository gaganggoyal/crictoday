#!/usr/bin/env bash
# Copies the newest nightly backup off the server into a dated folder on this computer, to keep
# somewhere else, such as Google Drive. Run it from the repository on a computer that can
# `ssh root@161.97.97.34`:
#
#   deploy/vps/fetch-backup.sh [--now] [folder]
#
# --now takes a fresh backup first. The folder defaults to ~/Downloads.
set -euo pipefail

HOST="${BACKUP_HOST:-root@161.97.97.34}"
REMOTE=/var/backups/cricketmatch
FRESH=false
if [ "${1:-}" = "--now" ]; then
  FRESH=true
  shift
fi
ROOT="${1:-$HOME/Downloads}"
remote() { ssh -o BatchMode=yes "$HOST" "$@"; }

if $FRESH; then remote systemctl start cricketmatch-backup.service; fi
dump=$(remote "ls -1 $REMOTE/cricketmatch-*.sql.gz 2>/dev/null | sort | tail -n 1")
if [ -z "$dump" ]; then
  echo "There is no backup on the server yet. Run this again with --now." >&2
  exit 1
fi
stamp=${dump##*/cricketmatch-}
stamp=${stamp%.sql.gz}
folder="$ROOT/cricketmatch-backup-$stamp"
mkdir -p "$folder/database" "$folder/pictures" "$folder/settings"
chmod 700 "$folder" "$folder/settings"

remote "cat '$dump'" >"$folder/database/${dump##*/}"
gzip -t "$folder/database/${dump##*/}"
pictures=$(remote "ls -1d $REMOTE/uploads-* 2>/dev/null | sort | tail -n 1")
if [ -n "$pictures" ]; then
  remote "tar -C '$REMOTE' -czf - '${pictures##*/}'" >"$folder/pictures/${pictures##*/}.tar.gz"
fi
# The server's settings, with its passwords and keys. Never print or share this file.
(
  umask 077
  remote "cat /var/www/cricketmatch/.env" >"$folder/settings/cricketmatch.env"
)

cat >"$folder/README.txt" <<EOF
cricketmatch.today backup, taken $stamp (UTC)

Keep this folder private. It holds people's email addresses, and settings/cricketmatch.env
holds the site's passwords and keys.

WHAT IS HERE

  database/cricketmatch-$stamp.sql.gz
      Everything in the database: matches, ticket links, clubs and academies with their
      offers and pictures' details, accounts, ticket alerts and the audit log.

  pictures/uploads-$stamp.tar.gz
      The logos and photos clubs uploaded.

  settings/cricketmatch.env
      The server's settings file: the database password, ENCRYPTION_KEY, CRON_SECRET and
      the Resend key.

  SHA256SUMS.txt
      Checksums, to confirm the files are whole after downloading them again.

WHAT IS NOT HERE

  The code, the fixtures and the server scripts are on GitHub:
  https://github.com/gaganggoyal/crictoday

WHY THE SETTINGS FILE MATTERS

  ENCRYPTION_KEY unlocks the email addresses stored with ticket alerts and keeps people
  signed in. Without it, a restored site cannot email alert holders, and everyone has to
  sign in again. The other values can be replaced: a new Resend key, a new CRON_SECRET,
  a new database password.

TO RESTORE, on a server set up as in docs/deployment.md

  1. Copy settings/cricketmatch.env to /var/www/cricketmatch/.env
     (owner cricketmatch, mode 600).
  2. gunzip -c database/cricketmatch-$stamp.sql.gz | mysql cricketmatch
  3. tar -xzf pictures/uploads-$stamp.tar.gz, then copy what is inside the
     uploads-$stamp folder to /var/lib/cricketmatch/uploads/ (owner cricketmatch).
  4. Run deploy/vps/deploy.sh.

TO CHECK THE FILES after downloading them from Google Drive

  In this folder: shasum -a 256 -c SHA256SUMS.txt

TO MAKE A NEWER COPY

  From the repository: deploy/vps/fetch-backup.sh --now
EOF

(
  cd "$folder"
  find database pictures settings -type f | sort | while IFS= read -r file; do
    shasum -a 256 "$file"
  done >SHA256SUMS.txt
)
echo "Saved $folder"
