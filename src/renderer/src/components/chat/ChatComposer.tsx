import React from 'react'

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
