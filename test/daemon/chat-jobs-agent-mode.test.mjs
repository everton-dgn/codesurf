// Verifies the agent-definition (AgentMode) wiring end-to-end on the daemon:
//  - harness path: AgentMode.systemPrompt reaches makeAgent({ instructions }),
//    AgentMode.tools allow-list denies a disallowed tool (and a downgrade of an
//    allow-all permission mode so the deny can fire), an allowed tool still asks.
//  - claude SDK path: AgentMode.systemPrompt reaches options.agents.contex.prompt
//    and AgentMode.tools reaches options.tools (the SDK's built-in restriction).
//  - isToolAllowedByAgent casing/normalization.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { mkdtemp as mkdtempP, mkdir as mkdirP, rm as rmP } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createHarnessRunner,
  isToolAllowedByAgent,
} from '../../packages/codesurf-daemon/bin/harness-runtime.mjs'
import {
  createChatJobManager,
  buildCodexExecArgs,
  hermesToolsetsForRequest,
} from '../../bin/chat-jobs.mjs'
// Daemon-side AgentMode→tool mapping (Codex sandbox / Hermes toolsets).
import * as daemonAgentTools from '../../packages/codesurf-daemon/bin/agent-mode-tools.mjs'
// Runtime providers' shared mapping module (the SAME code chatClaude/chatCodex/
// chatHermes import). Pure + type-only, so node's type-stripping loads it here.
import * as runtimeAgentTools from '../../src/main/chat/agent-mode-tools.ts'
// Pure runtime helpers extracted so the constructed-payload behavior (not just
// the helper math) is testable: the Hermes turn-prompt builder and the renderer
// permission-mode resolver.
import { buildHermesTurnPrompt } from '../../src/main/chat/providers/hermes-prompt.ts'
import { resolveActiveChatMode } from '../../src/renderer/src/hooks/chatModeResolution.ts'
import {
  CODEX_DENY_ALL_ERROR,
  HARNESS_READS_UNENFORCEABLE_ERROR,
  agentModeUnresolved as daemonAgentModeUnresolved,
  AGENT_MODE_UNRESOLVED_ERROR as DAEMON_AGENT_MODE_UNRESOLVED_ERROR,
} from '../../packages/codesurf-daemon/bin/agent-mode-tools.mjs'
// Runtime provider payload builders — the SAME pure functions chatClaude/
// chatCodex/chatHermes call. Importing them lets the suite assert the REAL
// constructed payload + fail-closed throws (not a source regex). Dependency-free,
// so node's type-stripping loads them.
import {
  buildHermesSpawnArgs,
  buildCodexSpawnArgs,
  buildClaudeAgentModeOptions,
} from '../../src/main/chat/providers/agent-mode-payloads.ts'

const ROOT_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const TEST_TMP_ROOT = join(ROOT_DIR, '.tmp', 'daemon-tests')

async function makeTestTempDir(prefix) {
  await mkdirP(TEST_TMP_ROOT, { recursive: true })
  return await mkdtempP(join(TEST_TMP_ROOT, prefix))
}

async function waitForCompletedJob(manager, jobId, timeoutMs = 5_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const state = await manager.getJobState(jobId)
    if (state && state.status !== 'running') return state
    await new Promise(r => setTimeout(r, 25))
  }
  throw new Error('job did not complete')
}

async function* scriptedStream(parts) {
  for (const p of parts) yield p
}

// ─── isToolAllowedByAgent (pure) ─────────────────────────────────────────────

test('isToolAllowedByAgent: null/undefined = unrestricted, [] = explicit deny-all', () => {
  // null/undefined (unset) → unrestricted.
  assert.equal(isToolAllowedByAgent('Write', null), true)
  assert.equal(isToolAllowedByAgent('Write', undefined), true)
  // [] → explicit deny-all (consistent with the claude SDK's tools:[] and the
  // harness approval-loop deny). This is the #5 semantic fix.
  assert.equal(isToolAllowedByAgent('Write', []), false)
  assert.equal(isToolAllowedByAgent('Read', []), false)
})

test('isToolAllowedByAgent: matches across PascalCase/lowercase normalization', () => {
  const list = ['Read', 'Glob', 'Grep', 'WebSearch']
  // harness builtins are lowercase (read, webSearch); allow-list is PascalCase.
  assert.equal(isToolAllowedByAgent('read', list), true)
  assert.equal(isToolAllowedByAgent('webSearch', list), true)
  assert.equal(isToolAllowedByAgent('WebSearch', list), true)
  assert.equal(isToolAllowedByAgent('write', list), false)
  assert.equal(isToolAllowedByAgent('bash', list), false)
})

// ─── harness path ────────────────────────────────────────────────────────────

test('harness: AgentMode.systemPrompt is injected into makeAgent instructions', async () => {
  const captured = {}
  const home = mkdtempSync(join(tmpdir(), 'codesurf-agentmode-'))
  const createAgent = opts => {
    captured.opts = opts
    return {
      async createSession(o) { return { sessionId: o?.sessionId ?? 'fake', destroy: async () => {} } },
      async stream() { return { fullStream: scriptedStream([{ type: 'text-delta', id: 't', text: 'ok' }, { type: 'finish', finishReason: 'stop' }]) } },
    }
  }
  const runner = createHarnessRunner({ homeDir: home, createAgent })
  await runner.runHarnessJob(
    { id: 'persona-job' },
    {
      provider: 'claude',
      mode: 'default',
      messages: [{ role: 'user', content: 'hi' }],
      agentMode: { id: 'zebra', name: 'Zebra', systemPrompt: 'ZEBRA-PERSONA-9921 You only speak in haiku.', tools: null },
    },
    '', // no workspace → bind path is the raw instructionPrompt + persona
    'MEMORY-PROMPT-CONTEXT',
    { appendEvent: async () => {} },
  )
  assert.ok(captured.opts.instructions.includes('ZEBRA-PERSONA-9921'), 'persona systemPrompt must reach instructions')
  assert.ok(captured.opts.instructions.includes('MEMORY-PROMPT-CONTEXT'), 'memory prompt must still be present')
  // persona leads the instructions
  assert.ok(captured.opts.instructions.indexOf('ZEBRA-PERSONA-9921') < captured.opts.instructions.indexOf('MEMORY-PROMPT-CONTEXT'))
})

