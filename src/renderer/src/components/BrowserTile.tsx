import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, Bug, ClipboardCheck, ClipboardList, Crosshair, Globe, Home, Monitor, RotateCcw, RotateCw, Smartphone, Trash2 } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { useAppFonts } from '../FontContext'
import { dispatchOpenLink } from '../utils/links'
import { dispatchCreateTile, dispatchOpenChatSurface } from '../utils/appLaunchRequests'
import {
  appendBrowserEvidence,
  createBrowserEvidenceEvent,
  createBrowserEvidenceSnapshot,
  createBrowserPageHealth,
  formatBrowserEvidenceReport,
  summarizeBrowserEvidence,
  type BrowserEvidenceEvent,
  type BrowserEvidenceInput,
} from '../../../shared/browserEvidence'
import clusoEmbedJs from '../assets/cluso/cluso-embed.js?raw'
import clusoEmbedCss from '../assets/cluso/cluso-embed.css?raw'

const HOMEPAGE = 'https://www.google.com'

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) @contex/electron/0.2.0 Chrome/132.0.6834.159 Safari/537.36'
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const WEBVIEW_DISPOSE_DELAY_MS = 15000
const WEBVIEW_PARKING_ROOT_ID = 'browser-tile-webview-parking-root'
const CLUSO_TOOLBAR_WIDTH = 297
const CLUSO_TOOLBAR_HEIGHT = 44
const CLUSO_TOOLBAR_BOTTOM_OFFSET = 8

type WebviewRegistryEntry = {
  webview: Electron.WebviewTag
  disposeTimer: number | null
}

type ElectrobunWebviewElement = HTMLElement & {
  src: string | null
  webviewId?: number | null
  partition?: string | null
  renderer?: 'native' | 'cef'
  loadURL?: (url: string) => void
  loadHTML?: (html: string) => void
  canGoBack?: () => Promise<boolean>
  canGoForward?: () => Promise<boolean>
  goBack?: () => void
  goForward?: () => void
  reload?: () => void
  executeJavascript?: (script: string) => void
  openDevTools?: () => void
  syncDimensions?: (force?: boolean) => void
  on?: (event: string, listener: (event: CustomEvent) => void) => void
}

type AdaptedElectrobunWebview = ElectrobunWebviewElement & Electron.WebviewTag & { __codesurfElectrobunWebview?: true }

const webviewRegistry = new Map<string, WebviewRegistryEntry>()

function getWebviewParkingRoot(): HTMLDivElement {
  let root = document.getElementById(WEBVIEW_PARKING_ROOT_ID) as HTMLDivElement | null
  if (root) return root

  root = document.createElement('div')
  root.id = WEBVIEW_PARKING_ROOT_ID
  root.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:-10000px',
    'width:1px',
    'height:1px',
    'overflow:hidden',
    'opacity:0',
    'pointer-events:none',
    'visibility:hidden',
    'z-index:-1',
  ].join(';')
  document.body.appendChild(root)
  return root
}

function emitFallbackWebviewEvent(target: EventTarget, type: string, url?: string): void {
  const event = new Event(type) as Event & { url?: string; message?: string }
  if (url) event.url = url
  target.dispatchEvent(event)
}

function eventUrl(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>
    if (typeof record.url === 'string') return record.url
    if (typeof record.detail === 'string') return record.detail
  }
  return fallback
}

function dispatchWebviewCompatEvent(target: EventTarget, type: string, detail: unknown, fallbackUrl: string): void {
  const event = new Event(type) as Event & { url?: string; message?: string }
  const url = eventUrl(detail, fallbackUrl)
  if (url) event.url = url
  if (!event.message && typeof detail === 'string') event.message = detail
  target.dispatchEvent(event)
}

function createFallbackWebview(src: string, bgColor = '#111317'): Electron.WebviewTag {
  const frame = document.createElement('iframe') as HTMLIFrameElement & Electron.WebviewTag & { __codesurfFallbackWebview?: true }
  frame.__codesurfFallbackWebview = true
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-downloads')
  frame.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen; microphone; camera')
  frame.style.cssText =
    `position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; border: none; background: ${bgColor};`

  let currentUrl = src
  let loading = true

  frame.loadURL = async (url: string) => {
    currentUrl = url
    loading = true
    emitFallbackWebviewEvent(frame, 'did-start-loading', url)
    frame.src = url
  }
  frame.getURL = () => currentUrl || frame.src
  frame.getTitle = () => frame.contentDocument?.title || currentUrl || 'Browser'
  frame.canGoBack = () => false
  frame.canGoForward = () => false
  frame.isLoading = () => loading
  frame.goBack = () => {
    try { frame.contentWindow?.history.back() } catch { /* cross-origin iframe */ }
  }
  frame.goForward = () => {
    try { frame.contentWindow?.history.forward() } catch { /* cross-origin iframe */ }
  }
  frame.reload = () => {
    loading = true
    emitFallbackWebviewEvent(frame, 'did-start-loading', currentUrl)
    try { frame.contentWindow?.location.reload() } catch { frame.src = currentUrl }
  }
  frame.stop = () => {
    try { frame.contentWindow?.stop() } catch { /* ignore */ }
    loading = false
    emitFallbackWebviewEvent(frame, 'did-stop-loading', currentUrl)
  }
  frame.setUserAgent = () => { /* iframe fallback cannot change UA per tile */ }
  frame.openDevTools = () => { /* no-op outside Electron webview */ }
  frame.insertCSS = async () => ''
  frame.executeJavaScript = async (script: string) => {
    try {
      const targetWindow = frame.contentWindow as unknown as { eval?: (source: string) => unknown } | null
      return targetWindow?.eval?.(script) ?? null
    } catch { return null }
  }
  frame.send = async () => { /* no-op outside Electron webview */ }

  frame.addEventListener('load', () => {
    currentUrl = frame.src || currentUrl
    loading = false
    emitFallbackWebviewEvent(frame, 'dom-ready', currentUrl)
    emitFallbackWebviewEvent(frame, 'did-navigate', currentUrl)
    emitFallbackWebviewEvent(frame, 'did-stop-loading', currentUrl)
  })
  frame.addEventListener('error', () => {
    loading = false
    emitFallbackWebviewEvent(frame, 'did-fail-load', currentUrl)
  })

  void frame.loadURL(src)
  return frame
}

function createElectrobunWebview(src: string, bgColor = '#111317'): Electron.WebviewTag | null {
  if (!customElements.get('electrobun-webview')) return null

  const webview = document.createElement('electrobun-webview') as AdaptedElectrobunWebview
  if (typeof webview.loadURL !== 'function' || typeof webview.executeJavascript !== 'function') return null

  webview.__codesurfElectrobunWebview = true
  webview.setAttribute('partition', 'persist:browser-tile')
  webview.setAttribute('renderer', 'cef')
  webview.setAttribute('src', src)
  webview.style.cssText =
    `position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; border: none; background: ${bgColor};`

  const nativeLoadURL = webview.loadURL.bind(webview)
  const nativeCanGoBack = webview.canGoBack?.bind(webview)
  const nativeCanGoForward = webview.canGoForward?.bind(webview)
  const nativeExecuteJavascript = webview.executeJavascript.bind(webview)
  const nativeOpenDevTools = webview.openDevTools?.bind(webview)

  let currentUrl = src
  let loading = true
  let canGoBack = false
  let canGoForward = false

  const refreshNav = () => {
    void nativeCanGoBack?.().then(value => { canGoBack = Boolean(value) }).catch(() => { canGoBack = false })
    void nativeCanGoForward?.().then(value => { canGoForward = Boolean(value) }).catch(() => { canGoForward = false })
  }

  const onElectrobunEvent = (eventName: string, handler: (detail: unknown) => void) => {
    webview.on?.(eventName, event => handler(event.detail))
  }

  onElectrobunEvent('load-started', detail => {
    loading = true
    currentUrl = eventUrl(detail, currentUrl)
    dispatchWebviewCompatEvent(webview, 'did-start-loading', detail, currentUrl)
  })
  onElectrobunEvent('dom-ready', detail => {
    currentUrl = eventUrl(detail, currentUrl)
    dispatchWebviewCompatEvent(webview, 'dom-ready', detail, currentUrl)
    refreshNav()
  })
  onElectrobunEvent('load-finished', detail => {
    loading = false
    currentUrl = eventUrl(detail, currentUrl)
    dispatchWebviewCompatEvent(webview, 'did-stop-loading', detail, currentUrl)
    refreshNav()
  })
  onElectrobunEvent('did-navigate', detail => {
    currentUrl = eventUrl(detail, currentUrl)
    dispatchWebviewCompatEvent(webview, 'did-navigate', detail, currentUrl)
    refreshNav()
  })
  onElectrobunEvent('did-navigate-in-page', detail => {
    currentUrl = eventUrl(detail, currentUrl)
    dispatchWebviewCompatEvent(webview, 'did-navigate-in-page', detail, currentUrl)
    refreshNav()
  })
  onElectrobunEvent('new-window-open', detail => {
    dispatchWebviewCompatEvent(webview, 'new-window', detail, currentUrl)
  })
  onElectrobunEvent('host-message', detail => {
    const event = new Event('console-message') as Electron.ConsoleMessageEvent
    ;(event as unknown as { message: string }).message = typeof detail === 'string' ? detail : JSON.stringify(detail)
    webview.dispatchEvent(event)
  })

  webview.loadURL = async (url: string) => {
    currentUrl = url
    loading = true
    dispatchWebviewCompatEvent(webview, 'did-start-loading', url, currentUrl)
    nativeLoadURL(url)
  }
  webview.getURL = () => currentUrl || String(webview.getAttribute('src') ?? '')
  webview.getTitle = () => currentUrl || 'Browser'
  ;(webview as Electron.WebviewTag).canGoBack = () => canGoBack
  ;(webview as Electron.WebviewTag).canGoForward = () => canGoForward
  webview.isLoading = () => loading
  webview.stop = () => {
    loading = false
    dispatchWebviewCompatEvent(webview, 'did-stop-loading', currentUrl, currentUrl)
  }
  webview.setUserAgent = () => { /* Electrobun webview tag has no per-view UA setter yet */ }
  webview.openDevTools = () => { nativeOpenDevTools?.() }
  webview.insertCSS = async (css: string) => {
    nativeExecuteJavascript(`(() => { const style = document.createElement('style'); style.textContent = ${JSON.stringify(css)}; document.documentElement.appendChild(style); })()`)
    return ''
  }
  webview.executeJavaScript = async (script: string) => {
    nativeExecuteJavascript(script)
    return null
  }
  webview.send = async () => { /* host-message bridge is available through Electrobun preload */ }

  requestAnimationFrame(() => {
    webview.syncDimensions?.(true)
    refreshNav()
  })

  return webview
}

