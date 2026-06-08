import { useMemo } from 'react'
import type { TileState } from '../../../shared/types'
import type { AppCanvasConnectionsProps } from '../components/AppCanvasConnections'
import type { PanelCornerRadii, AppCanvasPanelRegionProps } from '../components/AppCanvasPanelRegion'
import type { CanvasDragState } from './useCanvasEngine'
import type {
  AmbientDiscoveryRenderRoute,
  ManualConnectionRenderRoute,
} from './useNegotiatedDiscovery'
import type { DiscoveryPreviewState } from '../components/AppCanvasConnections'
import type { DiscoveryPulse } from '../lib/discoveryRuntime'
import type { PanelNode } from '../components/panelLayoutTree'
import type { AppTheme } from '../theme'
import type { RenderTileBodyOptions } from './useRenderTileBody'
import type { LayoutTemplate } from '../../../shared/types'

type DiscoveryShellColors = { line: string, dot: string, bg: string, text: string }

export type UseAppCanvasConnectionPropsParams = {
  panelLayout: PanelNode | null
  manualConnectionRenderRoutes: ManualConnectionRenderRoute[]
  ambientDiscoveryRenderRoutes: AmbientDiscoveryRenderRoute[]
  discoveryPreview: DiscoveryPreviewState
  discoveryFocusTileId: string | null
  lockedConnectionKeys: Set<string>
  discoveryPulses: DiscoveryPulse[]
  dragState: CanvasDragState
  viewportZoom: number
  gridSize: number | undefined
  gridSpacingSmall: number | undefined
  dsc: DiscoveryShellColors
  tileByIdMap: Map<string, TileState>
  discoveryPillZIndex: number
  discoveryHighlightZIndex: number
  discoveryGlowZIndex: number
  canvasGlowEnabled: boolean
  discoveryGlowRef: React.RefObject<HTMLDivElement | null>
  worldToScreenPoint: (point: { x: number, y: number }) => { x: number, y: number }
  isConnectionLocked: (tileIdA: string, tileIdB: string) => boolean
  toggleConnectionLock: (tileIdA: string, tileIdB: string) => void
  deleteConnection: (tileIdA: string, tileIdB: string) => void
}

export type UseAppCanvasPanelRegionPropsParams = {
  panelLayout: PanelNode | null
  mainPanelCornerRadii: PanelCornerRadii
  tiles: TileState[]
  theme: AppTheme
  activePanelId: string | null
  nextZIndex: number
  getPanelTileLabel: (tileId: string) => string
  getPanelTileIcon: (tileId: string) => string | undefined
  renderTileBody: (tile: TileState, options?: RenderTileBodyOptions) => React.ReactNode
  viewportCenter: () => { x: number, y: number }
  getInitialTileSize: (type: TileState['type']) => { w: number, h: number }
  snapValue: (value: number) => number
  setPanelLayout: React.Dispatch<React.SetStateAction<PanelNode | null>>
  closeTile: (tileId: string) => void
  addTile: (type: TileState['type'], filePath?: string, world?: { x: number, y: number }) => string
  exitExpandedMode: () => void
  setActivePanelId: React.Dispatch<React.SetStateAction<string | null>>
  handleLaunchTemplate: (template: LayoutTemplate) => void | Promise<void>
  setTiles: React.Dispatch<React.SetStateAction<TileState[]>>
  setNextZIndex: React.Dispatch<React.SetStateAction<number>>
}

export function useAppCanvasConnectionProps(params: UseAppCanvasConnectionPropsParams): Omit<AppCanvasConnectionsProps, 'layer'> {
  const {
    panelLayout,
    manualConnectionRenderRoutes,
    ambientDiscoveryRenderRoutes,
    discoveryPreview,
    discoveryFocusTileId,
    lockedConnectionKeys,
    discoveryPulses,
    dragState,
    viewportZoom,
    gridSize,
    gridSpacingSmall,
    dsc,
    tileByIdMap,
    discoveryPillZIndex,
    discoveryHighlightZIndex,
    discoveryGlowZIndex,
    canvasGlowEnabled,
    discoveryGlowRef,
    worldToScreenPoint,
    isConnectionLocked,
    toggleConnectionLock,
    deleteConnection,
  } = params

  return useMemo(() => ({
    panelLayout,
    manualConnectionRenderRoutes,
    ambientDiscoveryRenderRoutes,
    discoveryPreview,
    discoveryFocusTileId,
    lockedConnectionKeys,
    discoveryPulses,
    dragState,
    viewportZoom,
    gridSize,
    gridSpacingSmall,
    dsc,
    tileByIdMap,
    discoveryPillZIndex,
    discoveryHighlightZIndex,
    discoveryGlowZIndex,
    canvasGlowEnabled,
    discoveryGlowRef,
    worldToScreenPoint,
    isConnectionLocked,
    onToggleConnectionLock: toggleConnectionLock,
    onDeleteConnection: deleteConnection,
  }), [
    panelLayout,
    manualConnectionRenderRoutes,
    ambientDiscoveryRenderRoutes,
    discoveryPreview,
    discoveryFocusTileId,
    lockedConnectionKeys,
    discoveryPulses,
    dragState,
    viewportZoom,
    gridSize,
    gridSpacingSmall,
    dsc,
    tileByIdMap,
    discoveryPillZIndex,
    discoveryHighlightZIndex,
    discoveryGlowZIndex,
    canvasGlowEnabled,
    worldToScreenPoint,
    isConnectionLocked,
    toggleConnectionLock,
    deleteConnection,
  ])
}

export function useAppCanvasPanelRegionProps(params: UseAppCanvasPanelRegionPropsParams): AppCanvasPanelRegionProps {
  const {
    panelLayout,
    mainPanelCornerRadii,
    tiles,
    theme,
    activePanelId,
    nextZIndex,
    getPanelTileLabel,
    getPanelTileIcon,
    renderTileBody,
    viewportCenter,
    getInitialTileSize,
    snapValue,
    setPanelLayout,
    closeTile,
    addTile,
    exitExpandedMode,
    setActivePanelId,
    handleLaunchTemplate,
    setTiles,
    setNextZIndex,
  } = params

  return useMemo(() => ({
    panelLayout,
    mainPanelCornerRadii,
    tiles,
    theme,
    activePanelId,
    nextZIndex,
    getPanelTileLabel,
    getPanelTileIcon,
    renderTileBody,
    viewportCenter,
    getInitialTileSize,
    snapValue,
    onLayoutChange: setPanelLayout,
    onCloseTab: closeTile,
    onAddTile: addTile,
    onExitExpandedMode: exitExpandedMode,
    onActivePanelChange: setActivePanelId,
    onLaunchTemplate: handleLaunchTemplate,
    setTiles,
    setNextZIndex,
  }), [
    panelLayout,
    mainPanelCornerRadii,
    tiles,
    theme,
    activePanelId,
    nextZIndex,
    getPanelTileLabel,
    getPanelTileIcon,
    renderTileBody,
    viewportCenter,
    getInitialTileSize,
    snapValue,
    setPanelLayout,
    closeTile,
    addTile,
    exitExpandedMode,
    setActivePanelId,
    handleLaunchTemplate,
    setTiles,
    setNextZIndex,
  ])
}