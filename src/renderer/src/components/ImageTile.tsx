import React from 'react'
import { CornerDownLeft } from 'lucide-react'

interface Props {
  tileId: string
  workspaceId: string
  filePath: string
  onReplaceFilePath?: (tileId: string, filePath: string) => void
}

interface ImageVariant {
  filePath: string
  prompt?: string
  provider?: string
  model?: string
  at: number
}

function fileUrl(filePath: string): string {
  return `contex-file://${encodeURI(filePath).replace(/#/g, '%23')}`
}

function fileName(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() || filePath
}

function readContextValue<T>(entry: unknown, fallback: T): T {
  if (!entry || typeof entry !== 'object') return fallback
  const value = 'value' in entry ? (entry as { value?: unknown }).value : entry
  return value as T
}

function uniqueVariants(variants: ImageVariant[]): ImageVariant[] {
  const seen = new Set<string>()
  return variants.filter(variant => {
    if (!variant.filePath || seen.has(variant.filePath)) return false
    seen.add(variant.filePath)
    return true
  })
}

function extractPalette(img: HTMLImageElement): string[] {
  const canvas = document.createElement('canvas')
  const size = 36
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || !img.naturalWidth || !img.naturalHeight) return []

  try {
    ctx.drawImage(img, 0, 0, size, size)
    const data = ctx.getImageData(0, 0, size, size).data
    const counts = new Map<string, number>()
    for (let i = 0; i < data.length; i += 16) {
      const alpha = data[i + 3]
      if (alpha < 180) continue
      const r = Math.round(data[i] / 32) * 32
      const g = Math.round(data[i + 1] / 32) * 32
      const b = Math.round(data[i + 2] / 32) * 32
      const key = `${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number)
        return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`
      })
  } catch {
    return []
  }
}

