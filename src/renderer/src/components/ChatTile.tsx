import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type {
  AppSettings,
  SkillDefinition,
} from '../../../shared/types'
import { basename, getDroppedPaths, isImagePath } from '../utils/dnd'

import { CODESURF_OPEN_CHAT_SURFACE_EVENT, normalizeOpenChatSurfaceDetail } from '../utils/appLaunchRequests'
import {
  ChevronDown, AlertTriangle,
  ArrowUp, ArrowDown, Square, MessageSquare, Bot,
  Brain, ChevronRight, CornerDownRight,
  GripVertical, Maximize2, Mic, Plus, Trash2
} from 'lucide-react'
import { useChatGitState } from '../hooks/useChatGitState'
import { useMCPServers } from '../hooks/useMCPServers'
import { useAutoSpeak, speakMessage, bargeIn } from '../hooks/useAutoSpeak'
import { ttsPlayer, type TtsPlayerState } from '../utils/ttsPlayer'
import { useChatDictation } from '../hooks/useChatDictation'
import { useChatExecutionHosts } from '../hooks/useChatExecutionHosts'
import { useChatTileCoreState } from '../hooks/useChatTileCoreState'
import { useChatTileProviders } from '../hooks/useChatTileProviders'
import { useChatTilePersistence } from '../hooks/useChatTilePersistence'
import { useChatTileMessaging } from '../hooks/useChatTileMessaging'
import { useChatTileTranscript } from '../hooks/useChatTileTranscript'

import { useTheme } from '../ThemeContext'
import { WorkingDots } from './shared/streamdown-utils'
import { DiffView } from './chat/DiffView'
import { normalizeMessagesForMemory, estimateMessageChars } from './chat/messageNormalization'
import {
  getApproxContextWindowTokens,
  getApproxSystemOverheadTokens,
} from '../config/providers'
import { stripCapabilityPrefix, getAllNodeTools } from '../../../shared/nodeTools'
import type { ToolBlock, ChatMessage, BlockNote, FileChange } from '../../../shared/chat-types'
import { useChatStreamHandler } from '../hooks/useChatStreamHandler'


import { BlockNoteAffordance } from './chat/BlockNoteAffordance'
import { setChatStreaming } from './chatStreamingStore'
import { setTileTodos, clearTileTodos, useTileTodos, type TileTodoItem } from '../state/tileTodosStore'
import { CUSTOMISATION_LOCATIONS_CHANGED_EVENT, type CustomisationLocationsChangedDetail } from './CustomisationTile'
import { PlanPane } from './chat/PlanPane'
import { PlanChip } from './chat/PlanChip'

import { ToolPermissionProvider } from './ai-elements/ToolPermission'
import { handleBasicChatSurfaceRpc } from './chatSurfaceHostRpc'
import { isCheckpointToolBlock } from './chat/checkpointToolActions'
import { DREAM_TOOL_ID_PREFIX, DREAM_TOOL_NAME, isDreamToolBlock } from './chat/dreamToolActions'
import { CHAT_STREAM_FLUSH_INTERVAL_MS } from './chat/largeContent'
import { ChatComposerAttachments, ChatComposerAutocompletePopup, ChatComposerBranchMenu, ChatComposerCard, ChatComposerContextUsageDial, ChatComposerDrawerFrame, ChatComposerInput, ChatComposerLocationMenu, ChatComposerModeMenu, ChatComposerPrimaryToolbar, ChatComposerProjectPathButton, ChatComposerSecondaryToolbar, ChatComposerSurfaceHost, ChatComposerVoiceStatus, ChatComposerWrap } from './chat/ChatComposer'
import { useChatAutocomplete, CHAT_SLASH_COMMANDS, type AutocompleteItem } from '../hooks/useChatAutocomplete'
import { useContributions } from '../hooks/useContributions'
import { type PaletteCommand } from '../lib/commandRegistry'
import { ToolbarBtn, ToolbarPill } from './chat/ChatComposerControls'
import { ComposerInsertMenu, Dropdown, DropdownItem, MenuPortal, ModelDropdown, type ChatSurfaceMenuEntry } from './chat/ChatComposerMenus'
import {
  AskUserQuestionContext,
  AskUserQuestionFontsContext,
} from './chat/AskUserQuestionForm'
import {
  ThinkingBlockView,
  WorkingChipView,
  StreamingLivenessIndicator,
  MixedToolGroup,
  CollapsedToolGroup,
  ToolGroupChip,
  ToolMegaChip,
  ToolBlockView,
  parsePlanToolTodos,
} from './chat/ToolBlockView'
import { collateClusterChips, type ClusterChip } from './chat/toolChipCollation'
import {
  ThinkingIcon,
  renderChatSurfaceIcon,
  normalizeChatSurfaceMenuEntry,
  ensureChatMdStyle,
  ChatMessageContent,
} from './chat/ChatTileViews'
import {
  CHAT_CHIP_ROW_STYLE,
  FONT_SANS,
  FONT_MONO,
  FONT_SIZE_DEFAULT,
  MONO_SIZE_DEFAULT,
  CHAT_MESSAGE_MAX_WIDTH,
  CHAT_OFFSCREEN_MESSAGE_STYLE,

  CHAT_COMPOSER_WIDTH,
  CHAT_COMPOSER_MIN_WIDTH_STYLE,
  CHAT_COMPOSER_MIN_HEIGHT,
  CHAT_COMPOSER_TEXTAREA_MIN_HEIGHT,

  TOOLBAR_ICON_SIZE,
  TOOLBAR_PILL_ICON_SIZE,
  LIVE_TOOL_COLLAPSE_GRACE_MS,
} from './chat/chatTileLayout'
import { FontCtx } from './chat/chatTileContexts'
import {
  CHAT_DEFAULT_SKILL_LOCATIONS,
  resolveChatSkillLocations,
  shouldRenderToolBlock,
  isUrgentQueuedContent,
  getImplicitPeerImageAttachments,
  collectModelReadPaths,
  canUsePagedLinkedHistory,
  hasVisibleFileChangeStats,
  hasRenderableFileChangeDiff,
  getExternalAgentToolBlocks,
  isExternalAgentToolOnlyText,
  relativeTime,
  type ActiveChatSurface,
  type DiscoveryPeer,
} from './chat/chatTileUtils'

export {
  hasVisibleFileChangeStats,
  hasRenderableFileChangeDiff,
  getToolDisplayName,
} from './chat/chatTileUtils'

// --- Types -----------------------------------------------------------------------

type LatestChangeDrawerState = {
  key: string
  messageId: string
  toolBlockId: string
  fileChanges: FileChange[]
  fileCount: number
  additions: number
  deletions: number
  changeBlockCount: number
}

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

