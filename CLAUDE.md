# CLAUDE.md — thyfwxit (public portfolio repo)

This is the GitHub repo `Thyfwx/thyfwxit` that deploys to `https://thyfwxit.com` via Cloudflare Pages.

## SECURITY MANDATE - CRITICAL
- **NEVER USE `git add .` or commit blindly.** A previous AI leaked a Cloudflare API Token, Discord Webhook, and Google Client Secrets via a blanket `git add`.
- **ALWAYS** check `git status` and review `git diff` before committing.
- **NEVER** commit `nexus/secrets.js`, `nexus/evil-worker.js`, `deploy-worker.sh`, `.env*`, or anything containing tokens. These are gitignored — keep them gitignored.

## Sandbox vs Main workflow (effective 2026-05-01)

| Branch | Purpose |
|---|---|
| `main` | What's deployed to thyfwxit.com. Locked. |
| `sandbox` | Where Claude works. Reviewed before any merge. |

Workflow: edit on `sandbox` → `git diff main..sandbox` → on approval, `git checkout main && git merge sandbox && git push`.

## Project layout

```
~/Documents/Domain_Project/thyfwxit/
├── index.html        # Single-page portfolio (~3500 lines, NOT embedded — uses external assets)
├── main.js           # All page logic — games, accessibility, status, mod menu
├── style.css         # All styling
├── nexus/            # Mirror of Domain_Project/Nexus/web_nexus/static/ — DO NOT EDIT HERE
│                     # (sync.sh keeps it in step; secrets.js is gitignored and preserved across deploys)
├── server-sync.sh    # VPS sync helper
└── update-from-github.sh
```

The portfolio is NOT a single embedded file. CSS and JS are external. Old docs may say otherwise — they're stale.

## Architecture summary

1. **Matrix rain canvas** — background animation in `main.js`
2. **Three games** — Cyber Runner, Target Sim, Tetris — canvas-based, share `requestAnimationFrame` loop pattern
3. **Particle system** — visual feedback shared across games
4. **Web Audio API** — procedurally generated sound effects
5. **System status** — fetches from Uptime Kuma badges (`fetchUptimeStatus` in `main.js`); also drives the live Proxmox project-card badge
6. **Project status badges** — `setProjectStatusBadge(id, status)` and `window.NEXUS_STATUS` flag at top of `main.js`
7. **Accessibility menu** — toggle classes on body, persisted in `localStorage` under `thyfwxit_a11y_v1`, plus OS-pref auto-apply
8. **Contact form** — submits via fetch
9. **Mod menu** — hidden behind 5 quick taps on the header

## Key patterns

- Games use `requestAnimationFrame` with explicit start/stop guards.
- Tetris piece shapes are cloned (not referenced) before mutation — past fix.
- Keyboard repeat events are suppressed for game controls (manual `keydown`/`keyup` tracking).
- Touch events map to keyboard equivalents on mobile.
- Kawaii mode swaps CSS variables wholesale via a body class.

## PROTECTED CODE

`fetchLatestCommitStatus` in `main.js` is **permanently protected**. It pulls the latest commit from `Thyfwx/thyfwxit` and renders it in the Nexus boot preview. Look for the `PROTECTED — DO NOT REMOVE OR MODIFY` guard comment. Never delete, overwrite, or refactor.

## Deployment

```bash
# From Domain_Project root, full deploy:
./sync.sh   # NEVER run blindly — review git status first

# Or push GitHub-only and let Cloudflare Pages auto-deploy from main:
git push origin main
```

## Verify-before-claim

- After any JS edit: `node --check main.js`
- After any HTML/CSS visible change: ask Xavier to hard-refresh and confirm before claiming done
- Never claim "this should work" — say "I verified X by Y" or "I cannot verify Z"
