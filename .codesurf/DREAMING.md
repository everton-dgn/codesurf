The file was updated concurrently. The current version already incorporates the new session findings. Here is the full replacement content for `.codesurf/DREAMING.md`:

# CodeSurf / contex — Generated Workspace Memory

_Last consolidated: 2026-05-26_

---

## Overview

contex is an Electron 40 / React 19 infinite-canvas workspace for AI agents and developers. Tiles (terminal, code editor, browser, kanban, chat) live on a 2D canvas; agents connect via a local MCP 2.0 HTTP server. Repo: `/Users/jkneen/clawd/collaborator-clone`. Active branch: **`main`** — AGENTS.md/CLAUDE.md still reference `feature/event-bus-mcp` (stale label).

---

## Durable Facts

### Architecture

- **Canvas engine is monolithic** — `src/renderer/src/App.tsx` ~1700 LOC; all pan/zoom/drag/resize/snapping/groups/undo lives there. Changes ripple widely.
- **Tiles are lazy-loaded** — `React.lazy` + `Suspense`; tile types defined in `shared/types.ts`.
- **Event bus** — main-process pub/sub, wildcard subscriptions (`tile:*`, `*`), ring-buffer per channel (500 events), no persistence.
- **MCP port is random** — always read from `~/.contex/mcp-server.json`; never hardcode. Current `.mcp.json` port: `60768`.
- **Persistence is file-only** — canvas auto-saves 500 ms debounce; kanban tile state per-tile JSON; no cloud sync.
- **IPC convention** — `{feature}:{action}` (e.g. `canvas:save`, `bus:publish`).
- **Chat providers stream via NDJSON/SSE** — parsed in `src/main/ipc/stream.ts`.
- **node-pty** requires native rebuild (`npm run rebuild`) after any dependency change.
- **`cluso-widget`** is an optional local file dep (`file:../agentation-real`) — may not exist in all environments.

### Theme System

- `src/renderer/src/theme.ts` (~800+ lines) and `src/renderer/src/theme-tokens.ts` are live; CSS tokens published to `document.documentElement` at runtime; contrast slider in SettingsPanel (`settings.themeContrast`).
- **`src/renderer/src/colorMath.ts` exists** — color parsing + HSL lightness transforms; drives `applyContrast()`. Saturation/warmth/accent override functions not yet written.
- Presets are source of truth; pure transform functions layer on top without mutating them.
- **Shadow conventions** (committed): edge hairlines use **0.5px** (not 1px) for HiDPI crispness; dark-mode shadows anchored to solid black/white alpha; `useTheme` + `color-mix()` pattern adopted broadly.
- **macOS titlebar**: `hiddenInset` style with explicit `trafficLightPosition`; configured in `src/main/index.ts`.
- **`themeResolution.ts` and `test/theme-resolution.test.ts` are untracked** — token resolution layer + tests; need committing or explicit exclusion.
- **Theme customization knobs** (saturation, warmth, accent) are spec-approved; `colorMath.ts` contrast utility exists but those override functions not yet written.
- Extension tiles: never use `prefers-color-scheme`; apply `body.dark` via bridge; use solid hex values, not rgba opacity.

### Chat Tile

- Refactored: hooks and tool views extracted into `src/renderer/src/components/chat/` — `ChatComposer`, `ToolBlockView`, `PlanCard`, `PlanChip`, `PlanPane`, `DiffView`, etc.
- Streaming state split across `chatMessageSentStore.ts`, `chatStreamingStore.ts`, `chatTileRuntimeState.ts`.
- Rich input bar design intent exists (model selector, attachments, MCP toggle, voice, stop, shimmer) — implementation status unconfirmed.
- Untracked file: `src/main/ipc/chat.ts`.

### App.tsx — Recent Changes (Dirty)

- **`WorkspaceTabLabel`** component added — dual-span grid trick prevents layout shift when tab weight toggles bold/regular; avoids tab width resizing on active state changes.
- **`sidebarPillVisible` state removed** — sidebar pill visibility cleaned up.
- Net change: ~269 lines; mostly additive (new component) + minor cleanup.

### Security Hardening (`.contract/` plan — phase 4)

All tasks T1–T5 applied in dirty working tree. T6 (verify) partially blocked by typecheck errors. `.contract/state.json` still shows all units "pending" (stale state file; code changes are real).

