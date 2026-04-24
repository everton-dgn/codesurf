# CodeSurf Workspace Memory — contex (collaborator-clone)

Generated: 2026-04-24 (consolidated)

---

## Overview

**contex** is an Electron 40 / React 19 / TypeScript 5 infinite-canvas workspace where tiles (terminal, code editor, browser, kanban, chat, image, theme-builder, agent-runner) live on a 2D canvas. AI agents connect via a local MCP server and communicate through a peer-state protocol. Humans and agents collaborate asynchronously.

Active branch: `feature/event-bus-mcp`

---

## Durable Facts

### Stack

- Electron 40.8.2, React 19.2.4, TypeScript 5.9.3, Vite/electron-vite 7.3.1/5.0.0, Tailwind 4
- xterm + node-pty (terminal), Monaco (code tiles)
- `@anthropic-ai/claude-agent-sdk` 0.2.79, `@opencode-ai/sdk` 1.2.27, `@google/genai` (Gemini image gen)
- Build: `npm run dev` · `npm run build` · `npm run rebuild` (node-pty native)
- Dark theme hardcoded — never `prefers-color-scheme`; `body.dark` injected via bridge
- 2-space indent, trailing commas, no semicolons, strict TS (`any` tolerated only in legacy chat.ts)

### Persistence

- `~/.contex/workspaces/{id}/canvas.json` — 500 ms debounce auto-save
- `~/.contex/workspaces/{id}/tiles/{tileId}.json` — kanban state
- `~/.contex/mcp-server.json` — MCP config (random port; never hardcode)
- `~/.contex/permissions.json` — time-scoped permission grants

### IPC Convention

`{feature}:{action}` — e.g. `workspace:list`, `canvas:save`, `generation:image:generate`

---

## Active Subsystems

### Daemon (`bin/codesurfd.mjs`)

- `bin/file-references.mjs` — stale/missing attachments are non-fatal (stripped); `file://` opens via `shell.openPath(fileURLToPath(url))`; `CODESURF_CHAT_DEBUG=1` gates chat IPC logging
- `bin/context-buckets.mjs` — `buildContextBucketBundle()` returns `{ bundle, snapshot }` where snapshot is `{ total, buckets: [{label, source, preview}] }` for "Workspace Instructions" chip
- `bin/chat-jobs.mjs` — dispatches claude/codex/opencode/hermes; scrubs secrets from diagnostic output
- All providers stream via NDJSON/SSE in `src/main/ipc/stream.ts`

### Agent Adapter Registry (`src/main/agents/`)

- `agent-adapter-types.ts` — `AgentAdapterReadinessStatus` (`ready|not-installed|not-configured|degraded`), `AgentAdapterDefinition` with `checkReadiness()`
- `agent-adapter-registry.ts` — Claude Code, Codex, OpenCode, Hermes, Gemini adapters; Gemini probes `gemini` binary
- `agent-cli-contracts.ts` — `resolveHermesModelSelection()` prefix routing

### Image Generation

- `src/main/generation-provider-validation.ts` — validates Gemini key; default model: `gemini-2.5-flash-image`
- `src/main/image-generation.ts` — `@google/genai` SDK; `imageGenerate` and `imageEdit`
- `image_edit_request` chains — each edit operates on the previous result, not the original source

### Canvas Engine (`src/renderer/src/App.tsx`)

- 2400+ LOC — surgical edits only
- Font tokens fully wired (confirmed working diff ~line 4604): `--ct-font-primary`, `--ct-font-secondary`, `--ct-font-mono`, `--ct-font-sans`, `--ct-font-subtle` plus all `-size`/`-line`/`-weight` variants set reactively from `appFonts` state
- Undo max 50 full-state snapshots — never push in hot paths

---

## Font System

All tokens set via `root.style.setProperty` in a `useEffect` keyed on `appFonts.*`. Each of `--ct-font-primary`, `--ct-font-secondary`, `--ct-font-mono` has `-size`, `-line`, `-weight` variants. Secondary font injection was previously absent — root cause of the secondary font not applying globally. Fixed in working tree.

**ChatTile** also locally scopes the same token set on its container style. `fontSecondary` added to `useMemo` dep array (previously omitted, causing stale renders).

---

## UI Fixes (Working Tree, Not Yet Committed)

### Focus Ring Suppression (`src/renderer/src/index.css`)

    #root *:focus,
    #root *:focus-visible {
      outline: none !important;
    }

Removes browser `focus-visible` outline (appeared orange on Shift keypress). Scoped to `#root`.

### Compact Tab Active Border Removal (`src/renderer/src/components/PanelLayout.tsx`)

- `compactTabActiveOutline` variable removed
- Active compact tab `boxShadow` always `'none'`
- `box-shadow 0.15s` removed from transition

---

## Sidebar Search Palette

New `SidebarSearchPalette` component in `Sidebar.tsx` (confirmed working diff):

- `createPortal` full-screen overlay (`zIndex: 100000`)
- Auto-focuses input on mount via `requestAnimationFrame`
- `Escape` and backdrop click close
- Constants: `PROJECT_SESSION_PREVIEW_COUNT = 5`, `PROJECT_SESSION_SHOW_MORE_COUNT = 10`
- New icons: `Pencil`, `Search` from `lucide-react`

---

## ChatTile Start Screen

`isStartScreen = messages.length === 0 && !isStreaming`. When true: container centers content (`justifyContent: 'center'`), messages area shrinks to content (`flex: '0 0 auto'`, `overflowY: 'visible'`). User confirmed chat is working well — preserve direction.

---

## Watch Out For

- App.tsx 2400+ LOC — be surgical
- node-pty needs `npm run rebuild` after dependency changes
- MCP port is random — always read from config file
- Canvas undo holds full snapshots — don't push in hot paths
- `cluso-widget` is optional (`file:../agentation-real`) — may not exist
- `CODESURF_CHAT_DEBUG=1` for verbose chat logs
- 12 files modified in working tree not yet committed — treat as working-tree, not committed, facts
- Worktree session reports describe intended outcomes — verify on filesystem before depending on them

---

## Open Threads

- **Working tree uncommitted** — font fix, focus ring, tab border, sidebar search, ChatTile start screen all pending commit
- **`--ct-font-sidebar`** — referenced in earlier sessions; not confirmed in working diffs; may be a session artifact
- **`AgentRunnerTile`** — worktree session reported creation; not found in `src/renderer/src/components/` on inspection
- **`ChatTurnStartPayload.contextSnapshot` in shared/types.ts** — worktree session reported addition; not confirmed in committed file
- **`cascadeConnectionGraph()` renderer integration** — BFS utility exists in shared; renderer consumption unconfirmed
- **`src/main/ipc/chat.ts` strict TS cleanup** — `any` in older sections; deferred
