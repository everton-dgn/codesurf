import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  applyNewInstallSecurityDefaults,
  withDefaultSettings,
  withFreshInstallDefaults,
} from '../src/shared/types.ts'

describe('withFreshInstallDefaults', () => {
  test('enables workspace filesystem scoping on first launch', () => {
    const settings = withFreshInstallDefaults()
    assert.equal(settings.security.restrictFsToWorkspaceRoots, true)
  })

  test('does not change explicit legacy security preferences', () => {
    const settings = withDefaultSettings({
      security: {
        restrictFsToWorkspaceRoots: false,
      },
    })
    assert.equal(settings.security.restrictFsToWorkspaceRoots, false)
  })

  test('enables scoping during first-run before onboarding completes', () => {
    const settings = applyNewInstallSecurityDefaults(withDefaultSettings({
      onboardingComplete: false,
      security: {
        restrictFsToWorkspaceRoots: false,
      },
    }))
    assert.equal(settings.security.restrictFsToWorkspaceRoots, true)
  })

  test('leaves completed onboarding installs on explicit security values', () => {
    const settings = applyNewInstallSecurityDefaults(withDefaultSettings({
      onboardingComplete: true,
      security: {
        restrictFsToWorkspaceRoots: false,
      },
    }))
    assert.equal(settings.security.restrictFsToWorkspaceRoots, false)
  })
})