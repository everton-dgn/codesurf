import type { GroupState, TileState } from '../../../shared/types'

export type CanvasHistoryEntry = {
  addedTiles: TileState[]
  removedTiles: TileState[]
  beforeModified: TileState[]
  afterModified: TileState[]
  groupsBefore?: GroupState[]
  groupsAfter?: GroupState[]
}

function cloneTile(tile: TileState): TileState {
  return { ...tile }
}

function cloneGroup(group: GroupState): GroupState {
  return { ...group }
}

function tileStateEqual(a: TileState, b: TileState): boolean {
  return a.type === b.type
    && a.x === b.x
    && a.y === b.y
    && a.width === b.width
    && a.height === b.height
    && a.zIndex === b.zIndex
    && a.groupId === b.groupId
    && a.filePath === b.filePath
    && a.label === b.label
    && a.hideTitlebar === b.hideTitlebar
    && a.hideNavbar === b.hideNavbar
    && a.borderRadius === b.borderRadius
    && a.launchBin === b.launchBin
    && JSON.stringify(a.launchArgs ?? []) === JSON.stringify(b.launchArgs ?? [])
    && a.autoAgentMode === b.autoAgentMode
}

function groupsEqual(a: GroupState[], b: GroupState[]): boolean {
  if (a.length !== b.length) return false
  const byId = new Map(b.map(group => [group.id, group]))
  for (const group of a) {
    const other = byId.get(group.id)
    if (!other) return false
    if (JSON.stringify(group) !== JSON.stringify(other)) return false
  }
  return true
}

export function isEmptyCanvasHistoryEntry(entry: CanvasHistoryEntry): boolean {
  return entry.addedTiles.length === 0
    && entry.removedTiles.length === 0
    && entry.beforeModified.length === 0
    && entry.afterModified.length === 0
    && entry.groupsBefore === undefined
    && entry.groupsAfter === undefined
}

export function buildCanvasHistoryEntry(
  beforeTiles: TileState[],
  afterTiles: TileState[],
  beforeGroups: GroupState[],
  afterGroups: GroupState[],
): CanvasHistoryEntry {
  const beforeById = new Map(beforeTiles.map(tile => [tile.id, tile]))
  const afterById = new Map(afterTiles.map(tile => [tile.id, tile]))

  const addedTiles: TileState[] = []
  const removedTiles: TileState[] = []
  const beforeModified: TileState[] = []
  const afterModified: TileState[] = []

  for (const tile of afterTiles) {
    if (!beforeById.has(tile.id)) addedTiles.push(cloneTile(tile))
  }
  for (const tile of beforeTiles) {
    const after = afterById.get(tile.id)
    if (!after) {
      removedTiles.push(cloneTile(tile))
      continue
    }
    if (!tileStateEqual(tile, after)) {
      beforeModified.push(cloneTile(tile))
      afterModified.push(cloneTile(after))
    }
  }

  const groupsChanged = !groupsEqual(beforeGroups, afterGroups)

  return {
    addedTiles,
    removedTiles,
    beforeModified,
    afterModified,
    groupsBefore: groupsChanged ? beforeGroups.map(cloneGroup) : undefined,
    groupsAfter: groupsChanged ? afterGroups.map(cloneGroup) : undefined,
  }
}

function applyTilePatches(
  tiles: TileState[],
  removeIds: Set<string>,
  restoreTiles: TileState[],
  replacements: Map<string, TileState>,
): TileState[] {
  const next = tiles
    .filter(tile => !removeIds.has(tile.id))
    .map(tile => replacements.get(tile.id) ?? tile)
  return [...next, ...restoreTiles.map(cloneTile)]
}

export function applyCanvasHistoryUndo(
  currentTiles: TileState[],
  currentGroups: GroupState[],
  entry: CanvasHistoryEntry,
): { tiles: TileState[]; groups: GroupState[] } {
  const replacements = new Map(entry.beforeModified.map(tile => [tile.id, tile]))
  const tiles = applyTilePatches(
    currentTiles,
    new Set(entry.addedTiles.map(tile => tile.id)),
    entry.removedTiles,
    replacements,
  )
  const groups = entry.groupsBefore ? entry.groupsBefore.map(cloneGroup) : currentGroups
  return { tiles, groups }
}

export function applyCanvasHistoryRedo(
  currentTiles: TileState[],
  currentGroups: GroupState[],
  entry: CanvasHistoryEntry,
): { tiles: TileState[]; groups: GroupState[] } {
  const replacements = new Map(entry.afterModified.map(tile => [tile.id, tile]))
  const tiles = applyTilePatches(
    currentTiles,
    new Set(entry.removedTiles.map(tile => tile.id)),
    entry.addedTiles,
    replacements,
  )
  const groups = entry.groupsAfter ? entry.groupsAfter.map(cloneGroup) : currentGroups
  return { tiles, groups }
}