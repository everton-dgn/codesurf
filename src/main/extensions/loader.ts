/**
 * Power extension loader — requires and activates Node.js (power-tier) extensions.
 *
 * TRUST BOUNDARY — power/node extensions run with full Electron main-process
 * privileges: unrestricted Node.js (fs, child_process, net, require, etc.).
 * This is equivalent to installing a native application.  The capability
 * system governing the iframe bridge does NOT constrain power extensions.
 *
 * Activation is gated in registry.ts (resolveExtensionEnabled):
 *   - bundled / global-install extensions  → enabled by default
 *   - catalog extensions                   → default-OFF; require explicit
 *                                            user enable via the gallery
 *   - workspace-local extensions           → default-OFF (untrustedScope);
 *                                            require explicit user enable
 *
 * A broker-based approach (utilityProcess / worker) that would provide real
 * isolation is the intended end state documented in docs/plugins/00-architecture.md
 * §6 ("node execution flows through the broker rather than raw require() into
 * main").  That rearchitecture is tracked as future work; the raw require()
 * path persists in the meantime.
 */

import { join } from 'path'
import type { ExtensionManifest } from '../../shared/types'
import type { ExtensionContext } from './context'

/**
 * Scope categories used for activation gate decisions.  Keep in sync with the
 * scopes understood by registry.ts / activation-policy.ts.
 */
export type ExtensionScope = 'bundled' | 'global' | 'catalog' | 'workspace'

/**
 * Guard called immediately before require() + activate().  Returns true when
 * loading is permitted, false when it must be blocked.
 *
 * This is a defense-in-depth boundary: the primary gate lives in
 * resolveExtensionEnabled (activation-policy.ts) and is applied at scan time.
 * This secondary check prevents an unexpected code path from activating an
 * extension that should be disabled.
 */
export function isPowerActivationPermitted(
  manifest: ExtensionManifest,
  scope: ExtensionScope,
): boolean {
  if (!manifest._enabled) {
    if (scope === 'workspace') {
      // Workspace extensions are attacker-controllable (any cloned repo can ship
      // .contex/extensions/).  Enforce that they passed the untrustedScope gate.
      console.error(
        `[Security] Blocked activation of workspace power extension "${manifest.name}" (${manifest.id}): ` +
        `workspace-local power extensions require explicit user opt-in.`,
      )
    } else {
      // An extension that did not pass resolveExtensionEnabled must never execute.
      console.error(
        `[Security] Blocked activation of power extension "${manifest.name}" (${manifest.id}): ` +
        `_enabled is false — this extension must be explicitly enabled by the user before it can run.`,
      )
    }
    return false
  }

  return true
}

export async function loadPowerExtension(
  manifest: ExtensionManifest,
  ctx: ExtensionContext,
  scope: ExtensionScope = 'global',
): Promise<(() => void) | null> {
  if (!manifest.main || !manifest._path) return null

  const entryPath = join(manifest._path, manifest.main)
  const prefix = `[Ext:${manifest.name}]`

  // Defense-in-depth gate: block if the extension should not be active.
  if (!isPowerActivationPermitted(manifest, scope)) {
    return null
  }

  // Emit a conspicuous warning so any audit of the process log can identify
  // which extensions are running with full main-process privileges.
  console.warn(
    `[Security] Loading power extension "${manifest.name}" (${manifest.id}) ` +
    `from ${entryPath} — runs with FULL main-process privileges (Node.js, fs, ` +
    `child_process, network). Scope: ${scope}.`,
  )

  try {
    // Clear require cache so extensions can be hot-reloaded
    delete require.cache[require.resolve(entryPath)]
    const mod = require(entryPath)

    if (typeof mod.activate !== 'function') {
      console.warn(`${prefix} No activate() export found in ${entryPath}`)
      return null
    }

    console.log(`${prefix} Activating power extension...`)
    const result = await mod.activate(ctx)

    // activate() can return a cleanup function
    if (typeof result === 'function') {
      return () => {
        try {
          result()
          ctx.dispose()
        } catch (err) {
          console.error(`${prefix} Error during deactivation:`, err)
        }
      }
    }

    return () => ctx.dispose()
  } catch (err) {
    console.error(`${prefix} Failed to load power extension:`, err)
    return null
  }
}
