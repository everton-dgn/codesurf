import type { AgentMode } from './types'

// ─── Shared agent-definition data + pure resolution helpers ───────────────────
// Single source of truth for the BUILT-IN agent modes and the parse/overlay logic
// that merges them with a workspace's authored agents.json. Built-ins are a
// COMPILE-TIME constant — they are not loaded from disk and cannot be spoofed.
//
// This module is intentionally dependency-free (only `import type`) so it can be
// imported by the renderer (display), the Electron main process (the authoritative
// SEND-time resolver in src/main/chat/agent-mode-resolver.ts), and the node
// --test daemon suite (under type-stripping). The daemon process bundles a
// parallel .mjs mirror (packages/codesurf-daemon/bin/agent-mode-resolver.mjs);
// the test suite imports BOTH and asserts the data + overlay agree (drift guard).
//
// The persisted override store is `${workspaceRoot}/.contex/customisation/agents.json`.

export const DEFAULT_AGENT_MODES: AgentMode[] = [
  { id: 'agent', name: 'Agent', description: 'Full autonomous access to all tools', systemPrompt: '', tools: null, icon: 'robot', color: '#3568ff', isBuiltin: true },
  { id: 'ask', name: 'Ask', description: 'Read-only Q&A mode — no file modifications', systemPrompt: 'You are in read-only mode. Do not modify files or run destructive commands.', tools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'], icon: 'help', color: '#56c288', isBuiltin: true },
  { id: 'plan', name: 'Plan', description: 'Plan without execution — outline steps before acting', systemPrompt: 'Create a detailed plan. Do not execute changes until the user approves.', tools: ['Read', 'Glob', 'Grep', 'WebSearch'], icon: 'map', color: '#f5a623', isBuiltin: true },
]

/**
 * Pure overlay: built-ins first, overlay persisted entries by id, drop ephemeral
 * `discovered-*` scan results (never persisted). `loaded` is the already-parsed
 * agents.json value. A non-array value yields the built-ins unchanged (lenient —
 * suitable for renderer DISPLAY). The authoritative resolver treats a present but
 * non-array file as corrupt and fails closed; this helper stays lenient so the
 * two concerns don't entangle.
 */
export function overlayAgentModes(loaded: unknown): AgentMode[] {
  const merged: AgentMode[] = [...DEFAULT_AGENT_MODES]
  if (!Array.isArray(loaded)) return merged
  for (const item of loaded as AgentMode[]) {
    if (!item || typeof item.id !== 'string' || item.id.startsWith('discovered-')) continue
    const idx = merged.findIndex(m => m.id === item.id)
    if (idx >= 0) merged[idx] = { ...merged[idx], ...item }
    else merged.push(item)
  }
  return merged
}

/** Find a resolved agent mode by id, or null. */
export function findAgentModeById(modes: AgentMode[], agentId: string): AgentMode | null {
  return modes.find(m => m.id === agentId) ?? null
}
