# Project Overview

**contex** — Electron desktop app; infinite 2D canvas workspace where tiles (terminal, code editor, browser, kanban, chat) live alongside AI agents connected via MCP. Humans and agents collaborate asynchronously on shared canvas state.

- **Repo:** `/Users/jkneen/clawd/collaborator-clone`
- **Active branch:** `feature/event-bus-mcp`
- **As of:** 2026-04-27

---

# Durable Facts

## Tech Stack (pinned versions)
- Electron 40.8.2 · React 19.2.4 · TypeScript 5.9.3 · Vite/electron-vite 7.3.1/5.0.0
- Tailwind CSS 4.0.0 — dark theme hardcoded (`#1e1e1e`, `#252525`, `#333`); never use `prefers-color-scheme`
- `@anthropic-ai/claude-agent-sdk` 0.2.79 · `@opencode-ai/sdk` 1.2.27
- xterm + node-pty · Monaco editor · framer-motion

## Packages added (uncommitted working tree)
- `@ricky0123/vad-web` ^0.0.30 — Silero VAD (ONNX) for voice activity detection; excluded from Vite dep-opt in `electron.vite.config.ts`
- `onnxruntime-web` ^1.24.3 — ONNX runtime for in-browser VAD model; also excluded from dep-opt
- `electron-updater` ^6.8.3 — auto-update scaffold (added to package.json; not yet wired in main process)

## Key Source Additions (committed to HEAD = `2063c02`)
- `src/renderer/src/workers/` — `discovery-graph.worker.ts`, `echo.worker.ts`
- `src/renderer/src/hooks/useWorker` — generic typed web-worker wrapper
- `src/renderer/src/hooks/useDiscoveryGraph` — inline-vs-worker selection based on tile count
- `src/main/ipc/transcribe.ts`, `tts.ts`, `spokify.ts`, `secrets-ipc.ts` — voice IPC layer
- `src/main/secrets.ts` — encrypted secrets via Electron `safeStorage`
- `src/main/relay/provider-executor.ts` — daemon autoread allowlist

## Uncommitted `transcribe.ts` fix
All 4 STT providers now wrap the IPC `Buffer` as `new Uint8Array(audio)` for `Blob` constructor and `fetch` body. IPC serialisation was producing an invalid body without this conversion — likely a contributor to voice not working.

## Shared Type: VoiceSettings (added, uncommitted in `shared/types.ts`)
- STT: `'openai' | 'deepgram' | 'assemblyai' | 'local'`; default Deepgram Nova-2 (~600ms vs ~3s Whisper REST)
- TTS: `'cartesia' | 'deepgram' | 'elevenlabs' | 'voicelab' | 'say'`; default Cartesia
- Spokify model: `claude-haiku-4-5-20251001`
- `autoSpeak: 'off' | 'last-message'`; `bargeIn: boolean` (default true)
- API keys stored in encrypted secrets store; `VoiceSettings` holds only non-secret config

---

# Active Subsystem State

## Canvas UI
- Top-nav: gear → SettingsPanel, layers → WorkspaceManager, plus → AddTileModal (frosted glass, top-right)
- Sidebar: right side, collapsible framer-motion spring (stiffness 300, damping 20), `backdrop-blur-sm` when collapsed
- Grid: crosshatch SVG, 0.35/0.35 opacity, `#242424` background
- `promoteExpandedTileToLayoutGroup()` — promotes single-tile fullscreen panels to layout groups at ≥2 tiles

## SettingsPanel Sections (builtin)
`'general' | 'daemon' | 'canvas' | 'providers' | 'voice' | 'browser' | 'permissions' | 'mcp' | 'extensions' | 'prompts' | 'skills' | 'tools' | 'agents'`

The `'voice'` section (uncommitted) is wired to `VoiceSettingsEditor`. A duplicate `case 'voice'` block exists — build warning, not a runtime failure.

## PanelLayout Tab Icons (open bug)
- Compact tab icons in `PanelLayout` use hardcoded inline SVGs instead of the shared tile icon map, causing a mismatch (e.g. different source-control glyph vs main UI)
- Investigation active as of 2026-04-27; fix requires routing compact tab through the same component/icon mapping as the main tab path

## ChatTile
- Footer: `[$cost] [turns] [reltime] [Mic]` — no Copy/GitBranch/Clipboard icons
- Insight rendering: `splitInsightSegments` + `InsightBlock` render `★ Insight` tagged model output as styled callout cards
- Voice dictation: `isDictating` = VAD listening on; `isSpeaking` = utterance in progress (VAD hook); visual states: muted/pulsing-red/soft-accent
- `useAutoSpeak` wired in; watches `lastAssistantMessage` (last non-streaming assistant msg); gated by `isStreaming`
- `ttsPlayer.subscribe(setTtsState)` drives TTS visual indicator in footer
- `transcribeJobRef` prevents out-of-order appends from concurrent VAD-triggered transcriptions
- `useSpeechToText.ts` deleted — replaced by VAD path in `useVoiceActivityDetector`

## Voice Subsystem
**Split: IPC committed / renderer integration uncommitted**

- **Committed (2063c02):** `transcribe.ts`, `tts.ts`, `spokify.ts`, `secrets-ipc.ts`, `secrets.ts`
- **Uncommitted (untracked):** `useVoiceActivityDetector.ts`, `useAutoSpeak.ts`, `sentenceStream.ts`, `ttsPlayer.ts`, `VoiceSettingsEditor.tsx`, `public/vad/` ONNX assets (~5 files)
- **Also uncommitted (modified):** `ChatTile.tsx`, `SettingsPanel.tsx`, `shared/types.ts`, `transcribe.ts` (Buffer fix), `electron.vite.config.ts`, `index.html` (CSP)
- **VAD assets confirmed present:** `src/renderer/public/vad/` — Silero v5 + legacy models, ORT WASM variants, VAD worklet
- **CSP confirmed correct (static analysis):** `worker-src 'self' blob:`, `media-src 'self' blob: data:`
- **Known open issue:** Voice still not working at runtime; root cause not narrowed — needs live diagnostic (console errors, network tab ONNX fetch, IPC failure trace) to distinguish mic permission, ONNX load, serialization, or TTS playback failure

## Electrobun Scaffold
- Parallel runtime under `.hermes/`; Electron is production baseline
- Burst 2 gated on `better-sqlite3` compat and BrowserView parity

---

# Open Threads
- **Voice runtime bug** — static analysis complete, no obvious config error; needs live diagnostic output to identify actual failure point
- **Voice renderer ~12 files uncommitted** — stage as a unit after confirming end-to-end round-trip works
- **Duplicate `case 'voice'` in `SettingsPanel.tsx`** — build warning, needs deduplication
- **PanelLayout compact tab icon mismatch** — fix requires routing through shared icon map instead of inline SVGs
- **Scrollbar layout shift in SettingsPanel** — unresolved
- **`electron-updater` not wired** — package.json only; main-process update lifecycle not implemented
- **Electrobun Burst 2** — gated on `better-sqlite3` compat and BrowserView parity

---

# Hazards
- `App.tsx` ~1700 LOC — surgical edits only; changes ripple widely
- node-pty needs `npm run rebuild` after native dep changes
- MCP port is random — always read `~/.contex/mcp-server.json`, never hardcode
- Canvas undo snapshots are full-state (max 50) — do not push in hot paths
- `cluso-widget` is an optional local file dep (`file:../agentation-real`) — may not exist in all environments
- **muxy** (`/Users/jkneen/Documents/GitHub/muxy`) is a separate Swift macOS app — do not conflate with contex

---

*Generated by CodeSurf dreaming — 2026-04-27*
