// AgentMode.tools allow-list semantics for the CodeSurf daemon (Codex / Hermes /
// harness paths). This is the daemon-side mirror of the runtime providers'
// src/main/chat/agent-mode-tools.ts — kept separate because the daemon is a
// self-contained Node ESM process bundled apart from the renderer. The
// test/daemon suite imports BOTH and asserts they agree (cross-consistency
// guard against drift).
//
// Three states for AgentMode.tools:
//   null / undefined → unrestricted (provider default toolset)
//   []               → explicit deny-all
//   [names...]       → restricted to those tool names

export function resolveAgentToolAllowList(agentMode) {
  const tools = agentMode?.tools
  return Array.isArray(tools) ? tools : null
}

// Normalize a tool name for comparison: lowercase + drop non-alphanumerics.
// AgentMode.tools uses Claude-style PascalCase (Read, WebSearch); harness
// builtins are lowercase (read, webSearch). This makes both sides comparable.
export function normalizeToolName(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Is `toolName` permitted by the agent definition's allow-list?
//   null/undefined → unrestricted → everything allowed (true)
//   []             → explicit deny-all → nothing allowed (false)
//   [names...]     → true iff the tool matches a listed name
export function isToolAllowedByAgent(toolName, allowList) {
  if (allowList == null) return true
  if (!Array.isArray(allowList)) return true
  if (allowList.length === 0) return false
  const wanted = normalizeToolName(toolName)
  if (!wanted) return false
  return allowList.some(entry => normalizeToolName(entry) === wanted)
}

// Tools that can mutate the filesystem or run arbitrary shell commands. Bash is
// write-capable (rm/write). Used to decide whether Codex must run read-only —
// Codex's CLI has no per-tool allow-list, so the sandbox is its only real lever.
const WRITE_CAPABLE_TOOLS = new Set(
  ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'apply_patch'].map(normalizeToolName),
)

export function allowListGrantsWrite(allowList) {
  if (allowList == null) return true
  if (allowList.length === 0) return false
  return allowList.some(t => WRITE_CAPABLE_TOOLS.has(normalizeToolName(t)))
}

// True when the allow-list is present and grants no write-capable tool, so Codex
// must be forced to a read-only sandbox regardless of the requested mode.
export function codexShouldForceReadOnly(allowList) {
  return allowList != null && !allowListGrantsWrite(allowList)
}

// Hermes exposes coarse toolset categories (terminal/file/web/browser), not a
// per-tool allow-list. Map tool names to the categories they belong to — the
// finest restriction Hermes can enforce. (Residual: allowing some-but-not-all
// tools in a category enables the whole category.)
const HERMES_CATEGORY = {}
for (const t of ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookRead', 'NotebookEdit', 'Glob', 'Grep', 'LS']) {
  HERMES_CATEGORY[normalizeToolName(t)] = 'file'
}
for (const t of ['Bash', 'BashOutput', 'KillBash']) HERMES_CATEGORY[normalizeToolName(t)] = 'terminal'
for (const t of ['WebSearch', 'WebFetch']) HERMES_CATEGORY[normalizeToolName(t)] = 'web'

const HERMES_CATEGORY_ORDER = ['terminal', 'file', 'web', 'browser']

// Derive a Hermes `--toolsets` value from the allow-list.
//   null  → null (caller falls back to mode/toolsets default)
//   []    → '' (deny-all → query-only)
//   names → canonical comma-joined categories the listed tools belong to
export function hermesToolsetsFromAllowList(allowList) {
  if (allowList == null) return null
  const cats = new Set()
  for (const t of allowList) {
    const norm = normalizeToolName(t)
    const cat = HERMES_CATEGORY[norm] ?? (norm.startsWith('browser') ? 'browser' : null)
    if (cat) cats.add(cat)
  }
  return HERMES_CATEGORY_ORDER.filter(c => cats.has(c)).join(',')
}
