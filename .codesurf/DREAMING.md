# CodeSurf Workspace Memory — contex (collaborator-clone)

*Generated 2026-04-23. Workspace: `/Users/jkneen/clawd/collaborator-clone`. Branch: `feature/event-bus-mcp`.*

---

## Overview

Electron infinite-canvas workspace where AI agents and developers collaborate through canvas tiles (terminal, code editor, browser, kanban, chat). `package.json` is authoritative: `name: codesurf`, `productName: CodeSurf`. CLAUDE.md/AGENTS.md use legacy name "contex" — both refer to the same project.

---

## Durable Facts

- **SDK**: `@anthropic-ai/claude-agent-sdk` `0.2.118`. Requires both `permissionMode: 'bypassPermissions'` AND `allowDangerouslySkipPermissions: true`. Static docs showing `0.2.79` are outdated.
- **Persistence**: All runtime state under `~/.contex/` — canvas JSON, kanban tile JSON, MCP config. MCP port is random; always read from `~/.contex/mcp-server.json`, never hardcode.
- **Memory loader**: `bin/memory-loader.mjs` injects `.codesurf/DREAMING.md` into every chat and Codex session — confirmed working.
- **Build**: `npm run build:renderer` Vite chunking warnings for `PanelLayout.tsx` and `MediaTile.tsx` are pre-existing, not regressions.
- **App.tsx**: ~1700 LOC, contains the entire canvas engine. Be surgical — changes ripple widely.
- **node-pty**: Requires `npm run rebuild` after any dependency change touching native modules.

---

## Settled Subsystems

**Workspace Tab Geometry** — settled, committed `fdd1999`. Active tab height 31, inactive 24; active text offset -1, inactive 0 (corrected from -2 over multiple sessions).

**Commit `cd281cc` — "Improve session title parsing and chat UI"** — 11 files, 578 insertions / 165 deletions. Key changes:
- Session title boilerplate filter: `firstMeaningfulTitleLine` / `isSessionTitleBoilerplateLine` helpers skip AGENTS.md/CLAUDE.md/`<INSTRUCTIONS>` preamble in auto-generated titles
- ChatTile: hide scrollbar, direction-aware scroll handlers, deduped historical vs live messages, live Working/Thinking chip moved to fixed zone above composer
- ChatTile chip/tool styles: nowrap + ellipsis on *individual chip text* (NOT chip container rows — see regression note below)
- Streamdown: paragraph nodes as `<div>` to avoid nested `<p>` hydration errors
- Monaco: language-service workers routed to Vite-bundled modules (off renderer thread)
- Tests: session-openability uses temp files; new session-title-generation tests

**Session Tools** — committed `1ff343d`. Title generation, session open intent detection, tests in `test/`.

**Dreaming Subsystem** — `packages/codesurf-dreaming/`, `src/main/ipc/dreaming.ts`. Orphan-run reconciliation and stderr sanitization landed.

---

## Working Tree — Uncommitted

`src/renderer/src/components/ChatTile.tsx` — ~330 changed lines vs HEAD. Builds pass. Needs commit. Two coordinated changes applied post-`cd281cc`:

**1. `CHAT_CHIP_ROW_STYLE` const** (line ~748) — `flexWrap: 'wrap'`, `overflow: 'visible'`, replaces inline chip-row style objects across the file. Fixes chip clipping introduced by `cd281cc`.

**2. `ChatMessageContent` hot-path** — attachments hoisted to a const; text-only messages return `<ChatMarkdown>` directly with no outer flex wrapper; "Attached file paths" label only rendered when `bodyText` is also present. Net DOM reduction for the common text-only case.

---

## Critical Regression History — Chip Row Layout

`cd281cc` applied `flexWrap: 'nowrap'` to chip container rows as part of the judder fix. Post-commit sessions confirmed chips were clipped at the right edge. Working tree restores `flexWrap: 'wrap'` via `CHAT_CHIP_ROW_STYLE`.

**Do not re-apply `nowrap` to chip container rows.** `nowrap` is valid only on text content inside individual chips (ellipsis truncation), not on the row that holds chips.

---

## Open Threads

- **ChatTile uncommitted** — `CHAT_CHIP_ROW_STYLE` const + `ChatMessageContent` simplification, ~330 changed lines, needs commit
- **Blank/large Codex session list entries** — 1.2 MB entries display as ~50 lines; parse gap hypothesis in `thread-indexer.ts` / `session-sources.ts`; unresolved
- **Nyx PTY agent-shell** — plan at `docs/plans/2026-04-22-nyx-pty-hooks-lift-plan.md`; recommendation: new `agent-pty` IPC namespace beside existing terminal, not a replacement
- **Untracked docs** — `docs/command-cli-harvest-status.md`, `docs/plans/2026-04-21-command-code-harvest-next-bursts.md`, `docs/plans/2026-04-22-codesurf-solo-harvest-plan.md`, `docs/research/` — not committed

---

## Known Dead Ends

| What was tried | Why it failed | Do not retry |
|---|---|---|
| `flexWrap: 'nowrap'` on chip *container* rows | Stops width-shift judder but clips chips at right edge | Yes — use `CHAT_CHIP_ROW_STYLE` (wrap) + scroll-container stabilization |
| Describing `cd281cc` as "~180 lines removed" | Actual: 578 ins / 165 del across 11 files; ChatTile.tsx alone: 266 changed lines | Reference commit stats directly |
