import type { ChatMessage } from '../../../../shared/chat-types'
import type { SessionEntryHint } from '../../../../shared/session-types'
import type { ActiveChatSurface, PendingAttachment } from './chatTileUtils'

export interface CheckpointRestoreContextValue {
  workspaceId: string | null
  tileId: string
  restoringCheckpointId: string | null
  restoreCheckpoint: (checkpointId: string, sessionEntryId: string, label?: string) => Promise<void>
}

export interface QueuedChatTurn {
  id: string
  content: string
  preview: string
  attachmentCount: number
  createdAt: number
  /** Optional parent turn id — when set, this turn renders indented beneath
   *  its parent as a sub-item, representing work the user intends to run
   *  *as part of* the parent turn rather than as its own top-level turn. */
  parentId?: string | null
}

export interface ChatTilePersistedState {
  messages: ChatMessage[]
  input: string
  attachments: PendingAttachment[]
  queuedTurns?: QueuedChatTurn[]
  openChatSurfaces?: ActiveChatSurface[]
  activeChatSurfaceId?: string | null
  provider: string
  model: string
  mcpEnabled: boolean
  mode: string
  thinking: string
  agentMode: boolean
  autoAgentMode: boolean
  preserveSessionSummary?: boolean
  linkedSessionEntryId?: string | null
  linkedSessionHint?: SessionEntryHint | null
  hasEarlierMessages?: boolean
  sessionId: string | null
  jobId?: string | null
  jobSequence?: number
  cloudHostId?: string | null
  isStreaming: boolean
  executionTarget?: 'local' | 'cloud'
}