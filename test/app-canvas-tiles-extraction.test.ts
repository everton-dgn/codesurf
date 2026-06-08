import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { expect } from './node-expect.ts'

const ROOT_DIR = process.cwd()
const APP_SOURCE = readFileSync(join(ROOT_DIR, 'src/renderer/src/App.tsx'), 'utf8')
const TILES_SOURCE = readFileSync(join(ROOT_DIR, 'src/renderer/src/components/AppCanvasTiles.tsx'), 'utf8')

describe('wave 24 canvas tiles extraction', () => {
  test('App delegates tile loop to AppCanvasTiles', () => {
    expect(APP_SOURCE).toContain("from './components/AppCanvasTiles'")
    expect(APP_SOURCE).toContain('<AppCanvasTiles')
    expect(APP_SOURCE).not.toContain('LazyTileChrome')
    expect(APP_SOURCE).not.toContain('link-sensor-')
    expect(APP_SOURCE).not.toContain('Drag to link blocks')
  })

  test('AppCanvasTiles owns tile chrome, link sensors, and connection handles', () => {
    expect(TILES_SOURCE).toContain('export function AppCanvasTiles')
    expect(TILES_SOURCE).toContain('export function filterVisibleCanvasTiles')
    expect(TILES_SOURCE).toContain('LazyTileChrome')
    expect(TILES_SOURCE).toContain('link-sensor-')
    expect(TILES_SOURCE).toContain('Drag to link blocks')
    expect(TILES_SOURCE).toContain('getConnectionHandlePoint')
    expect(TILES_SOURCE).toContain('TileColorProvider')
  })
})