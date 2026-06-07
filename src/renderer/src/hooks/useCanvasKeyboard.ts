import { useEffect, type MutableRefObject } from 'react'
import { isEditableTarget } from '../utils/editableTarget'

type UseCanvasKeyboardOptions = {
  selectedTileIds: Set<string>
  groupSelectedTiles: () => void
  setCommandPaletteOpen: (updater: boolean | ((open: boolean) => boolean)) => void
  undoCanvas: () => void
  redoCanvas: () => void
  onEscape: () => void
  spaceHeldRef: MutableRefObject<boolean>
}

export function useCanvasKeyboard({
  selectedTileIds,
  groupSelectedTiles,
  setCommandPaletteOpen,
  undoCanvas,
  redoCanvas,
  onEscape,
  spaceHeldRef,
}: UseCanvasKeyboardOptions) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key === 'g') {
        event.preventDefault()
        if (selectedTileIds.size >= 2) groupSelectedTiles()
        return
      }
      if (!mod) return
      const isUndo = event.key === 'z' && !event.shiftKey
      const isRedo = (event.key === 'z' && event.shiftKey) || event.key === 'y'
      if (!isUndo && !isRedo) return
      event.preventDefault()
      if (isUndo) undoCanvas()
      else redoCanvas()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [groupSelectedTiles, redoCanvas, selectedTileIds, undoCanvas])

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEscape])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat) {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        spaceHeldRef.current = true
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [spaceHeldRef])
}