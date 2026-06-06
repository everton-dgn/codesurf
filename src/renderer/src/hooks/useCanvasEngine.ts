/**
 * useCanvasEngine — viewport, coordinates, persistence, undo/redo, and zoom for the canvas.
 *
 * Extracted from App.tsx (TASK-W4-A). Owns canvas viewport state, world/screen
 * transforms, debounced persistence, and history stacks.
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type RefObject,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { TileState, GroupState, CanvasState, Workspace } from '../../../shared/types'
import type { PanelNode } from '../components/panelLayoutTree'

// ─── Canvas constants ───────────────────────────────────────────────────────

/** Screen-space snap padding for manual connection targets (divided by zoom at runtime). */
export const SNAP_THRESHOLD = 34

export const MIN_CANVAS_ZOOM = 0.25
export const MAX_CANVAS_ZOOM = 2
export const ZOOM_WHEEL_FACTOR_IN = 1.08
export const ZOOM_WHEEL_FACTOR_OUT = 0.92
export const CANVAS_SAVE_DEBOUNCE_MS = 500
export const HISTORY_MAX_ENTRIES = 50
export const FIT_VIEWPORT_PAD_PX = 48
export const FIT_VIEWPORT_MAX_ZOOM = 1.5
export const ARRANGE_FIT_PAD_PX = 60
export const ARRANGE_FIT_ZOOM_SCALE = 0.9

export type CanvasViewport = { tx: number; ty: number; zoom: number }

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = { tx: 0, ty: 0, zoom: 1 }

export type CanvasHistoryEntry = { tiles: TileState[]; groups: GroupState[] }

export type PersistCanvasStateFn = (
  tileList: TileState[],
  vp: CanvasViewport,
  nz: number,
  grps?: GroupState[],
) => void

export type SaveCanvasFn = PersistCanvasStateFn

export type CanvasEnginePersistRefs = {
  tilesRef: MutableRefObject<TileState[]>
  groupsRef: MutableRefObject<GroupState[]>
  lockedConnectionsRef: MutableRefObject<Array<{ sourceTileId: string; targetTileId: string }>>
  panelLayoutRef: MutableRefObject<PanelNode | null>
  savedLayoutRef: MutableRefObject<PanelNode | null>
  activePanelIdRef: MutableRefObject<string | null>
  expandedTileIdRef: MutableRefObject<string | null>
  expandedCanvasGroupIdRef: MutableRefObject<string | null>
}

export type UseCanvasEngineOptions = {
  workspace: Workspace | null
  canvasRef: RefObject<HTMLDivElement | null>
  tiles: TileState[]
  groups: GroupState[]
  panelLayout: PanelNode | null
  activePanelId: string | null
  expandedTileId: string | null
  persistRefs: CanvasEnginePersistRefs
  setTiles: Dispatch<SetStateAction<TileState[]>>
  setGroups: Dispatch<SetStateAction<GroupState[]>>
  isEditableTarget: (target: EventTarget | null) => boolean
  /** Optional initial viewport when restoring saved canvas state. */
  initialViewport?: CanvasViewport
  initialNextZIndex?: number
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function clampCanvasZoom(zoom: number): number {
  return Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, zoom))
}

export function connectionSnapPadding(zoom: number): number {
  return SNAP_THRESHOLD / Math.max(MIN_CANVAS_ZOOM, zoom)
}

export function zoomAtPoint(
  viewport: CanvasViewport,
  mx: number,
  my: number,
  newZoom: number,
): CanvasViewport {
  const clamped = clampCanvasZoom(newZoom)
  const wx = (mx - viewport.tx) / viewport.zoom
  const wy = (my - viewport.ty) / viewport.zoom
  return {
    tx: mx - wx * clamped,
    ty: my - wy * clamped,
    zoom: clamped,
  }
}

export function computeFitViewport(
  bounds: { x: number; y: number; w: number; h: number },
  screen: { w: number; h: number },
): CanvasViewport {
  const availW = Math.max(1, screen.w - FIT_VIEWPORT_PAD_PX * 2)
  const availH = Math.max(1, screen.h - FIT_VIEWPORT_PAD_PX * 2)
  const zoom = Math.min(FIT_VIEWPORT_MAX_ZOOM, availW / bounds.w, availH / bounds.h)
  const tx = (screen.w - bounds.w * zoom) / 2 - bounds.x * zoom
  const ty = (screen.h - bounds.h * zoom) / 2 - bounds.y * zoom
  return { tx, ty, zoom }
}

export function computeArrangeFitViewport(
  tiles: TileState[],
  screen: { w: number; h: number },
  sidebarOffset: number,
  getArrangeWidth: (tile: TileState) => number,
): CanvasViewport | null {
  if (tiles.length === 0) return null
  const availableWidth = screen.w - sidebarOffset
  const minX = Math.min(...tiles.map(t => t.x))
  const minY = Math.min(...tiles.map(t => t.y))
  const maxX = Math.max(...tiles.map(t => t.x + getArrangeWidth(t)))
  const maxY = Math.max(...tiles.map(t => t.y + t.height))
  const fitZoom = Math.min(
    availableWidth / (maxX - minX + ARRANGE_FIT_PAD_PX * 2),
    screen.h / (maxY - minY + ARRANGE_FIT_PAD_PX * 2),
    MAX_CANVAS_ZOOM,
  )
  const newZoom = fitZoom * ARRANGE_FIT_ZOOM_SCALE
  const centerX = sidebarOffset + availableWidth / 2
  const tx = centerX - ((minX + maxX) / 2) * newZoom
  const ty = screen.h / 2 - ((minY + maxY) / 2) * newZoom
  return { tx, ty, zoom: newZoom }
}

export function computePanToTileViewport(
  tile: Pick<TileState, 'x' | 'y' | 'width' | 'height'>,
  screen: { w: number; h: number },
  currentZoom: number,
): Pick<CanvasViewport, 'tx' | 'ty'> {
  return {
    tx: screen.w / 2 - (tile.x + tile.width / 2) * currentZoom,
    ty: screen.h / 2 - (tile.y + tile.height / 2) * currentZoom,
  }
}

export function screenToWorldPoint(
  sx: number,
  sy: number,
  rect: DOMRect,
  viewport: CanvasViewport,
): { x: number; y: number } {
  return {
    x: (sx - rect.left - viewport.tx) / viewport.zoom,
    y: (sy - rect.top - viewport.ty) / viewport.zoom,
  }
}

export function worldToScreenPoint(
  point: { x: number; y: number },
  viewport: CanvasViewport,
): { x: number; y: number } {
  return {
    x: point.x * viewport.zoom + viewport.tx,
    y: point.y * viewport.zoom + viewport.ty,
  }
}

export function worldToScreenRect(
  tile: TileState,
  viewport: CanvasViewport,
): { left: number; top: number; width: number; height: number } {
  return {
    left: tile.x * viewport.zoom + viewport.tx,
    top: tile.y * viewport.zoom + viewport.ty,
    width: tile.width * viewport.zoom,
    height: tile.height * viewport.zoom,
  }
}

