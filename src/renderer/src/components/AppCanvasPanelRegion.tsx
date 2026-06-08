import React, { Suspense } from 'react'
import type { LayoutTemplate, TileState } from '../../../shared/types'
import type { AppTheme } from '../theme'
import type { RenderTileBodyOptions } from '../hooks/useRenderTileBody'
import {
  closeOthersInLeaf,
  closeToRightInLeaf,
  splitLeaf,
  type PanelNode,
} from './panelLayoutTree'

const LazyPanelLayout = React.lazy(() => import('./PanelLayout').then(m => ({ default: m.PanelLayout })))

export type PanelCornerRadii = {
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}

export type AppCanvasPanelRegionProps = {
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
  onLayoutChange: React.Dispatch<React.SetStateAction<PanelNode | null>>
  onCloseTab: (tileId: string) => void
  onAddTile: (type: TileState['type'], filePath?: string, world?: { x: number, y: number }) => string
  onExitExpandedMode: () => void
  onActivePanelChange: (panelId: string | null) => void
  onLaunchTemplate: (template: LayoutTemplate) => void | Promise<void>
  setTiles: React.Dispatch<React.SetStateAction<TileState[]>>
  setNextZIndex: React.Dispatch<React.SetStateAction<number>>
}

export function AppCanvasPanelRegion(props: AppCanvasPanelRegionProps): JSX.Element | null {
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
    onLayoutChange,
    onCloseTab,
    onAddTile,
    onExitExpandedMode,
    onActivePanelChange,
    onLaunchTemplate,
    setTiles,
    setNextZIndex,
  } = props

  if (!panelLayout) return null

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 50,
    }}
    >
      <Suspense fallback={null}>
        <LazyPanelLayout
          root={panelLayout}
          insetBottom={0}
          outerRadii={mainPanelCornerRadii}
          getTileLabel={getPanelTileLabel}
          renderTile={(tileId) => {
            const tile = tiles.find(entry => entry.id === tileId)
            if (!tile) return null
            return (
              <div style={{ width: '100%', height: '100%', background: theme.surface.panel }}>
                <Suspense fallback={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text.muted, fontSize: 12, background: theme.surface.panel }}>Loading block…</div>}>
                  {renderTileBody(tile)}
                </Suspense>
              </div>
            )
          }}
          onLayoutChange={onLayoutChange}
          onCloseTab={onCloseTab}
          onAddTile={type => onAddTile(type as TileState['type'])}
          onExit={onExitExpandedMode}
          activePanelId={activePanelId}
          onActivePanelChange={onActivePanelChange}
          getTileType={tileId => tiles.find(tile => tile.id === tileId)?.type ?? 'note'}
          getTileIcon={getPanelTileIcon}
          onSplitNew={(panelId, tileType, zone) => {
            const center = viewportCenter()
            const { w, h } = getInitialTileSize(tileType as TileState['type'])
            const newTile: TileState = {
              id: `tile-${Date.now()}`,
              type: tileType as TileState['type'],
              x: snapValue(center.x - w / 2),
              y: snapValue(center.y - h / 2),
              width: w,
              height: h,
              zIndex: nextZIndex,
            }
            setTiles(prev => [...prev, newTile])
            setNextZIndex(prev => prev + 1)
            onLayoutChange(prev => prev ? splitLeaf(prev, panelId, newTile.id, zone) : prev)
          }}
          onCloseOthers={(panelId, tileId) => {
            onLayoutChange(prev => prev ? closeOthersInLeaf(prev, panelId, tileId) : prev)
          }}
          onCloseToRight={(panelId, tileId) => {
            onLayoutChange(prev => prev ? closeToRightInLeaf(prev, panelId, tileId) : prev)
          }}
          onLaunchTemplate={onLaunchTemplate}
        />
      </Suspense>
    </div>
  )
}