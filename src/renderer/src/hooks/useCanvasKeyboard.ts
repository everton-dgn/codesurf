import { useEffect } from 'react'
import { isEditableTarget } from '../utils/editableTarget'

type UseCanvasKeyboardOptions = {
  selectedTileIds: Set<string>
  groupSelectedTiles: () => void
  setCommandPaletteOpen: (updater: boolean | ((open: boolean) => boolean)) => void
}

export function useCanvasKeyboard({
  selectedTileIds,
  groupSelectedTiles,
  setCommandPaletteOpen,
}: UseCanvasKeyboardOptions) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if ((event.metaKey || event.ctrlKey) && event.key === 'g') {
        event.preventDefault()
        if (selectedTileIds.size >= 2) groupSelectedTiles()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [groupSelectedTiles, selectedTileIds])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === 'p' || event.key === 'P')) {
        event.preventDefault()
        setCommandPaletteOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandPaletteOpen])
}