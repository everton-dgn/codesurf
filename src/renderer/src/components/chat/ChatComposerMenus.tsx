import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useTheme } from '../../ThemeContext'
import type { ModelOption } from '../../config/providers'

const NON_SELECTABLE_UI_STYLE = {
  userSelect: 'none' as const,
  WebkitUserSelect: 'none' as const,
}

const FONT_SANS = 'var(--ct-font-sans)'
const FONT_MONO = 'var(--ct-font-mono)'

// Renders children in a portal at document.body so they escape tile overflow:hidden clipping.
// Positions above the anchor element, right-aligned so menus don't overflow off the right edge.
export function MenuPortal({ anchorRef, children }: { anchorRef: React.RefObject<HTMLElement | null>; children: React.ReactNode }): JSX.Element | null {
  const [pos, setPos] = useState<{ bottom: number; right: number } | null>(null)

  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 4,
      right: window.innerWidth - rect.right,
    })
  }, [anchorRef])

  if (!pos) return null
  return createPortal(
    <div
      data-chat-menu-portal="true"
      style={{ position: 'fixed', bottom: pos.bottom, right: pos.right, zIndex: 99999 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}

export function Dropdown({ children }: { children: React.ReactNode }): JSX.Element {
  const theme = useTheme()
  const dropdownBackground = theme.chat.dropdownBackground
  const dropdownBorder = theme.chat.dropdownBorder
  return (
    <div style={{
      minWidth: 160,
      background: dropdownBackground, border: `1px solid ${dropdownBorder}`,
      borderRadius: 8, padding: 4,
      boxShadow: theme.shadow.panel,
      ...NON_SELECTABLE_UI_STYLE,
    }}>
      {children}
    </div>
  )
}

export function ModelDropdown({ models, activeId, filter, onFilterChange, providerIcon, noun, onSelect }: {
  models: ModelOption[]; activeId: string; filter: string; onFilterChange: (v: string) => void
  providerIcon: React.ReactNode; noun: 'model' | 'agent'; onSelect: (id: string) => void
}): JSX.Element {
  const theme = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const hasMany = models.length > 6

  useEffect(() => { if (hasMany) inputRef.current?.focus() }, [hasMany])

  const filtered = filter
    ? models.filter(m => m.label.toLowerCase().includes(filter.toLowerCase()) || m.id.toLowerCase().includes(filter.toLowerCase()))
    : models

  return (
    <div style={{
      minWidth: 200, maxWidth: 280,
      background: theme.chat.dropdownBackground, border: `1px solid ${theme.chat.dropdownBorder}`,
      borderRadius: 8, padding: 4,
      boxShadow: theme.shadow.panel,
      zIndex: 9999,
      display: 'flex', flexDirection: 'column',
    }}>
      {hasMany && (
        <div style={{ padding: '4px 4px 2px' }}>
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={e => onFilterChange(e.target.value)}
            placeholder={`Filter ${noun}s...`}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '5px 8px', fontSize: 11,
              background: (theme.chat as any).inputBackground ?? theme.chat.background,
              color: theme.chat.text, border: `1px solid ${theme.chat.dropdownBorder}`,
              borderRadius: 5, outline: 'none',
              fontFamily: FONT_MONO,
            }}
            onKeyDown={e => e.stopPropagation()}
          />
        </div>
      )}
      <div style={{
        maxHeight: 240, overflowY: 'auto', overflowX: 'hidden',
      }}>
        {filtered.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: 11, color: theme.chat.muted, fontFamily: FONT_SANS }}>
            {`No matching ${noun}s`}
          </div>
        )}
        {filtered.map(m => (
          <DropdownItem
            key={m.id}
            icon={providerIcon}
            label={m.label}
            sublabel={m.description ?? (m.id.includes('/') ? m.id.split('/')[0] : undefined)}
            active={activeId === m.id}
            onClick={() => onSelect(m.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function DropdownItem({ icon, label, sublabel, active, onClick }: {
  icon?: React.ReactNode; label: string; sublabel?: string; active: boolean; onClick: () => void
}): JSX.Element {
  const theme = useTheme()
  const [h, setH] = useState(false)
  const dropdownActiveBackground = theme.chat.dropdownActiveBackground
  const dropdownHoverBackground = theme.chat.dropdownHoverBackground
  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        background: active ? dropdownActiveBackground : (h ? dropdownHoverBackground : 'transparent'),
        transition: 'background 0.1s',
        ...NON_SELECTABLE_UI_STYLE,
      }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {icon && <span style={{ display: 'flex', color: active ? theme.accent.base : theme.chat.muted }}>{icon}</span>}
      <span style={{
        fontSize: 12, color: active ? theme.accent.base : theme.chat.text,
        fontFamily: FONT_SANS,
      }}>
        {label}
      </span>
      {active && <Check size={12} color={theme.accent.base} style={{ marginLeft: 'auto' }} />}
      {sublabel && !active && (
        <span style={{ fontSize: 9, color: theme.chat.subtle, fontFamily: FONT_MONO }}>{sublabel}</span>
      )}
    </div>
  )
}
