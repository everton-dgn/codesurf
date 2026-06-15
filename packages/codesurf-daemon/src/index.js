export {
  createDaemonManager,
  resolveDaemonScriptFromCandidates,
} from './manager.ts'

export {
  createDaemonClient,
} from './client.ts'

export {
  parseSseJsonBuffer,
} from './sse.ts'

export {
  chatCliSessionKey,
  chatCliSessionStorePath,
  clearChatCliSession,
  normalizeChatCliSessionIdentity,
  readChatCliSession,
  readChatCliSessionStore,
  upsertChatCliSession,
  writeChatCliSessionStore,
} from './chat-session-store.ts'

export {
  CODESURF_HOME,
  CODESURF_HOME_DIRNAME,
  DAEMON_PACKAGE_VERSION,
  defaultCodesurfHome,
} from './paths.ts'
