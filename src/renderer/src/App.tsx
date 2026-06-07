import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react'
import { Plus, Package, Link2, X } from 'lucide-react'
import { CanvasGroupFrames } from './components/canvas/CanvasGroupFrames'
import type { AggregatedSessionEntry, SessionEntryHint, WorkspaceSessionEntry } from '../../shared/session-types'
import type { TileState, GroupState, CanvasState, Workspace, AppSettings, TileType, LockedConnection } from '../../shared/types'
import { TileColorProvider } from './TileColorContext'
import { withDefaultSettings, DEFAULT_SETTINGS } from '../../shared/types'
import type { MenuItem } from './components/ContextMenu'
import { useExtensions } from './hooks/useExtensions'
import { useLayoutTemplates } from './hooks/useLayoutTemplates'
import { useAutoHideScrollbars } from './hooks/useAutoHideScrollbars'
import { useScrollFadeIndicators } from './hooks/useScrollFadeIndicators'
import { useShellLayoutMetrics } from './hooks/useShellLayoutMetrics'
import { useNegotiatedDiscovery } from './hooks/useNegotiatedDiscovery'
import {
  useCanvasEngine,
  useCanvasDragSync,
  useCanvasPointerHandlers,
  useCanvasExpandedGroup,
  useConnectionHandleHover,
  useCanvasContextMenu,
  useTileContextMenu,
  useLockConnection,
  useEnforceTileMinimumSizes,
  useLockedConnectionHelpers,
  type CanvasDragState,
} from './hooks/useCanvasEngine'
import { useTileMounting } from './hooks/useTileMounting'
import { useTileClipboard } from './hooks/useTileClipboard'
import { useCanvasTileShortcuts } from './hooks/useCanvasTileShortcuts'
import { useCanvasGroupManager } from './hooks/useCanvasGroupManager'
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard'
import { useCanvasGlow } from './hooks/useCanvasGlow'
import { useRenderTileBody } from './hooks/useRenderTileBody'
import { useAppThemeCssVars } from './hooks/useAppThemeCssVars'
import { useAutoAgentProximity } from './hooks/useAutoAgentProximity'
import { useDiscoveryPulses } from './hooks/useDiscoveryPulses'
import {
  extensionActionRegistry,
  findBestAnchorPair,
  getTileSpatialReference,
  type AnchorPoint,
} from './lib/discoveryRuntime'
import {
  getBezierConnectionPath,
  getConnectionHandlePoint,
  getNearestTileSide,
  getOppositeAnchorSide,
  getRouteMidpoint,
  getRouteSegments,
  getTileCenter,
  routeToSvgPath,
} from './lib/connectionRoutes'

import { getMinTileHeight, getMinTileWidth } from './utils/tilePlacement'


import { FontProvider, FontTokenProvider, SANS_DEFAULT, MONO_DEFAULT } from './FontContext'
import { ThemeProvider } from './ThemeContext'
import { applyContrast, DEFAULT_THEME_ID, getThemeById, resolveEffectiveThemeId, registerCustomTheme, unregisterCustomTheme } from './theme'
import type { PanelLeaf, PanelNode } from './components/panelLayoutTree'
import {
  createLeaf,
  removeTileFromTree,
  addTabToLeaf,
  getAllTileIds,
  splitLeaf,
  closeOthersInLeaf,
  closeToRightInLeaf,
  findLeafById,
  setActiveTab,
  pinTabInLeaf,
  findFirstLeafId,
  findLeafIdContainingTile,
  collectPanelLeaves,
  replaceLeafInPanelTree,
  sanitizePanelLayout,
} from './components/panelLayoutTree'
import { panelTreeHasSplit } from './lib/layoutSnap'
import { basename, getDroppedPaths } from './utils/dnd'
import { CODESURF_OPEN_LINK_EVENT, normalizeLocalPathCandidate, type CodeSurfOpenLinkDetail } from './utils/links'
import {
  CODESURF_CREATE_TILE_EVENT,
  CODESURF_OPEN_CHAT_SURFACE_EVENT,
  normalizeCreateTileDetail,
  normalizeOpenChatSurfaceDetail,
  resolveChatSurfaceTargetTile,
} from './utils/appLaunchRequests'
import { getChatTileRuntimeState, setChatTileRuntimeState } from './components/chatTileRuntimeState'
import { MainStatusBar } from './components/MainStatusBar'
import { DevSandboxFrame } from './components/DevSandboxFrame'
import { resolveProviderModeId } from './config/providers'

const LazyPanelLayout = React.lazy(() => import('./components/PanelLayout').then(m => ({ default: m.PanelLayout })))

type PendingSessionOpen =
  | { kind: 'chat'; session: SessionTargetEntry; workspaceId: string; options?: FocusOpenOptions }
  | { kind: 'app'; session: SessionTargetEntry; workspaceId: string }

type SessionTargetEntry = AggregatedSessionEntry | WorkspaceSessionEntry
type FocusOpenOptions = { persist?: boolean; sourceTileId?: string }
type MiniChatOptions = { workspaceId: string; tileId: string; title: string }

function readMiniChatOptions(): MiniChatOptions | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('miniChat') !== '1') return null
  const workspaceId = params.get('workspaceId')?.trim() ?? ''
  const tileId = params.get('tileId')?.trim() ?? ''
  if (!workspaceId || !tileId) return null
  return {
    workspaceId,
    tileId,
    title: params.get('title')?.trim() || 'Mini Chat',
  }
}

const INITIAL_EXTERNAL_SESSION_TAIL_LOAD = 20

function isRuntimeSessionEntryId(sessionEntryId: string): boolean {
  return sessionEntryId.startsWith('codesurf-runtime:')
    || sessionEntryId.startsWith('codesurf-tile:')
    || sessionEntryId.startsWith('codesurf-job:')
}

function buildSessionEntryHint(session: AggregatedSessionEntry): SessionEntryHint {
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

const LazyTileChrome = React.lazy(() => import('./components/TileChrome').then(m => ({ default: m.TileChrome })))
const LazySidebar = React.lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })))
const LazySidebarFooter = React.lazy(() => import('./components/Sidebar').then(m => ({ default: m.SidebarFooter })))
const LazyContextMenu = React.lazy(() => import('./components/ContextMenu').then(m => ({ default: m.ContextMenu })))
const LazyMCPPanel = React.lazy(() => import('./components/MCPPanel').then(m => ({ default: m.MCPPanel })))
const LazyArrangeToolbar = React.lazy(() => import('./components/ArrangeToolbar').then(m => ({ default: m.ArrangeToolbar })))
const LazyMinimap = React.lazy(() => import('./components/Minimap').then(m => ({ default: m.Minimap })))
const LazySettingsPanel = React.lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })))
const LazyExtensionsGallery = React.lazy(() => import('./components/ExtensionsGallery').then(m => ({ default: m.ExtensionsGallery })))
const LazyStickyColorPicker = React.lazy(() => import('./components/NoteTile').then(m => ({ default: m.StickyColorPicker })))
const LazyChatTile = React.lazy(() => import('./components/ChatTile').then(m => ({ default: m.ChatTile })))
const LazyConnectionPill = React.lazy(() => import('./components/ConnectionPill').then(m => ({ default: m.ConnectionPill })))
const LazyClusoWidgetMount = React.lazy(() =>
  import('./components/ClusoWidgetMount')
    .then(m => ({ default: m.ClusoWidgetMount }))
    .catch(() => ({ default: () => null }))
)
const LazyAgentSetup = React.lazy(() => import('./components/AgentSetup').then(m => ({ default: m.AgentSetup })))
const LazySkillInstallModal = React.lazy(() => import('./components/SkillInstallModal').then(m => ({ default: m.SkillInstallModal })))
const LazyCommandPalette = React.lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })))
const LazyOnboardingOverlay = React.lazy(() => import('./components/OnboardingOverlay').then(m => ({ default: m.OnboardingOverlay })))

const GRID = 20 // default, overridden by settings at runtime
const snap = (v: number, grid = GRID) => Math.round(v / grid) * grid

function normalizeWorkspacePath(path: string | null | undefined): string {
  return String(path ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
}

function getWorkspaceProjectPaths(workspace: Workspace): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  const push = (path: string | null | undefined) => {
    const normalized = normalizeWorkspacePath(path)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    next.push(normalized)
  }
  push(workspace.path)
  for (const projectPath of workspace.projectPaths ?? []) push(projectPath)
  return next
}

function isLayoutVariantWorkspace(workspace: Workspace, projectPath?: string | null): boolean {
  const normalizedProjectPath = normalizeWorkspacePath(projectPath ?? workspace.path)
  const projectBase = basename(normalizedProjectPath)
  const workspaceName = workspace.name?.trim() ?? ''
  if (!normalizedProjectPath || !projectBase || !workspaceName.startsWith(`${projectBase}:`)) return false
  const projectPaths = getWorkspaceProjectPaths(workspace)
  return projectPaths.length === 1 && projectPaths[0] === normalizedProjectPath
}

function getCanonicalWorkspaceId(workspaceList: Workspace[], workspaceId: string | null | undefined): string | null {
  if (!workspaceId) return null
  const target = workspaceList.find(candidate => candidate.id === workspaceId) ?? null
  if (!target) return null

  const normalizedProjectPath = normalizeWorkspacePath(target.path)
  if (!normalizedProjectPath || !isLayoutVariantWorkspace(target, normalizedProjectPath)) return target.id

  const canonical = workspaceList.find(candidate =>
    candidate.id !== target.id
    && normalizeWorkspacePath(candidate.path) === normalizedProjectPath
    && !isLayoutVariantWorkspace(candidate, normalizedProjectPath),
  ) ?? null

  return canonical?.id ?? target.id
}

function resolveWorkspaceCandidateForProjectPath(workspaceList: Workspace[], projectPath: string | null | undefined, currentWorkspaceId?: string | null): Workspace | null {
  const normalizedProjectPath = normalizeWorkspacePath(projectPath)
  if (!normalizedProjectPath) {
    const canonicalCurrentId = getCanonicalWorkspaceId(workspaceList, currentWorkspaceId)
    return canonicalCurrentId
      ? (workspaceList.find(candidate => candidate.id === canonicalCurrentId) ?? null)
      : null
  }

  const canonicalCurrentId = getCanonicalWorkspaceId(workspaceList, currentWorkspaceId)
  const currentWorkspace = canonicalCurrentId
    ? (workspaceList.find(candidate => candidate.id === canonicalCurrentId) ?? null)
    : null

  const currentWorkspacePath = normalizeWorkspacePath(currentWorkspace?.path)
  const currentWorkspaceProjects = currentWorkspace ? new Set(getWorkspaceProjectPaths(currentWorkspace)) : new Set<string>()

  if (currentWorkspace && currentWorkspaceProjects.has(normalizedProjectPath) && currentWorkspacePath !== normalizedProjectPath) {
    return currentWorkspace
  }

  if (currentWorkspace && currentWorkspacePath === normalizedProjectPath && !isLayoutVariantWorkspace(currentWorkspace, normalizedProjectPath)) {
    return currentWorkspace
  }

  const exactMatches = workspaceList.filter(candidate => normalizeWorkspacePath(candidate.path) === normalizedProjectPath)
  const canonicalExactMatch = exactMatches.find(candidate => !isLayoutVariantWorkspace(candidate, normalizedProjectPath)) ?? null
  if (canonicalExactMatch) return canonicalExactMatch

  if (currentWorkspace && exactMatches.some(candidate => candidate.id === currentWorkspace.id)) {
    return currentWorkspace
  }
  if (exactMatches.length > 0) return exactMatches[0]

  if (currentWorkspace && currentWorkspaceProjects.has(normalizedProjectPath)) {
    return currentWorkspace
  }

  const projectMatches = workspaceList.filter(candidate => getWorkspaceProjectPaths(candidate).includes(normalizedProjectPath))
  const canonicalProjectMatch = projectMatches.find(candidate => !isLayoutVariantWorkspace(candidate, normalizedProjectPath)) ?? null
  return canonicalProjectMatch ?? projectMatches[0] ?? null
}

