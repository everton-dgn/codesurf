import { test, expect } from '@playwright/test'
import { dismissAgentSetupIfPresent } from './helpers/dismiss-setup'
import { closeCodeSurfElectron, launchCodeSurfElectron } from './helpers/launch-electron'
import { waitForElectronBridge } from './helpers/wait-bridge'

test.describe('Canvas IPC surface', () => {
  test('preload exposes canvas APIs and returns structured load results', async () => {
    const launch = await launchCodeSurfElectron()

    try {
      const { page } = launch
      await waitForElectronBridge(page, 'canvas.load')

      const canvasProbe = await page.evaluate(async () => {
        const bridge = (window as Window & {
          electron: {
            workspace: { list: () => Promise<Array<{ id: string; path?: string }>> }
            canvas: { load: (workspaceId: string) => Promise<unknown> }
          }
        }).electron

        const workspaces = await bridge.workspace.list()
        const workspaceId = workspaces[0]?.id ?? 'e2e-empty-workspace'
        const loaded = await bridge.canvas.load(workspaceId)

        return {
          workspaceCount: workspaces.length,
          workspaceId,
          loadedIsNullOrObject: loaded === null || (typeof loaded === 'object' && loaded !== null),
        }
      })

      expect(canvasProbe.workspaceCount).toBeGreaterThanOrEqual(0)
      expect(canvasProbe.loadedIsNullOrObject).toBe(true)
    } finally {
      await closeCodeSurfElectron(launch)
    }
  })

  test('canvas save and reload round-trips tile state', async () => {
    const launch = await launchCodeSurfElectron()

    try {
      const { page } = launch
      await waitForElectronBridge(page, 'canvas.save')

      const roundTrip = await page.evaluate(async () => {
        const bridge = (window as Window & {
          electron: {
            workspace: {
              list: () => Promise<Array<{ id: string }>>
              create: (name: string) => Promise<{ id: string }>
            }
            canvas: {
              load: (workspaceId: string) => Promise<{ tiles?: Array<{ id: string; type: string }> } | null>
              save: (workspaceId: string, state: unknown) => Promise<unknown>
            }
          }
        }).electron

        const workspaces = await bridge.workspace.list()
        let workspaceId = workspaces[0]?.id
        if (!workspaceId) {
          const created = await bridge.workspace.create('e2e-canvas-roundtrip')
          workspaceId = created.id
        }

        const tileId = 'e2e-tile-1'
        const payload = {
          tiles: [{ id: tileId, type: 'note', x: 120, y: 80, width: 320, height: 200 }],
          viewport: { tx: 0, ty: 0, zoom: 1 },
          nextZIndex: 2,
        }

        await bridge.canvas.save(workspaceId, payload)
        const reloaded = await bridge.canvas.load(workspaceId)
        const tiles = Array.isArray(reloaded?.tiles) ? reloaded.tiles : []

        return {
          workspaceId,
          savedTileCount: payload.tiles.length,
          reloadedTileCount: tiles.length,
          hasSavedTile: tiles.some(tile => tile.id === tileId && tile.type === 'note'),
        }
      })

      expect(roundTrip.savedTileCount).toBeGreaterThan(0)
      expect(roundTrip.reloadedTileCount).toBeGreaterThanOrEqual(roundTrip.savedTileCount)
      expect(roundTrip.hasSavedTile).toBe(true)
    } finally {
      await closeCodeSurfElectron(launch)
    }
  })

  test('command shell creates a note tile on the canvas', async () => {
    const launch = await launchCodeSurfElectron()

    try {
      const { page } = launch
      await waitForElectronBridge(page, 'workspace.setActive')

      const workspaceId = await page.evaluate(async () => {
        const bridge = (window as Window & {
          electron: {
            workspace: {
              list: () => Promise<Array<{ id: string }>>
              create: (name: string) => Promise<{ id: string }>
              setActive: (id: string) => Promise<unknown>
            }
          }
        }).electron

        const workspaces = await bridge.workspace.list()
        let id = workspaces[0]?.id
        if (!id) {
          id = (await bridge.workspace.create('e2e-shell-tile')).id
        }
        await bridge.workspace.setActive(id)
        return id
      })

      await page.reload()
      await waitForElectronBridge(page, 'canvas.load')
      await dismissAgentSetupIfPresent(page)
      await page.waitForSelector('[data-canvas-surface="true"]', { timeout: 45_000 })

      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('codesurf:new-tile', { detail: { type: 'note' } }))
      })
      await page.waitForFunction(() => document.body.innerText.includes('NOTE'), undefined, { timeout: 15_000 })

      const created = await page.evaluate(() => ({
        showsNoteChrome: document.body.innerText.includes('NOTE'),
      }))

      expect(created.showsNoteChrome).toBe(true)
    } finally {
      await closeCodeSurfElectron(launch)
    }
  })

  test('canvas viewport save and reload round-trips pan and zoom', async () => {
    const launch = await launchCodeSurfElectron()

    try {
      const { page } = launch
      await waitForElectronBridge(page, 'canvas.save')

      const viewportRoundTrip = await page.evaluate(async () => {
        const bridge = (window as Window & {
          electron: {
            workspace: {
              list: () => Promise<Array<{ id: string }>>
              create: (name: string) => Promise<{ id: string }>
            }
            canvas: {
              load: (workspaceId: string) => Promise<{ viewport?: { tx: number; ty: number; zoom: number }; tiles?: unknown[] } | null>
              save: (workspaceId: string, state: unknown) => Promise<unknown>
            }
          }
        }).electron

        const workspaces = await bridge.workspace.list()
        let workspaceId = workspaces[0]?.id
        if (!workspaceId) {
          const createdWorkspace = await bridge.workspace.create('e2e-viewport')
          workspaceId = createdWorkspace.id
        }

        const viewport = { tx: 140, ty: 96, zoom: 1.35 }
        const payload = {
          tiles: [],
          viewport,
          nextZIndex: 1,
        }

        await bridge.canvas.save(workspaceId, payload)
        const reloaded = await bridge.canvas.load(workspaceId)
        const reloadedViewport = reloaded?.viewport ?? { tx: 0, ty: 0, zoom: 1 }

        return { saved: viewport, reloaded: reloadedViewport }
      })

      expect(viewportRoundTrip.reloaded).toEqual(viewportRoundTrip.saved)
    } finally {
      await closeCodeSurfElectron(launch)
    }
  })

})