test('harness: tools allow-list denies a disallowed tool without prompting, allows a listed one', async () => {
  const home = mkdtempSync(join(tmpdir(), 'codesurf-agentmode-'))
  const events = []
  const asked = []
  const awaitToolPermission = async (approvalId, req) => { asked.push(req.toolName); return 'once' }

  // One stream pauses on two approvals: 'write' (NOT in allow-list) and 'bash'
  // (in allow-list). continueStream finishes the turn.
  const createAgent = opts => {
    void opts
    return {
      async createSession(o) { return { sessionId: o?.sessionId ?? 'fake', destroy: async () => {} } },
      async stream() {
        return {
          fullStream: scriptedStream([
            { type: 'tool-approval-request', approvalId: 'ap-write', toolCall: { type: 'tool-call', toolCallId: 'tc-w', toolName: 'write', input: { file_path: 'x' } } },
            { type: 'tool-approval-request', approvalId: 'ap-bash', toolCall: { type: 'tool-call', toolCallId: 'tc-b', toolName: 'bash', input: { command: 'ls' } } },
          ]),
          response: Promise.resolve({ messages: [] }),
        }
      },
      async continueStream() {
        return { fullStream: scriptedStream([{ type: 'finish', finishReason: 'stop' }]), response: Promise.resolve({ messages: [] }) }
      },
    }
  }
  const runner = createHarnessRunner({ homeDir: home, createAgent })
  await runner.runHarnessJob(
    { id: 'allowlist-job' },
    {
      provider: 'claude',
      mode: 'default',
      messages: [{ role: 'user', content: 'go' }],
      agentMode: { id: 'restricted', name: 'Restricted', systemPrompt: '', tools: ['Read', 'Glob', 'Grep', 'Bash'] },
    },
    '',
    '',
    { appendEvent: async (_j, e) => events.push(e), awaitToolPermission },
  )

  // 'write' was auto-denied by the allow-list — the user was NEVER asked for it.
  assert.ok(!asked.includes('write'), 'disallowed tool must not be sent to the user prompt')
  assert.ok(events.some(e => e.type === 'tool_permission_resolved' && e.toolName === 'write' && e.decision === 'deny'))
  assert.ok(events.some(e => e.type === 'tool_summary' && e.toolName === 'write' && /Blocked by agent definition/.test(e.text)))
  // 'bash' IS in the allow-list, so it surfaced to the user as normal.
  assert.ok(asked.includes('bash'), 'allowed tool must still go through the normal approval prompt')
})

test('harness: an allow-list downgrades allow-all to a gated mode so denies can fire', async () => {
  const captured = {}
  const home = mkdtempSync(join(tmpdir(), 'codesurf-agentmode-'))
  const createAgent = opts => {
    captured.opts = opts
    return {
      async createSession(o) { return { sessionId: o?.sessionId ?? 'fake', destroy: async () => {} } },
      async stream() { return { fullStream: scriptedStream([{ type: 'finish', finishReason: 'stop' }]) } },
    }
  }
  const runner = createHarnessRunner({ homeDir: home, createAgent })
  // bypassPermissions would normally map to allow-all; with an allow-list present
  // it must downgrade to allow-reads so disallowed tools surface for denial.
  await runner.runHarnessJob(
    { id: 'downgrade-job' },
    { provider: 'claude', mode: 'bypassPermissions', messages: [{ role: 'user', content: 'hi' }], agentMode: { id: 'r', name: 'r', systemPrompt: '', tools: ['Read'] } },
    '',
    '',
    { appendEvent: async () => {} },
  )
  assert.equal(captured.opts.permissionMode, 'allow-reads')
})

test('harness: bypassPermissions stays allow-all when no allow-list is set', async () => {
  const captured = {}
  const home = mkdtempSync(join(tmpdir(), 'codesurf-agentmode-'))
  const createAgent = opts => {
    captured.opts = opts
    return {
      async createSession(o) { return { sessionId: o?.sessionId ?? 'fake', destroy: async () => {} } },
      async stream() { return { fullStream: scriptedStream([{ type: 'finish', finishReason: 'stop' }]) } },
    }
  }
  const runner = createHarnessRunner({ homeDir: home, createAgent })
  await runner.runHarnessJob(
    { id: 'noagent-job' },
    { provider: 'claude', mode: 'bypassPermissions', messages: [{ role: 'user', content: 'hi' }] },
    '',
    '',
    { appendEvent: async () => {} },
  )
  assert.equal(captured.opts.permissionMode, 'allow-all')
})

// ─── claude SDK path ─────────────────────────────────────────────────────────

test('claude SDK: AgentMode.systemPrompt + tools reach the query options', async t => {
  const homeDir = await makeTestTempDir('chat-jobs-agentmode-claude-')
  const workspaceDir = join(homeDir, 'workspace')
  await mkdirP(workspaceDir, { recursive: true })
  t.after(async () => { await rmP(homeDir, { recursive: true, force: true }) })

  let capturedOptions = null
  const manager = createChatJobManager({
    homeDir,
    checkpointStore: { createCheckpoint() { return { ok: true, checkpoint: { id: 'c' } } } },
    claudeQuery: ({ options }) => (async function* () {
      capturedOptions = options
      yield { type: 'result', result: 'done', session_id: 'claude-agentmode', total_cost_usd: 0, num_turns: 1 }
    })(),
  })

  const job = await manager.startJob({
    cardId: 'chat-agentmode',
    workspaceId: 'agentmode-workspace',
    provider: 'claude',
    model: 'claude-test',
    mode: 'bypassPermissions',
    workspaceDir,
    messages: [{ role: 'user', content: 'do the thing' }],
    agentMode: { id: 'ask', name: 'Ask', systemPrompt: 'PERSONA-TOKEN-7788 read-only mode.', tools: ['Read', 'Glob', 'Grep'] },
  })

  const completed = await waitForCompletedJob(manager, job.id)
  assert.equal(completed.status, 'completed')
  assert.ok(capturedOptions, 'claudeQuery should have been invoked')
  // tools allow-list → SDK top-level `tools` restriction (governs with no custom agent)...
  assert.deepEqual(capturedOptions.tools, ['Read', 'Glob', 'Grep'])
  // systemPrompt → custom agent prompt, which makes `agent` active...
  assert.equal(capturedOptions.agent, 'contex')
  assert.ok(capturedOptions.agents?.contex?.prompt?.includes('PERSONA-TOKEN-7788'), 'persona must reach the claude agent prompt')
  // ...and the allow-list MUST also be on the active agent definition, since the
  // active agent's own `tools` field governs its toolset when `agent` is set.
  assert.deepEqual(capturedOptions.agents?.contex?.tools, ['Read', 'Glob', 'Grep'])
})