| Task | Status | Key Change |
|------|--------|------------|
| T1 — Extension protocol | Applied | `isExtensionResourcePath` guard in `protocol.ts`; `__runext_resource__` returns 403 for paths outside registered extension roots |
| T2 — File protocol | Applied | Removed `bypassCSP: true`; added `validateRequestPath()`; blocks `.ssh`, `.gnupg`, `.aws`, `.config`; MIME-type allowlist |
| T3 — Browser tile URLs | Applied | `isAllowedBrowserUrl()` allowlist (http/https + about:blank); `will-navigate` interceptor redirects to homepage on disallowed URL |
| T4 — Collab traversal | Applied | `assertSafeWorkspacePath`, `assertSafePathSegment`, `assertSafeMailbox`, `resolveInside()` guards throughout `collab.ts` |
| T5 — Release gate | Applied | `release:mac` / `release:github` scripts gate on `verify-mac-release-env.mjs`; package.json gains `hardenedRuntime: true`, `notarize: true`, `forceCodeSigning: true`, entitlements plist paths; CI workflow gains code-signing secrets |
| T6 — Verify | **Blocked** | `npm test`: 196 pass, 0 fail. `npm run typecheck`: 15+ errors across 9 files |

Key typecheck failures: `ChatComposer.tsx` missing `overlay` token; `JSXPreview.tsx` children type mismatch; `streamdown-utils.tsx` tuple type error; `footerExtensions.ts` null-safety gaps; `services/canvas.ts` unknown type; plus minor unused imports.

`scripts/verify-mac-release-env.mjs` is untracked — required by release scripts but not yet committed.

### Release Pipeline (package.json — Dirty)

- `electron-builder` mac config: `hardenedRuntime: true`, `entitlements: build/entitlements.mac.plist`, `entitlementsInherit: build/entitlements.mac.inherit.plist`, `gatekeeperAssess: false`, `notarize: true`, `forceCodeSigning: true`.
- NSMicrophoneUsageDescription + NSCameraUsageDescription added.
- `agent-kanban` excluded from `bundled-extensions` filter.
- `build/` directory is untracked — entitlements plists likely live there.

### hermes-agent (agent-core-rs)

Location: `/Users/jkneen/Documents/GitHub/hermes-agent/agent-core-rs`

**Architecture / Fixed Bugs**

- **TUI autostart fixed** — root cause: `run_tui()` in `main.rs` only launched Node/Ink without starting the Rust gateway. `gatewayClient.ts` now: health-checks `127.0.0.1:8642` → autostarts `hermes-rs gateway run` via `HERMES_RS_BINARY` env if not responding → waits for health → opens `/api/ws`. Race condition guarded.
- **Approval bug fixed** — `approval.rs` `Allow` arm was calling `approver.deny()`; corrected to `approver.approve()`.
- **Gateway log path fixed** — `gateway start` was writing stdout/stderr to `~/.hermes/gateway.log`; dashboard/log API reads `~/.hermes/logs/gateway.log`. Fixed in `src/main.rs:351` — now writes to `~/.hermes/logs/gateway.log` and creates the `logs/` subdirectory before opening.
- **`tsx` IPC pipe crash fixed** — `npm run dev` (which invokes `tsx`) crashes with `EPERM` when trying to create a local IPC pipe in some environments. Fix: build first, then run with `node`. New launcher written to `ui-tui/tui.sh`:
  ```
  npm run build
  node dist/entry.js
  ```
  Note: the outer `../tui.sh` in `agent-core-rs/` root was not updated (sandbox restriction during fix session) — this is a remaining open thread.

**TUI Cold-Start Command (confirmed)**

```
cd /Users/jkneen/Documents/GitHub/hermes-agent/agent-core-rs/ui-tui
env -u HERMES_TUI_GATEWAY_URL -u HERMES_TUI_DIRECT_HTTP -u HERMES_TUI_NO_AUTO_GATEWAY \
  HERMES_INFERENCE_PROVIDER=openai-codex \
  HERMES_INFERENCE_MODEL=gpt-5.5 \
  npm run dev
```

TUI attaches to `ws://127.0.0.1:8642/api/ws` and auto-starts the Rust gateway if not already running.

**Other Facts**

