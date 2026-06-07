import { useMemo } from 'react'
import type { AppSettings, Workspace } from '../../../shared/types'
import type { PanelNode } from '../components/panelLayoutTree'
import type { AppFonts } from './useAppThemeCssVars'
import type { AppTheme } from '../theme'

function withAlpha(color: string, alpha: number): string {
  const trimmed = color.trim()

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    if (hex.length === 3) {
      const [r, g, b] = hex.split('').map(ch => parseInt(ch + ch, 16))
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i)
  if (rgbMatch) {
    const [r = '0', g = '0', b = '0'] = rgbMatch[1].split(',').map(part => part.trim())
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return color
}

export type ShellLayoutMetrics = {
  canvasLayerBackground: string
  sidebarFooterBottom: number
  sidebarFooterLeft: number
  sidebarFooterHeight: number
  mainPanelBottomInset: number
  mainPanelTop: number
  mainStatusBarLeft: number
  collapsedSidebarPillSize: number
  sidebarToggleLeft: number
  sidebarToggleTop: number
  workspaceTabsMinimumLeft: number
  mainPanelLeft: number
  discoveryHighlightZIndex: number
  discoveryGlowZIndex: number
  discoveryPillZIndex: number
  openWorkspaceTabs: Workspace[]
  hasWorkspaceTabs: boolean
  workspaceTitleFallback: string
  showTopWorkspacePickerTab: boolean
  mainPanelCornerRadii: { topLeft: number, topRight: number, bottomRight: number, bottomLeft: number }
  mainPanelBorderRadius: string
  mainPanelBackground: string
  mainPanelInsetEdgeShadow: string
  mainPanelOuterEdgeShadow: string
  selectedTabDropShadow: string
  mainPanelShadow: string
  workspaceTabLabelSize: number
  workspaceTabBackground: string
  workspaceTabInactiveBackground: string
  workspaceTabInactiveHoverBackground: string
  workspaceTabCloseHoverBackground: string
  workspaceTabMaxWidth: string
  workspaceTabActiveHeight: number
  workspaceTabInactiveHeight: number
  workspaceTabTextOffset: number
  workspaceTabInactiveTextOffset: number
  workspaceTabActiveBottomGap: number
  workspaceTabInactiveBottomGap: number
  dsc: { line: string, dot: string, bg: string, text: string }
}

export type UseShellLayoutMetricsParams = {
  settings: AppSettings
  theme: AppTheme
  sidebarCollapsed: boolean
  sidebarWidth: number
  panelLayout: PanelNode | null
  openWorkspaceIds: string[]
  workspaces: Workspace[]
  workspace: Workspace | null
  showWorkspacePickerTab: boolean
  appFonts: AppFonts
}

export function useShellLayoutMetrics(params: UseShellLayoutMetricsParams): ShellLayoutMetrics {
  const {
    settings,
    theme,
    sidebarCollapsed,
    sidebarWidth,
    panelLayout,
    openWorkspaceIds,
    workspaces,
    workspace,
    showWorkspacePickerTab,
    appFonts,
  } = params

  return useMemo(() => {
    const translucentBackgroundOpacity = Math.max(0.05, Math.min(1, settings.translucentBackgroundOpacity ?? 1))
    const canvasBackground = withAlpha(settings.canvasBackground, translucentBackgroundOpacity)
    const canvasLayerBackground = theme.canvas.backgroundEffect
      ? `${theme.canvas.backgroundEffect}, ${canvasBackground}`
      : canvasBackground
    const sidebarFooterBottom = 2
    const sidebarFooterLeft = 0
    const sidebarFooterHeight = 42
    const mainPanelBottomInset = sidebarFooterHeight - 6
    const mainPanelTop = 39
    const mainStatusBarLeft = sidebarCollapsed ? 0 : sidebarWidth
    const collapsedSidebarPillSize = 24
    const sidebarToggleLeft = 78
    const sidebarToggleTop = 10
    const workspaceTabsMinimumLeft = sidebarToggleLeft + collapsedSidebarPillSize + 14
    const expandedLayoutLeft = sidebarWidth + 12
    const mainPanelLeft = sidebarCollapsed ? 6 : expandedLayoutLeft
    const mainPanelRadius = 10
    const discoveryHighlightZIndex = 0
    const discoveryGlowZIndex = 0
    const discoveryPillZIndex = 99997
    const openWorkspaceTabs = openWorkspaceIds
      .map(id => workspaces.find(ws => ws.id === id) ?? null)
      .filter((ws): ws is Workspace => Boolean(ws))
    const hasWorkspaceTabs = openWorkspaceTabs.length > 0
    const workspaceTitleFallback = workspace?.name?.trim() || 'WORKSPACES'
    const showTopWorkspacePickerTab = showWorkspacePickerTab || (!workspace && openWorkspaceTabs.length === 0)
    const mainPanelCornerRadii = {
      topLeft: mainPanelRadius,
      topRight: mainPanelRadius,
      bottomRight: mainPanelRadius,
      bottomLeft: mainPanelRadius,
    }
    const mainPanelBorderRadius = `${mainPanelCornerRadii.topLeft}px ${mainPanelCornerRadii.topRight}px ${mainPanelCornerRadii.bottomRight}px ${mainPanelCornerRadii.bottomLeft}px`
    const mainPanelBackground = panelLayout ? theme.surface.app : canvasLayerBackground
    const mainPanelInsetEdgeShadow = theme.mode === 'light'
      ? `inset 0 0 0 0.5px color-mix(in srgb, ${theme.surface.app} 96%, transparent), inset -0.5px 0 0 color-mix(in srgb, ${theme.text.primary} 2.5%, transparent), inset 0 -0.5px 0 color-mix(in srgb, ${theme.text.primary} 2.5%, transparent)`
      : `inset 0 0 0 0.5px rgba(255,255,255,0.045)`
    const mainPanelOuterEdgeShadow = theme.mode === 'light'
      ? `0 0 0 0.5px color-mix(in srgb, ${theme.text.primary} 4%, transparent)`
      : `0 0 0 0.5px rgba(0,0,0,0.30)`
    const selectedTabDropShadow = theme.mode === 'light'
      ? `0 5px 12px color-mix(in srgb, ${theme.text.primary} 10%, transparent)`
      : `0 5px 12px rgba(0,0,0,0.36)`
    const mainPanelShadow = `${mainPanelOuterEdgeShadow}, ${selectedTabDropShadow}`
    const workspaceTabLabelSize = Math.max(12, appFonts.size - 1)
    const workspaceTabBackground = panelLayout ? theme.surface.panel : mainPanelBackground
    const workspaceTabInactiveBackground = theme.mode === 'light'
      ? `color-mix(in srgb, ${theme.surface.panel} 58%, transparent)`
      : 'transparent'
    const workspaceTabInactiveHoverBackground = theme.mode === 'light'
      ? `color-mix(in srgb, ${theme.surface.panel} 78%, transparent)`
      : theme.surface.hover
    const workspaceTabCloseHoverBackground = `color-mix(in srgb, ${theme.surface.selection} 70%, ${theme.surface.hover})`
    const workspaceTabMaxWidth = 'min(248px, 24vw)'
    const workspaceTabActiveHeight = 27
    const workspaceTabInactiveHeight = 22
    const workspaceTabTextOffset = -1
    const workspaceTabInactiveTextOffset = 0
    const workspaceTabActiveBottomGap = 3
    const workspaceTabInactiveBottomGap = workspaceTabActiveBottomGap + 3
    const dsc = theme.mode === 'light'
      ? { line: '53, 104, 255', dot: '53, 104, 255', bg: '255, 255, 255', text: theme.accent.base }
      : { line: '123, 241, 255', dot: '123, 241, 255', bg: '5, 13, 19', text: 'rgba(215, 247, 255, 0.97)' }

    return {
      canvasLayerBackground,
      sidebarFooterBottom,
      sidebarFooterLeft,
      sidebarFooterHeight,
      mainPanelBottomInset,
      mainPanelTop,
      mainStatusBarLeft,
      collapsedSidebarPillSize,
      sidebarToggleLeft,
      sidebarToggleTop,
      workspaceTabsMinimumLeft,
      mainPanelLeft,
      discoveryHighlightZIndex,
      discoveryGlowZIndex,
      discoveryPillZIndex,
      openWorkspaceTabs,
      hasWorkspaceTabs,
      workspaceTitleFallback,
      showTopWorkspacePickerTab,
      mainPanelCornerRadii,
      mainPanelBorderRadius,
      mainPanelBackground,
      mainPanelInsetEdgeShadow,
      mainPanelOuterEdgeShadow,
      selectedTabDropShadow,
      mainPanelShadow,
      workspaceTabLabelSize,
      workspaceTabBackground,
      workspaceTabInactiveBackground,
      workspaceTabInactiveHoverBackground,
      workspaceTabCloseHoverBackground,
      workspaceTabMaxWidth,
      workspaceTabActiveHeight,
      workspaceTabInactiveHeight,
      workspaceTabTextOffset,
      workspaceTabInactiveTextOffset,
      workspaceTabActiveBottomGap,
      workspaceTabInactiveBottomGap,
      dsc,
    }
  }, [
    appFonts.size,
    openWorkspaceIds,
    panelLayout,
    settings.canvasBackground,
    settings.translucentBackgroundOpacity,
    showWorkspacePickerTab,
    sidebarCollapsed,
    sidebarWidth,
    theme,
    workspace,
    workspaces,
  ])
}