import type { WebContents, WebPreferences } from 'electron'
import { formatGuestWebviewTagPreferences } from '../shared/guest-webview-preferences.ts'

export { formatGuestWebviewTagPreferences }

/**
 * Main renderer windows intentionally use sandbox:false so the preload bridge
 * can reach Node-backed IPC (terminal/node-pty, fs, MCP). Mitigations:
 * - contextIsolation:true — renderer cannot touch Node/Electron directly
 * - nodeIntegration:false — no require() in the page
 * - Guest <webview> tags are hardened separately via will-attach-webview.
 */
export function createMainWindowWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    sandbox: false,
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: true,
  }
}

/** Enforced on every guest webview regardless of tag attributes. */
export const GUEST_WEBVIEW_WEB_PREFERENCES: Pick<
  WebPreferences,
  | 'sandbox'
  | 'contextIsolation'
  | 'nodeIntegration'
  | 'nodeIntegrationInSubFrames'
  | 'webSecurity'
  | 'allowRunningInsecureContent'
> = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInSubFrames: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
}

export function applyGuestWebviewWebPreferences(webPreferences: WebPreferences): void {
  webPreferences.preload = undefined
  Object.assign(webPreferences, GUEST_WEBVIEW_WEB_PREFERENCES)
}

export function attachGuestWebviewSecurityHandlers(contents: WebContents): void {
  contents.on('will-attach-webview', (_event, webPreferences, params) => {
    applyGuestWebviewWebPreferences(webPreferences)
    ;(params as { allowpopups?: boolean }).allowpopups = false
  })
}