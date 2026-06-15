# CodeSurf — Generated Workspace Memory

_Last consolidated: 2026-06-13_

---

## Overview

CodeSurf (`collaborator-clone`) is an Electron desktop app — infinite canvas workspace for tiles and AI agents. Active branch: `feature/event-bus-mcp` (recent changes: universal event bus, MCP upgrade, chat tile, bus bridges). Plugin platform P0–P9 build-verified. Broker security phase 1 landed, but a Codex review (2026-06-13) found critical residual issues in `child-entry.ts` and `host.ts`. Harness backend is built and partially proven: claude and pi providers work end-to-end (99/99 tests pass); codex provider is wired but broken due to missing `permissionMode: 'allow-all'`. MC Gateway broken. DGX unreachable.

---

## Durable Facts

### Identity & Naming
- Product name: **CodeSurf** — "contex" is legacy internal-only (`window.contex`, `~/.contex/`, `contex-relay`)
- App path: `/Users/jkneen/clawd/collaborator-clone`
- Runtime data root: `~/.contex/` (legacy path retained for storage)

### Stack Versions
- Electron `^41.3.0`, React `^19.2.4`, TypeScript `^5.9.3`
- `@anthropic-ai/claude-agent-sdk` `^0.2.118`
- `@opencode-ai/sdk` `^1.2.27`
- Tailwind CSS `^4.0.0`, electron-vite `^5.0.0`

### File Size Landmarks
- `src/renderer/src/App.tsx` — ~1919 LOC (canvas engine; surgical edits only)
- `src/renderer/src/hooks/useCanvasEngine.ts` — ~1390 LOC
- `src/renderer/src/components/tiles/ChatTile.tsx` — ~947 LOC

### Persistence
- Canvas state: `~/.contex/workspaces/{id}/canvas.json` (500ms debounce auto-save)
- Kanban tile state: `~/.contex/workspaces/{id}/tiles/{tileId}.json`
- MCP server config: `~/.contex/mcp-server.json` (port is random — always read from file, never hardcode)

### TypeScript
- TSC baseline is dirty (~145 pre-existing errors); measure regressions per-file, not by exit code

### Plugin Platform
- P0–P9 all build-verified; architecture docs at `docs/plugins/00-architecture.md`
- Broker security phase 1 landed: IPC channel namespace validation, path traversal block in `manifest.main`, `ipcMain` handler cleanup on deactivate, workspace-scope guard in `isPowerActivationPermitted`
- Extension theming: never `prefers-color-scheme`; default light CSS; `body.dark` via bridge; solid hex colours only (no rgba opacity)

---

## Broker Security — Residual Issues (Codex review, 2026-06-13)

**Critical:** `child-entry.ts:121` — raw `require(entryPath)` loads untrusted extension code in a Node utility process. The `ctx` gate is irrelevant: extensions get full `fs`, `child_process`, network, env, and native module access without going through ctx.

**High:** `host.ts:123` — crash cleanup only calls `ctx.dispose(…)`; registered `ipcMain` handlers are not removed on crash; bus/store unsubscribe IDs don't match what was registered; registry rescan doesn't await broker shutdown.

**Test gaps:** Tests use an inline copy of the IPC prefix check (diverges silently from production `host.ts`); no coverage for duplicate channel registration, ipcMain handler cleanup on crash, or manifest IDs containing `:`.

**Action:** Address `require(entryPath)` sandboxing and crash-cleanup handler leak before merging broker changes.

---

## Harness Backend

### Files (all in `packages/codesurf-daemon/bin/`)
- `harness-runtime.mjs` — `LocalHostSandboxProvider` + `createHarnessRunner({homeDir}).runHarnessJob()`
- `harness-worktree.mjs` — worktree snapshot/apply/checkpoint manager
- `harness-settings.mjs` — `isHarnessEnabled({settings, env, provider})` (pure; 6 tests)
- `chat-jobs.mjs` — opt-in harness dispatch path (lazy import, `request.useHarness === true`)
- `test/daemon/harness-runtime.test.mjs` — unit tests; **99/99 daemon tests pass**

### Provider Status

| Provider | Harness adapter | Status | Notes |
|----------|----------------|--------|-------|
| `claude` | `@ai-sdk/harness-claude-code` | **Proven** | OAuth auth via inherited `HOME`; sessions complete cleanly |
| `pi` | `@ai-sdk/harness-pi` | **Proven** | Auth via `~/.pi` + inherited HOME; host-runtime (no bridge port) |
| `codex` | `@ai-sdk/harness-codex` | **Broken** | All sessions immediately error: "Harness 'codex' does not support built-in tool approval requests; use permissionMode: 'allow-all'" — fix: add `permissionMode: 'allow-all'` to `runHarnessJob()` options in `harness-runtime.mjs` for codex provider |

