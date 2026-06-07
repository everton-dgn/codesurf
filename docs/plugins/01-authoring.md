# Authoring a CodeSurf Plugin (v2)

> Quickstart for the v2 plugin surface. The full architecture is in
> `00-architecture.md`. v1 `extension.json` plugins keep working unchanged — v2 is a
> strict superset (add `manifestVersion: 2` to opt in).

## The smallest plugin

Create `~/.codesurf/extensions/my-plugin/extension.json` (or a workspace
`.contex/extensions/...`):

```jsonc
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "manifestVersion": 2,
  "tier": "safe",                 // safe = sandboxed iframe; power = node main.js
  "contributes": {
    "commands": [
      { "id": "my.hi", "title": "My: Say hi", "slash": "hi", "run": { "method": "hi" } }
    ],
    "footer": [
      { "id": "my.status", "label": "My", "position": "right" }
    ],
    "tiles": [
      { "type": "my-plugin", "label": "My Plugin", "icon": "box", "entry": "surface/index.html" }
    ]
  }
}
```

Drop the folder in, and it loads on next rescan. Your command shows in the Command
Palette (`⌘⇧P`) under "My"; the footer chip appears in the status bar and opens your
tile when clicked.

## Where a plugin can appear (surfaces)

| Contribution | Appears as |
|---|---|
| `commands[]` | Command Palette rows (`⌘⇧P`) + optional `/slash` in the composer |
| `footer[]` | status-bar chips (click → opens your tile) |
| `tiles[]` | canvas tiles (your view) |
| `chatSurfaces[]` | a panel mounted above the chat composer |
| `settingsSections[]` | a section in Settings → Plugins, rendered with the standard control kit |
| `layoutPresets[]` | "Layout: …" rows in the palette that build a saved arrangement |
| `contextMenu[]` | canvas/tile right-click items |
| `mcpTools[]` (power) | agent-callable tools |
| `agentExtensions[]` | shape the in-process agent (when that runtime lands) |

## Consistent UI for free

A `safe` (iframe) plugin's HTML automatically gets the host theme: the bridge injects
the `--ct-*` design tokens + a base stylesheet, so plain `<button>`/`<input>` already
look native. For host-rendered (`component`) UIs, import `@codesurf/ui`
(`Button`, `Input`, `Switch`, `Select`, `Field`, `SettingsControl`). Override styles
only when you want something bespoke.

## settingsSections — declarative, themed controls

```jsonc
"settingsSections": [{
  "id": "my", "title": "My Plugin",
  "items": [
    { "kind": "toggle", "key": "loud", "label": "Loud mode", "default": false },
    { "kind": "select", "key": "tone", "label": "Tone", "default": "friendly",
      "options": [{ "value": "friendly", "label": "Friendly" }, { "value": "formal", "label": "Formal" }] },
    { "kind": "button", "label": "Run now", "command": "my.hi" }
  ]
}]
```

Values persist to `~/.codesurf/extension-settings/<id>.json` and are readable from the
iframe (`window.codesurf.settings.get(key)`) and power tier (`ctx.settings.get(key)`).

## Durable state (the Plugin Store)

Settings are for declared, user-editable keys. For arbitrary runtime state that must
survive reloads, use the store:

```js
// inside an iframe surface
const cx = window.codesurf            // (window.contex is a permanent alias)
await cx.store.set({ recents: ['a', 'b'] })
const { recents } = await cx.store.get()
cx.store.subscribe(state => render(state))   // live across views/windows
```

Power plugins use `ctx.store.get/set/replace/update/subscribe`. Backed by
`~/.codesurf/plugin-state/<id>.json` + the event bus.

## Layout presets

```jsonc
"layoutPresets": [{
  "id": "my.review", "title": "My Review",
  "layout": {
    "type": "split", "direction": "horizontal", "sizes": [30, 70],
    "children": [
      { "type": "leaf", "slots": [{ "tileType": "files", "label": "Files" }] },
      { "type": "leaf", "slots": [{ "tileType": "chat", "label": "Chat" }] }
    ]
  }
}]
```

Appears as "Layout: My Review" in `⌘⇧P`; selecting it builds the arrangement. `tileType`
accepts any built-in (`chat`, `terminal`, `code`, `files`, `note`, `browser`, …) or
`ext:<your-type>`.

## Typed authoring (optional)

```ts
import { definePlugin } from '@codesurf/plugin'
export default definePlugin({
  id: 'my-plugin', name: 'My Plugin', version: '1.0.0', manifestVersion: 2,
  contributes: { commands: [{ id: 'my.hi', title: 'My: Say hi', slash: 'hi' }] },
})
```

`@codesurf/plugin` also exports `CodesurfBridge` to type `window.codesurf`.

## Power tier (`tier: "power"` + `main.js`)

```js
module.exports = {
  activate(ctx) {
    ctx.mcp.registerTool({ name: 'do_thing', description: '…', inputSchema: {...}, handler: async (a) => '…' })
    ctx.ipc.handle('hi', async () => 'hello')        // callable from your iframe via window.codesurf.ext.invoke('hi')
    const off = ctx.store.subscribe(s => {})
    return () => off()                                // cleanup on deactivate
  }
}
```

## Dev loop

- **Plugin Studio** (`⌘⇧P` → "New: …" then the Plugin Studio tile, or context-menu
  "New Plugin Studio") scaffolds a manifest and opens a dev workspace.
- **Dev Sandbox** (`⌘⇧P` → "Open Dev Sandbox") opens an isolated, dashed-border
  instance to test a plugin without touching your real workspace.
```
