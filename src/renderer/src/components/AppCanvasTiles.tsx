import React, { Suspense } from 'react'
import { Link2 } from 'lucide-react'
import type { TileState } from '../../../shared/types'
import { TileColorProvider } from '../TileColorContext'
import type { AppTheme } from '../theme'
import type { CanvasDragState } from '../hooks/useCanvasEngine'
import type { NegotiatedDiscoveryState } from '../hooks/useNegotiatedDiscovery'
import type { RenderTileBodyOptions } from '../hooks/useRenderTileBody'
import type { AnchorPoint } from '../lib/discoveryRuntime'
import {
  getConnectionHandlePoint,
  getNearestTileSide,
  getTileCenter,
} from '../lib/connectionRoutes'

const LazyTileChrome = React.lazy(() => import('./TileChrome').then(m => ({ default: m.TileChrome })))
const LazyStickyColorPicker = React.lazy(() => import('./NoteTile').then(m => ({ default: m.StickyColorPicker })))

type ResizeDir = 'e' | 's' | 'se' | 'w' | 'n' | 'nw' | 'ne' | 'sw'

export type ExpandedCanvasMembership = {
  tileIds: Set<string>
  groupIds: Set<string>
}

export type AppCanvasTilesProps = {
  tiles: TileState[]
  panelTileIds: Set<string>
  expandedCanvasMembership: ExpandedCanvasMembership | null
  dragState: CanvasDragState
  viewport: { tx: number, ty: number, zoom: number }
  canvasPointerWorld: { x: number, y: number } | null
  theme: AppTheme
  dsc: { line: string, dot: string, bg: string, text: string }
  workspaceId?: string
  workspaceDir?: string
  selectedTileId: string | null
  selectedTileIds: Set<string>
  negotiatedDiscoveryState: NegotiatedDiscoveryState
  onCloseTile: (tileId: string) => void
  onBringToFront: (tileId: string) => void
  onTitlebarMouseDown: (event: React.MouseEvent, tile: TileState) => void
  onResizeMouseDown: (event: React.MouseEvent, tile: TileState, dir: ResizeDir) => void
  onContextMenu: (event: React.MouseEvent, tile: TileState) => void
  onEnterExpandedMode: (tileId: string) => void
  onExitExpandedMode: () => void
  onConnectionMouseDown: (event: React.MouseEvent, tile: TileState, side: AnchorPoint['side']) => void
  showConnectionHandleForSide: (tileId: string, side: AnchorPoint['side']) => void
  scheduleConnectionHandleHide: (tileId: string, side: AnchorPoint['side']) => void
  hoveredConnectionHandle: { tileId: string, side: AnchorPoint['side'] } | null
  setCanvasPointerWorld: React.Dispatch<React.SetStateAction<{ x: number, y: number } | null>>
  screenToWorld: (clientX: number, clientY: number) => { x: number, y: number }
  renderTileBody: (tile: TileState, options?: RenderTileBodyOptions) => React.ReactNode
}

export function filterVisibleCanvasTiles(
  tiles: TileState[],
  panelTileIds: Set<string>,
  expandedCanvasMembership: ExpandedCanvasMembership | null,
): TileState[] {
  return tiles
    .filter(tile => !panelTileIds.has(tile.id))
    .filter(tile => !expandedCanvasMembership || expandedCanvasMembership.tileIds.has(tile.id))
}

export function AppCanvasTiles(props: AppCanvasTilesProps): JSX.Element {
  const {
    tiles,
    panelTileIds,
    expandedCanvasMembership,
    dragState,
    viewport,
    canvasPointerWorld,
    theme,
    dsc,
    workspaceId,
    workspaceDir,
    selectedTileId,
    selectedTileIds,
    negotiatedDiscoveryState,
    onCloseTile,
    onBringToFront,
    onTitlebarMouseDown,
    onResizeMouseDown,
    onContextMenu,
    onEnterExpandedMode,
    onExitExpandedMode,
    onConnectionMouseDown,
    showConnectionHandleForSide,
    scheduleConnectionHandleHide,
    hoveredConnectionHandle,
    setCanvasPointerWorld,
    screenToWorld,
    renderTileBody,
  } = props

  const visibleTiles = filterVisibleCanvasTiles(tiles, panelTileIds, expandedCanvasMembership)

  return (
    <>
      {visibleTiles.map(tile => {
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
                  workspaceId={workspaceId}
                  workspaceDir={workspaceDir}
                  onClose={() => onCloseTile(tile.id)}
                  onActivate={() => onBringToFront(tile.id)}
                  onTitlebarMouseDown={e => onTitlebarMouseDown(e, tile)}
                  onResizeMouseDown={(e, dir) => onResizeMouseDown(e, tile, dir)}
                  onContextMenu={e => onContextMenu(e, tile)}
                  isSelected={tile.id === selectedTileId || selectedTileIds.has(tile.id)}
                  allowOverflow={tile.type === 'image' && (tile.id === selectedTileId || selectedTileIds.has(tile.id))}
                  forceExpanded={panelTileIds.has(tile.id)}
                  onExpandChange={expanded => expanded ? onEnterExpandedMode(tile.id) : onExitExpandedMode()}
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
                onMouseDown={e => onConnectionMouseDown(e, tile, activeHandleSide)}
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
    </>
  )
}