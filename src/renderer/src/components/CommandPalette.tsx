/**
 * Command Palette — the human-facing command surface (point 3).
 *
 * Lists every enabled plugin's `contributes.commands[]` (and, later, built-in
 * commands) and runs the selected one. Built on the existing cmdk primitive
 * (ai-elements/ui/command). Mounted from App.tsx and toggled with a global shortcut.
 * Additive: when no plugin contributes commands it simply shows an empty palette.
 */

import { useMemo } from 'react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from './ai-elements/ui/command'
import { useContributions } from '../hooks/useContributions'
import { useLayoutTemplates } from '../hooks/useLayoutTemplates'
import { executeCommand, type PaletteCommand } from '../lib/commandRegistry'
import { BUILTIN_VIEWS } from '../lib/builtinViews'
import { useTheme } from '../ThemeContext'

/** Built-in (host) commands. Plugins contribute the rest via contributes.commands. */
type BuiltinCommand = PaletteCommand & { _run: () => void }

/**
 * Compact + dark-theme-consistent overrides for the shadcn/cmdk primitives. They
 * otherwise render (a) rem-scaled/oversized fonts and tall rows, and (b) in LIGHT
 * mode — `bg-popover`/`text-popover-foreground` resolve to shadcn's light defaults
 * because this app themes via its own `theme`/`--ct-*` system, not shadcn's `.dark`
 * class. We drive both sizing AND colour from the app theme here so the palette
 * matches the rest of the dark UI. Explicit px + !important win over the rem
 * scaling and the CommandDialog wrapper's `[&_[cmdk-*]]` classes.
 */
function buildPaletteCss(t: ReturnType<typeof useTheme>): string {
  return `
[data-slot=dialog-content]{background:${t.surface.panel}!important;color:${t.text.primary}!important;border-color:${t.border.default}!important}
[cmdk-root]{font-size:var(--ct-font-size,13px);background:${t.surface.panel};color:${t.text.primary}}
[cmdk-input-wrapper]{height:44px!important;padding:0 14px!important;border-bottom:1px solid ${t.border.subtle}!important}
[cmdk-input-wrapper] svg{width:16px!important;height:16px!important;color:${t.text.disabled}}
[cmdk-input]{font-size:14px!important;height:36px!important;padding-top:0!important;padding-bottom:0!important;color:${t.text.primary}!important;caret-color:${t.accent.base}}
[cmdk-input]::placeholder{color:${t.text.disabled}}
[cmdk-group]{padding:0 6px!important}
[cmdk-group-heading]{font-size:11px!important;font-weight:600!important;text-transform:uppercase;letter-spacing:.4px;padding:8px 8px 4px!important;color:${t.text.disabled}}
[cmdk-item]{font-size:13px!important;padding:6px 8px!important;border-radius:6px;line-height:1.3;gap:8px;color:${t.text.primary}}
[cmdk-item] svg{width:15px!important;height:15px!important}
[cmdk-item][aria-selected=true],[cmdk-item][data-selected=true]{background:${t.surface.hover}!important;color:${t.text.primary}!important}
[cmdk-list]{max-height:440px!important;padding-bottom:6px}
[cmdk-empty]{font-size:13px!important;padding:16px!important;color:${t.text.secondary}}
[data-slot=dialog-close]{top:14px!important;right:14px!important;color:${t.text.secondary}}
[data-slot=dialog-close] svg{width:16px!important;height:16px!important}
`
}

