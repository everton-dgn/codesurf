# Workspace Memory — contex (collaborator-clone)

Generated: 2026-05-08. Supplements CLAUDE.md/AGENTS.md — does not replace them.

---

## Overview

**contex** is an Electron desktop app — infinite canvas workspace for AI agents and humans. Also branded **CodeSurf**. Active branch: `main`. HEAD: `ce42252` ("Refactor ChatTile: extract hooks & tool views"). Working tree is clean.

The branch referenced in CLAUDE.md/AGENTS.md (`feature/event-bus-mcp`) is long merged; ignore it.

---

## Architectural NorthStar

"The desktop is dumb as shit. The daemon is smart." — all intelligence belongs in `grok-cli` at `~/Documents/GitHub/grok-cli/`. Desktop is a rendering shell; code-index, agent memory, and model intelligence live in grok-cli, not this repo. `getCurrentSessionTitleForTitleGeneration` in `canvas.ts` queries `daemonClient.listExternalSessions()` before falling back to SQLite — daemon-first data ownership pattern is live and committed.

---

## Monorepo Layout

- `src/` — Electron host app (main + preload + renderer)
- `packages/codesurf-daemon` — CodeSurf daemon binary
- `packages/codesurf-dreaming` — Dreaming agent package
- `packages/contex-chat-bridge` — Chat bridge package
- `packages/contex-relay` — Relay layer
- `apps/chat-app` — Standalone React chat UI (scaffolded; integration depth with main harness unknown)
- `bundled-extensions/builder/` — Builder surface extension (history UI + localStorage + tile state persistence)

---

## Durable Facts

**Stack:** Electron 40.8.2, React 19.2.4, TypeScript 5.9.3, electron-vite 5.0.0, Tailwind CSS 4.0.0, xterm+node-pty, Monaco, `@anthropic-ai/claude-agent-sdk` 0.2.79, `@opencode-ai/sdk` 1.2.27. All chat providers stream via NDJSON/SSE parsed in `src/main/ipc/stream.ts`.

**IPC:** `{feature}:{action}` convention; handlers in `src/main/ipc/`; context bridge in `src/preload/index.ts`. Use `window.electron.invoke()` — not `window.electron.ipcRenderer.invoke()`.

**MCP:** Agent-facing MCP server on random port — always read from `~/.contex/mcp-server.json`. Claude Code/Codex contex MCP port is session-local — read from `.mcp.json`, never hardcode.

**Persistence:**
- `~/.contex/workspaces/{id}/canvas.json` — canvas state (500ms debounce)
- `~/.contex/workspaces/{id}/tiles/{tileId}.json` — kanban tile state
- `~/.codesurf/sessions/` — chat threads
- `~/.codesurf/builder/{tileId}.json` — builder history (each build: `{timestamp, prompt, result}`)
- `~/.contex/mcp-server.json` — MCP server config
- SQLite DB in `src/main/db/`
- Builder surface additionally uses `localStorage` + `tile.getState`/`tile.setState` for immediate cross-session hydration
- `openChatSurfaces` / `activeChatSurfaceId` persisted in `ChatTile.tsx` runtime state

**Default theme:** `shared/types.ts` sets app appearance to `"paper-light"` (light theme). Previous default was dark.

**Style:** Theme-aware (light/dark). Tailwind + inline `React.CSSProperties`. 2-space indent, trailing commas, no semicolons. No `prefers-color-scheme`; dark mode via `body.dark` bridge.

**Typecheck:** `npm run typecheck:go` has pre-existing repo-wide TS errors — not a signal for UI-only changes. Use `npm run build:renderer` as the practical compile check.

---

## ChatTile Decomposition (committed in ce42252)

`ChatTile.tsx` was significantly refactored — chat logic extracted into focused hooks and components. The file is now a wiring layer.

**Hooks (`src/renderer/src/hooks/`):**
- `useChatDictation.ts` — voice dictation state, VAD lifecycle, transcription via `window.electron.transcribe.run({ audio, mimeType, provider, lang, localBaseUrl })`, barge-in on speech start, stale-job guard via `transcribeJobRef`; exposes `{ isDictating, dictationText, dictationError, toggleDictation, onTranscription }`
- `useChatGitState.ts` — module-level git state cache (`gitStateCache`, `gitStateInflight`, 15s TTL), `loadGitState(dir, force?)` deduped via inflight map; exposes `{ gitStatus, gitBranches, refreshGitState }`; `GitStatusSummary` and `GitBranchSummary` types exported from this hook
- `useChatAutocomplete.ts` — autocomplete suggestions for composer input
- `useChatExecutionHosts.ts` — execution host discovery and selection
- `useChatStreamHandler.ts` — streaming message ingestion, flush/persist debounce (50ms flush, 2000ms/500ms persist)

