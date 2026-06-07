import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type {
  AppSettings,
  SkillDefinition,
} from '../../../shared/types'
import { basename, getDroppedPaths, isImagePath } from '../utils/dnd'

import { CODESURF_OPEN_CHAT_SURFACE_EVENT, normalizeOpenChatSurfaceDetail } from '../utils/appLaunchRequests'

import { useChatGitState } from '../hooks/useChatGitState'
import { useMCPServers } from '../hooks/useMCPServers'
import { useAutoSpeak, bargeIn } from '../hooks/useAutoSpeak'
import { ttsPlayer, type TtsPlayerState } from '../utils/ttsPlayer'
import { useChatDictation } from '../hooks/useChatDictation'
import { useChatExecutionHosts } from '../hooks/useChatExecutionHosts'
import { useChatTileCoreState } from '../hooks/useChatTileCoreState'
import { useChatTileProviders } from '../hooks/useChatTileProviders'
import { useChatTilePersistence } from '../hooks/useChatTilePersistence'
import { useChatTileMessaging } from '../hooks/useChatTileMessaging'
import { useChatTileTranscript } from '../hooks/useChatTileTranscript'
import { useChatTileBlockNotes } from '../hooks/useChatTileBlockNotes'

import { useTheme } from '../ThemeContext'

import { useChatTileLatestChangeDrawer } from '../hooks/useChatTileLatestChangeDrawer'
import { useChatTileComposerMenus } from '../hooks/useChatTileComposerMenus'
import { useChatTileLiveComposerActivity } from '../hooks/useChatTileLiveComposerActivity'
import type { CheckpointRestoreContextValue } from './chat/chatTileTypes'
import { ChatTileTranscriptColumn } from './chat/ChatTileTranscriptColumn'
import { normalizeMessagesForMemory, estimateMessageChars } from './chat/messageNormalization'
import {
  getApproxContextWindowTokens,
  getApproxSystemOverheadTokens,
} from '../config/providers'
import { stripCapabilityPrefix, getAllNodeTools } from '../../../shared/nodeTools'
import type { ChatMessage } from '../../../shared/chat-types'
import { useChatStreamHandler } from '../hooks/useChatStreamHandler'



import { setChatStreaming } from './chatStreamingStore'
import { setTileTodos, clearTileTodos, useTileTodos, type TileTodoItem } from '../state/tileTodosStore'
import { CUSTOMISATION_LOCATIONS_CHANGED_EVENT, type CustomisationLocationsChangedDetail } from './CustomisationTile'
import { PlanPane } from './chat/PlanPane'
import { ChatTileComposer } from './chat/ChatTileComposer'

import { ToolPermissionProvider } from './ai-elements/ToolPermission'
import { handleBasicChatSurfaceRpc } from './chatSurfaceHostRpc'
import { DREAM_TOOL_ID_PREFIX, DREAM_TOOL_NAME } from './chat/dreamToolActions'
import { CHAT_STREAM_FLUSH_INTERVAL_MS } from './chat/largeContent'
import { useChatAutocomplete, CHAT_SLASH_COMMANDS, type AutocompleteItem } from '../hooks/useChatAutocomplete'
import { useContributions } from '../hooks/useContributions'
import { type PaletteCommand } from '../lib/commandRegistry'
import { type ChatSurfaceMenuEntry } from './chat/ChatComposerMenus'
import {
  AskUserQuestionContext,
  AskUserQuestionFontsContext,
} from './chat/AskUserQuestionForm'
import { parsePlanToolTodos } from './chat/ToolBlockView'
import {
  normalizeChatSurfaceMenuEntry,
  ensureChatMdStyle,
} from './chat/ChatTileViews'
import {
  FONT_SANS,
  FONT_MONO,
  FONT_SIZE_DEFAULT,
  MONO_SIZE_DEFAULT,
  CHAT_COMPOSER_TEXTAREA_MIN_HEIGHT,

  LIVE_TOOL_COLLAPSE_GRACE_MS,
} from './chat/chatTileLayout'
import { FontCtx } from './chat/chatTileContexts'
import {
  CHAT_DEFAULT_SKILL_LOCATIONS,
  resolveChatSkillLocations,
  getImplicitPeerImageAttachments,
  collectModelReadPaths,
  canUsePagedLinkedHistory,
  type ActiveChatSurface,
  type DiscoveryPeer,
} from './chat/chatTileUtils'

export {
  hasVisibleFileChangeStats,
  hasRenderableFileChangeDiff,
  getToolDisplayName,
} from './chat/chatTileUtils'

// --- Types -----------------------------------------------------------------------

interface Props {
  tileId: string
  workspaceId: string
  workspaceDir: string
  width: number
  height: number
  reloadToken?: number
  settings?: AppSettings
  onChatModePreferenceChange?: (providerId: string, modeId: string) => void
  isConnected?: boolean
  isAutoConnected?: boolean
  connectedPeers?: DiscoveryPeer[]
}

export type { CheckpointRestoreContextValue } from './chat/chatTileTypes'

export const CheckpointRestoreContext = React.createContext<CheckpointRestoreContextValue | null>(null)

export const TOOL_BLOCK_MAX_WIDTH = 420

export const NON_SELECTABLE_UI_STYLE = {
  userSelect: 'none' as const,
  WebkitUserSelect: 'none' as const,
}

// Dispatch context — lets deeply-nested tool renderers (e.g. AskUserQuestion form)
// send answers back into the chat as the next user turn.
type ChatDispatchValue = {
  sendAnswer: (text: string) => void | Promise<void>
}
const ChatDispatchCtx = React.createContext<ChatDispatchValue | null>(null)

// --- Component -------------------------------------------------------------------

