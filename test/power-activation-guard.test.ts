import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { isPowerActivationPermitted, type ExtensionScope } from '../src/main/extensions/loader.ts'
import type { ExtensionManifest } from '../src/shared/types.ts'

// Only populate the fields isPowerActivationPermitted actually reads:
// manifest.name, manifest.id, manifest._enabled
function makeManifest(
  enabled: boolean,
  overrides: Partial<ExtensionManifest> = {},
): ExtensionManifest {
  return {
    id: 'test-ext',
    name: 'Test Extension',
    version: '1.0.0',
    tier: 'power',
    _enabled: enabled,
    ...overrides,
  } as ExtensionManifest
}

describe('isPowerActivationPermitted (security gate)', () => {
  test('permits enabled global extension', () => {
    assert.equal(isPowerActivationPermitted(makeManifest(true), 'global'), true)
  })

  test('permits enabled bundled extension', () => {
    assert.equal(isPowerActivationPermitted(makeManifest(true), 'bundled'), true)
  })

  test('permits enabled workspace extension', () => {
    assert.equal(isPowerActivationPermitted(makeManifest(true), 'workspace'), true)
  })

  test('blocks disabled global extension', () => {
    assert.equal(isPowerActivationPermitted(makeManifest(false), 'global'), false)
  })

  test('blocks disabled workspace extension', () => {
    assert.equal(isPowerActivationPermitted(makeManifest(false), 'workspace'), false)
  })

  test('logs _enabled-is-false error when blocked (global)', () => {
    const logged: string[] = []
    const origError = console.error
    console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '))
    try {
      isPowerActivationPermitted(makeManifest(false), 'global')
    } finally {
      console.error = origError
    }
    assert.ok(
      logged.some(m => m.includes('_enabled is false')),
      `Expected "_enabled is false" in logged errors; got: ${JSON.stringify(logged)}`,
    )
  })

  // NOTE: This test documents the CURRENT behaviour where the workspace-specific
  // error message is dead code (Plan 003 fix was not fully applied — the workspace
  // check at loader.ts:73 is unreachable because the _enabled check at line 63
  // already returns false first).  When Plan 003 is correctly applied (the workspace
  // check nested INSIDE the _enabled block, or restructured so it fires separately
  // for workspace scope), this test should be updated to assert the workspace message.
  test('logs _enabled-is-false error when disabled workspace extension is blocked (workspace message is dead code)', () => {
    const logged: string[] = []
    const origError = console.error
    console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '))
    try {
      isPowerActivationPermitted(makeManifest(false), 'workspace')
    } finally {
      console.error = origError
    }
    // Current behaviour: first block fires with "_enabled is false" message.
    // The workspace-specific "workspace-local power extensions" message is never reached.
    assert.ok(
      logged.some(m => m.includes('_enabled is false')),
      `Expected "_enabled is false" in logged errors; got: ${JSON.stringify(logged)}`,
    )
  })
})
