/**
 * Capability policy for the plugin execution broker.
 *
 * Enforcement lives ONLY in main — the child process never evaluates grants.
 * Every capability call that arrives from the child is validated here before
 * any executor runs.
 *
 * SECURITY SCOPE NOTE: The capability surface controlled here covers the ctx
 * API (bus, mcp, ipc, settings, store, relayHost). A child utilityProcess can
 * still call Node builtins (fs, child_process, etc.) directly — true OS-level
 * confinement is out of scope for Phase 1. The broker enforces that the *ctx*
 * surface is gated, blocking extensions from using relayHost, canvas, etc.
 * unless explicitly granted by the user.
 */

import type { BrokerErrorCode } from './protocol'

/**
 * ctx namespaces that every extension receives without any explicit grant.
 * These mirror the iframe bridge BASELINE surface.
 */
const BASELINE_NAMESPACES = new Set([
  'bus',
  'mcp',
  'ipc',
  'settings',
  'store',
  'log',
])

/**
 * Namespaces that require a specific grant name (may differ from the ns name).
 * Keys are ctx namespace names; values are the capability grant name to check.
 */
const GATED_NAMESPACES: Record<string, string> = {
  relayHost: 'relay',
  chat: 'chat',
  canvas: 'canvas',
  fs: 'fs',
  shell: 'shell',
  network: 'network',
  secrets: 'secrets',
  chrome: 'chrome',
  daemon: 'daemon',
}

/**
 * Maps a ctx namespace string to its corresponding capability grant name.
 * e.g. 'relayHost' -> 'relay', 'bus' -> 'bus'
 */
export function capabilityForNamespace(ns: string): string {
  return GATED_NAMESPACES[ns] ?? ns
}

/**
 * Validate a capability call from a child extension against its gate.
 *
 * Returns `{ ok: true }` when the call is permitted, or
 * `{ ok: false, code, message }` when it must be rejected.
 */
export function validateCapabilityCall(
  gate: { enforced: boolean; granted: string[] },
  extId: string,
  capability: string,
  method: string,
): { ok: true } | { ok: false; code: BrokerErrorCode; message: string } {
  // Baseline namespaces are always allowed regardless of grant state.
  if (BASELINE_NAMESPACES.has(capability)) {
    return { ok: true }
  }

  // For gated namespaces look up the required grant name.
  const requiredGrant = GATED_NAMESPACES[capability]
  if (requiredGrant === undefined) {
    // Unknown namespace — no executor registered in main.
    return {
      ok: false,
      code: 'capability-unknown',
      message: `Extension "${extId}" called unknown capability "${capability}.${method}" — no executor registered`,
    }
  }

  // Check that the grant is present.
  if (gate.granted.includes(requiredGrant)) {
    return { ok: true }
  }

  return {
    ok: false,
    code: 'capability-denied',
    message: `Extension "${extId}" is not granted capability "${requiredGrant}" (called "${capability}.${method}")`,
  }
}