function createManagedWebview(tileId: string, src: string, bgColor = '#111317'): Electron.WebviewTag {
  const candidate = document.createElement('webview') as Electron.WebviewTag & { loadURL?: unknown; executeJavaScript?: unknown }
  const hasElectronWebviewApi = typeof candidate.loadURL === 'function' && typeof candidate.executeJavaScript === 'function'
  if (!hasElectronWebviewApi) return createElectrobunWebview(src, bgColor) ?? createFallbackWebview(src, bgColor)

  const webview = candidate as Electron.WebviewTag
  webview.setAttribute('partition', `persist:browser-tile-${tileId}`)
  webview.setAttribute('useragent', DESKTOP_UA)
  // backgroundColor sets the Chromium compositor surface color — prevents white flash before content loads
  webview.setAttribute('webpreferences', `devTools=yes, backgroundColor=${bgColor}`)
  webview.style.cssText =
    `position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: none; background: ${bgColor};`
  webview.src = src
  return webview
}

function getOrCreateManagedWebview(tileId: string, src: string, bgColor?: string): { webview: Electron.WebviewTag; reused: boolean } {
  const existing = webviewRegistry.get(tileId)
  if (existing) {
    if (existing.disposeTimer !== null) window.clearTimeout(existing.disposeTimer)
    existing.disposeTimer = null

    // Reusing a detached webview is unstable: Electron may have already torn
    // down its guest instance, which shows up later as Invalid guestInstanceId.
    if (existing.webview.isConnected || existing.webview.parentElement) {
      return { webview: existing.webview, reused: true }
    }

    try { existing.webview.remove() } catch { /* ignore */ }
    webviewRegistry.delete(tileId)
  }

  const webview = createManagedWebview(tileId, src, bgColor)
  webviewRegistry.set(tileId, { webview, disposeTimer: null })
  return { webview, reused: false }
}

function scheduleManagedWebviewDisposal(tileId: string, webview: Electron.WebviewTag): void {
  const entry = webviewRegistry.get(tileId)
  if (!entry || entry.webview !== webview) return

  if (entry.disposeTimer !== null) window.clearTimeout(entry.disposeTimer)

  entry.disposeTimer = window.setTimeout(() => {
    const latest = webviewRegistry.get(tileId)
    if (!latest || latest.webview !== webview) return
    if (webview.parentElement) webview.parentElement.removeChild(webview)
    try { webview.remove() } catch { /* ignore */ }
    webviewRegistry.delete(tileId)
  }, WEBVIEW_DISPOSE_DELAY_MS)
}

function safeLoadURL(webview: Electron.WebviewTag, url: string): void {
  if (!webview.isConnected || !webview.parentElement) {
    webview.src = url
    return
  }
  try {
    void webview.loadURL(url).catch((err: { code?: string }) => {
      if (err?.code === 'ERR_ABORTED') return
      console.warn('[BrowserTile] loadURL failed:', err)
    })
  } catch (err) {
    webview.src = url
    console.warn('[BrowserTile] loadURL threw:', err)
  }
}

// ---------------------------------------------------------------------------
// Cluso injection script — ported verbatim from 1code agent-preview.tsx
// ---------------------------------------------------------------------------

/**
 * CLUSO_INJECTION_SCRIPT generator.
 *
 * Builds a self-executing JS string that, when evaluated inside a webview,
 * polyfills localStorage (for sandboxed contexts), creates an isolated
 * shadow-DOM-like mount point, injects the Cluso embed CSS/JS, and wires
 * up __CLUSO_HOST__ lifecycle hooks.  The returned string is passed to
 * webview.executeJavaScript() after every page load.
 */
