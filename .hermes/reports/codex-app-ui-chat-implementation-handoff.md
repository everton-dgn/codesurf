# Codex-inspired CodeSurf implementation handoff

Generated: 2026-05-01 10:43:20 BST

Scope:
- Target repo: `/Users/jkneen/clawd/collaborator-clone`
- Reference report: `.hermes/reports/codex-app-ui-chat-reference-report.md`
- Implementation pass: controlled Codex-inspired UI/UX improvements, no feature removals.

## What changed

### 1. Layout token foundation

File: `src/renderer/src/index.css`

Added centralized CodeSurf/Codex-style CSS tokens for:
- Sidebar default/min/max width.
- Sidebar row radius and horizontal padding.
- Chat transcript content max width.
- Composer side inset/min width/control size/radius/footer gap.
- Mini chat default dimensions.

Also added shared class primitives:
- `.cs-chat-shell`
- `.cs-chat-message-stack`
- `.cs-chat-composer-wrap`
- `.cs-chat-composer-card`
- `.cs-chat-composer-primary-toolbar`
- `.cs-chat-composer-secondary-toolbar`
- `.cs-toolbar-pill-label`
- `.cs-footer-pill-label`
- `.cs-composer-path-label`
- `.cs-thread-row`
- `.cs-thread-row-active`
- `.cs-mini-chat-window`

These keep the current React implementation intact while moving the first layer of Codex-like density behavior into one place.

### 2. Chat composer polish

File: `src/renderer/src/components/ChatTile.tsx`

Changed the chat/composer shell to use the new class primitives and CSS variables:
- Transcript max width now follows `--cs-thread-content-max-width`.
- Composer width/min-width/insets now follow `--cs-chat-composer-*` tokens.
- Toolbar and footer pill labels now collapse responsively via container queries.
- Added a compact mini-window launcher button to the primary toolbar.

Kept existing provider/model/thinking/voice/send controls, tool permission flow, chat surfaces, attachments, streaming, history, and drawers intact.

### 3. Mini chat window

Files:
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/env.d.ts`
- `src/electrobun/browser/electron-facade.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/ChatTile.tsx`

Added a first-pass Codex-style mini chat window:
- Main process owns mini windows by `workspaceId:tileId` key.
- Reuses/focuses an existing mini window for the same chat instead of spawning duplicates.
- Positions beside the owner window and clamps inside the current display work area.
- Tracks owner close/minimize/restore/focus well enough for a lightweight floating companion.
- Uses a frameless always-on-top mini BrowserWindow with a custom titlebar.
- Loads the normal renderer with query params: `miniChat=1&workspaceId=...&tileId=...`.
- Renderer switches to a dedicated mini-chat shell that mounts the same `ChatTile` against the source tile state.
- Mini-chat mode is guarded so it does not persist main-window workspace tabs, change the global active workspace, force setup UI, or run canvas proximity/auto-agent logic.

This is intentionally not a one-off `window.open`; it is a main-process managed shell, matching the direction recommended in the reference pass.

### 4. Sidebar row polish

Files:
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/Sidebar.tsx`
- `src/renderer/src/index.css`

Changed the default sidebar width from 280 to 300 and gave session rows Codex-like active/hover rail treatment through the new `.cs-thread-row` classes.

The existing archive, pin, unread, title generation, open-in-chat, open-in-app, and project grouping logic is preserved.

### 5. Sidebar mini-window affordance

Files:
- `src/renderer/src/components/Sidebar.tsx`
- `src/renderer/src/components/sidebar/session-actions.ts`
- `test/sidebar/session-actions.test.mjs`

Added the next Codex-inspired mini-window burst after dogfooding confirmed the chat toolbar mini window worked well:
- Clicking any sidebar session now promotes the thread immediately in UI memory before opening, matching Codex/Cursor thread-list behavior without mutating persisted `updatedAt`.
- Tile-backed session rows now show a hover action for `Open mini window`.
- Tile-backed session context menus now include `Open Mini Window`.
- The mini affordance calls the existing `window.electron.window.openMiniChat({ workspaceId, tileId, title })` IPC path, so it reuses the main-process owned mini-window manager instead of creating another popup path.
- Row action width accounting was updated so the mini button does not collide with checkpoint or archive actions.
- Added/updated tests for the wider row-action rail.

Intentional constraint: sidebar mini-window opening is currently limited to sessions that already have a concrete `tileId`. That keeps the pass safe and avoids silently creating layout tiles for historical/external sessions just to pop them out. A future burst can add a deliberate "open into chat, then pop out" path if desired.

## Verification

Commands run from `/Users/jkneen/clawd/collaborator-clone` after the latest sidebar-mini burst:

```bash
npm run build
npm test
```

Results:
- `npm run build`: passed.
- `npm test`: passed, 177 tests, 0 failures.

## Git state notes

Observed status after verification:
- Branch: `main`
- Status: `main...origin/main [ahead 24]`
- Diffstat: 12 files changed, 683 insertions(+), 57 deletions(-).
- Source/test files modified by the implementation pass:
  - `src/electrobun/browser/electron-facade.ts`
  - `src/main/index.ts`
  - `src/preload/index.ts`
  - `src/renderer/src/App.tsx`
  - `src/renderer/src/components/ChatTile.tsx`
  - `src/renderer/src/components/Sidebar.tsx`
  - `src/renderer/src/components/sidebar/session-actions.ts`
  - `src/renderer/src/env.d.ts`
  - `src/renderer/src/index.css`
  - `test/sidebar/session-actions.test.mjs`
- Report artifacts in `.hermes/reports/` are untracked.
- `.codesurf/DREAMING.md` is also modified in the working tree, but it was already modified before this implementation pass and should be reviewed separately before any commit.
- `.mcp.json` is modified in the working tree. This was observed during this continuation pass and should be reviewed separately before any commit.

## Recommended next burst

1. Dogfood the new sidebar hover/context-menu mini-window actions on tile-backed sessions.
2. Add a deliberate "open historical/external session into chat, then pop out" flow only if the sidebar mini action should work for sessions with no `tileId`.
3. Extract the composer block from `ChatTile.tsx` into a dedicated component now that class/token seams exist.
4. Start the Git Review extension/diff virtualization pass from the reference report as a separate burst.
