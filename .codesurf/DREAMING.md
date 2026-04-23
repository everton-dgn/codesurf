# CodeSurf Workspace Memory — contex (collaborator-clone)

*Generated 2026-04-23. Workspace: `/Users/jkneen/clawd/collaborator-clone`. Branch: `feature/event-bus-mcp`.*

---

## Overview

CodeSurf is an Electron infinite-canvas workspace where AI agents and developers collaborate through canvas tiles. The repo lives at `~/clawd/collaborator-clone`. The primary active branch is `feature/event-bus-mcp`; a substantial set of staged and unstaged changes is in the working tree.

Static CLAUDE.md/AGENTS.md still say "contex" — that is legacy naming; the live product is CodeSurf.

---

## Durable Facts

**Identity**
- `package.json` name/productName: `codesurf` / `CodeSurf`
- Static CLAUDE.md/AGENTS.md still say "contex" — legacy naming
- Project/workspace display labels now inferred from `package.json.productName` when present; both daemon defaults and renderer `createWithPath` use this inference — this repo displays as `CodeSurf`, not `collaborator-clone`

**Actual installed SDK version**
- `@anthropic-ai/claude-agent-sdk` is `0.2.118` in the running environment (static docs say `0.2.79` — outdated)
- `claude` CLI at `/Users/jkneen/.local/bin/claude`, version `2.1.118`
- `claude-sonnet-4-6` is confirmed valid from this machine
- SDK 0.2.118 requires `allowDangerouslySkipPermissions: true` for bypass permission mode; `permissionMode: 'bypassPermissions'` alone is insufficient

**Persistence layout**
- Workspace canvas: `~/.contex/workspaces/{id}/canvas.json` (500 ms debounce auto-save)
- Kanban tile state: `~/.contex/workspaces/{id}/tiles/{tileId}.json`
- MCP server config: `~/.contex/mcp-server.json` (random port — never hardcode)
- Generated workspace memory: `<workspace>/.codesurf/DREAMING.md` — this file

**Memory loader inclusion**
- `bin/memory-loader.mjs` resolves `.codesurf/DREAMING.md` at the project path and layers it into every chat run as local-only context (`displayPath: .codesurf/DREAMING.md`)
- Dreaming memory is injected into Codex sessions via "Workspace Local Instructions" header — confirmed working

**Critical file warning**
- `src/renderer/src/App.tsx` is ~1700 LOC and owns all canvas 2D physics — changes ripple widely; edit surgically
- `node-pty` requires `npm run rebuild` after any native dependency change

**Known non-blocking build warnings**
- `npm run build` / `npm run build:renderer` emits Vite dynamic/static import chunking warnings for `PanelLayout.tsx` and `MediaTile.tsx` — pre-existing, do not treat as build failures

---

## Active Subsystems

### Daemon (`bin/codesurfd.mjs`)
- HTTP daemon with routes for `/dreaming/status`, `/dreaming/runs`, `/dreaming/run`, `/dreaming/cancel`
- Owns dreaming lifecycle: `createDreamingManager` from `packages/codesurf-dreaming/src/index.mjs`
- Auto-dream sweep runs every 5 minutes; evaluates whether to trigger a dream run after new sessions accumulate (minimum 3 sessions, minimum 30-minute interval, 5-second debounce)
- Dream output written atomically to `.codesurf/DREAMING.md` in the workspace directory
- Project/workspace default label now prefers `package.json.productName` over `basename(path)` when the path contains a package with a productName field

### Dreaming Package (`packages/codesurf-dreaming`)
- Single source file: `packages/codesurf-dreaming/src/index.mjs`
- Provider: Claude (`claude-sonnet-4-6`) via `@anthropic-ai/claude-agent-sdk` `query()`
- Limits: max 6 sessions, 6 messages per session, 500 chars per message, 16 000 chars total memory, 8 000 chars existing dream budget, 4 000 chars per session block
- Writes atomically (temp file + rename) to avoid partial reads
- Auto-dreaming types in `src/shared/types.ts`: `AutoDreamSettings`, `DreamRunSummary`, `AutoDreamPolicySummary`, `DashboardDreamingSummary` (added commit `eef4ece`)
- UI surface: `MainStatusBar` chip via `mainStatusBarDreaming.ts`; `SettingsPanel` cadence controls

### Canvas Engine (`src/renderer/src/App.tsx`)
- All 2D physics (pan/zoom, drag, resize, snapping, groups, undo/redo) lives here — ~1700 LOC
- World coords = screen coords adjusted for zoom + pan offset; group movement recurses through nested groups
- Undo snapshots full state (max 50) — never push to undo stack in hot paths

**Workspace tab UI — settled state (2026-04-23, seven or more iterative Codex sessions, all pass `npm run build:renderer`):**

Active tab geometry:
- Taller height (`31px`) with `-1px` bottom overlap into main panel — "attached tab" appearance
- Squared bottom corners, no bottom border on active state
- Main panel top-left corner radius: `0` when sidebar is expanded AND the first workspace tab is selected (line ~4208); all other states retain normal rounded corners; collapsed sidebar unaffected

