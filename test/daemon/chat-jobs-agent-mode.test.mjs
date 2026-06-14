// Verifies the agent-definition (AgentMode) wiring end-to-end on the daemon:
//  - harness path: AgentMode.systemPrompt reaches makeAgent({ instructions }),
//    AgentMode.tools allow-list denies a disallowed tool (and a downgrade of an
//    allow-all permission mode so the deny can fire), an allowed tool still asks.
//  - claude SDK path: AgentMode.systemPrompt reaches options.agents.contex.prompt
//    and AgentMode.tools reaches options.tools (the SDK's built-in restriction).
//  - isToolAllowedByAgent casing/normalization.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { mkdtemp as mkdtempP, mkdir as mkdirP, rm as rmP } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createHarnessRunner,
  isToolAllowedByAgent,
} from '../../packages/codesurf-daemon/bin/harness-runtime.mjs'
import { createChatJobManager } from '../../bin/chat-jobs.mjs'

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

test('isToolAllowedByAgent: null/empty allow-list permits everything', () => {
  assert.equal(isToolAllowedByAgent('Write', null), true)
  assert.equal(isToolAllowedByAgent('Write', []), true)
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
