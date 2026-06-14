import type { JSX } from 'react'
import type { AgentMode } from '../../../shared/types'

// ─── Shared agent-definition source ──────────────────────────────────────────
// Single source of truth for the built-in agent modes, their palette, and their
// icon set. Both CustomisationTile (where agents are authored) and the chat
// toolbar (where an agent is selected for a turn) read from here so the two
// surfaces never drift. The persisted store is `${workspace}/.contex/customisation/agents.json`.

export const DEFAULT_AGENT_MODES: AgentMode[] = [
  { id: 'agent', name: 'Agent', description: 'Full autonomous access to all tools', systemPrompt: '', tools: null, icon: 'robot', color: '#3568ff', isBuiltin: true },
  { id: 'ask', name: 'Ask', description: 'Read-only Q&A mode — no file modifications', systemPrompt: 'You are in read-only mode. Do not modify files or run destructive commands.', tools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'], icon: 'help', color: '#56c288', isBuiltin: true },
  { id: 'plan', name: 'Plan', description: 'Plan without execution — outline steps before acting', systemPrompt: 'Create a detailed plan. Do not execute changes until the user approves.', tools: ['Read', 'Glob', 'Grep', 'WebSearch'], icon: 'map', color: '#f5a623', isBuiltin: true },
]

export const AGENT_COLORS = ['#3568ff', '#56c288', '#f5a623', '#e57399', '#b368c9', '#00acd7', '#ff7b72', '#8f96a0']

export const AGENT_ICONS: Record<string, JSX.Element> = {
  robot: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="4" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" /><circle cx="5" cy="8" r="1" fill="currentColor" /><circle cx="9" cy="8" r="1" fill="currentColor" /><path d="M7 1v3M5 1h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>,
  help: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="M5.5 5.5a1.5 1.5 0 012.8.8c0 1-1.3 1.2-1.3 2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="7" cy="10.5" r="0.5" fill="currentColor" /></svg>,
  map: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3l4-1.5 4 1.5 4-1.5v9.5l-4 1.5-4-1.5L1 12.5V3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M5 1.5v10M9 3.5v10" stroke="currentColor" strokeWidth="1.2" /></svg>,
  star: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.8 3.6L13 5.2l-3 2.9.7 4.1L7 10.3 3.3 12.2l.7-4.1-3-2.9 4.2-.6L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>,
  bolt: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7.5 1L3 8h4l-.5 5L11 6H7l.5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>,
}

export function getAgentIcon(name: string | undefined): JSX.Element {
  return AGENT_ICONS[name ?? ''] ?? AGENT_ICONS.robot
}

function agentsDataDir(workspacePath: string): string {
  return `${workspacePath}/.contex/customisation`
}

/**
 * Load the selectable agent definitions for a workspace: the built-in modes
 * merged with any user-authored agents persisted in agents.json. Mirrors the
 * merge CustomisationTile applies on mount (built-ins first, overlay persisted
 * entries by id, drop ephemeral `discovered-*` scan results which are never
 * persisted). Auto-discovered agents are intentionally NOT scanned here — the
 * selector lists exactly what agents.json names.
 */
export async function loadAgentModes(workspacePath: string): Promise<AgentMode[]> {
  const file = `${agentsDataDir(workspacePath)}/agents.json`
  try {
    const stat = await window.electron.fs.stat(file).catch(() => null)
    if (!stat) return [...DEFAULT_AGENT_MODES]
    const raw = await window.electron.fs.readFile(file)
    const loaded = JSON.parse(raw) as AgentMode[]
    if (!Array.isArray(loaded)) return [...DEFAULT_AGENT_MODES]
    const merged = [...DEFAULT_AGENT_MODES]
    for (const item of loaded) {
      if (!item || typeof item.id !== 'string' || item.id.startsWith('discovered-')) continue
      const idx = merged.findIndex(m => m.id === item.id)
      if (idx >= 0) merged[idx] = { ...merged[idx], ...item }
      else merged.push(item)
    }
    return merged
  } catch {
    return [...DEFAULT_AGENT_MODES]
  }
}