export interface CheckpointRestoreContextValue {
  workspaceId: string | null
  tileId: string
  restoringCheckpointId: string | null
  restoreCheckpoint: (checkpointId: string, sessionEntryId: string, label?: string) => Promise<void>
}

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
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showProviderMenu, setShowProviderMenu] = useState(false)
  const [showInsertMenu, setShowInsertMenu] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [showThinkingMenu, setShowThinkingMenu] = useState(false)
  const [showLocationMenu, setShowLocationMenu] = useState(false)
  const [showBranchMenu, setShowBranchMenu] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(false)
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
    onProviderChanged: () => setShowProviderMenu(false),
  })
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
  const [modelFilter, setModelFilter] = useState('')
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
  const [branchFilter, setBranchFilter] = useState('')
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
  const { acType, setAcType, acQuery, setAcQuery, acIndex, setAcIndex, acItems } = useChatAutocomplete({
    workspaceDir: _workspaceDir,
    connectedPeers,
    workspaceSkills,
    pluginSlashCommands,
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const acRef = useRef<HTMLDivElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const providerMenuRef = useRef<HTMLDivElement>(null)
  const insertMenuRef = useRef<HTMLDivElement>(null)
  const modeMenuRef = useRef<HTMLDivElement>(null)
  const thinkingMenuRef = useRef<HTMLDivElement>(null)
  const locationMenuRef = useRef<HTMLDivElement>(null)
  const branchMenuRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const mergeDrawerFileChanges = useCallback((fileChanges: FileChange[]): FileChange[] => {
    const merged = new Map<string, FileChange>()
    for (const change of fileChanges) {
      const key = `${change.path}::${change.previousPath ?? ''}::${change.changeType}`
      const existing = merged.get(key)
      if (!existing) {
        merged.set(key, { ...change })
        continue
      }
      existing.additions += change.additions
      existing.deletions += change.deletions
      existing.diff = `${existing.diff}\n\n${change.diff}`.trim()
    }
    return Array.from(merged.values())
  }, [])

  const latestChangeDrawer = useMemo<LatestChangeDrawerState | null>(() => {
    const batchMessages: ChatMessage[] = []
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
      const message = messages[messageIndex]
      if (message.role === 'user') break
      batchMessages.unshift(message)
    }
    if (batchMessages.length === 0) return null

    const rawFileChanges: FileChange[] = []
    let latestMessageId: string | null = null
    let latestToolBlockId: string | null = null
    let changeBlockCount = 0

    for (const message of batchMessages) {
      for (const block of message.toolBlocks ?? []) {
        const fileChanges = block.fileChanges ?? []
        if (fileChanges.length === 0) continue
        changeBlockCount += 1
        rawFileChanges.push(...fileChanges)
        latestMessageId = message.id
        latestToolBlockId = block.id
      }
    }

    if (rawFileChanges.length === 0 || !latestMessageId || !latestToolBlockId) return null

    const fileChanges = mergeDrawerFileChanges(rawFileChanges)
    return {
      key: `${latestMessageId}:${latestToolBlockId}:${changeBlockCount}:${fileChanges.length}`,
      messageId: latestMessageId,
      toolBlockId: latestToolBlockId,
      fileChanges,
      fileCount: fileChanges.length,
      additions: fileChanges.reduce((sum, change) => sum + change.additions, 0),
      deletions: fileChanges.reduce((sum, change) => sum + change.deletions, 0),
      changeBlockCount,
    }
  }, [messages, mergeDrawerFileChanges])
  const latestChangeDrawerHasStats = latestChangeDrawer ? hasVisibleFileChangeStats(latestChangeDrawer) : false
  const liveComposerActivityChip = useMemo(() => {
    if (!isStreaming) return null
    const liveMsg = renderedMessages[renderedMessages.length - 1]
    if (!liveMsg || liveMsg.role !== 'assistant' || !liveMsg.isStreaming) return null

    const activeThinking = liveMsg.thinkingBlocks?.find(tb => !tb.done)
      ?? (!(liveMsg.contentBlocks ?? []).some(b => b.type === 'thinking') && liveMsg.thinking && !liveMsg.thinking.done
        ? liveMsg.thinking
        : null)

    return (
      <div style={{
        width: CHAT_COMPOSER_WIDTH,
        minWidth: CHAT_COMPOSER_MIN_WIDTH_STYLE,
        margin: '0 auto',
        paddingTop: 4,
        paddingBottom: 4,
        position: 'relative',
        zIndex: 2,
      }}>
        {activeThinking
          ? <ThinkingBlockView thinking={activeThinking} />
          : <WorkingChipView message={liveMsg} />
        }
      </div>
    )
  }, [isStreaming, renderedMessages])
  const [latestChangeDrawerExpanded, setLatestChangeDrawerExpanded] = useState(false)
  const [latestChangeDrawerExpandedFiles, setLatestChangeDrawerExpandedFiles] = useState<Record<string, boolean>>({})
  const [latestCheckpointId, setLatestCheckpointId] = useState<string | null>(null)
  const [isRestoringLatestCheckpoint, setIsRestoringLatestCheckpoint] = useState(false)
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<string | null>(null)

  useEffect(() => {
    if (!latestChangeDrawer) {
      setLatestCheckpointId(null)
      return
    }

    // Default the drawer to collapsed whenever a new change block arrives
    // (including on initial mount / reload). Users can expand on demand.
    setLatestChangeDrawerExpanded(false)
    setLatestChangeDrawerExpandedFiles({})
  }, [latestChangeDrawer?.key])

  useEffect(() => {
    let cancelled = false
    if (!workspaceId || !latestChangeDrawer) {
      setLatestCheckpointId(null)
      return
    }

    void window.electron.canvas
      .listCheckpoints(workspaceId, `codesurf-runtime:${tileId}`)
      .then(checkpoints => {
        if (cancelled) return
        const undoIndex = Math.max(0, (latestChangeDrawer.changeBlockCount ?? 1) - 1)
        setLatestCheckpointId(checkpoints[undoIndex]?.id ?? checkpoints[0]?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) setLatestCheckpointId(null)
      })

    return () => { cancelled = true }
  }, [workspaceId, tileId, latestChangeDrawer?.key])

  const toggleLatestChangeDrawerFile = useCallback((key: string) => {
    setLatestChangeDrawerExpandedFiles(prev => ({ ...prev, [key]: !(prev[key] ?? false) }))
  }, [])

  const restoreLatestCheckpoint = useCallback(async () => {
    if (!workspaceId || !latestCheckpointId || isRestoringLatestCheckpoint) return
    setIsRestoringLatestCheckpoint(true)
    try {
      const result = await window.electron.canvas.restoreCheckpoint(workspaceId, latestCheckpointId, `codesurf-runtime:${tileId}`)
      if (!result.ok) {
        const errorText = result.error ?? 'Checkpoint restore failed'
        setMessagesSafe(prev => [...prev, {
          id: `msg-restore-checkpoint-error-${Date.now()}`,
          role: 'assistant',
          content: `Undo failed: ${errorText}`,
          timestamp: Date.now(),
        }])
        return
      }
      const restoredParts: string[] = []
      if (typeof result.filesRestored === 'number' && result.filesRestored > 0) {
        restoredParts.push(`${result.filesRestored} restored`)
      }
      if (typeof result.filesDeleted === 'number' && result.filesDeleted > 0) {
        restoredParts.push(`${result.filesDeleted} deleted`)
      }
      const suffix = restoredParts.length > 0 ? ` (${restoredParts.join(', ')})` : ''
      setMessagesSafe(prev => [...prev, {
        id: `msg-restore-checkpoint-${Date.now()}`,
        role: 'assistant',
        content: `Restored the latest checkpoint before those changes${suffix}.`,
        timestamp: Date.now(),
      }])
      setLatestCheckpointId(null)
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      setMessagesSafe(prev => [...prev, {
        id: `msg-restore-checkpoint-error-${Date.now()}`,
        role: 'assistant',
        content: `Undo failed: ${errorText}`,
        timestamp: Date.now(),
      }])
    } finally {
      setIsRestoringLatestCheckpoint(false)
    }
  }, [workspaceId, tileId, latestCheckpointId, isRestoringLatestCheckpoint, setMessagesSafe])

  const restoreCheckpointFromToolBlock = useCallback(async (checkpointId: string, sessionEntryId: string, label = 'checkpoint') => {
    if (!workspaceId || !checkpointId || !sessionEntryId || restoringCheckpointId || isRestoringLatestCheckpoint) return
    setRestoringCheckpointId(checkpointId)
    try {
      const result = await window.electron.canvas.restoreCheckpoint(workspaceId, checkpointId, sessionEntryId)
      if (!result.ok) {
        const errorText = result.error ?? 'Checkpoint restore failed'
        setMessagesSafe(prev => [...prev, {
          id: `msg-restore-checkpoint-error-${Date.now()}`,
          role: 'assistant',
          content: `Restore failed: ${errorText}`,
          timestamp: Date.now(),
        }])
        return
      }
      const restoredParts: string[] = []
      if (typeof result.filesRestored === 'number' && result.filesRestored > 0) {
        restoredParts.push(`${result.filesRestored} restored`)
      }
      if (typeof result.filesDeleted === 'number' && result.filesDeleted > 0) {
        restoredParts.push(`${result.filesDeleted} deleted`)
      }
      const suffix = restoredParts.length > 0 ? ` (${restoredParts.join(', ')})` : ''
      setMessagesSafe(prev => [...prev, {
        id: `msg-restore-checkpoint-${Date.now()}`,
        role: 'assistant',
        content: `Restored checkpoint: ${label}${suffix}.`,
        timestamp: Date.now(),
      }])
      if (latestCheckpointId === checkpointId) setLatestCheckpointId(null)
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      setMessagesSafe(prev => [...prev, {
        id: `msg-restore-checkpoint-error-${Date.now()}`,
        role: 'assistant',
        content: `Restore failed: ${errorText}`,
        timestamp: Date.now(),
      }])
    } finally {
      setRestoringCheckpointId(current => current === checkpointId ? null : current)
    }
  }, [workspaceId, restoringCheckpointId, isRestoringLatestCheckpoint, latestCheckpointId, setMessagesSafe])

  const checkpointRestoreContextValue = useMemo<CheckpointRestoreContextValue>(() => ({
    workspaceId: workspaceId ?? null,
    tileId,
    restoringCheckpointId,
    restoreCheckpoint: restoreCheckpointFromToolBlock,
  }), [workspaceId, tileId, restoringCheckpointId, restoreCheckpointFromToolBlock])

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

  // Close dropdowns on outside click or Escape
  const anyMenuOpen = showModelMenu || showProviderMenu || showInsertMenu || showModeMenu || showThinkingMenu || showLocationMenu || showBranchMenu || showContextMenu
  const menuRefs = [modelMenuRef, providerMenuRef, insertMenuRef, modeMenuRef, thinkingMenuRef, locationMenuRef, branchMenuRef, contextMenuRef]

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      const targetEl = e.target instanceof Element ? e.target : null
      // If click is inside any menu button or portaled dropdown, let the menu handle it.
      const insideAnyMenu = menuRefs.some(ref => ref.current?.contains(target))
        || Boolean(targetEl?.closest('[data-chat-menu-portal="true"]'))
      if (insideAnyMenu) return
      // Click is outside all menus — close everything
      setShowModelMenu(false)
      setShowProviderMenu(false)
      setShowInsertMenu(false)
      setShowModeMenu(false)
      setShowThinkingMenu(false)
      setShowLocationMenu(false)
      setShowBranchMenu(false)
      setShowContextMenu(false)
      if (acRef.current && !acRef.current.contains(target) && target !== textareaRef.current) {
        setAcType(null)
        setAcQuery('')
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && anyMenuOpen) {
        e.stopPropagation()
        e.preventDefault()
        setShowModelMenu(false)
        setShowProviderMenu(false)
        setShowInsertMenu(false)
        setShowModeMenu(false)
        setShowThinkingMenu(false)
        setShowLocationMenu(false)
        setShowBranchMenu(false)
        setShowContextMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [anyMenuOpen])

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

  const toggleMenu = useCallback((which: 'model' | 'provider' | 'insert' | 'mode' | 'thinking' | 'location' | 'branch' | 'context') => {
    setShowModelMenu(prev => { const next = which === 'model' ? !prev : false; if (!next) setModelFilter(''); return next })
    setShowProviderMenu(prev => which === 'provider' ? !prev : false)
    setShowInsertMenu(prev => which === 'insert' ? !prev : false)
    setShowModeMenu(prev => which === 'mode' ? !prev : false)
    setShowThinkingMenu(prev => which === 'thinking' ? !prev : false)
    setShowLocationMenu(prev => which === 'location' ? !prev : false)
    setShowBranchMenu(prev => { const next = which === 'branch' ? !prev : false; if (!next) setBranchFilter(''); return next })
    setShowContextMenu(prev => which === 'context' ? !prev : false)
  }, [])

  // ─── Voice dictation (via useChatDictation hook) ────────────────────
  // Wire transcriptions into the input state.
  useEffect(() => {
    dictation.onTranscription((text: string) => {
      setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)
    })
  }, [dictation])

  /**
   * Updates or clears the note attached to a specific block. Passing `text === null`
   * deletes the note. Notes are stored inline on the underlying record (message,
   * tool block, or thinking block) so they persist with the conversation.
   */
  const updateBlockNote = useCallback((
    target:
      | { kind: 'message'; messageId: string }
      | { kind: 'tool'; messageId: string; toolBlockId: string }
      | { kind: 'thinking'; messageId: string; thinkingId: string },
    text: string | null,
  ) => {
    const nextNote: BlockNote | null = text && text.trim().length > 0
      ? { text: text.trim(), createdAt: Date.now() }
      : null
    const applyToCollection = (collection: ChatMessage[]): ChatMessage[] => collection.map(msg => {
      if (msg.id !== target.messageId) return msg
      if (target.kind === 'message') {
        if (nextNote) {
          const merged: BlockNote = msg.note
            ? { ...msg.note, text: nextNote.text, updatedAt: Date.now() }
            : nextNote
          return { ...msg, note: merged }
        }
        const { note: _discard, ...rest } = msg
        return rest
      }
      if (target.kind === 'tool') {
        const blocks = msg.toolBlocks?.map(b => {
          if (b.id !== target.toolBlockId) return b
          if (nextNote) {
            const merged: BlockNote = b.note
              ? { ...b.note, text: nextNote.text, updatedAt: Date.now() }
              : nextNote
            return { ...b, note: merged }
          }
          const { note: _discard, ...rest } = b
          return rest
        })
        return { ...msg, toolBlocks: blocks }
      }
      // thinking
      const thinkingBlocks = msg.thinkingBlocks?.map(tb => {
        if (tb.id !== target.thinkingId) return tb
        if (nextNote) {
          const merged: BlockNote = tb.note
            ? { ...tb.note, text: nextNote.text, updatedAt: Date.now() }
            : nextNote
          return { ...tb, note: merged }
        }
        const { note: _discard, ...rest } = tb
        return rest
      })
      return { ...msg, thinkingBlocks }
    })
    setMessagesSafe(prev => applyToCollection(prev))
    setHistoricalMessages(prev => applyToCollection(prev))
  }, [setMessagesSafe])

  /**
   * Collects every attached note from the conversation into a flat array,
   * tagged with the block kind and source snippet so downstream analysis
   * (or export) can surface them with context.
   */
  const collectAllNotes = useCallback((): Array<{
    kind: 'message' | 'tool' | 'thinking'
    messageId: string
    blockId?: string
    role?: string
    context: string
    note: BlockNote
  }> => {
    const out: Array<{ kind: 'message' | 'tool' | 'thinking'; messageId: string; blockId?: string; role?: string; context: string; note: BlockNote }> = []
    for (const m of allMessages) {
      if (m.note) {
        const snippet = m.content.trim().slice(0, 200)
        out.push({ kind: 'message', messageId: m.id, role: m.role, context: snippet, note: m.note })
      }
      for (const tb of m.toolBlocks ?? []) {
        if (tb.note) {
          const snippet = `${tb.name}: ${(tb.summary ?? tb.input ?? '').slice(0, 160)}`
          out.push({ kind: 'tool', messageId: m.id, blockId: tb.id, context: snippet, note: tb.note })
        }
      }
      for (const tk of m.thinkingBlocks ?? []) {
        if (tk.note) {
          const snippet = tk.content.slice(0, 200)
          out.push({ kind: 'thinking', messageId: m.id, blockId: tk.id, context: snippet, note: tk.note })
        }
      }
    }
    return out
  }, [allMessages])

  /** Copies a Markdown-formatted export of all attached notes to the clipboard. */
  const exportNotesToClipboard = useCallback(async () => {
    const notes = collectAllNotes()
    if (notes.length === 0) {
      try { await navigator.clipboard.writeText('# Chat notes\n\n_No notes yet._') } catch { /* ignore */ }
      return
    }
    const lines = ['# Chat notes', '']
    for (const entry of notes) {
      const header = entry.kind === 'message'
        ? `## ${entry.role ?? 'message'}`
        : entry.kind === 'tool'
          ? '## tool call'
          : '## thinking'
      lines.push(header)
      lines.push(`> ${entry.context.replace(/\n/g, ' ')}`)
      lines.push('')
      lines.push(entry.note.text)
      lines.push('')
    }
    const payload = lines.join('\n')
    try { await navigator.clipboard.writeText(payload) } catch { /* ignore */ }
  }, [collectAllNotes])

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
    const val = e.target.value
    setInput(val)
    syncComposerHeight()

    // Detect autocomplete triggers based on cursor position
    const pos = e.target.selectionStart ?? val.length
    const textBefore = val.slice(0, pos)

    // Slash command: `/` at start of input or after a space
    const slashMatch = textBefore.match(/(^|\s)\/(\w*)$/)
    if (slashMatch) {
      setAcType('slash')
      setAcQuery(slashMatch[2])
      setAcIndex(0)
      return
    }

    // @ mention: `@` anywhere
    const mentionMatch = textBefore.match(/@([\w./]*)$/)
    if (mentionMatch) {
      setAcType('mention')
      setAcQuery(mentionMatch[1])
      setAcIndex(0)
      return
    }

    // No trigger active
    setAcType(null)
    setAcQuery('')
  }, [syncComposerHeight])

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
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        justifyContent: isStartScreen ? 'center' : undefined,
      }}>

      {/* Messages */}
      <div
        ref={messagesRef}
        className={`chat-messages ${isStartScreen ? '' : 'cs-fade-scroll-y cs-fade-scroll-y-lg'}`}
        onScroll={handleMessagesScroll}
        onWheel={handleMessagesWheel}
        onKeyDown={handleMessagesKeyDown}
        tabIndex={-1}
        style={{
          flex: isStartScreen ? '0 0 auto' : 1,
          overflowY: isStartScreen ? 'visible' : 'auto',
          padding: isStartScreen ? '12px 14px 4px' : '12px 14px',
          overflowX: 'hidden',
          minHeight: 0,
          // Keep the transcript centerline stable while chat history loads and
          // overflow flips on. Reserve both edges so the content doesn't jump
          // left when the scroll container becomes scrollable.
          scrollbarGutter: 'stable both-edges' as React.CSSProperties['scrollbarGutter'],
          scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
          // Disable Chrome's built-in scroll anchoring. React pins scrollTop =
          // scrollHeight on every message update (useLayoutEffect below);
          // anchoring would simultaneously try to preserve visual position as
          // streaming content changes height, producing up-and-down judder on
          // the currently-streaming section.
          overflowAnchor: 'none',
        }}
      >
        <div className="cs-chat-message-stack" style={{
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minHeight: '100%',
        }}>
          {isStartScreen && (
             <div style={{
               display: 'flex', flexDirection: 'column',
               alignItems: 'center', justifyContent: 'center',
               color: theme.chat.text, textAlign: 'center',
               fontSize: 'clamp(24px, 3vw, 34px)',
               lineHeight: 1.15,
               fontWeight: 550,
               letterSpacing: 0,
             }}>
               What do you want to build today with CodeSurf?
             </div>
           )}

          {hiddenMessageCount > 0 && (
            <div style={{
              alignSelf: 'center',
              maxWidth: CHAT_MESSAGE_MAX_WIDTH,
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${theme.chat.divider}`,
              background: theme.chat.userBubble,
              color: theme.chat.muted,
              fontSize: 11,
              textAlign: 'center',
            }}>
              Showing the latest {renderedMessages.length} messages. Scroll up to reveal older pages; {hiddenMessageCount} older message{hiddenMessageCount === 1 ? '' : 's'} are preserved but not mounted.
            </div>
          )}

          {pagedLinkedHistoryEnabled && (loadingEarlier || earlierLoadError) && (
            <div style={{
              alignSelf: 'center',
              padding: '6px 12px 2px',
              borderRadius: 999,
              border: `1px solid ${theme.chat.divider}`,
              background: theme.chat.userBubble,
              color: theme.chat.muted,
              fontSize: 11,
              textAlign: 'center',
            }}>
              {loadingEarlier ? 'Loading older messages…' : earlierLoadError}
            </div>
          )}

          {(() => {
            // Walk the message list and group *consecutive* chip-only
            // assistant messages (thinking + tool calls, no prose text)
            // into a single visual cluster so their chips all live in one
            // wrapping row. The Claude Agent SDK emits a separate assistant
            // message per tool-round, so without this grouping each round
            // would render on its own line and waste horizontal space.
            //
            // Within a cluster, repeated tool calls are folded by name into
            // `3×READ` / `N×TOOLS` summary chips via collateClusterChips —
            // click a summary to explode it back to its parts inline.
            const nodes: JSX.Element[] = []
            // Read toolCollapseTick so the transcript only recomputes when a
            // just-finished tool actually crosses the collapse grace window.
            void toolCollapseTick

            // Source chip slots are extracted flat (thinking + individual
            // tools, in chronological order) then run through name-based
            // two-tier collation (collateClusterChips) at flush time — see
            // toolChipCollation.ts. This collapses noisy alternating runs
            // (Read/Thought/Read/Bash…) into `3×READ` / `N×TOOLS` summary
            // chips, which the user can click to explode back inline.
            let clusterItems: ClusterChip[] = []
            let clusterStartKey: string | null = null
            let clusterMsgIds: string[] = []

            const buildMessageBlockLookup = (msg: ChatMessage) => ({
              thinkingById: new Map((msg.thinkingBlocks ?? []).map(block => [block.id, block])),
              toolById: new Map((msg.toolBlocks ?? []).map(block => [block.id, block])),
            })

            // Extract flat chip slots (thinking + individual tools) from a
            // single message's contentBlocks. Text blocks are ignored —
            // callers only invoke this on chip-only messages. No grouping
            // happens here; collation runs cluster-wide at flush time.
            const extractChipsFromMessage = (msg: ChatMessage, isLiveMessage: boolean): ClusterChip[] => {
              const items: ClusterChip[] = []
              const blocks = msg.contentBlocks ?? []
              if (blocks.length === 0 && isExternalAgentToolOnlyText(msg.content ?? '')) {
                for (const tb of getExternalAgentToolBlocks(msg.content ?? '')) {
                  if (!shouldRenderToolBlock(tb)) continue
                  items.push({ kind: 'tool', key: `${msg.id}-${tb.id}`, block: tb, isLive: isLiveMessage })
                }
                return items
              }
              const { thinkingById, toolById } = buildMessageBlockLookup(msg)
              for (const block of blocks) {
                if (block.type === 'thinking') {
                  const tb = thinkingById.get(block.thinkingId)
                  // Active thinking for the live message renders above the input bar — skip here
                  if (tb && (!isLiveMessage || tb.done)) items.push({
                    kind: 'thinking',
                    key: `${msg.id}-think-${block.thinkingId}`,
                    block: !isLiveMessage && !tb.done ? { ...tb, done: true } : tb,
                  })
                  continue
                }
                if (block.type === 'tool') {
                  const tb = toolById.get(block.toolId)
                  if (tb && shouldRenderToolBlock(tb)) {
                    items.push({ kind: 'tool', key: `${msg.id}-${tb.id}`, block: tb, isLive: isLiveMessage })
                  }
                }
              }
              return items
            }

            const renderChipItem = (item: ReturnType<typeof collateClusterChips>[number], clusterId: string): JSX.Element => {
              if (item.kind === 'thinking') {
                return <ThinkingBlockView key={item.key} thinking={item.block} />
              }
              if (item.kind === 'tool-single') {
                return <ToolBlockView key={item.key} block={item.block} isLive={item.isLive} />
              }
              if (item.kind === 'tool-group') {
                return (
                  <ToolGroupChip
                    key={item.key}
                    toolName={item.toolName}
                    count={item.blocks.length}
                    expanded={item.expanded}
                    onToggle={() => toggleExplodedChipGroup(clusterId, item.id)}
                  />
                )
              }
              return (
                <ToolMegaChip
                  key={item.key}
                  count={item.blocks.length}
                  expanded={item.expanded}
                  onToggle={() => toggleExplodedChipGroup(clusterId, item.id)}
                />
              )
            }

            const renderChipRow = (items: JSX.Element[], key: string): JSX.Element => {
              return (
                <div key={key} style={CHAT_CHIP_ROW_STYLE}>
                  {items}
                </div>
              )
            }

            // A message qualifies for clustering only when it is an assistant
            // turn that is pure chip content — any prose text (content or a
            // 'text' contentBlock) breaks the cluster so prose lines keep
            // their normal bubble rendering.
            const isChipOnly = (msg: ChatMessage): boolean => {
              if (msg.role !== 'assistant') return false
              const blocks = msg.contentBlocks ?? []
              if (blocks.length === 0) return isExternalAgentToolOnlyText(msg.content ?? '')
              if (blocks.some(b => b.type === 'text')) return false
              if ((msg.content ?? '').trim().length > 0) return false
              return blocks.some(b => b.type === 'tool' || b.type === 'thinking')
            }

            const flushCluster = () => {
              if (clusterItems.length === 0) return
              const lastId = clusterMsgIds[clusterMsgIds.length - 1]
              const lastMsg = renderedMessages.find(m => m.id === lastId)
              const clusterId = clusterStartKey ?? 'cluster'
              // Derive this cluster's exploded-collation ids from the global
              // set (entries are namespaced `${clusterId}::${collationId}`).
              const prefix = `${clusterId}::`
              const clusterExploded = new Set<string>()
              for (const k of explodedChipGroups) {
                if (k.startsWith(prefix)) clusterExploded.add(k.slice(prefix.length))
              }
              const finalItems = collateClusterChips(clusterItems, clusterExploded)
              nodes.push(
                <BlockNoteAffordance
                  key={`cluster-${clusterId}`}
                  note={lastMsg?.note}
                  side="right"
                  onComposerActiveChange={setAnnotationComposerActive}
                  onUpdateNote={(text) => updateBlockNote({ kind: 'message', messageId: lastId }, text)}
                >
                  {renderChipRow(finalItems.map(item => renderChipItem(item, clusterId)), `cluster-row-${clusterId}`)}
                </BlockNoteAffordance>
              )
              clusterItems = []
              clusterStartKey = null
              clusterMsgIds = []
            }

            for (const msg of renderedMessages) {
              const isLiveMessage = Boolean(
                msg.role === 'assistant'
                && isStreaming
                && msg.isStreaming
                && msg.id === renderedMessages[renderedMessages.length - 1]?.id
              )
              if (isChipOnly(msg)) {
                const items = extractChipsFromMessage(msg, isLiveMessage)
                if (clusterItems.length === 0) clusterStartKey = msg.id
                clusterItems.push(...items)
                clusterMsgIds.push(msg.id)
                continue
              }
              flushCluster()
              const { thinkingById, toolById } = buildMessageBlockLookup(msg)
              const visibleToolBlocks = msg.toolBlocks?.filter(shouldRenderToolBlock) ?? []
              const hasVisibleToolBlocks = visibleToolBlocks.length > 0
              // Smart-side: user bubbles are right-aligned, so the annotation
              // icon sits on their LEFT where the gutter is; for assistant /
              // tool / thinking content that's left-aligned, the icon sits on
              // the RIGHT. This gives symmetrical "note in the empty space"
              // behaviour without the user having to choose a side.
              const annotationSide: 'left' | 'right' = msg.role === 'user' ? 'left' : 'right'
              nodes.push(
              <BlockNoteAffordance
                key={msg.id}
                note={msg.note}
                side={annotationSide}
                onComposerActiveChange={setAnnotationComposerActive}
                onUpdateNote={(text) => updateBlockNote({ kind: 'message', messageId: msg.id }, text)}
              >
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                width: msg.role === 'user' ? 'auto' : '100%',
                maxWidth: msg.role === 'user' ? '60%' : '100%',
                minWidth: 0,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: msg.role === 'user' ? 5 : 0,
                gap: 2,
                ...(isLiveMessage ? {} : CHAT_OFFSCREEN_MESSAGE_STYLE),
              }}>
                {/* Thinking block — show the pre-tools indicator only when there
                    are no inline thinking content-blocks yet, so we don't render
                    the first thinking block twice. */}
                {(() => {
                  const hasInlineThinking = (msg.contentBlocks ?? []).some(b => b.type === 'thinking')
                  const legacyThinking = msg.thinking
                    ? (!isLiveMessage && !msg.thinking.done ? { ...msg.thinking, done: true } : msg.thinking)
                    : (isLiveMessage && !msg.content ? { content: '', done: false } : null)
                  // Skip active legacy thinking for live messages — shown above input bar instead
                  const showLegacy = !hasInlineThinking && Boolean(legacyThinking) && (!isLiveMessage || legacyThinking?.done)
                  return showLegacy
                    ? <ThinkingBlockView thinking={legacyThinking ?? { content: '', done: false }} />
                    : null
                })()}

                {/* Interleaved content blocks — text and tool calls in stream order */}
                {(msg.contentBlocks?.length ?? 0) > 0 ? (
                    (() => {
                      const elements: JSX.Element[] = []
                      const blocks = msg.contentBlocks!
                      let i = 0
                      // Accumulator for a contiguous run of "chip-row" content
                      // (thinking + tool blocks). Text blocks break the run and
                      // cause the accumulator to flush into a single flex
                      // container so thinking chips sit inline with tool chips
                      // on the same wrapping row.
                      let chipRow: JSX.Element[] = []
                      let chipRowStartIdx = i
                      const flushChipRow = () => {
                        if (chipRow.length === 0) return
                        elements.push(renderChipRow(chipRow, `chiprow-${chipRowStartIdx}`))
                        chipRow = []
                      }
                      while (i < blocks.length) {
                        const block = blocks[i]
                        if (block.type === 'thinking') {
                          if (chipRow.length === 0) chipRowStartIdx = i
                          const tb = thinkingById.get(block.thinkingId)
                          // Active (not-done) thinking blocks for the live message render
                          // in the fixed zone above the input bar — skip them here so they
                          // don't also appear inside the message scroll area. Once done they
                          // fall through and render as the static "copy" in the chip row.
                          if (tb && (!isLiveMessage || tb.done)) {
                            chipRow.push(
                              <ThinkingBlockView
                                key={`think-${block.thinkingId}`}
                                thinking={!isLiveMessage && !tb.done ? { ...tb, done: true } : tb}
                              />
                            )
                          }
                          i++
                          continue
                        }
                        if (block.type === 'tool') {
                          if (chipRow.length === 0) chipRowStartIdx = i
                          // Collect consecutive tool blocks, then sub-group same-name completed ones
                          const rawTools: ToolBlock[] = []
                          while (i < blocks.length) {
                            const cb = blocks[i]
                            if (cb.type !== 'tool') break
                            const tb = toolById.get(cb.toolId)
                            if (tb && shouldRenderToolBlock(tb)) rawTools.push(tb)
                            i++
                          }
                          // Grouping rules:
                          //   - 3+ collapsible tool blocks all with the same name → "Read x6" chip.
                          //   - 3+ collapsible tool blocks with mixed names → "Called N tools" chip.
                          //   - Otherwise each chip renders inline.
                          //   - Non-collapsible tools (running / file-change / checkpoints) always stay inline.
                          const collapsibleTools = rawTools.filter(tb => tb.status === 'done' && !(tb.fileChanges?.length) && !isCheckpointToolBlock(tb) && !isDreamToolBlock(tb))
                          const collapsibleIds = new Set(collapsibleTools.map(t => t.id))
                          const uniqueNames = new Set(collapsibleTools.map(t => t.name))
                          const useSameNameGroup = collapsibleTools.length >= 3 && uniqueNames.size === 1
                          const useMixedGroup = collapsibleTools.length >= 3 && uniqueNames.size > 1
                          let groupEmitted = false
                          for (const tb of rawTools) {
                            if (collapsibleIds.has(tb.id) && (useSameNameGroup || useMixedGroup)) {
                              if (!groupEmitted) {
                                groupEmitted = true
                                if (useSameNameGroup) {
                                  chipRow.push(<CollapsedToolGroup key={`grp-${tb.id}`} name={tb.name} blocks={collapsibleTools} />)
                                } else {
                                  chipRow.push(<MixedToolGroup key={`mgrp-${tb.id}`} blocks={collapsibleTools} />)
                                }
                              }
                              continue
                            }
                            chipRow.push(<ToolBlockView key={tb.id} block={tb} isLive={isLiveMessage} />)
                          }
                          continue
                        }
                        {
                          // Any non-chip block (text) flushes the pending chip row
                          // first, then renders itself at block level.
                          flushChipRow()
                          const isLastBlock = i === blocks.length - 1
                          elements.push(
                            <div key={`text-${i}`} style={{
                              background: msg.role === 'user' ? theme.chat.userBubble : 'transparent',
                              border: msg.role === 'user' ? '1px solid transparent' : '0',
                              boxShadow: msg.role === 'user'
                                ? theme.mode === 'light'
                                  ? `var(--cs-edge-shadow), 0 0 0 0.5px color-mix(in srgb, ${theme.text.primary} 12%, transparent)`
                                  : 'var(--cs-edge-shadow)'
                                : undefined,
                              borderRadius: 14,
                              padding: '8px 12px',
                              margin: msg.role === 'user' ? '2px' : 0,
                              fontSize, lineHeight: fontLineHeight,
                              wordBreak: 'break-word',
                              color: theme.chat.text, position: 'relative',
                              width: msg.role === 'user' ? 'calc(100% - 4px)' : '100%', minWidth: 0, overflow: 'visible', boxSizing: 'border-box',
                            }}>
                              <ChatMessageContent text={block.text} isStreaming={isLiveMessage && isLastBlock} isUser={msg.role === 'user'} readAttachmentPaths={readAttachmentPaths} />
                            </div>
                          )
                          i++
                        }
                      }
                      // Flush any trailing chip row (e.g. stream ended on a
                      // thinking or tool block without a subsequent text block).
                      flushChipRow()
                      // WorkingChipView moved to the fixed zone above the input bar.
                      return elements
                    })()
                ) : (
                  <>
                    {/* Fallback: legacy layout for messages without contentBlocks */}
                    {hasVisibleToolBlocks && (
                      (() => {
                        const out: JSX.Element[] = []
                        const collapsibleTools = visibleToolBlocks.filter(tb => tb.status === 'done' && !(tb.fileChanges?.length))
                        const collapsibleIds = new Set(collapsibleTools.map(t => t.id))
                        const uniqueNames = new Set(collapsibleTools.map(t => t.name))
                        const useSameNameGroup = collapsibleTools.length >= 3 && uniqueNames.size === 1
                        const useMixedGroup = collapsibleTools.length >= 3 && uniqueNames.size > 1
                        let groupEmitted = false
                        for (const tb of visibleToolBlocks) {
                          if (collapsibleIds.has(tb.id) && (useSameNameGroup || useMixedGroup)) {
                            if (!groupEmitted) {
                              groupEmitted = true
                              if (useSameNameGroup) {
                                out.push(<CollapsedToolGroup key={`grp-${tb.id}`} name={tb.name} blocks={collapsibleTools} />)
                              } else {
                                out.push(<MixedToolGroup key={`mgrp-${tb.id}`} blocks={collapsibleTools} />)
                              }
                            }
                            continue
                          }
                          out.push(<ToolBlockView key={tb.id} block={tb} isLive={isLiveMessage} />)
                        }
                        return renderChipRow(out, `legacy-tools-${msg.id}`)
                      })()
                    )}
                    {msg.content && (
                      <div style={{
                        background: msg.role === 'user' ? theme.chat.userBubble : 'transparent',
                        border: msg.role === 'user' ? '1px solid transparent' : '0',
                        boxShadow: msg.role === 'user'
                          ? theme.mode === 'light'
                            ? `var(--cs-edge-shadow), 0 0 0 0.5px color-mix(in srgb, ${theme.text.primary} 12%, transparent)`
                            : 'var(--cs-edge-shadow)'
                          : undefined,
                        borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        padding: '8px 12px',
                        margin: msg.role === 'user' ? '2px' : 0,
                        fontSize, lineHeight: fontLineHeight,
                        wordBreak: 'break-word',
                        color: theme.chat.text, position: 'relative',
                        width: msg.role === 'user' ? 'calc(100% - 4px)' : '100%', minWidth: 0, overflow: 'visible', boxSizing: 'border-box',
                      }}>
                        <ChatMessageContent text={msg.content} isStreaming={isLiveMessage} isUser={msg.role === 'user'} readAttachmentPaths={readAttachmentPaths} />
                        {isLiveMessage && msg.content.length === 0 && !hasVisibleToolBlocks && (
                          <WorkingDots />
                        )}
                      </div>
                    )}
                  </>
                )}
                {/* Cost/turns/time footer */}
                {msg.role === 'assistant' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: monoSize - 2, color: theme.chat.subtle, fontFamily: fontMono,
                    padding: '0 4px',
                    marginTop: -5,
                    // Reserve a stable footer line so the layout doesn't jump
                    // ~10px when streaming finishes and cost/turns/time first
                    // appear. Without this the auto-pin shifts content up.
                    minHeight: monoSize + 2,
                    visibility: (!isLiveMessage && msg.cost != null) ? 'visible' : 'hidden',
                  }}>
                    {!isLiveMessage && msg.cost != null && (<>
                    <span>${msg.cost.toFixed(4)}</span>
                    {msg.turns != null && (
                      <span>{msg.turns} turn{msg.turns !== 1 ? 's' : ''}</span>
                    )}
                    <span>{relativeTime(msg.timestamp)}</span>
                    {/* Per-message speak / stop button — appears on every
                        completed assistant message. Click speaks (or
                        re-speaks) this message; if it's currently being
                        spoken, click stops just that message. */}
                    <button
                      type="button"
                      onClick={() => {
                        if (ttsState.currentMessageId === msg.id) {
                          ttsPlayer.stopMessage(msg.id)
                        } else {
                          void speakMessage({
                            messageId: msg.id,
                            text: msg.content,
                            ttsProvider: voiceSettings.ttsProvider,
                            ttsVoice: voiceSettings.ttsVoice,
                            spokifyModel: voiceSettings.spokifyModel,
                            force: true,
                          })
                        }
                      }}
                      onMouseDown={e => e.preventDefault()}
                      title={ttsState.currentMessageId === msg.id ? 'Stop speaking' : 'Speak this message'}
                      style={{
                        marginLeft: 'auto', background: 'transparent', border: 'none',
                        cursor: 'pointer', padding: 2, display: 'flex',
                        color: ttsState.currentMessageId === msg.id ? theme.accent.base : theme.chat.subtle,
                      }}
                    >
                      <Mic size={10} strokeWidth={2.2} />
                    </button>
                    </>)}
                  </div>
                )}
                {/* User message time footer */}
                {!isLiveMessage && msg.role === 'user' && (
                  <div style={{
                    fontSize: monoSize - 2, color: theme.chat.subtle, fontFamily: fontMono,
                    padding: '0 6px', textAlign: 'right',
                    marginTop: 2,
                    lineHeight: 1.2,
                    alignSelf: 'flex-end',
                    overflow: 'visible',
                  }}>
                    {relativeTime(msg.timestamp)}
                  </div>
                )}

              </div>
              </BlockNoteAffordance>
              )
            }
            flushCluster()
            return nodes
          })()}
        </div>
      </div>

      <div style={{ flexShrink: 0, position: 'relative', overflow: 'visible' }}>
        {showScrollToLatest && (
            <button
              onClick={() => scrollToLatest()}
              title="Jump to latest"
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                minWidth: 30,
                padding: 0,
                borderRadius: '50%',
                border: `0.5px solid ${theme.border.strong}`,
                background: theme.surface.panelElevated,
                color: theme.text.secondary,
                cursor: 'pointer',
                boxShadow: theme.shadow.panel,
                backdropFilter: 'blur(10px)',
                ...NON_SELECTABLE_UI_STYLE,
              }}
            >
              <ArrowDown size={15} strokeWidth={1.8} />
            </button>
        )}

        {liveComposerActivityChip}

        {latestChangeDrawer && (
          <ChatComposerDrawerFrame style={{
            // Match the queued-messages drawer's indent + bottom-tuck so the
            // changes drawer reads as pulled out from behind the composer
            // rather than sitting on top of it.
            width: `calc(${CHAT_COMPOSER_WIDTH} - 24px)`,
            minWidth: `calc(${CHAT_COMPOSER_MIN_WIDTH_STYLE} - 24px)`,
            margin: '0 auto 0 auto',
          }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 14px',
                ...NON_SELECTABLE_UI_STYLE,
              }}
            >
              <button
                type="button"
                onClick={() => setLatestChangeDrawerExpanded(v => !v)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  flexWrap: 'wrap',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: theme.chat.textSecondary,
                  fontFamily: fontSans,
                  ...NON_SELECTABLE_UI_STYLE,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: theme.chat.text }}>
                  {latestChangeDrawer.fileCount} file{latestChangeDrawer.fileCount === 1 ? '' : 's'} changed
                </span>
                {latestChangeDrawerHasStats && (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600, color: theme.status.success }}>
                      +{latestChangeDrawer.additions}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: theme.status.danger }}>
                      -{latestChangeDrawer.deletions}
                    </span>
                  </>
                )}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {latestCheckpointId && (
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation()
                      void restoreLatestCheckpoint()
                    }}
                    disabled={isRestoringLatestCheckpoint}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: isRestoringLatestCheckpoint ? theme.chat.muted : theme.chat.text,
                      fontSize: 12,
                      fontFamily: fontSans,
                      fontWeight: 500,
                      cursor: isRestoringLatestCheckpoint ? 'default' : 'pointer',
                      padding: 0,
                      opacity: isRestoringLatestCheckpoint ? 0.6 : 1,
                      ...NON_SELECTABLE_UI_STYLE,
                    }}
                  >
                    {isRestoringLatestCheckpoint ? 'Undoing…' : 'Undo'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    setLatestChangeDrawerExpanded(v => !v)
                  }}
                  title={latestChangeDrawerExpanded ? 'Collapse changes' : 'Expand changes'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    border: 'none',
                    background: 'transparent',
                    color: theme.chat.textSecondary,
                    cursor: 'pointer',
                    padding: 0,
                    ...NON_SELECTABLE_UI_STYLE,
                  }}
                >
                  <ChevronRight size={14} style={{
                    transform: latestChangeDrawerExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s',
                    opacity: 0.55,
                  }} />
                </button>
              </div>
            </div>
            {latestChangeDrawerExpanded && (
              <div style={{
                borderTop: `1px solid ${theme.chat.divider}`,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {latestChangeDrawer.fileChanges.map((change, index) => {
                  const fileKey = `${latestChangeDrawer.key}:${change.path}:${index}`
                  const fileHasDiff = hasRenderableFileChangeDiff(change)
                  const isExpanded = latestChangeDrawerExpandedFiles[fileKey] ?? false
                  const fileHasStats = hasVisibleFileChangeStats(change)
                  return (
                    <div
                      key={fileKey}
                      style={{
                        borderTop: index > 0 ? `1px solid ${theme.chat.divider}` : 'none',
                        background: theme.surface.panelMuted,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (fileHasDiff) toggleLatestChangeDrawerFile(fileKey)
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '12px 14px',
                          border: 'none',
                          background: 'transparent',
                          cursor: fileHasDiff ? 'pointer' : 'default',
                          textAlign: 'left',
                          color: theme.chat.text,
                          fontFamily: fontSans,
                          fontSize: 12,
                          ...NON_SELECTABLE_UI_STYLE,
                        }}
                      >
                        <span style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {change.path}
                        </span>
                        {fileHasStats && (
                          <>
                            <span style={{ color: theme.status.success, fontWeight: 600, flexShrink: 0 }}>
                              +{change.additions}
                            </span>
                            <span style={{ color: theme.status.danger, fontWeight: 600, flexShrink: 0 }}>
                              -{change.deletions}
                            </span>
                          </>
                        )}
                        <ChevronRight size={14} style={{
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s',
                          opacity: fileHasDiff ? 0.55 : 0,
                          flexShrink: 0,
                        }} />
                      </button>
                      {isExpanded && fileHasDiff && (
                        <div style={{ borderTop: `1px solid ${theme.chat.divider}` }}>
                          <DiffView
                            diff={change.diff}
                            path={change.path}
                            fontSize={Math.max(10, monoSize - 2)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '10px 14px 12px',
                  borderTop: `1px solid ${theme.chat.divider}`,
                  background: theme.surface.panelMuted,
                }}>
                  <button
                    type="button"
                    onClick={reviewLatestChanges}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: theme.chat.textSecondary,
                      fontSize: 11,
                      fontFamily: fontSans,
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: 0,
                      ...NON_SELECTABLE_UI_STYLE,
                    }}
                  >
                    Jump to message
                  </button>
                </div>
              </div>
            )}
          </ChatComposerDrawerFrame>
        )}

        {queuedTurns.length > 0 && (() => {
          // Count crash/error-looking items once per render so the summary
          // row can call them out in red — urgent rows are rendered with a
          // red left-bar when expanded, but when collapsed the only tell
          // is the "N errors" suffix in the summary row.
          const urgentCount = queuedTurns.filter(t => isUrgentQueuedContent(t.content)).length
          const showCollapsed = queueCollapsed && queuedTurns.length >= 3
          return (
          <ChatComposerDrawerFrame
            joinedToPrevious={Boolean(latestChangeDrawer)}
            collapsed={showCollapsed}
            style={{
              // Match the "changes" drawer's indent + tucks the bottom edge under
              // the composer so it reads as a drawer pulled out from behind it.
              width: `calc(${CHAT_COMPOSER_WIDTH} - 24px)`,
              minWidth: `calc(${CHAT_COMPOSER_MIN_WIDTH_STYLE} - 24px)`,
              margin: '0 auto 0 auto',
            }}
          >
            {/* Header / summary row. When collapsed it's the ONLY visible
                row and clicking anywhere on it expands. When expanded it
                becomes a compact toggle at the top so the user can tuck the
                queue back away. */}
            {queuedTurns.length >= 3 && (
              <button
                type="button"
                onClick={() => setQueueCollapsed(v => !v)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: showCollapsed ? '6px 14px' : '6px 14px',
                  border: 'none',
                  borderBottom: showCollapsed ? 'none' : `1px solid ${theme.chat.divider}`,
                  background: 'transparent',
                  color: theme.chat.textSecondary,
                  cursor: 'pointer',
                  fontFamily: fontSans,
                  // Pin text to 11px regardless of the user's chat font —
                  // this is UI chrome, not conversation content, so it should
                  // match the composer toolbar pills rather than message body.
                  fontSize: 11,
                  // Tight line-height so the text's visual centre lines up
                  // with the 14px icons on the same row (avoids the baseline
                  // hang we had at 1.35).
                  lineHeight: 1,
                  textAlign: 'left',
                  ...NON_SELECTABLE_UI_STYLE,
                }}
                title={showCollapsed ? 'Expand queued messages' : 'Collapse queued messages'}
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  color: theme.chat.muted,
                  flexShrink: 0,
                }}>
                  {showCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  color: urgentCount > 0 ? theme.status.danger : theme.chat.muted,
                  flexShrink: 0,
                }}>
                  {urgentCount > 0 ? <AlertTriangle size={12} /> : <MessageSquare size={12} />}
                </span>
                <span style={{
                  flex: 1, minWidth: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: 1,
                }}>
                  <span style={{ fontWeight: 600 }}>
                    {queuedTurns.length} queued {queuedTurns.length === 1 ? 'message' : 'messages'}
                  </span>
                  {urgentCount > 0 && (
                    <>
                      <span style={{ color: theme.chat.muted }}>, </span>
                      <span style={{ color: theme.status.danger, fontWeight: 600 }}>
                        {urgentCount} {urgentCount === 1 ? 'error' : 'errors'}
                      </span>
                    </>
                  )}
                </span>
              </button>
            )}
            {!showCollapsed && queuedTurns.map((turn, index) => {
              const depth = turn.parentId ? 1 : 0
              const isDraggingThis = draggingTurnId === turn.id
              const dropHere = dragOverTurn?.id === turn.id ? dragOverTurn.mode : null
              // Flag pasted error/warning/stack-trace dumps so the row can
              // render with a red tint — makes it obvious at a glance that
              // this queued turn is a crash report rather than a normal prompt.
              const isUrgent = isUrgentQueuedContent(turn.content)
              return (
              <div
                key={turn.id}
                onDragOver={(ev) => {
                  // Only accept our own internal queue-turn drags. The
                  // custom mime type is set in onDragStart below.
                  if (!ev.dataTransfer.types.includes('application/x-codesurf-queued-turn')) return
                  if (draggingTurnId === turn.id) return
                  ev.preventDefault()
                  ev.stopPropagation()
                  ev.dataTransfer.dropEffect = 'move'
                  const rect = ev.currentTarget.getBoundingClientRect()
                  const y = ev.clientY - rect.top
                  const h = rect.height
                  // Zone thresholds: top quarter → before, middle half → into,
                  // bottom quarter → after. Child rows can't be nested further,
                  // so dropping onto a child collapses to sibling mode.
                  let mode: 'before' | 'after' | 'into'
                  if (y < h * 0.25) mode = 'before'
                  else if (y > h * 0.75) mode = 'after'
                  else mode = turn.parentId ? 'after' : 'into'
                  if (dragOverTurn?.id !== turn.id || dragOverTurn.mode !== mode) {
                    setDragOverTurn({ id: turn.id, mode })
                  }
                }}
                onDragLeave={(ev) => {
                  // Only clear if the pointer actually left this row (not
                  // just moved to a child element).
                  const related = ev.relatedTarget as Node | null
                  if (related && ev.currentTarget.contains(related)) return
                  if (dragOverTurn?.id === turn.id) setDragOverTurn(null)
                }}
                onDrop={(ev) => {
                  // Source-of-truth is the dataTransfer payload plus the
                  // row's own id (from closure) and the cursor position —
                  // NOT React state. Some browsers fire a dragleave between
                  // the last dragover and drop, which would clear the
                  // dragOverTurn state and leave us unable to reorder. The
                  // data-transfer + geometry approach is immune to that.
                  const draggedId = ev.dataTransfer.getData('application/x-codesurf-queued-turn')
                    || ev.dataTransfer.getData('text/plain')
                  if (!draggedId || draggedId === turn.id) return
                  ev.preventDefault()
                  ev.stopPropagation()
                  const rect = ev.currentTarget.getBoundingClientRect()
                  const y = ev.clientY - rect.top
                  const h = rect.height
                  let mode: 'before' | 'after' | 'into'
                  if (y < h * 0.25) mode = 'before'
                  else if (y > h * 0.75) mode = 'after'
                  else mode = turn.parentId ? 'after' : 'into'
                  reorderQueuedTurn(draggedId, turn.id, mode)
                  setDragOverTurn(null)
                  setDraggingTurnId(null)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 14px',
                  paddingLeft: 14 + depth * 22,
                  borderTop: index > 0 ? `1px solid ${theme.chat.divider}` : undefined,
                  background: dropHere === 'into'
                    ? theme.surface.hover
                    : (isDraggingThis
                      ? theme.surface.selection
                      // Urgent rows get a soft red tint so a pasted crash/error
                      // log stands out without drowning the rest of the queue.
                      : (isUrgent ? `color-mix(in srgb, ${theme.status.danger} 18%, transparent)` : 'transparent')),
                  // Top/bottom indicator lines for before/after drop zones.
                  // Urgent rows additionally get a left accent bar in danger
                  // color; if a drop indicator is active, it takes precedence.
                  boxShadow: dropHere === 'before'
                    ? `inset 0 2px 0 0 ${theme.accent.base}`
                    : dropHere === 'after'
                      ? `inset 0 -2px 0 0 ${theme.accent.base}`
                      : (isUrgent ? `inset 3px 0 0 0 ${theme.status.danger}` : undefined),
                  opacity: isDraggingThis ? 0.5 : 1,
                  transition: 'background 0.12s, opacity 0.12s',
                  position: 'relative',
                }}
              >
                {/* Drag handle — native HTML5 DnD is initiated here; setting
                    draggable on the row itself would steal text selection.
                    Hit area is deliberately generous (24×24) with the grip
                    icon visually centered, so users don't have to aim at
                    the 14px glyph precisely. */}
                <div
                  draggable
                  onDragStart={(ev) => {
                    ev.stopPropagation()
                    ev.dataTransfer.effectAllowed = 'move'
                    // Custom mime type marks this as an internal queue-turn
                    // drag so tile-level file-drop handlers can ignore it.
                    // Keep text/plain for backwards compat and because some
                    // drop targets only read text/plain.
                    try {
                      ev.dataTransfer.setData('application/x-codesurf-queued-turn', turn.id)
                    } catch { /* older browsers reject custom types silently */ }
                    ev.dataTransfer.setData('text/plain', turn.id)
                    setDraggingTurnId(turn.id)
                  }}
                  onDragEnd={() => {
                    setDraggingTurnId(null)
                    setDragOverTurn(null)
                  }}
                  title="Drag to reorder — drop on a row to nest as a sub-item"
                  style={{
                    width: 24,
                    height: 24,
                    marginLeft: -4,
                    marginRight: -4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.chat.muted,
                    cursor: 'grab',
                    flexShrink: 0,
                    opacity: 0.6,
                    borderRadius: 4,
                    ...NON_SELECTABLE_UI_STYLE,
                  }}
                  onMouseEnter={(ev) => {
                    ev.currentTarget.style.opacity = '1'
                    ev.currentTarget.style.background = theme.surface.hover
                  }}
                  onMouseLeave={(ev) => {
                    ev.currentTarget.style.opacity = '0.6'
                    ev.currentTarget.style.background = 'transparent'
                  }}
                >
                  <GripVertical size={14} />
                </div>
                <div style={{
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isUrgent ? theme.status.danger : theme.chat.muted,
                  flexShrink: 0,
                  ...NON_SELECTABLE_UI_STYLE,
                }}>
                  {isUrgent ? <AlertTriangle size={14} /> : <MessageSquare size={14} />}
                </div>
                <div
                  title={isUrgent ? 'This queued message looks like a pasted error/crash log' : undefined}
                  style={{
                    minWidth: 0, flex: 1,
                    color: isUrgent ? theme.status.danger : theme.chat.textSecondary,
                    fontWeight: isUrgent ? 600 : undefined,
                    fontSize: Math.max(12, fontSize),
                    fontFamily: fontSans,
                    lineHeight: 1.35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {turn.preview}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleQueuedTurnSteer(turn)
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: theme.chat.textSecondary,
                    fontSize: 12,
                    fontFamily: fontSans,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 0,
                    opacity: 1,
                    flexShrink: 0,
                    ...NON_SELECTABLE_UI_STYLE,
                  }}
                  title={isStreaming ? 'Send this message into the running stream' : 'Send this queued message now'}
                >
                  <CornerDownRight size={14} />
                  <span>Steer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const remaining = queuedTurns.filter(item => item.id !== turn.id)
                    setQueuedTurns(remaining)
                    flushQueueStateNow(remaining)
                    logQueueEvent('delete', { queueId: turn.id })
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: theme.chat.muted,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    flexShrink: 0,
                    ...NON_SELECTABLE_UI_STYLE,
                  }}
                  title="Remove queued message"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              )
            })}
          </ChatComposerDrawerFrame>
          )
        })()}

        {/* Input bar */}
        <ChatComposerWrap style={{
          flexShrink: 0,
          width: CHAT_COMPOSER_WIDTH,
          minWidth: CHAT_COMPOSER_MIN_WIDTH_STYLE,
          margin: isStartScreen ? '12px auto 6px auto' : '0 auto 6px auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
        <ChatComposerCard style={{
        minHeight: CHAT_COMPOSER_MIN_HEIGHT,
        border: isDropTarget ? `1px solid ${theme.accent.base}` : `1px solid ${composerBorder}`, borderRadius: 14,
        // Keep the fill on the actual input surface. The dimensional edge is
        // handled by ChatComposerCard's stacked shadow, not by painting a gray
        // border colour across the whole composer.
        background: isDropTarget ? theme.surface.accentSoft : composerBackground,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isDropTarget
          ? `0 0 0 1px ${theme.border.accent}, 0 0 22px ${theme.accent.soft}`
          : theme.mode === 'light'
            ? `0 0 0 0.5px color-mix(in srgb, ${theme.text.primary} 12%, transparent), 0 10px 28px color-mix(in srgb, ${theme.text.primary} 9%, transparent)`
            : `0 10px 28px color-mix(in srgb, #000 18%, transparent)`,
        transition: 'border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
      }}>
        <ChatComposerAutocompletePopup
          popupRef={acRef}
          autocompleteType={acType}
          query={acQuery}
          items={acItems}
          activeIndex={acIndex}
          fontSans={fontSans}
          fontMono={fontMono}
          onHoverIndex={setAcIndex}
          onSelect={selectAcItem}
        />

        <ChatComposerVoiceStatus
          isDictating={isDictating}
          dictationText={dictationText}
          dictationError={dictationError}
          ttsState={ttsState}
          onStopVoicePlayback={() => bargeIn()}
        />

        <ChatComposerSurfaceHost
          surfaces={openChatSurfaces}
          activeSurface={activeChatSurface}
          fontMono={fontMono}
          showBuilderEnhance={activeChatSurface?.extId === 'sketch' && chatSurfaceMenu.some(entry => entry.extId === 'builder' || entry.surfaceId === 'builder')}
          renderSurfaceIcon={renderChatSurfaceIcon}
          onActivateSurface={setActiveChatSurfaceId}
          onCloseSurface={closeChatSurface}
          onOpenBuilderFromSketch={() => { void openBuilderFromSketch() }}
          onSetSurfaceIframeRef={setChatSurfaceIframeRef}
        />

        <ChatComposerAttachments
          attachments={attachments}
          fontMono={fontMono}
          onRemoveAttachment={removeAttachment}
        />

        <ChatComposerInput
          textareaRef={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          placeholder={isDictating ? 'Listening...' : 'Message the agent, or use /commands and /skills'}
          fontSize={fontSize}
          fontFamily={fontSans}
          lineHeight={fontLineHeight}
          minHeight={CHAT_COMPOSER_TEXTAREA_MIN_HEIGHT}
          textColor={theme.chat.text}
        />

        {/* Primary toolbar */}
        <ChatComposerPrimaryToolbar>
          {/* Insert menu */}
          <div ref={insertMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Open attachments and tools menu"
              title="Open attachments and tools menu"
              onClick={() => toggleMenu('insert')}
              onMouseDown={e => e.preventDefault()}
              style={{
                width: 28,
                height: 28,
                minWidth: 28,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: showInsertMenu ? theme.chat.text : theme.chat.muted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'background 0.15s, color 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = theme.chat.text
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = showInsertMenu ? theme.chat.text : theme.chat.muted
              }}
            >
              <Plus size={16} strokeWidth={2.2} />
            </button>
            {showInsertMenu && (
              <MenuPortal anchorRef={insertMenuRef}>
                <ComposerInsertMenu
                  onAttachFiles={openAttachmentPicker}
                  mcpEnabled={mcpEnabled}
                  onToggleMcpEnabled={() => setMcpEnabled(v => !v)}
                  mcpServers={mcpServers}
                  disabledServers={disabledServers}
                  setDisabledServers={setDisabledServers}
                  peerToolNames={peerToolNames}
                  chatSurfaces={chatSurfaceMenu}
                  activeChatSurfaceId={activeChatSurface ? `${activeChatSurface.extId}:${activeChatSurface.surfaceId}` : null}
                  onOpenChatSurface={openChatSurface}
                  renderChatSurfaceIcon={renderChatSurfaceIcon}
                />
              </MenuPortal>
            )}
          </div>

          {/* Provider — shown only before the conversation starts. Different
              CLI agents have incompatible session formats (Claude SDK session
              resumption vs. Codex subprocess streams vs. OpenCode HTTP), so
              swapping mid-conversation would break history continuity. The
              current provider is still implicit in the Model pill's icon.
              Clear the conversation to expose the picker again. */}
          {messages.length === 0 && (
            <div ref={providerMenuRef} style={{ position: 'relative' }}>
              <ToolbarPill
                prefix={currentProviderEntry?.icon ?? <Bot size={TOOLBAR_PILL_ICON_SIZE} />}
                label={currentProviderEntry?.label ?? 'Provider'}
                active={showProviderMenu}
                onClick={() => toggleMenu('provider')}
                title="Choose the CLI agent (hidden once the conversation starts)"
              />
              {showProviderMenu && (
                <MenuPortal anchorRef={providerMenuRef}>
                  <Dropdown>
                    {providerEntries.map(entry => (
                      <DropdownItem
                        key={entry.id}
                        icon={entry.icon}
                        label={entry.label}
                        sublabel={entry.description}
                        active={provider === entry.id}
                        onClick={() => handleProviderChange(entry.id)}
                      />
                    ))}
                  </Dropdown>
                </MenuPortal>
              )}
            </div>
          )}

          {/* Model */}
          <div ref={modelMenuRef} style={{ position: 'relative' }}>
            <ToolbarPill
              prefix={currentProviderEntry?.icon ?? <Bot size={TOOLBAR_PILL_ICON_SIZE} />}
              label={currentModel.label}
              active={showModelMenu}
              onClick={() => toggleMenu('model')}
            />
            {showModelMenu && (
              <MenuPortal anchorRef={modelMenuRef}>
                <ModelDropdown
                  models={currentProviderEntry?.models ?? []}
                  activeId={model}
                  filter={modelFilter}
                  onFilterChange={setModelFilter}
                  providerIcon={currentProviderEntry?.icon ?? <Bot size={TOOLBAR_PILL_ICON_SIZE} />}
                  noun={optionNoun}
                  onSelect={(id) => { setModel(id); setShowModelMenu(false); setModelFilter('') }}
                />
              </MenuPortal>
            )}
          </div>

          {/* Thinking — brain + signal bars icon, label in dropdown */}
          <div ref={thinkingMenuRef} style={{ position: 'relative' }}>
            <ToolbarBtn
              icon={<ThinkingIcon level={thinking} />}
              tooltip={`Thinking: ${thinkingOptions.find(t => t.id === thinking)?.label ?? 'Adaptive'}`}
              color={thinking === 'none' ? theme.chat.muted : theme.chat.textSecondary}
              onClick={() => toggleMenu('thinking')}
            />
            {showThinkingMenu && (
              <MenuPortal anchorRef={thinkingMenuRef}>
                <Dropdown>
                  {thinkingOptions.map(t => (
                    <DropdownItem
                      key={t.id}
                      icon={<Brain size={11} />}
                      label={t.label}
                      sublabel={t.description}
                      active={thinking === t.id}
                      onClick={() => { setThinking(t.id); setShowThinkingMenu(false) }}
                    />
                  ))}
                </Dropdown>
              </MenuPortal>
            )}
          </div>

          <div style={{ marginLeft: 'auto' }}>
          <ToolbarBtn
            icon={<Maximize2 size={TOOLBAR_ICON_SIZE - 1} />}
            tooltip="Open this chat in a mini window"
            color={theme.chat.textSecondary}
            onClick={openMiniChat}
          />
          </div>

          {/* Subtle liveness indicator — a breathing dot that sits next to the
              Stop button while streaming. If the server has been quiet for
              >2.5s we also surface a tiny "Xs" counter so the user knows the
              turn is still alive even when nothing visible has changed. */}
          {isStreaming && <StreamingLivenessIndicator lastActivityAtMs={lastActivityAtRef.current} />}

          {/* Voice dictation — sits next to send/stop. Click toggles, or
              hold spacebar in the empty composer for push-to-talk. The
              underlying recognizer is the existing toggleDictation/isDictating
              flow (Web Speech API in Electron's Chromium). */}
          {!isStreaming && (
            <button
              onClick={toggleDictation}
              onMouseDown={e => e.preventDefault()}
              style={{
                width: 28, height: 28, minWidth: 28, borderRadius: '50%',
                background: isDictating ? theme.status.danger : theme.surface.panelMuted,
                border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, transition: 'background 0.15s, transform 0.15s', flexShrink: 0,
                transform: isDictating ? 'scale(1.05)' : 'scale(1)',
                animation: isDictating ? 'chat-pulse 1.4s ease-in-out infinite' : 'none',
              }}
              onMouseEnter={e => {
                if (!isDictating) e.currentTarget.style.background = theme.chat.inputBorder ?? theme.surface.panelMuted
              }}
              onMouseLeave={e => {
                if (!isDictating) e.currentTarget.style.background = theme.surface.panelMuted
              }}
              title={isDictating ? 'Stop recording (or release Space)' : 'Hold Space (empty composer) or click to dictate'}
            >
              <Mic
                size={14}
                color={isDictating ? theme.text.inverse : theme.chat.muted}
                strokeWidth={2.2}
              />
            </button>
          )}

          {/* Stop / Send */}
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              onMouseDown={e => e.preventDefault()}
              style={{
                width: 28, height: 28, minWidth: 28, borderRadius: '50%',
                background: theme.text.primary, border: 'none',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                padding: 0, transition: 'opacity 0.15s', flexShrink: 0,
                opacity: 0.92,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.92')}
              title="Stop generation"
            >
              <Square size={10} fill={theme.chat.background} color={theme.chat.background} />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              onMouseDown={e => e.preventDefault()}
              disabled={!hasSendableDraft}
              style={{
                width: 28, height: 28, minWidth: 28, borderRadius: '50%',
                background: hasSendableDraft ? theme.accent.base : theme.surface.panelMuted,
                border: 'none',
                cursor: hasSendableDraft ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, transition: 'background 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { if (hasSendableDraft) e.currentTarget.style.background = theme.accent.hover }}
              onMouseLeave={e => { if (hasSendableDraft) e.currentTarget.style.background = theme.accent.base }}
              title="Send message"
            >
              <ArrowUp size={16} color={theme.text.inverse} strokeWidth={2.5} style={{ opacity: hasSendableDraft ? 1 : 0.3 }} />
            </button>
          )}
        </ChatComposerPrimaryToolbar>
        </ChatComposerCard>

        {/* Secondary toolbar */}
        <ChatComposerSecondaryToolbar>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <ChatComposerLocationMenu
              anchorRef={locationMenuRef}
              showMenu={showLocationMenu}
              executionTarget={executionTarget}
              locationLabel={locationLabel}
              localExecutionLabel={localExecutionLabel}
              normalizedRepoRoot={normalizedRepoRoot}
              remoteHosts={remoteHosts}
              activeCloudHost={activeCloudHost}
              fontSans={fontSans}
              onToggleMenu={() => toggleMenu('location')}
              onSelectLocal={() => {
                setExecutionTarget('local')
                setShowLocationMenu(false)
              }}
              onSelectCloud={() => {
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
            />

            <ChatComposerBranchMenu
              anchorRef={branchMenuRef}
              showMenu={showBranchMenu}
              isGitRepo={isGitRepo}
              branches={filteredBranches}
              branchFilter={branchFilter}
              branchCreateEnabled={branchMenuCreateEnabled}
              currentBranchLabel={currentBranchLabel}
              projectFolderName={projectFolderName}
              normalizedRepoRoot={normalizedRepoRoot}
              changedCount={gitStatus.changedCount}
              fontSans={fontSans}
              nonSelectableStyle={NON_SELECTABLE_UI_STYLE}
              onToggleMenu={() => toggleMenu('branch')}
              onBranchFilterChange={setBranchFilter}
              onSelectBranch={handleBranchSelect}
              onCreateBranch={handleCreateBranch}
            />

            <ChatComposerProjectPathButton
              title={executionTarget === 'cloud' ? activeProjectPathLabel : `${activeProjectPathLabel} — click to switch folder`}
              disabled={executionTarget === 'cloud'}
              label={activeProjectPathLabel}
              fontSans={fontSans}
              onClick={handleProjectFolderSwitch}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <ChatComposerModeMenu
              anchorRef={modeMenuRef}
              showMenu={showModeMenu}
              mode={mode}
              currentMode={currentMode}
              modeOptions={modeOptions}
              onToggleMenu={() => toggleMenu('mode')}
              onSelectMode={modeId => {
                setMode(modeId)
                onChatModePreferenceChange?.(provider, modeId)
                setShowModeMenu(false)
              }}
            />

            {/* Plan / Tasks chip — only visible when the agent has emitted a
                TodoWrite block. Toggles the right-docked PlanPane. */}
            {planTodos && planTodos.length > 0 && (
              <PlanChip
                todos={planTodos}
                active={isPlanOpen}
                onClick={() => setIsPlanOpen(v => !v)}
              />
            )}

            {/* Context indicator sits in a 28×28 hit-box so its centre-line
                aligns with the Stop/Send button in the primary toolbar above
                (both buttons are now 28px wide with matching 8px container
                padding → same centre X). The 18×18 visible dial is centred
                inside via flex alignment. */}
            <ChatComposerContextUsageDial
              anchorRef={contextMenuRef}
              showMenu={showContextMenu}
              contextUsageRatio={contextUsageRatio}
              contextUsagePercent={contextUsagePercent}
              estimatedContextTokens={estimatedContextTokens}
              contextWindowLimit={contextWindowLimit}
              systemOverheadTokens={systemOverheadTokens}
              composerBackground={composerBackground}
              fontSans={fontSans}
              nonSelectableStyle={NON_SELECTABLE_UI_STYLE}
              onToggleMenu={() => toggleMenu('context')}
            />
          </div>
        </ChatComposerSecondaryToolbar>
        </ChatComposerWrap>
      </div>
      </div>
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