const createClusoInjectScript = (jsContent: string, cssContent: string): string => `
(() => {
  // Polyfill localStorage for sandboxed/blank webviews where access is denied
  try { void window.localStorage; } catch {
    const _memStore = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k) => Object.prototype.hasOwnProperty.call(_memStore, k) ? _memStore[k] : null,
        setItem: (k, v) => { _memStore[k] = String(v); },
        removeItem: (k) => { delete _memStore[k]; },
        clear: () => { for (const k in _memStore) delete _memStore[k]; },
        key: (i) => Object.keys(_memStore)[i] ?? null,
        get length() { return Object.keys(_memStore).length; },
      },
      writable: false,
      configurable: true,
    });
  }

  const ROOT_ID = '__huggi_cluso_root__';
  const MOUNT_ID = '__huggi_cluso_mount__';
  const CSS_ID = '__huggi_cluso_css__';
  const FLAG = '__huggiClusoBooting__';
  const TOOLBAR_POSITION_KEY = 'feedback-toolbar-position';
  const DEFAULT_TOOLBAR_WIDTH = ${CLUSO_TOOLBAR_WIDTH};
  const DEFAULT_TOOLBAR_HEIGHT = ${CLUSO_TOOLBAR_HEIGHT};
  const DEFAULT_TOOLBAR_BOTTOM_OFFSET = ${CLUSO_TOOLBAR_BOTTOM_OFFSET};
  const VISIBILITY_STYLE_ID = '__huggi_cluso_visibility__';
  const DESIRED_ACTIVE_KEY = '__huggi_cluso_desired_active__';

  function log(message) {
    try { console.log(message); } catch {}
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      root.style.cssText = [
        'position:fixed',
        'inset:0',
        'pointer-events:none',
        'z-index:2147483646',
        'contain:layout style paint',
        'background:transparent'
      ].join(';');
      document.body.appendChild(root);
    }
    return root;
  }

  function ensureMount(root) {
    let mount = document.getElementById(MOUNT_ID);
    if (!mount) {
      mount = document.createElement('div');
      mount.id = MOUNT_ID;
      mount.style.cssText = [
        'position:fixed',
        'inset:0',
        'pointer-events:none',
        'background:transparent'
      ].join(';');
      root.appendChild(mount);
    }
    return mount;
  }

  function ensureCss() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = ${JSON.stringify(cssContent)};
    document.head.appendChild(style);
  }

  function ensureVisibilityCss() {
    if (document.getElementById(VISIBILITY_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = VISIBILITY_STYLE_ID;
    style.textContent = [
      'html[data-huggi-cluso-active="false"] [data-cluso-toolbar] {',
      '  opacity: 0 !important;',
      '  pointer-events: none !important;',
      '  visibility: hidden !important;',
      '}',
    ].join('\\n');
    document.head.appendChild(style);
  }

  function syncToolbarVisibility(active) {
    try {
      document.documentElement.dataset.huggiClusoActive = active ? 'true' : 'false';
    } catch {}
  }

  function getDesiredActive() {
    return typeof window[DESIRED_ACTIVE_KEY] === 'boolean' ? !!window[DESIRED_ACTIVE_KEY] : null;
  }

  function getDefaultToolbarPosition() {
    return {
      x: Math.max(20, Math.round((window.innerWidth - DEFAULT_TOOLBAR_WIDTH) / 2)),
      y: Math.max(20, Math.round(window.innerHeight - DEFAULT_TOOLBAR_HEIGHT - DEFAULT_TOOLBAR_BOTTOM_OFFSET)),
    };
  }

  function seedToolbarPosition(force) {
    try {
      if (!force && localStorage.getItem(TOOLBAR_POSITION_KEY)) return;
      localStorage.setItem(TOOLBAR_POSITION_KEY, JSON.stringify(getDefaultToolbarPosition()));
    } catch {}
  }

  const root = ensureRoot();
  const mount = ensureMount(root);
  ensureCss();
  ensureVisibilityCss();
  seedToolbarPosition(false);
  syncToolbarVisibility(false);

  window.__CLUSO_EMBEDDED_CONFIG__ = {
    runtimeMode: 'embedded-release',
    showToolbar: true,
    hideCollapsedToolbar: true,
    defaultActive: getDesiredActive() ?? false,
    autoExitAfterSubmit: true,
    copyToClipboard: true,
    submitButtonLabel: 'Send to App',
    outputDetail: "forensic",
    visibleControls: {
      pause: true,
      markers: true,
      copy: true,
      send: true,
      clear: true,
      settings: true,
      inspector: false,
      exit: true,
    },
  };

  if (window[FLAG]) {
    return '__CLUSO_ALREADY_BOOTING__';
  }

  if (window.__CLUSO_HOST__) {
    const desiredActive = getDesiredActive();
    if (typeof desiredActive === 'boolean' && typeof window.__CLUSO_HOST__.setActive === 'function') {
      window.__CLUSO_HOST__.setActive(desiredActive);
    }
    syncToolbarVisibility(
      typeof window.__CLUSO_HOST__.getActive === 'function'
        ? !!window.__CLUSO_HOST__.getActive()
        : !!window.__CLUSO_HOST__.active
    );
    log('__CLUSO_READY__:' + JSON.stringify({
      reused: true,
      active: typeof window.__CLUSO_HOST__.getActive === 'function'
        ? !!window.__CLUSO_HOST__.getActive()
        : !!window.__CLUSO_HOST__.active,
    }));
    return '__CLUSO_ALREADY_READY__';
  }

  window[FLAG] = true;

  const originalGetElementById = document.getElementById.bind(document);
  document.getElementById = function(id) {
    if (id === 'root') return mount;
    return originalGetElementById(id);
  };

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.getElementById = originalGetElementById;
    window[FLAG] = false;
  };

  const emitReady = () => {
    const host = window.__CLUSO_HOST__;
    const active = host
      ? (typeof host.getActive === 'function' ? !!host.getActive() : !!host.active)
      : false;
    syncToolbarVisibility(active);
    log('__CLUSO_READY__:' + JSON.stringify({ embedded: true, active }));
  };

  const patchHost = (host) => {
    if (!host || host.__huggiClusoPatched) return;
    host.__huggiClusoPatched = true;

    const sync = () => {
      const active = typeof host.getActive === 'function' ? !!host.getActive() : !!host.active;
      syncToolbarVisibility(active);
    };

    if (typeof host.setActive === 'function') {
      const originalSetActive = host.setActive.bind(host);
      host.setActive = (nextActive) => {
        const result = originalSetActive(nextActive);
        window.setTimeout(sync, 0);
        return result;
      };
    }

    if (typeof host.toggleActive === 'function') {
      const originalToggleActive = host.toggleActive.bind(host);
      host.toggleActive = () => {
        const result = originalToggleActive();
        window.setTimeout(sync, 0);
        return result;
      };
    }

    sync();
  };

  const waitForHost = (attempt) => {
    if (window.__CLUSO_HOST__) {
      patchHost(window.__CLUSO_HOST__);
      const desiredActive = getDesiredActive();
      if (typeof desiredActive === 'boolean' && typeof window.__CLUSO_HOST__.setActive === 'function') {
        window.__CLUSO_HOST__.setActive(desiredActive);
      }
      restore();
      window.setTimeout(emitReady, 0);
      return;
    }
    if (attempt < 40) {
      window.setTimeout(() => waitForHost(attempt + 1), 50);
      return;
    }
    restore();
    log('__CLUSO_ERROR__:' + JSON.stringify({
      stage: 'host',
      message: 'Cluso host bridge did not register in time',
    }));
  };

  try {
    ${jsContent}
    waitForHost(0);
    return '__CLUSO_INJECTED__';
  } catch (error) {
    restore();
    log('__CLUSO_ERROR__:' + JSON.stringify({
      stage: 'execute',
      message: error && error.message ? String(error.message) : String(error),
    }));
    return '__CLUSO_EXECUTE_ERROR__';
  }
})();
`

// ---------------------------------------------------------------------------
// Bus bridge injection script — lets webview content publish to the EventBus
// ---------------------------------------------------------------------------

function createBusBridgeScript(tileId: string): string {
  return `
    (function() {
      if (window.__contexBridge) return;
      window.__contexBridge = true;

      // Allow webview content to send events to the host via console.log transport
      window.contex = {
        publish: function(type, payload, channel) {
          console.log(JSON.stringify({
            __contex: true,
            type: type || 'data',
            channel: channel || 'tile:${tileId}',
            payload: payload || {}
          }));
        },
        notify: function(message, level) {
          this.publish('notification', { message: message, level: level || 'info' });
        },
        progress: function(status, percent) {
          this.publish('progress', { status: status, percent: percent });
        },
        log: function(message) {
          this.publish('activity', { message: message });
        }
      };
    })();
  `
}

function createClusoSetActiveScript(nextActive: boolean): string {
  return `
    (() => {
      window.__huggi_cluso_desired_active__ = ${nextActive ? 'true' : 'false'};
      try {
        document.documentElement.dataset.huggiClusoActive = ${nextActive ? '"true"' : '"false"'};
      } catch {}
      const host = window.__CLUSO_HOST__;
      if (!host) return '__CLUSO_PENDING__';
      try {
        if (${nextActive ? 'true' : 'false'}) {
          const position = {
            x: Math.max(20, Math.round((window.innerWidth - ${CLUSO_TOOLBAR_WIDTH}) / 2)),
            y: Math.max(20, Math.round(window.innerHeight - ${CLUSO_TOOLBAR_HEIGHT} - ${CLUSO_TOOLBAR_BOTTOM_OFFSET})),
          };
          try {
            localStorage.setItem('feedback-toolbar-position', JSON.stringify(position));
          } catch {}
        }

        if (typeof host.setActive === 'function') {
          host.setActive(${nextActive ? 'true' : 'false'});
          return '__CLUSO_TOGGLED__';
        }

        if (typeof host.toggleActive === 'function') {
          const current = typeof host.getActive === 'function' ? !!host.getActive() : !!host.active;
          if (current !== ${nextActive ? 'true' : 'false'}) {
            host.toggleActive();
          }
          return '__CLUSO_TOGGLED__';
        }

        return '__CLUSO_NO_HOST_API__';
      } catch (error) {
        return '__CLUSO_TOGGLE_ERROR__:' + (error && error.message ? String(error.message) : String(error));
      }
    })();
  `
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------
function isLikelyUrl(value: string): boolean {
  if (!value) return false
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(value)) return true
  if (/^localhost(?::\d+)?(\/|$)/i.test(value)) return true
  if (/^127\.0\.0\.1(?::\d+)?(\/|$)/.test(value)) return true
  if (value.includes('.') && !value.includes(' ')) return true
  return false
}

function isAllowedBrowserUrl(value: string): boolean {
  if (value === 'about:blank') return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function shouldInjectHostBridge(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
  } catch {
    return false
  }
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return HOMEPAGE
  if (trimmed === 'about:blank') return trimmed
  if (isLikelyUrl(trimmed)) {
    if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) {
      return isAllowedBrowserUrl(trimmed) ? trimmed : HOMEPAGE
    }
    if (/^localhost(?::\d+)?(\/|$)/i.test(trimmed) || /^127\.0\.0\.1(?::\d+)?(\/|$)/.test(trimmed))
      return `http://${trimmed}`
    return `https://${trimmed}`
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

// ---------------------------------------------------------------------------
// ToolbarButton
// ---------------------------------------------------------------------------
function ToolbarButton({
  label,
  title,
  disabled,
  active,
  onClick,
  children
}: {
  label?: string
  title: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const theme = useTheme()
  const fonts = useAppFonts()
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (disabled) return
    e.preventDefault()
    onClick()
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    // Keyboard activation still dispatches click with detail=0.
    if (!disabled && e.detail === 0) onClick()
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: disabled ? theme.text.disabled : active ? theme.accent.hover : theme.text.secondary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: fonts.secondarySize
      }}
      onMouseEnter={e => {
        if (disabled || active) return
        e.currentTarget.style.color = theme.text.primary
      }}
      onMouseLeave={e => {
        if (disabled || active) return
        e.currentTarget.style.color = theme.text.secondary
      }}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  tileId: string
  workspaceId?: string
  initialUrl?: string
  width: number
  height: number
  zIndex: number
  isInteracting?: boolean
  isVisible?: boolean
  connectedPeers?: string[]
  hideNavbar?: boolean
}

