# Workspace Memory — contex (collaborator-clone)

Generated: 2026-05-04. Supplements CLAUDE.md/AGENTS.md — does not replace them.

---

## Overview

**contex** is an Electron desktop app (v40.8.2) — infinite canvas workspace where AI agents and humans collaborate via tiles. Also branded **CodeSurf** (`electrobun.config.ts`, bundle ID `com.huggiapps.codesurf.electrobun`).

Active branch: `main-merge`. HEAD: `53747aa` ("Add daemon, chat app, tastes, and workspace memory"). Working tree clean as of 2026-05-04. CLAUDE.md/AGENTS.md still reference `feature/event-bus-mcp` — stale; actual branch is `main-merge`.

---

## Architectural NorthStar

> "The desktop is dumb as shit. The daemon is smart." (commit `587a239`)

- All intelligence belongs in `grok-cli` (the `codesurf` CLI at `~/Documents/GitHub/grok-cli/`), not in this repo
- Desktop is a rendering shell: input → output → daemon
- Code-index lib modules must live in `grok-cli`, not the desktop
- CLI/SDK providers own native execution state; CodeSurf collates normalized conversation output and stable pointers
- Features involving intelligence, indexing, memory, or agent behavior belong in grok-cli — not the desktop repo

---

## Durable Facts

### Stack
- Electron 40.8.2, React 19.2.4, TypeScript 5.9.3, Vite/electron-vite 7.3.1/5.0.0, Tailwind CSS 4.0.0
- xterm + node-pty for terminal; Monaco for code tiles
- `@anthropic-ai/claude-agent-sdk` (session resumption + adaptive thinking); `@opencode-ai/sdk` 1.2.27; chokidar for fs watch
- All providers stream via NDJSON/SSE parsed in `src/main/ipc/stream.ts`

### IPC
- Naming: `{feature}:{action}` — handlers in `src/main/ipc/`; context bridge in `src/preload/index.ts`

### MCP Endpoints (two separate concerns)
- **Agent tool MCP**: config at `~/.contex/mcp-server.json` — random port per launch; never hardcode
- **Claude Code / Codex MCP**: `.mcp.json` at `http://127.0.0.1:56009/mcp` — hardcoded port; produces `data did not match any variant of untagged enum JsonRpcMessage` when contex is not running

### Persistence
- `~/.contex/workspaces/{id}/canvas.json` (500ms debounce auto-save)
- `~/.contex/workspaces/{id}/tiles/{id}.json` (kanban tile state)
- `~/.contex/mcp-server.json` (MCP config)
- `~/.codesurf/` (daemon state — **distinct from `~/.contex/`**)

---

## Internal Packages

| Package | Description |
|---|---|
| `packages/codesurf-daemon/` | `@codesurf/daemon` v0.1.0 — `DaemonManager`, `DaemonClient`, `paths.ts`; all `bin/*.mjs` are shims; committed in `53747aa` |
| `packages/codesurf-dreaming/` | `@codesurf/dreaming` v0.1.0 — `consolidate(sessions) → string` |
| `packages/contex-relay/` | `@contex/relay` v0.1.0 — local-first agent messaging |
| `packages/contex-chat-bridge/` | `@contex/chat-bridge` v0.1.0 — `PROTOCOL_VERSION=1`, `BRIDGE_NAMESPACE='contex-chat-bridge'`; exports: `onContext`, `callHost`, `subscribe` |
| `apps/chat-app/` | Standalone chat web app — `@assistant-ui/react` + Vercel AI SDK v6 + Tailwind 4; webview host target |

---

## Taste / Behavioral Preferences (`.commandcode/taste/`)

Committed in `53747aa`. Captured learned user preferences:

- **Communication**: act immediately on permission; no clarifying questions when user says "do it"; NEVER guess or fallback — exact matches only
- **Workflow**: task list + systematic execution for "Make a list and get them all DONE"; single-issue focus for "just that ONE thing"
- **Architecture**: preserve exact functionality when porting; keep extension dev in `examples/extensions/`; read agent files before asking questions
- **UI/UX tabs**: inactive/active tab text must align vertically; activity indicators in left gutter (dead space); indicators visible only on unread updates; main tab background matches canvas background
- **Chat UI**: "UNKNOWN" tool chips are upstream emission gaps, not renderer bugs; "Exploring workspace" is intentional synthetic tool from daemon
- **Shiki**: CSS-based overrides with versioned style IDs to defeat HMR staleness