Inactive tab geometry (final settled state):
- Height: `24px`; bottom gap: `6px` (was 7px — reduced 1px to eliminate vertical jump on selection)
- Outer pill shape intentionally distinct from active tab; do not equalize
- Tab row left inset: `8px` (was 11px — moved 3px left, applied at the tab container level)
- Inner label and close `x` both use the same upward vertical transform; close icon no longer has a separate `-0.5px` SVG shift
- `workspaceTabInactiveTextOffset = 0` — the constant controlling inner content offset for inactive tabs; final value after multiple direction corrections (was `-2`); do not move away from `0` without explicit instruction
- Outer tab shape/geometry is unchanged; only the inner content (label + close control) is offset so the text baseline aligns with the active tab

Do not re-equalize tab geometry or revert these numeric constants without explicit instruction.

### Chat IPC (`src/main/ipc/chat.ts`) — dirty, modified
- **Recent fix:** Claude stream replacement lifecycle guard — `intentionallyClosedQueries: WeakSet<Query>` + `isActiveQuery(cardId, query)` / `clearActiveQuery(cardId, query)` helpers; stale/superseded generators return silently and cannot emit failure into the new active stream or delete its query
- **Recent fix:** stderr capture added to both live chat and detached daemon Claude jobs; `claudeStderr: string` accumulator passed as `stderr` callback; `sanitizeClaudeStderrText()` strips ANSI escapes and blank lines; `formatClaudeSdkError(error, stderrText)` formats real CLI output capped at 6 000 chars — failures no longer surface as bare `Claude Code process exited with code 1`
- Same helpers mirrored in `bin/chat-jobs.mjs` for detached daemon Claude jobs
- Three providers stream via NDJSON/SSE parsed in `src/main/ipc/stream.ts`: Claude SDK, Codex CLI subprocess, OpenCode HTTP server

### Chat Tile (`src/renderer/src/components/ChatTile.tsx`) — ~7 300+ LOC

Settled decisions (do not change without strong reason):
- `scrollbarGutter: 'stable both-edges'` (line ~5241) — multiple sessions oscillated; `both-edges` is correct for symmetric centering; do not change
- Shimmer bars at bottom of live assistant messages and running tool chips are intentional — multiple sessions removed then restored them; they must stay
- Live `Thinking for Ns` chip uses tabular numbers with reserved width to prevent per-tick horizontal reflow

**Open bug — phantom liveness pulse on reload:** `ChatTile` restores `saved.isStreaming` directly on mount. If a tile JSON was persisted with `isStreaming: true`, the 500 ms `StreamingLivenessIndicator` interval fires on every reload indefinitely. Root cause identified; no fix in place. Fix path: clear `isStreaming` to `false` on clean shutdown, or add a mount-time check that resets it when no active stream exists for the card.

### Session Title Generation (`src/main/ipc/session-title-generation.ts`) — untracked/new
- Multi-provider: prefers current session provider, falls back to OpenRouter free models, last resort `claude-haiku-4-5-20251001`
- OpenAI-compatible path supports `openai` and `openrouter` providers; OpenRouter free fallbacks: `deepseek/deepseek-chat-v3-0324:free`, `google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.1-8b-instruct:free`
- Title limits: `GENERATED_TITLE_MAX_CHARS = 64`, 3–4 words, 90 000-char transcript budget (head 32 + tail 96 messages)
- Companion renderer module: `src/renderer/src/components/sidebar/session-title-generation.ts`
- **Known prior bug (fixed):** Codex fallback was spawning inside the repo root, exposing `.mcp.json` (stale random MCP port); startup/crash banner leaked into title candidates; fix: isolate subprocess from repo-local `.mcp.json`

### Session Openability (`src/renderer/src/components/sidebar/session-open.ts`) — untracked/new
- Pure logic: `getSessionOpenIntent(session, options)` → `{ kind: 'chat' | 'app' | 'file' | 'none' }`
- Determines how sidebar opens a session based on `canOpenInChat`, `canOpenInApp`, `filePath`, `messageCount`, `lastMessage`

### Extension System
- Manifest/registry/bridge/chat-surface host fully present
- Chat-surface tab strip and extension theming: **never use `prefers-color-scheme`**; default light CSS; `body.dark` class applied via bridge; use solid hex not `rgba` opacity

---

## Open Threads

- **Phantom liveness indicator:** `ChatTile` mount restores `isStreaming` from persisted tile JSON; no guard clears it when no stream is active. Known root cause, not yet fixed.
- **`src/main/ipc/chat.ts` uncommitted:** Contains lifecycle guard and stderr capture fixes — these are working-tree changes not yet committed; verify before any rebase or branch switch.
- **`src/main/ipc/session-title-generation.ts` untracked:** New file, not yet committed.
- **`src/renderer/src/components/sidebar/session-open.ts` untracked:** New file, not yet committed.
- **productName display fix uncommitted:** Changes to daemon defaults and renderer `createWithPath` that infer label from `package.json.productName` — verify commit status before branch switch.
