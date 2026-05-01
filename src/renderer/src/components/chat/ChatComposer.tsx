import React from 'react'
import { FileText, Trash2 } from 'lucide-react'
import { useTheme } from '../../ThemeContext'
import { basename } from '../../utils/dnd'

export interface ChatComposerAttachment {
  path: string
  kind: 'image' | 'file'
}

export function ChatComposerWrap({
  style,
  children,
}: {
  style?: React.CSSProperties
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="cs-chat-composer-wrap" style={style}>
      {children}
    </div>
  )
}

export function ChatComposerCard({
  style,
  children,
}: {
  style?: React.CSSProperties
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="cs-chat-composer-card" style={style}>
      {children}
    </div>
  )
}

export function ChatComposerPrimaryToolbar({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="cs-chat-composer-primary-toolbar" style={{
      display: 'flex',
      alignItems: 'center',
      padding: '4px 8px 4px 8px',
      gap: 2,
    }}>
      {children}
    </div>
  )
}

export function ChatComposerSecondaryToolbar({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="cs-chat-composer-secondary-toolbar" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '0 8px',
    }}>
      {children}
    </div>
  )
}

export function ChatComposerAttachments({
  attachments,
  fontMono,
  onRemoveAttachment,
}: {
  attachments: ChatComposerAttachment[]
  fontMono: string
  onRemoveAttachment: (path: string) => void
}): JSX.Element | null {
  const theme = useTheme()

  if (attachments.length === 0) return null

  return (
    <div style={{
      display: 'block', gap: 8, padding: '8px 14px 4px 14px',
      overflowX: 'auto',
    }}>
      {attachments.map(item => (
        <div
          key={item.path}
          title={item.path}
          style={{
            flexShrink: 0,
            maxWidth: item.kind === 'image' ? 140 : 180,
            height: 54,
            borderRadius: 12,
            border: `1px solid ${theme.chat.dropdownBorder}`,
            background: theme.surface.panelElevated,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          {item.kind === 'image' ? (
            <img
              src={item.path}
              alt={basename(item.path)}
              style={{ width: 54, height: 54, objectFit: 'cover', display: 'block', background: theme.chat.background, flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 36, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: theme.chat.muted, borderRight: `1px solid ${theme.border.subtle}`, fontSize: 15,
            }}>
              <FileText size={13} />
            </div>
          )}
          <div style={{
            minWidth: 0,
            padding: '8px 26px 8px 10px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 11, color: theme.chat.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{basename(item.path)}</div>
            <div style={{ fontSize: 9, color: theme.chat.muted, fontFamily: fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.kind === 'image' ? 'image' : 'file'}</div>
          </div>
          <button
            onClick={() => onRemoveAttachment(item.path)}
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 16, height: 16, borderRadius: 8,
              border: `1px solid ${theme.border.default}`, background: theme.surface.overlay,
              color: theme.chat.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
            title="Remove attachment"
          >
            <Trash2 size={9} />
          </button>
        </div>
      ))}
    </div>
  )
}