test('claude SDK: no agentMode leaves tools unrestricted', async t => {
  const homeDir = await makeTestTempDir('chat-jobs-agentmode-claude-none-')
  const workspaceDir = join(homeDir, 'workspace')
  await mkdirP(workspaceDir, { recursive: true })
  t.after(async () => { await rmP(homeDir, { recursive: true, force: true }) })

  let capturedOptions = null
  const manager = createChatJobManager({
    homeDir,
    checkpointStore: { createCheckpoint() { return { ok: true, checkpoint: { id: 'c' } } } },
    claudeQuery: ({ options }) => (async function* () {
      capturedOptions = options
      yield { type: 'result', result: 'done', session_id: 's', total_cost_usd: 0, num_turns: 1 }
    })(),
  })

  const job = await manager.startJob({
    cardId: 'chat-noagent',
    workspaceId: 'noagent-workspace',
    provider: 'claude',
    model: 'claude-test',
    mode: 'bypassPermissions',
    workspaceDir,
    messages: [{ role: 'user', content: 'hi' }],
  })

  await waitForCompletedJob(manager, job.id)
  assert.equal(capturedOptions.tools, undefined)
})

// ─── harness: allow-edits downgrade + [] deny-all (#3, #5) ────────────────────

test('harness: an allow-list downgrades acceptEdits (allow-edits) to allow-reads', async () => {
  const captured = {}
  const home = mkdtempSync(join(tmpdir(), 'codesurf-agentmode-'))
  const createAgent = opts => {
    captured.opts = opts
    return {
      async createSession(o) { return { sessionId: o?.sessionId ?? 'fake', destroy: async () => {} } },
      async stream() { return { fullStream: scriptedStream([{ type: 'finish', finishReason: 'stop' }]) } },
    }
  }
  const runner = createHarnessRunner({ homeDir: home, createAgent })
  // acceptEdits → allow-edits would auto-approve edits; with an allow-list it must
  // downgrade to allow-reads so an excluded Write/Edit surfaces for the deny.
  await runner.runHarnessJob(
    { id: 'downgrade-edits-job' },
    { provider: 'claude', mode: 'acceptEdits', messages: [{ role: 'user', content: 'hi' }], agentMode: { id: 'r', name: 'r', systemPrompt: '', tools: ['Read'] } },
    '',
    '',
    { appendEvent: async () => {} },
  )
  assert.equal(captured.opts.permissionMode, 'allow-reads')
})

test('harness: tools:[] (deny-all) is REFUSED — the agent never launches (#BLOCKING-2)', async () => {
  // Regression proof: the OLD behavior launched under `allow-reads` (which
  // AUTO-APPROVES the adapter's built-in reads) and only the approval loop could
  // deny a *pausing* tool like bash — so tools:[] still read the whole workspace
  // while claiming deny-all. The Claude harness cannot deny reads, so deny-all
  // must now FAIL CLOSED: no agent created, no stream, an error + done emitted.
  const home = mkdtempSync(join(tmpdir(), 'codesurf-agentmode-'))
  const events = []
  let agentCreated = false
  let streamStarted = false
  const createAgent = () => {
    agentCreated = true
    return {
      async createSession(o) { return { sessionId: o?.sessionId ?? 'fake', destroy: async () => {} } },
      async stream() {
        streamStarted = true
        return { fullStream: scriptedStream([{ type: 'finish', finishReason: 'stop' }]), response: Promise.resolve({ messages: [] }) }
      },
    }
  }
  const runner = createHarnessRunner({ homeDir: home, createAgent })
  await runner.runHarnessJob(
    { id: 'denyall-job' },
    { provider: 'claude', mode: 'bypassPermissions', messages: [{ role: 'user', content: 'go' }], agentMode: { id: 'none', name: 'None', systemPrompt: '', tools: [] } },
    '',
    '',
    { appendEvent: async (_j, e) => events.push(e) },
  )
  assert.equal(agentCreated, false, 'deny-all must refuse to launch — no agent created (would otherwise read-capable)')
  assert.equal(streamStarted, false, 'deny-all must not start a stream')
  assert.equal(events.find(e => e.type === 'error')?.error, HARNESS_READS_UNENFORCEABLE_ERROR, 'must surface the read-unenforceable reason')
  assert.ok(events.some(e => e.type === 'done'), 'must still terminate the job with done')
})

test('harness: a Read-excluding allow-list is also REFUSED (reads auto-approve, unenforceable) (#BLOCKING-2)', async () => {
  // The leak is broader than []: ANY list that excludes Read is unenforceable on
  // the harness (reads auto-approve regardless of the list). e.g. ['Bash'] would
  // run read-capable while the definition forbids reads → fail closed.
  const home = mkdtempSync(join(tmpdir(), 'codesurf-agentmode-'))
  const events = []
  let agentCreated = false
  const createAgent = () => {
    agentCreated = true
    return {
      async createSession(o) { return { sessionId: o?.sessionId ?? 'fake', destroy: async () => {} } },
      async stream() { return { fullStream: scriptedStream([{ type: 'finish', finishReason: 'stop' }]), response: Promise.resolve({ messages: [] }) } },
    }
  }
  const runner = createHarnessRunner({ homeDir: home, createAgent })
  await runner.runHarnessJob(
    { id: 'noread-job' },
    { provider: 'claude', mode: 'bypassPermissions', messages: [{ role: 'user', content: 'go' }], agentMode: { id: 'w', name: 'W', systemPrompt: '', tools: ['Bash'] } },
    '',
    '',
    { appendEvent: async (_j, e) => events.push(e) },
  )
  assert.equal(agentCreated, false, 'a Read-excluding allow-list must refuse to launch on the harness')
  assert.equal(events.find(e => e.type === 'error')?.error, HARNESS_READS_UNENFORCEABLE_ERROR)
})

