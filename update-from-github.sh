#!/usr/bin/env bash
# Pull latest site from GitHub. Optional: copies index.html to your Domain folder.
set -euo pipefail
cd "$(dirname "$0")"
git fetch origin
git pull origin main
DOMAIN_COPY="${DOMAIN_COPY:-$HOME/Documents/Domain/index.html}"
DEST_DIR="$(dirname "$DOMAIN_COPY")"
if [[ -f index.html && -d "$DEST_DIR" ]]; then
  cp index.html "$DOMAIN_COPY"
  echo "Copied index.html -> $DOMAIN_COPY"
fi
echo "Latest commit: $(git log -1 --oneline)"
