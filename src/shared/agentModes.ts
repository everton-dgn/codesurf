import type { Persona } from './types'

// ─── Shared Persona data + pure resolution helpers ────────────────────────────
// Single source of truth for the BUILT-IN personas and the parse/overlay/inherit
// logic that merges them with a workspace's authored agents.json. Built-ins are a
// COMPILE-TIME constant — they are not loaded from disk and cannot be spoofed.
//
// This module is intentionally dependency-free (only `import type`) so it can be
// imported by the renderer (display), the Electron main process (the authoritative
// SEND-time resolver in src/main/chat/agent-mode-resolver.ts), and the node
// --test daemon suite (under type-stripping). The daemon process bundles a
// parallel .mjs mirror (packages/codesurf-daemon/bin/agent-mode-resolver.mjs);
// the test suite imports BOTH and asserts the data + overlay agree (drift guard).
//
// BACK-COMPAT: the persisted override store is, and MUST remain,
// `${workspaceRoot}/.contex/customisation/agents.json`. The on-disk filename is
// retained (NOT renamed to personas.json) so existing user workspaces keep
// working — this rename is in-code + UI only. Do not migrate the persisted file.

// PLACEHOLDER prompt text below (flagged) — refine the `systemPrompt` "souls" for
// Polly and Gemma before shipping; the surrounding wiring is final.
export const DEFAULT_PERSONAS: Persona[] = [
  { id: 'agent', name: 'Agent', description: 'Full autonomous access to all tools', systemPrompt: '', tools: null, icon: 'robot', color: '#3568ff', isBuiltin: true },
  { id: 'ask', name: 'Ask', description: 'Read-only Q&A mode — no file modifications', systemPrompt: 'You are in read-only mode. Do not modify files or run destructive commands.', tools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'], icon: 'help', color: '#56c288', isBuiltin: true },
  { id: 'plan', name: 'Plan', description: 'Plan without execution — outline steps before acting', systemPrompt: 'Create a detailed plan. Do not execute changes until the user approves.', tools: ['Read', 'Glob', 'Grep', 'WebSearch'], icon: 'map', color: '#f5a623', isBuiltin: true },
  // Polly — orchestrator/coordinator persona. PLACEHOLDER soul; refine later.
  { id: 'polly', name: 'Polly', description: 'Orchestrator — coordinates work and delegates to other personas', systemPrompt: 'PLACEHOLDER (refine me): You are Polly, an orchestrator. Break the request into clear subtasks, decide which persona or tool should handle each, sequence the work, and keep the user informed. Prefer delegating and verifying over doing everything yourself.', tools: null, icon: 'star', color: '#b368c9', isBuiltin: true },
  // Gemma — general-purpose assistant persona. PLACEHOLDER soul; refine later.
  { id: 'gemma', name: 'Gemma', description: 'General-purpose assistant for everyday tasks', systemPrompt: 'PLACEHOLDER (refine me): You are Gemma, a helpful general-purpose assistant. Answer clearly, ask for clarification when the request is ambiguous, and use the available tools to complete the task end to end.', tools: null, icon: 'bolt', color: '#00acd7', isBuiltin: true },
]

/**
 * @deprecated Renamed to {@link DEFAULT_PERSONAS}. Retained as an alias so existing
 * importers keep working during the Persona rename. Prefer `DEFAULT_PERSONAS`.
 */
export const DEFAULT_AGENT_MODES = DEFAULT_PERSONAS

/**
 * Resolve a persona's `extends` inheritance against a fully-overlaid set (built-ins
 * + persisted, keyed by id). The resolved persona is the BASE's fields with the
 * child's EXPLICITLY-DEFINED fields overlaid on top.
 *
 * FAIL-CLOSED TOOL RULE (inheritance must NEVER widen the toolset): if the child
 * DEFINES `tools` (the key is present — including `[]` deny-all or `null`
 * unrestricted), the child's value wins outright; if the child OMITS `tools`, it
 * inherits the base's. A dangling or cyclic `extends` resolves to the child
 * UNCHANGED — we never inherit from an unresolved base, since that could only
 * widen permissions.
 */
function resolvePersonaExtends(persona: Persona, byId: Map<string, Persona>, seen: Set<string>): Persona {
  const baseId = typeof persona.extends === 'string' ? persona.extends.trim() : ''
  if (!baseId || seen.has(persona.id)) return persona
  const rawBase = byId.get(baseId)
  if (!rawBase || rawBase.id === persona.id) return persona // dangling/self → no widening
  seen.add(persona.id)
  const base = resolvePersonaExtends(rawBase, byId, seen) // resolve the base chain first
  const merged: Persona = { ...base, ...persona }
  // FAIL-CLOSED: the child's tools apply ONLY when the child defines the key;
  // otherwise inherit the base's (an omitted `tools` must not silently widen).
  merged.tools = Object.prototype.hasOwnProperty.call(persona, 'tools') ? persona.tools : base.tools
  merged.id = persona.id
  return merged
}

function resolveAllExtends(list: Persona[]): Persona[] {
  const byId = new Map(list.map(p => [p.id, p]))
  return list.map(p => resolvePersonaExtends(p, byId, new Set<string>()))
}

/**
 * Pure overlay + inheritance: built-ins first, overlay persisted entries by id,
 * drop ephemeral `discovered-*` scan results (never persisted), then resolve
 * `extends` inheritance. `loaded` is the already-parsed agents.json value. A
 * non-array value yields the built-ins unchanged (lenient — suitable for renderer
 * DISPLAY). The authoritative resolver treats a present but non-array file as
 * corrupt and fails closed; this helper stays lenient so the two concerns don't
 * entangle.
 */
export function overlayPersonas(loaded: unknown): Persona[] {
  const merged: Persona[] = [...DEFAULT_PERSONAS]
  if (!Array.isArray(loaded)) return resolveAllExtends(merged)
  for (const item of loaded as Persona[]) {
    if (!item || typeof item.id !== 'string' || item.id.startsWith('discovered-')) continue
    const idx = merged.findIndex(m => m.id === item.id)
    if (idx >= 0) merged[idx] = { ...merged[idx], ...item }
    else merged.push(item)
  }
  return resolveAllExtends(merged)
}

/**
 * @deprecated Renamed to {@link overlayPersonas}. Retained as an alias during the
 * Persona rename. Prefer `overlayPersonas`.
 */
export const overlayAgentModes = overlayPersonas

/** Find a resolved persona by id, or null. */
export function findPersonaById(personas: Persona[], personaId: string): Persona | null {
  return personas.find(p => p.id === personaId) ?? null
}

/**
 * @deprecated Renamed to {@link findPersonaById}. Retained as an alias during the
 * Persona rename. Prefer `findPersonaById`.
 */
export const findAgentModeById = findPersonaById