function dedupeLockedConnections(connections: LockedConnection[]): LockedConnection[] {
  const seen = new Set<string>()
  const next: LockedConnection[] = []
  for (const connection of connections) {
    const sourceTileId = connection.sourceTileId?.trim()
    const targetTileId = connection.targetTileId?.trim()
    if (!sourceTileId || !targetTileId || sourceTileId === targetTileId) continue
    const [left, right] = sourceTileId < targetTileId
      ? [sourceTileId, targetTileId]
      : [targetTileId, sourceTileId]
    const key = `${left}::${right}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push({ sourceTileId, targetTileId })
  }
  return next
}

function WorkspaceTabIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  return <Package size={size} strokeWidth={2} aria-hidden="true" />
}

function WorkspaceTabLabel({ children, active }: { children: string; active: boolean }): React.JSX.Element {
  const sharedStyle: React.CSSProperties = {
    gridArea: '1 / 1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  }

  return (
    <span
      style={{
        display: 'grid',
        alignItems: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          ...sharedStyle,
          visibility: 'hidden',
          fontWeight: 700,
        }}
      >
        {children}
      </span>
      <span
        style={{
          ...sharedStyle,
          fontWeight: active ? 700 : 400,
        }}
      >
        {children}
      </span>
    </span>
  )
}

const CODE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'rs', 'go', 'cpp', 'c', 'java', 'css', 'html', 'sh', 'bash', 'yaml', 'yml', 'toml', 'xml'])
const NOTE_EXTENSIONS = new Set(['md', 'txt', 'markdown', 'mdx'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'heic', 'heif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'ogv', 'avi', 'mkv'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'])
const BROWSER_DOCUMENT_EXTENSIONS = new Set(['pdf'])
const GENERIC_DOCUMENT_EXTENSIONS = new Set(['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pages', 'numbers', 'key', 'rtf'])

function extToType(filePath: string): TileState['type'] {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  if (NOTE_EXTENSIONS.has(ext)) return 'note'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext)) return 'media'
  if (BROWSER_DOCUMENT_EXTENSIONS.has(ext)) return 'browser'
  if (GENERIC_DOCUMENT_EXTENSIONS.has(ext)) return 'file'
  if (!filePath.includes('.')) return 'code'
  return 'file'
}

async function resolveFileTileType(filePath: string): Promise<TileState['type']> {
  const byExtension = extToType(filePath)
  if (byExtension !== 'file') return byExtension

  try {
    const isText = await window.electron.fs.isProbablyTextFile(filePath)
    return isText ? 'code' : 'file'
  } catch {
    return byExtension
  }
}

function hrefToLocalPath(href: string): string | null {
  return normalizeLocalPathCandidate(href)
}

const SETTINGS_CACHE_KEY = 'contex:settings-cache'
const WORKSPACE_TAB_STATE_KEY = 'codesurf:workspace-tabs:v1'
const BRAND_WORDMARK_CACHE_KEY = 'contex:brand-wordmark-index'
const BRAND_WORDMARK_PALETTE_CACHE_KEY = 'contex:brand-wordmark-palette-index'

type PersistedWorkspaceTabState = {
  openWorkspaceIds: string[]
  currentWorkspaceId: string | null
}

function readCachedSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY)
    return raw ? withDefaultSettings(JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function readPersistedWorkspaceTabState(): PersistedWorkspaceTabState {
  if (typeof window === 'undefined') {
    return { openWorkspaceIds: [], currentWorkspaceId: null }
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_TAB_STATE_KEY)
    if (!raw) return { openWorkspaceIds: [], currentWorkspaceId: null }
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceTabState>
    const openWorkspaceIds = Array.isArray(parsed.openWorkspaceIds)
      ? parsed.openWorkspaceIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : []
    const currentWorkspaceId = typeof parsed.currentWorkspaceId === 'string' && parsed.currentWorkspaceId.trim().length > 0
      ? parsed.currentWorkspaceId
      : null
    return {
      openWorkspaceIds: Array.from(new Set(openWorkspaceIds)),
      currentWorkspaceId,
    }
  } catch {
    return { openWorkspaceIds: [], currentWorkspaceId: null }
  }
}

function persistWorkspaceTabState(state: PersistedWorkspaceTabState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WORKSPACE_TAB_STATE_KEY, JSON.stringify({
      openWorkspaceIds: Array.from(new Set(state.openWorkspaceIds.filter(id => typeof id === 'string' && id.trim().length > 0))),
      currentWorkspaceId: typeof state.currentWorkspaceId === 'string' && state.currentWorkspaceId.trim().length > 0
        ? state.currentWorkspaceId
        : null,
    }))
  } catch {
    // ignore localStorage failures
  }
}

function App(): JSX.Element {
  useAutoHideScrollbars()
  useScrollFadeIndicators()
  const miniChatOptions = useMemo(() => readMiniChatOptions(), [])

  const [tiles, setTiles] = useState<TileState[]>([])
  const [groups, setGroups] = useState<GroupState[]>([])
  const [lockedConnections, setLockedConnections] = useState<Array<{ sourceTileId: string; targetTileId: string }>>([])
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set())
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [dragState, setDragState] = useState<CanvasDragState>({ type: null })
  const [showMCP, setShowMCP] = useState(false)
  const [showSettings, setShowSettings] = useState<string | false>(false)
  const [showExtensionsGallery, setShowExtensionsGallery] = useState(false)
  // First-run onboarding (P9): gate on a real disk load so returning users
  // (whose persisted settings already have the flag) never see a flash.
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [showMinimap] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const { addTemplate: addLayoutTemplate } = useLayoutTemplates()
  const [expandedTileId, setExpandedTileId] = useState<string | null>(null)
  const [panelLayout, setPanelLayout] = useState<PanelNode | null>(null)
  const [chatReloadTokens, setChatReloadTokens] = useState<Record<string, number>>({})
  const [extActionsVersion, setExtActionsVersion] = useState(0)
  const [activePanelId, setActivePanelId] = useState<string | null>(null)
  const [, setExpandLayoutGroupId] = useState<string | null>(null)
  const expandLayoutGroupIdRef = useRef<string | null>(null)
  // Non-layout group expanded as a fullscreen sub-canvas. Members stay free-floating.
  const [expandedCanvasGroupId, setExpandedCanvasGroupId] = useState<string | null>(null)
  const expandedCanvasGroupIdRef = useRef<string | null>(null)
  // Forward ref so early-defined effects (e.g. Esc handler) can call the
  // canvas-expand exit before its useCallback is declared further down.
  const exitCanvasExpandedRef = useRef<() => void>(() => {})
  const savedLayoutRef = useRef<PanelNode | null>(null)
  const panelLayoutRef = useRef<PanelNode | null>(null)
  const activePanelIdRef = useRef<string | null>(null)
  const expandedTileIdRef = useRef<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(() => readCachedSettings())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [sidebarResizing, setSidebarResizing] = useState(false)
  const [sidebarSelectedPath, setSidebarSelectedPath] = useState<string | null>(null)
  const [canvasArrangeMode, setCanvasArrangeMode] = useState<'grid' | 'column' | 'row' | null>(null)
  const [guides, setGuides] = useState<{ x?: number; y?: number }[]>([])
  const [autoConnectionsEnabled] = useState(false)
  const [canvasPointerWorld, setCanvasPointerWorld] = useState<{ x: number; y: number } | null>(null)
  const [hoveredConnectionHandle, setHoveredConnectionHandle] = useState<{ tileId: string; side: AnchorPoint['side'] } | null>(null)
  const [showAgentSetup, setShowAgentSetup] = useState(false)
  // .skill install dialog — populated when user drops a .skill file on the
  // canvas or double-clicks one in Finder (forwarded via `skill:file-opened`
  // from the main process).
  const [skillInstallPath, setSkillInstallPath] = useState<string | null>(null)
  const { extensionTiles, extensionEntries } = useExtensions(
    workspace?.path ?? null,
    !settings.extensionsDisabled,
  )
  const extensionNameById = useMemo(
    () => new Map((extensionEntries ?? []).map(entry => [entry.id, entry.name] as const)),
    [extensionEntries],
  )
  const extensionTileByType = useMemo(
    () => new Map((extensionTiles ?? []).map(entry => [entry.type, entry] as const)),
    [extensionTiles],
  )
  const visibleSidebarExtensionTiles = useMemo(() => {
    if (settings.extensionsDisabled) return []
    const hidden = new Set(settings.hiddenFromSidebarExtIds ?? [])
    return extensionTiles.filter(entry => !hidden.has(entry.extId))
  }, [settings.extensionsDisabled, settings.hiddenFromSidebarExtIds, extensionTiles])
  const visibleSidebarExtensionEntries = useMemo(() => {
    if (settings.extensionsDisabled) return []
    const hidden = new Set(settings.hiddenFromSidebarExtIds ?? [])
    return extensionEntries.filter(entry => entry.enabled !== false && !hidden.has(entry.id))
  }, [settings.extensionsDisabled, settings.hiddenFromSidebarExtIds, extensionEntries])
  const [systemPrefersDark, setSystemPrefersDark] = useState(true)
  const [brandWordmarkIndex, setBrandWordmarkIndex] = useState(1)
  const [brandPaletteIndex, setBrandPaletteIndex] = useState(0)
  const [brandPrefsReadyTheme, setBrandPrefsReadyTheme] = useState<string | null>(null)
  const [pendingSessionOpen, setPendingSessionOpen] = useState<PendingSessionOpen | null>(null)
  const [showWorkspacePickerTab, setShowWorkspacePickerTab] = useState(false)
  const [workspacePickerReturnWorkspaceId, setWorkspacePickerReturnWorkspaceId] = useState<string | null>(null)
  const latestSettingsSaveRef = useRef(0)

  useEffect(() => { panelLayoutRef.current = panelLayout }, [panelLayout])
  useEffect(() => { activePanelIdRef.current = activePanelId }, [activePanelId])
  useEffect(() => { expandedTileIdRef.current = expandedTileId }, [expandedTileId])
  useEffect(() => { expandedCanvasGroupIdRef.current = expandedCanvasGroupId }, [expandedCanvasGroupId])
  const currentWorkspaceIdRef = useRef<string | null>(workspace?.id ?? null)
  useEffect(() => { currentWorkspaceIdRef.current = workspace?.id ?? null }, [workspace?.id])
  const workspaceTabsHydratedRef = useRef(false)

  const selectedWorkspaceFilePath = useMemo(() => {
    if (!workspace?.path) return null

    const tileById = new Map(tiles.map(tile => [tile.id, tile]))
    const toWorkspaceFilePath = (tileId: string | null | undefined): string | null => {
      if (!tileId) return null
      const filePath = tileById.get(tileId)?.filePath
      return filePath && filePath.startsWith(workspace.path) ? filePath : null
    }

    if (panelLayout && activePanelId) {
      const leaf = findLeafById(panelLayout, activePanelId)
      const panelPath = toWorkspaceFilePath(leaf?.activeTab)
      if (panelPath) return panelPath
    }

    const expandedPath = toWorkspaceFilePath(expandedTileId)
    if (expandedPath) return expandedPath

    const selectedPath = toWorkspaceFilePath(selectedTileId)
    if (selectedPath) return selectedPath

    for (const tileId of selectedTileIds) {
      const multiSelectedPath = toWorkspaceFilePath(tileId)
      if (multiSelectedPath) return multiSelectedPath
    }

    return null
  }, [workspace?.path, tiles, panelLayout, activePanelId, expandedTileId, selectedTileId, selectedTileIds])

  useEffect(() => {
    setSidebarSelectedPath(null)
  }, [workspace?.id])

  useEffect(() => {
    if (selectedWorkspaceFilePath) setSidebarSelectedPath(selectedWorkspaceFilePath)
  }, [selectedWorkspaceFilePath])

  const getPanelTileLabel = useCallback((tileId: string): string => {
    const tile = tiles.find(ti => ti.id === tileId)
    if (!tile) return 'Unknown'
    if (tile.label?.trim()) return tile.label.trim()
    if (tile.filePath) return tile.filePath.replace(/\\/g, '/').split('/').pop() ?? tile.filePath
    if (tile.type.startsWith('ext:')) {
      const tileLabel = extensionTileByType.get(tile.type)?.label
      if (tileLabel?.trim()) return tileLabel.trim()
      const friendlyName = extensionNameById.get(tile.type.slice(4))
      if (friendlyName?.trim()) return friendlyName.trim()
    }
    return tile.type.charAt(0).toUpperCase() + tile.type.slice(1)
  }, [extensionNameById, extensionTileByType, tiles])

  const getPanelTileIcon = useCallback((tileId: string): string | undefined => {
    const tile = tiles.find(ti => ti.id === tileId)
    if (!tile?.type.startsWith('ext:')) return undefined
    return extensionTileByType.get(tile.type)?.icon
  }, [extensionTileByType, tiles])

  // Workspace pill tabs — open workspace ids within this window
  const [openWorkspaceIds, setOpenWorkspaceIds] = useState<string[]>([])
  useEffect(() => {
    if (miniChatOptions) return
    if (workspace?.id) setOpenWorkspaceIds(prev => prev.includes(workspace.id) ? prev : [...prev, workspace.id])
  }, [workspace?.id, miniChatOptions])
  useEffect(() => {
    if (miniChatOptions) return
    const canonicalCurrentWorkspaceId = getCanonicalWorkspaceId(workspaces, workspace?.id)
    if (workspace?.id && canonicalCurrentWorkspaceId && canonicalCurrentWorkspaceId !== workspace.id) return

    setOpenWorkspaceIds(prev => {
      const next = Array.from(new Set(
        prev
          .map(id => getCanonicalWorkspaceId(workspaces, id) ?? id)
          .filter(id => workspaces.some(workspaceEntry => workspaceEntry.id === id)),
      ))
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) return prev
      return next
    })
  }, [workspace?.id, workspaces, miniChatOptions])

  useEffect(() => {
    if (miniChatOptions) return
    if (!workspaceTabsHydratedRef.current) return
    const canonicalWorkspaceId = getCanonicalWorkspaceId(workspaces, workspace?.id) ?? workspace?.id ?? null
    const canonicalWorkspacePickerReturnId = getCanonicalWorkspaceId(workspaces, workspacePickerReturnWorkspaceId) ?? workspacePickerReturnWorkspaceId ?? null
    persistWorkspaceTabState({
      openWorkspaceIds,
      currentWorkspaceId: canonicalWorkspaceId ?? canonicalWorkspacePickerReturnId ?? openWorkspaceIds[0] ?? null,
    })
  }, [openWorkspaceIds, workspace?.id, workspacePickerReturnWorkspaceId, workspaces, miniChatOptions])

  const pasteTilesRef = useRef<(pos?: { x: number; y: number }, intoGroupId?: string) => void>(() => {})
  const duplicateTilesRef = useRef<(ids?: string[]) => void>(() => {})
  const copyTilesRef = useRef<(cut?: boolean) => void>(() => {})
  const groupSelectedTilesRef = useRef<() => void>(() => {})
  const groupBoundsRef = useRef<(id: string) => { x: number; y: number; w: number; h: number } | null>(() => null)
  const ungroupTilesRef = useRef<(groupId: string) => void>(() => {})
  const ungroupAllRef = useRef<(groupId: string) => void>(() => {})

  // Refs that always reflect the latest tiles/groups state (for use in keyboard handlers)
  const tilesRef = useRef<TileState[]>(tiles)
  const groupsRef = useRef<GroupState[]>(groups)
  const lockedConnectionsRef = useRef(lockedConnections)
  useEffect(() => { lockedConnectionsRef.current = lockedConnections }, [lockedConnections])
  const [suppressedConnections, setSuppressedConnections] = useState<Set<string>>(new Set())
  const suppressedConnectionsRef = useRef(suppressedConnections)
  useEffect(() => { suppressedConnectionsRef.current = suppressedConnections }, [suppressedConnections])

  // Keep tilesRef / groupsRef in sync with state
  tilesRef.current = tiles
  groupsRef.current = groups

  // Context menus
  type CtxMenu = { x: number; y: number; items: MenuItem[] }
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const closeCtx = useCallback(() => setCtxMenu(null), [])

  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasPersistSuspendedRef = useRef(false)

  const canvasEngine = useCanvasEngine({
    workspace,
    canvasRef,
    tiles,
    groups,
    panelLayout,
    activePanelId,
    expandedTileId,
    persistRefs: {
      tilesRef,
      groupsRef,
      lockedConnectionsRef,
      panelLayoutRef,
      savedLayoutRef,
      activePanelIdRef,
      expandedTileIdRef,
      expandedCanvasGroupIdRef,
      canvasPersistSuspendedRef,
    },
    setTiles,
    setGroups,
  })

  const {
    viewport,
    setViewport,
    viewportRef,
    nextZIndex,
    setNextZIndex,
    nextZIndexRef,
    expandedCanvasPriorViewportRef,
    persistCanvasStateRef,
    panLastPos,
    screenToWorld,
    worldToScreen: worldToScreenPoint,
    viewportCenter,
    saveCanvas,
    persistCanvasState,
    zoomToFitArrangedTiles,
    panToTile,
    toggleZoomOne,
    cancelPanInertia,
    findManualConnectionTarget,
    restoreViewport,
    resetViewportState,
    handleWheel,
    undoCanvas,
    redoCanvas,
    flushDeferredCanvasPersist,
  } = canvasEngine

  const panelTileIdsRef = useRef<Set<string>>(new Set())
  const { discoveryPulses, triggerDiscoveryPulse } = useDiscoveryPulses({
    enabled: autoConnectionsEnabled,
    settings,
    panelTileIdsRef,
  })
  useAutoAgentProximity({
    enabled: autoConnectionsEnabled,
    miniChatMode: Boolean(miniChatOptions),
    workspaceId: workspace?.id,
    tiles,
    dragActive: dragState.type !== null,
    settings,
    panelTileIdsRef,
    setTiles,
  })
  const spaceHeld = useRef(false)
  const canvasGlowEnabled = settings.canvasGlowEnabled
  const canvasGlowRadius = Math.max(50, Math.min(200, settings.canvasGlowRadius ?? 120))
  const {
    dotGlowSmallRef,
    dotGlowLargeRef,
    discoveryGlowRef,
    hideCanvasGlow,
    updateCanvasGlow,
  } = useCanvasGlow({
    canvasRef,
    canvasGlowEnabled,
    canvasGlowRadius,
    viewportZoom: viewport.zoom,
  })
  const snapValue = React.useCallback((value: number) => (
    settings.snapToGrid ? snap(value, settings.gridSize) : value
  ), [settings.snapToGrid, settings.gridSize])

  const showEmptyLayoutPage = useCallback((options?: { preserveOpenTabs?: boolean }) => {
    const preserveOpenTabs = options?.preserveOpenTabs ?? false
    const emptyPanel = createLeaf([])
    setShowWorkspacePickerTab(true)
    setWorkspacePickerReturnWorkspaceId(preserveOpenTabs ? currentWorkspaceIdRef.current : null)
    setWorkspace(null)
    if (!preserveOpenTabs) setOpenWorkspaceIds([])
    setTiles([])
    setGroups([])
    setLockedConnections([])
    resetViewportState()
    savedLayoutRef.current = emptyPanel
    setPanelLayout(emptyPanel)
    setActivePanelId(emptyPanel.id)
    setExpandedTileId(null)
  }, [resetViewportState])

  // ─── Load workspace + canvas state on mount ───────────────────────────────
  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings))
    } catch {}
  }, [settings])

  // Listen for .skill files opened via Finder / file-association / argv. Also
  // signal `skills:rendererReady` so main can flush any paths queued before
  // the renderer was mounted.
  //
  // Additionally install a window-level drop listener so `.skill` bundles can
  // be dropped anywhere in the app — full-screen chat / panel layout / expanded
  // tiles — not just the canvas. Only files with the `.skill` extension are
  // intercepted; all other drags fall through to their local handlers.
  useEffect(() => {
    const api = window.electron?.skills
    const unsubList: Array<() => void> = []
    if (api) {
      const unsub = api.onFileOpened(({ path }) => {
        if (path && path.toLowerCase().endsWith('.skill')) {
          setSkillInstallPath(path)
        }
      })
      void api.ready().catch(() => {})
      unsubList.push(() => { try { unsub() } catch {} })
    }

    // Detect whether a drag contains OS files. `types` is the only reliable
    // signal available during dragover — the actual file list is opaque until
    // drop fires, per the HTML5 DnD spec.
    const dragHasFiles = (dt: DataTransfer | null): boolean => {
      if (!dt) return false
      const types = dt.types
      if (!types) return false
      for (let i = 0; i < types.length; i++) {
        if (types[i] === 'Files' || types[i] === 'application/x-moz-file') return true
      }
      return false
    }

    const onWindowDragOver = (e: DragEvent): void => {
      // Only enable drops where the default drop target is normally rejected
      // (outside the canvas). The canvas already preventDefaults on its own,
      // so calling it again here is harmless. We gate on Files so internal
      // HTML drags (text selections, etc.) are untouched.
      if (dragHasFiles(e.dataTransfer)) {
        e.preventDefault()
      }
    }

    const onWindowDrop = (e: DragEvent): void => {
      if (!dragHasFiles(e.dataTransfer)) return
      const paths = getDroppedPaths(e.dataTransfer)
      const skillPath = paths.find(p => p.toLowerCase().endsWith('.skill'))
      if (!skillPath) return
      // `.skill` bundles are always consumed by the install modal regardless
      // of which view is active. Stop propagation so no tile-level handler
      // interprets the path as a regular file drop.
      e.preventDefault()
      e.stopPropagation()
      setSkillInstallPath(skillPath)
    }

    window.addEventListener('dragover', onWindowDragOver)
    // Capture phase so we reach the handler before tile-level listeners that
    // might try to swallow the drop.
    window.addEventListener('drop', onWindowDrop, true)

    unsubList.push(() => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('drop', onWindowDrop, true)
    })

    return () => { for (const fn of unsubList) fn() }
  }, [])

  const updateAppSettings = useCallback((patch: Partial<AppSettings> | ((current: AppSettings) => Partial<AppSettings>)) => {
    setSettings(current => {
      const resolvedPatch = typeof patch === 'function' ? patch(current) : patch
      const next = withDefaultSettings({ ...current, ...resolvedPatch })
      const requestId = ++latestSettingsSaveRef.current
      void window.electron.settings?.set(next).then(saved => {
        if (!saved || requestId !== latestSettingsSaveRef.current) return
        setSettings(withDefaultSettings(saved))
      }).catch(err => {
        console.warn('[settings] Failed to persist app settings patch:', err)
      })
      return next
    })
  }, [])

  const rememberChatProviderMode = useCallback((providerId: string, modeId: string) => {
    const provider = providerId.trim()
    if (!provider) return
    const normalizedMode = resolveProviderModeId(provider, modeId)
    updateAppSettings(current => ({
      chatProviderModes: {
        ...(current.chatProviderModes ?? {}),
        [provider]: normalizedMode,
      },
    }))
  }, [updateAppSettings])

  useEffect(() => {
    async function init(): Promise<void> {
      if (!window.electron) {
        console.warn('window.electron not available — preload may not have loaded')
        return
      }
      const isFresh = await window.electron.window.isFresh()
      const [wsList, active, savedSettings] = await Promise.all([
        window.electron.workspace.list(),
        isFresh ? Promise.resolve(null) : window.electron.workspace.getActive(),
        window.electron.settings?.get()
      ])
      const persistedWorkspaceTabs = readPersistedWorkspaceTabState()
      if (savedSettings) setSettings(withDefaultSettings(savedSettings))
      setSettingsLoaded(true)
      setWorkspaces(wsList)
      const workspaceById = new Map(wsList.map(entry => [entry.id, entry]))
      const restoredWorkspaceId = getCanonicalWorkspaceId(wsList, persistedWorkspaceTabs.currentWorkspaceId)
      const activeWorkspaceId = getCanonicalWorkspaceId(wsList, active?.id ?? null)
      const fallbackWorkspaceId = getCanonicalWorkspaceId(wsList, wsList[0]?.id ?? null)
      let targetWorkspace: Workspace | null =
        (restoredWorkspaceId ? workspaceById.get(restoredWorkspaceId) : undefined)
        ?? (activeWorkspaceId ? workspaceById.get(activeWorkspaceId) : undefined)
        ?? (fallbackWorkspaceId ? workspaceById.get(fallbackWorkspaceId) : undefined)
        ?? null
      if (miniChatOptions) {
        const miniId = getCanonicalWorkspaceId(wsList, miniChatOptions.workspaceId)
        if (miniId) {
          targetWorkspace = workspaceById.get(miniId) ?? targetWorkspace
        }
      }
      const restoredOpenWorkspaceIds = persistedWorkspaceTabs.openWorkspaceIds
        .map(id => getCanonicalWorkspaceId(wsList, id))
        .filter((id): id is string => id != null && workspaceById.has(id))

      if (targetWorkspace && !restoredOpenWorkspaceIds.includes(targetWorkspace.id)) {
        restoredOpenWorkspaceIds.push(targetWorkspace.id)
      }

      setOpenWorkspaceIds(Array.from(new Set(restoredOpenWorkspaceIds)))
      setWorkspace(targetWorkspace)
      workspaceTabsHydratedRef.current = true

      if (targetWorkspace && !miniChatOptions && active?.id !== targetWorkspace.id) {
        await window.electron.workspace.setActive(targetWorkspace.id).catch(() => {})
      }

      if (!targetWorkspace) {
        showEmptyLayoutPage()
        return
      }
      if (targetWorkspace) {
        const saved: CanvasState | null = await window.electron.canvas.load(targetWorkspace.id)
        const savedTiles = saved?.tiles ?? []
        void window.electron.collab.pruneOrphanedTileDirs(targetWorkspace.path, savedTiles.map(tile => tile.id))
        if (saved) {
          const sanitizedPanel = sanitizePanelLayout((saved.panelLayout as PanelNode | null) ?? null, savedTiles.map(tile => tile.id))
          const nextActivePanelId = saved.activePanelId && sanitizedPanel.layout && findLeafById(sanitizedPanel.layout, saved.activePanelId)
            ? saved.activePanelId
            : sanitizedPanel.fallbackActivePanelId
          setTiles(savedTiles)
          setGroups(saved.groups ?? [])
          setLockedConnections(saved.lockedConnections ?? [])
          restoreViewport(saved.viewport)
          setNextZIndex(saved.nextZIndex ?? 1)
          savedLayoutRef.current = sanitizedPanel.layout
          setPanelLayout(saved.tabViewActive ? (sanitizedPanel.layout ?? createLeaf([])) : null)
          setActivePanelId(saved.tabViewActive ? nextActivePanelId : null)
          setExpandedTileId(saved.expandedTileId ?? null)
          setExpandedCanvasGroupId(saved.expandedCanvasGroupId ?? null)
          expandedCanvasGroupIdRef.current = saved.expandedCanvasGroupId ?? null
          expandedCanvasPriorViewportRef.current = saved.expandedCanvasPriorViewport ?? null
        } else {
          showEmptyLayoutPage({ preserveOpenTabs: true })
        }
      }
    }
    init()

    // Check if agent setup is needed (first run or paths not confirmed)
    // Force with: CONTEX_SHOW_SETUP=1 npm run dev
    const forceSetup = import.meta.env.VITE_SHOW_SETUP === '1'
    if (!miniChatOptions) {
      if (forceSetup) {
        setShowAgentSetup(true)
      } else {
        window.electron?.agentPaths?.needsSetup?.().then((needs: boolean) => {
          if (needs) setShowAgentSetup(true)
        }).catch(() => {})
      }
    }
  }, [showEmptyLayoutPage, miniChatOptions?.workspaceId])

  // ─── Subscribe to custom theme registrations from extensions ─────────────
  useEffect(() => {
    const subscriberId = 'app:theme-bus'
    window.electron.bus?.subscribe('themes', subscriberId, () => {})
    const unsubEvent = window.electron.bus?.onEvent((event: { channel: string; payload: unknown }) => {
      if (event?.channel !== 'themes') return
      const data = event.payload as { action?: string; theme?: unknown; themeId?: string } | null
      if (!data) return
      if (data.action === 'register' && data.theme) {
        try { registerCustomTheme(data.theme as Parameters<typeof registerCustomTheme>[0]) } catch { /* skip invalid */ }
      }
      if (data.action === 'apply' && data.theme) {
        try {
          registerCustomTheme(data.theme as Parameters<typeof registerCustomTheme>[0])
          if (data.themeId) setSettings(s => ({ ...s, themeId: data.themeId as string }))
        } catch { /* skip invalid */ }
      }
      if (data.action === 'delete') {
        const deletedThemeId = typeof (data as { id?: unknown }).id === 'string' ? (data as { id: string }).id : ''
        if (!deletedThemeId) return
        unregisterCustomTheme(deletedThemeId)
        setSettings(s => s.themeId === deletedThemeId ? { ...s, themeId: DEFAULT_THEME_ID } : s)
      }
    })
    return () => {
      window.electron.bus?.unsubscribeAll(subscriberId)
      unsubEvent?.()
    }
  }, [])

  // ─── Promote single-tile fullscreen → layout-group fullscreen ───────────
  // When the user is in path-2 (double-clicked a single tile) and the panel
  // grows beyond one tile (via split / new tab), we materialize the panel as
  // a real layout-group on the canvas immediately. From that moment on, the
  // fullscreen panel and the canvas group share the same layout tree —
  // identical to path 3. This means: no "magic group appears at exit"; the
  // group exists from the moment a layout becomes a layout.
  const promoteExpandedTileToLayoutGroup = useCallback(() => {
    // Already a real layout group (path 3) — nothing to do
    if (expandLayoutGroupIdRef.current) return
    // Not in single-tile-expand mode (path 1 or no panel) — skip
    const anchorTileId = expandedTileIdRef.current
    if (!anchorTileId) return
    const layout = panelLayoutRef.current
    if (!layout) return
    // tabs != layout: a single leaf full of tabs is just "siblings reachable as
    // tabs" and must stay transient. Only a real spatial split promotes.
    if (!panelTreeHasSplit(layout)) return
    const tileIds = getAllTileIds(layout)

    const groupId = `group-${Date.now()}`
    const anchor = tilesRef.current.find(t => t.id === anchorTileId)

    // ── Placement strategy ──────────────────────────────────────────────────
    // TODO(design): refine where the new layout-group lands on canvas.
    //   (A) anchor.x/y with a generous default size — keeps originating tile
    //       visually anchored to its starting spot
    //   (B) viewport-center, default size — predictable but loses spatial link
    //   (C) anchor.x/y but size = max(anchor, 800x600) — current
    // 5–10 line tweak opportunity if you want to try (B) or push neighbors aside.
    const DEFAULT_W = 800
    const DEFAULT_H = 600
    const baseX = anchor?.x ?? (viewportRef.current ? -viewportRef.current.tx / viewportRef.current.zoom : 0)
    const baseY = anchor?.y ?? (viewportRef.current ? -viewportRef.current.ty / viewportRef.current.zoom : 0)
    const w = Math.max(anchor?.width ?? 0, DEFAULT_W)
    const h = Math.max(anchor?.height ?? 0, DEFAULT_H)
    const layoutBounds = { x: baseX, y: baseY, w, h }

    const newGroup: GroupState = {
      id: groupId,
      color: '#4a9eff',
      layoutMode: true,
      layout,
      layoutBounds,
    }

    const ids = new Set(tileIds)
    setGroups(prev => {
      const updatedGroups = [...prev, newGroup]
      setTiles(tPrev => {
        const updatedTiles = tPrev.map(t => ids.has(t.id) ? { ...t, groupId } : t)
        setTimeout(() => persistCanvasStateRef.current?.(updatedTiles, viewportRef.current, nextZIndexRef.current, updatedGroups), 0)
        return updatedTiles
      })
      return updatedGroups
    })

    // Switch from path-2 mode to path-3 mode — exit/escape now flows through
    // the existing "save layout back to group" branch.
    setExpandLayoutGroupId(groupId)
    expandLayoutGroupIdRef.current = groupId
    setExpandedTileId(null)
  }, [])

  // ─── Eager promotion: as soon as a single-tile-expand grows to ≥2 tiles,
  //     materialize it as a real layout-group on the canvas. From that
  //     moment on, the fullscreen view is just path-3 (group fullscreen).
  useEffect(() => {
    if (!panelLayout) return
    if (expandLayoutGroupIdRef.current) return  // already a group
    if (!expandedTileIdRef.current) return       // not path-2
    if (panelTreeHasSplit(panelLayout)) {
      promoteExpandedTileToLayoutGroup()
    }
  }, [panelLayout, promoteExpandedTileToLayoutGroup])

  // ─── Escape to collapse expanded tile ────────────────────────────────────
  const exitExpandedMode = useCallback(() => {
    // Safety net: if the promotion useEffect hasn't fired yet (shouldn't
    // happen under normal React scheduling, but defensive), promote now.
    promoteExpandedTileToLayoutGroup()

    const expandingGroup = expandLayoutGroupIdRef.current
    setPanelLayout(prev => {
      if (expandingGroup && prev) {
        // Path 3 — fullscreen of an existing layout group (or a freshly-
        // promoted one from path 2). Save layout back so canvas-side syncs.
        setGroups(grps => {
          const updated = grps.map(g => g.id === expandingGroup ? { ...g, layout: prev } : g)
          setTimeout(() => persistCanvasStateRef.current?.(tilesRef.current, viewportRef.current, nextZIndexRef.current, updated), 0)
          return updated
        })
      } else if (expandedTileIdRef.current) {
        // Path 2 with only the original tile (never grew to a layout) —
        // clean exit, don't touch savedLayoutRef (that belongs to path 1).
      } else if (!expandingGroup) {
        // Path 1 — toolbar tab toggle. Preserve current "revert to canvas as
        // it was" semantics by saving the layout for the next toggle restore.
        savedLayoutRef.current = prev
      }
      return null
    })
    setExpandedTileId(null)
    setActivePanelId(null)
    setExpandLayoutGroupId(null)
    expandLayoutGroupIdRef.current = null
  }, [promoteExpandedTileToLayoutGroup])

  const enterExpandedMode = useCallback((tileId: string) => {
    // Fullscreen the clicked tile; its SAME-GROUP siblings become tabs in the same
    // leaf (PanelLayout's existing tab strip renders them). Deliberately scoped to
    // group siblings (not ALL canvas tiles): seeding every tile would, once one tab
    // is dragged into a split, vacuum the whole canvas into one persistent layout
    // group on exit. Tabs alone never promote (panelTreeHasSplit gate); only a real
    // split does. Other canvas tiles stay on canvas.
    const SIBLING_CAP = 8
    const clicked = tilesRef.current.find(t => t.id === tileId)
    const siblingIds = clicked?.groupId
      ? tilesRef.current
          .filter(t => t.id !== tileId && t.groupId === clicked.groupId && !panelTileIdsRef.current.has(t.id))
          .map(t => t.id)
          .slice(0, SIBLING_CAP - 1)
      : []
    const ordered = [tileId, ...siblingIds]
    const leaf = createLeaf(ordered, tileId)
    setExpandedTileId(tileId)
    setPanelLayout(leaf)
    setActivePanelId(leaf.id)
  }, [])

  const enterTabbedView = useCallback(() => {
    const currentIds = tilesRef.current.map(t => t.id)
    const currentIdSet = new Set(currentIds)

    if (savedLayoutRef.current) {
      // Restore saved layout — prune removed tiles, append any new ones
      let restored: PanelNode = savedLayoutRef.current

      // Remove tiles that no longer exist on canvas
      const savedIds = getAllTileIds(savedLayoutRef.current)
      for (const id of savedIds) {
        if (!currentIdSet.has(id)) {
          restored = removeTileFromTree(restored, id) ?? restored
        }
      }

      // Append new tiles (not in saved layout) to the first leaf
      const restoredIds = new Set(getAllTileIds(restored))
      const newIds = currentIds.filter(id => !restoredIds.has(id))
      // Find active panel id from restored tree
      const firstLeaf = (function find(n: PanelNode): string | null {
        if (n.type === 'leaf') return n.id
        return find(n.children[0])
      })(restored)

      for (const id of newIds) {
        if (firstLeaf) restored = addTabToLeaf(restored, firstLeaf, id)
      }

      setPanelLayout(restored)
      setActivePanelId(firstLeaf)
      setExpandedTileId(null)
    } else {
      // No saved layout — fresh leaf with all tiles
      const leaf = createLeaf(currentIds, currentIds[0])
      setPanelLayout(leaf)
      setActivePanelId(leaf.id)
      setExpandedTileId(null)
    }
  }, [])

  const handleCanvasEscape = useCallback(() => {
    if (expandedCanvasGroupIdRef.current) {
      exitCanvasExpandedRef.current()
      return
    }
    exitExpandedMode()
  }, [exitExpandedMode])

  const lockConnection = useLockConnection({
    persistCanvasState,
    tilesRef,
    groupsRef,
    viewportRef,
    nextZIndexRef,
    lockedConnectionsRef,
    setLockedConnections,
    setSuppressedConnections,
  })

  const getInitialTileSize = useCallback((type: TileState['type']) => {
    const configured = settings.defaultTileSizes[type]
    if (configured) return configured
    if (type.startsWith('ext:')) {
      const extDefault = extensionTiles.find(ext => ext.type === type)?.defaultSize
      if (extDefault) return extDefault
      return { w: 360, h: 280 }
    }
    return { w: 600, h: 400 }
  }, [settings.defaultTileSizes, extensionTiles])

  const pinnedCanvasExtensionTiles = useMemo(() => {
    if (settings.extensionsDisabled) return []
    const pinned = new Set(settings.pinnedExtensionIds ?? [])
    if (pinned.size === 0) return []
    return extensionTiles.filter(ext => pinned.has(ext.extId) || pinned.has(ext.type))
  }, [settings.extensionsDisabled, settings.pinnedExtensionIds, extensionTiles])

  // "You are here" signal for the sidebar's session list. Looks at the current
  // focus: the fullscreen/expanded tile first, then the active panel's active
  // tab, then the selected canvas tile. Only reports the id if that tile is a
  // chat — otherwise the highlight stays off.
  const activeChatTileId = useMemo(() => {
    const candidates: (string | null)[] = []
    if (expandedTileId) candidates.push(expandedTileId)
    if (panelLayout && activePanelId) {
      const leaf = findLeafById(panelLayout, activePanelId)
      if (leaf?.activeTab) candidates.push(leaf.activeTab)
    }
    if (selectedTileId) candidates.push(selectedTileId)
    for (const id of candidates) {
      if (!id) continue
      const tile = tiles.find(t => t.id === id)
      if (tile?.type === 'chat') return tile.id
    }
    return null
  }, [expandedTileId, panelLayout, activePanelId, selectedTileId, tiles])
  const [chatTileSessionMatches, setChatTileSessionMatches] = useState<Record<string, { entryId: string | null; sessionId: string | null }>>({})
  const rememberChatTileSessionMatch = useCallback((tileId: string, session: AggregatedSessionEntry, sessionIdOverride?: string | null) => {
    const sessionId = sessionIdOverride === undefined
      ? (typeof session.sessionId === 'string' ? session.sessionId : null)
      : sessionIdOverride
    setChatTileSessionMatches(prev => {
      const current = prev[tileId]
      if (current?.entryId === session.id && current?.sessionId === sessionId) return prev
      return {
        ...prev,
        [tileId]: {
          entryId: session.id,
          sessionId,
        },
      }
    })
  }, [])
  const activeChatSessionMatch = useMemo(() => {
    if (!activeChatTileId) return { entryId: null, sessionId: null }
    const remembered = chatTileSessionMatches[activeChatTileId] ?? { entryId: null, sessionId: null }
    const runtimeState = getChatTileRuntimeState<{ sessionId?: string | null; linkedSessionEntryId?: string | null }>(activeChatTileId)
    const runtimeEntryId = typeof runtimeState?.linkedSessionEntryId === 'string' ? runtimeState.linkedSessionEntryId : null
    const runtimeSessionId = typeof runtimeState?.sessionId === 'string' ? runtimeState.sessionId : null
    return {
      entryId: runtimeEntryId ?? remembered.entryId,
      sessionId: runtimeSessionId ?? remembered.sessionId,
    }
  }, [activeChatTileId, chatTileSessionMatches])
  const preferredBrowserOpenTargetRef = useRef<string | null>(null)

  const {
    buildTileState,
    mountTile,
    replacePreviewTile,
    pinPreviewTab,
    addTile,
    closeTile,
  } = useTileMounting({
    workspace,
    gridSize: settings.gridSize,
    gridSpacingSmall: settings.gridSpacingSmall,
    tilesRef,
    panelTileIdsRef,
    panelLayoutRef,
    activePanelIdRef,
    viewportRef,
    nextZIndexRef,
    selectedTileId,
    setTiles,
    setNextZIndex,
    setSelectedTileId,
    setPanelLayout,
    setActivePanelId,
    setChatTileSessionMatches,
    saveCanvas,
    viewportCenter,
    snapValue,
    getInitialTileSize,
    triggerDiscoveryPulse,
  })

  const getNavigationLeaf = useCallback((): PanelLeaf | null => {
    const layout = panelLayoutRef.current
    if (!layout) return null
    if (activePanelIdRef.current) {
      const activeLeaf = findLeafById(layout, activePanelIdRef.current)
      if (activeLeaf) return activeLeaf
    }
    const firstLeafId = findFirstLeafId(layout)
    return firstLeafId ? findLeafById(layout, firstLeafId) : null
  }, [])

  const isPreviewTabReplaceable = useCallback((tileId: string): boolean => {
    const tile = tilesRef.current.find(candidate => candidate.id === tileId)
    if (!tile) return false
    if (tile.type === 'terminal') return false
    if (tile.type === 'chat') {
      const runtimeState = getChatTileRuntimeState<{ isStreaming?: boolean }>(tileId)
      return runtimeState?.isStreaming !== true
    }
    return true
  }, [])

  const findPanelFileOpenLeaf = useCallback((sourceTileId: string | undefined, fileType: TileState['type']): PanelLeaf | null => {
    const layout = panelLayoutRef.current
    if (!layout) return null

    const fallbackLeaf = getNavigationLeaf()
    const isEditorFile = fileType === 'code' || fileType === 'note'
    if (!sourceTileId || !isEditorFile) return fallbackLeaf

    const leaves = collectPanelLeaves(layout)
    const sourceLeafId = findLeafIdContainingTile(layout, sourceTileId)
    const sourceLeaf = sourceLeafId ? findLeafById(layout, sourceLeafId) : null
    const tileById = new Map(tilesRef.current.map(tile => [tile.id, tile]))
    const hasEditorRole = (leaf: PanelLeaf): boolean => leaf.tabs.some(tileId => {
      const tile = tileById.get(tileId)
      return tile?.type === 'code' || tile?.type === 'note'
    })
    const hasBlankEditor = (leaf: PanelLeaf): boolean => leaf.tabs.some(tileId => {
      const tile = tileById.get(tileId)
      return (tile?.type === 'code' || tile?.type === 'note') && !tile.filePath && isPreviewTabReplaceable(tile.id)
    })

    const activeEditorLeaf = activePanelIdRef.current
      ? leaves.find(leaf => leaf.id === activePanelIdRef.current && hasEditorRole(leaf))
      : null
    if (activeEditorLeaf && activeEditorLeaf.id !== sourceLeafId) return activeEditorLeaf

    const blankEditorLeaf = leaves.find(leaf => leaf.id !== sourceLeafId && hasBlankEditor(leaf))
      ?? (sourceLeaf && hasBlankEditor(sourceLeaf) ? sourceLeaf : null)
    if (blankEditorLeaf) return blankEditorLeaf

    const associatedEditorLeaf = leaves.find(leaf => leaf.id !== sourceLeafId && hasEditorRole(leaf))
      ?? (sourceLeaf && hasEditorRole(sourceLeaf) ? sourceLeaf : null)
    return associatedEditorLeaf ?? fallbackLeaf
  }, [getNavigationLeaf, isPreviewTabReplaceable])

  useEffect(() => {
    const handleOpenLink = (event: Event) => {
      const customEvent = event as CustomEvent<CodeSurfOpenLinkDetail>
      const href = String(customEvent.detail?.href ?? '').trim()
      if (!href) return

      const localPath = hrefToLocalPath(href)
      if (localPath) {
        void resolveFileTileType(localPath).then(type => addTile(type, localPath))
        return
      }

      const preferredBrowserTileId = preferredBrowserOpenTargetRef.current
      if (preferredBrowserTileId) {
        window.electron?.bus?.publish(
          `tile:${preferredBrowserTileId}`,
          'data',
          'app:open-link',
          { command: 'browser_navigate', url: href },
        )
        return
      }

      if (settings.linkOpenMode === 'external-browser') {
        void window.electron?.shell?.openExternal?.(href)
        return
      }

      addTile('browser', href)
    }

    window.addEventListener(CODESURF_OPEN_LINK_EVENT, handleOpenLink as EventListener)
    return () => window.removeEventListener(CODESURF_OPEN_LINK_EVENT, handleOpenLink as EventListener)
  }, [addTile, settings.linkOpenMode])

  useEnforceTileMinimumSizes({
    tiles,
    viewport,
    nextZIndex,
    saveCanvas,
    setTiles,
    getMinTileWidth,
    getMinTileHeight,
  })

  // ─── MCP canvas tool handlers (must be after addTile) ────────────────────
  useEffect(() => {
    const el = (window as any).electron?.mcp
    if (!el?.onKanban) return
    const cleanup = el.onKanban((event: string, data: any) => {
      if (event === 'canvas_create_tile') {
        addTile((data.type ?? 'note') as TileState['type'], data.filePath, data.x !== undefined ? { x: data.x, y: data.y } : undefined)
      }
      if (event === 'canvas_open_file') {
        void resolveFileTileType(data.path).then(type => addTile(type, data.path))
      }
      if (event === 'canvas_pan_to') {
        setViewport(prev => ({ ...prev, tx: data.x, ty: data.y }))
      }
      if (event === 'canvas_list_tiles') {
        const tileList = tiles.map(t => ({ id: t.id, type: t.type, filePath: t.filePath, x: t.x, y: t.y }))
        void (async () => {
          const port = await (window as any).electron?.mcp?.getPort?.()
          if (!port) return
          const { postMcpEndpoint } = await import('./utils/mcpHttp')
          await postMcpEndpoint(port, '/push', {
            card_id: 'global',
            event: 'canvas_tiles_response',
            data: { tiles: tileList },
          }).catch(() => {})
        })()
      }
    })
    return cleanup
  }, [tiles, addTile])

  const {
    clipboardRef,
    pasteTargetGroupIdRef,
    copyTiles,
    pasteTiles,
    duplicateTiles,
  } = useTileClipboard({
    tiles,
    groups,
    selectedTileId,
    selectedTileIds,
    viewport,
    nextZIndex,
    setTiles,
    setNextZIndex,
    setSelectedTileId,
    setSelectedTileIds,
    saveCanvas,
    viewportCenter,
    snapValue,
    groupBoundsRef,
  })

  const bringToFront = useCallback((id: string) => {
    const nz = nextZIndex
    setTiles(prev => {
      const tile = prev.find(t => t.id === id)
      pasteTargetGroupIdRef.current = tile?.groupId
      return prev.map(t => t.id === id ? { ...t, zIndex: nz } : t)
    })
    setNextZIndex(n => n + 1)
    setSelectedTileId(id)
  }, [nextZIndex, pasteTargetGroupIdRef])

  useEffect(() => {
    const handleCreateTileRequest = (event: Event) => {
      const detail = normalizeCreateTileDetail((event as CustomEvent).detail)
      if (!detail) return
      const x = typeof detail.x === 'number' ? detail.x : undefined
      const y = typeof detail.y === 'number' ? detail.y : undefined
      const tileId = addTile(
        detail.type,
        detail.filePath,
        x !== undefined && y !== undefined ? { x, y } : undefined,
      )
      if (detail.focus !== false) bringToFront(tileId)
    }

    window.addEventListener(CODESURF_CREATE_TILE_EVENT, handleCreateTileRequest as EventListener)
    return () => window.removeEventListener(CODESURF_CREATE_TILE_EVENT, handleCreateTileRequest as EventListener)
  }, [addTile, bringToFront])

  useEffect(() => {
    const dispatchTargetedSurfaceOpen = (targetTileId: string, request: { extId: string; surfaceId: string; sourceTileId?: string; initialContext?: Record<string, unknown> }) => {
      const fire = () => {
        window.dispatchEvent(new CustomEvent(CODESURF_OPEN_CHAT_SURFACE_EVENT, {
          detail: { ...request, targetTileId },
        }))
      }
      requestAnimationFrame(() => requestAnimationFrame(fire))
    }

    const handleOpenChatSurfaceRequest = (event: Event) => {
      const detail = normalizeOpenChatSurfaceDetail((event as CustomEvent).detail)
      if (!detail || detail.targetTileId) return

      const target = resolveChatSurfaceTargetTile({
        tiles,
        targetTileId: detail.preferredTileId,
        activeChatTileId,
      })
      const targetTileId = target.shouldCreate || !target.tileId
        ? addTile('chat')
        : target.tileId

      bringToFront(targetTileId)
      if (expandedTileIdRef.current && target.reason === 'create') {
        setExpandedTileId(targetTileId)
      }
      dispatchTargetedSurfaceOpen(targetTileId, {
        extId: detail.extId,
        surfaceId: detail.surfaceId,
        ...(detail.sourceTileId ? { sourceTileId: detail.sourceTileId } : {}),
        ...(detail.initialContext ? { initialContext: detail.initialContext } : {}),
      })
    }

    window.addEventListener(CODESURF_OPEN_CHAT_SURFACE_EVENT, handleOpenChatSurfaceRequest as EventListener)
    return () => window.removeEventListener(CODESURF_OPEN_CHAT_SURFACE_EVENT, handleOpenChatSurfaceRequest as EventListener)
  }, [activeChatTileId, addTile, bringToFront, tiles])

  const { handleCanvasMouseDown, handleConnectionMouseDown, handleResizeMouseDown, handleCanvasDoubleClick, handleTileMouseDown } = useCanvasPointerHandlers({
    canvasRef,
    viewport,
    setDragState,
    setSelectedTileId,
    setSelectedTileIds,
    panLastPos,
    cancelPanInertia,
    screenToWorld,
    spaceHeld,
    bringToFront,
    getConnectionHandlePoint: (tile, side) => getConnectionHandlePoint(tile, side),
    panelLayout,
    addTile,
  })

  const { showConnectionHandleForSide, scheduleConnectionHandleHide } = useConnectionHandleHover({
    setHoveredConnectionHandle,
  })

  const handleCanvasContextMenu = useCanvasContextMenu({
    screenToWorld,
    panelLayout,
    groups,
    groupBoundsRef,
    addTile,
    pinnedCanvasExtensionTiles,
    clipboardRef,
    pasteAt: (pos, groupId) => pasteTilesRef.current(pos, groupId),
    selectedTileIds,
    groupSelectedTiles: () => groupSelectedTilesRef.current(),
    setCtxMenu,
  })

  useCanvasDragSync({
    canvasRef,
    dragState,
    setDragState,
    engine: canvasEngine,
    tilesRef,
    groupsRef,
    groups,
    setTiles,
    setGroups,
    setGuides,
    setCanvasPointerWorld,
    setSelectedTileIds,
    setSuppressedConnections,
    suppressedConnectionsRef,
    panelTileIdsRef,
    groupBoundsRef,
    snapValue,
    resolveManualConnectionTarget: (sourceTileId, point) => (
      findManualConnectionTarget(sourceTileId, point, tilesRef.current, panelTileIdsRef.current, getTileCenter)
    ),
    lockConnection,
    triggerDiscoveryPulse,
    getMinTileWidth,
    getMinTileHeight,
  })

  // ─── Workspace switching ──────────────────────────────────────────────────
  const handleSwitchWorkspace = useCallback(async (id: string) => {
    let workspaceList = workspaces
    let targetWorkspaceId = getCanonicalWorkspaceId(workspaceList, id) ?? id
    let ws = workspaceList.find(w => w.id === targetWorkspaceId) ?? null
    if (!ws) {
      const refreshed = await window.electron.workspace.list().catch(() => [])
      if (refreshed.length > 0) {
        setWorkspaces(refreshed)
        workspaceList = refreshed
        targetWorkspaceId = getCanonicalWorkspaceId(refreshed, targetWorkspaceId) ?? targetWorkspaceId
        ws = refreshed.find(w => w.id === targetWorkspaceId) ?? null
      }
    }
    await window.electron.workspace.setActive(targetWorkspaceId)
    setWorkspace(ws)
    setShowWorkspacePickerTab(false)
    setWorkspacePickerReturnWorkspaceId(null)
    if (ws) {
      const saved = await window.electron.canvas.load(targetWorkspaceId)
      const savedTiles = saved?.tiles ?? []
      void window.electron.collab.pruneOrphanedTileDirs(ws.path, savedTiles.map(tile => tile.id))
      if (saved) {
        const sanitizedPanel = sanitizePanelLayout((saved.panelLayout as PanelNode | null) ?? null, savedTiles.map(tile => tile.id))
        const nextActivePanelId = saved.activePanelId && sanitizedPanel.layout && findLeafById(sanitizedPanel.layout, saved.activePanelId)
          ? saved.activePanelId
          : sanitizedPanel.fallbackActivePanelId
        setTiles(savedTiles)
        setGroups(saved.groups ?? [])
        restoreViewport(saved.viewport)
        setNextZIndex(saved.nextZIndex ?? 1)
        savedLayoutRef.current = sanitizedPanel.layout
        setPanelLayout(saved.tabViewActive ? (sanitizedPanel.layout ?? createLeaf([])) : null)
        setActivePanelId(saved.tabViewActive ? nextActivePanelId : null)
        setExpandedTileId(saved.expandedTileId ?? null)
        setExpandedCanvasGroupId(saved.expandedCanvasGroupId ?? null)
        expandedCanvasGroupIdRef.current = saved.expandedCanvasGroupId ?? null
        expandedCanvasPriorViewportRef.current = saved.expandedCanvasPriorViewport ?? null
      } else {
        setTiles([])
        setGroups([])
        resetViewportState()
        savedLayoutRef.current = null
        setPanelLayout(null)
        setActivePanelId(null)
        setExpandedTileId(null)
      }
    }
  }, [workspaces, restoreViewport, resetViewportState])

  const handleDeleteWorkspace = useCallback(async (id: string) => {
    const wasActive = workspace?.id === id
    const nextOpenIds = openWorkspaceIds.filter(wsId => wsId !== id)

    await window.electron.workspace.delete(id)
    const updated = await window.electron.workspace.list()
    setWorkspaces(updated)
    setOpenWorkspaceIds(nextOpenIds)

    if (!wasActive) return

    const nextId = nextOpenIds.find(wsId => updated.some(ws => ws.id === wsId)) ?? updated[0]?.id ?? null
    if (nextId) {
      await handleSwitchWorkspace(nextId)
      return
    }

    showEmptyLayoutPage()
  }, [workspace?.id, openWorkspaceIds, handleSwitchWorkspace, showEmptyLayoutPage])

  const handleCloseWorkspaceTab = useCallback(async (id: string) => {
    const tabIndex = openWorkspaceIds.indexOf(id)
    if (tabIndex === -1) return

    const nextOpenIds = openWorkspaceIds.filter(wsId => wsId !== id)
    setOpenWorkspaceIds(nextOpenIds)

    if (workspace?.id !== id) return

    const nextId = nextOpenIds[tabIndex] ?? nextOpenIds[tabIndex - 1] ?? null
    if (nextId) {
      await handleSwitchWorkspace(nextId)
      return
    }

    showEmptyLayoutPage()
  }, [openWorkspaceIds, workspace?.id, handleSwitchWorkspace, showEmptyLayoutPage])

  const handleNewWorkspace = useCallback(async (name: string) => {
    if (!name.trim()) return
    const ws = await window.electron.workspace.create(name.trim())
    const updated = await window.electron.workspace.list()
    setWorkspaces(updated)
    await handleSwitchWorkspace(ws.id)
  }, [handleSwitchWorkspace])

  const handleOpenFolder = useCallback(async () => {
    const folderPath = await window.electron.workspace.openFolder()
    if (!folderPath) return
    const ws = await window.electron.workspace.createFromFolder(folderPath)
    const updated = await window.electron.workspace.list()
    setWorkspaces(updated)
    await handleSwitchWorkspace(ws.id)
  }, [handleSwitchWorkspace])

  // Cmd+T → open next available workspace as a pill tab
  useEffect(() => {
    return window.electron?.window?.onNewTab?.(() => {
      const next = workspaces.find(w => !openWorkspaceIds.includes(w.id))
      if (next) {
        setOpenWorkspaceIds(prev => [...prev, next.id])
        handleSwitchWorkspace(next.id)
      }
    })
  }, [workspaces, openWorkspaceIds, handleSwitchWorkspace])

  // Launch a layout template into the current workspace instead of creating a
  // separate "Project:Layout" workspace tab.
  const handleLaunchTemplate = useCallback(async (template: import('../../shared/types').LayoutTemplate) => {
    const baseId = Date.now()
    const generatedTiles: TileState[] = []
    let zIdx = workspace?.id ? nextZIndexRef.current : 1
    const VW = 1600, VH = 900
    let tileCounter = 0

    const generateTiles = (node: import('../../shared/types').LayoutTemplateNode, x: number, y: number, w: number, h: number) => {
      if (node.type === 'leaf') {
        for (const slot of node.slots) {
          generatedTiles.push({
            id: `tile-template-${baseId}-${tileCounter++}`,
            type: slot.tileType,
            x: Math.round(x), y: Math.round(y),
            width: Math.round(w), height: Math.round(h),
            zIndex: zIdx++,
            label: slot.label,
          })
        }
        return
      }
      const { direction, children, sizes } = node
      let offset = 0
      children.forEach((child, i) => {
        const pct = (sizes[i] ?? 50) / 100
        if (direction === 'horizontal') {
          generateTiles(child, x + offset, y, w * pct, h)
          offset += w * pct
        } else {
          generateTiles(child, x, y + offset, w, h * pct)
          offset += h * pct
        }
      })
    }

    generateTiles(template.tree, 0, 0, VW, VH)

    let panelCounter = 0
    const generatePanel = (node: import('../../shared/types').LayoutTemplateNode, tileIdx: { v: number }): PanelNode => {
      if (node.type === 'leaf') {
        const tabs = node.slots.map(() => generatedTiles[tileIdx.v++]?.id).filter(Boolean)
        return { type: 'leaf', id: `panel-template-${baseId}-${panelCounter++}`, tabs, activeTab: tabs[0] ?? '' }
      }
      return {
        type: 'split',
        id: `split-template-${baseId}-${panelCounter++}`,
        direction: node.direction,
        children: node.children.map(c => generatePanel(c, tileIdx)),
        sizes: node.sizes,
      }
    }

    const generatedPanelLayout = generatePanel(template.tree, { v: 0 })
    const generatedActivePanelId = findFirstLeafId(generatedPanelLayout)
    if (!generatedActivePanelId) return

    const generatedConnections: LockedConnection[] = []
    for (let i = 0; i < generatedTiles.length; i++) {
      for (let j = i + 1; j < generatedTiles.length; j++) {
        const a = generatedTiles[i], b = generatedTiles[j]
        const touchH = (Math.round(a.x + a.width) === b.x || Math.round(b.x + b.width) === a.x) && !(a.y + a.height <= b.y || b.y + b.height <= a.y)
        const touchV = (Math.round(a.y + a.height) === b.y || Math.round(b.y + b.height) === a.y) && !(a.x + a.width <= b.x || b.x + b.width <= a.x)
        if (touchH || touchV) {
          generatedConnections.push({ sourceTileId: a.id, targetTileId: b.id })
        }
      }
    }

    if (!workspace?.id) {
      const workspaceName = template.name.trim() || 'Workspace'
      const ws = await window.electron.workspace.create(workspaceName)
      const updatedList = await window.electron.workspace.list()
      setWorkspaces(updatedList)

      const nextState: CanvasState = {
        tiles: generatedTiles,
        groups: [],
        viewport: { tx: 0, ty: 0, zoom: 1 },
        nextZIndex: zIdx,
        panelLayout: generatedPanelLayout,
        activePanelId: generatedActivePanelId,
        tabViewActive: true,
        expandedTileId: null,
        lockedConnections: generatedConnections.length > 0 ? generatedConnections : undefined,
      }

      await window.electron.canvas.save(ws.id, nextState)
      await window.electron.workspace.setActive(ws.id)
      setWorkspace(ws)
      setTiles(generatedTiles)
      setGroups([])
      setLockedConnections(generatedConnections)
      setViewport({ tx: 0, ty: 0, zoom: 1 })
      setNextZIndex(zIdx)
      savedLayoutRef.current = generatedPanelLayout
      setPanelLayout(generatedPanelLayout)
      setActivePanelId(generatedActivePanelId)
      setExpandedTileId(null)
      setOpenWorkspaceIds(prev => prev.includes(ws.id) ? prev : [...prev, ws.id])
      return
    }

    const currentLayout = panelLayoutRef.current
    const currentPanelId = activePanelIdRef.current
    const activeLeaf = currentLayout && currentPanelId ? findLeafById(currentLayout, currentPanelId) : null
    const canInsertIntoActiveLeaf = Boolean(currentLayout && activeLeaf && activeLeaf.tabs.length === 0)
    const canReplaceWorkspaceState = !currentLayout && tilesRef.current.length === 0 && groupsRef.current.length === 0
    if (!canInsertIntoActiveLeaf && !canReplaceWorkspaceState) return

    const nextTiles = canInsertIntoActiveLeaf
      ? [...tilesRef.current, ...generatedTiles]
      : generatedTiles
    const nextGroups = canInsertIntoActiveLeaf ? groupsRef.current : []
    const nextViewport = canInsertIntoActiveLeaf ? viewportRef.current : { tx: 0, ty: 0, zoom: 1 }
    const nextConnections = canInsertIntoActiveLeaf
      ? dedupeLockedConnections([...lockedConnectionsRef.current, ...generatedConnections])
      : generatedConnections
    const nextPanelLayout = canInsertIntoActiveLeaf && currentLayout && activeLeaf
      ? replaceLeafInPanelTree(currentLayout, activeLeaf.id, generatedPanelLayout)
      : generatedPanelLayout

    const nextState: CanvasState = {
      tiles: nextTiles,
      groups: nextGroups,
      viewport: nextViewport,
      nextZIndex: zIdx,
      panelLayout: nextPanelLayout,
      activePanelId: generatedActivePanelId,
      tabViewActive: true,
      expandedTileId: null,
      lockedConnections: nextConnections.length > 0 ? nextConnections : undefined,
    }

    setTiles(nextTiles)
    setGroups(nextGroups)
    setLockedConnections(nextConnections)
    setViewport(nextViewport)
    setNextZIndex(zIdx)
    savedLayoutRef.current = nextPanelLayout
    setPanelLayout(nextPanelLayout)
    setActivePanelId(generatedActivePanelId)
    setExpandedTileId(null)
    await window.electron.canvas.save(workspace.id, nextState).catch(() => {})
  }, [workspace])

  const focusTileInWorkspace = useCallback((tileId: string) => {
    bringToFront(tileId)

    const currentLayout = panelLayoutRef.current
    if (currentLayout) {
      const leafId = findLeafIdContainingTile(currentLayout, tileId)
      if (leafId) {
        setActivePanelId(leafId)
        setPanelLayout(prev => prev ? setActiveTab(prev, leafId, tileId) : prev)
      }
    }

    if (expandedTileIdRef.current) {
      setExpandedTileId(tileId)
    }
  }, [bringToFront])

  const findMatchingChatTileIdForSession = useCallback((session: AggregatedSessionEntry): string | null => {
    return tilesRef.current.find(tile => {
      if (tile.type !== 'chat') return false
      if (session.tileId && tile.id === session.tileId) return true
      const remembered = chatTileSessionMatches[tile.id]
      const runtimeState = getChatTileRuntimeState<{ linkedSessionEntryId?: string | null }>(tile.id)
      return remembered?.entryId === session.id || runtimeState?.linkedSessionEntryId === session.id
    })?.id ?? null
  }, [chatTileSessionMatches])

  const handleOpenFile = useCallback((filePath: string, options?: FocusOpenOptions) => {
    const persist = options?.persist === true
    const sourceTileId = options?.sourceTileId
    setSidebarSelectedPath(filePath)

    // If this file is already open in a tile, focus it instead of creating a duplicate
    const existing = tilesRef.current.find(t => t.filePath === filePath)
    if (existing) {
      focusTileInWorkspace(existing.id)
      if (persist) pinPreviewTab(existing.id)
      if (sourceTileId) lockConnection(sourceTileId, existing.id)
      return
    }

    void resolveFileTileType(filePath).then(type => {
      let targetLeaf = panelLayoutRef.current ? findPanelFileOpenLeaf(sourceTileId, type) : null
      if (targetLeaf?.previewTabId && !persist && !isPreviewTabReplaceable(targetLeaf.previewTabId)) {
        setPanelLayout(prev => prev ? pinTabInLeaf(prev, targetLeaf!.id, targetLeaf!.previewTabId!) : prev)
        targetLeaf = { ...targetLeaf, previewTabId: null }
      }

      if (!targetLeaf) {
        const openedTileId = addTile(type, filePath)
        if (sourceTileId) lockConnection(sourceTileId, openedTileId)
        return
      }

      const newTile = buildTileState(type, filePath)
      const blankEditorTileId = !persist && (type === 'code' || type === 'note')
        ? targetLeaf.tabs.find(tileId => {
          const tile = tilesRef.current.find(candidate => candidate.id === tileId)
          return (tile?.type === 'code' || tile?.type === 'note') && !tile.filePath && isPreviewTabReplaceable(tile.id)
        })
        : undefined
      if (blankEditorTileId) {
        const openedTileId = replacePreviewTile(blankEditorTileId, newTile, targetLeaf.id, { preview: true })
        if (sourceTileId) lockConnection(sourceTileId, openedTileId)
        return
      }

      if (!persist && targetLeaf.previewTabId && isPreviewTabReplaceable(targetLeaf.previewTabId)) {
        const openedTileId = replacePreviewTile(targetLeaf.previewTabId, newTile, targetLeaf.id, { preview: true })
        if (sourceTileId) lockConnection(sourceTileId, openedTileId)
        return
      }

      const openedTileId = mountTile(newTile, { panelId: targetLeaf.id, preview: !persist })
      if (sourceTileId) lockConnection(sourceTileId, openedTileId)
    })
  }, [addTile, buildTileState, findPanelFileOpenLeaf, focusTileInWorkspace, isPreviewTabReplaceable, lockConnection, mountTile, pinPreviewTab, replacePreviewTile])

  const handleImageReplaceSource = useCallback((tileId: string, filePath: string) => {
    const updatedTiles = tilesRef.current.map(tile => (
      tile.id === tileId ? { ...tile, filePath } : tile
    ))
    tilesRef.current = updatedTiles
    setTiles(updatedTiles)
    saveCanvas(updatedTiles, viewportRef.current, nextZIndexRef.current)
  }, [saveCanvas])

  const resolveWorkspaceForProjectPath = useCallback(async (projectPath: string | null | undefined): Promise<Workspace | null> => {
    const normalizedProjectPath = normalizeWorkspacePath(projectPath)
    if (!normalizedProjectPath) return workspace ?? null

    const existingWorkspace = resolveWorkspaceCandidateForProjectPath(workspaces, normalizedProjectPath, workspace?.id)
    if (existingWorkspace) return existingWorkspace

    const workspaceName = basename(normalizedProjectPath) || 'Project'
    const created = await window.electron.workspace.createWithPath(workspaceName, normalizedProjectPath)
    const updated = await window.electron.workspace.list().catch(() => null)
    if (updated && updated.length > 0) setWorkspaces(updated)
    return created
  }, [workspace, workspaces])

  const resolveWorkspaceForSession = useCallback(async (session: SessionTargetEntry): Promise<Workspace | null> => {
    const workspaceId = 'workspaceId' in session && typeof session.workspaceId === 'string'
      ? session.workspaceId
      : null
    if (workspaceId) {
      const canonicalWorkspaceId = getCanonicalWorkspaceId(workspaces, workspaceId) ?? workspaceId
      const directWorkspace = workspaces.find(candidate => candidate.id === canonicalWorkspaceId) ?? null
      if (directWorkspace) return directWorkspace
      if (workspace?.id === canonicalWorkspaceId) return workspace
    }
    return resolveWorkspaceForProjectPath(session.projectPath)
  }, [resolveWorkspaceForProjectPath, workspace, workspaces])

  const openSessionInChatCurrentWorkspace = useCallback(async (session: AggregatedSessionEntry, workspaceId: string, options?: FocusOpenOptions) => {
    const persist = options?.persist === true
    const sessionHint = buildSessionEntryHint(session)
    const usePagedLinkedHistory = !isRuntimeSessionEntryId(session.id)
      && session.source !== 'codesurf'
      && Boolean(session.sessionId)
    const existingTileId = findMatchingChatTileIdForSession(session)

    if (existingTileId) {
      rememberChatTileSessionMatch(existingTileId, session)
      if (persist) pinPreviewTab(existingTileId)
      focusTileInWorkspace(existingTileId)
    }

    const state = await window.electron.canvas.getSessionState(workspaceId, session.id, {
      entryHint: sessionHint,
      tailLimit: usePagedLinkedHistory ? INITIAL_EXTERNAL_SESSION_TAIL_LOAD : undefined,
    }).catch(() => null)
    if (!state) {
      if (existingTileId) return
      if (!session.id.startsWith('codesurf-') && session.filePath) handleOpenFile(session.filePath, { persist })
      return
    }

    const provider = typeof state.provider === 'string' ? state.provider : (session.provider || 'claude')
    const nextChatState = {
      messages: Array.isArray(state.messages) ? state.messages : [],
      input: '',
      attachments: [],
      provider,
      model: typeof state.model === 'string' ? state.model : (session.model || ''),
      mcpEnabled: typeof state.mcpEnabled === 'boolean' ? state.mcpEnabled : true,
      mode: resolveProviderModeId(
        provider,
        typeof state.mode === 'string' ? state.mode : settings.chatProviderModes?.[provider],
      ),
      thinking: 'adaptive',
      agentMode: false,
      autoAgentMode: false,
      linkedSessionEntryId: isRuntimeSessionEntryId(session.id)
        ? null
        : session.id,
      linkedSessionHint: isRuntimeSessionEntryId(session.id) ? null : sessionHint,
      hasEarlierMessages: usePagedLinkedHistory
        ? (state.hasEarlierMessages === true || session.messageCount > (Array.isArray(state.messages) ? state.messages.length : 0))
        : false,
      preserveSessionSummary: !isRuntimeSessionEntryId(session.id),
      sessionId: typeof state.sessionId === 'string' || state.sessionId === null ? state.sessionId : session.sessionId,
      jobId: typeof state.jobId === 'string' || state.jobId === null ? state.jobId : null,
      jobSequence: typeof state.jobSequence === 'number' ? state.jobSequence : 0,
      executionTarget: state.executionTarget === 'cloud' ? 'cloud' : 'local',
      cloudHostId: typeof state.cloudHostId === 'string' || state.cloudHostId === null ? state.cloudHostId : null,
      isStreaming: typeof state.isStreaming === 'boolean' ? state.isStreaming : false,
    }

    const matchingChatTileId = existingTileId ?? findMatchingChatTileIdForSession(session)

    const shouldOpenPermanent = persist || nextChatState.isStreaming === true

    if (matchingChatTileId) {
      rememberChatTileSessionMatch(matchingChatTileId, session, nextChatState.sessionId ?? null)
      setChatTileRuntimeState(matchingChatTileId, nextChatState)
      await window.electron.canvas.saveTileState(workspaceId, matchingChatTileId, nextChatState).catch(() => {})
      if (shouldOpenPermanent) pinPreviewTab(matchingChatTileId)
      setChatReloadTokens(prev => ({ ...prev, [matchingChatTileId]: (prev[matchingChatTileId] ?? 0) + 1 }))
      focusTileInWorkspace(matchingChatTileId)
      return
    }

    let targetLeaf = panelLayoutRef.current ? getNavigationLeaf() : null
    if (targetLeaf?.previewTabId && !shouldOpenPermanent && !isPreviewTabReplaceable(targetLeaf.previewTabId)) {
      setPanelLayout(prev => prev ? pinTabInLeaf(prev, targetLeaf!.id, targetLeaf!.previewTabId!) : prev)
      targetLeaf = { ...targetLeaf, previewTabId: null }
    }

    const chatTileId = targetLeaf
      ? (() => {
          const newTile = buildTileState('chat')
          if (!shouldOpenPermanent && targetLeaf?.previewTabId && isPreviewTabReplaceable(targetLeaf.previewTabId)) {
            return replacePreviewTile(targetLeaf.previewTabId, newTile, targetLeaf.id, { preview: true })
          }
          return mountTile(newTile, { panelId: targetLeaf.id, preview: !shouldOpenPermanent })
        })()
      : addTile('chat')

    rememberChatTileSessionMatch(chatTileId, session, nextChatState.sessionId ?? null)
    setChatTileRuntimeState(chatTileId, nextChatState)
    await window.electron.canvas.saveTileState(workspaceId, chatTileId, {
      ...nextChatState,
    }).catch(() => {})
    if (targetLeaf) {
      if (shouldOpenPermanent) pinPreviewTab(chatTileId)
      return
    }
    bringToFront(chatTileId)
  }, [addTile, bringToFront, buildTileState, findMatchingChatTileIdForSession, focusTileInWorkspace, getNavigationLeaf, handleOpenFile, isPreviewTabReplaceable, mountTile, pinPreviewTab, rememberChatTileSessionMatch, replacePreviewTile, settings.chatProviderModes])

  const openSessionInChat = useCallback(async (session: SessionTargetEntry, options?: FocusOpenOptions) => {
    const targetWorkspace = await resolveWorkspaceForSession(session)
    if (!targetWorkspace?.id) return

    if (targetWorkspace.id !== workspace?.id) {
      setPendingSessionOpen({ kind: 'chat', session, workspaceId: targetWorkspace.id, options })
      await handleSwitchWorkspace(targetWorkspace.id)
      return
    }

    await openSessionInChatCurrentWorkspace(session, targetWorkspace.id, options)
  }, [resolveWorkspaceForSession, workspace?.id, handleSwitchWorkspace, openSessionInChatCurrentWorkspace])

  const openSessionInAppCurrentWorkspace = useCallback((session: AggregatedSessionEntry) => {
    if (!session.resumeBin) return
    const tileId = addTile('terminal', undefined, undefined, {
      launchBin: session.resumeBin,
      launchArgs: session.resumeArgs ?? [],
    })
    bringToFront(tileId)
  }, [addTile, bringToFront])

  const openSessionInApp = useCallback(async (session: SessionTargetEntry) => {
    const targetWorkspace = await resolveWorkspaceForSession(session)
    if (!targetWorkspace?.id) return

    if (targetWorkspace.id !== workspace?.id) {
      setPendingSessionOpen({ kind: 'app', session, workspaceId: targetWorkspace.id })
      await handleSwitchWorkspace(targetWorkspace.id)
      return
    }

    openSessionInAppCurrentWorkspace(session)
  }, [resolveWorkspaceForSession, workspace?.id, handleSwitchWorkspace, openSessionInAppCurrentWorkspace])

  const openDaemonTask = useCallback(async (task: {
    id: string
    taskLabel: string | null
    status: string
    provider: string | null
    model: string | null
    workspaceDir: string | null
    sessionId: string | null
  }) => {
    const projectPath = normalizeWorkspacePath(task.workspaceDir)
    if (!projectPath) return

    const session: AggregatedSessionEntry = {
      id: `codesurf-job:${task.id}`,
      source: 'codesurf',
      scope: 'workspace',
      tileId: null,
      sessionId: task.sessionId,
      provider: task.provider ?? 'claude',
      model: task.model ?? '',
      messageCount: 0,
      lastMessage: task.taskLabel,
      updatedAt: Date.now(),
      title: task.taskLabel ?? `${task.provider ?? 'Agent'} task`,
      projectPath,
      sourceLabel: 'CodeSurf',
      sourceDetail: `${task.provider ?? 'Agent'} daemon`,
      canOpenInChat: true,
      canOpenInApp: false,
      relatedGroupId: null,
      nestingLevel: 0,
    }

    await openSessionInChat(session)
  }, [openSessionInChat])

  useEffect(() => {
    if (!pendingSessionOpen || !workspace?.id) return
    if (pendingSessionOpen.workspaceId !== workspace.id) return

    const nextPending = pendingSessionOpen
    setPendingSessionOpen(null)

    if (nextPending.kind === 'chat') {
      void openSessionInChatCurrentWorkspace(nextPending.session, workspace.id, nextPending.options)
      return
    }

    openSessionInAppCurrentWorkspace(nextPending.session)
  }, [pendingSessionOpen, workspace?.id, openSessionInAppCurrentWorkspace, openSessionInChatCurrentWorkspace])

  const importFileToWorkspace = useCallback(async (sourcePath: string, tileId?: string) => {
    if (!workspace?.path) return null
    const { path: importedPath } = await window.electron.fs.copyIntoDir(sourcePath, workspace.path)

    if (tileId) {
      setTiles(prev => {
        const updated = prev.map(tile => tile.id === tileId ? { ...tile, filePath: importedPath } : tile)
        saveCanvas(updated, viewport, nextZIndex)
        return updated
      })
    }

    setSidebarSelectedPath(importedPath)
    return importedPath
  }, [workspace?.path, viewport, nextZIndex, saveCanvas])

  // Rebuild merged MCP config whenever workspace changes
  useEffect(() => {
    if (workspace) {
      window.electron.mcp?.getMergedConfig?.(workspace.id)
    }
  }, [workspace?.id])

  const {
    groupSelectedTiles,
    ungroupTiles,
    ungroupAll,
    groupBounds,
    collectGroupTileIds,
    convertGroupToLayout,
    revertLayoutGroup,
  } = useCanvasGroupManager({
    tiles,
    groups,
    selectedTileIds,
    viewport,
    nextZIndex,
    setTiles,
    setGroups,
    setSelectedTileIds,
    saveCanvas,
  })

  useCanvasKeyboard({
    selectedTileIds,
    groupSelectedTiles,
    setCommandPaletteOpen,
    undoCanvas,
    redoCanvas,
    onEscape: handleCanvasEscape,
    spaceHeldRef: spaceHeld,
  })

  useEffect(() => {
    const suspendDuringDrag = dragState.type === 'tile'
      || dragState.type === 'resize'
      || dragState.type === 'group'
      || dragState.type === 'group-resize'
    canvasPersistSuspendedRef.current = suspendDuringDrag
    if (!suspendDuringDrag) flushDeferredCanvasPersist()
  }, [dragState.type, flushDeferredCanvasPersist])

  // ─── Open a layout preset contributed by a plugin (point 10) ──
  // A plugin's contributes.layoutPresets[].layout (a LayoutTemplateNode) is applied
  // through the existing template-launch path — so "AI Chat" (sessions | chat | git)
  // and any other reusable arrangement become one-click, registerable layouts.
  useEffect(() => {
    const onPreset = (e: Event) => {
      const preset = (e as CustomEvent).detail as
        | { id: string; title?: string; layout: import('../../shared/types').LayoutTemplateNode }
        | undefined
      if (!preset?.layout) return
      void handleLaunchTemplate({ id: preset.id, name: preset.title ?? preset.id, created_at: '', tree: preset.layout })
    }
    window.addEventListener('codesurf:open-layout-preset', onPreset as EventListener)
    return () => window.removeEventListener('codesurf:open-layout-preset', onPreset as EventListener)
  }, [handleLaunchTemplate])

  // ─── Create a tile by type (built-in views surfaced via the command palette) ──
  useEffect(() => {
    const onNewTile = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: string } | undefined
      if (detail?.type) addTile(detail.type as TileState['type'])
    }
    window.addEventListener('codesurf:new-tile', onNewTile as EventListener)
    return () => window.removeEventListener('codesurf:new-tile', onNewTile as EventListener)
  }, [addTile])

  // ─── A plugin footer chip was clicked → open that plugin's tile (point 3 loop) ──
  // Reuses the exact tile-type form the canvas context menu uses, so the open path
  // is identical to the proven one.
  useEffect(() => {
    const onFooterActivate = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { extId?: string } | undefined
      if (!detail?.extId) return
      try {
        const tiles = await window.electron.extensions?.listTiles?.()
        const tile = tiles?.find(t => t.extId === detail.extId)
        if (tile?.type) addTile(tile.type as TileState['type'])
      } catch { /* noop */ }
    }
    window.addEventListener('codesurf:footer-activate', onFooterActivate as EventListener)
    return () => window.removeEventListener('codesurf:footer-activate', onFooterActivate as EventListener)
  }, [addTile])

  // ─── Save the current panel arrangement as a reusable Layout preset (point 10) ──
  // Captures the live panel layout (PanelNode) into a LayoutTemplate; it then appears
  // in the palette under "Layout:" via the saved-layouts integration. PanelNode sizes
  // share the template's percentage scale (handleLaunchTemplate copies them 1:1), so
  // no conversion is needed beyond mapping tabs → tile-type slots.
  useEffect(() => {
    const onSave = () => {
      const layout = panelLayoutRef.current
      if (!layout) { window.alert('Snap views into a panel layout first, then save it.'); return }
      const toNode = (node: PanelNode): import('../../shared/types').LayoutTemplateNode => {
        if (node.type === 'leaf') {
          const slots = node.tabs.map(id => {
            const t = tilesRef.current.find(x => x.id === id)
            return { tileType: (t?.type ?? 'note') as TileType }
          })
          return { type: 'leaf', slots: slots.length ? slots : [{ tileType: 'note' as TileType }] }
        }
        return { type: 'split', direction: node.direction, children: node.children.map(toNode), sizes: node.sizes }
      }
      const name = window.prompt('Name this layout', 'My Layout')
      if (!name) return
      void addLayoutTemplate({ id: `saved-${Date.now()}`, name, created_at: new Date().toISOString(), tree: toNode(layout) })
    }
    window.addEventListener('codesurf:save-layout', onSave as EventListener)
    return () => window.removeEventListener('codesurf:save-layout', onSave as EventListener)
  }, [addLayoutTemplate])

  const handleTileContextMenu = useTileContextMenu({
    viewport,
    nextZIndex,
    groups,
    workspacePath: workspace?.path,
    saveCanvas,
    setTiles,
    setSelectedTileId,
    setSelectedTileIds,
    setCtxMenu,
    clipboardRef,
    duplicateTiles,
    copyTiles,
    pasteTiles,
    ungroupTiles,
    ungroupAll,
    closeTile,
    importFileToWorkspace,
  })

  const expandLayoutGroup = useCallback((groupId: string) => {
    const g = groupsRef.current.find(gr => gr.id === groupId)
    if (!g?.layout) return
    const layout = g.layout as PanelNode
    setExpandLayoutGroupId(groupId)
    expandLayoutGroupIdRef.current = groupId
    setPanelLayout(layout)
    const firstLeafId = findFirstLeafId(layout)
    setActivePanelId(firstLeafId)
    setExpandedTileId(null)
  }, [])

  const { enterCanvasExpanded, exitCanvasExpanded } = useCanvasExpandedGroup({
    canvasRef,
    viewportRef,
    expandedCanvasPriorViewportRef,
    expandedCanvasGroupIdRef,
    groupsRef,
    setViewport,
    setExpandedCanvasGroupId,
    setExpandedTileId,
    groupBounds,
  })
  exitCanvasExpandedRef.current = exitCanvasExpanded

  // Keep action refs in sync so early-defined callbacks can call them safely
  pasteTilesRef.current = pasteTiles
  duplicateTilesRef.current = duplicateTiles
  copyTilesRef.current = copyTiles
  groupSelectedTilesRef.current = groupSelectedTiles
  groupBoundsRef.current = groupBounds
  ungroupTilesRef.current = ungroupTiles
  ungroupAllRef.current = ungroupAll

  useCanvasTileShortcuts({
    selectedTileId,
    selectedTileIds,
    viewport,
    nextZIndex,
    setTiles,
    setSelectedTileId,
    setSelectedTileIds,
    saveCanvas,
    copyTiles,
    pasteTiles,
    duplicateTiles,
  })

  // ─── Arrange handler ──────────────────────────────────────────────────────
  const handleArrange = useCallback((updated: TileState[]) => {
    const getArrangeWidth = (tile: TileState) => tile.width + ((tile.type === 'terminal' || tile.type === 'chat') ? 272 : 0)

    // Merge positions + sizes back — preserve zIndex / other fields from current state
    setTiles(prev => {
      const updateIndex: Record<string, { x: number; y: number; width?: number; height?: number }> = {}
      for (const t of updated) updateIndex[t.id] = { x: t.x, y: t.y, width: t.width, height: t.height }
      const merged = prev.map(t => {
        const upd = updateIndex[t.id]
        if (!upd) return t
        return {
          ...t,
          x: upd.x,
          y: upd.y,
          ...(upd.width != null ? { width: upd.width } : {}),
          ...(upd.height != null ? { height: upd.height } : {}),
        }
      })
      saveCanvas(merged, viewport, nextZIndex)
      const sidebarOffset = sidebarCollapsed ? 0 : sidebarWidth + 8
      zoomToFitArrangedTiles(merged, getArrangeWidth, sidebarOffset)

      return merged
    })
  }, [viewport, nextZIndex, saveCanvas, sidebarCollapsed, sidebarWidth, zoomToFitArrangedTiles])

  // Set of tile IDs that should not render on canvas (in fullscreen panel OR in a layout group)
  const panelTileIds = React.useMemo(() => {
    const ids = new Set<string>()
    if (panelLayout) getAllTileIds(panelLayout).forEach(id => ids.add(id))
    for (const g of groups) {
      if (g.layoutMode) {
        tiles.filter(t => t.groupId === g.id).forEach(t => ids.add(t.id))
      }
    }
    return ids
  }, [panelLayout, groups, tiles])

  useEffect(() => {
    panelTileIdsRef.current = panelTileIds
  }, [panelTileIds])

  const tileByIdMap = React.useMemo(() => new Map(tiles.map(tile => [tile.id, tile])), [tiles])

  // ─── Canvas-expand membership ─────────────────────────────────────────────
  // When a non-layout group is expanded as a fullscreen sub-canvas, only its
  // members (recursively) are visible. Mirrors `groupBounds`/`collectGroupTileIds`
  // recursion semantics — descendants via parentGroupId chain count as members.
  const expandedCanvasMembership = React.useMemo<{ tileIds: Set<string>; groupIds: Set<string> } | null>(() => {
    if (!expandedCanvasGroupId) return null
    const groupIds = new Set<string>()
    const walk = (gid: string) => {
      if (groupIds.has(gid)) return
      groupIds.add(gid)
      for (const child of groups) if (child.parentGroupId === gid) walk(child.id)
    }
    walk(expandedCanvasGroupId)
    const tileIds = new Set(tiles.filter(t => t.groupId && groupIds.has(t.groupId)).map(t => t.id))
    return { tileIds, groupIds }
  }, [expandedCanvasGroupId, tiles, groups])

  const {
    discoveryFocusTileId,
    discoveryPreview,
    negotiatedDiscoveryState,
    lockedConnectionKeys,
    manualConnectionRenderRoutes,
    ambientDiscoveryRenderRoutes,
  } = useNegotiatedDiscovery({
    autoConnectionsEnabled,
    tiles,
    groups,
    panelLayout,
    panelTileIds,
    settings,
    lockedConnections,
    suppressedConnections,
    extActionsVersion,
    dragState,
    selectedTileId,
    viewportZoom: viewport.zoom,
    workspacePath: workspace?.path,
    activeChatTileId,
    tileByIdMap,
    preferredBrowserOpenTargetRef,
  })

  const terminalFontFamily = settings.terminalFontFamily || settings.fonts?.mono?.family || MONO_DEFAULT
  const terminalFontSize = settings.terminalFontSize || settings.fonts?.mono?.size || 13

  const handleFocusKanbanLinkedTile = useCallback((linkedId: string) => {
    const target = tiles.find(t => t.id === linkedId)
    if (!target) return
    bringToFront(linkedId)
    panToTile(target)
  }, [tiles, bringToFront, panToTile])

  const handleExtensionActionsChanged = useCallback((tileId: string, actions: import('./components/ExtensionTile').ExtensionAction[]) => {
    console.log('[App] Extension actions registered:', tileId, actions.map(a => a.name))
    extensionActionRegistry.set(tileId, actions)
    setExtActionsVersion(v => v + 1)
  }, [])

  const getExtensionActions = useCallback((tileId: string) => extensionActionRegistry.get(tileId), [])

  const renderTileBody = useRenderTileBody({
    workspace,
    settings,
    terminalFontFamily,
    terminalFontSize,
    viewportZoom: viewport.zoom,
    tileByIdMap,
    chatReloadTokens,
    byTileConnections: negotiatedDiscoveryState.byTileConnections,
    connectedTileIds: negotiatedDiscoveryState.connectedTileIds,
    sidebarSelectedPath,
    onImageReplaceSource: handleImageReplaceSource,
    onFocusLinkedTile: handleFocusKanbanLinkedTile,
    onChatModePreferenceChange: rememberChatProviderMode,
    onOpenFile: handleOpenFile,
    onOpenWorkspace: () => { void handleOpenFolder() },
    onAddTile: addTile,
    onExtensionActionsChanged: handleExtensionActionsChanged,
    getExtensionActions,
  })

  const { isConnectionLocked, toggleConnectionLock, deleteConnection } = useLockedConnectionHelpers({
    lockedConnections,
    persistCanvasState,
    tilesRef,
    groupsRef,
    viewportRef,
    nextZIndexRef,
    lockedConnectionsRef,
    setLockedConnections,
    setSuppressedConnections,
  })

  const isDraggingCanvas = dragState.type === 'pan'

  const appFonts = React.useMemo(() => {
    const p = settings.fonts?.primary ?? settings.primaryFont
    const s = settings.fonts?.secondary ?? settings.secondaryFont
    const m = settings.fonts?.mono ?? settings.monoFont
    return {
      primary: p?.family ?? SANS_DEFAULT,
      secondary: s?.family ?? SANS_DEFAULT,
      mono: m?.family ?? MONO_DEFAULT,
      size: p?.size ?? 13,
      lineHeight: p?.lineHeight ?? 1.5,
      weight: p?.weight ?? 400,
      secondarySize: s?.size ?? 11,
      secondaryLineHeight: s?.lineHeight ?? 1.4,
      secondaryWeight: s?.weight ?? 400,
      monoSize: m?.size ?? 13,
      monoLineHeight: m?.lineHeight ?? 1.5,
      monoWeight: m?.weight ?? 400,
    }
  }, [settings.fonts, settings.primaryFont, settings.secondaryFont, settings.monoFont])

  useEffect(() => {
    void window.electron?.window?.setSidebarCollapsed?.(sidebarCollapsed).catch(() => {})
  }, [sidebarCollapsed])

  const fontTokens = React.useMemo(() => settings.fonts, [settings.fonts])

  useEffect(() => {
    void window.electron?.appearance?.shouldUseDark?.().then(setSystemPrefersDark).catch(() => {})
    const unsub = window.electron?.appearance?.onUpdated?.(p => setSystemPrefersDark(p.shouldUseDark))
    return unsub
  }, [])

  useEffect(() => {
    const mode = settings.appearance ?? 'dark'
    void window.electron?.appearance?.setThemeSource?.(mode)
  }, [settings.appearance])

  const effectiveThemeId = React.useMemo(
    () => resolveEffectiveThemeId(settings.appearance, settings.themeId, systemPrefersDark),
    [settings.appearance, settings.themeId, systemPrefersDark],
  )
  const theme = React.useMemo(
    () => applyContrast(getThemeById(effectiveThemeId), settings.themeContrast ?? 0),
    [effectiveThemeId, settings.themeContrast],
  )

  useAppThemeCssVars(theme, appFonts)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setBrandPrefsReadyTheme(null)
    try {
      const savedWordmark = window.localStorage.getItem(`${BRAND_WORDMARK_CACHE_KEY}:${effectiveThemeId}`)
      const savedPalette = window.localStorage.getItem(`${BRAND_WORDMARK_PALETTE_CACHE_KEY}:${effectiveThemeId}`)
      const nextWordmark = savedWordmark === null ? 1 : Number.parseInt(savedWordmark, 10)
      const nextPalette = savedPalette === null ? 0 : Number.parseInt(savedPalette, 10)
      setBrandWordmarkIndex(Number.isFinite(nextWordmark) && nextWordmark >= 0 ? nextWordmark : 1)
      setBrandPaletteIndex(Number.isFinite(nextPalette) && nextPalette >= 0 ? nextPalette : 0)
    } catch {
      setBrandWordmarkIndex(1)
      setBrandPaletteIndex(0)
    }
    setBrandPrefsReadyTheme(effectiveThemeId)
  }, [effectiveThemeId])

  useEffect(() => {
    if (typeof window === 'undefined' || brandPrefsReadyTheme !== effectiveThemeId) return
    try {
      window.localStorage.setItem(`${BRAND_WORDMARK_CACHE_KEY}:${effectiveThemeId}`, String(brandWordmarkIndex))
      window.localStorage.setItem(`${BRAND_WORDMARK_PALETTE_CACHE_KEY}:${effectiveThemeId}`, String(brandPaletteIndex))
    } catch {}
  }, [brandWordmarkIndex, brandPaletteIndex, brandPrefsReadyTheme, effectiveThemeId])
  const brandWordmarks = React.useMemo(() => [
    [
      '░█▀▀░█▀█░█▀▄░█▀▀░█▀▀░█░█░█▀▄░█▀▀',
      '░█░░░█░█░█░█░█▀▀░▀▀█░█░█░█▀▄░█▀▀',
      '░▀▀▀░▀▀▀░▀▀░░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀░░',
    ],
    [
      ' ██████╗ ██████╗ ██████╗ ███████╗███████╗██╗   ██╗██████╗ ███████╗',
      '██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔════╝██║   ██║██╔══██╗██╔════╝',
      '██║     ██║   ██║██║  ██║█████╗  ███████╗██║   ██║██████╔╝█████╗  ',
      '██║     ██║   ██║██║  ██║██╔══╝  ╚════██║██║   ██║██╔══██╗██╔══╝  ',
      '╚██████╗╚██████╔╝██████╔╝███████╗███████║╚██████╔╝██║  ██║██║     ',
      ' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝     ',
    ],
    [
      ' ██████  ██████  ██████  ███████ ███████ ██    ██ ██████  ███████ ',
      '██      ██    ██ ██   ██ ██      ██      ██    ██ ██   ██ ██      ',
      '██      ██    ██ ██   ██ █████   ███████ ██    ██ ██████  █████   ',
      '██      ██    ██ ██   ██ ██           ██ ██    ██ ██   ██ ██      ',
      ' ██████  ██████  ██████  ███████ ███████  ██████  ██   ██ ██      ',
    ],
    [
      '        CCCCCCCCCCCCC     OOOOOOOOO     DDDDDDDDDDDDD      EEEEEEEEEEEEEEEEEEEEEE   SSSSSSSSSSSSSSS UUUUUUUU     UUUUUUUURRRRRRRRRRRRRRRRR   FFFFFFFFFFFFFFFFFFFFFF',
      '     CCC::::::::::::C   OO:::::::::OO   D::::::::::::DDD   E::::::::::::::::::::E SS:::::::::::::::SU::::::U     U::::::UR::::::::::::::::R  F::::::::::::::::::::F',
      '   CC:::::::::::::::C OO:::::::::::::OO D:::::::::::::::DD E::::::::::::::::::::ES:::::SSSSSS::::::SU::::::U     U::::::UR::::::RRRRRR:::::R F::::::::::::::::::::F',
      '  C:::::CCCCCCCC::::CO:::::::OOO:::::::ODDD:::::DDDDD:::::DEE::::::EEEEEEEEE::::ES:::::S     SSSSSSSUU:::::U     U:::::UURR:::::R     R:::::RFF::::::FFFFFFFFF::::F',
      ' C:::::C       CCCCCCO::::::O   O::::::O  D:::::D    D:::::D E:::::E       EEEEEES:::::S             U:::::U     U:::::U   R::::R     R:::::R  F:::::F       FFFFFF',
      'C:::::C              O:::::O     O:::::O  D:::::D     D:::::DE:::::E             S:::::S             U:::::D     D:::::U   R::::R     R:::::R  F:::::F             ',
      'C:::::C              O:::::O     O:::::O  D:::::D     D:::::DE::::::EEEEEEEEEE    S::::SSSS          U:::::D     D:::::U   R::::RRRRRR:::::R   F::::::FFFFFFFFFF   ',
      'C:::::C              O:::::O     O:::::O  D:::::D     D:::::DE:::::::::::::::E     SS::::::SSSSS     U:::::D     D:::::U   R:::::::::::::RR    F:::::::::::::::F   ',
      'C:::::C              O:::::O     O:::::O  D:::::D     D:::::DE:::::::::::::::E       SSS::::::::SS   U:::::D     D:::::U   R::::RRRRRR:::::R   F:::::::::::::::F   ',
      'C:::::C              O:::::O     O:::::O  D:::::D     D:::::DE::::::EEEEEEEEEE          SSSSSS::::S  U:::::D     D:::::U   R::::R     R:::::R  F::::::FFFFFFFFFF   ',
      'C:::::C              O:::::O     O:::::O  D:::::D     D:::::DE:::::E                         S:::::S U:::::D     D:::::U   R::::R     R:::::R  F:::::F             ',
      ' C:::::C       CCCCCCO::::::O   O::::::O  D:::::D    D:::::D E:::::E       EEEEEE            S:::::S U::::::U   U::::::U   R::::R     R:::::R  F:::::F             ',
      '  C:::::CCCCCCCC::::CO:::::::OOO:::::::ODDD:::::DDDDD:::::DEE::::::EEEEEEEE:::::ESSSSSSS     S:::::S U:::::::UUU:::::::U RR:::::R     R:::::RFF:::::::FF           ',
      '   CC:::::::::::::::C OO:::::::::::::OO D:::::::::::::::DD E::::::::::::::::::::ES::::::SSSSSS:::::S  UU:::::::::::::UU  R::::::R     R:::::RF::::::::FF           ',
      '     CCC::::::::::::C   OO:::::::::OO   D::::::::::::DDD   E::::::::::::::::::::ES:::::::::::::::SS     UU:::::::::UU    R::::::R     R:::::RF::::::::FF           ',
      '        CCCCCCCCCCCCC     OOOOOOOOO     DDDDDDDDDDDDD      EEEEEEEEEEEEEEEEEEEEEE SSSSSSSSSSSSSSS         UUUUUUUUU      RRRRRRRR     RRRRRRRFFFFFFFFFFF           ',
    ],
    [
      '__________  ____  ___________ __  ______  ______',
      '  / ____/ __ \/ __ \/ ____/ ___// / / / __ \/ ____/',
      ' / /   / / / / / / / __/  \\__ \/ / / / /_/ / /_    ',
      '/ /___/ /_/ / /_/ / /___ ___/ / /_/ / _, _/ __/    ',
      '\\____/\\____/_____/_____//____/\\____/_/ |_/_/     ',
    ],
    [
      ' _________  ___  __________  _____  ____',
      ' / ___/ __ \/ _ \/ __/ __/ / / / _ \/ __/',
      '/ /__/ /_/ / // / _/_\\ \/ /_/ / , _/ _/  ',
      '\\___/\\____/____/___/___/\\____/_/|_/_/   ',
    ],
    [
      '░██████    ░██████   ░███████   ░██████████   ░██████   ░██     ░██ ░█████████  ░██████████',
      ' ░██   ░██  ░██   ░██  ░██   ░██  ░██          ░██   ░██  ░██     ░██ ░██     ░██ ░██        ',
      '░██        ░██     ░██ ░██    ░██ ░██         ░██         ░██     ░██ ░██     ░██ ░██        ',
      '░██        ░██     ░██ ░██    ░██ ░█████████   ░████████  ░██     ░██ ░█████████  ░█████████ ',
      '░██        ░██     ░██ ░██    ░██ ░██                 ░██ ░██     ░██ ░██   ░██   ░██        ',
      ' ░██   ░██  ░██   ░██  ░██   ░██  ░██          ░██   ░██   ░██   ░██  ░██    ░██  ░██        ',
      '  ░██████    ░██████   ░███████   ░██████████   ░██████     ░██████   ░██     ░██ ░██        ',
    ],
    [
      '_____  ____   _____   ______   _____  _    _  _____   ______ ',
      '  / ____|/ __ \\ |  __ \\ |  ____| / ____|| |  | ||  __ \\ |  ____|',
      ' | |    | |  | || |  | || |__   | (___  | |  | || |__) || |__   ',
      ' | |    | |  | || |  | ||  __|   \\___ \\ | |  | ||  _  / |  __|  ',
      ' | |____| |__| || |__| || |____  ____) || |__| || | \\ \\ | |     ',
      '  \\_____|\\____/ |_____/ |______||_____/  \\____/ |_|  \\_\\|_|     ',
    ],
    [
      '▄█████ ▄████▄ ████▄  ██████ ▄█████ ██  ██ █████▄  ██████ ',
      '██     ██  ██ ██  ██ ██▄▄   ▀▀▀▄▄▄ ██  ██ ██▄▄██▄ ██▄▄   ',
      '▀█████ ▀████▀ ████▀  ██▄▄▄▄ █████▀ ▀████▀ ██   ██ ██     ',
    ],
    [
      '▄▄▄▄▄▄▄   ▄▄▄▄▄   ▄▄▄▄▄▄    ▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄ ▄▄▄  ▄▄▄ ▄▄▄▄▄▄▄    ▄▄▄▄▄▄▄ ',
      '███▀▀▀▀▀ ▄███████▄ ███▀▀██▄ ███▀▀▀▀▀ █████▀▀▀ ███  ███ ███▀▀███▄ ███▀▀▀▀▀ ',
      '███      ███   ███ ███  ███ ███▄▄     ▀████▄  ███  ███ ███▄▄███▀ ███▄▄    ',
      '███      ███▄▄▄███ ███  ███ ███         ▀████ ███▄▄███ ███▀▀██▄  ███▀▀    ',
      '▀███████  ▀█████▀  ██████▀  ▀███████ ███████▀ ▀██████▀ ███  ▀███ ███      ',
    ],
    [
      '▄████████  ▄██████▄  ████████▄     ▄████████    ▄████████ ███    █▄     ▄████████    ▄████████ ',
      '███    ███ ███    ███ ███   ▀███   ███    ███   ███    ███ ███    ███   ███    ███   ███    ███ ',
      '███    █▀  ███    ███ ███    ███   ███    █▀    ███    █▀  ███    ███   ███    ███   ███    █▀  ',
      '███        ███    ███ ███    ███  ▄███▄▄▄       ███        ███    ███  ▄███▄▄▄▄██▀  ▄███▄▄▄     ',
      '███        ███    ███ ███    ███ ▀▀███▀▀▀     ▀███████████ ███    ███ ▀▀███▀▀▀▀▀   ▀▀███▀▀▀     ',
      '███    █▄  ███    ███ ███    ███   ███    █▄           ███ ███    ███ ▀███████████   ███        ',
      '███    ███ ███    ███ ███   ▄███   ███    ███    ▄█    ███ ███    ███   ███    ███   ███        ',
      '████████▀   ▀██████▀  ████████▀    ██████████  ▄████████▀  ████████▀    ███    ███   ███        ',
      '                                                                        ███    ███              ',
    ],
    [
      '▄▄▄▄     ▄▄▄▄    ▄▄▄▄▄     ▄▄▄▄▄▄▄▄    ▄▄▄▄    ▄▄    ▄▄  ▄▄▄▄▄▄    ▄▄▄▄▄▄▄▄ ',
      '  ██▀▀▀▀█   ██▀▀██   ██▀▀▀██   ██▀▀▀▀▀▀  ▄█▀▀▀▀█   ██    ██  ██▀▀▀▀██  ██▀▀▀▀▀▀ ',
      ' ██▀       ██    ██  ██    ██  ██        ██▄       ██    ██  ██    ██  ██       ',
      ' ██        ██    ██  ██    ██  ███████    ▀████▄   ██    ██  ███████   ███████  ',
      ' ██▄       ██    ██  ██    ██  ██             ▀██  ██    ██  ██  ▀██▄  ██       ',
      '  ██▄▄▄▄█   ██▄▄██   ██▄▄▄██   ██▄▄▄▄▄▄  █▄▄▄▄▄█▀  ▀██▄▄██▀  ██    ██  ██       ',
      '    ▀▀▀▀     ▀▀▀▀    ▀▀▀▀▀     ▀▀▀▀▀▀▀▀   ▀▀▀▀▀      ▀▀▀▀    ▀▀    ▀▀▀ ▀▀       ',
    ],
    [
      '▄▄▄   ▄▄▄▄  ▄▄▄▄   ▄▄▄▄▄▄  ▄▄▄▄  ▄    ▄ ▄▄▄▄▄  ▄▄▄▄▄▄',
      ' ▄▀   ▀ ▄▀  ▀▄ █   ▀▄ █      █▀   ▀ █    █ █   ▀█ █     ',
      ' █      █    █ █    █ █▄▄▄▄▄ ▀█▄▄▄  █    █ █▄▄▄▄▀ █▄▄▄▄▄',
      ' █      █    █ █    █ █          ▀█ █    █ █   ▀▄ █     ',
      '  ▀▄▄▄▀  █▄▄█  █▄▄▄▀  █▄▄▄▄▄ ▀▄▄▄█▀ ▀▄▄▄▄▀ █    ▀ █     ',
    ],
    [
      '.o88b.  .d88b.  d8888b. d88888b .d8888. db    db d8888b. d88888b ',
      'd8P  Y8 .8P  Y8. 88  `8D 88\'     88\'  YP 88    88 88  `8D 88\'     ',
      '8P      88    88 88   88 88ooooo `8bo.   88    88 88oobY\' 88ooo   ',
      '8b      88    88 88   88 88~~~~~   `Y8b. 88    88 88`8b   88~~~   ',
      'Y8b  d8 `8b  d8\' 88  .8D 88.     db   8D 88b  d88 88 `88. 88      ',
      ' `Y88P\'  `Y88P\'  Y8888D\' Y88888P `8888Y\' ~Y8888P\' 88   YD YP      ',
    ],
    [
      '.d8888b.   .d88888b.  8888888b.  8888888888 .d8888b.  888     888 8888888b.  8888888888 ',
      'd88P  Y88b d88P" "Y88b 888  "Y88b 888       d88P  Y88b 888     888 888   Y88b 888        ',
      '888    888 888     888 888    888 888       Y88b.      888     888 888    888 888        ',
      '888        888     888 888    888 8888888    "Y888b.   888     888 888   d88P 8888888    ',
      '888        888     888 888    888 888           "Y88b. 888     888 8888888P"  888        ',
      '888    888 888     888 888    888 888             "888 888     888 888 T88b   888        ',
      'Y88b  d88P Y88b. .d88P 888  .d88P 888       Y88b  d88P Y88b. .d88P 888  T88b  888        ',
      ' "Y8888P"   "Y88888P"  8888888P"  8888888888 "Y8888P"   "Y88888P"  888   T88b 888        ',
    ],
    [
      '_______ _______ ______   _______ _______ ___ ___ _______ _______ ',
      ' |   _   |   _   |   _  \\ |   _   |   _   |   Y   |   _   |   _   |',
      ' |.  1___|.  |   |.  |   \\|.  1___|   1___|.  |   |.  l   |.  1___|',
      ' |.  |___|.  |   |.  |    |.  __)_|____   |.  |   |.  _   |.  __)  ',
      ' |:  1   |:  1   |:  1    |:  1   |:  1   |:  1   |:  |   |:  |    ',
      ' |::.. . |::.. . |::.. . /|::.. . |::.. . |::.. . |::.|:. |::.|    ',
      ' `-------`-------`------\' `-------`-------`-------`--- ---`---\'    ',
    ],
    [
      '█████████     ███████    ██████████   ██████████  █████████  █████  █████ ███████████   ███████████',
      '  ███░░░░░███  ███░░░░░███ ░░███░░░░███ ░░███░░░░░█ ███░░░░░███░░███  ░░███ ░░███░░░░░███ ░░███░░░░░░█',
      ' ███     ░░░  ███     ░░███ ░███   ░░███ ░███  █ ░ ░███    ░░░  ░███   ░███  ░███    ░███  ░███   █ ░ ',
      '░███         ░███      ░███ ░███    ░███ ░██████   ░░█████████  ░███   ░███  ░██████████   ░███████   ',
      '░███         ░███      ░███ ░███    ░███ ░███░░█    ░░░░░░░░███ ░███   ░███  ░███░░░░░███  ░███░░░█   ',
      '░░███     ███░░███     ███  ░███    ███  ░███ ░   █ ███    ░███ ░███   ░███  ░███    ░███  ░███  ░    ',
      ' ░░█████████  ░░░███████░   ██████████   ██████████░░█████████  ░░████████   █████   █████ █████      ',
      '  ░░░░░░░░░     ░░░░░░░    ░░░░░░░░░░   ░░░░░░░░░░  ░░░░░░░░░    ░░░░░░░░   ░░░░░   ░░░░░ ░░░░░      ',
    ],
    [
      'MM\'""""\'YMM MMP"""""YMM M""""""\'YMM MM""""""""`M MP""""""`MM M""MMMMM""M MM"""""""`MM MM""""""""`M ',
      'M\' .mmm. `M M\' .mmm. `M M  mmmm. `M MM  mmmmmmmM M  mmmmm..M M  MMMMM  M MM  mmmm,  M MM  mmmmmmmM ',
      'M  MMMMMooM M  MMMMM  M M  MMMMM  M M`      MMMM M.      `YM M  MMMMM  M M\'        .M M\'      MMMM ',
      'M  MMMMMMMM M  MMMMM  M M  MMMMM  M MM  MMMMMMMM MMMMMMM.  M M  MMMMM  M MM  MMMb. "M MM  MMMMMMMM ',
      'M. `MMM\' .M M. `MMM\' .M M  MMMM\' .M MM  MMMMMMMM M. .MMM\'  M M  `MMM\'  M MM  MMMMM  M MM  MMMMMMMM ',
      'MM.     .dM MMb     dMM M       .MM MM        .M Mb.     .dM Mb       dM MM  MMMMM  M MM  MMMMMMMM ',
      'MMMMMMMMMMM MMMMMMMMMMM MMMMMMMMMMM MMMMMMMMMMMM MMMMMMMMMMM MMMMMMMMMMM MMMMMMMMMMMM MMMMMMMMMMMM ',
    ],
    [
      '.aMMMb  .aMMMb  dMMMMb  dMMMMMP .dMMMb  dMP dMP dMMMMb  dMMMMMP ',
      '  dMP"VMP dMP"dMP dMP VMP dMP     dMP" VP dMP dMP dMP.dMP dMP      ',
      ' dMP     dMP dMP dMP dMP dMMMP    VMMMb  dMP dMP dMMMMK" dMMMP     ',
      'dMP.aMP dMP.aMP dMP.aMP dMP     dP .dMP dMP.aMP dMP"AMF dMP        ',
      'VMMMP"  VMMMP" dMMMMP" dMMMMMP  VMMMP"  VMMMP" dMP dMP dMP        ',
    ],
  ], [])
  const brandPalettes = React.useMemo(() => theme.mode === 'dark'
    ? [
        ['#8bd5ff', '#6db8ff', '#7ee7c8', '#6db8ff', '#8bd5ff', '#7ee7c8'],
        ['#ffd166', '#ff9f1c', '#ff6b6b', '#c77dff', '#7bdff2', '#72efdd'],
        ['#f8fafc', '#cbd5e1', '#94a3b8', '#38bdf8', '#22c55e', '#f59e0b'],
        ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#bdb2ff'],
        ['#e879f9', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb7185'],
        ['#f5f5f5', '#e5e5e5', '#d4d4d4', '#fafafa', '#e5e7eb', '#ffffff'],
        ['#9ca3af', '#6b7280', '#4b5563', '#d1d5db', '#9ca3af', '#6b7280'],
        ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
        ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
      ]
    : [
        ['#67b8ff', '#4aa3ff', '#8bd5ff', '#4aa3ff', '#67b8ff', '#8bd5ff'],
        ['#8a2b06', '#c2410c', '#b91c1c', '#7c3aed', '#0369a1', '#0f766e'],
        ['#111827', '#374151', '#6b7280', '#2563eb', '#059669', '#d97706'],
        ['#9f1239', '#c2410c', '#ca8a04', '#15803d', '#0f766e', '#4338ca'],
        ['#be185d', '#9333ea', '#2563eb', '#0891b2', '#16a34a', '#ea580c'],
        ['#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#171717'],
        ['#111111', '#000000', '#1f2937', '#374151', '#4b5563', '#6b7280'],
        ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
        ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
      ], [theme.mode])
  const activeBrandWordmark = brandWordmarks[brandWordmarkIndex % brandWordmarks.length]
  void brandPalettes[brandPaletteIndex % brandPalettes.length]
  void (activeBrandWordmark[0]
    ? Math.min(1, (32 / activeBrandWordmark[0].length) * (
      brandWordmarkIndex === 0 ? 1 : brandWordmarkIndex === 1 ? 1.44 : 1.2
    )) * 0.62
    : 1)

  const {
    sidebarFooterBottom,
    sidebarFooterLeft,
    sidebarFooterHeight,
    mainPanelBottomInset,
    mainPanelTop,
    mainStatusBarLeft,
    collapsedSidebarPillSize,
    sidebarToggleLeft,
    sidebarToggleTop,
    workspaceTabsMinimumLeft,
    mainPanelLeft,
    discoveryHighlightZIndex,
    discoveryGlowZIndex,
    discoveryPillZIndex,
    openWorkspaceTabs,
    hasWorkspaceTabs,
    workspaceTitleFallback,
    showTopWorkspacePickerTab,
    mainPanelCornerRadii,
    mainPanelBorderRadius,
    mainPanelBackground,
    mainPanelInsetEdgeShadow,
    mainPanelShadow,
    workspaceTabLabelSize,
    workspaceTabBackground,
    workspaceTabInactiveBackground,
    workspaceTabInactiveHoverBackground,
    workspaceTabCloseHoverBackground,
    workspaceTabMaxWidth,
    workspaceTabActiveHeight,
    workspaceTabInactiveHeight,
    workspaceTabTextOffset,
    workspaceTabInactiveTextOffset,
    workspaceTabActiveBottomGap,
    workspaceTabInactiveBottomGap,
    dsc,
  } = useShellLayoutMetrics({
    settings,
    theme,
    sidebarCollapsed,
    sidebarWidth,
    panelLayout,
    openWorkspaceIds,
    workspaces,
    workspace,
    showWorkspacePickerTab,
    appFonts,
  })

  useEffect(() => {
    if (!canvasGlowEnabled) hideCanvasGlow()
    return () => hideCanvasGlow()
  }, [canvasGlowEnabled, hideCanvasGlow])

  useEffect(() => {
    if (!miniChatOptions) return
    void window.electron?.window?.setTitle?.(miniChatOptions.title)
  }, [miniChatOptions])

  const miniChatTile = miniChatOptions
    ? tiles.find(tile => tile.id === miniChatOptions.tileId && tile.type === 'chat')
    : null
  const miniChatPeers = miniChatTile
    ? (negotiatedDiscoveryState.byTileConnections.get(miniChatTile.id) ?? []).map(peer => {
      const extActions = extensionActionRegistry.get(peer.peerId)
      const peerTile = tileByIdMap.get(peer.peerId)
      return {
        ...peer,
        actions: extActions,
        filePath: peerTile?.filePath,
        label: peerTile?.label,
      }
    })
    : []

  if (miniChatOptions) {
    return (
      <ThemeProvider value={theme}>
      <FontTokenProvider value={fontTokens}>
      <FontProvider value={appFonts}>
      <div
        className="cs-mini-chat-window"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: theme.text.primary,
          fontFamily: appFonts.primary,
          fontSize: appFonts.size,
          background: theme.surface.app,
        }}
      >
        <div
          className="cs-mini-window-titlebar"
          style={{
            height: 38,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            // Leave room for the macOS traffic lights (which overlay the
            // renderer at top-left when titleBarStyle: 'hiddenInset').
            padding: window.electron?.platform === 'darwin'
              ? '0 10px 0 80px'
              : '0 10px 0 14px',
            borderBottom: `1px solid ${theme.border.subtle}`,
            // Use the theme's titlebar surface so contrast tracks the rest
            // of the palette. backdrop-filter still adds vibrancy on top.
            background: theme.surface.titlebar,
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            ...({ WebkitAppRegion: 'drag' } as React.CSSProperties),
            userSelect: 'none',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: theme.accent.base,
              boxShadow: `0 0 14px ${theme.accent.base}`,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {miniChatOptions.title}
            </div>
            <div style={{ fontSize: 10, color: theme.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Floating CodeSurf chat · {workspace?.name ?? 'loading workspace'}
            </div>
          </div>
          <button
            type="button"
            title="Close mini chat"
            onClick={async () => {
              try {
                const id = await window.electron?.window?.getCurrentId?.()
                if (id !== undefined) await window.electron?.window?.closeById?.(id)
                else window.close()
              } catch {
                window.close()
              }
            }}
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              border: `1px solid ${theme.border.subtle}`,
              background: theme.surface.panelMuted,
              color: theme.text.secondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties),
            }}
          >
            <X size={13} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: theme.chat.background }}>
          <Suspense fallback={<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text.muted, fontSize: 12 }}>Loading chat…</div>}>
            {miniChatTile ? (
              <LazyChatTile
                tileId={miniChatTile.id}
                workspaceId={workspace?.id ?? miniChatOptions.workspaceId}
                workspaceDir={workspace?.path ?? ''}
                width={Math.max(360, window.innerWidth)}
                height={Math.max(360, window.innerHeight - 38)}
                reloadToken={chatReloadTokens[miniChatTile.id] ?? 0}
                settings={settings}
                onChatModePreferenceChange={rememberChatProviderMode}
                isConnected={negotiatedDiscoveryState.connectedTileIds.has(miniChatTile.id)}
                isAutoConnected={miniChatTile.autoAgentMode && negotiatedDiscoveryState.connectedTileIds.has(miniChatTile.id)}
                connectedPeers={miniChatPeers}
              />
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: theme.text.secondary }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 650, color: theme.text.primary, marginBottom: 6 }}>Chat unavailable</div>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>The source chat tile could not be found in this workspace.</div>
                </div>
              </div>
            )}
          </Suspense>
        </div>
      </div>
      </FontProvider>
      </FontTokenProvider>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider value={theme}>
    <FontTokenProvider value={fontTokens}>
    <FontProvider value={appFonts}>
    <div className="w-full h-full" style={{ position: 'relative', color: theme.text.primary, fontFamily: appFonts.primary, fontSize: appFonts.size, background: theme.surface.app }}>
      {/* Sidebar inset panel — floats over the canvas */}
      <div style={{
        position: 'absolute',
        top: 19,
        left: 6,
        bottom: mainPanelBottomInset,
        padding: '0px',
        width: sidebarCollapsed ? 0 : sidebarWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: sidebarCollapsed ? 0 : 270,
        zIndex: 10,
        pointerEvents: 'none',
        transition: 'width 0.15s ease',
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          borderRadius: 12,
          border: 'none',
          paddingTop: 8,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          position: 'relative',
        }}>
          {/* Sidebar content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: sidebarFooterHeight, position: 'relative', zIndex: 2 }}>
            <Suspense fallback={
              <div style={{
                flex: 1,
                color: theme.text.disabled,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11
              }}>
                Loading sidebar…
              </div>
            }>
              <LazySidebar
                workspace={workspace}
                workspaces={workspaces}
                tiles={tiles}
                activeChatTileId={activeChatTileId}
                activeChatSessionId={activeChatSessionMatch.sessionId}
                activeChatSessionEntryId={activeChatSessionMatch.entryId}
                onSwitchWorkspace={handleSwitchWorkspace}
                onDeleteWorkspace={handleDeleteWorkspace}
                onNewWorkspace={handleNewWorkspace}
                onOpenFolder={handleOpenFolder}
                onOpenFile={handleOpenFile}
                onFocusTile={bringToFront}
                onUpdateTile={(tileId, patch) => {
                  setTiles(prev => {
                    const updated = prev.map(t => t.id === tileId ? { ...t, ...patch } : t)
                    saveCanvas(updated, viewport, nextZIndex)
                    return updated
                  })
                }}
                onCloseTile={closeTile}
                onNewTerminal={() => addTile('terminal')}
                onNewKanban={() => addTile('kanban')}
                onNewBrowser={() => addTile('browser')}
                onNewChat={() => addTile('chat')}
                onNewChatForProject={async ({ workspaceId }) => {
                  // Switch to the project's workspace first (if different)
                  // so the newly created chat inherits the right context.
                  if (workspaceId && workspaceId !== workspace?.id) {
                    await handleSwitchWorkspace(workspaceId)
                  }
                  const chatTileId = addTile('chat')
                  bringToFront(chatTileId)
                  // If we're currently in fullscreen mode, make the new chat
                  // the fullscreen tile so the user lands directly in it.
                  // Otherwise it just appears on the canvas.
                  if (expandedTileIdRef.current) {
                    setExpandedTileId(chatTileId)
                  }
                }}
                onNewFiles={() => addTile('files')}
                onOpenSettings={(tab) => setShowSettings(tab)}
                onOpenSessionInChat={openSessionInChat}
                onOpenSessionInApp={openSessionInApp}
                extensionTiles={visibleSidebarExtensionTiles}
                extensionEntries={visibleSidebarExtensionEntries}
                onAddExtensionTile={(type) => addTile(type as TileType)}
                pinnedExtensionIds={settings.extensionsDisabled ? [] : (settings.pinnedExtensionIds ?? [])}
                onTogglePinnedExtension={(key) => {
                  updateAppSettings(current => {
                    const pinned = current.pinnedExtensionIds ?? []
                    return {
                      pinnedExtensionIds: pinned.includes(key)
                        ? pinned.filter(id => id !== key)
                        : [...pinned, key],
                    }
                  })
                }}
                collapsed={sidebarCollapsed}
                width={sidebarWidth}
                onWidthChange={setSidebarWidth}
                onResizeStateChange={setSidebarResizing}
                onToggleCollapse={() => setSidebarCollapsed(p => !p)}
                showFooter={false}
              />
            </Suspense>
          </div>
        </div>
      </div>

      {!sidebarCollapsed && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: mainPanelLeft,
            top: mainPanelTop,
            bottom: mainPanelBottomInset,
            width: 0.5,
            background: theme.border.subtle,
            pointerEvents: 'none',
            zIndex: 92,
            transition: 'left 0.15s ease',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          left: sidebarCollapsed ? 0 : sidebarFooterLeft,
          bottom: sidebarFooterBottom,
          // Toolbar persists above canvas and spills past the sidebar edge when
          // content is wider than the sidebar (e.g. Get Extensions + tile icons).
          // Width is always intrinsic so the icons never stack vertically.
          height: sidebarFooterHeight,
          zIndex: 140,
          pointerEvents: 'auto',
          transition: 'left 0.15s ease',
          overflow: 'visible',
        }}
      >
        <Suspense fallback={null}>
          <LazySidebarFooter
            onNewTerminal={() => addTile('terminal')}
            onNewKanban={() => addTile('kanban')}
            onNewBrowser={() => addTile('browser')}
            onNewChat={() => addTile('chat')}
            onNewFiles={() => addTile('files')}
            onOpenSettings={(tab) => setShowSettings(tab)}
            extensionTiles={visibleSidebarExtensionTiles}
            extensionEntries={visibleSidebarExtensionEntries}
            onAddExtensionTile={(type) => addTile(type as TileType)}
            collapsed={sidebarCollapsed}
            galleryEnabled={settings.extensionsGalleryEnabled !== false}
            onOpenGallery={() => setShowExtensionsGallery(true)}
          />
        </Suspense>
      </div>

      <div
        style={{
          position: 'absolute',
          left: mainStatusBarLeft,
          right: 0,
          bottom: 0,
          height: sidebarFooterHeight,
          zIndex: 95,
          pointerEvents: 'none',
          transform: 'translateY(5px)',
          transition: 'left 0.15s ease',
        }}
      >
        <MainStatusBar onOpenDaemonTask={openDaemonTask} health={settings.statusBarHealth ?? 'compact'} />
      </div>

      {/* Main area — toolbar overlays top, canvas fills entire window */}
      <div className="absolute inset-0 flex flex-col" style={{ position: 'absolute' }}>
        {/* Toolbar row — floats over canvas */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            height: 38,            
            // @ts-ignore
            WebkitAppRegion: 'drag',
            paddingLeft: sidebarCollapsed ? workspaceTabsMinimumLeft : Math.max(sidebarWidth + 4, workspaceTabsMinimumLeft),
            transition: 'padding-left 0.15s ease',
            position: 'relative',
            zIndex: 90,
            paddingTop: 2,
          }}
        >
          <button
            type="button"
            title={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            aria-pressed={!sidebarCollapsed}
            data-no-drag=""
            onMouseDown={event => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onPointerDown={event => {
              event.preventDefault()
              event.stopPropagation()
              setSidebarCollapsed(p => !p)
            }}
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
            }}
            style={{
              position: 'fixed',
              top: sidebarToggleTop,
              left: sidebarToggleLeft,
              zIndex: 2147483647,
              width: collapsedSidebarPillSize,
              height: collapsedSidebarPillSize,
              // Tahoe toolbar control: the old hover state is now the
              // resting state so it reads as an actual button next to the
              // traffic lights instead of disappearing into vibrancy.
              borderRadius: '50%',
              border: '0.5px solid transparent',
              // Glass overlay anchored on text.primary so it reads as a
              // light tint over a dark surface (and a near-paper tint over
              // a light surface). Both modes look right and the contrast
              // slider tracks because text.primary tracks.
              background: `color-mix(in srgb, ${theme.text.primary} 10%, transparent)`,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: 'var(--cs-edge-shadow-strong)',
              color: theme.text.primary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: sidebarResizing ? 0.35 : 1,
              pointerEvents: 'auto',
              WebkitAppRegion: 'no-drag',
              transition: 'background 0.12s ease, color 0.12s ease, opacity 0.12s ease, transform 0.12s ease',
            } as React.CSSProperties}
            onMouseEnter={event => {
              event.currentTarget.style.background = `color-mix(in srgb, ${theme.text.primary} 16%, transparent)`
              event.currentTarget.style.color = theme.text.primary
              event.currentTarget.style.transform = 'scale(1.03)'
            }}
            onMouseLeave={event => {
              event.currentTarget.style.background = `color-mix(in srgb, ${theme.text.primary} 10%, transparent)`
              event.currentTarget.style.color = theme.text.primary
              event.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {/* Tahoe-style sidebar toggle: outlined rounded rectangle with a
                filled left column. Mirrors macOS's `sidebar.leading` SF
                Symbol (which lucide doesn't ship — its PanelLeft variants
                use only an outline divider, which read as visually identical
                to one another at 17px). */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 20 20"
              aria-hidden="true"
              style={{ transform: sidebarCollapsed ? 'scaleX(-1)' : 'none' }}
            >
              <rect x="2.5" y="3.5" width="15" height="13" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <rect x="2.5" y="3.5" width="5.5" height="13" rx="2.6" fill="currentColor" />
            </svg>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              minWidth: 0,
              height: '100%',
              paddingLeft: 8,
              // @ts-ignore
              WebkitAppRegion: 'no-drag',
            }}
          >
            {hasWorkspaceTabs ? openWorkspaceTabs.map(ws => {
              const isActive = ws.id === workspace?.id
              return (
                <div
                  key={ws.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    maxWidth: workspaceTabMaxWidth,
                    minWidth: 0,
                    height: isActive ? workspaceTabActiveHeight : workspaceTabInactiveHeight,
                    padding: '0 8px 0 10px',
                    gap: 5,
                    marginBottom: isActive ? workspaceTabActiveBottomGap : workspaceTabInactiveBottomGap,
                    borderRadius: 8,
                    background: isActive
                      ? (theme.mode === 'light' ? `color-mix(in srgb, ${theme.surface.app} 86%, transparent)` : workspaceTabBackground)
                      : workspaceTabInactiveBackground,
                    color: isActive ? theme.text.primary : theme.text.secondary,
                    transition: 'color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease',
                    border: '0.5px solid transparent',
                    boxShadow: isActive
                      ? (theme.mode === 'light'
                          // Match the non-selected tab's bright white "paper
                          // edge" inset (--cs-edge-shadow-strong already has
                          // it at 0.92 alpha in light mode); add a darker
                          // outer hairline + drop shadow for elevation.
                          ? `var(--cs-edge-shadow-strong), 0 0 0 0.5px color-mix(in srgb, ${theme.text.primary} 12%, transparent), ${selectedTabDropShadow}`
                          : `var(--cs-edge-shadow-strong), ${selectedTabDropShadow}`)
                      : 'var(--cs-edge-shadow)',
                    boxSizing: 'border-box',
                    position: 'relative',
                    zIndex: isActive ? 1 : 0,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = workspaceTabInactiveHoverBackground
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = workspaceTabInactiveBackground
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!isActive) void handleSwitchWorkspace(ws.id)
                    }}
                    title={ws.name}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      flex: 1,
                      minWidth: 0,
                      height: 20,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      fontSize: Math.max(11, workspaceTabLabelSize),
                      fontWeight: 400,
                      lineHeight: 1,
                      letterSpacing: 0,
                      cursor: isActive ? 'default' : 'pointer',
                      transform: `translateY(${isActive ? workspaceTabTextOffset : workspaceTabInactiveTextOffset}px)`,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, lineHeight: 0, color: 'currentColor', flexShrink: 0 }}>
                      <WorkspaceTabIcon size={12} />
                    </span>
                    <WorkspaceTabLabel active={isActive}>{ws.name}</WorkspaceTabLabel>
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      void handleCloseWorkspaceTab(ws.id)
                    }}
                    aria-label={`Close ${ws.name}`}
                    title={`Close ${ws.name}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      border: 'none',
                      borderRadius: 4,
                      background: 'transparent',
                      color: 'currentColor',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0,
                      transform: `translateY(${isActive ? workspaceTabTextOffset : workspaceTabInactiveTextOffset}px)`,
                      transition: 'background 0.12s ease, color 0.12s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = workspaceTabCloseHoverBackground
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'currentColor'
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ display: 'block' }}>
                      <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )
            }) : !showTopWorkspacePickerTab ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  maxWidth: workspaceTabMaxWidth,
                  minWidth: 0,
                  height: workspaceTabActiveHeight,
                  padding: '0 8px 0 10px',
                  gap: 5,
                  marginBottom: workspaceTabActiveBottomGap,
                  borderRadius: 8,
                  background: theme.mode === 'light' ? `color-mix(in srgb, ${theme.surface.app} 86%, transparent)` : workspaceTabBackground,
                  color: theme.text.primary,
                  fontSize: Math.max(11, workspaceTabLabelSize),
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: 0,
                  border: '0.5px solid transparent',
                  boxShadow: theme.mode === 'light'
                    ? `inset 0 0 0 0.5px color-mix(in srgb, ${theme.surface.app} 92%, transparent), 0 0 0 0.5px color-mix(in srgb, ${theme.text.primary} 12%, transparent), ${selectedTabDropShadow}`
                    : `var(--cs-edge-shadow-strong), ${selectedTabDropShadow}`,
                  boxSizing: 'border-box',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, lineHeight: 0, color: 'currentColor', flexShrink: 0 }}>
                  <WorkspaceTabIcon size={12} />
                </span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    lineHeight: 1,
                    transform: 'translateY(-1px)',
                  }}
                >
                  {workspaceTitleFallback}
                </span>
              </div>
            ) : null}

            {showTopWorkspacePickerTab && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  maxWidth: workspaceTabMaxWidth,
                  minWidth: 0,
                  height: workspaceTabActiveHeight,
                  padding: '0 10px',
                  gap: 5,
                  marginBottom: workspaceTabActiveBottomGap,
                  borderRadius: 8,
                  background: theme.mode === 'light' ? `color-mix(in srgb, ${theme.surface.app} 86%, transparent)` : workspaceTabBackground,
                  color: theme.text.primary,
                  border: '0.5px solid transparent',
                  boxShadow: theme.mode === 'light'
                    ? `inset 0 0 0 0.5px color-mix(in srgb, ${theme.surface.app} 92%, transparent), 0 0 0 0.5px color-mix(in srgb, ${theme.text.primary} 12%, transparent), ${selectedTabDropShadow}`
                    : `var(--cs-edge-shadow-strong), ${selectedTabDropShadow}`,
                  boxSizing: 'border-box',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => showEmptyLayoutPage({ preserveOpenTabs: openWorkspaceTabs.length > 0 })}
                  aria-current="page"
                  title="New workspace"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    flex: 1,
                    minWidth: 0,
                    height: 20,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: Math.max(11, workspaceTabLabelSize),
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: 0,
                    cursor: 'default',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, lineHeight: 0, color: 'currentColor', flexShrink: 0 }}>
                    <Plus size={12} strokeWidth={2.1} />
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      lineHeight: 1,
                      transform: 'translateY(-1px)',
                    }}
                  >
                    WORKSPACE
                  </span>
                </button>
                {openWorkspaceTabs.length > 0 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      setShowWorkspacePickerTab(false)
                      const fallbackWorkspaceId = workspacePickerReturnWorkspaceId
                        ?? workspace?.id
                        ?? openWorkspaceTabs[openWorkspaceTabs.length - 1]?.id
                        ?? null
                      if (fallbackWorkspaceId) void handleSwitchWorkspace(fallbackWorkspaceId)
                    }}
                    aria-label="Close new workspace tab"
                    title="Close new workspace tab"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      border: 'none',
                      borderRadius: 4,
                      background: 'transparent',
                      color: 'currentColor',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0,
                      transition: 'background 0.12s ease, color 0.12s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = workspaceTabCloseHoverBackground
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'currentColor'
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ display: 'block', transform: 'translateY(-0.5px)' }}>
                      <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => showEmptyLayoutPage({ preserveOpenTabs: true })}
              aria-label="New workspace"
              title="New workspace"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                marginBottom: workspaceTabInactiveBottomGap,
                padding: 0,
                border: '0.5px solid transparent',
                borderRadius: '50%',
                background: workspaceTabInactiveBackground,
                boxShadow: 'var(--cs-edge-shadow)',
                color: theme.text.muted,
                cursor: 'pointer',
                transition: 'background 0.12s ease, color 0.12s ease, transform 0.12s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = workspaceTabInactiveHoverBackground
                e.currentTarget.style.color = theme.text.primary
                e.currentTarget.style.transform = 'scale(1.03)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = workspaceTabInactiveBackground
                e.currentTarget.style.color = theme.text.muted
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <Plus size={13} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Canvas surface — inset to the same rounded content area as panel mode */}
        <div
          ref={canvasRef}
          data-canvas-surface="true"
          className="absolute overflow-hidden"
          style={{
            top: mainPanelTop,
            left: mainPanelLeft,
            right: 6,
            bottom: mainPanelBottomInset,
            // Focus mode still needs a filled rounded surface so the outer
            // corners and split gutters don't reveal the app backdrop.
            background: mainPanelBackground,
            borderRadius: mainPanelBorderRadius,
            // Keep the layout border transparent; the visible panel edge is
            // the same inset-white + 4% black shadow treatment used by buttons.
            border: '0.5px solid transparent',
            boxShadow: mainPanelShadow,
            cursor: isDraggingCanvas ? 'grabbing' : (spaceHeld.current ? 'grab' : 'default'),
            userSelect: 'none',
            WebkitUserSelect: 'none',
            zIndex: 0,
            transition: 'left 0.15s ease',
          } as React.CSSProperties}
          onMouseDown={handleCanvasMouseDown}
          onDoubleClick={handleCanvasDoubleClick}
          onContextMenu={handleCanvasContextMenu}
          onWheel={handleWheel}
          onMouseMove={e => {
            updateCanvasGlow(e.clientX, e.clientY)
            setCanvasPointerWorld(screenToWorld(e.clientX, e.clientY))
          }}
          onMouseLeave={() => {
            hideCanvasGlow()
            setCanvasPointerWorld(null)
          }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onDrop={e => {
            e.preventDefault()
            const world = screenToWorld(e.clientX, e.clientY)

            // Tile already on canvas — just pan to it (dragged from kanban card ↗)
            const linkedTileId = e.dataTransfer.getData('application/tile-id')
            if (linkedTileId) {
              bringToFront(linkedTileId)
              const target = tiles.find(t => t.id === linkedTileId)
              if (target) panToTile(target)
              return
            }

            // Kanban card dragged onto canvas — create new tile
            const cardTitle = e.dataTransfer.getData('application/card-title')
            const cardType = e.dataTransfer.getData('application/card-type') as TileState['type'] | ''
            const cardFile = e.dataTransfer.getData('application/card-file')
            if (cardTitle) {
              addTile(cardType || 'note', cardFile || undefined, world)
              return
            }

            // Files dropped from OS or sidebar
            const droppedPaths = getDroppedPaths(e.dataTransfer)
            if (droppedPaths.length > 0) {
              // Check for .skill first (Claude skill bundle — zip archive).
              // Opens the install-confirmation modal.
              const skillPath = droppedPaths.find(p => p.toLowerCase().endsWith('.skill'))
              if (skillPath) {
                setSkillInstallPath(skillPath)
                return
              }
              // Check for .vsix first
              const vsixPath = droppedPaths.find(p => p.endsWith('.vsix'))
              if (vsixPath) {
                window.electron.extensions.installVsix?.(vsixPath).then((result) => {
                  if (result?.ok) {
                    console.log('[vsix] Installed:', result.name)
                    const firstTile = result.tiles?.[0]
                    if (firstTile) {
                      addTile(firstTile.type as TileState['type'], undefined, world)
                    }
                  } else {
                    console.error('[vsix] Install failed:', result?.error)
                  }
                })
                return
              }
              // Create a file tile for each dropped path
              for (const p of droppedPaths) {
                void resolveFileTileType(p).then(type => addTile(type, p, world))
              }
              return
            }

            // File from sidebar (text/plain fallback)
            const filePath = e.dataTransfer.getData('text/plain')
            if (filePath) {
              if (filePath.toLowerCase().endsWith('.skill')) {
                setSkillInstallPath(filePath)
                return
              }
              void resolveFileTileType(filePath).then(type => addTile(type, filePath, world))
            }
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              boxShadow: mainPanelInsetEdgeShadow,
              pointerEvents: 'none',
              zIndex: 100001,
            }}
          />
          {/* Canvas content wrapper — fades out when in expanded/tabbed mode */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: panelLayout ? 0 : 1,
            transition: 'opacity 0.3s ease',
            pointerEvents: panelLayout ? 'none' : 'auto',
          }}>
          {/* Canvas-expanded group banner — pinned to screen, NOT world-transformed */}
          {expandedCanvasGroupId && (() => {
            const eg = groups.find(gr => gr.id === expandedCanvasGroupId)
            if (!eg) return null
            const bannerColor = eg.color ?? '#4a9eff'
            return (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px 6px 12px',
                  background: theme.surface.panel,
                  border: `1px solid ${bannerColor}aa`,
                  borderRadius: 999,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
                  zIndex: 99996,
                  fontSize: appFonts.secondarySize,
                  color: theme.text.primary,
                  userSelect: 'none',
                }}
                onMouseDown={e => e.stopPropagation()}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: bannerColor }} />
                <span style={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{eg.label ?? 'group'}</span>
                <span style={{ opacity: 0.5, fontSize: appFonts.secondarySize - 1 }}>· canvas</span>
                <button
                  title="Exit (Esc)"
                  onClick={e => { e.stopPropagation(); exitCanvasExpanded() }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: 999,
                    border: 'none', background: 'transparent',
                    color: theme.text.secondary, cursor: 'pointer',
                    marginLeft: 4,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = theme.surface.app }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <X size={14} />
                </button>
              </div>
            )
          })()}
          {/* Dot grid - small */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, ${settings.gridColorSmall} 1px, transparent 1px)`,
              backgroundSize: `${settings.gridSpacingSmall * viewport.zoom}px ${settings.gridSpacingSmall * viewport.zoom}px`,
              backgroundPosition: `${viewport.tx % (settings.gridSpacingSmall * viewport.zoom)}px ${viewport.ty % (settings.gridSpacingSmall * viewport.zoom)}px`
            }}
          />
          {/* Dot grid - large */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, ${settings.gridColorLarge} 2px, transparent 2px)`,
              backgroundSize: `${settings.gridSpacingLarge * viewport.zoom}px ${settings.gridSpacingLarge * viewport.zoom}px`,
              backgroundPosition: `${viewport.tx % (settings.gridSpacingLarge * viewport.zoom)}px ${viewport.ty % (settings.gridSpacingLarge * viewport.zoom)}px`
            }}
          />

          {/* Dot grid glow - small (cursor proximity light) */}
          {canvasGlowEnabled && (
            <div
              ref={dotGlowSmallRef}
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle, ${theme.canvas.gridGlowSmall} 1px, transparent 1px)`,
                backgroundSize: `${settings.gridSpacingSmall * viewport.zoom}px ${settings.gridSpacingSmall * viewport.zoom}px`,
                backgroundPosition: `${viewport.tx % (settings.gridSpacingSmall * viewport.zoom)}px ${viewport.ty % (settings.gridSpacingSmall * viewport.zoom)}px`,
                opacity: 0,
                transition: 'opacity 0.3s ease-out',
              }}
            />
          )}
          {/* Dot grid glow - large (cursor proximity light) */}
          {canvasGlowEnabled && (
            <div
              ref={dotGlowLargeRef}
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle, ${theme.canvas.gridGlowLarge} 2px, transparent 2px)`,
                backgroundSize: `${settings.gridSpacingLarge * viewport.zoom}px ${settings.gridSpacingLarge * viewport.zoom}px`,
                backgroundPosition: `${viewport.tx % (settings.gridSpacingLarge * viewport.zoom)}px ${viewport.ty % (settings.gridSpacingLarge * viewport.zoom)}px`,
                opacity: 0,
                transition: 'opacity 0.3s ease-out',
              }}
            />
          )}

          {/* World container */}
          <div
            className="absolute"
            style={{
              transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.zoom})`,
              transformOrigin: '0 0'
            }}
          >
            <CanvasGroupFrames
              groups={groups}
              tiles={tiles}
              viewport={viewport}
              dragState={dragState}
              setDragState={setDragState}
              expandedCanvasGroupId={expandedCanvasGroupId}
              expandedCanvasMembership={expandedCanvasMembership}
              theme={theme}
              appFonts={appFonts}
              nextZIndex={nextZIndex}
              setNextZIndex={setNextZIndex}
              clipboardLength={clipboardRef.current.length}
              groupBounds={groupBounds}
              collectGroupTileIds={collectGroupTileIds}
              convertGroupToLayout={convertGroupToLayout}
              revertLayoutGroup={revertLayoutGroup}
              expandLayoutGroup={expandLayoutGroup}
              enterCanvasExpanded={enterCanvasExpanded}
              ungroupTiles={ungroupTiles}
              ungroupAll={ungroupAll}
              copyTiles={copyTiles}
              pasteTiles={pasteTiles}
              setGroups={setGroups}
              setTiles={setTiles}
              setSelectedTileId={setSelectedTileId}
              setSelectedTileIds={setSelectedTileIds}
              saveCanvas={saveCanvas}
              persistCanvasState={persistCanvasState}
              tilesRef={tilesRef}
              viewportRef={viewportRef}
              nextZIndexRef={nextZIndexRef}
              getPanelTileLabel={getPanelTileLabel}
              getPanelTileIcon={getPanelTileIcon}
              getInitialTileSize={getInitialTileSize}
              renderTileBody={renderTileBody}
            />

            {/* Rubber-band selection rect */}
            {dragState.type === 'select' && (() => {
              const x = Math.min(dragState.startWx, dragState.curWx)
              const y = Math.min(dragState.startWy, dragState.curWy)
              const w = Math.abs(dragState.curWx - dragState.startWx)
              const h = Math.abs(dragState.curWy - dragState.startWy)
              return (
                <div style={{
                  position: 'absolute', left: x, top: y, width: w, height: h,
                  border: '1px solid rgba(74,158,255,0.6)',
                  background: 'rgba(74,158,255,0.06)',
                  borderRadius: 3,
                  pointerEvents: 'none',
                  zIndex: 99998,
                  boxSizing: 'border-box'
                }} />
              )
            })()}

            {/* Alignment guides */}
            {guides.map((g, i) =>
              g.x !== undefined ? (
                <div key={`gx-${i}`} style={{
                  position: 'absolute',
                  left: g.x,
                  top: -9999,
                  width: 1,
                  height: 99999,
                  background: 'rgba(74,158,255,0.7)',
                  pointerEvents: 'none',
                  zIndex: 99999
                }} />
              ) : (
                <div key={`gy-${i}`} style={{
                  position: 'absolute',
                  top: g.y,
                  left: -9999,
                  height: 1,
                  width: 99999,
                  background: 'rgba(74,158,255,0.7)',
                  pointerEvents: 'none',
                  zIndex: 99999
                }} />
              )
            )}

            {/* Connection pills — rendered in screen-space under tiles, like edges */}
            {!panelLayout && (manualConnectionRenderRoutes.length > 0 || ambientDiscoveryRenderRoutes.length > 0 || discoveryPreview?.match) && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: discoveryPillZIndex }}>
                {manualConnectionRenderRoutes.map(connection => (
                  <Suspense key={`manual-pill-${connection.key}`} fallback={null}>
                    <LazyConnectionPill
                      x={connection.midpoint.x}
                      y={connection.midpoint.y}
                      zoom={viewport.zoom}
                      isLocked={true}
                      onToggleLock={() => toggleConnectionLock(connection.sourceTileId, connection.targetTileId)}
                      onDelete={() => deleteConnection(connection.sourceTileId, connection.targetTileId)}
                      dscLine={dsc.line}
                    />
                  </Suspense>
                ))}
                {/* Ambient route pills */}
                {ambientDiscoveryRenderRoutes.map(connection => {
                  const mid = getRouteMidpoint(connection.displayRoute)
                  const [tileIdA, tileIdB] = connection.key.split('::')
                  return (
                    <Suspense key={`pill-${connection.key}`} fallback={null}>
                      <LazyConnectionPill
                        x={mid.x}
                        y={mid.y}
                        zoom={viewport.zoom}
                        isLocked={isConnectionLocked(tileIdA, tileIdB)}
                        onToggleLock={() => toggleConnectionLock(tileIdA, tileIdB)}
                        onDelete={() => deleteConnection(tileIdA, tileIdB)}
                        dscLine={dsc.line}
                      />
                    </Suspense>
                  )
                })}
                {/* Preview pill — only if this pair doesn't already have a locked pill showing */}
                {discoveryPreview?.match && discoveryFocusTileId && (() => {
                  const previewKey = [discoveryFocusTileId, discoveryPreview.match.tile.id].sort().join('::')
                  // Skip if already rendered as a locked ambient pill
                  if (lockedConnectionKeys.has(previewKey)) return null
                  const mid = getRouteMidpoint(discoveryPreview.match.route)
                  return (
                    <Suspense fallback={null}>
                      <LazyConnectionPill
                        x={mid.x}
                        y={mid.y}
                        zoom={viewport.zoom}
                        isLocked={false}
                        onToggleLock={() => toggleConnectionLock(discoveryFocusTileId!, discoveryPreview!.match!.tile.id)}
                        onDelete={() => deleteConnection(discoveryFocusTileId!, discoveryPreview!.match!.tile.id)}
                        dscLine={dsc.line}
                      />
                    </Suspense>
                  )
                })()}
              </div>
            )}

            {tiles.filter(tile => !panelTileIds.has(tile.id)).filter(tile => !expandedCanvasMembership || expandedCanvasMembership.tileIds.has(tile.id)).map(tile => {
              // Tile being dragged (or part of a group being dragged) gets max z-index
              const isActiveDrag =
                (dragState.type === 'tile' && (dragState.tileId === tile.id || dragState.groupSnapshots.some(s => s.id === tile.id))) ||
                (dragState.type === 'resize' && dragState.tileId === tile.id) ||
                ((dragState.type === 'group' || dragState.type === 'group-resize') && tile.groupId === dragState.groupId)
              const activeTile = isActiveDrag ? { ...tile, zIndex: 99990 } : tile
              const isConnectionSource = dragState.type === 'connection' && dragState.sourceTileId === tile.id
              const isConnectionTarget = dragState.type === 'connection' && dragState.targetTileId === tile.id
              const hoveredSide = hoveredConnectionHandle?.tileId === tile.id ? hoveredConnectionHandle.side : null
              const showConnectionHandle = isConnectionSource || Boolean(hoveredSide)
              const activeHandleSide = isConnectionSource
                ? dragState.side
                : hoveredSide
                  ? hoveredSide
                : getNearestTileSide(tile, canvasPointerWorld ?? getTileCenter(tile))
              const handlePoint = getConnectionHandlePoint(tile, activeHandleSide)
              const handleSize = 22 / Math.max(0.25, viewport.zoom)
              const sensorThickness = 52 / Math.max(0.25, viewport.zoom)
              const sensorOverlap = 16 / Math.max(0.25, viewport.zoom)
              return (
                <Suspense
                  key={tile.id}
                  fallback={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text.muted, fontSize: 12, background: theme.surface.panel }}>Loading block…</div>}
                >
                  <>
                  <TileColorProvider>
                  <LazyTileChrome
                    tile={activeTile}
                    workspaceId={workspace?.id}
                    workspaceDir={workspace?.path}
                    onClose={() => closeTile(tile.id)}
                    onActivate={() => bringToFront(tile.id)}
                    onTitlebarMouseDown={e => handleTileMouseDown(e, tile)}
                    onResizeMouseDown={(e, dir) => handleResizeMouseDown(e, tile, dir)}
                    onContextMenu={e => handleTileContextMenu(e, tile)}
                    isSelected={tile.id === selectedTileId || selectedTileIds.has(tile.id)}
                    // Image tiles need to render their inspector controls
                    // OUTSIDE the rounded block when selected. Allow overflow
                    // so the negative-positioned palette/meta/input escape.
                    allowOverflow={tile.type === 'image' && (tile.id === selectedTileId || selectedTileIds.has(tile.id))}
                    forceExpanded={panelTileIds.has(tile.id)}
                    onExpandChange={expanded => expanded ? enterExpandedMode(tile.id) : exitExpandedMode()}
                    discoveryConnected={negotiatedDiscoveryState.connectedTileIds.has(tile.id)}
                    connectedPeers={negotiatedDiscoveryState.byTileConnections.get(tile.id)?.map(link => link.peerId) ?? []}
                    titlebarExtra={tile.type === 'note' && !tile.filePath ? <Suspense fallback={null}><LazyStickyColorPicker /></Suspense> : undefined}
                  >
                    <Suspense fallback={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text.muted, fontSize: 12, background: theme.surface.panelMuted }}>Loading block…</div>}>
                      {renderTileBody(tile, { isInteracting: isActiveDrag, isSelected: tile.id === selectedTileId || selectedTileIds.has(tile.id) })}
                    </Suspense>
                  </LazyTileChrome>
                  </TileColorProvider>
                  {isConnectionTarget && (
                    <div
                      style={{
                        position: 'absolute',
                        left: tile.x - 7 / viewport.zoom,
                        top: tile.y - 7 / viewport.zoom,
                        width: tile.width + 14 / viewport.zoom,
                        height: tile.height + 14 / viewport.zoom,
                        borderRadius: 12,
                        border: `${2 / Math.max(0.25, viewport.zoom)}px solid rgba(${dsc.line}, 0.78)`,
                        boxShadow: `0 0 ${18 / Math.max(0.25, viewport.zoom)}px rgba(${dsc.line}, 0.24)`,
                        pointerEvents: 'none',
                        zIndex: 99991,
                      }}
                    />
                  )}
                  {(['left', 'right', 'top', 'bottom'] as const).map(side => {
                    // Image tiles in selection mode show inspector controls
                    // (palette/meta/dots/edit input) outside the block. The
                    // link sensors sit at zIndex 99991 — well above the
                    // chrome's tile.zIndex — so they would intercept clicks
                    // intended for those inspector controls. Disable pointer
                    // events on sensors for the selected image tile.
                    const isSelectedImageTile =
                      tile.type === 'image' &&
                      (tile.id === selectedTileId || selectedTileIds.has(tile.id))
                    const sensorStyle: React.CSSProperties = {
                      position: 'absolute',
                      pointerEvents: (dragState.type === 'connection' || isSelectedImageTile) ? 'none' : 'all',
                      zIndex: 99991,
                    }
                    if (side === 'left') Object.assign(sensorStyle, {
                      left: tile.x - sensorThickness,
                      top: tile.y - sensorOverlap,
                      width: sensorThickness,
                      height: tile.height + sensorOverlap * 2,
                    })
                    if (side === 'right') Object.assign(sensorStyle, {
                      left: tile.x + tile.width,
                      top: tile.y - sensorOverlap,
                      width: sensorThickness,
                      height: tile.height + sensorOverlap * 2,
                    })
                    if (side === 'top') Object.assign(sensorStyle, {
                      left: tile.x - sensorOverlap,
                      top: tile.y - sensorThickness,
                      width: tile.width + sensorOverlap * 2,
                      height: sensorThickness,
                    })
                    if (side === 'bottom') Object.assign(sensorStyle, {
                      left: tile.x - sensorOverlap,
                      top: tile.y + tile.height,
                      width: tile.width + sensorOverlap * 2,
                      height: sensorThickness,
                    })
                    return (
                      <div
                        key={`${tile.id}-link-sensor-${side}`}
                        // Marked as part of the tile chrome so the canvas's
                        // mousedown handler doesn't clear selection when the
                        // user clicks within a sensor zone (e.g. trying to
                        // reach the image-tile inspector controls below the
                        // block, or the group toolbar above it).
                        data-tile-chrome="true"
                        style={sensorStyle}
                        onMouseDown={e => e.stopPropagation()}
                        onMouseEnter={() => showConnectionHandleForSide(tile.id, side)}
                        onMouseMove={e => {
                          showConnectionHandleForSide(tile.id, side)
                          setCanvasPointerWorld(screenToWorld(e.clientX, e.clientY))
                        }}
                        onMouseLeave={() => scheduleConnectionHandleHide(tile.id, side)}
                      />
                    )
                  })}
                  <button
                    type="button"
                    title="Drag to link blocks"
                    aria-label="Drag to link blocks"
                    onMouseDown={e => handleConnectionMouseDown(e, tile, activeHandleSide)}
                    style={{
                      position: 'absolute',
                      left: handlePoint.x - handleSize / 2,
                      top: handlePoint.y - handleSize / 2,
                      width: handleSize,
                      height: handleSize,
                      borderRadius: '50%',
                      border: `${1.5 / Math.max(0.25, viewport.zoom)}px solid rgba(${dsc.line}, ${isConnectionSource ? 0.9 : 0.48})`,
                      background: isConnectionSource ? `rgba(${dsc.line}, 0.28)` : theme.surface.panelElevated,
                      color: dsc.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      cursor: isConnectionSource ? 'grabbing' : 'grab',
                      opacity: showConnectionHandle ? 1 : 0,
                      pointerEvents: showConnectionHandle ? 'all' : 'none',
                      zIndex: 99992,
                      boxShadow: isConnectionSource ? `0 0 ${14 / Math.max(0.25, viewport.zoom)}px rgba(${dsc.line}, 0.34)` : '0 2px 8px rgba(0,0,0,0.22)',
                    }}
                    onMouseEnter={() => showConnectionHandleForSide(tile.id, activeHandleSide)}
                    onMouseMove={e => {
                      showConnectionHandleForSide(tile.id, activeHandleSide)
                      setCanvasPointerWorld(screenToWorld(e.clientX, e.clientY))
                    }}
                    onMouseLeave={() => {
                      if (!isConnectionSource) scheduleConnectionHandleHide(tile.id, activeHandleSide)
                    }}
                  >
                    <Link2 size={Math.max(8, 11 / Math.max(0.25, viewport.zoom))} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                  </>
                </Suspense>
              )
            })}

            {!panelLayout && (manualConnectionRenderRoutes.length > 0 || ambientDiscoveryRenderRoutes.length > 0 || discoveryPreview?.match || discoveryPulses.length > 0 || dragState.type === 'connection') && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: dragState.type === 'connection' ? 99996 : discoveryHighlightZIndex }}>
                {(() => {
                  return (
                    <>
                {ambientDiscoveryRenderRoutes.map(connection => (
                  <React.Fragment key={connection.key}>
                    {getRouteSegments(connection.displayRoute, 2).map((segment, index) => (
                      <div
                        key={`${connection.key}-segment-${index}`}
                        style={{
                          position: 'absolute',
                          left: segment.left,
                          top: segment.top,
                          width: segment.width,
                          height: segment.height,
                          borderRadius: 999,
                          backgroundImage: segment.horizontal
                            ? `repeating-linear-gradient(90deg, rgba(${dsc.line}, 0.28) 0 10px, transparent 10px 22px)`
                            : `repeating-linear-gradient(180deg, rgba(${dsc.line}, 0.28) 0 10px, transparent 10px 22px)`,
                          opacity: 0.92,
                          filter: `drop-shadow(0 0 4px rgba(${dsc.line}, 0.18))`,
                        }}
                      />
                    ))}
                  </React.Fragment>
                ))}
                {discoveryPreview?.match && discoveryFocusTileId && (() => {
                  const previewKey = [discoveryFocusTileId, discoveryPreview.match.tile.id].sort().join('::')
                  if (lockedConnectionKeys.has(previewKey)) return null
                  const sourceTile = tileByIdMap.get(discoveryFocusTileId)
                  const targetTile = tileByIdMap.get(discoveryPreview.match.tile.id)
                  if (!sourceTile || !targetTile) return null
                  const previewRoute = discoveryPreview.match.route
                  return (
                    <>
                      {getRouteSegments(previewRoute).map((segment, index) => (
                        <div
                          key={`preview-segment-${index}`}
                          style={{
                            position: 'absolute',
                            left: segment.left,
                            top: segment.top,
                            width: segment.width,
                            height: segment.height,
                            borderRadius: 999,
                            backgroundImage: segment.horizontal
                              ? `repeating-linear-gradient(90deg, rgba(${dsc.line}, 0.64) 0 12px, transparent 12px 20px)`
                              : `repeating-linear-gradient(180deg, rgba(${dsc.line}, 0.64) 0 12px, transparent 12px 20px)`,
                            filter: `drop-shadow(0 0 6px rgba(${dsc.line}, 0.22))`,
                          }}
                        />
                      ))}

                      {previewRoute.map((point, index) => (
                        <div
                          key={`preview-${index}`}
                          style={{
                            position: 'absolute',
                            left: point.x,
                            top: point.y,
                            width: index === 0 || index === previewRoute.length - 1 ? 9 : 6,
                            height: index === 0 || index === previewRoute.length - 1 ? 9 : 6,
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: index === 0 || index === previewRoute.length - 1 ? `rgba(${dsc.line}, 0.72)` : `rgba(${dsc.line}, 0.36)`,
                            boxShadow: `0 0 8px rgba(${dsc.line}, 0.24)`,
                          }}
                        />
                      ))}

                      {/* Pill rendered in screen-space overlay below */}
                    </>
                  )
                })()}

                <svg
                  width={200000}
                  height={200000}
                  viewBox="-100000 -100000 200000 200000"
                  style={{ position: 'absolute', left: -100000, top: -100000, overflow: 'visible', pointerEvents: 'none' }}
                >
                  {manualConnectionRenderRoutes.map(connection => (
                    <g key={`manual-route-${connection.key}`}>
                      <path
                        d={connection.path}
                        fill="none"
                        stroke={`rgba(${dsc.line}, 0.20)`}
                        strokeWidth={7 / Math.max(0.35, viewport.zoom)}
                        strokeLinecap="round"
                      />
                      <path
                        d={connection.path}
                        fill="none"
                        stroke={`rgba(${dsc.line}, 0.78)`}
                        strokeWidth={2.5 / Math.max(0.35, viewport.zoom)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={`${1 / Math.max(0.35, viewport.zoom)} ${10 / Math.max(0.35, viewport.zoom)}`}
                        style={{ filter: `drop-shadow(0 0 7px rgba(${dsc.line}, 0.18))` }}
                      />
                      <circle cx={connection.source.x} cy={connection.source.y} r={4.2 / Math.max(0.35, viewport.zoom)} fill={`rgba(${dsc.line}, 0.88)`} />
                      <circle cx={connection.target.x} cy={connection.target.y} r={4.2 / Math.max(0.35, viewport.zoom)} fill={`rgba(${dsc.line}, 0.88)`} />
                    </g>
                  ))}
                  {dragState.type === 'connection' && (() => {
                    const targetTile = dragState.targetTileId ? tileByIdMap.get(dragState.targetTileId) : null
                    const targetAnchors = targetTile
                      ? getTileSpatialReference(targetTile, Math.max(8, settings.gridSize || settings.gridSpacingSmall || GRID)).anchors
                      : []
                    const facingTargetAnchors = targetAnchors.filter(anchor => anchor.side === getOppositeAnchorSide(dragState.side))
                    const targetPoint = targetTile
                      ? findBestAnchorPair([dragState.anchor], facingTargetAnchors.length ? facingTargetAnchors : targetAnchors)?.target ?? dragState.current
                      : dragState.current
                    const dx = dragState.current.x - dragState.anchor.x
                    const dy = dragState.current.y - dragState.anchor.y
                    const sag = Math.sin((dx + dy) * 0.035) * 20
                    const path = getBezierConnectionPath(dragState.anchor, targetPoint, sag)
                    return (
                      <g>
                        <path
                          d={path}
                          fill="none"
                          stroke={`rgba(${dsc.line}, 0.18)`}
                          strokeWidth={10 / Math.max(0.35, viewport.zoom)}
                          strokeLinecap="round"
                        />
                        <path
                          d={path}
                          fill="none"
                          stroke={`rgba(${dsc.line}, 0.86)`}
                          strokeWidth={3 / Math.max(0.35, viewport.zoom)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={`${1 / Math.max(0.35, viewport.zoom)} ${10 / Math.max(0.35, viewport.zoom)}`}
                          style={{
                            filter: `drop-shadow(0 0 10px rgba(${dsc.line}, 0.20))`,
                            transition: 'd 0.08s linear',
                          }}
                        />
                        <circle cx={dragState.anchor.x} cy={dragState.anchor.y} r={4.5 / Math.max(0.35, viewport.zoom)} fill={`rgba(${dsc.line}, 0.95)`} />
                        <circle cx={targetPoint.x} cy={targetPoint.y} r={targetTile ? 6 / Math.max(0.35, viewport.zoom) : 4 / Math.max(0.35, viewport.zoom)} fill={`rgba(${dsc.line}, ${targetTile ? 0.95 : 0.58})`} />
                      </g>
                    )
                  })()}
                  {discoveryPulses.map(pulse => {
                    const sourceTile = tileByIdMap.get(pulse.sourceTileId)
                    const targetTile = tileByIdMap.get(pulse.targetTileId)
                    if (!sourceTile || !targetTile) return null
                    const route = pulse.route
                    const d = routeToSvgPath(route)
                    return (
                      <g key={`route-${pulse.id}`}>
                        <path
                          d={d}
                          fill="none"
                          stroke={`rgba(${dsc.line}, 0.18)`}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={d}
                          fill="none"
                          pathLength={100}
                          stroke={`rgba(${dsc.line}, 0.72)`}
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            strokeDasharray: '16 84',
                            strokeDashoffset: 100,
                            filter: `drop-shadow(0 0 8px rgba(${dsc.line}, 0.24))`,
                            animation: `discovery-route-travel ${pulse.durationMs}ms linear forwards`
                          }}
                        />
                        {route.map((point, index) => (
                          <circle
                            key={`${pulse.id}-pt-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={index === 0 || index === route.length - 1 ? 4.5 : 3}
                            fill={index === 0 || index === route.length - 1 ? `rgba(${dsc.line}, 0.72)` : `rgba(${dsc.line}, 0.36)`}
                          />
                        ))}
                      </g>
                    )
                  })}
                </svg>

                {discoveryPulses.map(pulse => {
                  const sourceTile = tileByIdMap.get(pulse.sourceTileId)
                  const targetTile = tileByIdMap.get(pulse.targetTileId)
                  if (!sourceTile || !targetTile) return null

                  return (
                    <React.Fragment key={pulse.id}>

                      {/* Pill rendered in screen-space overlay below */}
                    </React.Fragment>
                  )
                })}
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {canvasGlowEnabled && !panelLayout && (ambientDiscoveryRenderRoutes.length > 0 || discoveryPreview?.match || discoveryPulses.length > 0) && (
            <div
              ref={discoveryGlowRef}
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: 0,
                transition: 'opacity 0.18s ease-out',
                zIndex: discoveryGlowZIndex,
              }}
            >
              {ambientDiscoveryRenderRoutes.map(connection => {
                const screenRoute = connection.displayRoute.map(worldToScreenPoint)
                return getRouteSegments(screenRoute, 2.5).map((segment, index) => (
                  <div
                    key={`${connection.key}-glow-${index}`}
                    style={{
                      position: 'absolute',
                      left: segment.left,
                      top: segment.top,
                      width: segment.width,
                      height: segment.height,
                      borderRadius: 999,
                      backgroundImage: segment.horizontal
                        ? `repeating-linear-gradient(90deg, rgba(${dsc.line}, 0.72) 0 10px, transparent 10px 22px)`
                        : `repeating-linear-gradient(180deg, rgba(${dsc.line}, 0.72) 0 10px, transparent 10px 22px)`,
                      filter: `drop-shadow(0 0 6px rgba(${dsc.line}, 0.26))`,
                    }}
                  />
                ))
              })}

              {discoveryPreview?.match && discoveryFocusTileId && (() => {
                const previewKey = [discoveryFocusTileId, discoveryPreview.match.tile.id].sort().join('::')
                if (lockedConnectionKeys.has(previewKey)) return null
                const screenRoute = discoveryPreview.match.route.map(worldToScreenPoint)
                return (
                  <>
                    {getRouteSegments(screenRoute, 3.2).map((segment, index) => (
                      <div
                        key={`preview-glow-${index}`}
                        style={{
                          position: 'absolute',
                          left: segment.left,
                          top: segment.top,
                          width: segment.width,
                          height: segment.height,
                          borderRadius: 999,
                          backgroundImage: segment.horizontal
                            ? `repeating-linear-gradient(90deg, rgba(${dsc.line}, 0.82) 0 12px, transparent 12px 20px)`
                            : `repeating-linear-gradient(180deg, rgba(${dsc.line}, 0.82) 0 12px, transparent 12px 20px)`,
                          filter: `drop-shadow(0 0 8px rgba(${dsc.line}, 0.30))`,
                        }}
                      />
                    ))}
                    {screenRoute.map((point, index) => (
                      <div
                        key={`preview-glow-dot-${index}`}
                        style={{
                          position: 'absolute',
                          left: point.x,
                          top: point.y,
                          width: index === 0 || index === screenRoute.length - 1 ? 10 : 6,
                          height: index === 0 || index === screenRoute.length - 1 ? 10 : 6,
                          borderRadius: '50%',
                          transform: 'translate(-50%, -50%)',
                          background: index === 0 || index === screenRoute.length - 1 ? `rgba(${dsc.line}, 0.82)` : `rgba(${dsc.line}, 0.46)`,
                          boxShadow: `0 0 9px rgba(${dsc.line}, 0.28)`,
                        }}
                      />
                    ))}
                  </>
                )
              })()}

              {discoveryPulses.map(pulse => {
                const screenRoute = pulse.route.map(worldToScreenPoint)
                return getRouteSegments(screenRoute, 3.2).map((segment, index) => (
                  <div
                    key={`${pulse.id}-glow-${index}`}
                    style={{
                      position: 'absolute',
                      left: segment.left,
                      top: segment.top,
                      width: segment.width,
                      height: segment.height,
                      borderRadius: 999,
                      backgroundImage: segment.horizontal
                        ? `repeating-linear-gradient(90deg, rgba(${dsc.line}, 0.76) 0 12px, transparent 12px 20px)`
                        : `repeating-linear-gradient(180deg, rgba(${dsc.line}, 0.76) 0 12px, transparent 12px 20px)`,
                      filter: `drop-shadow(0 0 8px rgba(${dsc.line}, 0.28))`,
                    }}
                  />
                ))
              })}
            </div>
          )}

          {/* Group button — appears when 2+ tiles are rubber-band selected */}
          {selectedTileIds.size >= 2 && (
            <div
              onMouseDown={e => e.stopPropagation()}
              style={{
              position: 'absolute', bottom: 62, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 8, alignItems: 'center',
              background: theme.surface.overlay, border: `1px solid ${theme.border.default}`,
              borderRadius: 8, padding: '5px 12px',
              backdropFilter: 'blur(8px)',
              boxShadow: theme.shadow.panel,
              zIndex: 1000
            }}>
              <span style={{ fontSize: appFonts.secondarySize, color: theme.text.muted }}>{selectedTileIds.size} block{selectedTileIds.size !== 1 ? 's' : ''} selected</span>
              <button
                onClick={groupSelectedTiles}
                style={{
                  fontSize: appFonts.secondarySize, color: theme.accent.base, background: theme.accent.soft,
                  border: `1px solid ${theme.border.accent}`, borderRadius: 5,
                  padding: '3px 10px', cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.background = theme.surface.selection}
                onMouseLeave={e => e.currentTarget.style.background = theme.accent.soft}
              >
                Group
              </button>
              <button
                onClick={() => setSelectedTileIds(new Set())}
                style={{
                  fontSize: appFonts.secondarySize, color: theme.text.disabled, background: 'transparent',
                  border: 'none', cursor: 'pointer', padding: '3px 6px'
                }}
              >
                Cancel
              </button>
            </div>
          )}

          </div>{/* end canvas content wrapper */}

          {/* Expanded panel layout — shares the rounded content surface with canvas mode */}
          {panelLayout && (
            <div style={{
              position: 'absolute',
              inset: 0,
              // Wrapper reserves geometry only; each LeafPanel draws its own
              // 0.5px edge so splits appear as individually-rounded tiles with
              // the shared panel surface visible in the 6px gutters between them.
              zIndex: 50,
            }}>
            <Suspense fallback={null}>
              <LazyPanelLayout
                root={panelLayout}
                insetBottom={0}
                outerRadii={mainPanelCornerRadii}
                getTileLabel={getPanelTileLabel}
                renderTile={(tileId) => {
                  const t = tiles.find(ti => ti.id === tileId)
                  if (!t) return null
                  return (
                    <div style={{ width: '100%', height: '100%', background: theme.surface.panel }}>
                      <Suspense fallback={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text.muted, fontSize: 12, background: theme.surface.panel }}>Loading block…</div>}>
                        {renderTileBody(t)}
                      </Suspense>
                    </div>
                  )
                }}
                onLayoutChange={setPanelLayout}
                onCloseTab={closeTile}
                onAddTile={(type) => addTile(type as TileState['type'])}
                onExit={exitExpandedMode}
                activePanelId={activePanelId}
                onActivePanelChange={setActivePanelId}
                getTileType={(tileId) => tiles.find(t => t.id === tileId)?.type ?? 'note'}
                getTileIcon={getPanelTileIcon}
                onSplitNew={(panelId, tileType, zone) => {
                  const center = viewportCenter()
                  const { w, h } = getInitialTileSize(tileType as TileState['type'])
                  const newTile: TileState = {
                    id: `tile-${Date.now()}`,
                    type: tileType as TileState['type'],
                    x: snapValue(center.x - w / 2), y: snapValue(center.y - h / 2),
                    width: w, height: h, zIndex: nextZIndex,
                  }
                  setTiles(prev => [...prev, newTile])
                  setNextZIndex(prev => prev + 1)
                  setPanelLayout(prev => prev ? splitLeaf(prev, panelId, newTile.id, zone) : prev)
                }}
                onCloseOthers={(panelId, tileId) => {
                  setPanelLayout(prev => prev ? closeOthersInLeaf(prev, panelId, tileId) : prev)
                }}
                onCloseToRight={(panelId, tileId) => {
                  setPanelLayout(prev => prev ? closeToRightInLeaf(prev, panelId, tileId) : prev)
                }}
                onLaunchTemplate={handleLaunchTemplate}
              />
            </Suspense>
            </div>
          )}

          {/* Minimap */}
          {showMinimap && (
            <Suspense fallback={null}>
              <LazyMinimap
                tiles={tiles}
                viewport={viewport}
                canvasSize={{
                  w: canvasRef.current?.clientWidth ?? 1200,
                  h: canvasRef.current?.clientHeight ?? 800
                }}
                onPan={(tx, ty) => setViewport(prev => ({ ...prev, tx, ty }))}
              />
            </Suspense>
          )}

        </div>

        {/* Arrange toolbar — render above the titlebar drag layer */}
        <Suspense fallback={null}>
          <LazyArrangeToolbar
            tiles={tiles}
            groups={groups}
            onArrange={(updated, mode) => {
              if (panelLayout) exitExpandedMode()
              setCanvasArrangeMode(mode)
              handleArrange(updated)
            }}
            zoom={viewport.zoom}
            isTabbedView={!!panelLayout}
            activeCanvasMode={canvasArrangeMode}
            onToggleTabs={() => {
              if (panelLayout) exitExpandedMode()
              else enterTabbedView()
            }}
            onZoomToggle={toggleZoomOne}
          />
        </Suspense>
      </div>
      {showMCP && (
        <Suspense fallback={null}>
          <LazyMCPPanel onClose={() => setShowMCP(false)} />
        </Suspense>
      )}
      {showSettings && (
        <Suspense fallback={null}>
          <LazySettingsPanel settings={settings} onClose={() => setShowSettings(false)} onSettingsChange={s => setSettings(withDefaultSettings(s))} workspaces={workspaces} workspacePath={workspace?.path} initialSection={typeof showSettings === 'string' ? showSettings as any : undefined} systemPrefersDark={systemPrefersDark} />
        </Suspense>
      )}
      {showExtensionsGallery && (
        <Suspense fallback={null}>
          <LazyExtensionsGallery
            onClose={() => setShowExtensionsGallery(false)}
            workspacePath={workspace?.path ?? null}
            onSettingsChange={s => setSettings(withDefaultSettings(s))}
          />
        </Suspense>
      )}
      {settingsLoaded && !settings.onboardingComplete && (
        <Suspense fallback={null}>
          <LazyOnboardingOverlay
            onComplete={() => updateAppSettings({ onboardingComplete: true })}
            onOpenPlugins={() => setShowExtensionsGallery(true)}
          />
        </Suspense>
      )}
      {ctxMenu && (
        <Suspense fallback={null}>
          <LazyContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={closeCtx} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <LazyClusoWidgetMount />
      </Suspense>
      {showAgentSetup && (
        <Suspense fallback={null}>
          <LazyAgentSetup
            onComplete={() => setShowAgentSetup(false)}
            onDismiss={() => setShowAgentSetup(false)}
          />
        </Suspense>
      )}
      {skillInstallPath && (
        <Suspense fallback={null}>
          <LazySkillInstallModal
            zipPath={skillInstallPath}
            onClose={() => setSkillInstallPath(null)}
          />
        </Suspense>
      )}
      {commandPaletteOpen && (
        <Suspense fallback={null}>
          <LazyCommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
          />
        </Suspense>
      )}
      <DevSandboxFrame />
    </div>
    </FontProvider>
    </FontTokenProvider>
    </ThemeProvider>
  )
}

export default App