test('harness: a Read-INCLUSIVE allow-list still launches (reads are honestly enforceable)', async () => {
  // Guard the other side: ['Read','Bash'] permits reads, so the harness CAN honor
  // the definition (auto-approve reads, deny the rest via the loop). It must NOT
  // fail closed — the agent launches as before.
  const home = mkdtempSync(join(tmpdir(), 'codesurf-agentmode-'))
  const events = []
  let agentCreated = false
  const createAgent = () => {
    agentCreated = true
    return {
      async createSession(o) { return { sessionId: o?.sessionId ?? 'fake', destroy: async () => {} } },
      async stream() { return { fullStream: scriptedStream([{ type: 'finish', finishReason: 'stop' }]), response: Promise.resolve({ messages: [] }) } },
    }
  }
  const runner = createHarnessRunner({ homeDir: home, createAgent })
  await runner.runHarnessJob(
    { id: 'readok-job' },
    { provider: 'claude', mode: 'bypassPermissions', messages: [{ role: 'user', content: 'go' }], agentMode: { id: 'dev', name: 'Dev', systemPrompt: '', tools: ['Read', 'Bash'] } },
    '',
    '',
    { appendEvent: async (_j, e) => events.push(e) },
  )
  assert.equal(agentCreated, true, 'a Read-inclusive allow-list must still launch (enforceable)')
  assert.ok(!events.some(e => e.type === 'error'), 'no fail-closed error for an enforceable list')
})

// ─── daemon Codex: AgentMode.tools → sandbox (#2) ─────────────────────────────

// Helper: read the `-s/--sandbox` value and the `-c approval_policy=` value out
// of a constructed `codex exec` argv. Asserts the REAL payload, not the helper.
function codexSandboxAndApproval(args) {
  const sIdx = args.indexOf('-s')
  const sandbox = sIdx >= 0 ? args[sIdx + 1] : null
  const cfg = args.find(a => typeof a === 'string' && a.startsWith('approval_policy='))
  const approval = cfg ? cfg.split('=')[1] : null
  return { sandbox, approval }
}

test('daemon Codex: each UI mode maps to the correct sandbox + approval policy (#2c)', () => {
  const base = { provider: 'codex', model: 'gpt-test', messages: [{ role: 'user', content: 'do it' }] }
  const expected = {
    'default': { sandbox: 'workspace-write', approval: 'on-request' },
    'auto': { sandbox: 'workspace-write', approval: 'on-failure' },
    'read-only': { sandbox: 'read-only', approval: 'on-request' },
    'full-access': { sandbox: 'danger-full-access', approval: 'never' },
  }
  for (const [mode, want] of Object.entries(expected)) {
    const args = buildCodexExecArgs({ ...base, mode }, '/ws')
    assert.deepEqual(codexSandboxAndApproval(args), want, `mode ${mode} must map to ${JSON.stringify(want)}`)
  }
})

test('daemon Codex: a write-free allow-list forces a read-only sandbox', () => {
  const base = { provider: 'codex', model: 'gpt-test', mode: 'default', messages: [{ role: 'user', content: 'do it' }] }

  // No agentMode → default mode keeps workspace-write.
  assert.equal(codexSandboxAndApproval(buildCodexExecArgs({ ...base }, '/ws')).sandbox, 'workspace-write')

  // Allow-list with NO write/exec tool → forced read-only (reads still allowed —
  // honest, NOT deny-all). Approval policy still reflects the mode.
  const readOnly = buildCodexExecArgs({ ...base, agentMode: { id: 'ask', name: 'Ask', systemPrompt: '', tools: ['Read', 'Glob', 'Grep'] } }, '/ws')
  assert.deepEqual(codexSandboxAndApproval(readOnly), { sandbox: 'read-only', approval: 'on-request' }, 'write-free allow-list must force read-only sandbox')
  assert.ok(!readOnly.includes('workspace-write'))

  // Allow-list that includes Bash (write-capable) → stays workspace-write.
  const withBash = buildCodexExecArgs({ ...base, agentMode: { id: 'dev', name: 'Dev', systemPrompt: '', tools: ['Read', 'Bash'] } }, '/ws')
  assert.equal(codexSandboxAndApproval(withBash).sandbox, 'workspace-write', 'a write-capable tool keeps the writable sandbox')
})

test('daemon Codex: an explicit deny-all ([]) FAILS CLOSED instead of silently allowing reads (#1b)', () => {
  const base = { provider: 'codex', model: 'gpt-test', mode: 'default', messages: [{ role: 'user', content: 'do it' }] }
  // Regression proof: the old behavior downgraded deny-all to a read-capable
  // `--sandbox read-only`, overclaiming deny-all. It must now THROW so the caller
  // refuses to launch.
  assert.throws(
    () => buildCodexExecArgs({ ...base, agentMode: { id: 'none', name: 'None', systemPrompt: '', tools: [] } }, '/ws'),
    err => {
      assert.equal(err.message, CODEX_DENY_ALL_ERROR)
      return true
    },
    'Codex deny-all must fail closed (throw), not produce a read-capable sandbox',
  )
})

test('daemon Codex: AgentMode.systemPrompt is injected into the prompt arg', () => {
  const args = buildCodexExecArgs({
    provider: 'codex', model: 'gpt-test', mode: 'default',
    messages: [{ role: 'user', content: 'hello' }],
    agentMode: { id: 'z', name: 'Z', systemPrompt: 'CODEX-PERSONA-5512 stay terse.', tools: null },
  }, '/ws')
  // The prompt is the final positional arg.
  assert.ok(args[args.length - 1].includes('CODEX-PERSONA-5512'), 'persona must reach the codex prompt')
})

// ─── daemon Hermes: AgentMode.tools → toolsets (#2) ───────────────────────────

