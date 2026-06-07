import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { scanExtensionManifests, toExtensionListEntry } from '../src/main/extensions/light-scan.ts'

describe('extension light-scan', () => {
  test('defaults workspace power extensions off until enabled in catalog', async () => {
    const home = await mkdtemp(join(tmpdir(), 'codesurf-light-scan-'))
    const workspace = join(home, 'project')
    const extDir = join(workspace, '.contex', 'extensions', 'power-loop')
    await mkdir(extDir, { recursive: true })
    await writeFile(join(extDir, 'extension.json'), JSON.stringify({
      id: 'power-loop',
      name: 'Power Loop',
      version: '0.0.1',
      tier: 'power',
      contributes: { tiles: [{ type: 'loop', label: 'Loop', entry: 'index.html' }] },
    }))

    const manifests = await scanExtensionManifests(workspace, { contexHome: home })
    assert.equal(manifests.length, 1)
    assert.equal(manifests[0]?.id, 'power-loop')
    assert.equal(manifests[0]?._enabled, false)
    assert.equal(toExtensionListEntry(manifests[0]!).enabled, false)
  })
})