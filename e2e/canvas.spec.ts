import { test, expect } from '@playwright/test'
import { closeCodeSurfElectron, launchCodeSurfElectron } from './helpers/launch-electron'

test.describe('Canvas IPC surface', () => {
  test('preload exposes canvas APIs and returns structured load results', async () => {
    const launch = await launchCodeSurfElectron()

    try {
      const { page } = launch

      await page.waitForFunction(() => {
        const bridge = (window as Window & { electron?: { canvas?: { load?: (id: string) => unknown } } }).electron
        return typeof bridge?.canvas?.load === 'function'
      }, undefined, { timeout: 45_000 })

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
})