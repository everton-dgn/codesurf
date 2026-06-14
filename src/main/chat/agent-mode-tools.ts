import type { AgentMode } from '../../shared/types'

// AgentMode.tools allow-list semantics, shared by the runtime chat providers
// (claude/codex/hermes). The daemon has a parallel implementation in
// packages/codesurf-daemon/bin/chat-jobs.mjs + harness-runtime.mjs (kept
// separate because the daemon is a self-contained Node ESM process spawned
// apart from the renderer build). The test/daemon suite imports BOTH this module
// and the daemon helpers and asserts they agree, guarding against drift.
//
// This module is intentionally dependency-free (only `import type`) so the
// node --test daemon suite can import it directly under type-stripping.
//
// Three states for AgentMode.tools:
//   null / undefined → unrestricted (provider default toolset)
//   []               → explicit deny-all
//   [names...]       → restricted to those tool names

export function resolveAgentToolAllowList(agentMode?: AgentMode | null): string[] | null {
  const tools = agentMode?.tools
  return Array.isArray(tools) ? tools : null
}

// Normalize a tool name for comparison: lowercase + drop non-alphanumerics.
// AgentMode.tools uses Claude-style PascalCase (Read, WebSearch); other runtimes
// name the same capabilities differently. This makes both sides comparable.
export function normalizeToolName(name: string): string {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Tools that can mutate the filesystem or run arbitrary shell commands. Bash is
// write-capable (it can rm/write). Used to decide whether Codex must drop to a
// read-only sandbox — Codex's CLI has no per-tool allow-list, so the sandbox is
// the only real toolset lever it exposes.
const WRITE_CAPABLE_TOOLS = new Set(
  ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'apply_patch'].map(normalizeToolName),
)

// Does the allow-list grant ANY write-capable tool?
//   null  → unrestricted → writes allowed (true)
//   []    → deny-all → no writes (false)
//   names → true iff at least one write-capable tool is listed
export function allowListGrantsWrite(allowList: string[] | null): boolean {
  if (allowList == null) return true
  if (allowList.length === 0) return false
  return allowList.some(t => WRITE_CAPABLE_TOOLS.has(normalizeToolName(t)))
}

// The Codex sandbox is the real enforcement primitive. When an allow-list is
// present and grants no write-capable tool, Codex must run read-only regardless
// of the requested mode — otherwise it could still edit files the agent
// definition forbids. Returns true when the sandbox must be forced read-only.
export function codexShouldForceReadOnly(allowList: string[] | null): boolean {
  return allowList != null && !allowListGrantsWrite(allowList)
}

// Hermes exposes coarse toolset *categories* (terminal/file/web/browser), not a
// per-tool allow-list. Map the agent's tool names to the categories they fall
// under — the finest restriction Hermes can actually enforce.
//
// Residual limitation: a list that allows some-but-not-all tools within a
// category enables the whole category (Hermes can't gate individual tools).
const HERMES_CATEGORY: Record<string, string> = {}
for (const t of ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookRead', 'NotebookEdit', 'Glob', 'Grep', 'LS']) {
  HERMES_CATEGORY[normalizeToolName(t)] = 'file'
}
for (const t of ['Bash', 'BashOutput', 'KillBash']) HERMES_CATEGORY[normalizeToolName(t)] = 'terminal'
for (const t of ['WebSearch', 'WebFetch']) HERMES_CATEGORY[normalizeToolName(t)] = 'web'

const HERMES_CATEGORY_ORDER = ['terminal', 'file', 'web', 'browser']

// Derive a Hermes `--toolsets` value from the allow-list.
//   null  → null (caller falls back to mode/toolsets default)
//   []    → '' (deny-all → query-only, no toolsets)
//   names → canonical comma-joined categories the listed tools belong to
export function hermesToolsetsFromAllowList(allowList: string[] | null): string | null {
  if (allowList == null) return null
  const cats = new Set<string>()
  for (const t of allowList) {
    const norm = normalizeToolName(t)
    const cat = HERMES_CATEGORY[norm] ?? (norm.startsWith('browser') ? 'browser' : null)
    if (cat) cats.add(cat)
  }
  return HERMES_CATEGORY_ORDER.filter(c => cats.has(c)).join(',')
}

// The Claude Agent SDK's top-level `tools` option (and an AgentDefinition's
// `tools`) treats `[]` as "disable all built-in tools" and an omitted value as
// the default preset. So pass the allow-list through verbatim, returning
// undefined only when unrestricted (so the option is left off entirely).
export function claudeToolsForAllowList(allowList: string[] | null): string[] | undefined {
  return allowList == null ? undefined : allowList
}