test('daemon Hermes: AgentMode.tools constrains the toolset categories', () => {
  // file-only allow-list → file toolset.
  assert.equal(
    hermesToolsetsForRequest({ provider: 'hermes', mode: 'full', agentMode: { tools: ['Read', 'Glob'] } }),
    'file',
  )
  // mixed allow-list → canonical terminal,file,web.
  assert.equal(
    hermesToolsetsForRequest({ provider: 'hermes', mode: 'query', agentMode: { tools: ['Read', 'Bash', 'WebSearch'] } }),
    'terminal,file,web',
  )
  // [] deny-all → empty toolset (query-only), overriding mode 'full'.
  assert.equal(
    hermesToolsetsForRequest({ provider: 'hermes', mode: 'full', agentMode: { tools: [] } }),
    '',
  )
  // No agentMode → falls back to the mode mapping.
  assert.equal(
    hermesToolsetsForRequest({ provider: 'hermes', mode: 'full' }),
    'terminal,file,web,browser',
  )
})

// ─── runtime providers: AgentMode mapping (#1) ────────────────────────────────
// The runtime providers (chatClaude/chatCodex/chatHermes) live in Electron-coupled
// .ts and can't be launched under node --test, but they all funnel AgentMode
// through src/main/chat/agent-mode-tools.ts. We exercise that shared module (the
// real code path) plus assert each provider actually imports & wires it.

test('runtime mapping: claude tools option reflects allow-list (#1)', () => {
  const { resolveAgentToolAllowList, claudeToolsForAllowList } = runtimeAgentTools
  // unset → undefined (option left off → SDK default preset)
  assert.equal(claudeToolsForAllowList(resolveAgentToolAllowList({ tools: null })), undefined)
  assert.equal(claudeToolsForAllowList(resolveAgentToolAllowList({})), undefined)
  // [] → deny-all passed through verbatim
  assert.deepEqual(claudeToolsForAllowList(resolveAgentToolAllowList({ tools: [] })), [])
  // names → restricted
  assert.deepEqual(claudeToolsForAllowList(resolveAgentToolAllowList({ tools: ['Read', 'Glob'] })), ['Read', 'Glob'])
})

test('runtime mapping: codex sandbox + hermes toolsets reflect allow-list (#1)', () => {
  const { resolveAgentToolAllowList, codexShouldForceReadOnly, hermesToolsetsFromAllowList } = runtimeAgentTools
  // codex read-only forcing
  assert.equal(codexShouldForceReadOnly(resolveAgentToolAllowList({ tools: ['Read'] })), true)
  assert.equal(codexShouldForceReadOnly(resolveAgentToolAllowList({ tools: ['Read', 'Bash'] })), false)
  assert.equal(codexShouldForceReadOnly(resolveAgentToolAllowList({ tools: null })), false)
  assert.equal(codexShouldForceReadOnly(resolveAgentToolAllowList({ tools: [] })), true)
  // hermes toolset categories
  assert.equal(hermesToolsetsFromAllowList(resolveAgentToolAllowList({ tools: ['Read', 'WebSearch'] })), 'file,web')
  assert.equal(hermesToolsetsFromAllowList(resolveAgentToolAllowList({ tools: [] })), '')
  assert.equal(hermesToolsetsFromAllowList(resolveAgentToolAllowList({ tools: null })), null)
})

test('contract #1: constructed payloads (not just helpers) reflect AgentMode (#1c)', () => {
  // Codex: the actual `codex exec` argv carries the persona in the prompt AND the
  // sandbox the allow-list dictates — assert the built command, not the helper.
  const codexArgs = buildCodexExecArgs({
    provider: 'codex', model: 'gpt-test', mode: 'default',
    messages: [{ role: 'user', content: 'go' }],
    agentMode: { id: 'ask', name: 'Ask', systemPrompt: 'PERSONA-1C-CODEX read-only.', tools: ['Read', 'Glob'] },
  }, '/ws')
  assert.equal(codexSandboxAndApproval(codexArgs).sandbox, 'read-only', 'write-free allow-list → read-only in the real argv')
  assert.ok(codexArgs[codexArgs.length - 1].includes('PERSONA-1C-CODEX'), 'persona must be in the real codex prompt arg')

  // Hermes: the constructed turn prompt carries the persona on the FIRST turn and
  // on a RESUMED turn (the #1a fix), and the toolset reflects the allow-list.
  const firstTurn = buildHermesTurnPrompt({ userContent: 'go', agentPersona: 'PERSONA-1C-HERMES.', isFirstTurn: true })
  assert.ok(firstTurn.includes('PERSONA-1C-HERMES'), 'persona present on first Hermes turn')
  const resumed = buildHermesTurnPrompt({ userContent: 'go', agentPersona: 'PERSONA-1C-HERMES.', isFirstTurn: false })
  assert.ok(resumed.includes('PERSONA-1C-HERMES'), 'persona present on RESUMED Hermes turn (#1a)')
  assert.equal(
    hermesToolsetsForRequest({ provider: 'hermes', mode: 'full', agentMode: { tools: ['Read', 'Glob'] } }),
    'file',
    'hermes toolset reflects the allow-list in the constructed request',
  )
})

test('runtime ↔ daemon mapping agree (drift guard)', () => {
  const cases = [null, [], ['Read'], ['Read', 'Bash'], ['Read', 'WebSearch'], ['Write', 'Edit']]
  for (const tools of cases) {
    const agentMode = { tools }
    const rt = runtimeAgentTools.resolveAgentToolAllowList(agentMode)
    const dn = daemonAgentTools.resolveAgentToolAllowList(agentMode)
    assert.equal(
      runtimeAgentTools.codexShouldForceReadOnly(rt),
      daemonAgentTools.codexShouldForceReadOnly(dn),
      `codex read-only mapping must agree for ${JSON.stringify(tools)}`,
    )
    assert.equal(
      runtimeAgentTools.hermesToolsetsFromAllowList(rt),
      daemonAgentTools.hermesToolsetsFromAllowList(dn),
      `hermes toolset mapping must agree for ${JSON.stringify(tools)}`,
    )
    // Codex deny-all + per-mode sandbox/approval must agree across the twin
    // modules (the Electron codex.ts and the daemon chat-jobs.mjs both depend on
    // them) — otherwise the two Codex launch paths could silently diverge.
    assert.equal(
      runtimeAgentTools.codexDenyAllUnsupported(rt),
      daemonAgentTools.codexDenyAllUnsupported(dn),
      `codex deny-all detection must agree for ${JSON.stringify(tools)}`,
    )
    for (const mode of ['default', 'auto', 'read-only', 'full-access']) {
      const rtFlags = (() => { try { return runtimeAgentTools.codexSandboxApprovalFlags(mode, rt) } catch (e) { return `THROW:${e.message}` } })()
      const dnFlags = (() => { try { return daemonAgentTools.codexSandboxApprovalFlags(mode, dn) } catch (e) { return `THROW:${e.message}` } })()
      assert.deepEqual(rtFlags, dnFlags, `codex sandbox/approval flags must agree for mode ${mode}, tools ${JSON.stringify(tools)}`)
    }
  }
})

