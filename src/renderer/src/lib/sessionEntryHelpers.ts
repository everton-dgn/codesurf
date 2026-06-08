import type { AggregatedSessionEntry, SessionEntryHint } from '../../../shared/session-types'

export function isRuntimeSessionEntryId(sessionEntryId: string): boolean {
  return sessionEntryId.startsWith('codesurf-runtime:')
    || sessionEntryId.startsWith('codesurf-tile:')
    || sessionEntryId.startsWith('codesurf-job:')
}

export function buildSessionEntryHint(session: AggregatedSessionEntry): SessionEntryHint {
  return {
    id: session.id,
    source: session.source,
    filePath: session.filePath,
    sessionId: session.sessionId,
    provider: session.provider,
    model: session.model,
    messageCount: session.messageCount,
    title: session.title,
    projectPath: session.projectPath ?? null,
  }
}