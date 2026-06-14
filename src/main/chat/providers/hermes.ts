import { spawn, execFileSync } from 'child_process'
import { getAgentPath, getShellEnvPath } from '../../agent-paths'
import {
  buildHermesChatArgs,
  sanitizeAgentCliDiagnostic,
} from '../../agents/agent-cli-contracts'
import { buildCodeSurfOutputConvention, joinPromptSections } from '../prompt-conventions'
import { resolveAgentToolAllowList, hermesToolsetsFromAllowList } from '../agent-mode-tools'
import {
  activeProcesses,
  getPreparedMessages,
  log,
  sendStream,
} from '../runtime'
import type { ChatRequest } from '../types'

// Store hermes session IDs for multi-turn resume
const hermesSessionIds = new Map<string, string>()

function resolveHermesBinary(): string | null {
  const detected = getAgentPath('hermes')
  if (detected) return detected
  try {
    const shellPath = getShellEnvPath()
    return execFileSync('which', ['hermes'], {
      encoding: 'utf-8',
      env: { ...process.env, ...(shellPath && { PATH: shellPath }) },
    }).trim() || null
  } catch {
    return null
  }
}

export function clearHermesSession(cardId: string): void {
  hermesSessionIds.delete(cardId)
}

export function chatHermes(req: ChatRequest): void {
  const lastUserMsg = [...getPreparedMessages(req)].reverse().find(m => m.role === 'user')
  if (!lastUserMsg) {
    sendStream(req.cardId, { type: 'error', error: 'No user message' })
    return
  }

  const hermesBin = resolveHermesBinary()
  if (!hermesBin) {
    sendStream(req.cardId, { type: 'error', error: 'Hermes CLI not found. Install: pip install hermes-agent' })
    return
  }

  const shellPath = getShellEnvPath()
  if (req.sessionId && !hermesSessionIds.has(req.cardId)) {
    hermesSessionIds.set(req.cardId, req.sessionId)
  }
  const existingSessionId = hermesSessionIds.get(req.cardId)

  log('chatHermes starting', {
    model: req.model,
    prompt: lastUserMsg.content.slice(0, 100),
    resuming: !!existingSessionId,
  })

  // Map mode to hermes toolsets
  const modeMap: Record<string, string> = {
    'full': 'terminal,file,web,browser',
    'terminal': 'terminal,file',
    'web': 'web,browser',
    'query': '',
  }
  // AgentMode.tools allow-list → Hermes toolset categories when present (Hermes
  // gates by coarse category, not per-tool; null/absent falls back to the mode
  // mapping; [] yields '' = query-only deny-all).
  const agentToolsets = hermesToolsetsFromAllowList(resolveAgentToolAllowList(req.agentMode))
  const toolsets = agentToolsets ?? (modeMap[req.mode ?? ''] ?? 'terminal,file,web')

  // Hermes requires the `chat` subcommand for non-interactive prompts.
  // We request NDJSON event streaming via `--stream-json` so tool calls,
  // text deltas, and thinking blocks surface in real time (the old `--quiet`
  // mode nulled Hermes' streaming callbacks and the UI went silent until
  // the final response). Provider-prefixed CodeSurf model ids (for example
  // openai-codex/gpt-5.5) are split into Hermes' separate --provider /
  // --model flags by the shared contract helper.
  //
  // First-turn injection: Hermes has no system-prompt flag, so the CodeSurf
  // output convention rides along with the first user message. Session
  // history carries it forward on subsequent turns.
  // Persona (AgentMode.systemPrompt) has no Hermes flag, so — like the output
  // convention — it rides along on the first user message and the session
  // history carries it forward on later turns.
  const agentPersona = req.agentMode?.systemPrompt?.trim() || undefined
  const hermesIsFirstTurn = !existingSessionId
  const hermesPrompt = hermesIsFirstTurn
    ? `${joinPromptSections(agentPersona, buildCodeSurfOutputConvention())}\n\n---\n\n${lastUserMsg.content}`
    : lastUserMsg.content
  const args = buildHermesChatArgs({
    prompt: hermesPrompt,
    model: req.model,
    resumeSessionId: existingSessionId,
    toolsets,
    streamJson: true,
  })

  const proc = spawn(hermesBin, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(shellPath && { PATH: shellPath }) },
    ...(req.workspaceDir && { cwd: req.workspaceDir }),
  })

  activeProcesses.set(req.cardId, proc)

  // H-9: identity-guard — only clean up / emit done|error if this proc is
  // still the active one for this card. A rapid re-send replaces the map
  // entry before the old proc's close handler fires, so we must check first.
  const isCurrent = (): boolean => activeProcesses.get(req.cardId) === proc

  // NDJSON line dispatcher. Hermes' --stream-json mode emits one JSON event
  // per line on stdout, mapping directly to CodeSurf's existing stream event
  // schema (type: text | thinking | tool_start | tool_input | tool_summary
  // | session | error | done). Unparseable lines are treated as raw text so
  // an older Hermes binary that doesn't recognise --stream-json (and falls
  // through to plain output) still produces *something* in the UI rather
  // than silence.
  let stdoutBuf = ''
  const dispatchHermesEvents = (chunk: string, flushPartial = false): void => {
    stdoutBuf += chunk
    const lines = stdoutBuf.split(/\r?\n/)
    stdoutBuf = flushPartial ? '' : (lines.pop() ?? '')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Legacy fallback: plain "session_id: …" sentinel from a binary
      // without --stream-json. Surface it the way the old streamer did.
      const sessionLineMatch = trimmed.match(/^(?:session_id|session)\s*:\s*(\S+)$/i)
      if (sessionLineMatch?.[1]) {
        const sid = sessionLineMatch[1]
        hermesSessionIds.set(req.cardId, sid)
        sendStream(req.cardId, { type: 'session', sessionId: sid })
        continue
      }

      let evt: any
      try {
        evt = JSON.parse(trimmed)
      } catch {
        sendStream(req.cardId, { type: 'text', text: line + '\n' })
        continue
      }
      if (!evt || typeof evt !== 'object' || typeof evt.type !== 'string') {
        continue
      }

      switch (evt.type) {
        case 'session':
          if (typeof evt.sessionId === 'string' && evt.sessionId.trim()) {
            const sid = evt.sessionId.trim()
            hermesSessionIds.set(req.cardId, sid)
            sendStream(req.cardId, { type: 'session', sessionId: sid })
          }
          break
        case 'text':
          if (typeof evt.text === 'string') {
            sendStream(req.cardId, { type: 'text', text: evt.text })
          }
          break
        case 'thinking':
          if (typeof evt.text === 'string') {
            sendStream(req.cardId, { type: 'thinking', text: evt.text })
          }
          break
        case 'tool_start':
          sendStream(req.cardId, {
            type: 'tool_start',
            toolId: typeof evt.toolId === 'string' ? evt.toolId : undefined,
            toolName: typeof evt.toolName === 'string' ? evt.toolName : 'tool',
          })
          break
        case 'tool_input':
          sendStream(req.cardId, {
            type: 'tool_input',
            toolId: typeof evt.toolId === 'string' ? evt.toolId : undefined,
            text: typeof evt.text === 'string' ? evt.text : '',
          })
          break
        case 'tool_summary':
          sendStream(req.cardId, {
            type: 'tool_summary',
            toolId: typeof evt.toolId === 'string' ? evt.toolId : undefined,
            toolName: typeof evt.toolName === 'string' ? evt.toolName : undefined,
            text: typeof evt.text === 'string' ? evt.text : '',
          })
          break
        case 'error':
          sendStream(req.cardId, {
            type: 'error',
            error: typeof evt.error === 'string' ? evt.error : 'Unknown Hermes error',
          })
          break
        case 'done':
          // Suppressed here — emitted from proc.on('close') below so we
          // always get a final 'done' even if Hermes exits mid-stream.
          break
        default:
          // Forward unrecognized event verbatim; the renderer can filter.
          sendStream(req.cardId, evt as Record<string, unknown>)
      }
    }
  }

  proc.stdout?.on('data', (chunk: Buffer) => {
    dispatchHermesEvents(chunk.toString(), false)
  })

  let stderrBuf = ''
  proc.stderr?.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString() })

  proc.on('close', (code) => {
    if (!isCurrent()) return // superseded by a new turn — suppress stale done/error
    dispatchHermesEvents('', true)
    activeProcesses.delete(req.cardId)
    if (code !== 0 && stderrBuf.trim()) {
      sendStream(req.cardId, { type: 'error', error: sanitizeAgentCliDiagnostic(stderrBuf.trim()) })
    }
    sendStream(req.cardId, { type: 'done' })
  })

  proc.on('error', (err) => {
    if (!isCurrent()) return // superseded — new turn owns the slot
    activeProcesses.delete(req.cardId)
    sendStream(req.cardId, {
      type: 'error',
      error: err.message.includes('ENOENT')
        ? 'Hermes CLI not found. Install: pip install hermes-agent'
        : err.message,
    })
  })
}