export function ChatTile({ tileId, workspaceId, workspaceDir: _workspaceDir, width: _width, height: _height, reloadToken = 0, settings, onChatModePreferenceChange, isConnected, isAutoConnected, connectedPeers = [] }: Props): JSX.Element {
  const theme = useTheme()
  const chatViewportBackground = theme.surface.panel
  const composerBackground = theme.mode === 'dark'
    ? theme.chat.input
    : `color-mix(in srgb, ${theme.surface.panelMuted} 82%, ${theme.chat.input})`
  const composerBorder = theme.chat.inputBorder
  const fontSans = settings?.fonts?.primary?.family ?? settings?.primaryFont?.family ?? FONT_SANS
  const fontMono = settings?.fonts?.mono?.family ?? settings?.monoFont?.family ?? FONT_MONO
  const fontSize = settings?.fonts?.primary?.size ?? settings?.primaryFont?.size ?? FONT_SIZE_DEFAULT
  const fontLineHeight = settings?.fonts?.primary?.lineHeight ?? 1.5
  const fontWeight = settings?.fonts?.primary?.weight ?? 400
  const monoSize = settings?.fonts?.mono?.size ?? settings?.monoFont?.size ?? MONO_SIZE_DEFAULT
  const monoLineHeight = settings?.fonts?.mono?.lineHeight ?? 1.5
  const monoWeight = settings?.fonts?.mono?.weight ?? 400
  const fontSecondary = settings?.fonts?.secondary?.family ?? settings?.secondaryFont?.family ?? FONT_SANS
  const secondarySize = settings?.fonts?.secondary?.size ?? 11
  const secondaryLineHeight = settings?.fonts?.secondary?.lineHeight ?? 1.4
  const secondaryWeight = settings?.fonts?.secondary?.weight ?? 400
  const chatSurfaceThemeColors = useMemo(() => ({
    background: theme.surface.panelElevated,
    panel: theme.surface.panelElevated,
    border: theme.border.default,
    text: theme.chat.text,
    muted: theme.chat.muted,
    accent: theme.accent.base,
    mode: theme.mode,
    success: theme.status.success,
    warning: theme.status.warning,
    danger: theme.status.danger,
  }), [theme])
  const chatSurfaceThemeVars = useMemo(() => ({
    '--ct-mode': theme.mode,
    '--ct-bg': 'transparent',
    '--ct-panel': theme.surface.panelElevated,
    '--ct-panel-2': theme.surface.overlay,
    '--ct-border': theme.border.default,
    '--ct-border-2': theme.border.strong,
    '--ct-text': theme.chat.text,
    '--ct-muted': theme.chat.textSecondary,
    '--ct-dim': theme.chat.muted,
    '--ct-hover': theme.surface.hover,
    '--ct-accent': theme.accent.base,
    '--ct-accent-s': theme.accent.soft,
    '--ct-success': theme.status.success,
    '--ct-warning': theme.status.warning,
    '--ct-danger': theme.status.danger,
    '--ct-radius': '8px',
    '--ct-font-primary': fontSans,
    '--ct-font-primary-size': `${fontSize}px`,
    '--ct-font-primary-line': String(fontLineHeight),
    '--ct-font-primary-weight': String(fontWeight),
    '--ct-font-secondary': fontSecondary,
    '--ct-font-secondary-size': `${secondarySize}px`,
    '--ct-font-secondary-line': String(secondaryLineHeight),
    '--ct-font-secondary-weight': String(secondaryWeight),
    '--ct-font-sans': fontSans,
    '--ct-font-mono': fontMono,
    '--ct-font-size': `${fontSize}px`,
    '--ct-font-line': String(fontLineHeight),
    '--ct-font-weight': String(fontWeight),
    '--ct-font-subtle': fontSecondary,
    '--ct-font-subtle-size': `${secondarySize}px`,
    '--ct-font-subtle-line': String(secondaryLineHeight),
    '--ct-font-subtle-weight': String(secondaryWeight),
    '--ct-font-title': fontSans,
    '--ct-font-title-size': `${fontSize}px`,
    '--ct-font-title-weight': String(Math.max(fontWeight, 600)),
  }), [fontLineHeight, fontMono, fontSans, fontSecondary, fontSize, fontWeight, secondaryLineHeight, secondarySize, secondaryWeight, theme])
  const {
    initialRuntimeStateRef, initialMode, initialJobSequence,
    messages, setMessages, input, setInput, isStreaming, setIsStreaming,
    executionTarget, setExecutionTarget, cloudHostId, setCloudHostId,
    provider, setProvider, model, setModel, mcpEnabled, setMcpEnabled,
    mode, setMode, thinking, setThinking, autoAgentMode, setAutoAgentMode,
    attachments, setAttachments, queuedTurns, setQueuedTurns,
    openChatSurfaces, setOpenChatSurfaces, activeChatSurfaceId, setActiveChatSurfaceId,
    sessionId, setSessionId, jobId, setJobId, jobSequence, setJobSequence,
    linkedSessionEntryId, setLinkedSessionEntryId, linkedSessionHint, setLinkedSessionHint,
    preserveSessionSummary, setPreserveSessionSummary, hasEarlierMessages, setHasEarlierMessages,
    lastActivityAtRef, toolCollapseTick, setToolCollapseTick, explodedChipGroups, toggleExplodedChipGroup,
    pendingToolPermissions, setPendingToolPermissions, resolvedToolPermissions, setResolvedToolPermissions,
    handleToolPermissionDecision, toolCompletedAtRef,
  } = useChatTileCoreState({ tileId, settings })
  const [workspaceSkills, setWorkspaceSkills] = useState<SkillDefinition[]>([])
  const mcpServers = useMCPServers()
  const [disabledServers, setDisabledServers] = useState<Set<string>>(new Set())
  const peerToolNames = useMemo(() => {
    const discovered = new Set<string>()
    const validTool = new Set(getAllNodeTools().map(tool => tool.name))

    for (const peer of connectedPeers) {
      for (const cap of peer.capabilities) {
        if (!cap.startsWith('tool:')) continue
        const toolName = stripCapabilityPrefix(cap)
        if (toolName && validTool.has(toolName)) {
          discovered.add(toolName)
        }
      }
      // Extension actions are not in the static node tool set — include them directly
      if (peer.actions) {
        for (const action of peer.actions) {
          if (action.name) discovered.add(action.name)
        }
      }
    }

    return Array.from(discovered).sort()
  }, [connectedPeers])

  const availableToolInventory = useMemo(() => {
    const items: Array<{ id: string; label: string; source: 'builtin' | 'peer' | 'mcp-server'; detail?: string }> = []
    const seen = new Set<string>()

    for (const tool of getAllNodeTools()) {
      if (seen.has(`builtin:${tool.name}`)) continue
      seen.add(`builtin:${tool.name}`)
      items.push({
        id: `builtin:${tool.name}`,
        label: tool.name,
        source: 'builtin',
        detail: tool.description,
      })
    }

    if (mcpEnabled) {
      for (const server of mcpServers) {
        const key = `mcp-server:${server.name}`
        if (seen.has(key)) continue
        seen.add(key)
        items.push({
          id: key,
          label: server.name,
          source: 'mcp-server',
          detail: server.url ? 'http server' : 'stdio server',
        })
      }

      for (const toolName of peerToolNames) {
        const key = `peer:${toolName}`
        if (seen.has(key)) continue
        seen.add(key)
        items.push({
          id: key,
          label: toolName,
          source: 'peer',
          detail: 'Connected peer tool',
        })
      }
    }

    return items.sort((a, b) => {
      const sourceOrder = { builtin: 0, peer: 1, 'mcp-server': 2 }
      const sourceDelta = sourceOrder[a.source] - sourceOrder[b.source]
      if (sourceDelta !== 0) return sourceDelta
      return a.label.localeCompare(b.label)
    })
  }, [mcpEnabled, mcpServers, peerToolNames])

  const availableSkillInventory = useMemo(() => {
    const items: Array<{ id: string; name: string; enabled: boolean; source: 'workspace' | 'command'; description?: string }> = []
    const seen = new Set<string>()

    for (const skill of workspaceSkills) {
      const key = `workspace:${skill.name}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push({
        id: skill.id || key,
        name: skill.name,
        enabled: true,
        source: 'workspace',
        description: skill.description,
      })
    }

    for (const command of CHAT_SLASH_COMMANDS) {
      const key = `command:${command.value}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push({
        id: key,
        name: command.value,
        enabled: true,
        source: 'command',
        description: command.description,
      })
    }

    return items.sort((a, b) => {
      const sourceOrder = { workspace: 0, command: 1 }
      const sourceDelta = sourceOrder[a.source] - sourceOrder[b.source]
      if (sourceDelta !== 0) return sourceDelta
      return a.name.localeCompare(b.name)
    })
  }, [workspaceSkills])

  // Track current context values published by peer extension tiles
  const peerContextRef = useRef<Map<string, Record<string, unknown>>>(new Map())
  const [peerContextVersion, setPeerContextVersion] = useState(0)
  const connectedPeerSignature = useMemo(
    () => connectedPeers.map(peer => peer.peerId).sort().join('|'),
    [connectedPeers],
  )
  const implicitPeerImageAttachments = useMemo(
    () => getImplicitPeerImageAttachments(connectedPeers),
    [connectedPeers],
  )

  useEffect(() => {
    if (!workspaceId || connectedPeers.length === 0 || !window.electron?.tileContext) {
      if (peerContextRef.current.size > 0) {
        peerContextRef.current = new Map()
        setPeerContextVersion(v => v + 1)
      }
      return
    }

    let cancelled = false

    void Promise.all(connectedPeers.map(async (peer) => {
      const entries = await window.electron.tileContext?.getAll(workspaceId, peer.peerId, 'ctx:') ?? []
      return [peer.peerId, Array.isArray(entries) ? entries : []] as const
    })).then((results) => {
      if (cancelled) return
      const next = new Map<string, Record<string, unknown>>()
      for (const [peerId, entries] of results) {
        const values: Record<string, unknown> = {}
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue
          const contextEntry = entry as { key?: unknown; value?: unknown }
          if (typeof contextEntry.key !== 'string') continue
          values[contextEntry.key] = contextEntry.value
        }
        next.set(peerId, values)
      }
      peerContextRef.current = next
      setPeerContextVersion(v => v + 1)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [workspaceId, connectedPeerSignature])

  useEffect(() => {
    if (!window.electron?.bus) return
    const unsubs: Array<() => void> = []

    for (const peer of connectedPeers) {
      const channel = `ctx:${peer.peerId}`
      const subscriberId = `chat:${tileId}:peer-ctx:${peer.peerId}`
      const unsubscribe = window.electron.bus.subscribe(channel, subscriberId, (event: any) => {
        const p = event?.payload ?? event
        if (p?.action === 'context_changed' && p.key) {
          const existing = peerContextRef.current.get(peer.peerId) ?? {}
          peerContextRef.current.set(peer.peerId, { ...existing, [p.key]: p.value })
          setPeerContextVersion(v => v + 1)
        }
      })
      if (typeof unsubscribe === 'function') unsubs.push(unsubscribe)
    }

    return () => { for (const u of unsubs) u() }
  }, [connectedPeerSignature, tileId])
  // Tracks the permission mode we last pushed to the running Claude query so
  // user-initiated mid-stream mode switches (Default -> Bypass etc.) propagate
  // into the active canUseTool closure via chat:setPermissionMode.
  const lastPushedModeRef = useRef<string>(initialMode)
  const effectiveAgentMode = Boolean(isConnected || isAutoConnected || autoAgentMode)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const acRef = useRef<HTMLDivElement>(null)
  const closeProviderMenuRef = useRef<() => void>(() => {})
  const closeAutocompleteRef = useRef<() => void>(() => {})
  const {
    providerEntries,
    providerEntryById,
    currentProviderEntry,
    modeOptions,
    currentMode,
    optionNoun,
    currentModel,
    thinkingOptions,
    handleProviderChange,
  } = useChatTileProviders({
    provider,
    setProvider,
    model,
    setModel,
    mode,
    setMode,
    thinking,
    setThinking,
    settings,
    connectedPeers,
    peerContextRef,
    peerContextVersion,
    onProviderChanged: () => closeProviderMenuRef.current(),
  })
  const {
    showModelMenu,
    setShowModelMenu,
    showProviderMenu,
    setShowProviderMenu,
    showInsertMenu,
    setShowInsertMenu,
    showModeMenu,
    setShowModeMenu,
    showThinkingMenu,
    setShowThinkingMenu,
    showLocationMenu,
    setShowLocationMenu,
    showBranchMenu,
    setShowBranchMenu,
    showContextMenu,
    modelFilter,
    setModelFilter,
    branchFilter,
    setBranchFilter,
    modelMenuRef,
    providerMenuRef,
    insertMenuRef,
    modeMenuRef,
    thinkingMenuRef,
    locationMenuRef,
    branchMenuRef,
    contextMenuRef,
    toggleMenu,
  } = useChatTileComposerMenus({
    textareaRef,
    acRef,
    onCloseAutocomplete: () => closeAutocompleteRef.current(),
  })
  closeProviderMenuRef.current = () => setShowProviderMenu(false)
  const pagedLinkedHistoryEnabled = canUsePagedLinkedHistory(linkedSessionEntryId, linkedSessionHint, sessionId)

  // Publish this tile's streaming state so the sidebar can swap the row icon
  // for a spinner while the thread is active.
  useEffect(() => {
    setChatStreaming(tileId, isStreaming, { sessionId, entryId: linkedSessionEntryId })
    return () => { setChatStreaming(tileId, false) }
  }, [tileId, isStreaming, sessionId, linkedSessionEntryId])
  const { localExecutionLabel, remoteHosts, activeCloudHost, executionDisplayLabel, executionDisplayDetail } = useChatExecutionHosts({
    executionPreference: settings?.execution ?? null,
    executionTarget,
    cloudHostId,
  })
  const hasSendableDraft = input.trim().length > 0 || attachments.length > 0 || implicitPeerImageAttachments.length > 0
  // Chat-surface extensions (e.g. Sketch, Builder) mounted above the composer.
  // Multiple surfaces can stay open as tabs so a sketch can sit beside its
  // enhanced builder output inside the same chat.
  const [chatSurfaceMenu, setChatSurfaceMenu] = useState<ChatSurfaceMenuEntry[]>([])
  const openChatSurfacesRef = useRef<ActiveChatSurface[]>([])
  useEffect(() => { openChatSurfacesRef.current = openChatSurfaces }, [openChatSurfaces])
  const activeChatSurface = useMemo(
    () => openChatSurfaces.find(surface => surface.instanceId === activeChatSurfaceId) ?? openChatSurfaces[openChatSurfaces.length - 1] ?? null,
    [activeChatSurfaceId, openChatSurfaces],
  )
  const activeChatSurfaceRef = useRef<ActiveChatSurface | null>(null)
  useEffect(() => { activeChatSurfaceRef.current = activeChatSurface }, [activeChatSurface])
  const chatSurfaceIframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})
  const pendingChatSurfaceActionResultsRef = useRef(new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>())
  const setChatSurfaceIframeRef = useCallback((instanceId: string, node: HTMLIFrameElement | null) => {
    if (node) chatSurfaceIframeRefs.current[instanceId] = node
    else delete chatSurfaceIframeRefs.current[instanceId]
  }, [])
  const getChatSurfaceIframe = useCallback((instanceId: string): HTMLIFrameElement | null => chatSurfaceIframeRefs.current[instanceId] ?? null, [])
  const postToChatSurface = useCallback((instanceId: string, payload: Record<string, unknown>) => {
    getChatSurfaceIframe(instanceId)?.contentWindow?.postMessage(payload, '*')
  }, [getChatSurfaceIframe])
  const getChatSurfacePeerEntries = useCallback((surfaceId: string) => {
    return openChatSurfacesRef.current
      .filter(surface => surface.instanceId !== surfaceId)
      .map(surface => ({
        peerId: surface.instanceId,
        label: surface.label,
        contextEntries: Object.entries(surface.context ?? {}).map(([key, value]) => ({ key, value })),
      }))
  }, [])
  useEffect(() => {
    if (openChatSurfaces.length === 0) {
      if (activeChatSurfaceId !== null) setActiveChatSurfaceId(null)
      return
    }
    if (!openChatSurfaces.some(surface => surface.instanceId === activeChatSurfaceId)) {
      setActiveChatSurfaceId(openChatSurfaces[openChatSurfaces.length - 1]?.instanceId ?? null)
    }
  }, [activeChatSurfaceId, openChatSurfaces])
  // Drag-reorder state for the queued-turn list. A row can be dropped above
  // ('before'), below ('after'), or onto ('into') another row — the last case
  // nests it as a child of that row, rendered indented underneath.
  const [draggingTurnId, setDraggingTurnId] = useState<string | null>(null)
  const [dragOverTurn, setDragOverTurn] = useState<{ id: string; mode: 'before' | 'after' | 'into' } | null>(null)
  // Collapse the queue into a single summary row once it grows past a few
  // items. Keeps the composer area quiet when a batch of queued prompts
  // stacks up. Auto-collapses on the cross-over, but the user can manually
  // expand / re-collapse via the header.
  const [queueCollapsed, setQueueCollapsed] = useState(true)
  const prevQueuedCountRef = useRef(0)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const { gitStatus, gitBranches, refreshGitState } = useChatGitState(_workspaceDir)
  const pagedLinkedHistoryEnabledRef = useRef(pagedLinkedHistoryEnabled)
  pagedLinkedHistoryEnabledRef.current = pagedLinkedHistoryEnabled
  const isStreamingRef = useRef(false)
  const setMessagesSafe = useCallback((updater: React.SetStateAction<ChatMessage[]>) => {
    setMessages(prev => {
      const next = typeof updater === 'function'
        ? (updater as (prev: ChatMessage[]) => ChatMessage[])(prev)
        : updater
      if (pagedLinkedHistoryEnabledRef.current) return next
      // During streaming, skip expensive normalization for text-only appends
      // (same message count, last message still streaming). Normalize once
      // when streaming ends or message count changes.
      if (isStreamingRef.current && next.length === prev.length && next[next.length - 1]?.isStreaming) {
        return next
      }
      return normalizeMessagesForMemory(next)
    })
  }, [])
  const pendingStreamTextRef = useRef('')
  const pendingStreamFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushPendingStreamText = useCallback(() => {
    const text = pendingStreamTextRef.current
    if (!text) return
    pendingStreamTextRef.current = ''
    setMessagesSafe(prev => {
      const last = prev[prev.length - 1]
      if (!last?.isStreaming) return prev
      const blocks = [...(last.contentBlocks ?? [])]
      const lastBlock = blocks[blocks.length - 1]
      if (lastBlock?.type === 'text') {
        blocks[blocks.length - 1] = { ...lastBlock, text: lastBlock.text + text }
      } else {
        blocks.push({ type: 'text', text })
      }
      return [...prev.slice(0, -1), { ...last, content: last.content + text, contentBlocks: blocks }]
    })
  }, [setMessagesSafe])
  const queueStreamText = useCallback((text: string) => {
    if (!text) return
    pendingStreamTextRef.current += text
    if (pendingStreamFlushTimerRef.current) return
    pendingStreamFlushTimerRef.current = setTimeout(() => {
      pendingStreamFlushTimerRef.current = null
      flushPendingStreamText()
    }, CHAT_STREAM_FLUSH_INTERVAL_MS)
  }, [flushPendingStreamText])
  const lastJobSequenceRef = useRef<number>(initialJobSequence)
  const resumedJobKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (pendingStreamFlushTimerRef.current) {
        clearTimeout(pendingStreamFlushTimerRef.current)
        pendingStreamFlushTimerRef.current = null
      }
      pendingStreamTextRef.current = ''
    }
  }, [])

  useEffect(() => {
    lastJobSequenceRef.current = jobSequence
  }, [jobSequence])

  useEffect(() => {
    if (!jobId) {
      resumedJobKeyRef.current = null
    }
  }, [jobId])

  const { latestStateRef, stateLoadedRef, persistLatestState } = useChatTilePersistence({
    tileId,
    workspaceId,
    reloadToken,
    initialRuntimeStateRef,
    fallbackProvider: provider,
    messages,
    input,
    attachments,
    queuedTurns,
    openChatSurfaces,
    activeChatSurfaceId,
    executionTarget,
    provider,
    model,
    mcpEnabled,
    mode,
    thinking,
    effectiveAgentMode,
    autoAgentMode,
    preserveSessionSummary,
    linkedSessionEntryId,
    linkedSessionHint,
    hasEarlierMessages,
    sessionId,
    jobId,
    jobSequence,
    cloudHostId,
    isStreaming,
    setMessagesSafe,
    setInput,
    setAttachments,
    setQueuedTurns,
    setOpenChatSurfaces,
    setActiveChatSurfaceId,
    setProvider,
    setModel,
    setExecutionTarget,
    setMcpEnabled,
    setMode,
    setThinking,
    setAutoAgentMode,
    setPreserveSessionSummary,
    setLinkedSessionEntryId,
    setLinkedSessionHint,
    setHasEarlierMessages,
    setSessionId,
    setJobId,
    setJobSequence,
    setCloudHostId,
    setIsStreaming,
    lastJobSequenceRef,
  })

  const {
    messagesRef,
    stickToBottomRef,
    historicalMessages,
    setHistoricalMessages,
    allMessages,
    renderedMessages,
    hiddenMessageCount,
    loadingEarlier,
    earlierLoadError,
    showScrollToLatest,
    scrollToLatest,
    reviewLatestChanges,
    handleMessagesScroll,
    handleMessagesWheel,
    handleMessagesKeyDown,
    setAnnotationComposerActive,
  } = useChatTileTranscript({
    workspaceId,
    sessionId,
    linkedSessionEntryId,
    linkedSessionHint,
    hasEarlierMessages,
    setHasEarlierMessages,
    messages,
    setMessages,
    pagedLinkedHistoryEnabled,
    isStreaming,
  })

  const {
    updateBlockNote,
    exportNotesToClipboard,
  } = useChatTileBlockNotes({
    allMessages,
    setMessagesSafe,
    setHistoricalMessages,
  })

  // ─── TTS auto-speak (last-message-only, sentence-streamed) ──────────
  // Voice config comes from the persisted AppSettings.voice block (edited
  // via Settings → Voice). The ChatTile receives `settings` as a prop, so
  // any update from the settings panel re-flows here automatically.
  const voiceSettings = settings?.voice ?? {
    sttProvider: 'openai' as const,
    sttLang: 'en',
    ttsProvider: 'cartesia' as const,
    spokifyModel: 'claude-haiku-4-5-20251001',
    autoSpeak: 'off' as const,
    bargeIn: true,
  }

  // Voice dictation — extracted to useChatDictation hook.
  const dictation = useChatDictation({ voiceSettings })
  const { isDictating, dictationText, dictationError, toggleDictation } = dictation
  const autoSpeakEnabled = voiceSettings.autoSpeak === 'last-message'
  // Track the most recent assistant message id + final text for auto-speak.
  // We need its id (for deduping in the hook) and its text (after stream
  // completion). isStreaming gates: don't speak until the agent has finished.
  // ─── Subscribe to TTS player state for the visual indicator ─────────
  const [ttsState, setTtsState] = useState<TtsPlayerState>(() => ttsPlayer.state)
  useEffect(() => ttsPlayer.subscribe(setTtsState), [])

  // Find the most-recent assistant message (excluding streaming-in-progress).
  // This is what auto-speak watches.
  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'assistant') return m
    }
    return null
  }, [messages])

  useAutoSpeak({
    enabled: autoSpeakEnabled,
    messageId: lastAssistantMessage?.id ?? null,
    text: lastAssistantMessage?.content ?? null,
    isStreaming: Boolean(lastAssistantMessage?.isStreaming) || isStreaming,
    ttsProvider: voiceSettings.ttsProvider,
    ttsVoice: voiceSettings.ttsVoice,
    spokifyModel: voiceSettings.spokifyModel,
  })

  // Plan pane (right-docked inline plan panel). Subscribes to the per-tile
  // todos store so the pane, the composer chip, and the transcript's inline
  // PlanCard all share one source of truth (latest TodoWrite/update_plan block).
  const planTodos = useTileTodos(tileId)
  const [isPlanOpen, setIsPlanOpen] = useState(false)
  // Auto-close when the plan goes away (conversation cleared / new chat).
  useEffect(() => {
    if (!planTodos || planTodos.length === 0) setIsPlanOpen(false)
  }, [planTodos])
  const [planUpdatedAt, setPlanUpdatedAt] = useState<number | null>(null)
  useEffect(() => {
    if (planTodos && planTodos.length > 0) setPlanUpdatedAt(Date.now())
  }, [planTodos])

  // Plugin-contributed commands that expose a slash trigger surface in the chat
  // composer's `/` menu (point 3 — plugins appear in the chat area).
  const pluginCommands = useContributions('commands') as PaletteCommand[]
  const pluginSlashCommands = useMemo(
    () =>
      pluginCommands
        .filter(c => typeof c.slash === 'string' && c.slash.trim())
        .map(c => ({ slash: c.slash as string, title: c.title })),
    [pluginCommands],
  )

  // Autocomplete state (extracted to hook)
  const {
    acType,
    setAcType,
    acQuery,
    setAcQuery,
    acIndex,
    setAcIndex,
    acItems,
    handleComposerInputChange,
  } = useChatAutocomplete({
    workspaceDir: _workspaceDir,
    connectedPeers,
    workspaceSkills,
    pluginSlashCommands,
  })
  closeAutocompleteRef.current = () => {
    setAcType(null)
    setAcQuery('')
  }

  const {
    latestChangeDrawer,
    latestChangeDrawerHasStats,
    latestChangeDrawerExpanded,
    setLatestChangeDrawerExpanded,
    latestChangeDrawerExpandedFiles,
    latestCheckpointId,
    isRestoringLatestCheckpoint,
    toggleLatestChangeDrawerFile,
    restoreLatestCheckpoint,
    checkpointRestoreContextValue,
  } = useChatTileLatestChangeDrawer({
    workspaceId,
    tileId,
    messages,
    setMessagesSafe,
  })

  const liveComposerActivityChip = useChatTileLiveComposerActivity({
    isStreaming,
    renderedMessages,
  })

  // Dream completion → synthetic chip in chat history.
  //
  // Polls the daemon summary every 5s. When the workspace's `lastRun.completedAt`
  // advances to a value we haven't seen yet (and the run succeeded), append a
  // single ChatMessage carrying a 'Dream completed' tool block. This appears
  // inline with the rest of history, scrolls with it, and persists to canvas
  // state alongside any other message — same lifecycle as a checkpoint chip.
  //
  // The first poll after mount seeds the "last seen" ref without injecting a
  // chip, so reopening a tile doesn't dump every historical dream into the
  // transcript. Only completions that happen *while the tile is open* show up.
  const lastSeenDreamCompletionRef = useRef<string | null>(null)
  const dreamPollSeededRef = useRef(false)
  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false

    const poll = async () => {
      try {
        const summary = await window.electron.system.daemonSummary()
        if (cancelled) return
        const lastRun = summary?.dreaming?.lastRun
        if (!lastRun) return
        const matchesWorkspace = !lastRun.workspaceId || lastRun.workspaceId === workspaceId
        if (!matchesWorkspace) return
        const completedAt = lastRun.completedAt ?? null
        if (!completedAt) return
        if (!dreamPollSeededRef.current) {
          dreamPollSeededRef.current = true
          lastSeenDreamCompletionRef.current = completedAt
          return
        }
        if (lastSeenDreamCompletionRef.current === completedAt) return
        lastSeenDreamCompletionRef.current = completedAt
        if (lastRun.status === 'failed' || lastRun.status === 'cancelled') return

        const runId = String(lastRun.id ?? completedAt)
        const sessionsReviewed = Number(lastRun.sessionsReviewed ?? 0)
        const summaryText = sessionsReviewed > 0
          ? `Auto-dream consolidated ${sessionsReviewed} session${sessionsReviewed === 1 ? '' : 's'}`
          : 'Auto-dream completed'
        const toolId = `${DREAM_TOOL_ID_PREFIX}${runId}`
        const ts = Date.parse(completedAt) || Date.now()

        setMessagesSafe(prev => {
          // De-dupe: if a dream message with this toolId already exists in history, skip.
          if (prev.some(m => m.toolBlocks?.some(tb => tb.id === toolId))) return prev
          return [...prev, {
            id: `msg-dream-${runId}`,
            role: 'system',
            content: '',
            timestamp: ts,
            contentBlocks: [{ type: 'tool', toolId }],
            toolBlocks: [{
              id: toolId,
              name: DREAM_TOOL_NAME,
              input: '',
              summary: summaryText,
              status: 'done',
            }],
          }]
        })
      } catch {
        // Polling failures are non-fatal — try again next tick.
      }
    }

    poll()
    const interval = window.setInterval(poll, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [workspaceId, setMessagesSafe])

  useEffect(() => { ensureChatMdStyle() }, [])

  // Bumped whenever CustomisationTile saves a new set of skill/prompt
  // locations, so the skill-discovery effect below re-runs and picks up new
  // folders (or drops skills from removed folders).
  const [skillLocationsVersion, setSkillLocationsVersion] = useState(0)
  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<CustomisationLocationsChangedDetail>).detail
      if (!detail) return
      if (detail.kind !== 'skills' && detail.kind !== 'prompts') return
      const currentWorkspace = _workspaceDir?.trim() || null
      if (currentWorkspace && detail.workspacePath && detail.workspacePath !== currentWorkspace) return
      setSkillLocationsVersion(v => v + 1)
    }
    window.addEventListener(CUSTOMISATION_LOCATIONS_CHANGED_EVENT, handler as EventListener)
    return () => window.removeEventListener(CUSTOMISATION_LOCATIONS_CHANGED_EVENT, handler as EventListener)
  }, [_workspaceDir])

  useEffect(() => {
    let cancelled = false
    const workspacePath = _workspaceDir?.trim() || null
    const homePath = window.electron.homedir ?? ''
    const skillsPath = workspacePath ? `${workspacePath}/.contex/customisation/skills.json` : null
    const locationsPath = workspacePath ? `${workspacePath}/.contex/customisation/locations-skills.json` : null
    // Commands are conceptually prompts — the Prompts locations panel is the
    // canonical place users add slash-command folders. Merge both lists so any
    // folder added under Prompts OR Skills gets scanned for chat skills.
    const promptLocationsPath = workspacePath ? `${workspacePath}/.contex/customisation/locations-prompts.json` : null

    ;(async () => {
      const discovered = new Map<string, SkillDefinition>()

      const registerSkill = (skill: SkillDefinition) => {
        const key = skill.name.trim().toLowerCase()
        if (!key || discovered.has(key)) return
        discovered.set(key, skill)
      }

      if (skillsPath) {
        const savedRaw = await window.electron.fs.readFile(skillsPath).catch(() => '')
        if (savedRaw) {
          try {
            const parsed = JSON.parse(savedRaw)
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (
                  typeof item === 'object'
                  && item !== null
                  && typeof (item as { id?: unknown }).id === 'string'
                  && typeof (item as { name?: unknown }).name === 'string'
                  && typeof (item as { content?: unknown }).content === 'string'
                ) {
                  registerSkill(item as SkillDefinition)
                }
              }
            }
          } catch {
            // Ignore invalid JSON and continue with discovery.
          }
        }
      }

      const readLocationsFile = async (path: string | null): Promise<string> => {
        if (!path) return ''
        const raw = await window.electron.fs.readFile(path).catch(() => '')
        if (!raw) return ''
        try {
          const parsed = JSON.parse(raw)
          if (typeof parsed === 'string') return parsed
        } catch {
          return raw
        }
        return ''
      }

      const skillsLocationsText = await readLocationsFile(locationsPath)
      const promptsLocationsText = await readLocationsFile(promptLocationsPath)
      const mergedSources = [skillsLocationsText, promptsLocationsText].filter(s => s && s.trim()).join('\n')
      const rawLocations = mergedSources.trim() ? mergedSources : CHAT_DEFAULT_SKILL_LOCATIONS

      const seenDirs = new Set<string>()
      const dirs = resolveChatSkillLocations(rawLocations, homePath, workspacePath).filter(d => {
        if (seenDirs.has(d)) return false
        seenDirs.add(d)
        return true
      })
      // Claude-format skills are sub-folders containing `SKILL.md`. Other
      // tools drop a single `.md`/`.txt`/`.mdc` file at the top level. Support
      // both so e.g. `~/Library/Application Support/Claude/skills/foo/SKILL.md`
      // is picked up as skill "foo".
      const registerDiscoveredSkill = (filePath: string, fallbackName: string, content: string, dir: string): void => {
        const nameMatch = content.match(/^---[\s\S]*?name:\s*(.+?)$/m)
        const descriptionMatch = content.match(/^---[\s\S]*?description:\s*(.+?)$/m)
        const name = nameMatch?.[1]?.trim() ?? fallbackName
        registerSkill({
          id: `discovered-${filePath}`,
          name,
          description: descriptionMatch?.[1]?.trim() ?? `From ${dir}`,
          content,
          command: name,
        })
      }
      for (const dir of dirs) {
        const entries: Array<{ name: string; path: string; isDir: boolean; ext: string }> = await window.electron.fs.readDir(dir).catch(() => [])
        for (const entry of entries) {
          if (entry.isDir) {
            const sub: Array<{ name: string; path: string; isDir: boolean; ext: string }> = await window.electron.fs.readDir(entry.path).catch(() => [])
            const skillFile = sub.find(e => !e.isDir && /^skill\.md$/i.test(e.name))
              ?? sub.find(e => !e.isDir && /^skill\.(txt|mdc)$/i.test(e.name))
            if (!skillFile) continue
            const content = await window.electron.fs.readFile(skillFile.path).catch(() => '')
            if (!content) continue
            registerDiscoveredSkill(skillFile.path, entry.name, content, dir)
            continue
          }
          if (entry.ext !== '.md' && entry.ext !== '.txt' && entry.ext !== '.mdc') continue
          const content = await window.electron.fs.readFile(entry.path).catch(() => '')
          if (!content) continue
          registerDiscoveredSkill(entry.path, entry.name.replace(/\.(md|txt|mdc)$/i, ''), content, dir)
        }
      }

      if (cancelled) return
      setWorkspaceSkills(Array.from(discovered.values()).sort((a, b) => a.name.localeCompare(b.name)))
    })().catch(() => {
      if (!cancelled) setWorkspaceSkills([])
    })

    return () => { cancelled = true }
  }, [_workspaceDir, skillLocationsVersion])

  useEffect(() => {
    window.electron?.bus?.publish(`tile:${tileId}`, 'tool_inventory', `chat:${tileId}`, {
      provider,
      model,
      mcpEnabled,
      tools: availableToolInventory,
      updatedAt: Date.now(),
    })
  }, [tileId, provider, model, mcpEnabled, availableToolInventory])

  useEffect(() => {
    window.electron?.bus?.publish(`tile:${tileId}`, 'skill_inventory', `chat:${tileId}`, {
      provider,
      model,
      skills: availableSkillInventory,
      updatedAt: Date.now(),
    })
  }, [tileId, provider, model, availableSkillInventory])





  useEffect(() => {
    if (pagedLinkedHistoryEnabled) return
    const normalized = normalizeMessagesForMemory(messages)
    if (normalized !== messages) {
      setMessages(normalized)
      return
    }
  }, [messages, pagedLinkedHistoryEnabled])

  // Publish the latest task list for this tile so external chrome (tab bar,
  // sidebar) can surface the agent's current plan without drilling into
  // ChatTile internals. Walks reverse-chronologically across both the live
  // tail and any paged-in history so linked external sessions still surface
  // Codex `update_plan` data even when it lived outside the recent tail.
  useEffect(() => {
    let latest: TileTodoItem[] | null = null
    outer: for (let i = allMessages.length - 1; i >= 0; i -= 1) {
      const msg = allMessages[i]
      const blocks = msg.toolBlocks
      if (!blocks || blocks.length === 0) continue
      for (let j = blocks.length - 1; j >= 0; j -= 1) {
        const tb = blocks[j]
        const parsedPlan = parsePlanToolTodos(tb.name, tb.input || '{}')
        if (!parsedPlan) continue
        latest = parsedPlan.todos.length > 0 ? parsedPlan.todos : null
        break outer
      }
    }
    setTileTodos(tileId, latest)
  }, [tileId, allMessages])

  // Clear the published todos when the tile unmounts so stale state doesn't
  // linger in the store.
  useEffect(() => {
    return () => { clearTileTodos(tileId) }
  }, [tileId])

  // Track the first moment each ToolBlock flipped to 'done'. Retained as a
  // recompute heartbeat (toolCollapseTick) for the chip transcript; also
  // prunes entries for tool ids that no longer exist in state.
  const toolStampInitialRunRef = useRef(true)
  useEffect(() => {
    const seen = new Set<string>()
    const now = Date.now()
    // On first run (history load) stamp already-done tools as if they
    // completed before the grace window so they're immediately eligible
    // to fold. Subsequent runs stamp freshly-completed tools with `now`
    // so live streaming still gets the full grace period.
    const initialRun = toolStampInitialRunRef.current
    const liveStampValue = initialRun ? 0 : now
    for (const msg of historicalMessages) {
      for (const tb of msg.toolBlocks ?? []) {
        seen.add(tb.id)
        if (tb.status === 'done' && !toolCompletedAtRef.current.has(tb.id)) {
          toolCompletedAtRef.current.set(tb.id, 0)
        }
      }
    }
    for (const msg of messages) {
      for (const tb of msg.toolBlocks ?? []) {
        seen.add(tb.id)
        if (tb.status === 'done' && !toolCompletedAtRef.current.has(tb.id)) {
          toolCompletedAtRef.current.set(tb.id, liveStampValue)
        }
      }
    }
    toolStampInitialRunRef.current = false
    // Drop stale entries for tool blocks that got removed (e.g. conversation
    // cleared / message regenerated).
    for (const id of Array.from(toolCompletedAtRef.current.keys())) {
      if (!seen.has(id)) toolCompletedAtRef.current.delete(id)
    }
  }, [historicalMessages, messages])

  // Auto-collapse the queue when it crosses into "too many" territory, and
  // auto-expand when it drops back down so a lone queued item isn't hidden
  // behind a summary row. The user can still override by clicking the header.
  useEffect(() => {
    const prev = prevQueuedCountRef.current
    const next = queuedTurns.length
    if (prev < 3 && next >= 3) setQueueCollapsed(true)
    else if (prev >= 3 && next < 3) setQueueCollapsed(false)
    prevQueuedCountRef.current = next
  }, [queuedTurns.length])

  // Reset the "last activity" clock every time streaming toggles on so the
  // quiet-indicator starts from zero for each new turn. The message-change
  // effect below then keeps it current while tokens/tool-blocks arrive.
  useEffect(() => {
    isStreamingRef.current = isStreaming
    if (isStreaming) {
      lastActivityAtRef.current = Date.now()
    }
  }, [isStreaming])

  // Run deferred normalization when streaming ends — catches any growth
  // that accumulated while the fast-path skipped normalizeMessagesForMemory.
  useEffect(() => {
    if (!isStreaming && stateLoadedRef.current && !pagedLinkedHistoryEnabledRef.current) {
      setMessages(prev => normalizeMessagesForMemory(prev))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  // Any mutation to messages while streaming counts as activity.
  useEffect(() => {
    if (!isStreaming) return
    lastActivityAtRef.current = Date.now()
  }, [messages, isStreaming])

  // Push permission-mode changes into the running Claude query. Only fires
  // when mode actually changed during an active stream — initial mount and
  // stream start re-baseline the ref so the next user-initiated switch gets
  // detected. Only Claude's SDK supports runtime mode changes; other providers
  // will need a per-turn restart (out of scope).
  useEffect(() => {
    if (!isStreaming) {
      lastPushedModeRef.current = mode
      return
    }
    if (provider !== 'claude') return
    if (lastPushedModeRef.current === mode) return
    lastPushedModeRef.current = mode
    void window.electron?.chat?.setPermissionMode?.({ cardId: tileId, mode })
  }, [mode, isStreaming, provider, tileId])

  // Re-arm a one-shot timer for the soonest tool chip that is still inside
  // the live-collapse grace window. This avoids the old 500ms parent-level
  // rerender loop that made the transcript pulse while streaming.
  useEffect(() => {
    const sourceMessages = allMessages
    const now = Date.now()
    let nextDeadline: number | null = null

    for (const msg of sourceMessages) {
      for (const tb of msg.toolBlocks ?? []) {
        if (tb.status !== 'done') continue
        const completedAt = toolCompletedAtRef.current.get(tb.id)
        if (completedAt == null || completedAt === 0) continue
        const deadline = completedAt + LIVE_TOOL_COLLAPSE_GRACE_MS
        if (deadline <= now) continue
        if (nextDeadline == null || deadline < nextDeadline) nextDeadline = deadline
      }
    }

    if (nextDeadline == null) return
    const timeoutMs = Math.max(0, nextDeadline - now) + 10
    const id = window.setTimeout(() => {
      setToolCollapseTick(n => (n + 1) & 0xffff)
    }, timeoutMs)
    return () => window.clearTimeout(id)
  }, [allMessages, toolCollapseTick])

  useEffect(() => {
    if (!stateLoadedRef.current) return
    if (!jobId) return
    const resumeKey = [
      jobId,
      executionTarget,
      cloudHostId ?? '',
      provider,
      model,
    ].join('::')
    if (resumedJobKeyRef.current === resumeKey) return
    resumedJobKeyRef.current = resumeKey

    void window.electron.chat?.resumeJob?.({
      cardId: tileId,
      provider,
      model,
      workspaceDir: _workspaceDir,
      executionTarget,
      cloudHostId,
      executionPreference: settings?.execution ?? null,
      jobId,
      jobSequence,
    })
  }, [tileId, provider, model, _workspaceDir, executionTarget, cloudHostId, settings?.execution, jobId, jobSequence])

  const contextWindowLimit = useMemo(() => getApproxContextWindowTokens(provider, model), [provider, model])
  const systemOverheadTokens = useMemo(
    () => getApproxSystemOverheadTokens(provider, model),
    [provider, model],
  )
  // Set of attachment paths the model has actually loaded (via Read-style
  // tools). Drives the confirmation tick on attachment chips — must stay
  // authoritative: only paths demonstrably consumed by the model appear here.
  //
  // Keyed on the sorted content of the set so the Set identity is stable
  // across streaming ticks that don't add a new Read tool call. This is
  // load-bearing: ChatMessageContent receives this prop and is React.memo'd;
  // a fresh Set every token would break memo for every completed block on
  // every single token, causing a full message re-render storm.
  const readPathsSnapshot = useMemo(
    () => [...collectModelReadPaths(messages)].sort().join('\u0000'),
    [messages],
  )
  const readAttachmentPaths = useMemo(
    () => new Set(readPathsSnapshot ? readPathsSnapshot.split('\u0000') : []),
    [readPathsSnapshot],
  )
  const conversationTokenEstimate = useMemo(() => {
    const totalChars = messages.reduce((sum, message) => sum + estimateMessageChars(message), 0)
    return Math.max(0, Math.round(totalChars / 4))
  }, [messages])
  const estimatedContextTokens = useMemo(() => {
    const inputTokens = Math.max(0, Math.round(input.length / 4))
    // Include the provider's baseline overhead (system prompt + tool schemas
    // + injected reminders) so the indicator doesn't misleadingly report
    // near-empty usage when the harness has already loaded tens of thousands
    // of tokens before the first user turn.
    return conversationTokenEstimate + inputTokens + systemOverheadTokens
  }, [conversationTokenEstimate, input, systemOverheadTokens])
  const contextUsageRatio = contextWindowLimit > 0 ? Math.min(1, estimatedContextTokens / contextWindowLimit) : 0
  const contextUsagePercent = Math.max(1, Math.round(contextUsageRatio * 100))

  const isGitRepo = gitStatus.isRepo || gitBranches.isRepo
  const branchMenuCreateEnabled = isGitRepo
    && branchFilter.trim().length > 0
    && !gitBranches.branches.some(branch => branch.name.toLowerCase() === branchFilter.trim().toLowerCase())
  const activeRepoRoot = gitBranches.isRepo
    ? gitBranches.root
    : gitStatus.isRepo
      ? gitStatus.root
      : _workspaceDir
  const normalizedRepoRoot = activeRepoRoot.replace(/\/+$/, '')
  const projectFolderName = basename(normalizedRepoRoot) || 'No project'
  const currentBranchLabel = gitBranches.current ?? 'No branch'
  useEffect(() => {
    if (executionTarget !== 'cloud') return
    if (remoteHosts.length === 0) {
      if (cloudHostId !== null) setCloudHostId(null)
      return
    }
    if (!cloudHostId || !remoteHosts.some(host => host.id === cloudHostId)) {
      setCloudHostId(remoteHosts[0].id)
    }
  }, [executionTarget, remoteHosts, cloudHostId])
  const locationLabel = executionDisplayLabel
  const activeProjectPathLabel = executionTarget === 'cloud'
    ? executionDisplayDetail
    : (normalizedRepoRoot || 'No project')

  const handleProjectFolderSwitch = useCallback(async () => {
    try {
      const newPath = await window.electron?.workspace?.openFolder?.()
      if (!newPath) return
      const previousPath = normalizedRepoRoot || ''
      if (newPath === previousPath) return
      if (workspaceId) {
        try {
          await window.electron?.workspace?.addProjectFolder?.(workspaceId, newPath)
        } catch (err) {
          console.warn('[ChatTile] addProjectFolder failed:', err)
        }
      }
      const switchMsg: ChatMessage = {
        id: `msg-folder-switch-${Date.now()}`,
        role: 'assistant',
        content: previousPath
          ? `Switched project folder from \`${previousPath}\` to \`${newPath}\`.`
          : `Switched project folder to \`${newPath}\`.`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, switchMsg])
    } catch (err) {
      console.warn('[ChatTile] folder switch failed:', err)
    }
  }, [normalizedRepoRoot, workspaceId])

  const filteredBranches = useMemo(() => {
    const query = branchFilter.trim().toLowerCase()
    if (!query) return gitBranches.branches
    return gitBranches.branches.filter(branch => branch.name.toLowerCase().includes(query))
  }, [gitBranches.branches, branchFilter])

  const handleBranchSelect = useCallback(async (branchName: string) => {
    if (!_workspaceDir || !window.electron?.git?.checkoutBranch) return
    const result = await window.electron.git.checkoutBranch(_workspaceDir, branchName)
    if (result?.ok) {
      setShowBranchMenu(false)
      setBranchFilter('')
      void refreshGitState()
    }
  }, [_workspaceDir, refreshGitState])

  const handleCreateBranch = useCallback(async () => {
    const nextName = branchFilter.trim()
    if (!nextName || !_workspaceDir || !window.electron?.git?.createBranch) return
    const result = await window.electron.git.createBranch(_workspaceDir, nextName)
    if (result?.ok) {
      setShowBranchMenu(false)
      setBranchFilter('')
      void refreshGitState()
    }
  }, [branchFilter, _workspaceDir, refreshGitState])

  // ─── Voice dictation (via useChatDictation hook) ────────────────────
  // Wire transcriptions into the input state.
  useEffect(() => {
    dictation.onTranscription((text: string) => {
      setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)
    })
  }, [dictation])

  // Stream listener -- handles all rich event types from Claude Agent SDK
  useChatStreamHandler({
    tileId,
    setMessagesSafe,
    setSessionId,
    setIsStreaming,
    setJobId,
    setJobSequence,
    flushPendingStreamText,
    queueStreamText,
    lastJobSequenceRef,
    setPendingToolPermissions,
    setResolvedToolPermissions,
  })

  // Subscribe to incoming MCP peer commands on this tile's bus channel.
  // Strict gating so broadcasts from editor/extension peers don't spam every
  // chat tile: the command must target THIS tileId explicitly, and the
  // injected message id is a content hash so replays dedup instead of piling
  // up identical `[App.tsx] …` noise lines.
  useEffect(() => {
    if (!window.electron?.bus) return
    const seenPeerIds = new Set<string>()
    const unsubscribe = window.electron.bus.subscribe(`tile:${tileId}`, `chat:${tileId}:mcp`, (evt: any) => {
      if (!evt?.type?.startsWith('mcp_') && !String(evt.source || '').startsWith('mcp:')) return
      const payload = (evt.payload as Record<string, unknown>) || {}
      const command = typeof payload.command === 'string' ? payload.command : ''
      if (command !== 'chat_send_message' && command !== 'chat_acknowledge') return

      const targetCardId = typeof payload.cardId === 'string' ? payload.cardId
        : typeof payload.tileId === 'string' ? payload.tileId
        : null
      // Reject broadcasts that don't explicitly target this tile.
      if (!targetCardId || targetCardId !== tileId) return

      const text = typeof payload.message === 'string' ? payload.message.trim() : ''
      if (!text) return

      const sig = `${evt.source ?? 'peer'}::${command}::${text}`
      let hash = 0
      for (let i = 0; i < sig.length; i++) hash = (hash * 31 + sig.charCodeAt(i)) | 0
      const peerMsgId = `peer-${Math.abs(hash).toString(36)}`
      if (seenPeerIds.has(peerMsgId)) return
      seenPeerIds.add(peerMsgId)

      const prefix = command === 'chat_acknowledge' ? '🤝 ' : '📨 '
      const incomingMsg: ChatMessage = {
        id: peerMsgId,
        role: 'user',
        content: `${prefix}${text}`,
        timestamp: Date.now(),
        isStreaming: false,
      }
      setMessagesSafe(prev => (prev.some(m => m.id === peerMsgId) ? prev : [...prev, incomingMsg]))
    })
    return () => unsubscribe?.()
  }, [tileId])

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      const pos = ta.value.length
      ta.setSelectionRange(pos, pos)
    })
  }, [])

  const {
    dispatchMessageContent,
    sendMessage,
    reorderQueuedTurn,
    flushQueueStateNow,
    logQueueEvent,
    stopStreaming,
    handleQueuedTurnSteer,
  } = useChatTileMessaging({
    tileId,
    workspaceId,
    workspaceDir: _workspaceDir,
    settings,
    isStreaming,
    input,
    attachments,
    implicitPeerImageAttachments,
    queuedTurns,
    messages,
    provider,
    model,
    mode,
    thinking,
    sessionId,
    mcpEnabled,
    executionTarget,
    cloudHostId,
    effectiveAgentMode,
    autoAgentMode,
    linkedSessionEntryId,
    linkedSessionHint,
    hasEarlierMessages,
    connectedPeers,
    peerContextRef,
    peerToolNames,
    providerEntryById,
    currentProviderEntry,
    activeCloudHost,
    latestStateRef,
    persistLatestState,
    lastJobSequenceRef,
    resumedJobKeyRef,
    stickToBottomRef,
    activeChatSurfaceRef,
    openChatSurfacesRef,
    textareaRef,
    setMessagesSafe,
    setInput,
    setAttachments,
    setQueuedTurns,
    setOpenChatSurfaces,
    setActiveChatSurfaceId,
    setIsStreaming,
    setJobId,
    setJobSequence,
    setPreserveSessionSummary,
    setAcType,
    setAcQuery,
    focusComposer,
    getChatSurfaceIframe,
    postToChatSurface,
    exportNotesToClipboard,
    pluginCommands,
  })

  const syncComposerHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.max(CHAT_COMPOSER_TEXTAREA_MIN_HEIGHT, Math.min(ta.scrollHeight, 134))}px`
  }, [])

  const addAttachments = useCallback((paths: string[]) => {
    if (paths.length === 0) return
    setAttachments(prev => {
      const seen = new Set(prev.map(item => item.path))
      const next = [...prev]
      for (const path of paths) {
        if (seen.has(path)) continue
        seen.add(path)
        next.push({ path, kind: isImagePath(path) ? 'image' : 'file' })
      }
      return next
    })
    setAcType(null)
    setAcQuery('')
    requestAnimationFrame(() => {
      syncComposerHeight()
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      const pos = ta.value.length
      ta.setSelectionRange(pos, pos)
    })
  }, [syncComposerHeight])

  const openAttachmentPicker = useCallback(async () => {
    const paths = await window.electron.chat?.selectFiles()
    if (paths && paths.length > 0) addAttachments(paths)
    setShowInsertMenu(false)
  }, [addAttachments])

  const removeAttachment = useCallback((path: string) => {
    setAttachments(prev => prev.filter(item => item.path !== path))
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  // ── Chat-surface extensions (e.g. Sketch) ─────────────────────────────────
  // Re-query whenever extensions are enabled/disabled or the global
  // extensions switch is flipped, so newly-installed chat surfaces (Sketch
  // etc.) appear in the composer `+` menu without requiring a tile reload.
  useEffect(() => {
    let cancelled = false
    const extensionsApi = (window.electron as unknown as { extensions?: { listChatSurfaces?: () => Promise<ChatSurfaceMenuEntry[] & Array<any>> } })?.extensions
    const fetchMenu = () => {
      if (!extensionsApi?.listChatSurfaces) {
        setChatSurfaceMenu([])
        return
      }
      extensionsApi.listChatSurfaces().then((entries: any[]) => {
        if (cancelled) return
        setChatSurfaceMenu((entries ?? []).map(normalizeChatSurfaceMenuEntry))
      }).catch(() => { if (!cancelled) setChatSurfaceMenu([]) })
    }
    fetchMenu()
    const onChanged = () => fetchMenu()
    window.addEventListener('codesurf:extensions-changed', onChanged)
    return () => {
      cancelled = true
      window.removeEventListener('codesurf:extensions-changed', onChanged)
    }
  }, [])

  const openChatSurface = useCallback(async (entry: ChatSurfaceMenuEntry, options: { initialContext?: Record<string, unknown> } = {}) => {
    setShowInsertMenu(false)
    const initialContext = options.initialContext && typeof options.initialContext === 'object' && !Array.isArray(options.initialContext)
      ? options.initialContext
      : undefined
    const existing = openChatSurfacesRef.current.find(surface => surface.extId === entry.extId && surface.surfaceId === entry.surfaceId)
    if (existing) {
      if (initialContext && Object.keys(initialContext).length > 0) {
        setOpenChatSurfaces(prev => prev.map(surface => surface.instanceId === existing.instanceId
          ? { ...surface, context: { ...surface.context, ...initialContext } }
          : surface))
        for (const [key, value] of Object.entries(initialContext)) {
          postToChatSurface(existing.instanceId, {
            type: 'contex-event',
            event: 'context.changed',
            data: { key, value },
          })
        }
      }
      setActiveChatSurfaceId(existing.instanceId)
      return
    }
    const instanceId = `surf-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
    const extensionsApi = (window.electron as unknown as { extensions?: { chatSurfaceEntry?: (ext: string, id: string, inst: string) => Promise<string | null> } })?.extensions
    const url = extensionsApi?.chatSurfaceEntry
      ? await extensionsApi.chatSurfaceEntry(entry.extId, entry.surfaceId, instanceId).catch(() => null)
      : null
    if (!url) {
      // Surface could not be resolved (extension missing / disabled).
      return
    }
    setOpenChatSurfaces(prev => [...prev, {
      extId: entry.extId,
      surfaceId: entry.surfaceId,
      label: entry.label,
      icon: entry.icon,
      instanceId,
      entryUrl: url,
      emits: entry.emits,
      height: Math.max(entry.minHeight, entry.defaultHeight),
      minHeight: entry.minHeight,
      payload: null,
      tileState: {},
      context: initialContext ?? {},
      registeredActions: [],
    }])
    setActiveChatSurfaceId(instanceId)
  }, [postToChatSurface])
  const openBuilderFromSketch = useCallback(async () => {
    const builderEntry = chatSurfaceMenu.find(entry => entry.extId === 'builder' || entry.surfaceId === 'builder')
    if (!builderEntry) return
    await openChatSurface(builderEntry)
  }, [chatSurfaceMenu, openChatSurface])

  useEffect(() => {
    const handleOpenChatSurfaceRequest = async (event: Event) => {
      const detail = normalizeOpenChatSurfaceDetail((event as CustomEvent).detail)
      if (!detail || detail.targetTileId !== tileId) return

      let entry = chatSurfaceMenu.find(candidate => candidate.extId === detail.extId && candidate.surfaceId === detail.surfaceId)
      if (!entry) {
        const rawEntries = await window.electron?.extensions?.listChatSurfaces?.().catch(() => [])
        entry = (rawEntries ?? [])
          .map(normalizeChatSurfaceMenuEntry)
          .find(candidate => candidate.extId === detail.extId && candidate.surfaceId === detail.surfaceId)
      }
      if (!entry) return
      await openChatSurface(entry, { initialContext: detail.initialContext })
    }

    window.addEventListener(CODESURF_OPEN_CHAT_SURFACE_EVENT, handleOpenChatSurfaceRequest as EventListener)
    return () => window.removeEventListener(CODESURF_OPEN_CHAT_SURFACE_EVENT, handleOpenChatSurfaceRequest as EventListener)
  }, [chatSurfaceMenu, openChatSurface, tileId])

  const closeChatSurface = useCallback((instanceId?: string) => {
    const targetId = instanceId ?? activeChatSurfaceRef.current?.instanceId
    if (!targetId) return
    postToChatSurface(targetId, { type: 'contex-event', event: 'surface.clear', data: {} })
    pendingChatSurfaceActionResultsRef.current.forEach((pending, requestId) => {
      pending.reject(new Error('Chat surface closed'))
      pendingChatSurfaceActionResultsRef.current.delete(requestId)
    })
    setOpenChatSurfaces(prev => prev.filter(surface => surface.instanceId !== targetId))
    setActiveChatSurfaceId(prev => (prev === targetId ? null : prev))
  }, [postToChatSurface])

  // Listen for messages from the chat-surface iframes. Beyond surface.setPayload,
  // we support a small peer context/action model so Sketch and Builder can live
  // together as tabs inside chat instead of isolated one-off panels.
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      const msg = e.data
      if (!msg || typeof msg !== 'object') return
      const sourceWin = e.source as Window | null
      const sourceIsChatSurface = Object.values(chatSurfaceIframeRefs.current)
        .some(frame => frame?.contentWindow === sourceWin)
      const reply = (result: unknown, error?: string) => {
        sourceWin?.postMessage({ type: 'contex-rpc-response', id: msg.id, result: error ? undefined : result, error }, '*')
      }

      if (msg.type === 'contex-bridge-ready' && typeof msg.tileId === 'string') {
        const surface = openChatSurfacesRef.current.find(candidate => candidate.instanceId === msg.tileId)
        if (!surface) return
        if (getChatSurfaceIframe(surface.instanceId)?.contentWindow !== sourceWin) return
        sourceWin?.postMessage({ type: 'contex-theme-vars', vars: chatSurfaceThemeVars }, '*')
        for (const [key, value] of Object.entries(surface.context || {})) {
          sourceWin?.postMessage({
            type: 'contex-event',
            event: 'context.changed',
            data: { key, value },
          }, '*')
        }
        for (const peer of getChatSurfacePeerEntries(surface.instanceId)) {
          for (const entry of peer.contextEntries) {
            sourceWin?.postMessage({
              type: 'contex-event',
              event: 'context.peerChanged',
              data: { peerId: peer.peerId, key: entry.key, value: entry.value },
            }, '*')
          }
        }
        return
      }

      if (msg.type === 'contex-action-result' && typeof msg.requestId === 'string') {
        if (!sourceIsChatSurface) return
        const pending = pendingChatSurfaceActionResultsRef.current.get(msg.requestId)
        if (!pending) return
        pendingChatSurfaceActionResultsRef.current.delete(msg.requestId)
        if (msg.error) pending.reject(new Error(String(msg.error)))
        else pending.resolve(msg.result)
        return
      }

      if (msg.type !== 'contex-rpc' || typeof msg.tileId !== 'string') return
      const surface = openChatSurfacesRef.current.find(candidate => candidate.instanceId === msg.tileId)
      if (!surface) return
      if (getChatSurfaceIframe(surface.instanceId)?.contentWindow !== sourceWin) return

      try {
        const basicRpc = await handleBasicChatSurfaceRpc({
          method: String(msg.method ?? ''),
          params: msg.params,
          surface,
          connectedPeerIds: getChatSurfacePeerEntries(surface.instanceId).map(peer => peer.peerId),
          workspaceId,
          workspacePath: _workspaceDir,
          themeColors: chatSurfaceThemeColors,
          extensionsApi: {
            invoke: window.electron?.extensions?.invoke,
            getSettings: window.electron?.extensions?.getSettings,
            setSettings: window.electron?.extensions?.setSettings,
          },
          openChatSurface: async (request) => {
            let entry = chatSurfaceMenu.find(candidate => candidate.extId === request.extId && candidate.surfaceId === request.surfaceId)
            if (!entry) {
              const rawEntries = await window.electron?.extensions?.listChatSurfaces?.().catch(() => [])
              entry = (rawEntries ?? [])
                .map(normalizeChatSurfaceMenuEntry)
                .find(candidate => candidate.extId === request.extId && candidate.surfaceId === request.surfaceId)
            }
            if (!entry) throw new Error(`Chat surface ${request.extId}:${request.surfaceId} not found`)
            await openChatSurface(entry, { initialContext: request.initialContext })
            return true
          },
        })
        if (basicRpc.handled) {
          if ('payload' in basicRpc) {
            setOpenChatSurfaces(prev => prev.map(candidate => candidate.instanceId === surface.instanceId
              ? { ...candidate, payload: basicRpc.payload ?? null }
              : candidate))
          }
          reply(basicRpc.result)
          return
        }

        if (msg.method === 'tile.getState') {
          const key = typeof msg.params?.key === 'string' ? msg.params.key : null
          const liveSurface = openChatSurfacesRef.current.find(candidate => candidate.instanceId === surface.instanceId) ?? surface
          const tileState = liveSurface.tileState && typeof liveSurface.tileState === 'object' ? liveSurface.tileState : {}
          reply(key ? tileState[key] ?? null : tileState)
          return
        }

        if (msg.method === 'tile.setState') {
          let nextSurfaceState: Record<string, unknown> = {}
          const nextSurfaces = openChatSurfacesRef.current.map(candidate => {
            if (candidate.instanceId !== surface.instanceId) return candidate
            const currentState = candidate.tileState && typeof candidate.tileState === 'object' ? candidate.tileState : {}
            if (typeof msg.params?.key === 'string') {
              nextSurfaceState = { ...currentState, [msg.params.key]: msg.params.value }
            } else {
              const data = msg.params?.data ?? msg.params ?? {}
              nextSurfaceState = data && typeof data === 'object' && !Array.isArray(data)
                ? { ...(data as Record<string, unknown>) }
                : {}
            }
            return { ...candidate, tileState: nextSurfaceState }
          })
          openChatSurfacesRef.current = nextSurfaces
          setOpenChatSurfaces(nextSurfaces)
          reply(true)
          return
        }

        if (msg.method === 'context.get') {
          const key = String(msg.params?.key ?? '')
          reply(Object.prototype.hasOwnProperty.call(surface.context, key) ? surface.context[key] ?? null : null)
          return
        }

        if (msg.method === 'context.set') {
          const key = String(msg.params?.key ?? '')
          const value = msg.params?.value ?? null
          setOpenChatSurfaces(prev => prev.map(candidate => candidate.instanceId === surface.instanceId
            ? { ...candidate, context: { ...candidate.context, [key]: value } }
            : candidate))
          for (const peer of getChatSurfacePeerEntries(surface.instanceId)) {
            postToChatSurface(peer.peerId, {
              type: 'contex-event',
              event: 'context.peerChanged',
              data: { peerId: surface.instanceId, key, value },
            })
          }
          reply(true)
          return
        }

        if (msg.method === 'context.getAll') {
          const tagPrefix = typeof msg.params?.tagPrefix === 'string' ? msg.params.tagPrefix : undefined
          reply(Object.entries(surface.context)
            .filter(([key]) => !tagPrefix || key.startsWith(tagPrefix))
            .map(([key, value]) => ({ key, value })))
          return
        }

        if (msg.method === 'context.delete') {
          const key = String(msg.params?.key ?? '')
          setOpenChatSurfaces(prev => prev.map(candidate => {
            if (candidate.instanceId !== surface.instanceId) return candidate
            const nextContext = { ...candidate.context }
            delete nextContext[key]
            return { ...candidate, context: nextContext }
          }))
          for (const peer of getChatSurfacePeerEntries(surface.instanceId)) {
            postToChatSurface(peer.peerId, {
              type: 'contex-event',
              event: 'context.peerChanged',
              data: { peerId: surface.instanceId, key, value: null },
            })
          }
          reply(true)
          return
        }

        if (msg.method === 'context.getPeerContext') {
          const peerId = String(msg.params?.peerId ?? '')
          const peer = openChatSurfacesRef.current.find(candidate => candidate.instanceId === peerId)
          const tagPrefix = typeof msg.params?.tagPrefix === 'string' ? msg.params.tagPrefix : undefined
          reply(peer
            ? Object.entries(peer.context)
              .filter(([key]) => !tagPrefix || key.startsWith(tagPrefix))
              .map(([key, value]) => ({ key, value }))
            : [])
          return
        }

        if (msg.method === 'context.getAllPeerContext') {
          const tagPrefix = typeof msg.params?.tagPrefix === 'string' ? msg.params.tagPrefix : undefined
          const result: Record<string, Array<{ key: string; value: unknown }>> = {}
          for (const peer of getChatSurfacePeerEntries(surface.instanceId)) {
            result[peer.peerId] = peer.contextEntries.filter(entry => !tagPrefix || entry.key.startsWith(tagPrefix))
          }
          reply(result)
          return
        }

        if (msg.method === 'actions.register') {
          const name = String(msg.params?.name ?? '')
          const description = String(msg.params?.description ?? '')
          if (!name) throw new Error('Missing action name')
          setOpenChatSurfaces(prev => prev.map(candidate => candidate.instanceId === surface.instanceId
            ? {
              ...candidate,
              registeredActions: [
                ...candidate.registeredActions.filter(action => action.name !== name),
                { name, description },
              ],
            }
            : candidate))
          reply(true)
          return
        }

        if (msg.method === 'actions.invoke') {
          const peerId = String(msg.params?.peerId ?? '')
          const action = String(msg.params?.action ?? '')
          const peer = openChatSurfacesRef.current.find(candidate => candidate.instanceId === peerId)
          if (!peerId || !action || !peer) throw new Error('Missing peerId or action')
          if (!peer.registeredActions.some(candidate => candidate.name === action)) {
            throw new Error(`Peer ${peer.label} has not registered action ${action}`)
          }
          const requestId = `${surface.instanceId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
          const result = await new Promise<unknown>((resolve, reject) => {
            pendingChatSurfaceActionResultsRef.current.set(requestId, { resolve, reject })
            postToChatSurface(peer.instanceId, {
              type: 'contex-action-invoke',
              action,
              params: msg.params?.params ?? {},
              requestId,
            })
            window.setTimeout(() => {
              const pending = pendingChatSurfaceActionResultsRef.current.get(requestId)
              if (!pending) return
              pendingChatSurfaceActionResultsRef.current.delete(requestId)
              reject(new Error(`Timed out waiting for ${peer.label}.${action}`))
            }, 10000)
          })
          reply(result)
          return
        }

        throw new Error(`Unsupported chat surface RPC method: ${String(msg.method ?? '')}`)
      } catch (error) {
        reply(null, error instanceof Error ? error.message : String(error))
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [chatSurfaceMenu, chatSurfaceThemeColors, chatSurfaceThemeVars, getChatSurfaceIframe, getChatSurfacePeerEntries, openChatSurface, postToChatSurface])

  const handleTileDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Ignore our own internal drags (queued-turn reorder, etc.) — they
    // advertise themselves via a custom mime type so we don't mistake the
    // drag for a file drop and trigger the attachment overlay.
    const dt = e.dataTransfer
    if (dt.types.includes('application/x-codesurf-queued-turn')) return
    const hasFiles = dt.types.includes('Files')
    const hasUri = dt.types.includes('text/uri-list')
    const hasPlain = dt.types.includes('text/plain')
    const hasFileRef = dt.types.includes('application/file-reference-path')
    if (!hasFiles && !hasUri && !hasPlain && !hasFileRef) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setIsDropTarget(true)
  }, [])

  const handleTileDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDropTarget(false)
  }, [])

  const handleTileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Bail out of file-attachment handling when this is an internal drag
    // (queued-turn reorder). The inner handlers already did the work and
    // the text/plain payload is a queue id, not a path.
    if (e.dataTransfer.types.includes('application/x-codesurf-queued-turn')) {
      setIsDropTarget(false)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    setIsDropTarget(false)
    // Check file-reference-path first (from FileTile drags), then fall back to generic extraction
    const fileRef = e.dataTransfer.getData('application/file-reference-path')
    const droppedPaths = fileRef ? [fileRef] : getDroppedPaths(e.dataTransfer)
    if (droppedPaths.length === 0) return
    addAttachments(droppedPaths)
  }, [addAttachments])

  const selectAcItem = useCallback((item: AutocompleteItem) => {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart ?? input.length
    const textBefore = input.slice(0, pos)
    const textAfter = input.slice(pos)

    // Find the trigger start position
    let triggerStart = pos
    if (acType === 'slash') {
      const match = textBefore.match(/(^|\s)(\/\w*)$/)
      if (match) triggerStart = pos - match[2].length
    } else if (acType === 'mention') {
      const match = textBefore.match(/@[\w./]*$/)
      if (match) triggerStart = pos - match[0].length
    }

    const replacement = item.value + ' '
    const newVal = input.slice(0, triggerStart) + replacement + textAfter
    setInput(newVal)
    if (item.attachPath) {
      const attachPath = item.attachPath
      setAttachments(prev => {
        if (prev.some(existing => existing.path === attachPath)) return prev
        return [...prev, { path: attachPath, kind: isImagePath(attachPath) ? 'image' : 'file' }]
      })
    }
    setAcType(null)
    setAcQuery('')

    // Restore focus and cursor position after React re-render
    requestAnimationFrame(() => {
      syncComposerHeight()
      if (ta) {
        ta.focus()
        const newPos = triggerStart + replacement.length
        ta.setSelectionRange(newPos, newPos)
      }
    })
  }, [input, acType, syncComposerHeight])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ─── Push-to-talk: hold spacebar (when input empty) to record ────────
    // Only triggers when the draft is empty so we don't break normal typing.
    // The keyup handler on the textarea stops recording when the key is released.
    // e.repeat guards against the auto-repeat keydown stream after the first event.
    if (
      e.key === ' '
      && !e.repeat
      && !e.metaKey && !e.ctrlKey && !e.altKey
      && input.length === 0
      && !isDictating
    ) {
      e.preventDefault()
      toggleDictation()
      return
    }
    // While recording, swallow further space events on the textarea so the
    // recognizer's audio gathering isn't visually polluted by " " characters
    // landing in the input. (We append the transcript on stop.)
    if (e.key === ' ' && isDictating) {
      e.preventDefault()
      return
    }

    // Autocomplete keyboard navigation
    if (acType && acItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAcIndex(i => (i + 1) % acItems.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAcIndex(i => (i - 1 + acItems.length) % acItems.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectAcItem(acItems[acIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setAcType(null)
        setAcQuery('')
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage, acType, acItems, acIndex, selectAcItem, input.length, isDictating, toggleDictation])

  // Release push-to-talk on space-up. toggleDictation is idempotent — safe
  // even if the user held space without ever entering recording mode (e.g.
  // ignored because the input wasn't empty).
  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === ' ' && isDictating) {
      e.preventDefault()
      toggleDictation()
    }
  }, [isDictating, toggleDictation])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleComposerInputChange(e, setInput, syncComposerHeight)
  }, [handleComposerInputChange, syncComposerHeight])

  const isStartScreen = messages.length === 0 && !isStreaming

  const openMiniChat = useCallback(() => {
    if (!workspaceId) return
    void window.electron?.window?.openMiniChat?.({
      workspaceId,
      tileId,
      title: messages[0]?.content?.trim().slice(0, 80) || 'CodeSurf chat',
    }).catch(error => {
      console.warn('[ChatTile] failed to open mini chat window:', error)
    })
  }, [messages, tileId, workspaceId])

  const fontCtxValue = useMemo(() => ({ sans: fontSans, secondary: fontSecondary, mono: fontMono, size: fontSize, monoSize, lineHeight: fontLineHeight, weight: fontWeight, monoLineHeight, monoWeight, secondarySize, secondaryLineHeight, secondaryWeight }), [fontSans, fontSecondary, fontMono, fontSize, monoSize, fontLineHeight, fontWeight, monoLineHeight, monoWeight, secondarySize, secondaryLineHeight, secondaryWeight])

  const chatDispatchValue = useMemo<ChatDispatchValue>(() => ({
    sendAnswer: async (text: string) => {
      await dispatchMessageContent(text)
    },
  }), [dispatchMessageContent])

  return (
    <ChatDispatchCtx.Provider value={chatDispatchValue}>
    <FontCtx.Provider value={fontCtxValue}>
    <AskUserQuestionFontsContext.Provider value={fontCtxValue}>
    <AskUserQuestionContext.Provider value={{ cardId: tileId }}>
    <CheckpointRestoreContext.Provider value={checkpointRestoreContextValue}>
    <ToolPermissionProvider
      cardId={tileId}
      pending={pendingToolPermissions}
      resolved={resolvedToolPermissions}
      onDecide={handleToolPermissionDecision}
    >
    <div
      className="cs-chat-shell"
      onDragOver={handleTileDragOver}
      onDragLeave={handleTileDragLeave}
      onDrop={handleTileDrop}
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: chatViewportBackground, color: theme.chat.text,
        fontFamily: fontSans, fontSize, lineHeight: fontLineHeight, fontWeight,
        position: 'relative',
      }}
    >

      {/* Horizontal split: [transcript + composer column] | [plan pane] */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        minHeight: 0,
        minWidth: 0,
      }}>
      <ChatTileTranscriptColumn
        isStartScreen={isStartScreen}
        messagesRef={messagesRef}
        handleMessagesScroll={handleMessagesScroll}
        handleMessagesWheel={handleMessagesWheel}
        handleMessagesKeyDown={handleMessagesKeyDown}
        hiddenMessageCount={hiddenMessageCount}
        renderedMessages={renderedMessages}
        pagedLinkedHistoryEnabled={pagedLinkedHistoryEnabled}
        loadingEarlier={loadingEarlier}
        earlierLoadError={earlierLoadError}
        isStreaming={isStreaming}
        toolCollapseTick={toolCollapseTick}
        explodedChipGroups={explodedChipGroups}
        toggleExplodedChipGroup={toggleExplodedChipGroup}
        updateBlockNote={updateBlockNote}
        setAnnotationComposerActive={setAnnotationComposerActive}
        readAttachmentPaths={readAttachmentPaths}
        fontSize={fontSize}
        fontLineHeight={fontLineHeight}
        fontMono={fontMono}
        monoSize={monoSize}
        ttsState={ttsState}
        voiceSettings={voiceSettings}
        showScrollToLatest={showScrollToLatest}
        scrollToLatest={scrollToLatest}
        liveComposerActivityChip={liveComposerActivityChip}
        latestChangeDrawer={latestChangeDrawer}
        latestChangeDrawerHasStats={latestChangeDrawerHasStats}
        latestChangeDrawerExpanded={latestChangeDrawerExpanded}
        latestChangeDrawerExpandedFiles={latestChangeDrawerExpandedFiles}
        latestCheckpointId={latestCheckpointId}
        isRestoringLatestCheckpoint={isRestoringLatestCheckpoint}
        fontSans={fontSans}
        onToggleLatestChangeDrawerExpanded={() => setLatestChangeDrawerExpanded(v => !v)}
        onToggleLatestChangeDrawerFile={toggleLatestChangeDrawerFile}
        onRestoreLatestCheckpoint={() => { void restoreLatestCheckpoint() }}
        onReviewLatestChanges={reviewLatestChanges}
        queuedTurns={queuedTurns}
        queueCollapsed={queueCollapsed}
        draggingTurnId={draggingTurnId}
        dragOverTurn={dragOverTurn}
        onToggleQueueCollapsed={() => setQueueCollapsed(v => !v)}
        onSetDraggingTurnId={setDraggingTurnId}
        onSetDragOverTurn={setDragOverTurn}
        onReorderQueuedTurn={reorderQueuedTurn}
        onSteerQueuedTurn={handleQueuedTurnSteer}
        onDeleteQueuedTurn={(turnId) => {
          const remaining = queuedTurns.filter(item => item.id !== turnId)
          setQueuedTurns(remaining)
          flushQueueStateNow(remaining)
          logQueueEvent('delete', { queueId: turnId })
        }}
      >
        <ChatTileComposer
          isStartScreen={isStartScreen}
          isDropTarget={isDropTarget}
          composerBackground={composerBackground}
          composerBorder={composerBorder}
          acRef={acRef}
          acType={acType}
          acQuery={acQuery}
          acItems={acItems}
          acIndex={acIndex}
          fontSans={fontSans}
          fontMono={fontMono}
          onAcHoverIndex={setAcIndex}
          onAcSelect={selectAcItem}
          isDictating={isDictating}
          dictationText={dictationText}
          dictationError={dictationError}
          ttsState={ttsState}
          onStopVoicePlayback={() => bargeIn()}
          openChatSurfaces={openChatSurfaces}
          activeChatSurface={activeChatSurface}
          chatSurfaceMenu={chatSurfaceMenu}
          onActivateSurface={setActiveChatSurfaceId}
          onCloseSurface={closeChatSurface}
          onOpenBuilderFromSketch={() => { void openBuilderFromSketch() }}
          onSetSurfaceIframeRef={setChatSurfaceIframeRef}
          attachments={attachments}
          onRemoveAttachment={removeAttachment}
          textareaRef={textareaRef}
          input={input}
          fontSize={fontSize}
          fontLineHeight={fontLineHeight}
          onInputChange={handleInputChange}
          onInputKeyDown={handleKeyDown}
          onInputKeyUp={handleKeyUp}
          insertMenuRef={insertMenuRef}
          showInsertMenu={showInsertMenu}
          onToggleMenu={toggleMenu}
          onAttachFiles={openAttachmentPicker}
          mcpEnabled={mcpEnabled}
          onToggleMcpEnabled={() => setMcpEnabled(v => !v)}
          mcpServers={mcpServers}
          disabledServers={disabledServers}
          setDisabledServers={setDisabledServers}
          peerToolNames={peerToolNames}
          onOpenChatSurface={openChatSurface}
          showProviderPicker={messages.length === 0}
          providerMenuRef={providerMenuRef}
          showProviderMenu={showProviderMenu}
          providerEntries={providerEntries}
          provider={provider}
          onProviderChange={handleProviderChange}
          modelMenuRef={modelMenuRef}
          showModelMenu={showModelMenu}
          currentProviderEntry={currentProviderEntry}
          currentModelLabel={currentModel.label}
          model={model}
          modelFilter={modelFilter}
          onModelFilterChange={setModelFilter}
          optionNoun={optionNoun}
          onSelectModel={(id) => { setModel(id); setShowModelMenu(false); setModelFilter('') }}
          thinkingMenuRef={thinkingMenuRef}
          showThinkingMenu={showThinkingMenu}
          thinking={thinking}
          thinkingOptions={thinkingOptions}
          onSelectThinking={(id) => { setThinking(id); setShowThinkingMenu(false) }}
          onOpenMiniChat={openMiniChat}
          isStreaming={isStreaming}
          lastActivityAtRef={lastActivityAtRef}
          onToggleDictation={toggleDictation}
          hasSendableDraft={hasSendableDraft}
          onStopStreaming={stopStreaming}
          onSendMessage={sendMessage}
          locationMenuRef={locationMenuRef}
          showLocationMenu={showLocationMenu}
          executionTarget={executionTarget}
          locationLabel={locationLabel}
          localExecutionLabel={localExecutionLabel}
          normalizedRepoRoot={normalizedRepoRoot}
          remoteHosts={remoteHosts}
          activeCloudHost={activeCloudHost}
          onSelectLocalExecution={() => {
            setExecutionTarget('local')
            setShowLocationMenu(false)
          }}
          onSelectCloudExecution={() => {
            if (remoteHosts.length > 0) {
              setExecutionTarget('cloud')
              setCloudHostId(activeCloudHost?.id ?? remoteHosts[0].id)
            }
            setShowLocationMenu(false)
          }}
          onSelectRemoteHost={hostId => {
            setExecutionTarget('cloud')
            setCloudHostId(hostId)
            setShowLocationMenu(false)
          }}
          branchMenuRef={branchMenuRef}
          showBranchMenu={showBranchMenu}
          isGitRepo={isGitRepo}
          filteredBranches={filteredBranches}
          branchFilter={branchFilter}
          branchMenuCreateEnabled={branchMenuCreateEnabled}
          currentBranchLabel={currentBranchLabel}
          projectFolderName={projectFolderName}
          changedCount={gitStatus.changedCount}
          onBranchFilterChange={setBranchFilter}
          onSelectBranch={handleBranchSelect}
          onCreateBranch={handleCreateBranch}
          activeProjectPathLabel={activeProjectPathLabel}
          onProjectFolderSwitch={handleProjectFolderSwitch}
          modeMenuRef={modeMenuRef}
          showModeMenu={showModeMenu}
          mode={mode}
          currentMode={currentMode}
          modeOptions={modeOptions}
          onSelectMode={modeId => {
            setMode(modeId)
            onChatModePreferenceChange?.(provider, modeId)
            setShowModeMenu(false)
          }}
          planTodos={planTodos}
          isPlanOpen={isPlanOpen}
          onTogglePlanOpen={() => setIsPlanOpen(v => !v)}
          contextMenuRef={contextMenuRef}
          showContextMenu={showContextMenu}
          contextUsageRatio={contextUsageRatio}
          contextUsagePercent={contextUsagePercent}
          estimatedContextTokens={estimatedContextTokens}
          contextWindowLimit={contextWindowLimit}
          systemOverheadTokens={systemOverheadTokens}
        />
      </ChatTileTranscriptColumn>
      {isPlanOpen && planTodos && planTodos.length > 0 && (
        <PlanPane
          todos={planTodos}
          updatedAt={planUpdatedAt}
          onClose={() => setIsPlanOpen(false)}
        />
      )}
      </div>
    </div>
    </ToolPermissionProvider>
    </CheckpointRestoreContext.Provider>
    </AskUserQuestionContext.Provider>
    </AskUserQuestionFontsContext.Provider>
    </FontCtx.Provider>
    </ChatDispatchCtx.Provider>
  )
}