// A-PR1 BLOCKING-3: the OLD wiring guard was a SOURCE REGEX — it passed even if a
// provider dropped its actual call path while leaving the helper imported. These
// replacements assert the REAL constructed payload from the SAME builder the
// provider calls, so a regression in the wiring fails the test.

test('runtime Hermes: buildHermesSpawnArgs (the chatHermes call path) reflects AgentMode in the real argv (#1c)', () => {
  // file-only allow-list → --toolsets file (NOT the mode's terminal,file,web,browser),
  // and the persona rides inside the --query prompt.
  const args = buildHermesSpawnArgs({
    agentMode: { id: 'ask', name: 'Ask', systemPrompt: 'PERSONA-RT-HERMES.', tools: ['Read', 'Glob'] },
    mode: 'full', model: 'm', userContent: 'go',
  })
  const tsIdx = args.indexOf('--toolsets')
  assert.ok(tsIdx >= 0, '--toolsets must be present for a non-empty allow-list')
  assert.equal(args[tsIdx + 1], 'file', 'file-only allow-list → --toolsets file in the real argv')
  const queryIdx = args.indexOf('--query')
  assert.ok(args[queryIdx + 1].includes('PERSONA-RT-HERMES'), 'persona must be in the real --query prompt')
  assert.ok(args.includes('--stream-json'), 'chatHermes requests NDJSON streaming')

  // deny-all [] → query-only: empty toolset is dropped (no --toolsets flag).
  const denyAll = buildHermesSpawnArgs({ agentMode: { tools: [] }, mode: 'full', model: 'm', userContent: 'go' })
  assert.ok(!denyAll.includes('--toolsets'), 'deny-all → no toolsets flag (query-only)')
})

test('runtime Codex: buildCodexSpawnArgs (the chatCodex call path) reflects AgentMode in the real argv (#1c)', () => {
  const args = buildCodexSpawnArgs({
    agentMode: { id: 'ask', name: 'Ask', systemPrompt: 'PERSONA-RT-CODEX.', tools: ['Read', 'Glob'] },
    mode: 'default', model: 'm', userContent: 'go', workspaceDir: '/ws',
  })
  assert.equal(codexSandboxAndApproval(args).sandbox, 'read-only', 'write-free allow-list → read-only sandbox in the real runtime argv')
  assert.ok(args[args.length - 1].includes('PERSONA-RT-CODEX'), 'persona must be in the real codex prompt arg')

  // deny-all [] FAILS CLOSED (throws) — same honest contract as the daemon path.
  assert.throws(
    () => buildCodexSpawnArgs({ agentMode: { tools: [] }, mode: 'default', model: 'm', userContent: 'go' }),
    err => { assert.equal(err.message, CODEX_DENY_ALL_ERROR); return true },
    'runtime Codex deny-all must fail closed (throw), not build a read-capable argv',
  )
})

test('runtime Claude: buildClaudeAgentModeOptions (the chatClaude call path) reflects AgentMode (#1c)', () => {
  const restricted = buildClaudeAgentModeOptions({ agentMode: { id: 'ask', name: 'Ask', systemPrompt: 'PERSONA-RT-CLAUDE.', tools: ['Read', 'Glob'] } })
  assert.deepEqual(restricted.tools, ['Read', 'Glob'], 'allow-list → SDK tools restriction')
  assert.equal(restricted.persona, 'PERSONA-RT-CLAUDE.', 'persona → systemPrompt')
  // unset → tools undefined (option omitted → SDK default preset)
  assert.equal(buildClaudeAgentModeOptions({ agentMode: { tools: null } }).tools, undefined)
  // [] → deny-all passed through verbatim (SDK disables all built-ins)
  assert.deepEqual(buildClaudeAgentModeOptions({ agentMode: { tools: [] } }).tools, [])
})

