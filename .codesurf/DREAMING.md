The file is being managed by a live dreaming process that keeps writing it. The current on-disk version is accurate and well-structured. Here is the full replacement content for `.codesurf/DREAMING.md`:

---

# Workspace Memory — contex (collaborator-clone)

Generated: 2026-05-07. Supplements CLAUDE.md/AGENTS.md — does not replace them.

---

## Overview

**contex** is an Electron desktop app — infinite canvas workspace for AI agents and humans. Also branded **CodeSurf**. Active branch: `main-latest`. HEAD: `864084a` ("Adjust edge shadow opacities for light/dark themes"). Working tree is clean.

The branch referenced in CLAUDE.md/AGENTS.md (`feature/event-bus-mcp`) is long merged; ignore it.

---

## Architectural NorthStar

"The desktop is dumb as shit. The daemon is smart." — all intelligence belongs in `grok-cli` at `~/Documents/GitHub/grok-cli/`. Desktop is a rendering shell; code-index, agent memory, and model intelligence live in grok-cli, not this repo. `getCurrentSessionTitleForTitleGeneration` in `canvas.ts` now queries `daemonClient.listExternalSessions()` before falling back to SQLite — daemon-first data ownership pattern is live and committed.

---

## Monorepo Layout

- `src/` — Electron host app (main + preload + renderer)
- `packages/codesurf-daemon` — CodeSurf daemon binary
- `packages/codesurf-dreaming` — Dreaming agent package
- `packages/contex-chat-bridge` — Chat bridge package
- `packages/contex-relay` — Relay layer
- `apps/chat-app` — Standalone React chat UI (scaffolded; integration depth with main harness unknown)

---

## Durable Facts

**Stack:** Electron 40.8.2, React 19.2.4, TypeScript 5.9.3, electron-vite 5.0.0, Tailwind CSS 4.0.0, xterm+node-pty, Monaco, `@anthropic-ai/claude-agent-sdk` 0.2.79, `@opencode-ai/sdk` 1.2.27. All chat providers stream via NDJSON/SSE parsed in `src/main/ipc/stream.ts`.

**IPC:** `{feature}:{action}` convention; handlers in `src/main/ipc/`; context bridge in `src/preload/index.ts`. Use `window.electron.invoke()` — not `window.electron.ipcRenderer.invoke()`.

**MCP:** Agent-facing MCP server on random port — always read from `~/.contex/mcp-server.json`. Claude Code/Codex contex MCP port is session-local — read from `.mcp.json`, never hardcode.

**Persistence:** canvas.json (500ms debounce), kanban tile JSON, `~/.codesurf/sessions/` (chat threads), `~/.codesurf/builder/{tileId}.json` (builder history), `~/.contex/mcp-server.json`, SQLite DB in `src/main/db/`.

**Default theme:** `shared/types.ts` sets app appearance to `"paper-light"` (light theme) with adjusted canvas/grid colors and updated default font stacks, sizes, and weights. Previous default was dark.

**Style:** Theme-aware (light/dark). Tailwind + inline `React.CSSProperties`. 2-space indent, trailing commas, no semicolons. No `prefers-color-scheme`; dark mode via `body.dark` bridge.

**Typecheck:** `npm run typecheck:go` has pre-existing repo-wide TS errors. Use `npm run build:renderer` as the practical compile check for UI work.

---

## Recently Landed (committed)

| Commit | Summary |
|--------|---------|
| `864084a` | Edge shadow opacity tuning for light/dark: lower white alpha, higher dark alpha; `getEdgeShadow` fully mode-aware (distinct accent mix and black alpha for dark); `mainPanelInsetEdgeShadow` in App.tsx adjusted |
| `c30b3d8` | Daemon-first session titles live; `renameSessionTitleForSidebar` introduced (local → scoped → global daemon rename → re-index fallback); TileChrome light-mode edge-shadow variants (`drawerPanelShadow`/`tilePanelShadow`); types.ts defaults updated (fonts, sizes, "paper-light"); debug console.log removed from App.tsx |
| `2a5e985` | Merge branch 'main-latest' — 18 files, 914 insertions: App.tsx, ChatTile, LayoutBuilder, PanelLayout, SettingsPanel, Sidebar, TileChrome, SidebarFooter, ChatComposer, streamdown-utils, Toggle, index.css, theme.ts, types.ts |
| `61e2e92` | UI spacing: workspace tab heights, chat transcript scrollbar gutter, user bubble margins, compact tab theme-aware sizing, SidebarTopItem vertical rhythm |
| `b3dadfe` | ChatTile tool parsing helpers, `extractChipsFromMessage` tool-only support; workspace tab active/inactive bottom gaps split; sidebar hover overlay (absolute positioning) |
| `fd23f34` | Parse external-agent markup; toolbar pill sizing; sidebar right-rail offset 4→2; CSS table exclusion from border→shadow rule |
| `9cbb578` | Persist builder history and chat-surface state |

