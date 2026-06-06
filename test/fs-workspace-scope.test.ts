import assert from 'node:assert/strict'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import {
  assertPathAllowedForFs,
  isPathUnderRoot,
  validateFsPath,
} from '../src/main/ipc/fs.ts'
import { CONTEX_HOME } from '../src/main/paths.ts'

describe('isPathUnderRoot', () => {
  test('matches exact root path', () => {
    assert.equal(isPathUnderRoot('/tmp/workspace', '/tmp/workspace'), true)
  })

  test('matches nested file under root', () => {
    assert.equal(isPathUnderRoot('/tmp/workspace/src/app.ts', '/tmp/workspace'), true)
  })

  test('rejects sibling paths that share a prefix', () => {
    assert.equal(isPathUnderRoot('/tmp/workspace-other/file.ts', '/tmp/workspace'), false)
  })

  test('rejects paths outside root', () => {
    assert.equal(isPathUnderRoot('/etc/passwd', '/tmp/workspace'), false)
  })
})

describe('assertPathAllowedForFs', () => {
  test('no-op when workspace scoping is disabled', () => {
    assert.doesNotThrow(() => assertPathAllowedForFs('/etc/passwd'))
    assert.doesNotThrow(() => assertPathAllowedForFs('/etc/passwd', { restrictToWorkspaceRoots: false }))
  })

  test('allows paths under configured workspace roots', () => {
    assert.doesNotThrow(() => assertPathAllowedForFs('/tmp/workspace/src/foo.ts', {
      restrictToWorkspaceRoots: true,
      allowedRoots: ['/tmp/workspace'],
    }))
  })

  test('allows CONTEX_HOME when scoping is enabled', () => {
    assert.doesNotThrow(() => assertPathAllowedForFs(join(CONTEX_HOME, 'settings.json'), {
      restrictToWorkspaceRoots: true,
      allowedRoots: ['/tmp/workspace'],
    }))
  })

  test('denies paths outside workspace roots when scoping is enabled', () => {
    assert.throws(
      () => assertPathAllowedForFs('/etc/passwd', {
        restrictToWorkspaceRoots: true,
        allowedRoots: ['/tmp/workspace'],
      }),
      /outside allowed workspace roots/,
    )
  })

  test('denies all non-CONTEX_HOME paths when no roots are configured', () => {
    assert.throws(
      () => assertPathAllowedForFs('/tmp/workspace/file.ts', {
        restrictToWorkspaceRoots: true,
        allowedRoots: [],
      }),
      /outside allowed workspace roots/,
    )
  })
})

describe('validateFsPath workspace scoping', () => {
  test('allows arbitrary paths when scoping is off', () => {
    const resolved = validateFsPath('/tmp/outside-home/file.txt')
    assert.equal(resolved, join('/tmp/outside-home/file.txt'))
  })

  test('allows workspace paths when scoping is on', () => {
    const resolved = validateFsPath('/tmp/workspace/readme.md', {
      restrictToWorkspaceRoots: true,
      allowedRoots: ['/tmp/workspace'],
    })
    assert.equal(resolved, join('/tmp/workspace/readme.md'))
  })

  test('always allows CONTEX_HOME paths when scoping is on', () => {
    const resolved = validateFsPath(join(CONTEX_HOME, 'briefs/card.md'), {
      restrictToWorkspaceRoots: true,
      allowedRoots: ['/tmp/workspace'],
    })
    assert.equal(resolved, join(CONTEX_HOME, 'briefs/card.md'))
  })

  test('rejects paths outside workspace roots when scoping is on', () => {
    assert.throws(
      () => validateFsPath('/etc/passwd', {
        restrictToWorkspaceRoots: true,
        allowedRoots: ['/tmp/workspace'],
      }),
      /outside allowed workspace roots/,
    )
  })
})