### Model Names Observed (2026-06-13)
- `claude-sonnet-4-6` — csagent/anthropic provider
- `claude-opus-4-8` — claude provider
- `gpt-5.3-codex` — codex harness sessions (worktree verify 0b3e7c0e completed successfully)
- `gpt-5.5` — codex sessions (all fail with permissionMode error)

### Isolation Model (worktree)
- Agent runs in a throwaway git worktree (snapshot via temp `GIT_INDEX_FILE`; no mutation of user's index)
- `defaultWorkingDirectory` = isolated `<daemonHome>/harness/sessions/<provider>-<jobId>`; project bound as symlink
- On success: `createDaemonCheckpoint` fires BEFORE apply; changes content-synced to live workspace; "Applied N file change(s)" emitted as `tool_summary`
- On error/abort: worktree discarded, live workspace untouched
- Agent-created gitignored files recovered via `ignoredCreated()` (capped at 500)
- Pre-existing gitignored files (`.env`, `node_modules`) NOT visible to agent — known v1 limitation
- Non-git workspaces fall back to live workspace bind directly

### Enablement
- `~/.codesurf/settings.json`: `{"settings":{"harness":{"enabled":true,"providers":["claude"]}}}` — daemon injects `useHarness:true`
- OR env: `CODESURF_HARNESS=1`
- Explicit `useHarness` in request wins over settings
- Desktop POSTs same `/chat/job/start`; harness events stream back via existing `/chat/job/events` SSE

### Canary Isolation
- `@ai-sdk/harness ^1.0.0-canary.9` in `packages/codesurf-daemon/node_modules` only
- Daemon resolves `ai@7.0.0-canary`; root stays `ai@6`; renderer bundle never sees ai@7
- Repo is NOT an npm workspace — daemon has its own `node_modules` (gitignored; must ship with packaging)

### Adapter Verdict
Do NOT build HarnessV1 adapters for opencode/hermes/openclaw/csagent/local-proxy. `csagent` is only future candidate.

---

## Active Subsystems

| Subsystem | Status | Notes |
|-----------|--------|-------|
| OpenClaw lead (Ava) | HEARTBEAT_OK | BASE_URL localhost:19789; board c3f78d0c confirmed |
| OpenClaw main crons | Operational | Email digest, morning brief, skills scout, daily note, VibeClaw article gen all running |
| MC Gateway | BROKEN | 4 consecutive "assistant turn failed before producing content"; then "connection refused" |
| DGX (192.168.4.104:8003) | UNREACHABLE | curl exit 7; Jason notified; OpenAI fallback in use |
| Tom Doerr tweet tracker | Degraded | Nitter unavailable; Chrome profile 6 (Jason) logged in but live search feed navigation failed; no tweets captured |
| Skills Scout cron | Operational | 7 new entries in `~/.claude/skills-catalog.json` on 2026-06-13 |
| Urgent email alert | HEARTBEAT_OK | One failed turn then success pattern (2026-06-13) |

---

## Open Threads

- **Codex harness fix (immediate):** add `permissionMode: 'allow-all'` to `runHarnessJob()` options in `harness-runtime.mjs` for codex provider — every codex harness session (gpt-5.5 confirmed across multiple sessions) errors immediately without it
- **Broker security (critical):** `require(entryPath)` in `child-entry.ts` gives full Node access; crash cleanup in `host.ts` leaks `ipcMain` handlers — must fix before merging broker changes
- **MC Gateway:** root cause unknown; 4+ consecutive failures then connection refused — needs investigation
- **DGX unreachable:** OpenAI only working fallback for image gen
- **Tom Doerr tracker:** needs alternative source; Nitter down; Chrome profile approach tried but chronological feed navigation failed
- **Branch `feature/event-bus-mcp`:** merge/PR state unknown — verify before planning adjacent work
- **`src/main/ipc/chat.ts`:** was noted as untracked — verify current git status
- **Theme builder and layout builder:** still pending per memory
- **Zenbu rearchitecture integration:** pending; analysis at `docs/zenbu-analysis/`
- **DEFAULT_MODELS currency:** `claude-sonnet-4-6` and `claude-opus-4-8` confirmed in use — `src/renderer/src/config/providers.ts` may need update
- **Harness v1 known gap:** pre-existing gitignored files (`.env`, `node_modules`) not materialized in worktree — documented limitation, no fix planned for v1

---

_Memory generated by CodeSurf daemon dreaming consolidation._