/** Built-in layout presets, available out of the box (point 10). Plugins add more. */
const BUILTIN_LAYOUT_PRESETS: Array<{ extId: string; id: string; title: string; layout: unknown }> = [
  {
    extId: 'codesurf', id: 'ai-workspace', title: 'AI Workspace',
    layout: {
      type: 'split', direction: 'horizontal', sizes: [25, 50, 25],
      children: [
        { type: 'leaf', slots: [{ tileType: 'files', label: 'Files' }] },
        { type: 'leaf', slots: [{ tileType: 'chat', label: 'Chat' }] },
        { type: 'leaf', slots: [{ tileType: 'terminal', label: 'Terminal' }] },
      ],
    },
  },
]
const el = (window as { electron?: any }).electron
const BUILTIN_COMMANDS: BuiltinCommand[] = [
  // Built-in views surfaced uniformly with plugin views (point 7).
  ...BUILTIN_VIEWS.map((v): BuiltinCommand => ({
    extId: 'codesurf', id: `new.${v.type}`, title: `New: ${v.label}`, category: 'New',
    _run: () => { window.dispatchEvent(new CustomEvent('codesurf:new-tile', { detail: { type: v.type } })) },
  })),
  {
    extId: 'codesurf', id: 'layout.save', title: 'Layout: Save Current as Preset',
    category: 'Layouts', _run: () => { window.dispatchEvent(new CustomEvent('codesurf:save-layout')) },
  },
  {
    extId: 'codesurf', id: 'devSandbox.open', title: 'Developer: Open Dev Sandbox',
    category: 'Developer', _run: () => { void el?.window?.openDevSandbox?.() },
  },
  {
    extId: 'codesurf', id: 'window.new', title: 'Window: New Window',
    category: 'Window', _run: () => { void el?.window?.new?.() },
  },
]

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const theme = useTheme()
  const paletteCss = useMemo(() => buildPaletteCss(theme), [theme])
  const pluginCommands = useContributions('commands') as PaletteCommand[]
  const layoutPresets = useContributions('layoutPresets')
  const { templates: savedLayouts } = useLayoutTemplates()
  // Each registered layout preset (built-in + plugin-contributed) becomes a one-click
  // "Layout: <title>" command that applies the arrangement (point 10 — reusable layouts).
  const presetCommands = useMemo<BuiltinCommand[]>(() => {
    const contributed = layoutPresets.map(p => {
      const preset = p as typeof p & { title?: string }
      return { extId: preset.extId, id: preset.id, title: preset.title ?? preset.id, layout: (preset as { layout?: unknown }).layout }
    })
    // The user's own saved layouts (incl. built-in defaults) are reusable here too.
    const saved = savedLayouts.map(t => ({ extId: 'codesurf', id: `saved.${t.id}`, title: t.name, layout: t.tree }))
    const all = [...BUILTIN_LAYOUT_PRESETS, ...saved, ...contributed]
    // Dedupe by display name (saved-template data can contain dupes like "Layout 8" x3),
    // and skip blank/placeholder names so the palette stays clean.
    const seen = new Set<string>()
    const deduped = all.filter(p => {
      const name = (p.title ?? '').trim()
      if (!name || seen.has(name.toLowerCase())) return false
      seen.add(name.toLowerCase())
      return true
    })
    return deduped.map(p => ({
      extId: p.extId, id: `layout.${p.id}`,
      title: `Layout: ${p.title}`, category: 'Layouts',
      _run: () => window.dispatchEvent(new CustomEvent('codesurf:open-layout-preset', { detail: p })),
    }))
  }, [layoutPresets, savedLayouts])
  const commands = useMemo<PaletteCommand[]>(
    () => [...BUILTIN_COMMANDS, ...presetCommands, ...pluginCommands],
    [presetCommands, pluginCommands],
  )
  const visible = useMemo(() => commands.filter(c => c.palette !== false), [commands])

  const groups = useMemo(() => {
    const byCategory = new Map<string, PaletteCommand[]>()
    for (const cmd of visible) {
      const key = cmd.category || 'Commands'
      const arr = byCategory.get(key) ?? []
      arr.push(cmd)
      byCategory.set(key, arr)
    }
    return [...byCategory.entries()]
  }, [visible])

  const run = (cmd: PaletteCommand) => {
    onOpenChange(false)
    const builtin = cmd as Partial<BuiltinCommand>
    if (typeof builtin._run === 'function') builtin._run()
    else void executeCommand(cmd)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Run a command"
    >
      {/* The shadcn/cmdk primitives ship rem-scaled fonts + tall (py-3/h-12) rows
          that render oversized in this app. Force compact, theme-consistent sizing
          (explicit px wins over the rem scaling and the dialog wrapper classes). */}
      <style>{paletteCss}</style>
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        {groups.map(([category, cmds]) => (
          <CommandGroup key={category} heading={category}>
            {cmds.map(cmd => (
              <CommandItem
                key={`${cmd.extId}:${cmd.id}`}
                value={`${cmd.title} ${cmd.id} ${cmd.slash ?? ''}`}
                onSelect={() => run(cmd)}
              >
                <span>{cmd.title}</span>
                {cmd.slash ? (
                  <CommandShortcut>/{cmd.slash}</CommandShortcut>
                ) : cmd.keybinding ? (
                  <CommandShortcut>{cmd.keybinding}</CommandShortcut>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
