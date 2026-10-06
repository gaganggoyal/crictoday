#!/usr/bin/env bash
# Installs the Node.js LTS that cricketmatch runs on, beside the system's own Node, and points
# /opt/node24 at it. Other apps on the server keep /usr/bin/node.
# Run as root: /var/www/cricketmatch/deploy/vps/install-node.sh [version]   (default: newest 24.x)
set -euo pipefail

LINE=24
BASE=https://nodejs.org/dist
VERSION="${1:-$(curl -fsSL "$BASE/latest-v$LINE.x/SHASUMS256.txt" |
  sed -n "s/.*node-\(v$LINE\.[0-9]*\.[0-9]*\)-linux-x64\.tar\.gz$/\1/p" | head -n 1)}"
case "$VERSION" in
  "v$LINE".*) ;;
  *) echo "Expected a v$LINE release, got '$VERSION'." >&2; exit 1 ;;
esac
NAME="node-$VERSION-linux-x64"

if [ ! -x "/opt/$NAME/bin/node" ]; then
  WORK=$(mktemp -d)
  trap 'rm -rf "$WORK"' EXIT
  curl -fsSL -o "$WORK/$NAME.tar.gz" "$BASE/$VERSION/$NAME.tar.gz"
  curl -fsSL -o "$WORK/SHASUMS256.txt" "$BASE/$VERSION/SHASUMS256.txt"
  curl -fsSL -o "$WORK/SHASUMS256.txt.sig" "$BASE/$VERSION/SHASUMS256.txt.sig"
  # The checksums are signed by Node's release team; their keys come from GitHub, not nodejs.org.
  curl -fsSL -o "$WORK/release-keys.kbx" \
    https://github.com/nodejs/release-keys/raw/HEAD/gpg-only-active-keys/pubring.kbx
  gpgv --keyring "$WORK/release-keys.kbx" "$WORK/SHASUMS256.txt.sig" "$WORK/SHASUMS256.txt"
  (cd "$WORK" && grep " $NAME.tar.gz\$" SHASUMS256.txt | sha256sum -c -)
  tar -xzf "$WORK/$NAME.tar.gz" -C /opt
  chown -R root:root "/opt/$NAME"
fi
ln -sfn "/opt/$NAME" "/opt/node$LINE"
echo "/opt/node$LINE is $("/opt/node$LINE/bin/node" --version)."
