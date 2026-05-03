# CodeSurf Workspace Memory — collaborator-clone (Contex)

Generated: 2026-05-03

## Overview

Contex is an Electron desktop app providing an infinite-canvas workspace for AI agents and developers. Tiles (terminal, code editor, browser, kanban, chat) live on a 2D canvas. A local MCP HTTP server exposes agent tooling; chat integrates Claude, Codex, and OpenCode; extensions run as sandboxed webview tiles.

---

## Repository State (as of 2026-05-03)

- Active branch: **`main`** — HEAD: `5356b34` ("docs(plan): code-index implementation plan (10 phases, ~25 tasks)")
- **57 commits ahead of `origin/main`** — entire ChatTile extraction sprint plus prior event-bus/MCP/chat work is local only; push is overdue
- 8 uncommitted working-tree modifications; `.tmp/` is untracked
- CLAUDE.md references branch `feature/event-bus-mcp` — that text is stale; actual active branch is `main`

### Active local worktree branches

| Branch | Worktree path | Notes |
|---|---|---|
| `feat/code-index` | `/Users/jkneen/clawd/collaborator-clone-code-index` | 1 scaffold commit beyond `main` |
| `wt/command-context-buckets` | local only | stale |
| `wt/command-file-reference-expansion` | local only | stale |
| `wt/command-harvest-integration` | local only | stale |
| `wt/command-skills-index` | `/Users/jkneen/clawd/codesurf-wt-command-skills` | stale |
| `wt/merge-today-2026-04-22` | `/Users/jkneen/clawd/codesurf-wt-merge-today` | stale |

---

## Durable Architecture Facts

- `src/renderer/src/App.tsx` — **7112 lines** (CLAUDE.md's ~1700 figure is stale); entire 2D canvas engine lives here; edits have extreme blast-radius
- `src/renderer/src/components/ChatTile.tsx` — **8661 lines**; extraction subcomponents exist but import-swap not yet landed so file has not shrunk
- Canvas undo snapshots full state, max 50 entries; never push to undo stack on hot paths
- MCP server port is random on each start; always read from `~/.contex/mcp-server.json`; never hardcode
- Tiles are `React.lazy` + `Suspense` lazy-loaded; event bus ring-buffer 500 events per channel, no persistence
- `node-pty` requires `npm run rebuild` after any native dependency change
- `.claude/CLAUDE.md` is managed by Contex itself (`<!-- contex-managed -->`); do not hand-edit
- All chat providers stream via NDJSON/SSE parsed in `src/main/ipc/stream.ts`
- Persistence is file-only, no cloud sync: canvas state debounce-saved at 500ms, kanban per-tile, MCP config at `~/.contex/mcp-server.json`

---

## Active Sprint: ChatTile Extraction

32 commits landed (16 `refactor: extract` + 16 paired `docs:`). Extracted subcomponents in `src/renderer/src/components/chat/`. Import-swap has **not** landed; `ChatTile.tsx` stays at 8661 lines until it does. Do not add new logic to `ChatTile.tsx` — extract only. Dogfood verification of all extracted composer paths is a blocking pre-condition before closing this phase.

---

## Next Feature: Code-Index Extension

Spec and plan committed on `main`; manifest scaffolded one commit ahead on `feat/code-index` (`2c42ecc`). `main.js`, hook, tile, and lib not yet written. Working directory: `examples/extensions/code-index/` in the `collaborator-clone-code-index` worktree. Zero host-source changes; WASM bundle target ≤ 15 MB; hook overhead target ≤ 10ms p99.

---

## Infrastructure / Automation Status

- **OpenClaw lead agent** (`lead-c3f78d0c-…`): active, heartbeat-only as of 2026-05-03; no board tasks assigned
- **MC gateway** (`mc-gateway-894a3d5b-…`): persistent connection refused; unhealthy; restart required before next multi-agent session
- **Urgent email alert cron** (`4e55bac5-…`): running on schedule; script at `/Users/jkneen/clawd/scripts/email-alert-check.sh`; last run HEARTBEAT_OK
- **`gog` CLI**: installed; supports Gmail search/read/draft but not yet authenticated — run `gog auth add <email> --services=gmail --gmail-scope=full --force-consent` before any Gmail automation

---

## Adjacent Work (Other Workspaces, Same Session Day)

**Kanban-board plugin** (`/Users/jkneen/Documents/New project/plugins/kanban-board/`): `agentThreadId`-gated "Open conversation" button added; `npm run check` passing.

**codex-app/desktop** (`/Users/jkneen/Documents/GitHub/codex-app/desktop`): Linux x64 `spawn-helper` ELF added; ASAR unpack glob extended so `spawn-helper` lands in `app.asar.unpacked`; contract test guard added; Zig cross-compile used (Docker unavailable).

---

## Open Threads

- **57 commits not pushed** — push to `origin/main` before opening new feature branches
- **ChatTile.tsx import-swap not done** — file shrinks only after swap commit; dogfood check is a blocker
- **Code-index extension** — manifest scaffolded; `main.js`, hook, tile, lib pending on `feat/code-index`
- **LiveKit audio ducking** — 4 files uncommitted; `examples/` mirror goes in same commit as `bundled-extensions/`
- **Electrobun + FileExplorer null-safety** — 2 files uncommitted; low-risk
- **MC gateway restart** — required before reliable multi-agent use
- **gog auth** — not authenticated; needs `auth add` before any Gmail draft workflow
- **Product horizon** — Git Review extension / diff virtualization; plugins/skills-library UX
