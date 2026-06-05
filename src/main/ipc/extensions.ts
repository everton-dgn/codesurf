/**
 * IPC handlers for the extension system.
 * Exposes ext:* channels to the renderer.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { join, basename, extname } from 'path'
import { createReadStream } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ExtensionRegistry } from '../extensions/registry'
import { getBridgeScript } from '../extensions/bridge'
import { CONTEX_HOME } from '../paths'
import { readSettingsSync } from './workspace'
import { getPluginState, setPluginState, replacePluginState } from '../extensions/plugin-store'

const execFileAsync = promisify(execFile)
const EXTENSIONS_DIR = join(CONTEX_HOME, 'extensions')

/** Result of installing a packaged plugin (.vsix / .zip) into the plugins dir. */
interface InstallPluginResult {
  ok: boolean
  extId?: string
  name?: string
  error?: string
}

/**
 * Install a packaged plugin archive (.vsix or plain .zip) into ~/.codesurf/extensions
 * and rescan. vsix archives nest content under extension/; plain plugin zips put the
 * manifest at the root — both are handled. Shared by ext:install-vsix and the
 * marketplace's ext:install-from-file (file-picker) path.
 */
async function installPluginArchive(registry: ExtensionRegistry, archivePath: string): Promise<InstallPluginResult> {
  try {
    const name = basename(archivePath, extname(archivePath))
    const destDir = join(EXTENSIONS_DIR, name)
    await fs.mkdir(EXTENSIONS_DIR, { recursive: true })
    await fs.rm(destDir, { recursive: true, force: true }).catch(() => {})
    await fs.mkdir(destDir, { recursive: true })

    // .vsix and plugin .zip are both zip archives.
    await execFileAsync('unzip', ['-o', archivePath, '-d', destDir])

    // vsix archives nest everything under extension/ — flatten it up a level.
    const extensionSubdir = join(destDir, 'extension')
    const hasExtDir = await fs.stat(extensionSubdir).then(s => s.isDirectory()).catch(() => false)
    if (hasExtDir) {
      for (const item of await fs.readdir(extensionSubdir)) {
        await fs.rename(join(extensionSubdir, item), join(destDir, item)).catch(() => {})
      }
      await fs.rm(extensionSubdir, { recursive: true, force: true }).catch(() => {})
    }
    // Strip vsix packaging junk.
    for (const junk of ['[Content_Types].xml', '_rels']) {
      await fs.rm(join(destDir, junk), { recursive: true, force: true }).catch(() => {})
    }

    await registry.rescan(registry.getActiveWorkspacePath())
    const all = registry.getAll()
    const installed = all.find(m => m._path === destDir) || all.find(m => m._path?.startsWith(destDir))
    return { ok: true, extId: installed?.id || name, name: installed?.name || name }
  } catch (err) {
    console.error('[ext:install] Failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function extensionSettingsPath(extId: string): string {
  return join(CONTEX_HOME, 'extension-settings', `${extId}.json`)
}

async function readExtensionSettings(registry: ExtensionRegistry, extId: string): Promise<Record<string, unknown>> {
  const ext = registry.get(extId)
  if (!ext) return {}

  const defaults: Record<string, unknown> = {}
  for (const s of ext.manifest.contributes?.settings ?? []) {
    defaults[s.key] = s.default
  }
  // v2 settingsSections control defaults
  for (const section of ext.manifest.contributes?.settingsSections ?? []) {
    for (const item of section.items) {
      if ('key' in item && item.key && 'default' in item && item.default !== undefined) {
        defaults[item.key] = item.default
      }
    }
  }

  try {
    const raw = await fs.readFile(extensionSettingsPath(extId), 'utf8')
    return { ...defaults, ...(JSON.parse(raw) as Record<string, unknown>) }
  } catch {
    return defaults
  }
}

export function registerExtensionIPC(registry: ExtensionRegistry): void {
  let lastScannedWorkspacePath: string | null = null
  let hasScanned = false

  const ensureLoaded = async (workspacePath?: string | null, force = false): Promise<void> => {
    const settings = readSettingsSync()
    if (settings.extensionsDisabled) {
      lastScannedWorkspacePath = null
      hasScanned = false
      return
    }

    const targetWorkspacePath = workspacePath ?? registry.getActiveWorkspacePath() ?? null
    if (!force && hasScanned && lastScannedWorkspacePath === targetWorkspacePath) return

    await registry.rescan(targetWorkspacePath)
    lastScannedWorkspacePath = targetWorkspacePath
    hasScanned = true
  }

  // List all loaded extensions
  ipcMain.handle('ext:list', async () => {
    await ensureLoaded()
    return registry.getAll().map(m => ({
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description,
      author: m.author,
      tier: m.tier,
      ui: m.ui,
      enabled: m._enabled !== false,
      contributes: m.contributes,
      capabilities: m.capabilities ?? [],
      dirPath: m._path ?? null,
    }))
  })

  ipcMain.handle('ext:list-sidebar', async (_, workspacePath?: string | null) => {
    const settings = readSettingsSync()
    if (settings.extensionsDisabled) {
      return { entries: [], tiles: [] }
    }

    const manifests = await registry.scanLightweight(workspacePath ?? registry.getActiveWorkspacePath())
    const extActions = registry.getExtensionActions()

    return {
      entries: manifests.map(m => ({
        id: m.id,
        name: m.name,
        icon: m.contributes?.tiles?.[0]?.icon ?? m.contributes?.chatSurfaces?.[0]?.icon ?? null,
        enabled: m._enabled !== false,
      })),
      tiles: manifests
        .filter(m => m._enabled !== false)
        .flatMap(m => (m.contributes?.tiles ?? []).map(tile => ({
          extId: m.id,
          type: tile.type,
          label: tile.label,
          icon: tile.icon,
          entry: tile.entry,
          defaultSize: tile.defaultSize ?? { w: 400, h: 300 },
          minSize: tile.minSize ?? { w: 200, h: 150 },
          uiMode: m.ui?.mode,
          actions: extActions.get(m.id),
        }))),
    }
  })

  // List contributed tile types (for renderer to add to context menu / addTile)
  ipcMain.handle('ext:list-tiles', async () => {
    await ensureLoaded()
    const extActions = registry.getExtensionActions()
    return registry.getTileTypes().map(t => {
      const actions = extActions.get(t.extId)
      return {
        extId: t.extId,
        type: t.type,
        label: t.label,
        icon: t.icon,
        defaultSize: t.defaultSize ?? { w: 400, h: 300 },
        minSize: t.minSize ?? { w: 200, h: 150 },
        uiMode: t.uiMode,
        actions,
      }
    })
  })

  // Get the custom protocol URL for a tile's entry HTML
  ipcMain.handle('ext:tile-entry', async (_, extId: string, tileType: string, tileId?: string) => {
    await ensureLoaded()
    const url = registry.getTileEntry(extId, tileType, tileId)
    return url
  })

  // List contributed chat-surface contributions for the composer `+` menu
  ipcMain.handle('ext:list-chat-surfaces', async () => {
    await ensureLoaded()
    return registry.getChatSurfaces().map(s => ({
      extId: s.extId,
      id: s.id,
      label: s.label,
      description: s.description,
      icon: s.icon,
      entry: s.entry,
      emits: s.emits ?? 'image',
      defaultHeight: s.defaultHeight ?? 260,
      minHeight: s.minHeight ?? 160,
      uiMode: s.uiMode,
    }))
  })

  // Resolve the custom-protocol URL for an active chat-surface instance
  ipcMain.handle('ext:chat-surface-entry', async (_, extId: string, surfaceId: string, instanceId?: string) => {
    await ensureLoaded()
    return registry.getChatSurfaceEntry(extId, surfaceId, instanceId)
  })

  // List v2 contributions (commands, footer, panels, settingsSections, layoutPresets)
  // aggregated across enabled plugins. One round-trip; the renderer fans out to <Slot>s.
  ipcMain.handle('ext:contributions', async (_, kind?: string) => {
    await ensureLoaded()
    const all = registry.getContributions()
    if (!kind) return all
    return (all as unknown as Record<string, unknown[]>)[kind] ?? []
  })

  // Get the bridge script to inject into extension iframes
  ipcMain.handle('ext:get-bridge-script', (_, tileId: string, extId: string) => {
    return getBridgeScript(tileId, extId, registry.getCapabilityGate(extId))
  })

  // P1 capability gate for a plugin — the host RPC dispatcher (ExtensionTile)
  // rejects gated namespaces (chat/relay/canvas) the plugin wasn't granted.
  ipcMain.handle('ext:capability-gate', (_, extId: string) => {
    return registry.getCapabilityGate(extId)
  })

  // Enable/disable an extension
  ipcMain.handle('ext:enable', async (_, extId: string) => {
    return registry.enable(extId)
  })

  ipcMain.handle('ext:disable', async (_, extId: string) => {
    return registry.disable(extId)
  })

  ipcMain.handle('ext:refresh', async (_, workspacePath?: string | null) => {
    if (readSettingsSync().extensionsDisabled) {
      console.log('[Extensions] Refresh skipped — extensions globally disabled')
      lastScannedWorkspacePath = null
      hasScanned = false
      return []
    }
    await ensureLoaded(workspacePath ?? registry.getActiveWorkspacePath(), true)
    return registry.getAll().map(m => ({
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description,
      author: m.author,
      tier: m.tier,
      ui: m.ui,
      enabled: m._enabled !== false,
      contributes: m.contributes,
    }))
  })


  // Extension settings (persisted in ~/.contex/extension-settings/{extId}.json)
  ipcMain.handle('ext:settings-get', async (_, extId: string) => {
    return readExtensionSettings(registry, extId)
  })

  ipcMain.handle('ext:settings-set', async (_, extId: string, settings: Record<string, unknown>) => {
    const ext = registry.get(extId)
    if (!ext) return false

    const allowedKeys = new Set((ext.manifest.contributes?.settings ?? []).map(setting => setting.key))
    // v2 settingsSections control keys are also persistable
    for (const section of ext.manifest.contributes?.settingsSections ?? []) {
      for (const item of section.items) {
        if ('key' in item && item.key) allowedKeys.add(item.key)
      }
    }
    const filtered = Object.fromEntries(
      Object.entries(settings ?? {}).filter(([key]) => allowedKeys.has(key)),
    )

    await fs.mkdir(join(CONTEX_HOME, 'extension-settings'), { recursive: true })
    await fs.writeFile(extensionSettingsPath(extId), JSON.stringify(filtered, null, 2))
    return true
  })

  // Resolve a contribution's entry file to HTML (for render:'mcp-ui' / 'iframe' html feed).
  ipcMain.handle('ext:surface-html', async (_, extId: string, kind: string, surfaceId: string) => {
    await ensureLoaded()
    return registry.getSurfaceHtml(extId, kind, surfaceId)
  })

  // Plugin Store — durable reactive per-plugin state (~/.codesurf/plugin-state/{id}.json).
  // Changes broadcast on the bus channel plugin:<id>:state (see plugin-store.ts).
  ipcMain.handle('ext:store-get', async (_, extId: string) => {
    return getPluginState(extId)
  })

  ipcMain.handle('ext:store-set', async (_, extId: string, patch: Record<string, unknown>) => {
    return setPluginState(extId, patch ?? {})
  })

  ipcMain.handle('ext:store-replace', async (_, extId: string, value: Record<string, unknown>) => {
    return replacePluginState(extId, value ?? {})
  })

  // List context menu contributions
  ipcMain.handle('ext:context-menu-items', () => {
    return registry.getContextMenuItems()
  })

  // Install a .vsix file — extract and register as an extension
  ipcMain.handle('ext:install-vsix', async (_, vsixPath: string) => {
    const result = await installPluginArchive(registry, vsixPath)
    if (!result.ok) return result
    return {
      ...result,
      tiles: registry.getTileTypes().filter(t => t.extId === result.extId),
    }
  })

  // Marketplace: install a plugin the user picks from disk (.vsix / .zip). The
  // dialog runs in main so the renderer never passes an arbitrary path; installed
  // plugins land disabled-by-default and are capability-gated (see P1).
  ipcMain.handle('ext:install-from-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? undefined
    const picked = await dialog.showOpenDialog(win!, {
      title: 'Install plugin from file',
      properties: ['openFile'],
      filters: [{ name: 'Plugin package', extensions: ['vsix', 'zip'] }],
    })
    if (picked.canceled || picked.filePaths.length === 0) {
      return { ok: false, canceled: true }
    }
    return installPluginArchive(registry, picked.filePaths[0])
  })
}
