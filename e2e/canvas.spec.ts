import { test, expect } from '@playwright/test'
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
})