---

## Recent Feature Areas (2026-05-04)

Active development confirmed by session evidence and file modification times.

### Notes Tiles
- `NotesTile.tsx` — browsing tile for a folder of markdown note files
- `NotesEditorTile.tsx` — editing tile for individual markdown notes
- Notes folder contents can be shared with agents as context (per session intent)
- Both tiles registered in `App.tsx`

### Builder Tile
- `BuilderTile.tsx` — agent-driven tile that creates new canvas tiles via `tool_use`
- Canvas placement for newly created tiles was under active iteration (multiple `App.tsx` passes around positioning logic)
- **Known broken**: builder does not persist build history across sessions; three consecutive sessions on 2026-05-04 at 18:24–18:34 failed with `Error: fetch failed` — root cause undiagnosed

### Extension Sidebar
- `src/renderer/src/extensions/sidebar-extension.ts` iteratively reworked on 2026-05-04
- Target behavior: file-system navigator tree view + Cmd+P fuzzy file finder
- Port toward `extensions/sidebar/` directory structure is in progress — do not assume old `sidebar-extension.ts` is canonical or complete

### Preference Pane
- `PreferencePane.tsx` — new tabbed preferences UI component
- MCP server tools list surfaced in settings; multiple `SettingsPanel.tsx` edits on same day
- Wired into `App.tsx`

### Chat Tile
- Tool chip rendering aligned between backend emission format and frontend display
- Cursor/composer mode wired up
- `ChatTile.tsx` received many independent edits on 2026-05-04; treat as actively evolving

### Grok Build Variant
- Separate build of contex exists where Grok is available as a provider
- One session on 2026-05-04 worked on fixing the integration; changes landed in `ChatTile.tsx` and `App.tsx`
- Treat as a known build variant; integration completeness not confirmed

---

## Open Threads

- **Builder history persistence broken** — `Error: fetch failed` in three consecutive sessions; active bug, not diagnosed
- **Extension sidebar port in progress** — old `sidebar-extension.ts` being replaced by `extensions/sidebar/`; do not assume either file is fully authoritative
- **V2 `ContexRuntimeProvider`** — thinking/tool_*/permission chunk types not mapped; parity gated on `.planning/chat-tile-v2-parity.md`
- **`chatRequestAdapter.ts`** — planned but not confirmed on disk
- **grok-cli model catalog wire-up** — desktop provider has hard-coded model list; daemon `/chat/model-catalog` route exists but connection incomplete
- **Relay contract drift risk** — `provider-executor.ts`
- **CLAUDE.md/AGENTS.md branch name stale** — still say `feature/event-bus-mcp`; actual is `main-merge`
- **`.commandcode/` and `.grok/`** — confirm `.gitignore` status (currently committed)

---

## Stable Contracts (Do Not Break)

- MCP port random — always read `~/.contex/mcp-server.json`; never hardcode
- `~/.codesurf/` (daemon) ≠ `~/.contex/` (workspaces/MCP) — do not conflate
- `App.tsx` ~1700 LOC — surgical edits only; canvas undo max 50 snapshots; never push to undo stack in hot paths
- `node-pty` requires `npm run rebuild` after native dep changes
- Extension tiles: `body.dark` via bridge; solid hex only; no `prefers-color-scheme`
- No emoji; `resolveProviderModeId` always; IPC `{feature}:{action}`
- Chat V2 bridge: `PROTOCOL_VERSION=1`, `BRIDGE_NAMESPACE='contex-chat-bridge'`; stream channel: `stream:${tileId}`
- `streamdown-utils`: `useStreamdownPlugins(text)` hook only; bare export is `{}`
- Relay host guard: check `isRelayHostActive()` before registering `relay:*` IPC handlers
- grok-cli RAG: top-level `sharp` override in `package.json` must remain to prevent duplicate libvips
- grok-cli provider: use `getCodesurfDaemonBridge(home)` — do not parse pid files directly
- When porting code, preserve exact functionality — do not reinterpret or simplify

---

_Generated by codesurf-dreaming._