- `DeniedApprovalEntry` takes `reason: String` (was `policy: ApprovalPolicy`).
- `CodexProviderConfig` gained `approval_policy: ApprovalPolicy` (serde, default `OnFailure`).
- Codex provider target: `gpt-5.5`; Rust gateway binary: `./target/release/hermes-rs gateway run --provider openai-codex -m gpt-5.5 --bind 127.0.0.1:8642`; OpenAI-compatible base URL: `http://127.0.0.1:8642/v1`.
- Hermes Soul persona file loaded fresh per message — no restart required to change persona.
- `cargo check` passes; TUI suite: 789 passed, 3 skipped; two provider tests fail sandbox-only (TCP bind restriction, not a regression).
- `ModuleNotFoundError: hermes_cli` non-blocking in TUI suite.
- grok-cli lives at `~/Documents/GitHub/grok-cli` — separate repo; model list must mirror `src/renderer/src/config/providers.ts` DEFAULT_MODELS.

---

## Agent / Cron Status (2026-05-26)

| Agent / Cron | ID | Status | Notes |
|---|---|---|---|
| OpenClaw — Ava | `9f5f3df9`, board `c3f78d0c`, `localhost:19789` | **Operational** | HEARTBEAT_OK each cycle; no board tasks this cycle |
| OpenClaw — MC Gateway | `894a3d5b` | **Failing** | Connection refused on every heartbeat; root cause uninvestigated |
| Tom Doerr Tweet Tracker | `cebd05e0` | **Blocked** | Browser config `v2026.5.22-beta.1` vs binary `v2026.4.29-beta.1`; state: `/Users/jkneen/clawd/memory/tom-doerr-seen.json` |
| VibeClaw Wallpaper Generator | `85fa55d9` | **Failing** | Assistant turns failing; 10:00 AM run |
| VibeClaw Article Generator | `8b79f6d2` | **Failing** | Assistant turns failing; web_fetch based; no articles published |
| VibeClaw Skills Scout | `ebfe1571` | **Blocked** | Gemini billing cap exhausted + browser version mismatch; last success: `firecrawl-workflows`, `firebase-agent-skills` |
| skies WebGL prototype | Codex session | **Prototype only** | `/tmp/tiny-skies-desert-prototype` — desert/floating-worlds; not applied to `/Users/jkneen/clawd/skies` |
| Dreaming Narrative Deep | `8e9543aa` | **Operational** | Dream diary cron at 03:00 GMT+1; completed successfully |

### Tooling Status

- **Browser tool**: broken — version mismatch blocks all web-automation crons
- **Gemini / web-search**: monthly billing cap exhausted; deferred until reset
- **Codex (gpt-5.5)**: operational
- **OpenClaw main**: operational for heartbeat; all content-generating crons failing due to assistant-turn failures

---

## Open Threads

- **T6 typecheck** — 15+ errors across 9 files; must be clean before committing security patches or cutting a release
- **`themeResolution.ts` + `test/theme-resolution.test.ts`** — untracked; commit or exclude
- **`scripts/verify-mac-release-env.mjs`** — untracked but required by release scripts; commit before any release tag
- **`build/` directory** — untracked; likely contains entitlements plists; assess and commit
- **`src/main/ipc/chat.ts`** — untracked; assess inclusion
- **Theme customization saturation/warmth/accent** — spec approved; override functions not yet written
- **Branch label** — active branch is `main`; AGENTS.md/CLAUDE.md say `feature/event-bus-mcp`; update docs
- **MC Gateway `894a3d5b`** — persistent connection refusal; investigate root cause
- **Browser tool version mismatch** — blocks all playwright-dependent crons; needs binary or config update
- **Gemini billing cap** — VibeClaw Skills Scout blocked until monthly reset
- **hermes provider tests** — two tests fail sandbox TCP bind restriction; need real env to validate
- **`ModuleNotFoundError: hermes_cli`** — investigate before packaging hermes
- **hermes outer `tui.sh`** — `agent-core-rs/tui.sh` was not updated to use `node dist/entry.js` (sandbox restriction prevented write during fix session); update manually to match `ui-tui/tui.sh`
- **skies WebGL prototype** — ephemeral at `/tmp/tiny-skies-desert-prototype`; apply to `/Users/jkneen/clawd/skies` if direction approved
- **Chat tile rich input bar** — design intent exists; implementation status unconfirmed
- **`agent-kanban` excluded from bundled-extensions** — confirm if permanent