test('runtime providers delegate to the shared payload builders (thin wiring guard)', () => {
  // Substance is behaviorally tested above; this only ensures the providers route
  // through the tested builders (so a revert to inline construction is caught).
  const read = rel => readFileSync(join(ROOT_DIR, rel), 'utf8')
  assert.match(read('src/main/chat/providers/claude.ts'), /buildClaudeAgentModeOptions\(req\)/, 'chatClaude must call buildClaudeAgentModeOptions')
  assert.match(read('src/main/chat/providers/codex.ts'), /buildCodexSpawnArgs\(/, 'chatCodex must call buildCodexSpawnArgs')
  assert.match(read('src/main/chat/providers/hermes.ts'), /buildHermesSpawnArgs\(/, 'chatHermes must call buildHermesSpawnArgs')
})

// ─── BLOCKING-1: agentId set + agentMode unresolved must FAIL CLOSED ───────────

test('runtime builders FAIL CLOSED when agentId is set but agentMode is unresolved (#BLOCKING-1)', () => {
  // The vulnerability: the renderer restores agentId synchronously but loads the
  // definition async, so a request can carry agentId (incl. a deny-all agent) with
  // agentMode still null. Every builder must throw rather than build an
  // unrestricted payload.
  const dangling = { agentId: 'restored-deny-all-agent', agentMode: null }
  const isUnresolvedErr = err => { assert.equal(err.message, runtimeAgentTools.AGENT_MODE_UNRESOLVED_ERROR); return true }
  assert.throws(() => buildHermesSpawnArgs({ ...dangling, mode: 'full', model: 'm', userContent: 'go' }), isUnresolvedErr)
  assert.throws(() => buildCodexSpawnArgs({ ...dangling, mode: 'default', model: 'm', userContent: 'go' }), isUnresolvedErr)
  assert.throws(() => buildClaudeAgentModeOptions(dangling), isUnresolvedErr)

  // No false positives: a RESOLVED agent launches; no agentId launches.
  assert.doesNotThrow(() => buildClaudeAgentModeOptions({ agentId: 'x', agentMode: { tools: ['Read'] } }))
  assert.doesNotThrow(() => buildClaudeAgentModeOptions({ agentMode: null }))
})

test('daemon: an unresolved agentMode FAILS CLOSED — claudeQuery never runs (#BLOCKING-1)', async t => {
  const homeDir = await makeTestTempDir('chat-jobs-agent-unresolved-')
  const workspaceDir = join(homeDir, 'workspace')
  await mkdirP(workspaceDir, { recursive: true })
  t.after(async () => { await rmP(homeDir, { recursive: true, force: true }) })

  let claudeInvoked = false
  const manager = createChatJobManager({
    homeDir,
    checkpointStore: { createCheckpoint() { return { ok: true, checkpoint: { id: 'c' } } } },
    claudeQuery: () => (async function* () {
      claudeInvoked = true
      yield { type: 'result', result: 'done', session_id: 's', total_cost_usd: 0, num_turns: 1 }
    })(),
  })

  // A restored selected agent (e.g. a deny-all Codex agent) sent during the load
  // window: agentId present, agentMode NOT yet resolved.
  const job = await manager.startJob({
    cardId: 'unresolved', workspaceId: 'unresolved-ws',
    provider: 'claude', model: 'claude-test', mode: 'bypassPermissions',
    workspaceDir, messages: [{ role: 'user', content: 'do the thing' }],
    agentId: 'restored-codex-deny-all',
    agentMode: null,
  })

  const completed = await waitForCompletedJob(manager, job.id)
  assert.equal(completed.status, 'failed', 'an unresolved agent must fail the job, not launch')
  assert.equal(completed.error, DAEMON_AGENT_MODE_UNRESOLVED_ERROR)
  assert.equal(claudeInvoked, false, 'claudeQuery must NEVER run for an unresolved agent (no unrestricted launch)')
})

test('daemon: a RESOLVED agent still launches (no false positive on the BLOCKING-1 guard)', async t => {
  const homeDir = await makeTestTempDir('chat-jobs-agent-resolved-')
  const workspaceDir = join(homeDir, 'workspace')
  await mkdirP(workspaceDir, { recursive: true })
  t.after(async () => { await rmP(homeDir, { recursive: true, force: true }) })

  let claudeInvoked = false
  const manager = createChatJobManager({
    homeDir,
    checkpointStore: { createCheckpoint() { return { ok: true, checkpoint: { id: 'c' } } } },
    claudeQuery: () => (async function* () {
      claudeInvoked = true
      yield { type: 'result', result: 'done', session_id: 's', total_cost_usd: 0, num_turns: 1 }
    })(),
  })

  const job = await manager.startJob({
    cardId: 'resolved', workspaceId: 'resolved-ws',
    provider: 'claude', model: 'claude-test', mode: 'bypassPermissions',
    workspaceDir, messages: [{ role: 'user', content: 'hi' }],
    agentId: 'ask',
    agentMode: { id: 'ask', name: 'Ask', systemPrompt: '', tools: ['Read', 'Glob', 'Grep'] },
  })

  const completed = await waitForCompletedJob(manager, job.id)
  assert.equal(completed.status, 'completed')
  assert.equal(claudeInvoked, true, 'a resolved agent must launch normally')
})

test('runtime ↔ daemon agentModeUnresolved + error agree (drift guard)', () => {
  assert.equal(
    runtimeAgentTools.AGENT_MODE_UNRESOLVED_ERROR,
    DAEMON_AGENT_MODE_UNRESOLVED_ERROR,
    'the unresolved-agent error string must match across the twin modules',
  )
  const cases = [
    { agentId: 'x', agentMode: null },
    { agentId: 'x', agentMode: undefined },
    { agentId: 'x' },
    { agentId: '', agentMode: null },
    { agentId: '   ', agentMode: null },
    { agentId: 'x', agentMode: { tools: [] } },
    { agentMode: null },
    {},
  ]
  for (const req of cases) {
    assert.equal(
      runtimeAgentTools.agentModeUnresolved(req),
      daemonAgentModeUnresolved(req),
      `agentModeUnresolved must agree for ${JSON.stringify(req)}`,
    )
  }
})

test('renderer: dispatchMessageContent refuses to dispatch an unresolved selected agent (#BLOCKING-1 renderer guard)', () => {
  // No React/DOM runner in this repo (see #4 note), so a source-slice guard stands
  // in: the guard must short-circuit BEFORE the chat.send dispatch when an agent is
  // selected but its definition has not resolved.
  const src = readFileSync(join(ROOT_DIR, 'src/renderer/src/hooks/useChatTileMessaging.ts'), 'utf8')
  const start = src.indexOf('const dispatchMessageContent = useCallback(')
  assert.ok(start >= 0, 'dispatchMessageContent useCallback must exist')
  const next = src.indexOf('\n  const ', start + 1)
  const block = src.slice(start, next > start ? next : undefined)
  const guardIdx = block.search(/if\s*\(\s*agentId\s*&&\s*!resolvedAgentMode\s*\)/)
  assert.ok(guardIdx >= 0, 'must guard agentId-set-but-unresolved')
  const sendIdx = block.indexOf('window.electron?.chat?.send')
  assert.ok(sendIdx >= 0 && guardIdx < sendIdx, 'the guard must precede the chat.send dispatch')
})

// ─── Hermes persona on resume (#1a) ───────────────────────────────────────────

test('Hermes: persona is RE-INJECTED on resumed turns, not dropped (#1a)', () => {
  const persona = 'HERMES-PERSONA-9911 act as a security auditor.'

  // First turn: persona present (alongside the output convention).
  const first = buildHermesTurnPrompt({ userContent: 'scan the repo', agentPersona: persona, isFirstTurn: true })
  assert.ok(first.includes(persona), 'persona must lead the first Hermes turn')
  assert.ok(first.includes('scan the repo'))

  // RESUMED turn: regression proof. The OLD code returned bare userContent on
  // resume (persona dropped → agent reverted to default mid-session). It must now
  // re-inject the persona so the agent definition stays enforced.
  const resumed = buildHermesTurnPrompt({ userContent: 'now fix it', agentPersona: persona, isFirstTurn: false })
  assert.ok(resumed.includes(persona), 'persona MUST be present on a resumed Hermes turn (the #1a fix)')
  assert.ok(resumed.includes('now fix it'))

  // No persona configured → resumed turn is exactly the user content (no noise).
  assert.equal(buildHermesTurnPrompt({ userContent: 'plain', agentPersona: undefined, isFirstTurn: false }), 'plain')
})

// ─── permission mode persistence round-trip (#2b) ─────────────────────────────

test('daemon: the chosen permission mode round-trips through job metadata (#2b)', async t => {
  const homeDir = await makeTestTempDir('chat-jobs-mode-roundtrip-')
  const workspaceDir = join(homeDir, 'workspace')
  await mkdirP(workspaceDir, { recursive: true })
  t.after(async () => { await rmP(homeDir, { recursive: true, force: true }) })

  const manager = createChatJobManager({
    homeDir,
    checkpointStore: { createCheckpoint() { return { ok: true, checkpoint: { id: 'c' } } } },
    claudeQuery: () => (async function* () {
      yield { type: 'result', result: 'done', session_id: 's', total_cost_usd: 0, num_turns: 1 }
    })(),
  })

  // WRITE side: startJob persists request.mode (was NEVER stored before #2b).
  const job = await manager.startJob({
    cardId: 'mode-rt', workspaceId: 'mode-rt-ws',
    provider: 'claude', model: 'claude-test', mode: 'read-only',
    workspaceDir, messages: [{ role: 'user', content: 'hi' }],
  })
  assert.equal(job.mode, 'read-only', 'startJob must persist request.mode into job metadata')

  await waitForCompletedJob(manager, job.id)
  const state = await manager.getJobState(job.id)
  assert.equal(state.mode, 'read-only', 'persisted job metadata retains the chosen mode')

  // READ side: codesurfd.reconstructSessionState restores the mode with this
  // fallback (mirrors codesurfd.mjs). A stored mode restores; a legacy job → default.
  const restore = metadata => (typeof metadata.mode === 'string' && metadata.mode ? metadata.mode : 'default')
  assert.equal(restore(state), 'read-only', 'reopening a session restores the stored mode (not hardcoded default)')
  assert.equal(restore({ provider: 'claude' }), 'default', 'a legacy job without a stored mode falls back to default')

  // Guard the read-back SITE: codesurfd must read metadata.mode, not hardcode it.
  const codesurfd = readFileSync(join(ROOT_DIR, 'packages/codesurf-daemon/bin/codesurfd.mjs'), 'utf8')
  assert.match(codesurfd, /mode:\s*typeof metadata\.mode === 'string'/, 'codesurfd must reconstruct mode from metadata.mode')
})

// ─── renderer permission-mode resolution (#2a) ────────────────────────────────

test('renderer: a change-then-send uses the LIVE mode, not the stale state ref (#2a)', () => {
  const codexModeIds = ['default', 'auto', 'read-only', 'full-access']

  // The regression scenario: the user switched to 'full-access' (live `mode`),
  // but the persisted-state ref still holds the previous 'default'. The send must
  // launch with the CHOSEN (live) mode.
  assert.equal(
    resolveActiveChatMode('full-access', 'default', codexModeIds, 'default'),
    'full-access',
    'live mode must win over the stale persisted-state mode',
  )

  // Live mode absent → fall back to persisted state mode.
  assert.equal(resolveActiveChatMode(undefined, 'read-only', codexModeIds, 'default'), 'read-only')

  // A mode invalid for the active provider (e.g. carried over from a provider
  // switch) is rejected in favor of the next valid candidate / the fallback.
  assert.equal(resolveActiveChatMode('plan', 'auto', codexModeIds, 'default'), 'auto')
  assert.equal(resolveActiveChatMode('plan', 'acceptEdits', codexModeIds, 'default'), 'default')
})

test('renderer: useChatTileMessaging passes the LIVE mode FIRST to resolveActiveChatMode (#2a wiring)', () => {
  // The resolver is order-sensitive: live mode must be the FIRST argument. Wire
  // it as resolveActiveChatMode(state?.mode, mode, …) and the stale-send bug
  // returns silently — this static guard fails if the live `mode` isn't first.
  const src = readFileSync(join(ROOT_DIR, 'src/renderer/src/hooks/useChatTileMessaging.ts'), 'utf8')
  assert.match(src, /resolveActiveChatMode\(\s*\n?\s*mode\s*,/, 'live `mode` must be the first arg to resolveActiveChatMode')
})

// ─── renderer: stale-closure deps guard (#4) ──────────────────────────────────
// The repo has no React/DOM test runner (no vitest/RTL/jsdom) and no eslint
// config, so a true render-and-resend test or react-hooks/exhaustive-deps lint
// can't run here. This static guard stands in for exhaustive-deps: it asserts the
// dispatchMessageContent useCallback dependency array lists both identifiers it
// reads when building the send payload. Drop either from deps (the #4 regression)
// and a stale/null agent could be sent — this test fails.

test('renderer: dispatchMessageContent deps include agentId + resolvedAgentMode (#4)', () => {
  const src = readFileSync(join(ROOT_DIR, 'src/renderer/src/hooks/useChatTileMessaging.ts'), 'utf8')

  const start = src.indexOf('const dispatchMessageContent = useCallback(')
  assert.ok(start >= 0, 'dispatchMessageContent useCallback must exist')
  // Slice from the callback start to the next top-level `const ` declaration; the
  // block then ends at this useCallback's closing `}, [ ...deps ])`.
  const next = src.indexOf('\n  const ', start + 1)
  const block = src.slice(start, next > start ? next : undefined)
  // The dependency array is the final `}, [ ... ]` of the block. `}, [` only
  // appears as the callback-body close, so lastIndexOf isolates the deps array.
  const depsOpen = block.lastIndexOf('}, [')
  assert.ok(depsOpen >= 0, 'must find the useCallback dependency array open')
  const depsClose = block.lastIndexOf(']')
  const deps = block.slice(depsOpen + '}, ['.length, depsClose)
  // The payload sends `agentId` and `resolvedAgentMode`; both must be deps.
  assert.match(deps, /\bagentId\b/, 'agentId must be in the dependency array')
  assert.match(deps, /\bresolvedAgentMode\b/, 'resolvedAgentMode must be in the dependency array')
})