type BrowserMode = 'desktop' | 'mobile'
type BrowserEvidenceFilter = 'all' | 'issues' | 'console' | 'load-failure' | 'lifecycle'

const BROWSER_EVIDENCE_FILTERS: Array<{ id: BrowserEvidenceFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'issues', label: 'Issues' },
  { id: 'console', label: 'Console' },
  { id: 'load-failure', label: 'Loads' },
  { id: 'lifecycle', label: 'Lifecycle' },
]

function matchesEvidenceFilter(event: BrowserEvidenceEvent, filter: BrowserEvidenceFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'issues') return event.severity === 'error' || event.severity === 'warning'
  return event.kind === filter
}


// ---------------------------------------------------------------------------
// BrowserTile
// ---------------------------------------------------------------------------
export function BrowserTile({ tileId, workspaceId, initialUrl, width, height, zIndex: _zIndex, isInteracting, isVisible = true, connectedPeers = [], hideNavbar = false }: Props): React.JSX.Element {
  const theme = useTheme()
  const fonts = useAppFonts()
  const browserBackground = theme.surface.panel
  const browserToolbarBackground = theme.surface.titlebar
  const browserBorder = theme.border.default
  const browserBackgroundRef = useRef(browserBackground)
  browserBackgroundRef.current = browserBackground
  const wvContainerRef = useRef<HTMLDivElement>(null)
  const wvRef = useRef<Electron.WebviewTag | null>(null)
  const wvReadyRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)
  const clusoToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerRelayUnsubscribeRef = useRef<(() => void) | null>(null)
  const mcpCommandUnsubscribeRef = useRef<(() => void) | null>(null)
  const browserEvidenceRef = useRef<BrowserEvidenceEvent[]>([])

  // Track component mount state for async cleanup
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (clusoToggleTimerRef.current !== null) {
        clearTimeout(clusoToggleTimerRef.current)
        clusoToggleTimerRef.current = null
      }
    }
  }, [])

  const initialSrc = useRef(normalizeUrl(initialUrl ?? ''))
  const startUrl = initialSrc.current

  const [addressBar, setAddressBar] = useState(startUrl)
  const [currentUrl, setCurrentUrl] = useState(startUrl)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<BrowserMode>('desktop')
  const [isClusoReady, setIsClusoReady] = useState(false)
  const [isClusoActive, setIsClusoActive] = useState(false)
  const [isToolbarHovered, setIsToolbarHovered] = useState(false)
  const [isAddressFocused, setIsAddressFocused] = useState(false)
  const [stateLoaded, setStateLoaded] = useState(!workspaceId)
  const [pageTitle, setPageTitle] = useState('')
  const [browserEvidence, setBrowserEvidence] = useState<BrowserEvidenceEvent[]>([])
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false)
  const [evidenceFilter, setEvidenceFilter] = useState<BrowserEvidenceFilter>('issues')
  const [copyStatus, setCopyStatus] = useState('')
  const [lastSnapshotAt, setLastSnapshotAt] = useState<number | null>(null)
  const browserPageStateRef = useRef({ url: startUrl, title: '', isLoading: false, mode: 'desktop' as BrowserMode })
  browserPageStateRef.current = { url: currentUrl, title: pageTitle, isLoading, mode }

  const createCurrentEvidenceSnapshot = useCallback((events = browserEvidenceRef.current) => {
    const page = browserPageStateRef.current
    return createBrowserEvidenceSnapshot({
      tileId,
      url: page.url,
      title: page.title,
      isLoading: page.isLoading,
      mode: page.mode,
      events,
    })
  }, [tileId])

  const publishEvidenceSnapshot = useCallback((reason: string, events = browserEvidenceRef.current) => {
    const snapshot = createCurrentEvidenceSnapshot(events)
    const report = formatBrowserEvidenceReport(snapshot)
    setLastSnapshotAt(snapshot.capturedAt)
    window.electron?.bus?.publish(
      `tile:${tileId}`,
      'browser.evidence.snapshot',
      `browser:${tileId}`,
      { reason, snapshot, report },
    )
    window.electron?.bus?.publish(
      `tile:${tileId}`,
      'browser.page_health',
      `browser:${tileId}`,
      {
        reason,
        health: snapshot.health,
        page: snapshot.page,
        summary: snapshot.summary,
      },
    )
    return snapshot
  }, [createCurrentEvidenceSnapshot, tileId])

  const recordBrowserEvidence = useCallback((input: Omit<BrowserEvidenceInput, 'tileId'>) => {
    const event = createBrowserEvidenceEvent({ tileId, ...input })
    const next = appendBrowserEvidence(browserEvidenceRef.current, event)
    browserEvidenceRef.current = next
    setBrowserEvidence(next)
    const snapshot = createCurrentEvidenceSnapshot(next)
    window.electron?.bus?.publish(
      `tile:${tileId}`,
      'browser.evidence',
      `browser:${tileId}`,
      { event, summary: snapshot.summary, health: snapshot.health, page: snapshot.page },
    )
    window.electron?.bus?.publish(
      `tile:${tileId}`,
      'browser.page_health',
      `browser:${tileId}`,
      { reason: 'evidence-recorded', health: snapshot.health, page: snapshot.page, summary: snapshot.summary },
    )
  }, [createCurrentEvidenceSnapshot, tileId])

  const browserEvidenceSummary = summarizeBrowserEvidence(browserEvidence)
  const browserPageHealth = createBrowserPageHealth(browserEvidenceSummary, isLoading)
  const filteredBrowserEvidence = browserEvidence
    .filter(event => matchesEvidenceFilter(event, evidenceFilter))
    .slice()
    .reverse()
  const issueBadgeCount = browserEvidenceSummary.errorCount || browserEvidenceSummary.warningCount || browserEvidenceSummary.total
  const evidenceHealthColor = browserPageHealth.status === 'error'
    ? theme.status.danger
    : browserPageHealth.status === 'warning'
      ? theme.status.warning
      : browserPageHealth.status === 'loading'
        ? theme.accent.base
        : theme.status.success

  useEffect(() => {
    setStateLoaded(!workspaceId)
    if (!workspaceId) return
    window.electron.canvas.loadTileState(workspaceId, tileId).then((saved: any) => {
      if (!saved) return
      if (typeof saved.addressBar === 'string') setAddressBar(saved.addressBar)
      if (typeof saved.currentUrl === 'string') {
        setCurrentUrl(saved.currentUrl)
        initialSrc.current = saved.currentUrl
        prevInitialUrl.current = saved.currentUrl
        if (wvRef.current) {
          if (wvReadyRef.current) safeLoadURL(wvRef.current, saved.currentUrl)
          else wvRef.current.src = saved.currentUrl
        }
      }
      if (typeof saved.canGoBack === 'boolean') setCanGoBack(saved.canGoBack)
      if (typeof saved.canGoForward === 'boolean') setCanGoForward(saved.canGoForward)
      if (typeof saved.isLoading === 'boolean') setIsLoading(saved.isLoading)
      if (saved.mode === 'desktop' || saved.mode === 'mobile') setMode(saved.mode)
    }).catch(() => {}).finally(() => {
      setStateLoaded(true)
    })
  }, [workspaceId, tileId])

  useEffect(() => {
    if (!workspaceId || !stateLoaded) return
    window.electron.canvas.saveTileState(workspaceId, tileId, {
      addressBar,
      currentUrl,
      canGoBack,
      canGoForward,
      isLoading,
      mode,
    }).catch(() => {})
  }, [workspaceId, tileId, addressBar, currentUrl, canGoBack, canGoForward, isLoading, mode])

  useEffect(() => {
    if (!workspaceId || !window.electron?.tileContext) return
    void Promise.allSettled([
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:browser:url', currentUrl),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:browser:title', pageTitle),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:browser:mode', mode),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:browser:loading', isLoading),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:browser:evidence_summary', browserEvidenceSummary),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:browser:page_health', browserPageHealth),
      window.electron.tileContext.set(workspaceId, tileId, 'ctx:browser:navigation', {
        currentUrl,
        title: pageTitle,
        canGoBack,
        canGoForward,
        isLoading,
        mode,
      }),
    ])
  }, [workspaceId, tileId, currentUrl, pageTitle, mode, isLoading, canGoBack, canGoForward, browserEvidenceSummary.total, browserEvidenceSummary.errorCount, browserEvidenceSummary.warningCount, browserPageHealth.status])

  // Fan-out bus traffic from this browser tile to canvas peers (unrelated to ContexRelay mailbox).
  useEffect(() => {
    const peers = new Set(connectedPeers)
    if (!window.electron?.bus || peers.size === 0) {
      if (peerRelayUnsubscribeRef.current) {
        peerRelayUnsubscribeRef.current()
        peerRelayUnsubscribeRef.current = null
      }
      return
    }

    if (peerRelayUnsubscribeRef.current) {
      peerRelayUnsubscribeRef.current()
      peerRelayUnsubscribeRef.current = null
    }

    const unsubscribe = window.electron.bus.subscribe(`tile:${tileId}`, `browser:${tileId}:relay`, (evt) => {
      // Forward only traffic that originated from this browser's web content to peers.
      // This prevents unrelated channel traffic from being mirrored infinitely.
      if (!String(evt.source || '').startsWith(`browser:${tileId}`)) {
        return
      }

      for (const peerId of peers) {
        if (peerId === tileId) continue
        window.electron.bus.publish(
          `tile:${peerId}`,
          evt.type,
          `browser-relay:${tileId}`,
          {
            ...evt.payload,
            fromTile: tileId,
            relayFrom: String(evt.source || '').replace(`browser:${tileId}`, 'browser'),
            originChannel: evt.channel,
          }
        )
      }
    })

    peerRelayUnsubscribeRef.current = unsubscribe
    return () => {
      if (peerRelayUnsubscribeRef.current) {
        peerRelayUnsubscribeRef.current()
        peerRelayUnsubscribeRef.current = null
      }
    }
  }, [connectedPeers, tileId])

  // Cluso embed assets — loaded once on mount
  const clusoAssetsRef = useRef<{ js: string | null; css: string | null }>({
    js: clusoEmbedJs || null,
    css: clusoEmbedCss || null,
  })

  // Stable setter refs — avoid re-adding event listeners when state changes
  const setCurrentUrlRef = useRef(setCurrentUrl)
  setCurrentUrlRef.current = setCurrentUrl
  const setPageTitleRef = useRef(setPageTitle)
  setPageTitleRef.current = setPageTitle
  const setAddressBarRef = useRef(setAddressBar)
  setAddressBarRef.current = setAddressBar
  const setCanGoBackRef = useRef(setCanGoBack)
  setCanGoBackRef.current = setCanGoBack
  const setCanGoForwardRef = useRef(setCanGoForward)
  setCanGoForwardRef.current = setCanGoForward
  const setIsLoadingRef = useRef(setIsLoading)
  setIsLoadingRef.current = setIsLoading
  const setIsClusoReadyRef = useRef(setIsClusoReady)
  setIsClusoReadyRef.current = setIsClusoReady
  const setIsClusoActiveRef = useRef(setIsClusoActive)
  setIsClusoActiveRef.current = setIsClusoActive

  const executeInWebview = useCallback((script: string): Promise<unknown> => {
    const webview = wvRef.current
    if (!webview || !mountedRef.current) return Promise.reject(new Error('Webview unavailable'))

    if (wvReadyRef.current) {
      return webview.executeJavaScript(script)
    }

    return new Promise((resolve, reject) => {
      const onReady = () => {
        if (!mountedRef.current || !wvReadyRef.current) {
          cleanup()
          reject(new Error('Webview became unavailable before ready'))
          return
        }
        webview.executeJavaScript(script).then(resolve).catch(reject).finally(cleanup)
      }

      const cleanup = () => {
        clearTimeout(timeout)
        webview.removeEventListener('dom-ready', onReady)
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Webview ready timeout'))
      }, 5000)

      webview.addEventListener('dom-ready', onReady)
    })
  }, [])

  // Inject cluso into the webview — called after each page load
  const injectCluso = useCallback(() => {
    const { js, css } = clusoAssetsRef.current
    if (!js || !css) {
      console.warn('[Cluso] Assets not loaded yet — skipping injection')
      return
    }
    setIsClusoReadyRef.current(false)
    setIsClusoActiveRef.current(false)
    executeInWebview(createClusoInjectScript(js, css))
      .then(result => {
        if (typeof result === 'string' && result.includes('ERROR')) console.error('[Cluso] Injection error:', result)
      })
      .catch(err => console.error('[Cluso] Injection failed:', err))
  }, [executeInWebview]) // stable — reads assets via ref

  // Load bundled cluso embed assets (once per mount)
  useEffect(() => {
    clusoAssetsRef.current = {
      js: clusoEmbedJs || null,
      css: clusoEmbedCss || null,
    }

    if (!clusoAssetsRef.current.js || !clusoAssetsRef.current.css) {
      console.warn('[Cluso] Bundled embed assets are missing — inspector will not work')
      return
    }

    // The page can finish loading before the component mount effect runs.
    // If that happened, retry injection now instead of waiting for another navigation.
    if (mountedRef.current && wvReadyRef.current) injectCluso()
  }, [injectCluso])

  // Create or reattach the webview imperatively so page state survives view switches
  useEffect(() => {
    // Wait for persisted tile state before creating a fresh webview, otherwise
    // remounts can briefly boot to HOMEPAGE and then navigate back.
    if (!stateLoaded) return

    const container = wvContainerRef.current
    if (!container) return

    const { webview, reused } = getOrCreateManagedWebview(tileId, initialSrc.current, browserBackground)

    wvRef.current = webview
    wvReadyRef.current = false

    // Sync webview background with current theme so it doesn't flash white
    webview.style.background = browserBackground

    // ---- helpers --------------------------------------------------------
    const updateNav = () => {
      if (!wvRef.current || !wvReadyRef.current) return
      try {
        const url = wvRef.current.getURL()
        if (url) {
          setCurrentUrlRef.current(url)
          if (document.activeElement !== inputRef.current) {
            setAddressBarRef.current(url)
          }
          window.electron?.bus?.publish(
            `tile:${tileId}`,
            'activity',
            `browser:${tileId}`,
            { kind: 'navigation', event: 'navigated', url }
          )
        }
        const title = wvRef.current.getTitle?.() || ''
        setPageTitleRef.current(title)
        setCanGoBackRef.current(wvRef.current.canGoBack())
        setCanGoForwardRef.current(wvRef.current.canGoForward())
        setIsLoadingRef.current(wvRef.current.isLoading())
      } catch {
        wvReadyRef.current = false
      }
    }

    // ---- dark mode background injection -----------------------------------
    // Inject a low-specificity dark background into the webview content so
    // pages that don't set their own background (about:blank, loading states)
    // don't flash white.  Real pages override this with their own styles.
    const injectDarkBackground = () => {
      if (!webview || !wvReadyRef.current) return
      const bg = browserBackgroundRef.current
      webview.insertCSS(
        `html:not([style*="background"]):not([class]) { background-color: ${bg} !important; }` +
        `body:not([style*="background"]):not([class]) { background-color: ${bg} !important; }`
      ).catch(() => { /* webview may not be ready yet */ })
    }

    // ---- event handlers -------------------------------------------------
    const onDomReady = () => {
      wvReadyRef.current = true
      injectDarkBackground()
      updateNav()
    }

    const onStartLoad = () => setIsLoadingRef.current(true)

    const onStopLoad = () => {
      setIsLoadingRef.current(false)
      updateNav()
      // Reset cluso state and re-inject after each page load
      setIsClusoReadyRef.current(false)
      setIsClusoActiveRef.current(false)
      injectCluso()
      // Inject bus bridge so webview content can publish to the EventBus
      if (shouldInjectHostBridge(webview.getURL())) {
        executeInWebview(createBusBridgeScript(tileId))
          .catch(err => console.warn('[BrowserTile] Bus bridge injection failed:', err))
      }
    }

    const onFrameFinishLoad = (e: Event) => {
      const ev = e as Event & { isMainFrame?: boolean }
      if (ev.isMainFrame === false) return
      updateNav()
      recordBrowserEvidence({
        kind: 'lifecycle',
        message: 'Frame finished loading',
        url: webview.getURL(),
        details: {
          title: webview.getTitle?.() || '',
          isLoading: webview.isLoading(),
        },
      })
    }

    const onFailLoad = (e: Event) => {
      setIsLoadingRef.current(false)
      setIsClusoReadyRef.current(false)
      setIsClusoActiveRef.current(false)

      const ev = e as Event & {
        errorCode?: number
        errorDescription?: string
        validatedURL?: string
        url?: string
        isMainFrame?: boolean
      }
      recordBrowserEvidence({
        kind: 'load-failure',
        message: ev.errorDescription || `Load failed${typeof ev.errorCode === 'number' ? ` (${ev.errorCode})` : ''}`,
        url: ev.validatedURL || ev.url || webview.getURL(),
        errorCode: ev.errorCode,
        details: typeof ev.isMainFrame === 'boolean' ? { isMainFrame: ev.isMainFrame } : undefined,
      })
    }

    const onNavigate = () => updateNav()
    const onNavigateInPage = () => updateNav()
    const onWillNavigate = (e: Event) => {
      const ev = e as Event & { url?: string }
      if (!ev.url || isAllowedBrowserUrl(ev.url)) return
      e.preventDefault()
      void webview.loadURL(HOMEPAGE)
    }

    const onNewWindow = (e: Event) => {
      const ev = e as Event & { url?: string }
      if (ev.url) {
        e.preventDefault()
        void dispatchOpenLink(ev.url)
      }
    }

    // ---- console message handler (bus bridge + cluso) -------------------
    const onConsoleMessage = (e: Electron.ConsoleMessageEvent) => {
      const consoleEvent = e as Electron.ConsoleMessageEvent & {
        level?: string | number
        sourceId?: string
        line?: number
        column?: number
      }
      const { message } = consoleEvent

      if (message.startsWith('{"__contex"')) {
        try {
          const data = JSON.parse(message) as {
            __contex?: boolean
            type?: string
            channel?: string
            payload?: Record<string, unknown>
          }
          if (data.__contex) {
            window.electron?.bus?.publish(
              data.channel || `tile:${tileId}`,
              data.type || 'data',
              `browser:${tileId}`,
              data.payload || {}
            )
          }
        } catch { /* not valid JSON — ignore */ }
        return
      }

      if (!message.startsWith('__CLUSO_')) {
        recordBrowserEvidence({
          kind: 'console',
          message,
          level: consoleEvent.level,
          source: consoleEvent.sourceId,
          line: consoleEvent.line,
          column: consoleEvent.column,
          url: webview.getURL(),
        })
        return
      }

      if (message.startsWith('__CLUSO_READY__')) {
        setIsClusoReadyRef.current(true)
        const payloadText = message.startsWith('__CLUSO_READY__:')
          ? message.slice('__CLUSO_READY__:'.length)
          : null
        if (payloadText) {
          try {
            const payload = JSON.parse(payloadText) as { active?: boolean }
            if (typeof payload.active === 'boolean') {
              setIsClusoActiveRef.current(payload.active)
            }
          } catch { /* ignore malformed */ }
        }
        console.log('[BrowserTile] Cluso ready')
        return
      }

      if (message.startsWith('__CLUSO_ACTIVE__:')) {
        try {
          const payload = JSON.parse(message.slice('__CLUSO_ACTIVE__:'.length)) as { active?: boolean }
          setIsClusoActiveRef.current(Boolean(payload.active))
        } catch { /* ignore */ }
        return
      }

      if (message.startsWith('__CLUSO_ERROR__')) {
        console.error('[BrowserTile] Cluso error:', message)
        return
      }
    }

    // ---- register -------------------------------------------------------
    webview.addEventListener('dom-ready', onDomReady)
    webview.addEventListener('did-start-loading', onStartLoad)
    webview.addEventListener('did-stop-loading', onStopLoad)
    webview.addEventListener('did-frame-finish-load', onFrameFinishLoad)
    webview.addEventListener('did-fail-load', onFailLoad)
    webview.addEventListener('will-navigate', onWillNavigate)
    webview.addEventListener('did-navigate', onNavigate)
    webview.addEventListener('did-navigate-in-page', onNavigateInPage)
    webview.addEventListener('new-window', onNewWindow)
    webview.addEventListener('console-message', onConsoleMessage)

    // Sync Chrome cookies into this tile's session before the webview starts loading.
    // Only for fresh webviews — reused ones already have cookies from their previous session.
    const attachWebview = () => {
      if (!mountedRef.current || wvRef.current !== webview) return
      if (!container.contains(webview)) container.appendChild(webview)
    }

    if (!reused && !container.contains(webview)) {
      // Attempt Chrome cookie sync (async, best-effort)
      window.electron?.settings?.get().then((settings: any) => {
        if (!settings?.chromeSyncEnabled || !settings?.chromeSyncProfileDir) {
          attachWebview()
          return
        }
        const partition = `persist:browser-tile-${tileId}`
        window.electron?.chromeSync?.syncCookies(settings.chromeSyncProfileDir, partition)
          .then(() => attachWebview())
          .catch(() => attachWebview())
      }).catch(() => attachWebview())
    } else if (!container.contains(webview)) {
      container.appendChild(webview)
    }

    if (reused) {
      requestAnimationFrame(() => {
        if (!mountedRef.current || wvRef.current !== webview) return
        wvReadyRef.current = true
        updateNav()
        // Replayed webviews do not emit a fresh page-load cycle, so restore the
        // host-side bridge state explicitly on reattach.
        // Ensure assets are available before injecting — they load async from disk
        const tryInject = (attempt: number) => {
          const { js, css } = clusoAssetsRef.current
          if (js && css) {
            injectCluso()
          } else if (attempt < 20 && mountedRef.current) {
            setTimeout(() => tryInject(attempt + 1), 100)
          }
        }
        tryInject(0)
        if (shouldInjectHostBridge(webview.getURL())) {
          executeInWebview(createBusBridgeScript(tileId))
            .catch(err => console.warn('[BrowserTile] Bus bridge reinjection failed:', err))
        }
      })
    }

    return () => {
      webview.removeEventListener('dom-ready', onDomReady)
      webview.removeEventListener('did-start-loading', onStartLoad)
      webview.removeEventListener('did-stop-loading', onStopLoad)
      webview.removeEventListener('did-frame-finish-load', onFrameFinishLoad)
      webview.removeEventListener('did-fail-load', onFailLoad)
      webview.removeEventListener('will-navigate', onWillNavigate)
      webview.removeEventListener('did-navigate', onNavigate)
      webview.removeEventListener('did-navigate-in-page', onNavigateInPage)
      webview.removeEventListener('new-window', onNewWindow)
      webview.removeEventListener('console-message', onConsoleMessage)
      // Park the live webview offscreen instead of detaching it outright.
      // Reusing a parked guest preserves page/session state across view switches.
      const parkingRoot = getWebviewParkingRoot()
      if (container.contains(webview) || webview.parentElement !== parkingRoot) {
        parkingRoot.appendChild(webview)
      }
      wvRef.current = null
      wvReadyRef.current = false
      scheduleManagedWebviewDisposal(tileId, webview)
    }
  }, [tileId, injectCluso, recordBrowserEvidence, stateLoaded])

  // Keep webview background in sync with theme (avoids white flash on theme change)
  useEffect(() => {
    const webview = wvRef.current
    if (webview) webview.style.background = browserBackground
  }, [browserBackground])

  // Navigate when initialUrl prop changes (e.g. opened from sidebar)
  const prevInitialUrl = useRef(startUrl)
  useEffect(() => {
    const next = normalizeUrl(initialUrl ?? '')
    if (next !== prevInitialUrl.current) {
      prevInitialUrl.current = next
      setAddressBar(next)
      setCurrentUrl(next)
      if (wvReadyRef.current && wvRef.current) {
        safeLoadURL(wvRef.current, next)
      }
    }
  }, [initialUrl])

  // Electron webviews are their own compositor surface. During drag/resize
  // interactions, hiding the surface is more reliable than pointer-events:none
  // for keeping dock/drop gestures on the host document.
  useEffect(() => {
    const webview = wvRef.current
    const container = wvContainerRef.current
    if (!webview) return

    const blockPointerCapture = Boolean(!isVisible || isToolbarHovered || isAddressFocused || isInteracting)
    const hideWebviewSurface = Boolean(!isVisible || isInteracting)

    webview.style.pointerEvents = blockPointerCapture ? 'none' : 'auto'
    webview.style.visibility = hideWebviewSurface ? 'hidden' : 'visible'
    webview.style.opacity = hideWebviewSurface ? '0' : '1'

    if (container) {
      container.style.pointerEvents = blockPointerCapture ? 'none' : 'auto'
    }
  }, [isToolbarHovered, isAddressFocused, isInteracting, isVisible])

  // ---- navigation actions -----------------------------------------------
  const navigate = useCallback((rawUrl: string) => {
    const next = normalizeUrl(rawUrl)
    setAddressBar(next)
    setCurrentUrl(next)
    setIsLoading(true)
    if (wvReadyRef.current && wvRef.current) safeLoadURL(wvRef.current, next)
  }, [])

  const goBack = useCallback(() => {
    if (wvReadyRef.current && wvRef.current) wvRef.current.goBack()
  }, [])

  const goForward = useCallback(() => {
    if (wvReadyRef.current && wvRef.current) wvRef.current.goForward()
  }, [])

  const reload = useCallback(() => {
    if (wvReadyRef.current && wvRef.current) {
      setIsLoading(true)
      wvRef.current.reload()
    }
  }, [])

  const stop = useCallback(() => {
    if (wvReadyRef.current && wvRef.current) wvRef.current.stop()
  }, [])

  const goHome = useCallback(() => navigate(HOMEPAGE), [navigate])

  // Switch mobile / desktop UA and reload
  const switchMode = useCallback((next: BrowserMode) => {
    setMode(next)
    if (wvReadyRef.current && wvRef.current) {
      wvRef.current.setUserAgent(next === 'mobile' ? MOBILE_UA : DESKTOP_UA)
      wvRef.current.reload()
    }
  }, [])

  const captureEvidenceSnapshot = useCallback(() => {
    publishEvidenceSnapshot('user-capture')
  }, [publishEvidenceSnapshot])

  const clearBrowserEvidence = useCallback(() => {
    browserEvidenceRef.current = []
    setBrowserEvidence([])
    setCopyStatus('Evidence cleared')
    publishEvidenceSnapshot('user-clear', [])
  }, [publishEvidenceSnapshot])

  const copyEvidenceReport = useCallback(() => {
    const snapshot = publishEvidenceSnapshot('copy-report')
    const report = formatBrowserEvidenceReport(snapshot)
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('Clipboard unavailable')
      return
    }
    navigator.clipboard.writeText(report)
      .then(() => setCopyStatus('Report copied'))
      .catch(() => setCopyStatus('Copy failed'))
  }, [publishEvidenceSnapshot])

  const openQaWorkbench = useCallback(() => {
    publishEvidenceSnapshot('open-qa-workbench')
    dispatchCreateTile({ type: 'ext:qa-workbench', focus: true, sourceTileId: tileId })
    setCopyStatus('Opening QA Workbench')
  }, [publishEvidenceSnapshot, tileId])

  const attachQaReportToChat = useCallback(() => {
    publishEvidenceSnapshot('attach-qa-report')
    dispatchOpenChatSurface({ extId: 'qa-workbench', surfaceId: 'qa-report', sourceTileId: tileId })
    setCopyStatus('Opening QA Report in chat')
  }, [publishEvidenceSnapshot, tileId])

  // ---- MCP/peer command bridge -----------------------------------------
  useEffect(() => {
    if (!window.electron?.bus) return

    if (mcpCommandUnsubscribeRef.current) {
      mcpCommandUnsubscribeRef.current()
      mcpCommandUnsubscribeRef.current = null
    }

    const unsubscribe = window.electron.bus.subscribe(`tile:${tileId}`, `browser:${tileId}:mcp`, (evt) => {
      if (!evt?.type?.startsWith('mcp_') && !String(evt.source || '').startsWith('mcp:')) return
      const payload = (evt.payload as Record<string, unknown>) || {}
      const command = typeof payload.command === 'string' ? payload.command : ''
      if (!command) return
      if (command === 'browser_navigate' && typeof payload.url === 'string') {
        navigate(payload.url)
        return
      }
      if (command === 'browser_reload') {
        reload()
        return
      }
      if (command === 'browser_back') {
        goBack()
        return
      }
      if (command === 'browser_forward') {
        goForward()
        return
      }
      if (command === 'browser_set_mode' && (payload.mode === 'desktop' || payload.mode === 'mobile')) {
        switchMode(payload.mode)
        return
      }
      if (command === 'browser_get_evidence' || command === 'browser_capture_snapshot') {
        publishEvidenceSnapshot(command)
      }
    })

    mcpCommandUnsubscribeRef.current = unsubscribe

    return () => {
      if (mcpCommandUnsubscribeRef.current) {
        mcpCommandUnsubscribeRef.current()
        mcpCommandUnsubscribeRef.current = null
      }
    }
  }, [tileId, navigate, reload, goBack, goForward, switchMode, publishEvidenceSnapshot])

  // Toggle cluso element selector.
  // Uses a retry loop outside the webview (via setTimeout) so that:
  //  - the attempts counter always increments
  //  - the timer is cleaned up if the component unmounts mid-polling
  const handleToggleCluso = useCallback(() => {
    const MAX_ATTEMPTS = 30
    const RETRY_DELAY_MS = 100
    const nextActive = !isClusoActive
    const toggleScript = createClusoSetActiveScript(nextActive)

    const tryToggle = (attempt: number) => {
      const webview = wvRef.current
      if (!webview || !wvReadyRef.current || !mountedRef.current) return

      executeInWebview(toggleScript).then((result: unknown) => {
        const status = typeof result === 'string' ? result : String(result ?? '')
        if ((status === '__CLUSO_NOT_READY__' || status === '__CLUSO_PENDING__') && attempt < MAX_ATTEMPTS && mountedRef.current) {
          clusoToggleTimerRef.current = setTimeout(() => tryToggle(attempt + 1), RETRY_DELAY_MS)
          return
        }

        if (status === '__CLUSO_TOGGLED__') {
          setIsClusoActiveRef.current(nextActive)
          return
        }

        if (status.startsWith('__CLUSO_TOGGLE_ERROR__')) {
          console.error('[BrowserTile] Failed to toggle Cluso:', status)
        }
      }).catch((err: unknown) => {
        console.error('[BrowserTile] Failed to toggle Cluso:', err)
      })
    }

    // If the page loaded before the embed assets were ready, injection may not
    // have happened yet. Retry it here before polling for the host bridge.
    if (!isClusoReady) injectCluso()
    tryToggle(0)
  }, [injectCluso, executeInWebview, isClusoReady, isClusoActive])

  const focusAddressInput = useCallback(() => {
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      const pos = input.value.length
      input.setSelectionRange(pos, pos)
    })
  }, [])

  // ---- toolbar -----------------------------------------------------------
  const toolbar = (
    <form
      onSubmit={e => {
        e.preventDefault()
        navigate(addressBar)
      }}
      onMouseEnter={() => setIsToolbarHovered(true)}
      onMouseLeave={() => setIsToolbarHovered(false)}
      onMouseDown={e => {
        e.stopPropagation()
        setIsToolbarHovered(true)
      }}
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        paddingRight: 6
      }}
    >
      {/* Nav buttons */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <ToolbarButton label="Back" title="Back" disabled={!canGoBack} onClick={goBack}>
          <ArrowLeft size={12} />
        </ToolbarButton>
        <ToolbarButton label="Forward" title="Forward" disabled={!canGoForward} onClick={goForward}>
          <ArrowRight size={12} />
        </ToolbarButton>
        <ToolbarButton
          label={isLoading ? 'Stop' : 'Reload'}
          title={isLoading ? 'Stop' : 'Reload'}
          onClick={isLoading ? stop : reload}
        >
          {isLoading ? <RotateCcw size={12} /> : <RotateCw size={12} />}
        </ToolbarButton>
        <ToolbarButton label="Home" title="Home" onClick={goHome}>
          <Home size={12} />
        </ToolbarButton>
      </div>

      {/* Address bar */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <input
          ref={inputRef}
          aria-label="Address"
          value={addressBar}
          onFocus={() => setIsAddressFocused(true)}
          onBlur={() => setIsAddressFocused(false)}
          onChange={e => setAddressBar(e.target.value)}
          onMouseDown={e => {
            e.stopPropagation()
            setIsToolbarHovered(true)
            focusAddressInput()
          }}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Escape') (e.currentTarget as HTMLInputElement).blur()
          }}
          style={{
            width: '100%',
            height: 22,
            borderRadius: 6,
            border: `1px solid ${theme.border.default}`,
            background: theme.surface.input,
            color: theme.text.primary,
            padding: '0 8px 0 24px',
            fontSize: fonts.secondarySize,
            outline: 'none',
            boxSizing: 'border-box'
          }}
          spellCheck={false}
        />
        <div
          style={{
            position: 'absolute',
            left: 7,
            top: '50%',
            transform: 'translateY(-50%)',
            color: currentUrl.startsWith('https://') ? theme.status.success : theme.text.muted,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}
        >
          <Globe size={10} />
        </div>
      </div>

      {/* Viewport mode + cluso indicator */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
        <ToolbarButton
          label="Desktop"
          title="Desktop mode"
          active={mode === 'desktop'}
          onClick={() => switchMode('desktop')}
        >
          <Monitor size={12} />
        </ToolbarButton>
        <ToolbarButton
          label="Mobile"
          title="Mobile mode"
          active={mode === 'mobile'}
          onClick={() => switchMode('mobile')}
        >
          <Smartphone size={12} />
        </ToolbarButton>
        <ToolbarButton
          label="Cluso"
          title={isClusoActive ? 'Finish selection' : isClusoReady ? 'Select elements for chat context' : 'Load selector'}
          active={isClusoActive}
          disabled={!isClusoReady && !currentUrl}
          onClick={handleToggleCluso}
        >
          <Crosshair size={12} />
        </ToolbarButton>
        <ToolbarButton
          label="Browser evidence"
          title={`Browser evidence: ${browserPageHealth.label}`}
          active={isEvidenceDrawerOpen}
          onClick={() => setIsEvidenceDrawerOpen(prev => !prev)}
        >
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={12} />
            {issueBadgeCount > 0 && (
              <span
                aria-label={`${issueBadgeCount} evidence events`}
                style={{
                  position: 'absolute',
                  right: -7,
                  top: -7,
                  minWidth: 12,
                  height: 12,
                  padding: '0 3px',
                  borderRadius: 99,
                  background: evidenceHealthColor,
                  color: theme.text.inverse,
                  fontSize: 8,
                  lineHeight: '12px',
                  fontWeight: 700,
                  boxShadow: `0 0 0 1px ${browserToolbarBackground}`,
                }}
              >
                {issueBadgeCount > 99 ? '99+' : issueBadgeCount}
              </span>
            )}
          </span>
        </ToolbarButton>

      </div>
    </form>
  )

  // ---- render -----------------------------------------------------------
  return (
    <div style={{ position: 'absolute', inset: 0, background: browserBackground }}>
      {/* Toolbar — explicit top/height so compositor knows exact rect; zIndex above webview */}
      {!hideNavbar && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 34,
          display: 'flex', alignItems: 'center', padding: '0 6px',
          background: browserToolbarBackground, borderBottom: `1px solid ${browserBorder}`,
          zIndex: 2,
        }}>
          {toolbar}
        </div>
      )}

      {isEvidenceDrawerOpen && !hideNavbar && (
        <div
          aria-label="Evidence drawer"
          onMouseDown={e => {
            e.stopPropagation()
            setIsToolbarHovered(true)
          }}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 42,
            right: 8,
            width: Math.min(Math.max(width - 24, 260), 430),
            maxHeight: Math.max(160, height - 54),
            zIndex: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 10,
            borderRadius: 12,
            border: `1px solid ${theme.border.strong}`,
            background: theme.surface.panelElevated,
            boxShadow: theme.shadow.modal,
            color: theme.text.primary,
            fontSize: fonts.secondarySize,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: evidenceHealthColor }} />
                Browser evidence
              </div>
              <div style={{ color: theme.text.muted, fontSize: fonts.secondarySize - 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {browserPageHealth.label} · {browserEvidenceSummary.total} events · {pageTitle || currentUrl || 'No page title'}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close evidence drawer"
              onClick={() => setIsEvidenceDrawerOpen(false)}
              style={{
                border: 'none',
                borderRadius: 6,
                background: theme.surface.hover,
                color: theme.text.secondary,
                cursor: 'pointer',
                padding: '3px 7px',
                fontSize: fonts.secondarySize,
              }}
            >
              Close
            </button>
          </div>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {BROWSER_EVIDENCE_FILTERS.map(filter => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setEvidenceFilter(filter.id)}
                style={{
                  border: `1px solid ${evidenceFilter === filter.id ? theme.border.accent : theme.border.default}`,
                  borderRadius: 999,
                  background: evidenceFilter === filter.id ? theme.surface.selection : 'transparent',
                  color: evidenceFilter === filter.id ? theme.text.primary : theme.text.secondary,
                  cursor: 'pointer',
                  padding: '3px 8px',
                  fontSize: fonts.secondarySize - 1,
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              title="Capture snapshot"
              onClick={captureEvidenceSnapshot}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                border: `1px solid ${theme.border.default}`,
                borderRadius: 8,
                background: theme.surface.input,
                color: theme.text.secondary,
                cursor: 'pointer',
                padding: '6px 7px',
                fontSize: fonts.secondarySize - 1,
              }}
            >
              <ClipboardList size={12} />
              Capture snapshot
            </button>
            <button
              type="button"
              title="Copy report"
              onClick={copyEvidenceReport}
              style={{
                border: `1px solid ${theme.border.default}`,
                borderRadius: 8,
                background: theme.surface.input,
                color: theme.text.secondary,
                cursor: 'pointer',
                padding: '6px 7px',
                fontSize: fonts.secondarySize - 1,
              }}
            >
              Copy report
            </button>
            <button
              type="button"
              title="Open QA Workbench"
              onClick={openQaWorkbench}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                border: `1px solid ${theme.border.default}`,
                borderRadius: 8,
                background: theme.surface.input,
                color: theme.text.secondary,
                cursor: 'pointer',
                padding: '6px 7px',
                fontSize: fonts.secondarySize - 1,
              }}
            >
              <Bug size={12} />
              Workbench
            </button>
            <button
              type="button"
              title="Attach QA report to chat"
              onClick={attachQaReportToChat}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                border: `1px solid ${theme.border.default}`,
                borderRadius: 8,
                background: theme.surface.input,
                color: theme.text.secondary,
                cursor: 'pointer',
                padding: '6px 7px',
                fontSize: fonts.secondarySize - 1,
              }}
            >
              <ClipboardCheck size={12} />
              Attach to chat
            </button>
            <button
              type="button"
              title="Clear evidence"
              onClick={clearBrowserEvidence}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                border: `1px solid ${theme.border.default}`,
                borderRadius: 8,
                background: theme.surface.input,
                color: theme.text.secondary,
                cursor: 'pointer',
                padding: '6px 7px',
                fontSize: fonts.secondarySize - 1,
              }}
            >
              <Trash2 size={12} />
              Clear evidence
            </button>
          </div>

          {(copyStatus || lastSnapshotAt) && (
            <div style={{ color: theme.text.muted, fontSize: fonts.secondarySize - 1 }}>
              {copyStatus || 'Snapshot captured'}{lastSnapshotAt ? ` · ${new Date(lastSnapshotAt).toLocaleTimeString()}` : ''}
            </div>
          )}

          <div style={{ overflow: 'auto', minHeight: 72, borderTop: `1px solid ${theme.border.subtle}`, paddingTop: 8 }}>
            {filteredBrowserEvidence.length === 0 ? (
              <div style={{ color: theme.text.muted, padding: '12px 4px' }}>
                No browser evidence matches this filter yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {filteredBrowserEvidence.slice(0, 50).map(event => (
                  <div
                    key={event.id}
                    style={{
                      border: `1px solid ${theme.border.subtle}`,
                      borderLeft: `3px solid ${event.severity === 'error' ? theme.status.danger : event.severity === 'warning' ? theme.status.warning : theme.border.accent}`,
                      borderRadius: 8,
                      background: theme.surface.panel,
                      padding: '7px 8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: event.severity === 'error' ? theme.status.danger : event.severity === 'warning' ? theme.status.warning : theme.text.secondary, fontWeight: 700 }}>
                        {event.kind} · {event.severity}
                      </span>
                      <span style={{ color: theme.text.muted, fontSize: fonts.secondarySize - 2 }}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, color: theme.text.primary, lineHeight: 1.35, wordBreak: 'break-word' }}>
                      {event.message}
                    </div>
                    {(event.url || event.source || typeof event.line === 'number') && (
                      <div style={{ marginTop: 4, color: theme.text.muted, fontSize: fonts.secondarySize - 1, lineHeight: 1.3, wordBreak: 'break-word' }}>
                        {event.url || event.source}{typeof event.line === 'number' ? `:${event.line}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Webview container — starts below toolbar (or fills entire tile when navbar hidden) */}
      <div
        ref={wvContainerRef}
        style={{ position: 'absolute', top: hideNavbar ? 0 : 34, left: 0, right: 0, bottom: 0, zIndex: 1, background: browserBackground }}
      />

      {/* Invisible overlay during drag/resize — blocks mouse events from reaching webview */}
      {isInteracting && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'auto',
            background: 'transparent',
            zIndex: 9999
          }}
        />
      )}

      {(width < 260 || height < 170) && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontSize: fonts.secondarySize - 1,
            background: theme.surface.panelElevated,
            border: `1px solid ${theme.border.default}`,
            color: theme.text.muted,
            padding: '2px 6px',
            borderRadius: 4,
            pointerEvents: 'none'
          }}
        >
          Small blocks may hide browser controls
        </div>
      )}
    </div>
  )
}
