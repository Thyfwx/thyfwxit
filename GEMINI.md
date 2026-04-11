# GEMINI.md - Project Instructions

This file provides guidance to Gemini CLI when working on the `thyfwxit` portfolio project.

## Project Overview
A single-file portfolio website (`index.html`) featuring embedded CSS and JavaScript. It uses pure vanilla HTML/CSS/JS with no build tools or external dependencies.

## Architecture & Structure
- **Single-File Pattern:** All styles, structure, and logic are contained within `index.html`.
- **CSS:** Utilizes CSS variables for theming (standard vs. kawaii/pink mode) and accessibility overrides.
- **JavaScript Features:**
  - Matrix rain background animation.
  - Three independent canvas games (Runner, Target, Tetris) using `requestAnimationFrame`.
  - Procedural sound effects via Web Audio API.
  - Particle system for visual feedback.
  - Live system status monitoring via external API.
  - Integrated accessibility menu.

## Development Mandates
- **CRITICAL SECURITY WARNING:** NEVER use `git add .` or commit all files blindly without verifying what is being staged. NEVER commit `.env`, `secrets.js`, `.claude/` or any other file containing API keys, webhooks, or credentials. A previous AI agent leaked highly sensitive tokens this way. ALWAYS double-check `git status` before committing.
- **Preserve Single-File Integrity:** Do not introduce external files or build steps unless explicitly requested. Maintain the existing embedded structure.
- **Game Logic Safety:** 
  - Ensure piece cloning in Tetris to avoid shared-state bugs.
  - Maintain explicit start/stop guards for animation loops.
  - Track `keydown`/`keyup` state manually to avoid keyboard repeat issues.
- **Style & Convention:** Adhere to the vanilla JS and CSS patterns already established in the file.
- **Verification:** Always verify game logic or UI changes by opening the file in a browser (if possible) or through rigorous code analysis.
- **Accessibility:** Ensure any new features or UI changes respect the existing accessibility menu controls (contrast, motion, font size).

## Deployment
- Use `./server-sync.sh` for VPS deployment (requires `DEPLOY_USER` and `DEPLOY_HOST`).
- Use `./update-from-github.sh` for pulling latest changes on the server.