---

## Active Subsystems

**Edge Shadow System** — `getEdgeShadow(theme, tone)` and `stackEdgeShadow()` in `theme.ts`; fully mode-aware (dark mode uses different accent mix and black alpha). CSS vars `--cs-edge-shadow-*` on `#root`; global CSS rule in `index.css` replaces hairline borders with `box-shadow` on rounded/pill elements; tables excluded (`:not(table)`).

**TileChrome** — Light-mode variant uses `drawerPanelShadow` / `tilePanelShadow`. Tile panel and drawer render distinct shadow styles depending on theme mode.

**Light-Mode Theming** — Default app appearance is `"paper-light"`. LayoutBuilder computes `leafSurface`, `leafEdge`, `dividerHandle` from `theme.mode`; leaf tiles use `borderRadius: 2` and edge shadow. Components with light-mode passes: App.tsx, ChatTile, LayoutBuilder, PanelLayout, SettingsPanel, Sidebar, TileChrome, SidebarFooter, ChatComposer.

**Session Title / Rename Flow** — `getCurrentSessionTitleForTitleGeneration` queries daemon first, falls back to SQLite. `renameSessionTitleForSidebar` tries local rename, then scoped daemon rename, then global daemon rename, then falls back to re-indexing. `cleanSessionTitleCandidate()` applied to hint titles.

**Chat Tile / Composer** — Composer fill uses `composerBackground`; `ChatComposerCard` applies `stackEdgeShadow()`; unfenced-diff blocks as `<pre>`; chat-md tables flat. Large content: `largeContent.ts`, `GuardedChatMarkdown`, `LargeTextBlock`, `RawDiffBlock`. Streaming: 50ms flush; deferred normalization; 2000ms/500ms persist debounce. Chat transcript uses `scrollbarGutter: 'stable'`.

**External Agent Markup** — `splitExternalAgentMarkup`, `getExternalAgentToolBlocks`, `isExternalAgentToolOnlyText` parse `[external_agent_tool_call:name]` / `[external_agent_tool_result]` tags. `extractChipsFromMessage` handles tool-only messages as `'tool-single'` chips.

**Sidebar** — Absolute overlay for hover/active backgrounds. Archive icon fade-in / timestamp fade-out on hover. `SIDEBAR_RIGHT_RAIL_ACTION_RIGHT = 2`. Header transparent. Footer 28×28 icon-only glass. `selectedSessionKey` prevents multi-row selection.

**PanelLayout Tabs** — Theme-aware compact tabs; `workspaceTabActiveBottomGap` / `workspaceTabInactiveBottomGap` are distinct constants.

**Builder Tile** — History persisted to `~/.codesurf/builder/{tileId}.json`; each build appends `{timestamp, prompt, result}`; scrollable history panel.

**Thread Indexer / Session Cache** — Throttled scans, 60s SWR cache, `inflightRefreshes` dedup, tail-based loader for large session files.

---

## Open Threads

- Archive icon alignment (`SIDEBAR_RIGHT_RAIL_ACTION_RIGHT = 2`) was still actively being debugged in the most recent session — fragile if sidebar width changes; `ChatSidebarSection` row layout is the place to check
- Builder tile history persistence committed (`9cbb578`); UX for how the current build renders on the canvas alongside rearrangements was an active concern in the same session — may still need work
- `ChatSidebarSection.tsx` (WebSocket) vs `ChatHistorySection.tsx` (IPC): consolidation to IPC version deferred
- grok-cli model catalog wire-up incomplete (persistent across multiple dreams)
- `apps/chat-app` standalone scaffolded with AI SDK + AI Elements; integration depth with main harness unknown

---

_Generated by codesurf-dreaming._
