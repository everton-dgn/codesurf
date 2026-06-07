import { useCallback, useState } from 'react'
import { getDroppedPaths, isImagePath } from '../utils/dnd'

type Attachment = { path: string, kind: 'image' | 'file' }

type UseChatTileAttachmentsOptions = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  syncComposerHeight: () => void
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>
  setAcType: (type: 'slash' | 'mention' | null) => void
  setAcQuery: (query: string) => void
  setShowInsertMenu: (show: boolean) => void
}

export function useChatTileAttachments({
  textareaRef,
  syncComposerHeight,
  setAttachments,
  setAcType,
  setAcQuery,
  setShowInsertMenu,
}: UseChatTileAttachmentsOptions) {
  const [isDropTarget, setIsDropTarget] = useState(false)

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
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      const pos = textarea.value.length
      textarea.setSelectionRange(pos, pos)
    })
  }, [setAcQuery, setAcType, setAttachments, syncComposerHeight, textareaRef])

  const openAttachmentPicker = useCallback(async () => {
    const paths = await window.electron.chat?.selectFiles()
    if (paths && paths.length > 0) addAttachments(paths)
    setShowInsertMenu(false)
  }, [addAttachments, setShowInsertMenu])

  const removeAttachment = useCallback((path: string) => {
    setAttachments(prev => prev.filter(item => item.path !== path))
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [setAttachments, textareaRef])

  const handleTileDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const dataTransfer = event.dataTransfer
    if (dataTransfer.types.includes('application/x-codesurf-queued-turn')) return
    const hasFiles = dataTransfer.types.includes('Files')
    const hasUri = dataTransfer.types.includes('text/uri-list')
    const hasPlain = dataTransfer.types.includes('text/plain')
    const hasFileRef = dataTransfer.types.includes('application/file-reference-path')
    if (!hasFiles && !hasUri && !hasPlain && !hasFileRef) return
    event.preventDefault()
    event.stopPropagation()
    dataTransfer.dropEffect = 'copy'
    setIsDropTarget(true)
  }, [])

  const handleTileDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDropTarget(false)
  }, [])

  const handleTileDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes('application/x-codesurf-queued-turn')) {
      setIsDropTarget(false)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setIsDropTarget(false)
    const fileRef = event.dataTransfer.getData('application/file-reference-path')
    const droppedPaths = fileRef ? [fileRef] : getDroppedPaths(event.dataTransfer)
    if (droppedPaths.length === 0) return
    addAttachments(droppedPaths)
  }, [addAttachments])

  return {
    isDropTarget,
    addAttachments,
    openAttachmentPicker,
    removeAttachment,
    handleTileDragOver,
    handleTileDragLeave,
    handleTileDrop,
  }
}