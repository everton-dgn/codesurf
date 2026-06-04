# contex — Generated Workspace Memory

Generated: 2026-06-04 (refreshed)

## Overview

**contex** is an Electron desktop app providing an infinite-canvas workspace where tiles (terminal, code editor, browser, kanban, chat, extensions) coexist on a 2D canvas. AI agents connect via a local MCP server and interact with canvas/kanban state asynchronously alongside human operators. Active branch: `feature/event-bus-mcp`.

---

## Durable Facts

### Stack

- Electron 40.8.2 · React 19.2.4 · TypeScript 5.9.3 · Vite/electron-vite 7.3.1/5.0.0
- Tailwind CSS 4.0.0 · dark theme hardcoded (`#1e1e1e`, `#252525`, `#333`)
- xterm + node-pty for terminals; Monaco for code tiles
- `@anthropic-ai/claude-agent-sdk` 0.2.79; `@opencode-ai/sdk` 1.2.27
- `cluso-widget` optional local dep (`file:../agentation-real`) — may not exist in all environments

### Canvas Engine (`src/renderer/src/App.tsx`, ~1700 LOC)

- All 2D physics in one file: pan/zoom, drag, resize, snapping, groups, undo/redo
- Undo holds full snapshots (max 50) — never push to undo stack in hot paths
- All tile components lazy-loaded via `React.lazy` + `Suspense`
- Heavy `useRef` usage to avoid stale closures in event handlers
- Changes ripple widely — be surgical

### Event Bus, MCP, Persistence

- Event bus: main-process pub/sub, wildcard subscriptions, ring-buffer 500 events/channel, no persistence
- MCP server starts on a random port each run — always read from `~/.contex/mcp-server.json`, never hardcode; current session port: 49604
- Canvas auto-saved every 500 ms; kanban tiles and MCP config are file-based only

### Chat Providers

Confirmed working model names for Hermes/Codex: `gpt-5`, `gpt-5.5`. All providers stream via NDJSON/SSE in `src/main/ipc/stream.ts`.

---

## Bundled Extensions (11 total, confirmed)

`agent-kanban`, `builder` (screenshot-driven design), `code-index`, `context-deck`, `livekit-rooms`, `local-models`, `qa-workbench`, `rewind-lite`, `sketch`, `source-control`, `test-loop` — all added/completed June 3–4, 2026.

---

## Active Subsystems

- **Ava** (OpenClaw agent `9f5f3df9`) — board `c3f78d0c`; heartbeat healthy; gateway UP at `localhost:19789`
- **Mc Gateway** (`894a3d5b`) — every assistant turn failing; root cause unknown
- **Openclaw crons** — all four jobs failing (Tom Doerr Tweet Tracker `cebd05e0`, VibeClaw Skills Scout, Article Generator, Wallpaper Generator)
- **Hermes streaming** — hardened in `b60daa5`; ChatTile refactored in `ce42252`
- **Theme customization** — tokens, contrast slider, CSS variables committed; 0.5px hairline shadows, black-anchored dark-mode shadows in place

---

## Open Threads

- Mc Gateway provider config broken — investigate model availability
- All four OpenClaw cron jobs failing — no root cause confirmed
- Codex subprocess PATH fix identified but not confirmed written to production source
- Builder history persistence not implemented; canvas placement behaviour wrong
- Chat tile rich input bar (model selector, MCP toggle, attachments, shimmer) not yet built
- Theme builder and layout builder pending
- OpenClicky permissions preflight gap — action methods don't gate on readiness before posting events
- CUA skill vs app mismatch — `cua-driver` skill mandates background+snapshot; voice routes still use foregrounded/raw-coordinate paths
- `index.js` (20624-line compiled bundle) committed in `6b302a0` — consider `.gitignore`
