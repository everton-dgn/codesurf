import { test, expect } from '@playwright/test'
import { closeCodeSurfElectron, launchCodeSurfElectron } from './helpers/launch-electron'
import { waitForElectronBridge } from './helpers/wait-bridge'

test.describe('Chat IPC surface', () => {
  test('preload exposes chat APIs with structured defaults', async () => {
    const launch = await launchCodeSurfElectron()

    try {
      const { page } = launch
      await waitForElectronBridge(page, 'chat.loadSessionHistory')

      const chatProbe = await page.evaluate(async () => {
        const bridge = (window as Window & {
          electron: {
            chat: {
              opencodeModels: () => Promise<unknown>
              csagentModels: () => Promise<unknown>
              loadSessionHistory: (payload: { limit?: number }) => Promise<unknown>
            }
          }
        }).electron

        const [models, csagentModels, history] = await Promise.all([
          bridge.chat.opencodeModels(),
          bridge.chat.csagentModels(),
          bridge.chat.loadSessionHistory({ limit: 1 }),
        ])

        return {
          modelsPayloadOk: models !== null && typeof models === 'object' && Array.isArray((models as { models?: unknown[] }).models),
          csagentModelsPayloadOk: csagentModels !== null && typeof csagentModels === 'object' && Array.isArray((csagentModels as { models?: unknown[] }).models),
          historyIsObject: history !== null && typeof history === 'object',
        }
      })

      expect(chatProbe.modelsPayloadOk).toBe(true)
      expect(chatProbe.csagentModelsPayloadOk).toBe(true)
      expect(chatProbe.historyIsObject).toBe(true)
    } finally {
      await closeCodeSurfElectron(launch)
    }
  })
})