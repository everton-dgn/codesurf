import { promises as fs } from 'node:fs'
import { join } from 'node:path'

// ─── Authoritative AgentMode resolution — daemon mirror ───────────────────────
// Daemon-side mirror of src/shared/agentModes.ts + src/main/chat/agent-mode-resolver.ts.
// Kept separate because the daemon is a self-contained Node ESM process bundled
// apart from the renderer/main build. The test/daemon suite imports BOTH this
// module and the shared .ts and asserts the built-in data + overlay + resolution
// agree (cross-consistency drift guard). The daemon now uses this for
// defense-in-depth: the LOCAL daemon shares the filesystem with main, so when a
// real agents.json is present it RE-RESOLVES and overrides request.agentMode. The
// remote/cloud daemon has no `.contex` (the gitignored dir is excluded from the
// clone) → no file → it trusts the agentMode main already resolved and shipped.
//
// See agent-mode-resolver.ts for the full fail-closed rationale. The built-in
// modes here MUST stay byte-for-byte consistent with DEFAULT_AGENT_MODES in
// src/shared/agentModes.ts — the daemon's copy is security-load-bearing.

export const DEFAULT_AGENT_MODES = [
  { id: 'agent', name: 'Agent', description: 'Full autonomous access to all tools', systemPrompt: '', tools: null, icon: 'robot', color: '#3568ff', isBuiltin: true },
  { id: 'ask', name: 'Ask', description: 'Read-only Q&A mode — no file modifications', systemPrompt: 'You are in read-only mode. Do not modify files or run destructive commands.', tools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'], icon: 'help', color: '#56c288', isBuiltin: true },
  { id: 'plan', name: 'Plan', description: 'Plan without execution — outline steps before acting', systemPrompt: 'Create a detailed plan. Do not execute changes until the user approves.', tools: ['Read', 'Glob', 'Grep', 'WebSearch'], icon: 'map', color: '#f5a623', isBuiltin: true },
]

// Pure overlay: built-ins first, overlay persisted entries by id, drop
// ephemeral `discovered-*` scan results. Non-array → built-ins unchanged.
export function overlayAgentModes(loaded) {
  const merged = [...DEFAULT_AGENT_MODES]
  if (!Array.isArray(loaded)) return merged
  for (const item of loaded) {
    if (!item || typeof item.id !== 'string' || item.id.startsWith('discovered-')) continue
    const idx = merged.findIndex(m => m.id === item.id)
    if (idx >= 0) merged[idx] = { ...merged[idx], ...item }
    else merged.push(item)
  }
  return merged
}

export function findAgentModeById(modes, agentId) {
  return modes.find(m => m.id === agentId) ?? null
}

export const AGENT_MODE_RESOLUTION_DENIED_ERROR =
  'The selected agent could not be verified against the workspace agent definitions ' +
  '(its agents.json is unreadable/corrupt, or the agent is not defined there). ' +
  'Refusing to launch rather than fall back to looser default permissions — ' +
  'fix the agent definition or clear the selected agent.'

function agentsJsonPath(workspaceRoot) {
  return join(workspaceRoot, '.contex', 'customisation', 'agents.json')
}

// Mirror of resolveAuthoritativeAgentMode in agent-mode-resolver.ts. Same
// fail-closed contract: ENOENT → built-ins authoritative; present-but-unreadable/
// corrupt/non-array → fail closed; id-not-found → fail closed.
export async function resolveAuthoritativeAgentMode(opts) {
  const agentId = typeof opts?.agentId === 'string' ? opts.agentId.trim() : ''
  if (!agentId) return { ok: true, agentMode: null }

  let root = null
  try {
    root = await opts.resolveWorkspaceRoot()
  } catch {
    root = null
  }
  if (!root) return { ok: false, error: AGENT_MODE_RESOLUTION_DENIED_ERROR }

  let raw
  try {
    raw = await fs.readFile(agentsJsonPath(root), 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const resolved = findAgentModeById(DEFAULT_AGENT_MODES, agentId)
      return resolved
        ? { ok: true, agentMode: resolved }
        : { ok: false, error: AGENT_MODE_RESOLUTION_DENIED_ERROR }
    }
    return { ok: false, error: AGENT_MODE_RESOLUTION_DENIED_ERROR }
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: AGENT_MODE_RESOLUTION_DENIED_ERROR }
  }
  if (!Array.isArray(parsed)) return { ok: false, error: AGENT_MODE_RESOLUTION_DENIED_ERROR }

  const resolved = findAgentModeById(overlayAgentModes(parsed), agentId)
  if (!resolved) return { ok: false, error: AGENT_MODE_RESOLUTION_DENIED_ERROR }
  return { ok: true, agentMode: resolved }
}