**Components (`src/renderer/src/components/chat/`):**
- `AskUserQuestionForm.tsx` — renders `ask_user_question` tool call UI inline in the chat
- `ToolBlockView.tsx` — renders all tool call/result blocks; exports `TOOL_BLOCK_MAX_WIDTH`
- `chatStyles.ts` — shared style constants for chat rendering
- `messageNormalization.ts` — normalizes raw message payloads before rendering

**Exports from ChatTile:** `hasVisibleFileChangeStats`, `hasRenderableFileChangeDiff`, `getToolDisplayName`, `TOOL_BLOCK_MAX_WIDTH`, `FontCtx`, `useFonts`, `CheckpointRestoreContext`

---

## Recently Landed

| Commit | Summary |
|--------|---------|
| `ce42252` | ChatTile decomposition — 5 new hooks, 4 new chat/ components; ChatTile.tsx shrunk ~2800 lines; working tree clean |
| `7277c9f` | DREAMING.md update |
| `864084a` | Edge shadow opacity tuning for light/dark; `getEdgeShadow` fully mode-aware |
| `c30b3d8` | Daemon-first session titles; `renameSessionTitleForSidebar`; TileChrome light-mode variants; types.ts defaults updated |
| `9cbb578` | Builder history persistence |
| `2a5e985` | Merge branch 'main-latest' — 18 files, 914 insertions |

---

## Active Subsystems

**Edge Shadow System** — `getEdgeShadow(theme, tone)` and `stackEdgeShadow()` in `theme.ts`; mode-aware. CSS vars `--cs-edge-shadow-*` on `#root`; `index.css` replaces hairline borders with `box-shadow` on rounded/pill elements; tables excluded.

**TileChrome** — Light-mode variant uses `drawerPanelShadow` / `tilePanelShadow`. Tile panel and drawer render distinct shadow styles per theme mode.

**Light-Mode Theming** — Default `"paper-light"`. LayoutBuilder computes `leafSurface`, `leafEdge`, `dividerHandle` from `theme.mode`; leaf tiles use `borderRadius: 2` and edge shadow.

**Session Title / Rename Flow** — Daemon-first: `getCurrentSessionTitleForTitleGeneration` queries `daemonClient.listExternalSessions()` before falling back to SQLite. `renameSessionTitleForSidebar` cascade: local → scoped daemon → global daemon → re-index fallback. `cleanSessionTitleCandidate()` applied to hint titles.

**Chat Tile / Composer** — Composer fill uses `composerBackground`; `ChatComposerCard` applies `stackEdgeShadow()`; unfenced-diff blocks as `<pre>`; chat-md tables flat. Large content: `largeContent.ts`, `GuardedChatMarkdown`, `LargeTextBlock`, `RawDiffBlock`.

**External Agent Markup** — `splitExternalAgentMarkup`, `getExternalAgentToolBlocks`, `isExternalAgentToolOnlyText` parse `[external_agent_tool_call:name]` / `[external_agent_tool_result]` tags. `extractChipsFromMessage` handles tool-only messages as `'tool-single'` chips.

**Sidebar** — Absolute overlay for hover/active backgrounds. Archive icon fade-in / timestamp fade-out on hover. `SIDEBAR_RIGHT_RAIL_ACTION_RIGHT = 2`. Header transparent. Footer 28×28 icon-only glass. `selectedSessionKey` prevents multi-row selection.

**PanelLayout Tabs** — Theme-aware compact tabs; `workspaceTabActiveBottomGap` / `workspaceTabInactiveBottomGap` are distinct constants.

**Builder Tile** — `bundled-extensions/builder/surface/index.html`. History persisted to `~/.codesurf/builder/{tileId}.json` via IPC and `localStorage` for immediate restore; state versioned with `BUILDER_STATE_VERSION`; scrollable history select UI.

**Thread Indexer / Session Cache** — Throttled scans, 60s SWR cache, `inflightRefreshes` dedup, tail-based loader for large session files.

---

## Open Threads

- **ChatSidebarSection.tsx vs ChatHistorySection.tsx** — WebSocket vs IPC: consolidation to IPC version deferred; two parallel sidebar session list implementations remain.
- **grok-cli model catalog wire-up** — `src/renderer/src/config/providers.ts` DEFAULT_MODELS must mirror `~/Documents/GitHub/grok-cli/src/core/extensions/builtin/codesurf-desktop-provider.ts` MODELS array; permission system blocked in daemon mode needs a UI.
- **`apps/chat-app`** — Standalone scaffolded with AI SDK + AI Elements; integration depth with main harness unknown.
- **Builder tile canvas UX** — History persistence done. How in-progress builds render alongside spatial rearrangements unresolved.
- **Sidebar archive icon alignment** — Reported not aligned with date (session `2026-05-08T00:38`); fix status unconfirmed.

---

*Generated by codesurf-dreaming.*
