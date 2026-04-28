# Project Overview

**contex** — Electron desktop app; infinite 2D canvas workspace where tiles (terminal, code editor, browser, kanban, chat, image) live alongside AI agents connected via MCP. Humans and agents collaborate asynchronously on shared canvas state.

- **Repo:** `/Users/jkneen/clawd/collaborator-clone`
- **Active branch:** `feature/event-bus-mcp`
- **As of:** 2026-04-28

---

# Durable Facts

## Tech Stack (pinned versions)
- Electron 40.8.2 · React 19.2.4 · TypeScript 5.9.3 · Vite/electron-vite 7.3.1/5.0.0
- Tailwind CSS 4.0.0 — dark theme hardcoded; never use `prefers-color-scheme`; solid hex not rgba opacity
- `@anthropic-ai/claude-agent-sdk` 0.2.79 · `@opencode-ai/sdk` 1.2.27
- xterm + node-pty · Monaco editor · framer-motion
- `@ricky0123/vad-web` ^0.0.30 (Silero VAD, ONNX) + `onnxruntime-web` ^1.24.3 — both excluded from Vite dep-opt
- `electron-updater` ^6.8.3 — in package.json only; main-process update lifecycle not yet wired

## App.tsx size
- **~6800 LOC** (not 1700 as stated in CLAUDE.md/AGENTS.md — those figures are stale). Be surgical; changes ripple widely.

## Shared Types (`shared/types.ts`)
- `getCurvierBlockRadius(radius?)` — exported; used by App.tsx and ImageTile to sync chrome border-radius with inner image-clipping wrapper when `TileChrome allowOverflow` is active
- `VoiceSettings` — STT default Deepgram Nova-2; TTS default Cartesia; Spokify model `claude-haiku-4-5-20251001`; `autoSpeak: 'off' | 'last-message'`; `bargeIn: boolean` (default true); API keys encrypted via `safeStorage`
- `CanvasState` — now includes `expandedCanvasGroupId?: string | null` and `expandedCanvasPriorViewport?: { tx, ty, zoom } | null` (unstaged, for canvas-expand-group feature)

## IPC Naming Convention
`{feature}:{action}` — e.g. `workspace:list`, `canvas:save`, `terminal:write`, `bus:publish`

---

# Active Subsystem State

## Recent commits (HEAD → older)
- `25cc32d` — Allow ImageTile inspector to render outside tile (committed 2026-04-28 16:56)
- `ecc382f` — Fix UI stacking, chat footer & STT API: group zIndex `'auto'` idle, toolbar zIndex lifted, AssemblyAI `speech_models` array fix, Electron version bump
- `33f9063` — Add voice VAD assets and renderer hooks
- `2063c02` — Add voice STT/TTS IPC, spokify, secrets store
- `a19618c` — Add discovery-graph worker and useWorker hook
- `0d08485` — Promote expanded tiles; update MCP port & styles
- `575e217` — Add Electrobun runtime scaffold and tests

## Unstaged working tree — 3 files, canvas-expand-group feature

**Feature:** Non-layout groups can now be "expanded as canvas" — tiles inside remain freely positioned, the whole viewport pans/zooms to fit the group bounds, and a floating banner identifies the active group. Tiles and groups outside the membership are hidden during this mode.

**`shared/types.ts`**
- `CanvasState` gains `expandedCanvasGroupId` and `expandedCanvasPriorViewport` — viewport snapshot on enter, restored on exit

**`src/renderer/src/App.tsx`**
- New state: `expandedCanvasGroupId` + ref, `expandedCanvasPriorViewportRef`, `exitCanvasExpandedRef` (forward ref so Esc handler can call exit before `useCallback` is declared)
- `collectGroupIdsRecursive()` — collects all descendant group ids for membership filtering
- `computeFitViewport()` — fits group bounds into screen with 48px padding, max zoom 1.5; tunable
- `enterCanvasExpanded(groupId)` / `exitCanvasExpanded()` — snaps viewport, sets state, mutually exclusive with single-tile expand; exit restores prior viewport
- Esc handler: canvas-expand exit takes precedence over layout-expand exit
- Group context menu: adds "Expand as canvas" entry (`Maximize2` icon) for non-layout groups
- Tile and group render passes: filtered by `expandedCanvasMembership` when active; expanded group's own chrome hidden
- Floating banner: pill shape, `zIndex: 99996`, group colour dot, group label + "· canvas" suffix, X button to exit
- Canvas state persistence (both load paths): hydrates `expandedCanvasGroupId` and `expandedCanvasPriorViewport`

**`.mcp.json`** — MCP server port refreshed

## ImageTile Inspector (committed in `25cc32d`)
- Inspector controls render outside the tile block when selected; negative-positioned and counter-scaled (`1/zoom`) — constant screen size at any canvas zoom
- `TileChrome allowOverflow` prop cascades `overflow: visible` through panel and content wrappers; inner image-clipping wrapper carries explicit `borderRadius`
- `inspectorOpen` is derived from `isSelected`; no local state; double-click/Escape handlers removed
- zIndex layer map: inspector controls `99994` > click absorbers `99993` > link sensors `99991` (pointer-events: none when image tile selected)

## Canvas Engine
- All 2D physics in `App.tsx`; world coords = screen adjusted for zoom + pan
- Undo snapshots full state (max 50) — never push in hot paths
- `promoteExpandedTileToLayoutGroup()` — single fullscreen tile → layout group at ≥2 tiles
- Groups have two expansion modes: **layout** (PanelLayout, tabbed) and **canvas** (free-floating sub-canvas, new); mutually exclusive
- Canvas state has two load paths in App.tsx (initial workspace load + workspace switch) — both must be updated when adding `CanvasState` fields

