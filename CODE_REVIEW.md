# Contex — Full Code Review Report

**Date:** 2026-03-21 (original) · **Updated:** 2026-06-07
**Codebase:** ~92K LOC (June 2026)  
**Reviewers:** 4 specialized agents (correctness, security, performance, maintainability)  
**Findings:** 7 Critical, 9 High, 19 Medium, 14 Low

---

## ✅ Post-hardening status (2026-06-07, branch `feature/hardening-wave-1`)

| Original ID | Status | Notes |
|-------------|--------|-------|
| SEC-01 MCP zero auth | **FIXED** | Bearer enforced on `/mcp`, `/push`, `/inject`, SSE |
| SEC-02 `/inject` | **FIXED** | Same auth gate + expanded auth tests |
| SEC-03 FS unrestricted | **IMPROVED** | Default-on + one-time legacy migration (`applyFsScopingMigration`) |
| SEC-04 Terminal spawn | **FIXED** | Shell + agent CLI allowlists |
| SEC-05 Git exec | **FIXED** | `execFile`, branch validation |
| SEC-06 sandbox:false | **MITIGATED** | Guest webviews hardened; main window documented |
| SEC-07 Stream SSRF | **FIXED** | `assertSafeStreamUrl` blocks private IPs |
| SEC-08 MCP body limit | **FIXED** | 1MB cap |
| SEC-09 CORS wildcard | **FIXED** | Origin reflection on MCP |
| RISK-01 Extension activation | **FIXED** | Power-tier extensions default off until enabled |
| BUG-01 Undo broken | **FIXED** | Pre-change snapshots |
| BUG-02 removeAllListeners | **FIXED** | Per-handler `removeListener` |
| BUG-03 Stale viewport undo | **FIXED** | Uses refs |
| BUG-04 addTile race | **FIXED** | Functional `setTiles` |
| BUG-05 closeTile race | **FIXED** | Functional updater + `viewportRef` in hook |
| BUG-07 setTiles read abuse | **FIXED** | Uses refs |
| PERF TileChrome re-render | **IMPROVED** | `React.memo` + snap RAF throttle |
| ARCH App.tsx god object | **IMPROVED** | `useCanvasEngine` + group frames component + keyboard/persist hooks |
| PERF-04 drag auto-save | **FIXED** | Deferred canvas persist until drag ends |
| ARCH mcp-server.ts | **IMPROVED** | Tool modules + registry (2237 → 791 LOC) |
| ARCH ChatTile.tsx | **IMPROVED** | Composer menus, live activity, autocomplete hooks |
| CI build + e2e | **FIXED** | PR workflow runs `npm run build` + `npm run test:e2e` |
| TEST contex-relay | **FIXED** | Relay vitest suite wired into root `npm test` |

**Tests:** 399 unit (incl. relay) · **E2E:** 10/10 · **Typecheck:** clean · **Build:** pass

### Hardening waves (local commits on `feature/hardening-wave-1`)

| Wave | Focus |
|------|--------|
| 1–2 | MCP auth, preload listener cleanup, undo fixes, canvas E2E |
| 3 | Guest webview hardening (SEC-06), FS scoping defaults, ChatTile composer extraction |
| 4 | Extension activation policy, CI build+e2e, MCP auth test expansion |
| 5 | `useTileMounting` hook, relay in `npm test`, Electrobun security parity, audit refresh |
| 6 | Panel tree utils, tile clipboard/shortcuts hooks, FS scoping migration, ChatTile dream/composer hooks, Electrobun extension policy bridge |
| 7 | Group manager + canvas keyboard hooks, ChatTile attachment/autocomplete hooks, Electrobun ext:list scan, legacy FS migration E2E |
| 8 | `CanvasGroupFrames` extraction, keyboard undo/redo, drag-deferred canvas persist, Electrobun ext:list-sidebar |

---

## 🔴 Top 5 Priority Fixes (original — March 2026)

1. **Add auth to MCP server** (SEC-01 + SEC-02 + SEC-09) — Bearer token + restricted CORS
2. **Fix removeAllListeners in preload** (BUG-02) — Use removeListener(channel, handler)
3. **Fix undo/redo** (BUG-01) — Push pre-change state, not post-change
4. **Enforce fs path boundaries** (SEC-03) — Validate against workspace root
5. **Fix addTile/closeTile race conditions** (BUG-04, BUG-05) — Use functional updaters