function buildCanvasStatePayload(
  tileList: TileState[],
  vp: CanvasViewport,
  nz: number,
  resolvedGroups: GroupState[],
  persistRefs: CanvasEnginePersistRefs,
  expandedCanvasPriorViewport: CanvasViewport | null,
): CanvasState {
  return {
    tiles: tileList,
    groups: resolvedGroups,
    viewport: vp,
    nextZIndex: nz,
    panelLayout: persistRefs.panelLayoutRef.current ?? persistRefs.savedLayoutRef.current,
    activePanelId: persistRefs.activePanelIdRef.current,
    tabViewActive: Boolean(persistRefs.panelLayoutRef.current),
    expandedTileId: persistRefs.expandedTileIdRef.current,
    expandedCanvasGroupId: persistRefs.expandedCanvasGroupIdRef.current,
    expandedCanvasPriorViewport,
    lockedConnections: persistRefs.lockedConnectionsRef.current.length > 0
      ? persistRefs.lockedConnectionsRef.current
      : undefined,
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type UseCanvasEngineReturn = {
  viewport: CanvasViewport
  setViewport: Dispatch<SetStateAction<CanvasViewport>>
  viewportRef: MutableRefObject<CanvasViewport>
  nextZIndex: number
  setNextZIndex: Dispatch<SetStateAction<number>>
  nextZIndexRef: MutableRefObject<number>
  prevZoomRef: MutableRefObject<number>
  expandedCanvasPriorViewportRef: MutableRefObject<CanvasViewport | null>
  persistCanvasStateRef: MutableRefObject<PersistCanvasStateFn | null>
  historyBack: MutableRefObject<CanvasHistoryEntry[]>
  historyForward: MutableRefObject<CanvasHistoryEntry[]>
  skipHistory: MutableRefObject<boolean>
  panVelocityRef: MutableRefObject<{ vx: number; vy: number }>
  panLastPos: MutableRefObject<{ x: number; y: number; t: number }>
  panInertiaRaf: MutableRefObject<number>
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  worldToScreen: (point: { x: number; y: number }) => { x: number; y: number }
  worldToScreenRect: (tile: TileState) => { left: number; top: number; width: number; height: number }
  viewportCenter: () => { x: number; y: number }
  saveCanvas: SaveCanvasFn
  persistCanvasState: PersistCanvasStateFn
  computeFitViewport: typeof computeFitViewport
  zoomToFitArrangedTiles: (
    merged: TileState[],
    getArrangeWidth: (tile: TileState) => number,
    sidebarOffset: number,
  ) => void
  panToTile: (tile: Pick<TileState, 'x' | 'y' | 'width' | 'height'>) => void
  toggleZoomOne: () => void
  resetCanvasZoom: () => void
  cancelPanInertia: () => void
  startPanInertia: () => void
  findManualConnectionTarget: (
    sourceTileId: string,
    point: { x: number; y: number },
    tiles: TileState[],
    panelTileIds: Set<string>,
    getTileCenter: (tile: TileState) => { x: number; y: number },
  ) => string | null
  restoreViewport: (saved: CanvasViewport | null | undefined) => void
  resetViewportState: () => void
  handleWheel: (e: React.WheelEvent) => void
  scheduleViewportUpdate: (nextViewport: CanvasViewport) => void
}

export function useCanvasEngine(options: UseCanvasEngineOptions): UseCanvasEngineReturn {
  const {
    workspace,
    canvasRef,
    tiles,
    groups,
    panelLayout,
    activePanelId,
    expandedTileId,
    persistRefs,
    setTiles,
    setGroups,
    isEditableTarget,
    initialViewport,
    initialNextZIndex,
  } = options

  const [viewport, setViewport] = useState<CanvasViewport>(initialViewport ?? DEFAULT_CANVAS_VIEWPORT)
  const [nextZIndex, setNextZIndex] = useState(initialNextZIndex ?? 1)

  const prevZoomRef = useRef(1)
  const panVelocityRef = useRef({ vx: 0, vy: 0 })
  const panLastPos = useRef({ x: 0, y: 0, t: 0 })
  const panInertiaRaf = useRef(0)

  const historyBack = useRef<CanvasHistoryEntry[]>([])
  const historyForward = useRef<CanvasHistoryEntry[]>([])
  const skipHistory = useRef(false)

  const viewportRef = useRef(viewport)
  const nextZIndexRef = useRef(nextZIndex)
  const viewportAnimationFrameRef = useRef<number | null>(null)
  const pendingViewportRef = useRef(viewport)
  const expandedCanvasPriorViewportRef = useRef<CanvasViewport | null>(null)
  const persistCanvasStateRef = useRef<PersistCanvasStateFn | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistRefsRef = useRef(persistRefs)
  persistRefsRef.current = persistRefs

  // Keep viewport / z-index refs in sync with state
  viewportRef.current = viewport
  pendingViewportRef.current = viewport
  nextZIndexRef.current = nextZIndex

  const scheduleViewportUpdate = useCallback((nextVp: CanvasViewport) => {
    pendingViewportRef.current = nextVp
    if (viewportAnimationFrameRef.current !== null) return
    viewportAnimationFrameRef.current = requestAnimationFrame(() => {
      viewportAnimationFrameRef.current = null
      setViewport(pendingViewportRef.current)
    })
  }, [])

  useEffect(() => () => {
    if (viewportAnimationFrameRef.current !== null) {
      cancelAnimationFrame(viewportAnimationFrameRef.current)
      viewportAnimationFrameRef.current = null
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const cancelPanInertia = useCallback(() => {
    cancelAnimationFrame(panInertiaRaf.current)
    panVelocityRef.current = { vx: 0, vy: 0 }
  }, [])

  const startPanInertia = useCallback(() => {
    const { vx, vy } = panVelocityRef.current
    if (Math.abs(vx) <= 0.5 && Math.abs(vy) <= 0.5) return
    const friction = 0.92
    const animate = () => {
      const v = panVelocityRef.current
      if (Math.abs(v.vx) < 0.5 && Math.abs(v.vy) < 0.5) return
      setViewport(prev => ({ ...prev, tx: prev.tx + v.vx, ty: prev.ty + v.vy }))
      panVelocityRef.current = { vx: v.vx * friction, vy: v.vy * friction }
      panInertiaRaf.current = requestAnimationFrame(animate)
    }
    panInertiaRaf.current = requestAnimationFrame(animate)
  }, [])

  const persistCanvasState = useCallback<PersistCanvasStateFn>((tileList, vp, nz, grps) => {
    if (!workspace) return
    const refs = persistRefsRef.current
    const resolvedGroups = grps ?? refs.groupsRef.current

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const state = buildCanvasStatePayload(
        tileList,
        vp,
        nz,
        resolvedGroups,
        refs,
        expandedCanvasPriorViewportRef.current,
      )
      window.electron.canvas.save(workspace.id, state)
    }, CANVAS_SAVE_DEBOUNCE_MS)
  }, [workspace])

  const saveCanvas = useCallback<SaveCanvasFn>((tileList, vp, nz, grps) => {
    if (!workspace) return
    const refs = persistRefsRef.current
    const resolvedGroups = grps ?? refs.groupsRef.current

    if (!skipHistory.current) {
      historyBack.current.push({
        tiles: refs.tilesRef.current,
        groups: refs.groupsRef.current,
      })
      if (historyBack.current.length > HISTORY_MAX_ENTRIES) historyBack.current.shift()
      historyForward.current = []
    }

    persistCanvasState(tileList, vp, nz, resolvedGroups)
  }, [workspace, persistCanvasState])

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToWorldPoint(sx, sy, rect, viewport)
  }, [canvasRef, viewport])

  const viewportCenter = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 200, y: 100 }
    return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }, [canvasRef, screenToWorld])

  const worldToScreen = useCallback((point: { x: number; y: number }) => (
    worldToScreenPoint(point, viewport)
  ), [viewport])

  const worldToScreenRectBound = useCallback((tile: TileState) => (
    worldToScreenRect(tile, viewport)
  ), [viewport])

  const findManualConnectionTarget = useCallback((
    sourceTileId: string,
    point: { x: number; y: number },
    tileList: TileState[],
    panelTileIds: Set<string>,
    getTileCenter: (tile: TileState) => { x: number; y: number },
  ): string | null => {
    const snapPadding = connectionSnapPadding(viewportRef.current.zoom)
    const candidates = tileList
      .filter(tile => tile.id !== sourceTileId && !panelTileIds.has(tile.id))
      .filter(tile => (
        point.x >= tile.x - snapPadding
        && point.x <= tile.x + tile.width + snapPadding
        && point.y >= tile.y - snapPadding
        && point.y <= tile.y + tile.height + snapPadding
      ))
      .map(tile => ({
        tile,
        distance: Math.hypot(point.x - getTileCenter(tile).x, point.y - getTileCenter(tile).y),
      }))
      .sort((a, b) => a.distance - b.distance)
    return candidates[0]?.tile.id ?? null
  }, [])

  const restoreViewport = useCallback((saved: CanvasViewport | null | undefined) => {
    setViewport(saved
      ? { tx: saved.tx, ty: saved.ty, zoom: saved.zoom }
      : DEFAULT_CANVAS_VIEWPORT)
  }, [])

  const resetViewportState = useCallback(() => {
    setViewport(DEFAULT_CANVAS_VIEWPORT)
    setNextZIndex(1)
  }, [])

  const panToTile = useCallback((tile: Pick<TileState, 'x' | 'y' | 'width' | 'height'>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const pan = computePanToTileViewport(tile, { w: rect.width, h: rect.height }, viewport.zoom)
    setViewport(prev => ({ ...prev, ...pan }))
  }, [canvasRef, viewport.zoom])

  const zoomToFitArrangedTiles = useCallback((
    merged: TileState[],
    getArrangeWidth: (tile: TileState) => number,
    sidebarOffset: number,
  ) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || merged.length === 0) return
    const fit = computeArrangeFitViewport(merged, { w: rect.width, h: rect.height }, sidebarOffset, getArrangeWidth)
    if (fit) setViewport(fit)
  }, [canvasRef])

  const toggleZoomOne = useCallback(() => {
    setViewport(prev => {
      if (prev.zoom === 1) {
        return { ...prev, zoom: prevZoomRef.current !== 1 ? prevZoomRef.current : 1 }
      }
      prevZoomRef.current = prev.zoom
      return { ...prev, zoom: 1 }
    })
  }, [])

  const resetCanvasZoom = useCallback(() => {
    setViewport(prev => ({ ...prev, zoom: 1 }))
    window.electron.zoom.setLevel(0)
  }, [])

  const handleWheel = useCallback((_e: ReactWheelEvent) => {}, [])

  // Auto-save when layout metadata changes
  useEffect(() => {
    if (!workspace) return
    persistCanvasState(tiles, viewport, nextZIndex, groups)
  }, [workspace, panelLayout, activePanelId, expandedTileId, persistCanvasState, tiles, viewport, nextZIndex, groups])

  // Cmd+0 reset zoom, Cmd+=/- UI zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '0') {
        e.preventDefault()
        resetCanvasZoom()
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        window.electron.zoom.setLevel(window.electron.zoom.getLevel() + 0.5)
      } else if (e.key === '-') {
        e.preventDefault()
        window.electron.zoom.setLevel(window.electron.zoom.getLevel() - 0.5)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [resetCanvasZoom])

  // Wheel zoom — native listener for { passive: false }
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      const factor = e.deltaY < 0 ? ZOOM_WHEEL_FACTOR_IN : ZOOM_WHEEL_FACTOR_OUT
      const newZoom = clampCanvasZoom(viewport.zoom * factor)
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setViewport(zoomAtPoint(viewport, mx, my, newZoom))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [canvasRef, viewport])

  // Undo / redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      const isUndo = e.key === 'z' && !e.shiftKey
      const isRedo = (e.key === 'z' && e.shiftKey) || e.key === 'y'
      if (!isUndo && !isRedo) return
      e.preventDefault()

      if (isUndo && historyBack.current.length > 0) {
        const prev = historyBack.current.pop()!
        historyForward.current.push({
          tiles: persistRefsRef.current.tilesRef.current,
          groups: persistRefsRef.current.groupsRef.current,
        })
        skipHistory.current = true
        setTiles(prev.tiles)
        setGroups(prev.groups)
        if (workspace) {
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => {
            const state: CanvasState = {
              tiles: prev.tiles,
              groups: prev.groups,
              viewport: viewportRef.current,
              nextZIndex: nextZIndexRef.current,
            }
            window.electron.canvas.save(workspace.id, state)
            skipHistory.current = false
          }, CANVAS_SAVE_DEBOUNCE_MS)
        } else {
          skipHistory.current = false
        }
      }

      if (isRedo && historyForward.current.length > 0) {
        const next = historyForward.current.pop()!
        historyBack.current.push({
          tiles: persistRefsRef.current.tilesRef.current,
          groups: persistRefsRef.current.groupsRef.current,
        })
        if (historyBack.current.length > HISTORY_MAX_ENTRIES) historyBack.current.shift()
        skipHistory.current = true
        setTiles(next.tiles)
        setGroups(next.groups)
        if (workspace) {
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => {
            const state: CanvasState = {
              tiles: next.tiles,
              groups: next.groups,
              viewport: viewportRef.current,
              nextZIndex: nextZIndexRef.current,
            }
            window.electron.canvas.save(workspace.id, state)
            skipHistory.current = false
          }, CANVAS_SAVE_DEBOUNCE_MS)
        } else {
          skipHistory.current = false
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workspace, isEditableTarget, setTiles, setGroups])

  persistCanvasStateRef.current = persistCanvasState

  return {
    viewport,
    setViewport,
    viewportRef,
    nextZIndex,
    setNextZIndex,
    nextZIndexRef,
    prevZoomRef,
    expandedCanvasPriorViewportRef,
    persistCanvasStateRef,
    historyBack,
    historyForward,
    skipHistory,
    panVelocityRef,
    panLastPos,
    panInertiaRaf,
    screenToWorld,
    worldToScreen,
    worldToScreenRect: worldToScreenRectBound,
    viewportCenter,
    saveCanvas,
    persistCanvasState,
    computeFitViewport,
    zoomToFitArrangedTiles,
    panToTile,
    toggleZoomOne,
    resetCanvasZoom,
    cancelPanInertia,
    startPanInertia,
    findManualConnectionTarget,
    restoreViewport,
    resetViewportState,
    handleWheel,
    scheduleViewportUpdate,
  }
}

