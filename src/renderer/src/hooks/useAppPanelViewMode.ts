import { useCallback, useEffect, type MutableRefObject, type RefObject } from 'react'
import type { GroupState, TileState } from '../../../shared/types'
import { panelTreeHasSplit } from '../lib/layoutSnap'
import {
  addTabToLeaf,
  createLeaf,
  getAllTileIds,
  removeTileFromTree,
  type PanelNode,
} from '../components/panelLayoutTree'

export type UseAppPanelViewModeParams = {
  panelLayout: PanelNode | null
  panelLayoutRef: RefObject<PanelNode | null>
  expandedTileIdRef: RefObject<string | null>
  expandLayoutGroupIdRef: MutableRefObject<string | null>
  expandedCanvasGroupIdRef: RefObject<string | null>
  panelTileIdsRef: RefObject<Set<string>>
  tilesRef: RefObject<TileState[]>
  viewportRef: RefObject<{ tx: number, ty: number, zoom: number }>
  nextZIndexRef: RefObject<number>
  persistCanvasStateRef: RefObject<((tiles: TileState[], viewport: { tx: number, ty: number, zoom: number }, nextZIndex: number, groups: GroupState[]) => void) | null>
  savedLayoutRef: RefObject<PanelNode | null>
  setPanelLayout: React.Dispatch<React.SetStateAction<PanelNode | null>>
  setExpandedTileId: React.Dispatch<React.SetStateAction<string | null>>
  setActivePanelId: React.Dispatch<React.SetStateAction<string | null>>
  setExpandLayoutGroupId: React.Dispatch<React.SetStateAction<string | null>>
  setGroups: React.Dispatch<React.SetStateAction<GroupState[]>>
  setTiles: React.Dispatch<React.SetStateAction<TileState[]>>
  exitCanvasExpandedRef: RefObject<() => void>
}

