export {
  createDaemonManager,
  resolveDaemonScriptFromCandidates,
  type DaemonManager,
  type DaemonManagerConfig,
  type DaemonStatusInfo,
} from './manager'

export {
  createDaemonClient,
  type DaemonClient,
  type DaemonClientHooks,
  type RequestOptions,
  type StreamJobEventsOptions,
} from './client'

export {
  parseSseJsonBuffer,
  type ParsedSseJsonBuffer,
} from './sse'

export {
  chatCliSessionKey,
  chatCliSessionStorePath,
  clearChatCliSession,
  normalizeChatCliSessionIdentity,
  readChatCliSession,
  readChatCliSessionStore,
  upsertChatCliSession,
  writeChatCliSessionStore,
  type ChatCliSession,
  type ChatCliSessionIdentity,
  type ChatCliSessionStore,
} from './chat-session-store'

export {
  CODESURF_HOME,
  CODESURF_HOME_DIRNAME,
  DAEMON_PACKAGE_VERSION,
  defaultCodesurfHome,
} from './paths'

export type {
  AggregatedSessionEntry,
  AutoDreamPolicySummary,
  AutoDreamSettings,
  DaemonAppSettings,
  DaemonChatJobEvent,
  DaemonChatJobRequest,
  DaemonChatJobState,
  DaemonChatJobStatus,
  DaemonChatMessage,
  DaemonChatPermissionAnswer,
  DaemonSkillEntry,
  DaemonSkillIndex,
  DaemonSkillSkippedLocation,
  DaemonSkillRoot,
  DaemonSkillSelection,
  DaemonToolPermissionGrant,
  DaemonToolPermissionDecision,
  DaemonToolPermissionListResult,
  DaemonToolPermissionRequest,
  DaemonToolPermissionScope,
  DashboardDreamingSummary,
  DreamRunSummary,
  ExecutionHostRecord,
  ExecutionHostType,
  ProjectRecord,
  SessionScope,
  SessionSource,
  Workspace,
} from './types'