---

## 🐛 Correctness Bugs (17 findings)

### Critical (3)

**BUG-01: Undo/redo is fundamentally broken** — `App.tsx:410-420`
- `saveCanvas()` pushes the NEW state to `historyBack`. Undo pops it and "restores" the same state.
- **Fix:** Push `tilesRef.current` (pre-change snapshot) instead of post-change `tileList`

**BUG-02: removeAllListeners destroys cross-component listeners** — `preload/index.ts:103,176,183`
- `stream.onChunk` cleanup calls `removeAllListeners('agent:stream')`. When ANY ChatTile re-renders, it kills streaming for ALL other ChatTiles.
- Same issue with `mcp.onKanban`, `mcp.onInject`, `collab.onStateChanged`
- **Fix:** Use `ipcRenderer.removeListener(channel, specificHandler)`

**BUG-03: Undo/redo captures stale viewport and nextZIndex** — `App.tsx:1320-1340`
- Uses `viewport` and `nextZIndex` from closure inside a `setTimeout` 500ms later
- **Fix:** Use `viewportRef.current` and `nextZIndexRef.current`

### High (5)

**BUG-04: addTile race condition** — `App.tsx:456-475`
- `const updated = [...tiles, newTile]` uses closure-captured `tiles`. Rapid calls lose tiles.
- **Fix:** `setTiles(prev => [...prev, newTile])`

**BUG-05: closeTile race condition** — `App.tsx:542-555`
- Same pattern. `tiles.filter(t => t.id !== id)` — second rapid close overwrites first.
- **Fix:** `setTiles(prev => prev.filter(t => t.id !== id))`

**BUG-06: KanbanCard MiniTerminal cleanup race** — `KanbanCard.tsx:165-195`
- If unmount before `terminal.create()` resolves, `.then()` writes to disposed xterm and leaks listeners.
- **Fix:** Use `aborted` flag, check in `.then()`

**BUG-07: handleTileMouseDown abuses setTiles for state read** — `App.tsx:597-611`
- `setTiles(prev => { /* read prev */ return prev })` as side-effect. Breaks in concurrent mode.
- **Fix:** Use `tilesRef.current`

**BUG-08: persistCanvasState effect uses stale tiles/groups** — `App.tsx:428-430`
- `tiles` and `groups` not in deps array but used as arguments.
- **Fix:** Add to deps or use refs

### Medium (5)

- **BUG-09:** No request body size limit on MCP server — memory exhaustion
- **BUG-10:** OpenCode server manager clears startPromise too early — transient state race
- **BUG-11:** handleProviderChange crashes if models list empty — undefined.id
- **BUG-12:** saveCanvas inside setTiles may save stale viewport/nextZIndex
- **BUG-13:** handleCanvasDoubleClick fails on most canvas area (target !== currentTarget)

### Low (4)

- **BUG-14:** TileChrome cleanup has unnecessary `.then()` call
- **BUG-15:** Non-null assertion on `tile.groupId!` in closure
- **BUG-16:** KanbanTile listener churn on every cards change
- **BUG-17:** KanbanCard MiniTerminal ignores workspaceDir changes

---

## 🔒 Security Vulnerabilities (20 findings)

### Critical (4)

**SEC-01: MCP Server — Zero Authentication** — `mcp-server.ts` — CWE-306
- Any local process can discover port (in `~/.contex/mcp-server.json`) and invoke all 17 tools
- **Fix:** Per-session bearer token, restricted file permissions, consider Unix domain socket

**SEC-02: Terminal Injection via /inject** — `mcp-server.ts:655-670` — CWE-78
- `POST /inject` writes directly into PTY. `curl -X POST http://127.0.0.1:<PORT>/inject -d '{"message":"rm -rf /"}'`
- **Fix:** Require auth, validate card_id, rate limit

**SEC-03: Unrestricted Filesystem Access** — `fs.ts` — CWE-22
- All fs IPC accepts arbitrary absolute paths. `fs:delete` uses `{ recursive: true, force: true }`
- **Fix:** Validate all paths against workspace root with `path.resolve()` + `startsWith()`

**SEC-04: Arbitrary Binary Execution** — `terminal.ts:129-134` — CWE-78
- `terminal:create` accepts any `launchBin` and `launchArgs` from renderer → `pty.spawn()`
- **Fix:** Allowlist permitted binaries