export function useAppPanelViewMode(params: UseAppPanelViewModeParams) {
  const {
    panelLayout,
    panelLayoutRef,
    expandedTileIdRef,
    expandLayoutGroupIdRef,
    expandedCanvasGroupIdRef,
    panelTileIdsRef,
    tilesRef,
    viewportRef,
    nextZIndexRef,
    persistCanvasStateRef,
    savedLayoutRef,
    setPanelLayout,
    setExpandedTileId,
    setActivePanelId,
    setExpandLayoutGroupId,
    setGroups,
    setTiles,
    exitCanvasExpandedRef,
  } = params

  const promoteExpandedTileToLayoutGroup = useCallback(() => {
    if (expandLayoutGroupIdRef.current) return
    const anchorTileId = expandedTileIdRef.current
    if (!anchorTileId) return
    const layout = panelLayoutRef.current
    if (!layout) return
    if (!panelTreeHasSplit(layout)) return
    const tileIds = getAllTileIds(layout)

    const groupId = `group-${Date.now()}`
    const anchor = tilesRef.current.find(tile => tile.id === anchorTileId)

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
        const updatedTiles = tPrev.map(tile => ids.has(tile.id) ? { ...tile, groupId } : tile)
        setTimeout(() => persistCanvasStateRef.current?.(updatedTiles, viewportRef.current!, nextZIndexRef.current!, updatedGroups), 0)
        return updatedTiles
      })
      return updatedGroups
    })

    setExpandLayoutGroupId(groupId)
    expandLayoutGroupIdRef.current = groupId
    setExpandedTileId(null)
  }, [
    expandLayoutGroupIdRef,
    expandedTileIdRef,
    panelLayoutRef,
    tilesRef,
    viewportRef,
    nextZIndexRef,
    persistCanvasStateRef,
    setExpandLayoutGroupId,
    setExpandedTileId,
    setGroups,
    setTiles,
  ])

  useEffect(() => {
    if (!panelLayout) return
    if (expandLayoutGroupIdRef.current) return
    if (!expandedTileIdRef.current) return
    if (panelTreeHasSplit(panelLayout)) {
      promoteExpandedTileToLayoutGroup()
    }
  }, [panelLayout, promoteExpandedTileToLayoutGroup, expandLayoutGroupIdRef, expandedTileIdRef])

  const exitExpandedMode = useCallback(() => {
    promoteExpandedTileToLayoutGroup()

    const expandingGroup = expandLayoutGroupIdRef.current
    setPanelLayout(prev => {
      if (expandingGroup && prev) {
        setGroups(grps => {
          const updated = grps.map(group => group.id === expandingGroup ? { ...group, layout: prev } : group)
          setTimeout(() => persistCanvasStateRef.current?.(tilesRef.current!, viewportRef.current!, nextZIndexRef.current!, updated), 0)
          return updated
        })
      } else if (!expandingGroup) {
        savedLayoutRef.current = prev
      }
      return null
    })
    setExpandedTileId(null)
    setActivePanelId(null)
    setExpandLayoutGroupId(null)
    expandLayoutGroupIdRef.current = null
  }, [
    promoteExpandedTileToLayoutGroup,
    expandLayoutGroupIdRef,
    setPanelLayout,
    setGroups,
    persistCanvasStateRef,
    tilesRef,
    viewportRef,
    nextZIndexRef,
    savedLayoutRef,
    setExpandedTileId,
    setActivePanelId,
    setExpandLayoutGroupId,
  ])

  const enterExpandedMode = useCallback((tileId: string) => {
    const SIBLING_CAP = 8
    const clicked = tilesRef.current.find(tile => tile.id === tileId)
    const siblingIds = clicked?.groupId
      ? tilesRef.current
        .filter(tile => tile.id !== tileId && tile.groupId === clicked.groupId && !panelTileIdsRef.current.has(tile.id))
        .map(tile => tile.id)
        .slice(0, SIBLING_CAP - 1)
      : []
    const ordered = [tileId, ...siblingIds]
    const leaf = createLeaf(ordered, tileId)
    setExpandedTileId(tileId)
    setPanelLayout(leaf)
    setActivePanelId(leaf.id)
  }, [panelTileIdsRef, setExpandedTileId, setPanelLayout, setActivePanelId, tilesRef])

  const enterTabbedView = useCallback(() => {
    const currentIds = tilesRef.current.map(tile => tile.id)
    const currentIdSet = new Set(currentIds)

    if (savedLayoutRef.current) {
      let restored: PanelNode = savedLayoutRef.current

      const savedIds = getAllTileIds(savedLayoutRef.current)
      for (const id of savedIds) {
        if (!currentIdSet.has(id)) {
          restored = removeTileFromTree(restored, id) ?? restored
        }
      }

      const restoredIds = new Set(getAllTileIds(restored))
      const newIds = currentIds.filter(id => !restoredIds.has(id))
      const firstLeaf = (function find(node: PanelNode): string | null {
        if (node.type === 'leaf') return node.id
        return find(node.children[0])
      })(restored)

      for (const id of newIds) {
        if (firstLeaf) restored = addTabToLeaf(restored, firstLeaf, id)
      }

      setPanelLayout(restored)
      setActivePanelId(firstLeaf)
      setExpandedTileId(null)
    } else {
      const leaf = createLeaf(currentIds, currentIds[0])
      setPanelLayout(leaf)
      setActivePanelId(leaf.id)
      setExpandedTileId(null)
    }
  }, [savedLayoutRef, setPanelLayout, setActivePanelId, setExpandedTileId, tilesRef])

  const handleCanvasEscape = useCallback(() => {
    if (expandedCanvasGroupIdRef.current) {
      exitCanvasExpandedRef.current()
      return
    }
    exitExpandedMode()
  }, [expandedCanvasGroupIdRef, exitCanvasExpandedRef, exitExpandedMode])

  return {
    exitExpandedMode,
    enterExpandedMode,
    enterTabbedView,
    handleCanvasEscape,
  }
}