// ─── Alignment guides (canvas drag) ─────────────────────────────────────────

export const ALIGN_GUIDE_THRESH = 6

export type AlignmentGuide = { x?: number; y?: number }

export function computeAlignmentGuides(
  newX: number,
  newY: number,
  w: number,
  h: number,
  others: TileState[],
): AlignmentGuide[] {
  const newGuides: AlignmentGuide[] = []
  for (const o of others) {
    const dx_checks: [number, number][] = [
      [newX, o.x], [newX, o.x + o.width / 2 - w / 2], [newX, o.x + o.width - w],
      [newX + w / 2, o.x + o.width / 2], [newX + w, o.x], [newX + w, o.x + o.width],
    ]
    for (const [a, b] of dx_checks) {
      if (Math.abs(a - b) < ALIGN_GUIDE_THRESH) newGuides.push({ x: b })
    }
    const dy_checks: [number, number][] = [
      [newY, o.y], [newY, o.y + o.height / 2 - h / 2], [newY, o.y + o.height - h],
      [newY + h / 2, o.y + o.height / 2], [newY + h, o.y], [newY + h, o.y + o.height],
    ]
    for (const [a, b] of dy_checks) {
      if (Math.abs(a - b) < ALIGN_GUIDE_THRESH) newGuides.push({ y: b })
    }
  }
  const seen = new Set<string>()
  return newGuides.filter(g => {
    const k = g.x !== undefined ? `x:${g.x}` : `y:${g.y}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ─── Global canvas drag listeners ─────────────────────────────────────────────

export type CanvasAnchorSide = 'top' | 'right' | 'bottom' | 'left'

export type CanvasAnchorPoint = {
  side: CanvasAnchorSide
  x: number
  y: number
  gridX: number
  gridY: number
}

export type CanvasDragState =
  | { type: null }
  | { type: 'pan'; startX: number; startY: number; initTx: number; initTy: number }
  | { type: 'tile'; tileId: string; startX: number; startY: number; initX: number; initY: number; groupSnapshots: { id: string; x: number; y: number }[] }
  | { type: 'resize'; tileId: string; dir: 'e' | 's' | 'se' | 'w' | 'n' | 'nw' | 'ne' | 'sw'; startX: number; startY: number; initX: number; initY: number; initW: number; initH: number }
  | { type: 'select'; startWx: number; startWy: number; curWx: number; curWy: number }
  | { type: 'group'; groupId: string; startX: number; startY: number; snapshots: { id: string; x: number; y: number }[]; initLayoutBounds?: { x: number; y: number; w: number; h: number } }
  | { type: 'group-resize'; groupId: string; dir: 'e' | 's' | 'se' | 'w' | 'n' | 'nw' | 'ne' | 'sw'; startX: number; startY: number; initBounds: { x: number; y: number; w: number; h: number }; snapshots: { id: string; x: number; y: number; width: number; height: number }[] }
  | { type: 'connection'; sourceTileId: string; startX: number; startY: number; side: CanvasAnchorSide; anchor: CanvasAnchorPoint; current: { x: number; y: number }; targetTileId: string | null }

export type UseCanvasDragSyncOptions = {
  canvasRef: RefObject<HTMLDivElement | null>
  dragState: CanvasDragState
  setDragState: Dispatch<SetStateAction<CanvasDragState>>
  engine: Pick<
    UseCanvasEngineReturn,
    | 'viewport'
    | 'setViewport'
    | 'panVelocityRef'
    | 'panLastPos'
    | 'startPanInertia'
    | 'screenToWorld'
    | 'saveCanvas'
    | 'nextZIndex'
  >
  tilesRef: MutableRefObject<TileState[]>
  groupsRef: MutableRefObject<GroupState[]>
  groups: GroupState[]
  setTiles: Dispatch<SetStateAction<TileState[]>>
  setGroups: Dispatch<SetStateAction<GroupState[]>>
  setGuides: Dispatch<SetStateAction<AlignmentGuide[]>>
  setCanvasPointerWorld: Dispatch<SetStateAction<{ x: number; y: number } | null>>
  setSelectedTileIds: Dispatch<SetStateAction<Set<string>>>
  setSuppressedConnections: Dispatch<SetStateAction<Set<string>>>
  suppressedConnectionsRef: MutableRefObject<Set<string>>
  panelTileIdsRef: MutableRefObject<Set<string>>
  groupBoundsRef: MutableRefObject<(id: string) => { x: number; y: number; w: number; h: number } | null>
  snapValue: (value: number) => number
  resolveManualConnectionTarget: (sourceTileId: string, point: { x: number; y: number }) => string | null
  lockConnection: (tileA: string, tileB: string) => void
  triggerDiscoveryPulse: (tileId: string, tileList: TileState[]) => void
  getMinTileWidth: (tileOrType: TileState | TileState['type']) => number
  getMinTileHeight: (tileOrType: TileState | TileState['type']) => number
}

export function useCanvasDragSync(options: UseCanvasDragSyncOptions): void {
  const {
    canvasRef,
    dragState,
    setDragState,
    engine,
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
    resolveManualConnectionTarget,
    lockConnection,
    triggerDiscoveryPulse,
    getMinTileWidth,
    getMinTileHeight,
  } = options

  const { viewport, setViewport, panVelocityRef, panLastPos, startPanInertia, screenToWorld, saveCanvas, nextZIndex } = engine

  const snapGuideRafRef = useRef<number | null>(null)
  const pendingTileDragRef = useRef<{
    tileId: string
    groupSnapshots: { id: string; x: number; y: number }[]
    newX: number
    newY: number
    ddx: number
    ddy: number
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragState.type === null) return
      if (dragState.type === 'select') {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        const curWx = (e.clientX - rect.left - viewport.tx) / viewport.zoom
        const curWy = (e.clientY - rect.top - viewport.ty) / viewport.zoom
        setDragState(prev => prev.type === 'select' ? { ...prev, curWx, curWy } : prev)
        return
      }
      const dx = e.clientX - dragState.startX
      const dy = e.clientY - dragState.startY

      if (dragState.type === 'pan') {
        const now = performance.now()
        const dt = now - panLastPos.current.t
        if (dt > 0) {
          const decay = 0.4
          panVelocityRef.current = {
            vx: decay * panVelocityRef.current.vx + (1 - decay) * (e.clientX - panLastPos.current.x) / dt * 16,
            vy: decay * panVelocityRef.current.vy + (1 - decay) * (e.clientY - panLastPos.current.y) / dt * 16,
          }
        }
        panLastPos.current = { x: e.clientX, y: e.clientY, t: now }
        setViewport(prev => ({ ...prev, tx: dragState.initTx + dx, ty: dragState.initTy + dy }))
      } else if (dragState.type === 'group-resize') {
        const wdx = dx / viewport.zoom
        const wdy = dy / viewport.zoom
        const { dir, initBounds: ib, snapshots: snaps } = dragState

        let nx = ib.x, ny = ib.y, nw = ib.w, nh = ib.h
        if (dir.includes('e')) nw = Math.max(100, ib.w + wdx)
        if (dir.includes('s')) nh = Math.max(100, ib.h + wdy)
        if (dir.includes('w')) { nw = Math.max(100, ib.w - wdx); nx = ib.x + ib.w - nw }
        if (dir.includes('n')) { nh = Math.max(100, ib.h - wdy); ny = ib.y + ib.h - nh }

        const resizingGroup = groupsRef.current.find(g => g.id === dragState.groupId)
        if (resizingGroup?.layoutMode) {
          setGroups(prev => prev.map(g => g.id === dragState.groupId
            ? { ...g, layoutBounds: { x: snapValue(nx), y: snapValue(ny), w: snapValue(nw), h: snapValue(nh) } }
            : g))
        } else {
          const scaleX = nw / ib.w
          const scaleY = nh / ib.h
          setTiles(prev => prev.map(t => {
            const s = snaps.find(s2 => s2.id === t.id)
            if (!s) return t
            const minW = getMinTileWidth(t)
            const minH = getMinTileHeight(t)
            const relX = s.x - ib.x
            const relY = s.y - ib.y
            return {
              ...t,
              x: snapValue(nx + relX * scaleX),
              y: snapValue(ny + relY * scaleY),
              width: Math.max(minW, snapValue(s.width * scaleX)),
              height: Math.max(minH, snapValue(s.height * scaleY)),
            }
          }))
        }
      } else if (dragState.type === 'group') {
        const wdx = dx / viewport.zoom
        const wdy = dy / viewport.zoom
        if (dragState.initLayoutBounds) {
          const lb = dragState.initLayoutBounds
          setGroups(prev => prev.map(g => g.id === dragState.groupId ? {
            ...g,
            layoutBounds: { ...lb, x: snapValue(lb.x + wdx), y: snapValue(lb.y + wdy) },
          } : g))
        } else {
          setTiles(prev => prev.map(t => {
            const snap2 = dragState.snapshots.find(s => s.id === t.id)
            if (!snap2) return t
            return { ...t, x: snapValue(snap2.x + wdx), y: snapValue(snap2.y + wdy) }
          }))
        }
      } else if (dragState.type === 'connection') {
        const current = screenToWorld(e.clientX, e.clientY)
        const targetTileId = resolveManualConnectionTarget(dragState.sourceTileId, current)
        setCanvasPointerWorld(current)
        setDragState(prev => prev.type === 'connection' ? { ...prev, current, targetTileId } : prev)
      } else if (dragState.type === 'tile') {
        const wdx = dx / viewport.zoom
        const wdy = dy / viewport.zoom
        const newX = snapValue(dragState.initX + wdx)
        const newY = snapValue(dragState.initY + wdy)
        const ddx = newX - dragState.initX
        const ddy = newY - dragState.initY
        const dragging = tilesRef.current.find(t => t.id === dragState.tileId)
        if (!dragging) return

        pendingTileDragRef.current = {
          tileId: dragState.tileId,
          groupSnapshots: dragState.groupSnapshots,
          newX,
          newY,
          ddx,
          ddy,
          width: dragging.width,
          height: dragging.height,
        }
        if (snapGuideRafRef.current !== null) return
        snapGuideRafRef.current = requestAnimationFrame(() => {
          snapGuideRafRef.current = null
          const pending = pendingTileDragRef.current
          if (!pending) return

          const excludeIds = new Set([
            pending.tileId,
            ...pending.groupSnapshots.map(g => g.id),
          ])
          const others = tilesRef.current.filter(t => !excludeIds.has(t.id))
          setGuides(computeAlignmentGuides(
            pending.newX,
            pending.newY,
            pending.width,
            pending.height,
            others,
          ))
          setTiles(prev => prev.map(t => {
            if (t.id === pending.tileId) return { ...t, x: pending.newX, y: pending.newY }
            const snap2 = pending.groupSnapshots.find(g => g.id === t.id)
            if (snap2) {
              return {
                ...t,
                x: snapValue(snap2.x + pending.ddx),
                y: snapValue(snap2.y + pending.ddy),
              }
            }
            return t
          }))
        })
      } else if (dragState.type === 'resize') {
        const wdx = dx / viewport.zoom
        const wdy = dy / viewport.zoom
        const dir = dragState.dir
        setTiles(prev => prev.map(t => {
          if (t.id !== dragState.tileId) return t
          const minW = getMinTileWidth(t)
          const minH = getMinTileHeight(t)
          let { x, y, width: w, height: h } = t
          if (dir.includes('e')) w = Math.max(minW, snapValue(dragState.initW + wdx))
          if (dir.includes('s')) h = Math.max(minH, snapValue(dragState.initH + wdy))
          if (dir.includes('w')) { w = Math.max(minW, snapValue(dragState.initW - wdx)); x = snapValue(dragState.initX + wdx) }
          if (dir.includes('n')) { h = Math.max(minH, snapValue(dragState.initH - wdy)); y = snapValue(dragState.initY + wdy) }
          return { ...t, x, y, width: w, height: h }
        }))
      }
    }

    const flushPendingTileDrag = () => {
      if (snapGuideRafRef.current !== null) {
        cancelAnimationFrame(snapGuideRafRef.current)
        snapGuideRafRef.current = null
      }
      const pending = pendingTileDragRef.current
      if (!pending) return
      setTiles(prev => prev.map(t => {
        if (t.id === pending.tileId) return { ...t, x: pending.newX, y: pending.newY }
        const snap2 = pending.groupSnapshots.find(g => g.id === t.id)
        if (snap2) {
          return {
            ...t,
            x: snapValue(snap2.x + pending.ddx),
            y: snapValue(snap2.y + pending.ddy),
          }
        }
        return t
      }))
      pendingTileDragRef.current = null
    }

    const onUp = () => {
      if (dragState.type === 'tile') flushPendingTileDrag()
      if (dragState.type === 'connection') {
        if (dragState.targetTileId) {
          lockConnection(dragState.sourceTileId, dragState.targetTileId)
        }
      } else if (dragState.type === 'tile') {
        setTiles(prev => {
          const tile = prev.find(t => t.id === dragState.tileId)
          if (!tile) { saveCanvas(prev, viewport, nextZIndex); return prev }

          const didMove = tile.x !== dragState.initX || tile.y !== dragState.initY
          if (didMove && suppressedConnectionsRef.current.size > 0) {
            setSuppressedConnections(prev => {
              const next = new Set(prev)
              for (const key of prev) {
                if (key.includes(tile.id)) next.delete(key)
              }
              return next.size === prev.size ? prev : next
            })
          }
          if (!didMove) { saveCanvas(prev, viewport, nextZIndex); return prev }

          const tileCx = tile.x + tile.width / 2
          const tileCy = tile.y + tile.height / 2

          let newGroupId: string | undefined = tile.groupId
          for (const g of groups) {
            if (g.id === tile.groupId) continue
            const b = groupBoundsRef.current(g.id)
            if (b && tileCx >= b.x && tileCx <= b.x + b.w && tileCy >= b.y && tileCy <= b.y + b.h) {
              newGroupId = g.id
              break
            }
          }

          if (newGroupId !== tile.groupId) {
            const updated = prev.map(t => t.id === tile.id ? { ...t, groupId: newGroupId } : t)
            saveCanvas(updated, viewport, nextZIndex)
            window.setTimeout(() => triggerDiscoveryPulse(tile.id, updated), 40)
            return updated
          }
          saveCanvas(prev, viewport, nextZIndex)
          window.setTimeout(() => triggerDiscoveryPulse(tile.id, prev), 40)
          return prev
        })
      } else if (dragState.type === 'resize' || dragState.type === 'group' || dragState.type === 'group-resize') {
        setTiles(prev => { saveCanvas(prev, viewport, nextZIndex, groupsRef.current); return prev })
      }
      if (dragState.type === 'select') {
        const minX = Math.min(dragState.startWx, dragState.curWx)
        const maxX = Math.max(dragState.startWx, dragState.curWx)
        const minY = Math.min(dragState.startWy, dragState.curWy)
        const maxY = Math.max(dragState.startWy, dragState.curWy)
        const size = Math.max(maxX - minX, maxY - minY)
        if (size > 10) {
          setTiles(prev => {
            const hit = new Set(
              prev
                .filter(t => !panelTileIdsRef.current.has(t.id))
                .filter(t => t.x < maxX && t.x + t.width > minX && t.y < maxY && t.y + t.height > minY)
                .map(t => t.id),
            )
            setSelectedTileIds(hit)
            return prev
          })
        }
      }
      if (dragState.type === 'pan') startPanInertia()
      setGuides([])
      setDragState({ type: null })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (snapGuideRafRef.current !== null) {
        cancelAnimationFrame(snapGuideRafRef.current)
        snapGuideRafRef.current = null
      }
      pendingTileDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [
    canvasRef,
    dragState,
    setDragState,
    viewport,
    setViewport,
    panVelocityRef,
    panLastPos,
    startPanInertia,
    screenToWorld,
    saveCanvas,
    nextZIndex,
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
    resolveManualConnectionTarget,
    lockConnection,
    triggerDiscoveryPulse,
    getMinTileWidth,
    getMinTileHeight,
  ])
}

// ─── Canvas surface mouse handlers ───────────────────────────────────────────

export type UseCanvasPointerHandlersOptions = {
  canvasRef: RefObject<HTMLDivElement | null>
  viewport: CanvasViewport
  setDragState: Dispatch<SetStateAction<CanvasDragState>>
  setSelectedTileId: Dispatch<SetStateAction<string | null>>
  setSelectedTileIds: Dispatch<SetStateAction<Set<string>>>
  panLastPos: MutableRefObject<{ x: number; y: number; t: number }>
  cancelPanInertia: () => void
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  spaceHeld: MutableRefObject<boolean>
  bringToFront: (id: string) => void
  getConnectionHandlePoint: (tile: TileState, side: CanvasAnchorSide) => CanvasAnchorPoint
  panelLayout: PanelNode | null
  addTile: (type: TileState['type'], filePath?: string, pos?: { x: number; y: number }) => string
}

export function useCanvasPointerHandlers(options: UseCanvasPointerHandlersOptions) {
  const {
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
    getConnectionHandlePoint,
    panelLayout,
    addTile,
  } = options

  const handleCanvasMouseDown = useCallback((e: ReactMouseEvent) => {
    const t = e.target as HTMLElement
    if (t.closest('[data-tile-chrome]')) return
    e.preventDefault()
    const isPan = e.button === 1 || (e.button === 0 && (e.metaKey || spaceHeld.current))
    if (isPan) {
      cancelPanInertia()
      panLastPos.current = { x: e.clientX, y: e.clientY, t: performance.now() }
      setDragState({ type: 'pan', startX: e.clientX, startY: e.clientY, initTx: viewport.tx, initTy: viewport.ty })
      setSelectedTileId(null)
      return
    }
    if (e.button === 0) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const wx = (e.clientX - rect.left - viewport.tx) / viewport.zoom
      const wy = (e.clientY - rect.top - viewport.ty) / viewport.zoom
      setDragState({ type: 'select', startWx: wx, startWy: wy, curWx: wx, curWy: wy })
      setSelectedTileIds(new Set())
      setSelectedTileId(null)
    }
  }, [canvasRef, viewport, setDragState, setSelectedTileId, setSelectedTileIds, panLastPos, cancelPanInertia, spaceHeld])

  const handleConnectionMouseDown = useCallback((
    e: ReactMouseEvent,
    tile: TileState,
    side: CanvasAnchorSide,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    bringToFront(tile.id)
    const anchor = getConnectionHandlePoint(tile, side)
    setDragState({
      type: 'connection',
      sourceTileId: tile.id,
      startX: e.clientX,
      startY: e.clientY,
      side,
      anchor,
      current: screenToWorld(e.clientX, e.clientY),
      targetTileId: null,
    })
  }, [bringToFront, getConnectionHandlePoint, screenToWorld, setDragState])

  const handleResizeMouseDown = useCallback((
    e: ReactMouseEvent,
    tile: TileState,
    dir: 'e' | 's' | 'se' | 'w' | 'n' | 'nw' | 'ne' | 'sw',
  ) => {
    e.stopPropagation()
    e.preventDefault()
    setDragState({
      type: 'resize',
      tileId: tile.id,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      initX: tile.x,
      initY: tile.y,
      initW: tile.width,
      initH: tile.height,
    })
  }, [setDragState])

  const handleCanvasDoubleClick = useCallback((e: ReactMouseEvent) => {
    if (panelLayout) return
    if (e.target !== e.currentTarget) return
    const world = screenToWorld(e.clientX, e.clientY)
    addTile('terminal', undefined, world)
  }, [panelLayout, screenToWorld, addTile])

  const handleTileMouseDown = useCallback((e: ReactMouseEvent, tile: TileState) => {
    e.stopPropagation()
    bringToFront(tile.id)
    setDragState({
      type: 'tile',
      tileId: tile.id,
      startX: e.clientX,
      startY: e.clientY,
      initX: tile.x,
      initY: tile.y,
      groupSnapshots: [],
    })
  }, [bringToFront, setDragState])

  return {
    handleCanvasMouseDown,
    handleConnectionMouseDown,
    handleResizeMouseDown,
    handleCanvasDoubleClick,
    handleTileMouseDown,
  }
}

export type UseConnectionHandleHoverOptions = {
  setHoveredConnectionHandle: Dispatch<SetStateAction<{ tileId: string; side: CanvasAnchorSide } | null>>
}

export function useConnectionHandleHover(options: UseConnectionHandleHoverOptions) {
  const { setHoveredConnectionHandle } = options
  const connectionHandleHideTimerRef = useRef<number | null>(null)

  const showConnectionHandleForSide = useCallback((tileId: string, side: CanvasAnchorSide) => {
    if (connectionHandleHideTimerRef.current !== null) {
      window.clearTimeout(connectionHandleHideTimerRef.current)
      connectionHandleHideTimerRef.current = null
    }
    setHoveredConnectionHandle({ tileId, side })
  }, [setHoveredConnectionHandle])

  const scheduleConnectionHandleHide = useCallback((tileId: string, side: CanvasAnchorSide) => {
    if (connectionHandleHideTimerRef.current !== null) {
      window.clearTimeout(connectionHandleHideTimerRef.current)
    }
    connectionHandleHideTimerRef.current = window.setTimeout(() => {
      connectionHandleHideTimerRef.current = null
      setHoveredConnectionHandle(prev => prev?.tileId === tileId && prev.side === side ? null : prev)
    }, 140)
  }, [setHoveredConnectionHandle])

  useEffect(() => () => {
    if (connectionHandleHideTimerRef.current !== null) {
      window.clearTimeout(connectionHandleHideTimerRef.current)
      connectionHandleHideTimerRef.current = null
    }
  }, [])

  return { showConnectionHandleForSide, scheduleConnectionHandleHide }
}

export type CanvasContextMenuItem = {
  label: string
  action: () => void
  divider?: boolean
  danger?: boolean
}

export type UseCanvasContextMenuOptions = {
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  panelLayout: PanelNode | null
  groups: GroupState[]
  groupBoundsRef: MutableRefObject<(id: string) => { x: number; y: number; w: number; h: number } | null>
  addTile: (type: TileState['type'], filePath?: string, pos?: { x: number; y: number }) => string
  pinnedCanvasExtensionTiles: Array<{ type: string; label: string }>
  clipboardRef: MutableRefObject<TileState[]>
  pasteAt: (pos: { x: number; y: number }, groupId?: string) => void
  selectedTileIds: Set<string>
  groupSelectedTiles: () => void
  setCtxMenu: Dispatch<SetStateAction<{ x: number; y: number; items: CanvasContextMenuItem[] } | null>>
}

export function useCanvasContextMenu(options: UseCanvasContextMenuOptions) {
  const {
    screenToWorld,
    panelLayout,
    groups,
    groupBoundsRef,
    addTile,
    pinnedCanvasExtensionTiles,
    clipboardRef,
    pasteAt,
    selectedTileIds,
    groupSelectedTiles,
    setCtxMenu,
  } = options

  return useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    if (panelLayout) return
    const world = screenToWorld(e.clientX, e.clientY)
    const hitGroup = groups.find(g => {
      const b = groupBoundsRef.current(g.id)
      return b && world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h
    })
    const items: CanvasContextMenuItem[] = [
      { label: 'New Terminal', action: () => addTile('terminal', undefined, world) },
      { label: 'New Note', action: () => addTile('note', undefined, world) },
      { label: 'New Browser', action: () => addTile('browser', undefined, world) },
      { label: 'New Board', action: () => addTile('kanban', undefined, world) },
    ]
    if (pinnedCanvasExtensionTiles.length > 0) {
      items.push({ label: '', action: () => {}, divider: true })
      for (const ext of pinnedCanvasExtensionTiles) {
        items.push({
          label: ext.label,
          action: () => addTile(ext.type as TileState['type'], undefined, world),
        })
      }
    }
    if (clipboardRef.current.length > 0) {
      items.push({ label: '', action: () => {}, divider: true })
      items.push({ label: 'Paste', action: () => pasteAt(world) })
      if (hitGroup) {
        items.push({ label: 'Paste into group', action: () => pasteAt(world, hitGroup.id) })
      }
    }
    if (selectedTileIds.size >= 2) {
      items.push({ label: '', action: () => {}, divider: true })
      items.push({ label: `Group ${selectedTileIds.size} blocks`, action: () => groupSelectedTiles() })
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }, [
    screenToWorld,
    panelLayout,
    groups,
    groupBoundsRef,
    addTile,
    pinnedCanvasExtensionTiles,
    clipboardRef,
    pasteAt,
    selectedTileIds,
    groupSelectedTiles,
    setCtxMenu,
  ])
}

export type UseTileContextMenuOptions = {
  viewport: CanvasViewport
  nextZIndex: number
  groups: GroupState[]
  workspacePath: string | null | undefined
  saveCanvas: SaveCanvasFn
  setTiles: Dispatch<SetStateAction<TileState[]>>
  setSelectedTileId: Dispatch<SetStateAction<string | null>>
  setSelectedTileIds: Dispatch<SetStateAction<Set<string>>>
  setCtxMenu: Dispatch<SetStateAction<{ x: number; y: number; items: CanvasContextMenuItem[] } | null>>
  clipboardRef: MutableRefObject<TileState[]>
  duplicateTiles: (ids: string[]) => void
  copyTiles: (cut: boolean) => void
  pasteTiles: (pos?: { x: number; y: number }, groupId?: string) => void
  ungroupTiles: (groupId: string) => void
  ungroupAll: (groupId: string) => void
  closeTile: (id: string) => void
  importFileToWorkspace: (filePath: string, tileId: string) => void | Promise<unknown>
}

export function useTileContextMenu(options: UseTileContextMenuOptions) {
  const {
    viewport,
    nextZIndex,
    groups,
    workspacePath,
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
  } = options

  return useCallback((e: ReactMouseEvent, tile: TileState) => {
    e.preventDefault()
    e.stopPropagation()
    const items: CanvasContextMenuItem[] = [
      { label: 'Duplicate', action: () => duplicateTiles([tile.id]) },
      { label: 'Copy', action: () => { setSelectedTileId(tile.id); setSelectedTileIds(new Set()); copyTiles(false) } },
      { label: 'Cut', action: () => { setSelectedTileId(tile.id); setSelectedTileIds(new Set()); copyTiles(true) } },
    ]
    if (clipboardRef.current.length > 0) {
      items.push({ label: '', action: () => {}, divider: true })
      items.push({ label: 'Paste', action: () => pasteTiles() })
      if (tile.groupId) {
        items.push({ label: 'Paste into this group', action: () => pasteTiles(undefined, tile.groupId) })
      }
    }
    items.push({ label: '', action: () => {}, divider: true })
    if (tile.groupId) {
      items.push({ label: 'Remove from group', action: () => {
        setTiles(prev => {
          const updated = prev.map(t => t.id === tile.id ? { ...t, groupId: undefined } : t)
          saveCanvas(updated, viewport, nextZIndex)
          return updated
        })
      } })
      items.push({ label: 'Ungroup', action: () => ungroupTiles(tile.groupId!) })
      items.push({ label: 'Ungroup All', action: () => ungroupAll(tile.groupId!) })
      items.push({ label: '', action: () => {}, divider: true })
    }
    const availableGroups = groups.filter(g => g.id !== tile.groupId)
    if (availableGroups.length > 0) {
      availableGroups.forEach(g => {
        items.push({
          label: `Add to ${g.label ?? g.id.slice(-6)}`,
          action: () => {
            setTiles(prev => {
              const updated = prev.map(t => t.id === tile.id ? { ...t, groupId: g.id } : t)
              saveCanvas(updated, viewport, nextZIndex)
              return updated
            })
          },
        })
      })
      items.push({ label: '', action: () => {}, divider: true })
    }
    if (tile.type === 'file' && tile.filePath && workspacePath && !tile.filePath.startsWith(workspacePath)) {
      items.push({
        label: 'Add to workspace',
        action: () => { void importFileToWorkspace(tile.filePath!, tile.id) },
      })
      items.push({ label: '', action: () => {}, divider: true })
    }
    const currentlyChromeless = !!tile.hideTitlebar || !!tile.hideNavbar
    items.push({
      label: currentlyChromeless ? 'Show Controls' : 'Hide Controls',
      action: () => {
        setTiles(prev => {
          const updated = prev.map(t => t.id === tile.id
            ? { ...t, hideTitlebar: !currentlyChromeless, hideNavbar: !currentlyChromeless }
            : t)
          saveCanvas(updated, viewport, nextZIndex)
          return updated
        })
      },
    })
    items.push({ label: '', action: () => {}, divider: true })
    items.push({ label: 'Close', action: () => closeTile(tile.id), danger: true })
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }, [
    viewport,
    nextZIndex,
    groups,
    workspacePath,
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
  ])
}

export type UseCanvasExpandedGroupOptions = {
  canvasRef: RefObject<HTMLDivElement | null>
  viewportRef: MutableRefObject<CanvasViewport>
  expandedCanvasPriorViewportRef: MutableRefObject<CanvasViewport | null>
  expandedCanvasGroupIdRef: MutableRefObject<string | null>
  groupsRef: MutableRefObject<GroupState[]>
  setViewport: Dispatch<SetStateAction<CanvasViewport>>
  setExpandedCanvasGroupId: Dispatch<SetStateAction<string | null>>
  setExpandedTileId: Dispatch<SetStateAction<string | null>>
  groupBounds: (groupId: string) => { x: number; y: number; w: number; h: number } | null
}

export function useCanvasExpandedGroup(options: UseCanvasExpandedGroupOptions) {
  const {
    canvasRef,
    viewportRef,
    expandedCanvasPriorViewportRef,
    expandedCanvasGroupIdRef,
    groupsRef,
    setViewport,
    setExpandedCanvasGroupId,
    setExpandedTileId,
    groupBounds,
  } = options

  const enterCanvasExpanded = useCallback((groupId: string) => {
    const g = groupsRef.current.find(gr => gr.id === groupId)
    if (!g || g.layoutMode) return
    const bounds = groupBounds(groupId)
    if (!bounds) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    expandedCanvasPriorViewportRef.current = { ...viewportRef.current }
    const fit = computeFitViewport(bounds, { w: rect.width, h: rect.height })
    setViewport(fit)
    viewportRef.current = fit
    setExpandedCanvasGroupId(groupId)
    expandedCanvasGroupIdRef.current = groupId
    setExpandedTileId(null)
  }, [
    canvasRef,
    viewportRef,
    expandedCanvasPriorViewportRef,
    expandedCanvasGroupIdRef,
    groupsRef,
    setViewport,
    setExpandedCanvasGroupId,
    setExpandedTileId,
    groupBounds,
  ])

  const exitCanvasExpanded = useCallback(() => {
    const prior = expandedCanvasPriorViewportRef.current
    setExpandedCanvasGroupId(null)
    expandedCanvasGroupIdRef.current = null
    if (prior) {
      setViewport(prior)
      viewportRef.current = prior
    }
    expandedCanvasPriorViewportRef.current = null
  }, [
    expandedCanvasPriorViewportRef,
    expandedCanvasGroupIdRef,
    setViewport,
    viewportRef,
    setExpandedCanvasGroupId,
  ])

  return { enterCanvasExpanded, exitCanvasExpanded }
}

export type UseLockConnectionOptions = {
  persistCanvasState: PersistCanvasStateFn
  tilesRef: MutableRefObject<TileState[]>
  groupsRef: MutableRefObject<GroupState[]>
  viewportRef: MutableRefObject<CanvasViewport>
  nextZIndexRef: MutableRefObject<number>
  lockedConnectionsRef: MutableRefObject<Array<{ sourceTileId: string; targetTileId: string }>>
  setLockedConnections: Dispatch<SetStateAction<Array<{ sourceTileId: string; targetTileId: string }>>>
  setSuppressedConnections: Dispatch<SetStateAction<Set<string>>>
}

export function useLockConnection(options: UseLockConnectionOptions) {
  const {
    persistCanvasState,
    tilesRef,
    groupsRef,
    viewportRef,
    nextZIndexRef,
    lockedConnectionsRef,
    setLockedConnections,
    setSuppressedConnections,
  } = options

  return useCallback((tileA: string, tileB: string) => {
    const [a, b] = [tileA, tileB].sort()
    if (a === b) return
    setSuppressedConnections(prev => {
      const next = new Set(prev)
      next.delete(`${a}::${b}`)
      return next
    })
    setLockedConnections(prev => {
      const alreadyLocked = prev.some(lc => {
        const [la, lb] = [lc.sourceTileId, lc.targetTileId].sort()
        return la === a && lb === b
      })
      if (alreadyLocked) return prev
      const next = [...prev, { sourceTileId: a, targetTileId: b }]
      lockedConnectionsRef.current = next
      setTimeout(() => persistCanvasState(tilesRef.current, viewportRef.current, nextZIndexRef.current, groupsRef.current), 0)
      return next
    })
  }, [
    persistCanvasState,
    tilesRef,
    groupsRef,
    viewportRef,
    nextZIndexRef,
    lockedConnectionsRef,
    setLockedConnections,
    setSuppressedConnections,
  ])
}

export type UseEnforceTileMinimumSizesOptions = {
  tiles: TileState[]
  viewport: CanvasViewport
  nextZIndex: number
  saveCanvas: SaveCanvasFn
  setTiles: Dispatch<SetStateAction<TileState[]>>
  getMinTileWidth: (tileOrType: TileState | TileState['type']) => number
  getMinTileHeight: (tileOrType: TileState | TileState['type']) => number
}

export function useEnforceTileMinimumSizes(options: UseEnforceTileMinimumSizesOptions): void {
  const { tiles, viewport, nextZIndex, saveCanvas, setTiles, getMinTileWidth, getMinTileHeight } = options

  useEffect(() => {
    if (!tiles.some(tile => tile.width < getMinTileWidth(tile) || tile.height < getMinTileHeight(tile))) return
    setTiles(prev => {
      let changed = false
      const updated = prev.map(tile => {
        const minW = getMinTileWidth(tile)
        const minH = getMinTileHeight(tile)
        if (tile.width >= minW && tile.height >= minH) return tile
        changed = true
        return {
          ...tile,
          width: Math.max(tile.width, minW),
          height: Math.max(tile.height, minH),
        }
      })
      if (!changed) return prev
      saveCanvas(updated, viewport, nextZIndex)
      return updated
    })
  }, [tiles, viewport, nextZIndex, saveCanvas, setTiles, getMinTileWidth, getMinTileHeight])
}

export type UseLockedConnectionHelpersOptions = {
  lockedConnections: Array<{ sourceTileId: string; targetTileId: string }>
  persistCanvasState: PersistCanvasStateFn
  tilesRef: MutableRefObject<TileState[]>
  groupsRef: MutableRefObject<GroupState[]>
  viewportRef: MutableRefObject<CanvasViewport>
  nextZIndexRef: MutableRefObject<number>
  lockedConnectionsRef: MutableRefObject<Array<{ sourceTileId: string; targetTileId: string }>>
  setLockedConnections: Dispatch<SetStateAction<Array<{ sourceTileId: string; targetTileId: string }>>>
  setSuppressedConnections: Dispatch<SetStateAction<Set<string>>>
}

export function useLockedConnectionHelpers(options: UseLockedConnectionHelpersOptions) {
  const {
    lockedConnections,
    persistCanvasState,
    tilesRef,
    groupsRef,
    viewportRef,
    nextZIndexRef,
    lockedConnectionsRef,
    setLockedConnections,
    setSuppressedConnections,
  } = options

  const isConnectionLocked = useCallback((tileA: string, tileB: string) => {
    const [a, b] = [tileA, tileB].sort()
    return lockedConnections.some(lc => {
      const [la, lb] = [lc.sourceTileId, lc.targetTileId].sort()
      return la === a && lb === b
    })
  }, [lockedConnections])

  const toggleConnectionLock = useCallback((tileA: string, tileB: string) => {
    const [a, b] = [tileA, tileB].sort()
    setLockedConnections(prev => {
      const idx = prev.findIndex(lc => {
        const [la, lb] = [lc.sourceTileId, lc.targetTileId].sort()
        return la === a && lb === b
      })
      const next = idx >= 0
        ? prev.filter((_, i) => i !== idx)
        : [...prev, { sourceTileId: a, targetTileId: b }]
      lockedConnectionsRef.current = next
      console.log('[Lock]', idx >= 0 ? 'Unlocked' : 'Locked', a, b, 'total:', next.length)
      setTimeout(() => persistCanvasState(tilesRef.current, viewportRef.current, nextZIndexRef.current, groupsRef.current), 0)
      return next
    })
  }, [persistCanvasState, tilesRef, groupsRef, viewportRef, nextZIndexRef, lockedConnectionsRef, setLockedConnections])

  const deleteConnection = useCallback((tileA: string, tileB: string) => {
    const [a, b] = [tileA, tileB].sort()
    const key = `${a}::${b}`
    setLockedConnections(prev => {
      const next = prev.filter(lc => {
        const [la, lb] = [lc.sourceTileId, lc.targetTileId].sort()
        return !(la === a && lb === b)
      })
      lockedConnectionsRef.current = next
      setTimeout(() => persistCanvasState(tilesRef.current, viewportRef.current, nextZIndexRef.current, groupsRef.current), 0)
      return next
    })
    setSuppressedConnections(prev => new Set(prev).add(key))
  }, [persistCanvasState, tilesRef, groupsRef, viewportRef, nextZIndexRef, lockedConnectionsRef, setLockedConnections, setSuppressedConnections])

  return { isConnectionLocked, toggleConnectionLock, deleteConnection }
}