# CodeSurf Workspace Memory — collaborator-clone (contex)

Generated: 2026-05-24 (dreaming pass 3)

---

## Overview

**contex** is an Electron desktop app providing an infinite canvas workspace for AI agents and developers. Tiles live on a 2D canvas; AI agents connect via a local MCP server and collaborate asynchronously with humans.

Active branch noted in CLAUDE.md/AGENTS.md is `feature/event-bus-mcp` — this is stale; actual working branch is `main`. Fix before creating PRs.

Adjacent repos active in this workspace orbit: **grok-cli** (`/Users/jkneen/Documents/GitHub/grok-cli`), **ideation-canvas** (`/Users/jkneen/Documents/GitHub/ideation-canvas`), **tinyworld** (`/Users/jkneen/Documents/GitHub/tinyworld`), **hermes-agent** (`~/clawd/github/hermes-agent`), **SmallHarness** (`/Users/jkneen/Documents/GitHub/SmallHarness`), and the **OpenClaw** cron infrastructure.

---

## Durable Facts — contex

### Stack

- Electron 40.8.2 · React 19.2.4 · TypeScript 5.9.3 · Vite / electron-vite 7.3.1 / 5.0.0; Tailwind CSS 4.0.0
- `@anthropic-ai/claude-agent-sdk` 0.2.79; `@opencode-ai/sdk` 1.2.27; `cluso-widget` optional local dep
- `node-pty` requires native rebuild; build: `npm run dev/build/rebuild`

IPC handlers, renderer hooks, tile components, chat sub-components, sidebar, settings, AI elements, and theme system files all catalogued with canonical names. Key conventions: IPC `{feature}:{action}`; MCP port random from `~/.contex/mcp-server.json`; canvas undo max 50 snapshots; extension tiles use `body.dark` via bridge not `prefers-color-scheme`; no emoji, no hardcoded color literals; macOS screenshots may be HEIC-in-PNG — convert with `sips` before reading.

## Active Feature Work — contex

- **Theme**: contrast slider + hairline shadows + black dark-mode anchor committed; saturation/warmth/accent knobs not yet wired
- **Voice/TTS**: handlers and hooks committed; UI surface wiring incomplete
- **Code index**: spec only at `docs/superpowers/specs/2026-05-03-code-index-design.md`
- **ChatTile refactor**: `chat/` subdirectory extracted; ongoing

## Durable Facts — grok-cli / SmallHarness / tinyworld

**grok-cli**: Recent commit burst — Auto mode, Nerd Font icons, MessageList/InputRouter extraction, virtual Ask rows, diff/LSP views. Uncommitted: `agent.ts`, `api.ts`, `hermes-gateway-provider.ts`, several test files. REVIEW_23 item #3 (turn setup/finalization extraction) still open.

**SmallHarness Hermes mode**: Fixed. Single-slash commands pass through; local commands use `//`; tool delegation correct; `approvalPolicy` wired; all Rust gates pass.

**tinyworld Materials panel**: Settings → Materials section added with per-part-group tint/texture/light-dark/reset controls; terrain texture dropdown added; `textures/` copied to `dist/` via `publish.sh`. Files modified but not yet committed.

## OpenClaw Status

Working: email alert heartbeat, daily briefings, Skills Scout, article generator. Broken: MC Gateway (`localhost:19789` connection refused), Twitter/X Chrome auth, DGX wallpaper service (`192.168.4.104:8003` service unresponsive), Gemini 429.

## Open Threads

REVIEW_23 #3 · grok-cli uncommitted batch (check hermes-gateway-provider for SmallHarness protocol alignment) · tinyworld materials commit pending · hermes TUI migration not started · MC Gateway restart needed · Twitter/X manual Chrome login needed · DGX service restart needed · theme knobs saturation/warmth/accent not wired · voice UI wiring incomplete · CLAUDE.md stale branch name · Gemini billing