export function ImageTile({ tileId, workspaceId, filePath, onReplaceFilePath }: Props): JSX.Element {
  const imageRef = React.useRef<HTMLImageElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const variantsRef = React.useRef<ImageVariant[]>([])
  const [editStatus, setEditStatus] = React.useState<{ status: 'running' | 'error' | 'done'; message: string } | null>(null)
  const [inspectorOpen, setInspectorOpen] = React.useState(false)
  const [instruction, setInstruction] = React.useState('')
  const [palette, setPalette] = React.useState<string[]>([])
  const [dimensions, setDimensions] = React.useState<{ w: number; h: number } | null>(null)
  const [fileSize, setFileSize] = React.useState<number | null>(null)
  const [variants, setVariants] = React.useState<ImageVariant[]>([])
  const [activeIndex, setActiveIndex] = React.useState(0)

  const activeVariant = variants[activeIndex]
  const activePath = activeVariant?.filePath ?? filePath

  const persistVariants = React.useCallback((nextVariants: ImageVariant[], nextIndex: number) => {
    if (!workspaceId || !tileId || !window.electron?.tileContext) return
    void Promise.all([
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:image:variants', nextVariants),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:image:variant:index', nextIndex),
    ]).catch(() => {})
  }, [workspaceId, tileId])

  const setVariantState = React.useCallback((nextVariants: ImageVariant[], nextIndex: number) => {
    const clean = uniqueVariants(nextVariants)
    const clampedIndex = Math.max(0, Math.min(nextIndex, clean.length - 1))
    variantsRef.current = clean
    setVariants(clean)
    setActiveIndex(clampedIndex)
    persistVariants(clean, clampedIndex)
  }, [persistVariants])

  const appendVariant = React.useCallback((variant: ImageVariant) => {
    const previous = variantsRef.current.length
      ? variantsRef.current
      : [{ filePath, at: Date.now() }]
    const withoutDuplicate = previous.filter(entry => entry.filePath !== variant.filePath)
    const next = [...withoutDuplicate, variant]
    setVariantState(next, next.length - 1)
  }, [filePath, setVariantState])

  const navigateVariant = React.useCallback((direction: number) => {
    const list = variantsRef.current
    if (list.length < 2) return
    const nextIndex = (activeIndex + direction + list.length) % list.length
    setVariantState(list, nextIndex)
    const nextPath = list[nextIndex]?.filePath
    if (nextPath && nextPath !== filePath) onReplaceFilePath?.(tileId, nextPath)
  }, [activeIndex, filePath, onReplaceFilePath, setVariantState, tileId])

  React.useEffect(() => {
    if (!workspaceId || !tileId || !filePath || !window.electron?.tileContext) return
    void Promise.all([
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:image:path', filePath),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:file:path', filePath),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:image:ready', true),
    ]).catch(() => {})
  }, [workspaceId, tileId, filePath])

  React.useEffect(() => {
    if (!workspaceId || !tileId || !window.electron?.tileContext) {
      setVariantState([{ filePath, at: Date.now() }], 0)
      return
    }

    let cancelled = false
    void Promise.all([
      window.electron.tileContext.get(workspaceId, tileId, 'ctx:image:variants'),
      window.electron.tileContext.get(workspaceId, tileId, 'ctx:image:variant:index'),
    ]).then(([storedVariants, storedIndex]) => {
      if (cancelled) return
      const loadedVariants = readContextValue<ImageVariant[]>(storedVariants, [])
      const loadedIndex = readContextValue<number>(storedIndex, 0)
      const base = Array.isArray(loadedVariants) && loadedVariants.length
        ? loadedVariants
        : [{ filePath, at: Date.now() }]
      const withCurrent = base.some(variant => variant.filePath === filePath)
        ? base
        : [...base, { filePath, at: Date.now() }]
      const index = withCurrent.findIndex(variant => variant.filePath === filePath)
      setVariantState(withCurrent, index >= 0 ? index : loadedIndex)
    }).catch(() => {
      if (!cancelled) setVariantState([{ filePath, at: Date.now() }], 0)
    })

    return () => { cancelled = true }
  }, [workspaceId, tileId])

  React.useEffect(() => {
    if (!filePath) return
    const list = variantsRef.current
    if (!list.length) {
      setVariantState([{ filePath, at: Date.now() }], 0)
      return
    }
    const existingIndex = list.findIndex(variant => variant.filePath === filePath)
    if (existingIndex >= 0 && existingIndex !== activeIndex) {
      setVariantState(list, existingIndex)
    } else if (existingIndex < 0) {
      setVariantState([...list, { filePath, at: Date.now() }], list.length)
    }
  }, [filePath])

  React.useEffect(() => {
    if (!workspaceId || !tileId || !window.electron?.bus) return
    const subscriberId = `image:${tileId}:mcp`
    const unsubscribe = window.electron.bus.subscribe(`tile:${tileId}`, subscriberId, (evt: any) => {
      const payload = evt?.payload && typeof evt.payload === 'object' ? evt.payload as Record<string, unknown> : {}
      if (payload.tileId !== tileId && payload.cardId !== tileId) return
      const command = typeof payload.command === 'string' ? payload.command : ''

      if (command === 'image_annotate' && typeof payload.content === 'string') {
        void window.electron.tileContext?.set(workspaceId, tileId, 'ctx:image:annotation:last', {
          note: payload.content,
          at: Date.now(),
        }).catch(() => {})
        return
      }

      if (command === 'image_edit_request' || command === 'image_generate_variation') {
        const prompt = typeof payload.prompt === 'string' ? payload.prompt : ''
        setEditStatus({ status: 'running', message: 'Editing image...' })
        void window.electron.tileContext?.set(workspaceId, tileId, 'ctx:image:edit:request', {
          kind: command === 'image_edit_request' ? 'edit' : 'variation',
          prompt,
          provider: typeof payload.provider === 'string' ? payload.provider : '',
          model: typeof payload.model === 'string' ? payload.model : '',
          maskPath: typeof payload.maskPath === 'string' ? payload.maskPath : '',
          outputPath: typeof payload.outputPath === 'string' ? payload.outputPath : '',
          sourcePath: filePath,
          status: typeof payload.status === 'string' ? payload.status : 'requested',
          at: Date.now(),
        }).catch(() => {})
        return
      }

      if (command === 'image_edit_error') {
        const message = typeof payload.message === 'string' && payload.message.trim()
          ? payload.message.trim()
          : 'Image edit failed'
        setEditStatus({ status: 'error', message })
        void window.electron.tileContext?.set(workspaceId, tileId, 'ctx:image:edit:last', {
          sourcePath: filePath,
          status: 'error',
          error: message,
          prompt: typeof payload.prompt === 'string' ? payload.prompt : '',
          provider: typeof payload.provider === 'string' ? payload.provider : '',
          model: typeof payload.model === 'string' ? payload.model : '',
          at: Date.now(),
        }).catch(() => {})
        return
      }

      if (command === 'image_replace_source' && typeof payload.filePath === 'string' && payload.filePath.trim()) {
        const nextPath = payload.filePath.trim()
        const prompt = typeof payload.note === 'string' ? payload.note : ''
        setEditStatus({ status: 'done', message: 'Image updated' })
        window.setTimeout(() => setEditStatus(current => current?.status === 'done' ? null : current), 1800)
        appendVariant({
          filePath: nextPath,
          prompt,
          provider: typeof payload.provider === 'string' ? payload.provider : '',
          model: typeof payload.model === 'string' ? payload.model : '',
          at: Date.now(),
        })
        onReplaceFilePath?.(tileId, nextPath)
        void Promise.all([
          window.electron.tileContext?.set(workspaceId, tileId, 'ctx:image:path', nextPath),
          window.electron.tileContext?.set(workspaceId, tileId, 'ctx:file:path', nextPath),
          window.electron.tileContext?.set(workspaceId, tileId, 'ctx:image:edit:last', {
            sourcePath: filePath,
            outputPath: nextPath,
            note: prompt,
            provider: typeof payload.provider === 'string' ? payload.provider : '',
            model: typeof payload.model === 'string' ? payload.model : '',
            status: 'done',
            at: Date.now(),
          }),
        ]).catch(() => {})
      }
    })
    return () => {
      unsubscribe?.()
      window.electron.bus?.unsubscribeAll?.(subscriberId)
    }
  }, [workspaceId, tileId, filePath, onReplaceFilePath, appendVariant])

  React.useEffect(() => {
    if (!inspectorOpen) return
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [inspectorOpen])

  React.useEffect(() => {
    setFileSize(null)
    if (!activePath || !window.electron?.fs?.stat) return
    void window.electron.fs.stat(activePath).then(stat => {
      setFileSize(stat?.size ?? null)
    }).catch(() => setFileSize(null))
  }, [activePath])

  const submitInstruction = React.useCallback(() => {
    const prompt = instruction.trim()
    if (!prompt || !window.electron?.image?.edit) return
    setInstruction('')
    setEditStatus({ status: 'running', message: 'Editing image...' })
    void window.electron.image.edit({ tileId, prompt }).then(result => {
      if (!result.ok) setEditStatus({ status: 'error', message: result.error ?? 'Image edit failed' })
    }).catch(err => {
      setEditStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    })
  }, [instruction, tileId])

  const formatBytes = (bytes: number | null): string => {
    if (bytes === null) return 'unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div
      tabIndex={0}
      onDoubleClick={event => {
        event.preventDefault()
        event.stopPropagation()
        setInspectorOpen(true)
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') setInspectorOpen(false)
        if (event.key === 'ArrowLeft') navigateVariant(-1)
        if (event.key === 'ArrowRight') navigateVariant(1)
      }}
      onWheel={event => {
        if (!inspectorOpen || variants.length < 2) return
        event.stopPropagation()
        navigateVariant(event.deltaY > 0 ? 1 : -1)
      }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111111',
        overflow: 'hidden',
        position: 'relative',
        outline: 'none',
      }}
    >
      <img
        ref={imageRef}
        src={fileUrl(activePath)}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        onLoad={event => {
          const img = event.currentTarget
          setDimensions({ w: img.naturalWidth, h: img.naturalHeight })
          setPalette(extractPalette(img))
        }}
        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
      />

      {inspectorOpen ? (
        <>
          <div style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            pointerEvents: 'none',
          }}>
            {(palette.length ? palette : ['#1f2933', '#334155', '#64748b']).map(color => (
              <div key={color} title={color} style={{
                width: 13,
                height: 13,
                background: color,
                border: '1px solid rgba(255,255,255,0.26)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.45)',
              }} />
            ))}
          </div>

          <div style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: 170,
            color: 'rgba(255,255,255,0.72)',
            textShadow: '0 1px 10px rgba(0,0,0,0.9)',
            fontSize: 10,
            lineHeight: 1.45,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            pointerEvents: 'none',
            textAlign: 'right',
          }}>
            <div>{fileName(activePath)}</div>
            <div>{dimensions ? `${dimensions.w} x ${dimensions.h}` : 'dimensions unknown'}</div>
            <div>{formatBytes(fileSize)}</div>
            <div>{variants.length} variant{variants.length === 1 ? '' : 's'}</div>
            <div>{variants.length ? `${activeIndex + 1} / ${variants.length}` : '1 / 1'}</div>
            {activeVariant?.prompt ? <div>{activeVariant.prompt}</div> : null}
          </div>

          <form
            onSubmit={event => {
              event.preventDefault()
              submitInstruction()
            }}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 14,
              transform: 'translateX(-50%)',
              width: 'min(430px, calc(100% - 96px))',
              height: 34,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(11, 13, 15, 0.68)',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.38)',
              padding: '4px 5px 4px 11px',
              borderRadius: 7,
              backdropFilter: 'blur(14px)',
            }}
          >
            <input
              ref={inputRef}
              value={instruction}
              onChange={event => setInstruction(event.target.value)}
              placeholder="Edit this image..."
              spellCheck={false}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 0,
                outline: 'none',
                color: 'rgba(244,244,245,0.94)',
                fontSize: 12,
              }}
            />
            <button
              type="submit"
              title="Apply edit"
              style={{
                width: 26,
                height: 24,
                border: '1px solid rgba(144,224,239,0.28)',
                background: 'rgba(144,224,239,0.10)',
                color: 'rgba(207,246,255,0.9)',
                borderRadius: 5,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <CornerDownLeft size={14} strokeWidth={2} />
            </button>
          </form>

          {variants.length > 1 ? (
            <div style={{
              position: 'absolute',
              left: '50%',
              bottom: 54,
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 5,
            }}>
              {variants.map((variant, index) => (
                <button
                  key={variant.filePath}
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    setVariantState(variants, index)
                    onReplaceFilePath?.(tileId, variant.filePath)
                  }}
                  title={`${index + 1}: ${fileName(variant.filePath)}`}
                  style={{
                    width: 8,
                    height: 8,
                    padding: 0,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.45)',
                    background: index === activeIndex ? 'rgba(207,246,255,0.95)' : 'rgba(255,255,255,0.24)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {editStatus ? (
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 10,
            maxWidth: 'calc(100% - 20px)',
            minHeight: 24,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '4px 8px',
            borderRadius: 6,
            border: `1px solid ${editStatus.status === 'error' ? 'rgba(255, 116, 92, 0.36)' : 'rgba(144, 224, 239, 0.22)'}`,
            background: editStatus.status === 'error' ? 'rgba(48, 18, 16, 0.62)' : 'rgba(10, 18, 22, 0.58)',
            color: editStatus.status === 'error' ? 'rgba(255, 185, 174, 0.95)' : 'rgba(207,246,255,0.92)',
            fontSize: 11,
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(12px)',
          }}
          title={editStatus.message}
        >
          {editStatus.message}
        </div>
      ) : null}
    </div>
  )
}
