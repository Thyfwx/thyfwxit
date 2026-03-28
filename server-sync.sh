#!/usr/bin/env bash
# From your Mac: refresh the site on your VPS after you have pushed to GitHub.
#
#   export DEPLOY_USER=you
#   export DEPLOY_HOST=your.server.example
#   export DEPLOY_PATH=/var/www/thyfwxit   # optional
#   ./server-sync.sh
#
# Requires: that path on the server is a git clone with origin pointing at GitHub.
set -euo pipefail
: "${DEPLOY_USER:?Set DEPLOY_USER}"
: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/thyfwxit}"

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "export DEPLOY_PATH=$(printf '%q' "$DEPLOY_PATH"); bash -s" <<'REMOTE'
set -euo pipefail
cd "$DEPLOY_PATH"
git fetch origin
git reset --hard origin/main
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true
fi
if systemctl is-active --quiet caddy 2>/dev/null; then
  sudo systemctl reload caddy 2>/dev/null || true
fi
echo "Deployed: $(git log -1 --oneline)"
REMOTE

</think>


<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Shell