### High (4)

- **SEC-05:** Git exec() with unvalidated cwd — `git.ts:33-37` — CWE-78
- **SEC-06:** `sandbox: false` — `index.ts:60` — CWE-693
- **SEC-07:** SSRF via stream:start — `stream.ts:18-50` — CWE-918
- **SEC-08:** No request body size limit — `mcp-server.ts:639-688` — CWE-770

### Medium (7)

- **SEC-09:** CORS wildcard `*` on MCP server — CWE-942
- **SEC-10:** Console.log bus bridge allows origin bypass — BrowserTile.tsx — CWE-346
- **SEC-11:** Path traversal via tileId — collab.ts — CWE-22
- **SEC-12:** MCP port leaked to workspace dirs (.mcp.json) — CWE-200
- **SEC-13:** Untrusted Cluso embed assets (hardcoded `/Users/jkneen/` path) — CWE-426
- **SEC-14:** No channel authorization on bus IPC — CWE-285
- **SEC-15:** No JSON schema validation on deserialized data — CWE-502

### Low (5)

- **SEC-16:** Full process.env leaked to terminals — CWE-200
- **SEC-17:** webview allowpopups enabled — CWE-1021
- **SEC-18:** Session ID broadcast to all windows — CWE-200
- **SEC-19:** Unvalidated workspacePath in collab — CWE-22
- **SEC-20:** Workspace delete leaves files — CWE-459

---

## ⚡ Performance Issues (8 findings)

### High Impact (3)

**PERF-01: O(n²) guide computation on every mousemove during drag** — `App.tsx`
- 12 alignment checks × n tiles × 60fps. With 50 tiles: 36,000 comparisons/second
- Also calls setTiles() every frame, triggering full React reconciliation
- **Fix:** Throttle to every 2-3 frames, spatial index for nearby tiles, use refs during drag

**PERF-02: All tiles re-render when ANY tile state changes** — `App.tsx`
- TileChrome not wrapped in React.memo. Every setTiles call re-renders all tiles
- Heavy tiles (terminal, browser, chat) cause visible jank during drag
- **Fix:** React.memo with custom comparator, consider per-tile state atoms

**PERF-03: Dot grid glow mask updates on every mouse move** — `App.tsx`
- Updates two DOM elements' mask-image on EVERY mouse move (not just drag)
- Forces composite layer recalculation for radial gradient masks
- **Fix:** Throttle to requestAnimationFrame, use CSS custom properties

### Medium Impact (3)

- **PERF-04:** ~~Auto-save can fire during drag operations~~ **FIXED** (wave 8)
- **PERF-05:** Full state snapshots in undo stack (~25MB with 50 tiles)
- **PERF-06:** Minimap redraws 60x/sec during pan/zoom

### Low Impact (2)

- **PERF-07:** Inline style objects recreated on every render
- **PERF-08:** Event bus ring buffer uses O(n) splice

---

## 🏗️ Architecture & Maintainability (6 findings)

**P1: App.tsx is a god object (2288 LOC)**
- Contains canvas physics, tile CRUD, undo/redo, keyboard shortcuts, group management, clipboard, drag/drop, context menus, workspace switching, panel layout
- 30+ useState hooks, 20+ useCallback/useEffect
- **Suggested decomposition:** useCanvasPhysics, useTileCRUD, useUndoRedo, useKeyboardShortcuts, useGroupManager, useClipboard, useDragDrop

**P2: DRY violations across tile lifecycle**
- Each tile independently handles init, IPC listeners, resize, focus, errors
- Should extract useTileLifecycle hook

**P2: Loose types with Record<string, any> and unsafe casts**
- Multiple `as any`, `as Type` casts. No runtime validation of IPC data.

**P2: Fragile state management pattern**
- Mix of useState + useRef for same data. Some callbacks use state, others refs.
- **Suggested:** Single source of truth — zustand, or all-refs with forceUpdate

**P3: Context bridge API surface too wide (251 LOC)**
- removeAllListeners pattern exists because API doesn't support targeted cleanup
- Should return disposable handles

**P3: Hardcoded Cluso asset path**
- `/Users/jkneen/clawd/agentation-real/dist/assets/` — breaks on any other machine