## Voice Subsystem (committed in `ecc382f` / `33f9063` / `2063c02`)
- Main process: `transcribe.ts` (4 STT providers), `tts.ts`, `spokify.ts`, `secrets-ipc.ts`, `secrets.ts`
- Renderer: `src/renderer/public/vad/` (Silero v5 + legacy ONNX, ORT WASM variants, VAD worklet), `useVoiceActivityDetector.ts`, `useAutoSpeak.ts`, `sentenceStream.ts`, `utils/ttsPlayer.ts`, `VoiceSettingsEditor.tsx`
- `TtsPlayer` uses `HTMLAudioElement` (not Web Audio API); barge-in calls `stop()`, drains queue; per-message tracking via `messageId`
- AssemblyAI STT: `speech_models` array field was the breakage fixed in `ecc382f`

## ChatTile
- Footer: `[$cost] [turns] [reltime] [Mic]` — reserved `minHeight` prevents streaming layout shift
- `InsightBlock` renders `★ Insight`-tagged output as styled callout cards
- `isDictating` / `isSpeaking` visual states; `transcribeJobRef` prevents out-of-order transcription

## SettingsPanel
- Sections: `'general' | 'daemon' | 'canvas' | 'providers' | 'voice' | 'browser' | 'permissions' | 'mcp' | 'extensions' | 'prompts' | 'skills' | 'tools' | 'agents'`
- Duplicate `case 'voice'` switch block = build warning, not runtime error

---

# Open Threads

- **Canvas-expand-group feature** — 3 files unstaged (`App.tsx`, `shared/types.ts`, `.mcp.json`); core enter/exit/filter/banner logic is in; commit once end-to-end behaviour (enter, navigate, Esc, persist/restore) is confirmed
- **Voice round-trip not working** — VAD assets confirmed in `public/vad/`, CSP covers `worker-src blob:` and `media-src blob:`, hook intact, Vite dep-opt exclusion in place. User confirmed "voice is not working" with no further signal; root cause unidentified — narrow by checking: (1) mic permission granted, (2) VAD worklet loads without 404, (3) STT provider key present in `safeStorage`
- **Audio skipping during agent tile mount** — reported: audio skips during framer-motion layout animation. Root cause unresolved. `TtsPlayer` uses `HTMLAudioElement` exclusively; likely framer-motion layout animation contending with audio decode, or ChatTile re-render mid-playback. Needs profiling.
- **Duplicate `case 'voice'` in SettingsPanel switch** — dedup before shipping
- **`electron-updater` not wired** — main-process update lifecycle not implemented
- **PanelLayout compact tab icons** — hardcoded inline SVGs; needs shared icon component
- **Scrollbar layout shift in SettingsPanel** — unresolved
- **Electrobun Burst 2** — gated on `better-sqlite3` compat and BrowserView parity

---

# Chorus — Separate Swift macOS Project

Chorus (`~/Library/Application Support/Chorus/`) is an entirely separate Swift/SwiftUI kanban task runner. Not part of this repo.

**Completed cards:**
- **CHO-002** — Workspace identifiers restricted to ASCII path-safe characters; `.` and `..` rejected; symlinks resolved; 5 isolation tests passed
- **CHO-003** — Backward-compatible categorized orchestration events (`dispatch`, `retry`, `hook`, `agent`); filtered log panel; session IDs persisted; 8 tests passed
- **CHO-004** — `AgentRunner.swift` fixes: consistent run-start snapshots, safer retry backoff, subprocess hardening, task editor field preservation
- **CHO audio fix** — `speakSystemAnnouncementAfterCurrentTTS` simplified to sequential: interrupt → 80ms → chime → 700ms → speech (eliminates race where completion chime cut mid-narration)

**Sandbox constraint:** Codex sandbox denies writes to `$CHORUS_TRACE_DIR` (sibling of project tree) under `workspace-write`. Required trace artifacts cannot be created via `apply_patch` or REPL from inside this sandbox — no workaround established yet.

---

# Hazards

- `App.tsx` ~6800 LOC — surgical edits only; changes ripple widely (CLAUDE.md/AGENTS.md figure of 1700 LOC is stale)
- node-pty requires `npm run rebuild` after native dep changes
- MCP port is random — always read `~/.contex/mcp-server.json`, never hardcode
- Canvas undo snapshots full-state (max 50) — never push in hot paths
- `cluso-widget` is optional local file dep (`file:../agentation-real`) — may not exist
- `TileChrome allowOverflow` cascades `overflow: visible` through both panel and content wrapper; inner image-clipping wrapper must carry explicit `borderRadius`
- ImageTile zIndex ordering: inspector controls `99994` > click absorbers `99993` > link sensors `99991` (pointer-events: none when selected); canvas-expand banner at `99996`
- Groups have two distinct expansion modes — layout (`layoutMode: true`) and canvas (`expandedCanvasGroupId`); they are mutually exclusive
- Canvas state persistence exists in two places in App.tsx (initial load + workspace switch) — both must stay in sync when adding new `CanvasState` fields
- **Chorus** is a separate Swift project — do not conflate with contex
- **muxy** (`/Users/jkneen/Documents/GitHub/muxy`) is a separate Swift macOS app — do not conflate with contex

---

*Generated by CodeSurf dreaming — 2026-04-28*
