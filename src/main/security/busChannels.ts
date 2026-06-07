import type { BusEventType } from '../../shared/types.ts'

const MAX_LEN = 160
const SAFE_TOKEN = /^[a-zA-Z0-9:_*-]+$/

const BUS_EVENT_TYPES = new Set<BusEventType>([
  'progress',
  'activity',
  'task',
  'notification',
  'ask',
  'answer',
  'data',
  'system',
])

export function assertSafeBusToken(value: string, label: string): string {
  const token = String(value ?? '').trim()
  if (!token || token.length > MAX_LEN) throw new Error(`Invalid ${label}`)
  if (!SAFE_TOKEN.test(token)) throw new Error(`Invalid ${label}`)
  if (token.includes('..')) throw new Error(`Invalid ${label}`)
  return token
}

export function assertSafeBusChannel(channel: string, options?: { allowWildcard?: boolean }): string {
  const safe = assertSafeBusToken(channel, 'bus channel')
  if (!options?.allowWildcard && safe.includes('*')) {
    throw new Error('Wildcards are not allowed in bus publish channels')
  }
  return safe
}

export function assertSafeBusEventType(type: string): BusEventType {
  const safe = String(type ?? '').trim() as BusEventType
  if (!BUS_EVENT_TYPES.has(safe)) throw new Error('Invalid bus event type')
  return safe
}

function extractScopedId(source: string): string | null {
  const match = source.match(/^(?:browser|terminal|chat|tile|extension|kanban|image):([^:*]+)$/)
  return match?.[1] ?? null
}

function channelMatchesSourceScope(channel: string, source: string): boolean {
  const scopedId = extractScopedId(source)
  if (!scopedId) return true

  const allowed = new Set([
    `tile:${scopedId}`,
    `ctx:${scopedId}`,
    `card:${scopedId}`,
    `browser:${scopedId}`,
    `terminal:${scopedId}`,
    `chat:${scopedId}`,
    `kanban:${scopedId}`,
    `image:${scopedId}`,
  ])

  if (allowed.has(channel)) return true

  for (const prefix of allowed) {
    if (channel.startsWith(`${prefix}:`)) return true
  }

  return false
}

export function assertBusPublishAllowed(channel: string, source: string, type: string): {
  channel: string
  source: string
  type: BusEventType
} {
  return {
    channel: assertSafeBusChannel(channel),
    source: assertSafeBusToken(source, 'bus source'),
    type: assertSafeBusEventType(type),
  }
}

export function assertBusPublishScope(channel: string, source: string): void {
  if (!channelMatchesSourceScope(channel, source)) {
    throw new Error('Bus publish channel is outside source scope')
  }
}

export function assertBusSubscribeAllowed(channel: string, subscriberId: string): {
  channel: string
  subscriberId: string
} {
  return {
    channel: assertSafeBusChannel(channel, { allowWildcard: true }),
    subscriberId: assertSafeBusToken(subscriberId, 'bus subscriber'),
  }
}