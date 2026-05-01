# GEMINI.md — thyfwxit (public portfolio repo)

Read `CLAUDE.md` in this same directory first. Both files load identical context for Gemini and Claude.

For Nexus-specific guidance (which lives in a separate repo), see:
`/Users/xavierscott/Documents/Domain_Project/GEMINI.md`

## Quick rules for this repo

- Public site: `https://thyfwxit.com` (Cloudflare Pages, deploys from `main`).
- Edit on `sandbox` branch. Merge to `main` only with explicit approval.
- The `nexus/` subfolder is a mirror — do not edit here. Edit `~/Documents/Domain_Project/Nexus/web_nexus/static/` and run `sync.sh`.
- Secrets (`nexus/secrets.js`, `.env*`, `deploy-worker.sh`) are gitignored. Keep them gitignored.
- `fetchLatestCommitStatus` in `main.js` is **permanently protected** — do not touch.
- After any JS edit: `node --check main.js` before claiming done.
