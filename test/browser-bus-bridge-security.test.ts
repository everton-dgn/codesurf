import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { expect } from './node-expect.ts'

const ROOT_DIR = process.cwd()
const BROWSER_TILE_SOURCE = readFileSync(join(ROOT_DIR, 'src/renderer/src/components/BrowserTile.tsx'), 'utf8')

describe('BrowserTile bus bridge hardening', () => {
  test('loads cluso assets from bundled renderer assets', () => {
    expect(BROWSER_TILE_SOURCE).toContain("../assets/cluso/cluso-embed.js?raw")
    expect(BROWSER_TILE_SOURCE).not.toContain('/Users/')
  })

  test('requires bridge token and localhost origin before publishing', () => {
    expect(BROWSER_TILE_SOURCE).toContain('bridgeTokenRef')
    expect(BROWSER_TILE_SOURCE).toContain('data.token === bridgeTokenRef.current')
    expect(BROWSER_TILE_SOURCE).toContain('shouldInjectHostBridge(webview.getURL())')
    expect(BROWSER_TILE_SOURCE).toContain('BRIDGE_TOKEN')
    expect(BROWSER_TILE_SOURCE).toContain('BRIDGE_CHANNEL')
  })
})