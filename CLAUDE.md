# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file portfolio website (`index.html`, ~3400 lines) with embedded CSS and JavaScript. No build tools, frameworks, or package managers. Pure vanilla HTML/CSS/JS.

## SECURITY MANDATE - CRITICAL
- **NEVER USE `git add .` or commit blindly.** A previous AI completely leaked a Cloudflare API Token, Discord Webhook, and Google Client Secrets because it did a blanket `git add` and pushed.
- **ALWAYS** check `git status` and specifically review `git diff` before committing any files.
- **NEVER** commit `.env`, `secrets.js`, `.claude/`, or ANY file that could potentially contain secrets or API keys.

## Deployment

```bash
# Sync to VPS after pushing to GitHub
./server-sync.sh   # requires DEPLOY_USER and DEPLOY_HOST env vars

# Pull latest from GitHub on VPS and optionally copy to ~/Documents/Domain/
./update-from-github.sh
```

The site is hosted at the repo: `https://github.com/Thyfwx/thyfwxit.git` (branch: `main`).

## Architecture

Everything lives in `index.html`. The file is organized into:

1. **CSS** — CSS variables for theming (normal + kawaii/pink mode), CRT/scanline overlay, accessibility overrides (high contrast, reduced motion, font/spacing controls).

2. **HTML structure** — Portfolio section, three game canvases, system status monitor, contact form, accessibility menu (bottom-right).

3. **JavaScript** — All logic embedded in `<script>` tags:
   - **Matrix rain** — background canvas animation (falling code characters)
   - **Games** — three independent canvas-based games sharing a similar start/stop/render loop pattern:
     - *Runner* — endless runner with obstacle collision and jump physics
     - *Target* — duck-hunting style game with difficulty scaling
     - *Tetris* — full Tetris with ghost pieces, rainbow mode, line-clear animations, shape cloning
   - **Particle system** — reused across games for visual feedback on events
   - **Web Audio API** — procedurally generated sound effects (no audio files)
   - **System status** — fetches live uptime data from an external API endpoint
   - **Contact form** — submits via fetch to a backend endpoint
   - **Accessibility menu** — toggles CSS classes/variables for font size, spacing, contrast, animation reduction

## Key Patterns

- Games use `requestAnimationFrame` loops with explicit start/stop guards to prevent multiple simultaneous loops.
- Tetris piece shapes are cloned (not referenced) before mutation to avoid shared-state bugs — this was a past fix.
- Keyboard repeat events are suppressed for game controls (track `keydown`/`keyup` state manually).
- Touch events are mapped to keyboard equivalents for mobile game support.
- The kawaii mode swaps CSS variables wholesale via a class on `<body>`.
