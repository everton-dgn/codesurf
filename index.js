"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path$1 = require("path");
const fs = require("fs");
const url = require("url");
const electronUpdater = require("electron-updater");
const path = require("node:path");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const node_os = require("node:os");
const os = require("os");
const node_crypto = require("node:crypto");
const http = require("http");
const crypto = require("crypto");
const readline = require("readline");
const Database = require("better-sqlite3");
const claudeAgentSdk = require("@anthropic-ai/claude-agent-sdk");
const node_events = require("node:events");
const child_process = require("child_process");
const https = require("https");
const util = require("util");
const net = require("net");
const v8 = require("v8");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const http__namespace = /* @__PURE__ */ _interopNamespaceDefault(http);
const net__namespace = /* @__PURE__ */ _interopNamespaceDefault(net);
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({ openAtLogin: auto });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "KeyI" && (input.alt && input.meta || input.control && input.shift)) {
            event.preventDefault();
          }
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const SANS_STACK = '"Saira", "SF Pro Rounded", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO_STACK = '"Geist Mono", "FiraCode Nerd Font Mono", ui-monospace, "SF Mono", "Menlo", "Monaco", "JetBrains Mono", "Fira Code", monospace';
const DEFAULT_FONTS = {
  primary: { family: SANS_STACK, size: 13, lineHeight: 1.15, weight: 400 },
  secondary: { family: SANS_STACK, size: 13, lineHeight: 1, weight: 400 },
  mono: { family: MONO_STACK, size: 13, lineHeight: 1.25, weight: 600 }
};
function normalizeFontSettings(raw) {
  if (!raw) return { ...DEFAULT_FONTS };
  return {
    primary: raw.primary ?? raw.sans ?? raw.chatMessage ?? DEFAULT_FONTS.primary,
    secondary: raw.secondary ?? raw.subtitle ?? raw.sectionLabel ?? DEFAULT_FONTS.secondary,
    mono: raw.mono ?? raw.terminal ?? raw.codeEditor ?? DEFAULT_FONTS.mono
  };
}
const DEFAULT_SETTINGS = {
  fonts: { ...DEFAULT_FONTS },
  appearance: "light",
  themeId: "paper-light",
  themeContrast: 0,
  canvasBackground: "#f3f5f8",
  canvasGlowEnabled: true,
  canvasGlowRadius: 120,
  gridColorSmall: "#d8dde6",
  gridColorLarge: "#c5ccd8",
  gridSpacingSmall: 20,
  gridSpacingLarge: 100,
  snapToGrid: true,
  gridSize: 20,
  terminalFontSize: 13,
  terminalFontFamily: MONO_STACK,
  uiFontSize: 12,
  translucentBackground: true,
  translucentBackgroundOpacity: 1,
  autoSaveIntervalMs: 500,
  defaultTileSizes: {
    terminal: { w: 600, h: 400 },
    code: { w: 680, h: 500 },
    note: { w: 500, h: 400 },
    image: { w: 440, h: 360 },
    media: { w: 640, h: 360 },
    kanban: { w: 900, h: 560 },
    browser: { w: 1e3, h: 700 },
    chat: { w: 420, h: 600 },
    file: { w: 240, h: 240 },
    files: { w: 280, h: 500 },
    customisation: { w: 720, h: 560 }
  },
  chromeSyncEnabled: false,
  chromeSyncProfileDir: null,
  linkOpenMode: "browser-block",
  execution: {
    mode: "auto",
    hostId: null
  },
  chatProviderModes: {},
  autoDream: {
    enabled: true,
    minSessions: 3,
    minIntervalMs: 30 * 60 * 1e3,
    debounceMs: 5e3,
    sweepMs: 5 * 60 * 1e3
  },
  localProxyEnabled: false,
  localProxyPort: 1337,
  generationProviders: {
    gemini: {
      id: "gemini",
      label: "Gemini / Nano Banana",
      enabled: false,
      capabilities: ["image", "video"],
      apiKey: "",
      imageModel: "gemini-2.5-flash-image",
      videoModel: "veo-3.1-generate-preview",
      videoAspectRatio: "16:9",
      videoResolution: "720p"
    },
    openai: {
      id: "openai",
      label: "OpenAI",
      enabled: false,
      capabilities: ["text", "image", "video"],
      apiKey: "",
      textModel: "",
      imageModel: "",
      videoModel: ""
    },
    anthropic: {
      id: "anthropic",
      label: "Anthropic",
      enabled: false,
      capabilities: ["text"],
      apiKey: "",
      textModel: "claude-sonnet-4-20250514"
    },
    openrouter: {
      id: "openrouter",
      label: "OpenRouter",
      enabled: false,
      capabilities: ["text", "image"],
      apiKey: "",
      baseUrl: "https://openrouter.ai/api/v1",
      textModel: "openrouter/auto",
      imageModel: ""
    },
    replicate: {
      id: "replicate",
      label: "Replicate",
      enabled: false,
      capabilities: ["image", "video"],
      apiKey: "",
      imageModel: "",
      videoModel: ""
    },
    runway: {
      id: "runway",
      label: "Runway",
      enabled: false,
      capabilities: ["video"],
      apiKey: "",
      videoModel: ""
    },
    luma: {
      id: "luma",
      label: "Luma",
      enabled: false,
      capabilities: ["video"],
      apiKey: "",
      videoModel: ""
    },
    stability: {
      id: "stability",
      label: "Stability AI",
      enabled: false,
      capabilities: ["image"],
      apiKey: "",
      imageModel: ""
    },
    local: {
      id: "local",
      label: "Local / custom",
      enabled: false,
      capabilities: ["text", "image", "video"],
      apiKey: "",
      baseUrl: "",
      textModel: "",
      imageModel: "",
      videoModel: ""
    }
  },
  pinnedExtensionIds: [],
  hiddenFromSidebarExtIds: [],
  settingsPanelExtIds: [],
  extensionsDisabled: false,
  statusBarHealth: "compact",
  extensionsGalleryEnabled: true,
  storage: {
    threadIndex: true
  },
  voice: {
    // Deepgram Nova-2 is ~5x faster than Whisper REST for short clips
    // (~600ms vs ~3s end-to-end). Both keys are required for the full
    // Deepgram-based stack (STT + TTS Aura) so this default lines up.
    sttProvider: "deepgram",
    sttLang: "en",
    ttsProvider: "cartesia",
    spokifyModel: "claude-haiku-4-5-20251001",
    autoSpeak: "off",
    bargeIn: true
  }
};
function mergeToken(base, override) {
  if (!override) return { ...base };
  return { ...base, ...override };
}
function resolveFonts(saved, legacyPrimary, legacySecondary, legacyMono) {
  const result = { ...DEFAULT_FONTS };
  if (legacyPrimary) result.primary = mergeToken(result.primary, legacyPrimary);
  if (legacySecondary) result.secondary = mergeToken(result.secondary, legacySecondary);
  if (legacyMono) result.mono = mergeToken(result.mono, legacyMono);
  if (!saved) return result;
  const s = saved;
  const legacySans = s.sans ?? s.chatMessage ?? s.title;
  const legacySub = s.subtitle ?? s.sectionLabel;
  const legacyMonoToken = s.terminal ?? s.codeEditor;
  if (legacySans && !saved.primary) result.primary = mergeToken(result.primary, legacySans);
  if (legacySub && !saved.secondary) result.secondary = mergeToken(result.secondary, legacySub);
  if (legacyMonoToken && !saved.mono) result.mono = mergeToken(result.mono, legacyMonoToken);
  if (saved.primary) result.primary = mergeToken(result.primary, saved.primary);
  if (saved.secondary) result.secondary = mergeToken(result.secondary, saved.secondary);
  if (saved.mono) result.mono = mergeToken(result.mono, saved.mono);
  return result;
}
function withDefaultSettings(input) {
  const settings = input ?? {};
  const rawChatProviderModes = settings.chatProviderModes && typeof settings.chatProviderModes === "object" && !Array.isArray(settings.chatProviderModes) ? settings.chatProviderModes : {};
  const chatProviderModes = Object.fromEntries(
    Object.entries(rawChatProviderModes).filter((entry) => typeof entry[0] === "string" && entry[0].trim().length > 0 && typeof entry[1] === "string" && entry[1].trim().length > 0).map(([providerId, modeId]) => [providerId.trim(), modeId.trim()])
  );
  const generationProviders = Object.fromEntries(
    Object.entries({
      ...DEFAULT_SETTINGS.generationProviders,
      ...settings.generationProviders ?? {}
    }).map(([id, provider]) => {
      const defaults = DEFAULT_SETTINGS.generationProviders[id];
      return [id, {
        ...defaults ?? { id, label: id, enabled: false, capabilities: [] },
        ...provider,
        id: provider.id || id,
        capabilities: Array.isArray(provider.capabilities) ? Array.from(/* @__PURE__ */ new Set([...defaults?.capabilities ?? [], ...provider.capabilities])).filter((capability) => capability === "text" || capability === "image" || capability === "video") : defaults?.capabilities ?? []
      }];
    })
  );
  const base = {
    ...DEFAULT_SETTINGS,
    ...settings,
    execution: {
      ...DEFAULT_SETTINGS.execution,
      ...settings.execution ?? {}
    },
    chatProviderModes,
    autoDream: {
      ...DEFAULT_SETTINGS.autoDream,
      ...settings.autoDream ?? {}
    },
    defaultTileSizes: {
      ...DEFAULT_SETTINGS.defaultTileSizes,
      ...settings.defaultTileSizes ?? {}
    },
    storage: {
      ...DEFAULT_SETTINGS.storage,
      ...settings.storage ?? {}
    },
    generationProviders,
    // Resolve fonts: new 3-token system, with legacy migration
    fonts: resolveFonts(
      settings.fonts,
      settings.primaryFont,
      settings.secondaryFont,
      settings.monoFont
    )
  };
  base.canvasGlowRadius = Math.max(50, Math.min(200, base.canvasGlowRadius ?? DEFAULT_SETTINGS.canvasGlowRadius));
  base.themeContrast = Math.max(-1, Math.min(1, Number.isFinite(base.themeContrast) ? base.themeContrast : 0));
  return base;
}
const CURVIER_BLOCK_RADIUS_STEPS = [0, 3, 4, 6, 8, 12, 16, 24, 32, 40];
function getCurvierBlockRadius(radius) {
  const current = Number.isFinite(radius) ? Math.max(0, Math.round(radius)) : 12;
  if (current <= 0) return 0;
  for (let index = 0; index < CURVIER_BLOCK_RADIUS_STEPS.length; index++) {
    const step = CURVIER_BLOCK_RADIUS_STEPS[index];
    if (current <= step) return step;
  }
  return current;
}
const DAEMON_STARTUP_GRACE_MS = 1200;
const DAEMON_POLL_INTERVAL_MS = 150;
const DAEMON_LOCK_STALE_MS = 3e4;
const DAEMON_STOP_TIMEOUT_MS = 5e3;
const DAEMON_KILL_TIMEOUT_MS = 2e3;
function createDaemonManager(config) {
  const healthTimeoutMs = config.healthTimeoutMs ?? 15e3;
  const DAEMON_DIR = path.join(config.homeDir, "daemon");
  const DAEMON_PID_PATH = path.join(DAEMON_DIR, "pid.json");
  const DAEMON_LOG_PATH = path.join(DAEMON_DIR, "daemon.log");
  const DAEMON_LOCK_PATH = path.join(DAEMON_DIR, "startup.lock");
  let cachedInfo = null;
  let startupPromise = null;
  function ensureDaemonDir() {
    node_fs.mkdirSync(DAEMON_DIR, { recursive: true });
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function resolveAppVersion2() {
    const version = config.getAppVersion();
    return typeof version === "string" && version.trim().length > 0 ? version.trim() : "0.0.0";
  }
  function readPidInfo() {
    try {
      const parsed = JSON.parse(node_fs.readFileSync(DAEMON_PID_PATH, "utf8"));
      const protocolVersion = typeof parsed.protocolVersion === "number" ? parsed.protocolVersion : typeof parsed.version === "number" ? parsed.version : null;
      if (typeof parsed.pid !== "number" || typeof parsed.port !== "number" || typeof parsed.token !== "string" || typeof parsed.startedAt !== "string" || typeof protocolVersion !== "number") {
        return null;
      }
      return {
        pid: parsed.pid,
        port: parsed.port,
        token: parsed.token,
        startedAt: parsed.startedAt,
        protocolVersion,
        appVersion: typeof parsed.appVersion === "string" && parsed.appVersion.trim().length > 0 ? parsed.appVersion.trim() : null
      };
    } catch {
      return null;
    }
  }
  function isProcessAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code ?? "") : "";
      return code === "EPERM";
    }
  }
  async function healthcheck(info) {
    try {
      const response = await fetch(`http://127.0.0.1:${info.port}/health`, {
        signal: AbortSignal.timeout(2e3),
        headers: {
          Authorization: `Bearer ${info.token}`
        }
      });
      if (!response.ok) return false;
      const parsed = await response.json();
      return parsed.ok === true;
    } catch {
      return false;
    }
  }
  function clearDaemonCache() {
    cachedInfo = null;
  }
  function removeFileIfPresent(filePath) {
    try {
      node_fs.rmSync(filePath, { force: true });
    } catch {
    }
  }
  function cleanupStalePidFile() {
    const info = readPidInfo();
    if (!info || !isProcessAlive(info.pid)) {
      removeFileIfPresent(DAEMON_PID_PATH);
    }
  }
  function tailDaemonLog(lines = 20) {
    try {
      const content = node_fs.readFileSync(DAEMON_LOG_PATH, "utf8").split("\n").filter(Boolean).slice(-lines).join("\n");
      return content.trim();
    } catch {
      return "";
    }
  }
  function lockLooksStale() {
    try {
      return Date.now() - node_fs.statSync(DAEMON_LOCK_PATH).mtimeMs > DAEMON_LOCK_STALE_MS;
    } catch {
      return false;
    }
  }
  async function waitForDaemonReady() {
    const start = Date.now();
    while (Date.now() - start < healthTimeoutMs) {
      const info = readPidInfo();
      if (info && isProcessAlive(info.pid) && await healthcheck(info)) {
        cachedInfo = info;
        return info;
      }
      await sleep(DAEMON_POLL_INTERVAL_MS);
    }
    const recentLogs = tailDaemonLog();
    throw new Error(
      recentLogs ? `CodeSurf daemon did not become healthy in time.

Recent daemon logs:
${recentLogs}` : "CodeSurf daemon did not become healthy in time"
    );
  }
  async function waitForChildStartupGrace(child) {
    const exitedEarly = await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = setTimeout(() => finish(false), DAEMON_STARTUP_GRACE_MS);
      child.once("error", () => {
        clearTimeout(timer);
        finish(true);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        finish(true);
      });
    });
    if (!exitedEarly) return;
    const recentLogs = tailDaemonLog();
    throw new Error(
      recentLogs ? `CodeSurf daemon exited during startup.

Recent daemon logs:
${recentLogs}` : "CodeSurf daemon exited during startup"
    );
  }
  function spawnDaemonProcess() {
    ensureDaemonDir();
    const out = node_fs.openSync(DAEMON_LOG_PATH, "a");
    const daemonScriptPath = config.resolveDaemonScriptPath();
    if (!node_fs.existsSync(daemonScriptPath)) {
      throw new Error(`Resolved daemon script path does not exist: ${daemonScriptPath}`);
    }
    const child = node_child_process.spawn(process.execPath, [daemonScriptPath], {
      detached: true,
      stdio: ["ignore", out, out],
      env: {
        ...process.env,
        ...config.extraEnv ? config.extraEnv() : {},
        // ELECTRON_RUN_AS_NODE is harmless outside Electron; required when the
        // host process is the Electron main bundle so the spawned interpreter
        // behaves as plain Node.
        ELECTRON_RUN_AS_NODE: "1",
        CODESURF_HOME: config.homeDir,
        CODESURF_DAEMON_PID_PATH: DAEMON_PID_PATH,
        CODESURF_APP_VERSION: resolveAppVersion2()
      }
    });
    child.unref();
    node_fs.closeSync(out);
    return child;
  }
  async function withStartupLock(work) {
    ensureDaemonDir();
    const deadline = Date.now() + healthTimeoutMs;
    while (Date.now() < deadline) {
      cleanupStalePidFile();
      try {
        const fd = node_fs.openSync(DAEMON_LOCK_PATH, "wx");
        try {
          return await work();
        } finally {
          node_fs.closeSync(fd);
          removeFileIfPresent(DAEMON_LOCK_PATH);
        }
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code ?? "") : "";
        if (code !== "EEXIST") throw error;
        const existing = readPidInfo();
        if (existing && isProcessAlive(existing.pid) && await healthcheck(existing)) {
          cachedInfo = existing;
          return existing;
        }
        if (lockLooksStale()) {
          removeFileIfPresent(DAEMON_LOCK_PATH);
          continue;
        }
        await sleep(DAEMON_POLL_INTERVAL_MS);
      }
    }
    throw new Error("Timed out acquiring CodeSurf daemon startup lock");
  }
  function signalProcessSafely(pid, signal) {
    if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) return false;
    try {
      process.kill(pid, signal);
      return true;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code ?? "") : "";
      if (code === "ESRCH") return false;
      if (code === "EPERM") return true;
      throw error;
    }
  }
  function signalProcessGroupSafely(pid, signal) {
    if (process.platform === "win32") {
      return signalProcessSafely(pid, signal);
    }
    if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) return false;
    try {
      process.kill(-pid, signal);
      return true;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code ?? "") : "";
      if (code === "ESRCH") return signalProcessSafely(pid, signal);
      if (code === "EPERM") return true;
      throw error;
    }
  }
  async function waitForPidExit(pid, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!isProcessAlive(pid)) return true;
      await sleep(DAEMON_POLL_INTERVAL_MS);
    }
    return !isProcessAlive(pid);
  }
  async function stopDaemonProcess(info) {
    if (!info || !isProcessAlive(info.pid)) {
      removeFileIfPresent(DAEMON_PID_PATH);
      return;
    }
    signalProcessSafely(info.pid, "SIGTERM");
    let stopped = await waitForPidExit(info.pid, DAEMON_STOP_TIMEOUT_MS);
    if (!stopped) {
      signalProcessGroupSafely(info.pid, "SIGKILL");
      stopped = await waitForPidExit(info.pid, DAEMON_KILL_TIMEOUT_MS);
    }
    if (!stopped) {
      throw new Error(`Timed out stopping CodeSurf daemon PID ${info.pid}`);
    }
    removeFileIfPresent(DAEMON_PID_PATH);
  }
  async function ensureDaemonRunning2(options) {
    const forceRestart = options?.forceRestart === true;
    const appVersion = resolveAppVersion2();
    if (cachedInfo && isProcessAlive(cachedInfo.pid) && await healthcheck(cachedInfo)) {
      if (!forceRestart && (!cachedInfo.appVersion || cachedInfo.appVersion === appVersion)) {
        return cachedInfo;
      }
    }
    if (startupPromise) return startupPromise;
    startupPromise = (async () => {
      const existing = readPidInfo();
      if (forceRestart) {
        await stopDaemonProcess(existing);
        clearDaemonCache();
      } else if (existing && isProcessAlive(existing.pid) && await healthcheck(existing) && (!existing.appVersion || existing.appVersion === appVersion)) {
        cachedInfo = existing;
        return existing;
      }
      return await withStartupLock(async () => {
        const lockedExisting = readPidInfo();
        if (!forceRestart && lockedExisting && isProcessAlive(lockedExisting.pid) && await healthcheck(lockedExisting) && (!lockedExisting.appVersion || lockedExisting.appVersion === appVersion)) {
          cachedInfo = lockedExisting;
          return lockedExisting;
        }
        if (forceRestart && lockedExisting) {
          await stopDaemonProcess(lockedExisting);
          clearDaemonCache();
        }
        const child = spawnDaemonProcess();
        await waitForChildStartupGrace(child);
        return await waitForDaemonReady();
      });
    })();
    try {
      return await startupPromise;
    } finally {
      startupPromise = null;
    }
  }
  async function getDaemonStatus2() {
    const info = readPidInfo();
    if (!info || !isProcessAlive(info.pid) || !await healthcheck(info)) {
      clearDaemonCache();
      return { running: false, info: null };
    }
    cachedInfo = info;
    return { running: true, info };
  }
  function invalidateDaemonCache2() {
    clearDaemonCache();
  }
  async function restartDaemon2() {
    invalidateDaemonCache2();
    return await ensureDaemonRunning2({ forceRestart: true });
  }
  async function stopDaemon2() {
    const info = readPidInfo();
    await stopDaemonProcess(info);
    clearDaemonCache();
  }
  return {
    ensureDaemonRunning: ensureDaemonRunning2,
    getDaemonStatus: getDaemonStatus2,
    invalidateDaemonCache: invalidateDaemonCache2,
    restartDaemon: restartDaemon2,
    stopDaemon: stopDaemon2
  };
}
function resolveDaemonScriptFromCandidates(candidates) {
  for (const candidate of candidates) {
    if (node_fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Unable to locate codesurfd.mjs in any of:
  ${candidates.join("\n  ")}`);
}
const CODESURF_HOME_DIRNAME = ".codesurf";
function defaultCodesurfHome() {
  return process.env.CODESURF_HOME?.trim() || path.join(node_os.homedir(), CODESURF_HOME_DIRNAME);
}
const CODESURF_HOME = defaultCodesurfHome();
const DAEMON_PACKAGE_VERSION = "0.1.0";
const APP_NAME = "CodeSurf";
const APP_ID = "com.huggiapps.codesurf";
const CONTEX_HOME_DIRNAME = ".codesurf";
const LEGACY_HOME_DIRNAME = ".contex";
const TILE_CONTEXT_DIRNAME = ".contex";
const LEGACY_TILE_CONTEXT_DIRNAME = ".collab";
const CONTEX_HOME = path$1.join(os.homedir(), CONTEX_HOME_DIRNAME);
const LEGACY_HOME = path$1.join(os.homedir(), LEGACY_HOME_DIRNAME);
const WORKSPACES_DIR = path$1.join(CONTEX_HOME, "workspaces");
const JOBS_DIR = path$1.join(CONTEX_HOME, "jobs");
const TIMELINES_DIR = path$1.join(CONTEX_HOME, "timelines");
function workspaceTileDir(workspacePath, tileId) {
  return path$1.join(workspacePath, TILE_CONTEXT_DIRNAME, tileId);
}
function legacyWorkspaceTileDir(workspacePath, tileId) {
  return path$1.join(workspacePath, LEGACY_TILE_CONTEXT_DIRNAME, tileId);
}
function workspaceTileContextDir(workspacePath, tileId) {
  return path$1.join(workspaceTileDir(workspacePath, tileId), "context");
}
function legacyWorkspaceTileContextDir(workspacePath, tileId) {
  return path$1.join(legacyWorkspaceTileDir(workspacePath, tileId), "context");
}
function workspaceTileMessagesDir(workspacePath, tileId) {
  return path$1.join(workspaceTileDir(workspacePath, tileId), "messages");
}
function workspaceTileMessageMailboxDir(workspacePath, tileId, mailbox) {
  return path$1.join(workspaceTileMessagesDir(workspacePath, tileId), mailbox);
}
function resolveAppVersion() {
  const pin = process.env.CODESURF_DAEMON_VERSION_PIN?.trim();
  return pin && pin.length > 0 ? pin : DAEMON_PACKAGE_VERSION;
}
function resolveHostAppVersion() {
  const version = electron.app.getVersion?.();
  return typeof version === "string" && version.trim().length > 0 ? version.trim() : "0.0.0";
}
function resolveDaemonScriptPath() {
  const appPath = electron.app.getAppPath();
  return resolveDaemonScriptFromCandidates([
    // Packaged: bin shipped via electron-builder `files`/`asarUnpack`.
    path.join(appPath, "bin", "codesurfd.mjs"),
    path.join(appPath, "..", "app.asar.unpacked", "bin", "codesurfd.mjs"),
    // Dev: we run from the source tree.
    path.join(process.cwd(), "bin", "codesurfd.mjs"),
    // Fallback: the package's own bin (used if the launcher shim is removed).
    path.join(appPath, "packages", "codesurf-daemon", "bin", "codesurfd.mjs"),
    path.join(process.cwd(), "packages", "codesurf-daemon", "bin", "codesurfd.mjs")
  ]);
}
const manager = createDaemonManager({
  homeDir: CONTEX_HOME,
  getAppVersion: resolveAppVersion,
  resolveDaemonScriptPath,
  extraEnv: () => ({ CODESURF_HOST_APP_VERSION: resolveHostAppVersion() })
});
const ensureDaemonRunning = manager.ensureDaemonRunning;
const getDaemonStatus = manager.getDaemonStatus;
const invalidateDaemonCache = manager.invalidateDaemonCache;
const restartDaemon = manager.restartDaemon;
const stopDaemon = manager.stopDaemon;
function createDaemonClient(hooks) {
  const defaultTimeoutMs = hooks.requestTimeoutMs ?? 5e3;
  async function request(path2, options) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const daemon = await hooks.ensureRunning();
      try {
        const response = await fetch(`http://127.0.0.1:${daemon.port}${path2}`, {
          method: options?.method ?? (options?.body == null ? "GET" : "POST"),
          headers: {
            Authorization: `Bearer ${daemon.token}`,
            ...options?.body == null ? {} : { "Content-Type": "application/json" }
          },
          body: options?.body == null ? void 0 : JSON.stringify(options.body),
          signal: AbortSignal.timeout(options?.timeoutMs ?? defaultTimeoutMs)
        });
        if (!response.ok) {
          const text = await response.text();
          const error = new Error(text || `Daemon request failed: ${response.status}`);
          lastError = error;
          if (attempt === 0 && (response.status === 401 || response.status === 408 || response.status === 502 || response.status === 503 || response.status === 504)) {
            hooks.invalidate();
            continue;
          }
          throw error;
        }
        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === 0) {
          const status2 = await hooks.getStatus().catch(() => ({ running: false, info: null }));
          if (!status2.running) {
            hooks.invalidate();
          }
          continue;
        }
        throw lastError;
      }
    }
    throw lastError ?? new Error("Daemon request failed");
  }
  return {
    /** Escape hatch for routes the typed surface doesn't cover. */
    request,
    getJobDashboard() {
      return request("/dashboard/api/jobs");
    },
    listHosts() {
      return request("/host/list");
    },
    upsertHost(host) {
      return request("/host/upsert", { body: { host } });
    },
    deleteHost(id) {
      return request(`/host/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listPermissions() {
      return request("/permissions");
    },
    setPermissionGrant(args) {
      return request("/permissions/grant", { body: args });
    },
    resolvePermission(args) {
      return request("/permissions/resolve", { body: args });
    },
    clearPermissionGrant(id) {
      return request("/permissions/clear", { body: { id } });
    },
    clearAllPermissionGrants() {
      return request("/permissions/clear", { body: { all: true } });
    },
    listWorkspaces() {
      return request("/workspace/list");
    },
    listProjects() {
      return request("/workspace/projects");
    },
    getActiveWorkspace() {
      return request("/workspace/active");
    },
    createWorkspace(name) {
      return request("/workspace/create", { body: { name } });
    },
    createWorkspaceWithPath(name, projectPath) {
      return request("/workspace/create-with-path", { body: { name, projectPath } });
    },
    createWorkspaceFromFolder(folderPath) {
      return request("/workspace/create-from-folder", { body: { folderPath } });
    },
    addProjectFolder(workspaceId, folderPath) {
      return request("/workspace/add-project-folder", { body: { workspaceId, folderPath } });
    },
    removeProjectFolder(workspaceId, folderPath) {
      return request("/workspace/remove-project-folder", { body: { workspaceId, folderPath } });
    },
    renameProject(args) {
      return request("/workspace/project/rename", { body: args });
    },
    createProjectWorktree(args) {
      return request("/workspace/project/worktree", { body: args });
    },
    setActiveWorkspace(id) {
      return request("/workspace/set-active", { body: { id } });
    },
    deleteWorkspace(id) {
      return request(`/workspace/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listLocalSessions(workspaceId) {
      return request(`/session/local/list?workspaceId=${encodeURIComponent(workspaceId)}`);
    },
    upsertRuntimeSession(workspaceId, cardId, state) {
      return request("/session/runtime/upsert", { body: { workspaceId, cardId, state } });
    },
    getLocalSessionState(workspaceId, sessionEntryId) {
      return request(`/session/local/state?workspaceId=${encodeURIComponent(workspaceId)}&sessionEntryId=${encodeURIComponent(sessionEntryId)}`);
    },
    deleteLocalSession(workspaceId, sessionEntryId) {
      return request("/session/local/delete", { body: { workspaceId, sessionEntryId } });
    },
    renameLocalSession(workspaceId, sessionEntryId, title) {
      return request("/session/local/rename", { body: { workspaceId, sessionEntryId, title } });
    },
    listExternalSessions(workspacePath, force = false) {
      const normalizedPath = String(workspacePath ?? "").trim();
      const query = new URLSearchParams();
      if (normalizedPath) query.set("workspacePath", normalizedPath);
      if (force) query.set("force", "1");
      return request(`/session/external/list?${query.toString()}`);
    },
    invalidateExternalSessions(workspacePath) {
      return request("/session/external/invalidate", {
        body: { workspacePath: String(workspacePath ?? "").trim() || null }
      });
    },
    getExternalSessionState(workspacePath, sessionEntryId) {
      const normalizedPath = String(workspacePath ?? "").trim();
      const query = new URLSearchParams();
      if (normalizedPath) query.set("workspacePath", normalizedPath);
      query.set("sessionEntryId", sessionEntryId);
      return request(`/session/external/state?${query.toString()}`);
    },
    deleteExternalSession(workspacePath, sessionEntryId) {
      return request("/session/external/delete", {
        body: {
          workspacePath: String(workspacePath ?? "").trim() || null,
          sessionEntryId
        }
      });
    },
    renameExternalSession(workspacePath, sessionEntryId, title) {
      return request("/session/external/rename", {
        body: {
          workspacePath: String(workspacePath ?? "").trim() || null,
          sessionEntryId,
          title
        }
      });
    },
    createCheckpoint(workspaceId, sessionEntryId, payload) {
      return request("/checkpoint/create", { body: { workspaceId, sessionEntryId, ...payload } });
    },
    listCheckpoints(workspaceId, sessionEntryId) {
      return request("/checkpoint/list", { body: { workspaceId, sessionEntryId } });
    },
    restoreCheckpoint(workspaceId, checkpointId, sessionEntryId) {
      return request("/checkpoint/restore", {
        body: { workspaceId, checkpointId, sessionEntryId: sessionEntryId ?? null }
      });
    },
    loadMemoryContext(workspaceId, executionTarget = "local") {
      return request(`/memory/load?workspaceId=${encodeURIComponent(workspaceId)}&executionTarget=${encodeURIComponent(executionTarget)}`);
    },
    getDreamStatus(workspaceId) {
      return request(`/dreaming/status?workspaceId=${encodeURIComponent(workspaceId)}`);
    },
    listDreamRuns(workspaceId, limit = 20) {
      return request(`/dreaming/runs?workspaceId=${encodeURIComponent(workspaceId)}&limit=${encodeURIComponent(String(limit))}`);
    },
    runDream(args) {
      return request("/dreaming/run", { body: args });
    },
    cancelDream(args) {
      return request("/dreaming/cancel", { body: args });
    },
    listSkills(args = {}) {
      const query = new URLSearchParams();
      const workspaceId = String(args.workspaceId ?? "").trim();
      const workspaceDir = String(args.workspaceDir ?? "").trim();
      const cardId = String(args.cardId ?? "").trim();
      if (workspaceId) query.set("workspaceId", workspaceId);
      if (workspaceDir) query.set("workspaceDir", workspaceDir);
      if (cardId) query.set("cardId", cardId);
      return request(`/skills/list${query.size > 0 ? `?${query.toString()}` : ""}`);
    },
    getSkill(args) {
      const query = new URLSearchParams();
      query.set("skillId", String(args.skillId ?? "").trim());
      const workspaceId = String(args.workspaceId ?? "").trim();
      const workspaceDir = String(args.workspaceDir ?? "").trim();
      const cardId = String(args.cardId ?? "").trim();
      if (workspaceId) query.set("workspaceId", workspaceId);
      if (workspaceDir) query.set("workspaceDir", workspaceDir);
      if (cardId) query.set("cardId", cardId);
      return request(`/skills/get?${query.toString()}`);
    },
    installSkill(args) {
      return request("/skills/install", { body: args });
    },
    expandFileReferences(payload) {
      return request("/file-references/expand", {
        body: {
          message: payload.message,
          workspaceId: String(payload.workspaceId ?? "").trim() || null,
          workspaceDir: String(payload.workspaceDir ?? "").trim() || null,
          executionTarget: payload.executionTarget === "cloud" ? "cloud" : "local"
        }
      });
    },
    getSettings() {
      return request("/settings");
    },
    setSettings(settings) {
      return request("/settings", { body: { settings } });
    },
    getRawSettingsJson() {
      return request("/settings/raw");
    },
    setRawSettingsJson(json) {
      return request("/settings/raw", { body: { json } });
    }
  };
}
const baseClient = createDaemonClient({
  ensureRunning: ensureDaemonRunning,
  getStatus: getDaemonStatus,
  invalidate: invalidateDaemonCache
});
const daemonClient = {
  ...baseClient,
  getSettings() {
    return baseClient.getSettings();
  },
  setSettings(settings) {
    return baseClient.setSettings(settings);
  },
  setRawSettingsJson(json) {
    return baseClient.setRawSettingsJson(json);
  }
};
const MAX_HISTORY = 500;
class EventBus {
  subscriptions = /* @__PURE__ */ new Map();
  history = /* @__PURE__ */ new Map();
  readCursors = /* @__PURE__ */ new Map();
  // key: `${channel}::${subscriberId}` → timestamp
  publish(event) {
    const full = {
      ...event,
      id: node_crypto.randomUUID(),
      timestamp: Date.now()
    };
    let ring = this.history.get(full.channel);
    if (!ring) {
      ring = [];
      this.history.set(full.channel, ring);
    }
    ring.push(full);
    if (ring.length > MAX_HISTORY) {
      ring.splice(0, ring.length - MAX_HISTORY);
    }
    for (const sub of this.subscriptions.values()) {
      if (this.matches(sub, full.channel)) {
        try {
          sub.callback(full);
        } catch {
        }
      }
    }
    return full;
  }
  subscribe(channel, subscriberId, callback) {
    const id = node_crypto.randomUUID();
    const isWildcard = channel.includes("*");
    const prefix = isWildcard ? channel.slice(0, channel.indexOf("*")) : "";
    const internal = {
      id,
      channel,
      subscriberId,
      callback,
      isWildcard,
      prefix
    };
    this.subscriptions.set(id, internal);
    return { id, channel, subscriberId };
  }
  unsubscribe(subscriptionId) {
    this.subscriptions.delete(subscriptionId);
  }
  unsubscribeAll(subscriberId) {
    for (const [id, sub] of this.subscriptions) {
      if (sub.subscriberId === subscriberId) {
        this.subscriptions.delete(id);
      }
    }
  }
  getChannelInfo(channel) {
    const ring = this.history.get(channel) ?? [];
    return {
      name: channel,
      channel,
      unread: ring.length,
      lastEvent: ring.length > 0 ? ring[ring.length - 1] : void 0
    };
  }
  getHistory(channel, limit) {
    const ring = this.history.get(channel) ?? [];
    if (limit == null || limit >= ring.length) return [...ring];
    return ring.slice(-limit);
  }
  markRead(channel, subscriberId) {
    this.readCursors.set(`${channel}::${subscriberId}`, Date.now());
  }
  getUnreadCount(channel, subscriberId) {
    const cursor = this.readCursors.get(`${channel}::${subscriberId}`);
    const ring = this.history.get(channel) ?? [];
    if (cursor == null) return ring.length;
    let count = 0;
    for (let i = ring.length - 1; i >= 0; i--) {
      if (ring[i].timestamp <= cursor) break;
      count++;
    }
    return count;
  }
  // Drop all history and read cursors for a channel. Returns count of bytes-ish freed (event count).
  dropChannel(channel) {
    const ring = this.history.get(channel);
    const freed = ring?.length ?? 0;
    this.history.delete(channel);
    const prefix = `${channel}::`;
    for (const key of this.readCursors.keys()) {
      if (key.startsWith(prefix)) this.readCursors.delete(key);
    }
    return freed;
  }
  // Drop every channel whose name starts with `prefix`. Returns number of channels dropped.
  dropChannelsMatching(prefix) {
    let dropped = 0;
    for (const channel of [...this.history.keys()]) {
      if (channel.startsWith(prefix)) {
        this.dropChannel(channel);
        dropped++;
      }
    }
    for (const [id, sub] of this.subscriptions) {
      if (!sub.isWildcard && sub.channel.startsWith(prefix)) {
        this.subscriptions.delete(id);
      }
    }
    return dropped;
  }
  getStats() {
    let events = 0;
    for (const ring of this.history.values()) events += ring.length;
    return {
      channels: this.history.size,
      events,
      subscriptions: this.subscriptions.size,
      readCursors: this.readCursors.size
    };
  }
  // ── internal ──────────────────────────────────────────────────────────────
  matches(sub, channel) {
    if (!sub.isWildcard) return sub.channel === channel;
    return channel.startsWith(sub.prefix);
  }
}
const bus = new EventBus();
const NODE_TOOL_SCOPE_PREFIX = "tool:";
const CONTEX_MCP_TOOL_PREFIX = "mcp__contex__";
const NODE_MCP_TOOLSETS = {
  terminal: [
    {
      name: "terminal_send_input",
      description: "Send raw input text to a terminal tile for command execution.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target terminal tile id" },
          input: { type: "string", description: "Text to send into the terminal" },
          enter: { type: "boolean", description: "Whether to append a newline after the input (default true)" }
        },
        required: ["tile_id", "input"]
      }
    },
    {
      name: "terminal_clear",
      description: "Clear the terminal screen for a connected terminal tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target terminal tile id" }
        },
        required: ["tile_id"]
      }
    }
  ],
  browser: [
    {
      name: "browser_navigate",
      description: "Navigate a browser tile to a URL.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target browser tile id" },
          url: { type: "string", description: "Destination URL or search query" }
        },
        required: ["tile_id", "url"]
      }
    },
    {
      name: "browser_reload",
      description: "Reload the current page in a browser tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target browser tile id" }
        },
        required: ["tile_id"]
      }
    },
    {
      name: "browser_back",
      description: "Navigate one step back in a browser tile history.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target browser tile id" }
        },
        required: ["tile_id"]
      }
    },
    {
      name: "browser_forward",
      description: "Navigate one step forward in a browser tile history.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target browser tile id" }
        },
        required: ["tile_id"]
      }
    },
    {
      name: "browser_set_mode",
      description: "Switch a browser tile between desktop and mobile viewport mode.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target browser tile id" },
          mode: { type: "string", enum: ["desktop", "mobile"], description: "Viewport mode" }
        },
        required: ["tile_id", "mode"]
      }
    }
  ],
  chat: [
    {
      name: "chat_send_message",
      description: "Send a short message to a peer chat tile to synchronize context or ask a direct follow-up.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target chat tile id" },
          message: { type: "string", description: "Message to send to the peer chat tile" }
        },
        required: ["tile_id", "message"]
      }
    },
    {
      name: "chat_acknowledge",
      description: "Acknowledge receipt of a peer chat message or task handoff.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target chat tile id" },
          note: { type: "string", description: "Acknowledgment text (short)" }
        },
        required: ["tile_id", "note"]
      }
    }
  ],
  kanban: [
    {
      name: "kanban_set_status",
      description: "Broadcast a kanban tile progress or status update.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          message: { type: "string", description: "Status note" }
        },
        required: ["tile_id", "message"]
      }
    },
    {
      name: "kanban_create_card",
      description: "Create a new card on a connected kanban tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          title: { type: "string", description: "Card title" },
          description: { type: "string", description: "Short description" },
          instructions: { type: "string", description: "Detailed instructions" },
          column_id: { type: "string", description: "Target column id" },
          agent: { type: "string", description: "Agent id" },
          model: { type: "string", description: "Model id" },
          tools: { type: "array", items: { type: "string" }, description: "Tool ids" },
          file_refs: { type: "array", items: { type: "string" }, description: "File paths" },
          card_refs: { type: "array", items: { type: "string" }, description: "Dependent card ids/titles" },
          color: { type: "string", description: "Card accent color" }
        },
        required: ["tile_id", "title"]
      }
    },
    {
      name: "kanban_update_card",
      description: "Update an existing card on a connected kanban tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          card_id: { type: "string", description: "Card id to update" },
          title: { type: "string" },
          description: { type: "string" },
          instructions: { type: "string" },
          column_id: { type: "string" },
          agent: { type: "string" },
          model: { type: "string" },
          tools: { type: "array", items: { type: "string" } },
          file_refs: { type: "array", items: { type: "string" } },
          card_refs: { type: "array", items: { type: "string" } },
          color: { type: "string" },
          launched: { type: "boolean" }
        },
        required: ["tile_id", "card_id"]
      }
    },
    {
      name: "kanban_move_card",
      description: "Move a card to another column on a connected kanban tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          card_id: { type: "string", description: "Card id" },
          column_id: { type: "string", description: "Destination column id" }
        },
        required: ["tile_id", "card_id", "column_id"]
      }
    },
    {
      name: "kanban_pause_card",
      description: "Pause a running card on a connected kanban tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          card_id: { type: "string", description: "Card id" }
        },
        required: ["tile_id", "card_id"]
      }
    },
    {
      name: "kanban_delete_card",
      description: "Delete a card from a connected kanban tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          card_id: { type: "string", description: "Card id" }
        },
        required: ["tile_id", "card_id"]
      }
    },
    {
      name: "kanban_create_column",
      description: "Create a new column/list on a connected kanban tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          title: { type: "string", description: "Column title" },
          column_id: { type: "string", description: "Optional explicit column id" }
        },
        required: ["tile_id", "title"]
      }
    },
    {
      name: "kanban_rename_column",
      description: "Rename a column/list on a connected kanban tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          column_id: { type: "string", description: "Column id" },
          title: { type: "string", description: "New title" }
        },
        required: ["tile_id", "column_id", "title"]
      }
    },
    {
      name: "kanban_delete_column",
      description: "Delete a column/list and its cards from a connected kanban tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target kanban tile id" },
          column_id: { type: "string", description: "Column id" }
        },
        required: ["tile_id", "column_id"]
      }
    }
  ],
  note: [
    {
      name: "note_append_context",
      description: "Append text to a note tile. Adds to the end of existing content.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target note tile id" },
          snippet: { type: "string", description: "Text snippet to append" }
        },
        required: ["tile_id", "snippet"]
      }
    },
    {
      name: "note_read_content",
      description: "Read the current content of a note tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target note tile id" }
        },
        required: ["tile_id"]
      }
    },
    {
      name: "note_write_content",
      description: "Replace the entire content of a note tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target note tile id" },
          content: { type: "string", description: "New content for the note" }
        },
        required: ["tile_id", "content"]
      }
    }
  ],
  code: [
    {
      name: "code_open_file",
      description: "Open or re-focus a specific file path in a connected code tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target code tile id" },
          file_path: { type: "string", description: "File path to open" }
        },
        required: ["tile_id", "file_path"]
      }
    }
  ],
  file: [
    {
      name: "file_open_context",
      description: "Send a context hint to a file tile to surface related paths.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target file tile id" },
          context: { type: "string", description: "Context hint or search phrase" }
        },
        required: ["tile_id", "context"]
      }
    }
  ],
  image: [
    {
      name: "image_annotate",
      description: "Send an annotation note related to a visible image tile.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target image tile id" },
          note: { type: "string", description: "Annotation note text" }
        },
        required: ["tile_id", "note"]
      }
    },
    {
      name: "image_edit_request",
      description: "Edit a connected image tile through the configured image provider. On success the canvas replaces the image source; on failure the tool returns the provider/setup error.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target image tile id" },
          prompt: { type: "string", description: 'Edit instruction, e.g. "add a caption at the bottom"' },
          provider: { type: "string", description: "Preferred image provider, e.g. gemini, openai, local" },
          model: { type: "string", description: "Preferred image model, e.g. gemini-2.5-flash-image" },
          mask_path: { type: "string", description: "Optional mask image path for inpainting/edit regions" },
          output_path: { type: "string", description: "Optional desired output file path" }
        },
        required: ["tile_id", "prompt"]
      }
    },
    {
      name: "image_generate_variation",
      description: "Generate a provider-backed variation of a connected image tile. On success the canvas replaces the image source; on failure the tool returns the provider/setup error.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target image tile id" },
          prompt: { type: "string", description: "Optional direction for the variation" },
          provider: { type: "string", description: "Preferred image provider, e.g. gemini, openai, local" },
          model: { type: "string", description: "Preferred image model, e.g. gemini-2.5-flash-image" },
          output_path: { type: "string", description: "Optional desired output file path" }
        },
        required: ["tile_id"]
      }
    },
    {
      name: "image_replace_source",
      description: "Replace the visible source file for a connected image tile after an image edit or variation has been written to disk.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "Target image tile id" },
          file_path: { type: "string", description: "Absolute path to the replacement image file" },
          note: { type: "string", description: "Optional note describing the edit that produced this file" }
        },
        required: ["tile_id", "file_path"]
      }
    }
  ],
  universal: [
    {
      name: "tile_context_get",
      description: "Read context entries from a tile. Agents can read any tile context across workspaces.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "The tile ID to read context from" },
          workspace_id: { type: "string", description: "The workspace ID (optional; uses first workspace if omitted)" },
          tag: { type: "string", description: 'Filter by tag prefix (e.g., "ctx:design"; optional)' }
        },
        required: ["tile_id"]
      }
    },
    {
      name: "tile_context_set",
      description: "Write a context entry to a tile. Agents can write to any tile context across workspaces.",
      inputSchema: {
        type: "object",
        properties: {
          tile_id: { type: "string", description: "The tile ID to write context to" },
          workspace_id: { type: "string", description: "The workspace ID (optional; uses first workspace if omitted)" },
          key: { type: "string", description: 'Context key (e.g., "ctx:design:palette")' },
          value: { description: "Context value (any JSON-serializable value)" }
        },
        required: ["tile_id", "key", "value"]
      }
    }
  ]
};
const EXTENSION_PLACEHOLDER_TOOLS = [];
function getTileNodeTools(tileType) {
  if (tileType.startsWith("ext:")) return EXTENSION_PLACEHOLDER_TOOLS;
  return NODE_MCP_TOOLSETS[tileType] ?? [];
}
function getAllNodeToolNames(tileType) {
  return getTileNodeTools(tileType).map((tool) => tool.name);
}
function getNodeToolSchemaByName(name) {
  for (const tools of Object.values(NODE_MCP_TOOLSETS)) {
    const match = tools.find((tool) => tool.name === name);
    if (match) return match;
  }
  return void 0;
}
function getAllNodeTools() {
  const out = [];
  for (const tools of Object.values(NODE_MCP_TOOLSETS)) {
    out.push(...tools);
  }
  return out;
}
function getPeerBridgeNodeTools() {
  const out = [];
  for (const [scope, tools] of Object.entries(NODE_MCP_TOOLSETS)) {
    if (scope === "universal") continue;
    out.push(...tools);
  }
  return out;
}
function withCapabilityPrefix(toolName) {
  return `${NODE_TOOL_SCOPE_PREFIX}${toolName}`;
}
function stripCapabilityPrefix(raw) {
  if (raw.startsWith(NODE_TOOL_SCOPE_PREFIX)) return raw.slice(NODE_TOOL_SCOPE_PREFIX.length);
  return raw;
}
function toContexMcpToolName(toolName) {
  return `${CONTEX_MCP_TOOL_PREFIX}${toolName}`;
}
function normalizeNodeToolName(raw) {
  let name = stripCapabilityPrefix(raw);
  if (name.startsWith(CONTEX_MCP_TOOL_PREFIX)) name = name.slice(CONTEX_MCP_TOOL_PREFIX.length);
  return name;
}
function getDisconnectedPeerBridgeMcpToolNames(negotiatedTools = []) {
  const negotiated = new Set(Array.from(negotiatedTools, normalizeNodeToolName));
  return getPeerBridgeNodeTools().filter((tool) => !negotiated.has(tool.name)).map((tool) => toContexMcpToolName(tool.name)).sort();
}
function buildPeerCommandPayload(tileId, command, payload = {}) {
  return {
    ...payload,
    tileId,
    cardId: tileId,
    command
  };
}
const agentStates = /* @__PURE__ */ new Map();
const peerMessages = /* @__PURE__ */ new Map();
const linkedPeers = /* @__PURE__ */ new Map();
let notifyTerminalFn = null;
function setTerminalNotifier(fn) {
  notifyTerminalFn = fn;
}
function updateLinks(tileId, peerIds) {
  const prev = linkedPeers.get(tileId) ?? /* @__PURE__ */ new Set();
  const next = new Set(peerIds);
  linkedPeers.set(tileId, next);
  for (const peerId of next) {
    if (!prev.has(peerId)) notifyTile(tileId, `[contex] linked block: ${peerId}`);
  }
  for (const peerId of prev) {
    if (!next.has(peerId)) notifyTile(tileId, `[contex] unlinked block: ${peerId}`);
  }
}
function setState(tileId, update) {
  const existing = agentStates.get(tileId) ?? {
    tileId,
    tileType: "unknown",
    status: "idle",
    task: "",
    todos: [],
    files: [],
    updatedAt: Date.now()
  };
  const updated = {
    ...existing,
    ...update,
    tileId,
    updatedAt: Date.now()
  };
  agentStates.set(tileId, updated);
  const peers = linkedPeers.get(tileId) ?? /* @__PURE__ */ new Set();
  for (const peerId of peers) {
    const summary = formatStateChange(tileId, updated);
    notifyTile(peerId, summary);
  }
  bus.publish({
    channel: `tile:${tileId}`,
    type: "data",
    source: `peer:${tileId}`,
    payload: { action: "state_updated", state: updated }
  });
  return updated;
}
function getState(tileId) {
  return agentStates.get(tileId) ?? null;
}
function getLinkedPeerStates(tileId) {
  const peers = linkedPeers.get(tileId) ?? /* @__PURE__ */ new Set();
  const states = [];
  for (const peerId of peers) {
    const s = agentStates.get(peerId);
    if (s) states.push(s);
  }
  return states;
}
function addTodo(tileId, text) {
  const state = agentStates.get(tileId);
  if (!state) throw new Error(`No agent state for block ${tileId} — call peer_set_state first`);
  const todo = {
    id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    done: false,
    createdAt: Date.now()
  };
  state.todos.push(todo);
  state.updatedAt = Date.now();
  const peers = linkedPeers.get(tileId) ?? /* @__PURE__ */ new Set();
  for (const peerId of peers) {
    notifyTile(peerId, `[contex] ${tileId} added todo: "${text}"`);
  }
  return todo;
}
function completeTodo(tileId, todoId) {
  const state = agentStates.get(tileId);
  if (!state) return false;
  const todo = state.todos.find((t) => t.id === todoId);
  if (!todo || todo.done) return false;
  todo.done = true;
  state.updatedAt = Date.now();
  const peers = linkedPeers.get(tileId) ?? /* @__PURE__ */ new Set();
  for (const peerId of peers) {
    notifyTile(peerId, `[contex] ${tileId} completed: "${todo.text}"`);
  }
  return true;
}
function sendMessage(fromTileId, toTileId, text) {
  const fromState = agentStates.get(fromTileId);
  const msg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from: fromTileId,
    fromType: fromState?.tileType ?? "unknown",
    text,
    timestamp: Date.now(),
    read: false
  };
  const inbox = peerMessages.get(toTileId) ?? [];
  inbox.push(msg);
  if (inbox.length > 50) inbox.splice(0, inbox.length - 50);
  peerMessages.set(toTileId, inbox);
  notifyTile(toTileId, `[contex] Message from block ${fromTileId} (${msg.fromType}): ${text}`);
  bus.publish({
    channel: `tile:${toTileId}`,
    type: "data",
    source: `peer:${fromTileId}`,
    payload: { action: "peer_message", message: msg }
  });
  return msg;
}
function readMessages(tileId) {
  const msgs = peerMessages.get(tileId) ?? [];
  for (const m of msgs) m.read = true;
  return msgs;
}
function getUnreadMessages(tileId) {
  return (peerMessages.get(tileId) ?? []).filter((m) => !m.read);
}
function notifyTile(tileId, line) {
  if (notifyTerminalFn) {
    notifyTerminalFn(tileId, line);
  }
  bus.publish({
    channel: `tile:${tileId}`,
    type: "notification",
    source: "peer-state",
    payload: { message: line }
  });
}
function formatStateChange(tileId, state) {
  const parts = [`[contex] Peer block ${tileId} (${state.tileType})`];
  if (state.status !== "idle") parts.push(`status: ${state.status}`);
  if (state.task) parts.push(`task: "${state.task}"`);
  const pending = state.todos.filter((t) => !t.done).length;
  if (pending > 0) parts.push(`${pending} todos pending`);
  if (state.files.length > 0) parts.push(`files: ${state.files.slice(0, 3).join(", ")}`);
  return parts.join(" — ");
}
function removeTile(tileId) {
  agentStates.delete(tileId);
  peerMessages.delete(tileId);
  linkedPeers.delete(tileId);
  for (const [, peers] of linkedPeers) {
    peers.delete(tileId);
  }
}
function extractBalancedJsonPrefix(raw) {
  const trimmed = raw.trimStart();
  const opener = trimmed[0];
  if (opener !== "{" && opener !== "[") return null;
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === opener) {
      depth += 1;
      continue;
    }
    if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(0, i + 1);
      }
    }
  }
  return null;
}
function parseJsonArtifact(raw) {
  try {
    return { value: JSON.parse(raw), recovered: false };
  } catch {
    const candidate = extractBalancedJsonPrefix(raw);
    if (!candidate) return null;
    try {
      return { value: JSON.parse(candidate), recovered: true };
    } catch {
      return null;
    }
  }
}
async function readJsonArtifact(filePath) {
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    return parseJsonArtifact(raw);
  } catch {
    return null;
  }
}
async function writeJsonArtifactAtomic(filePath, value) {
  await fs.promises.mkdir(path$1.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  await fs.promises.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
  await fs.promises.rename(tempPath, filePath);
}
function assertSafeWorkspaceArtifactId(id) {
  if (/[\/\\]|\.\./.test(id)) throw new Error(`Unsafe ID: ${id}`);
}
async function migrateStorageToContexDir(storageId) {
  assertSafeWorkspaceArtifactId(storageId);
  const workspaceDir = path$1.join(CONTEX_HOME, "workspaces", storageId);
  const contexDir = path$1.join(workspaceDir, ".contex");
  try {
    await fs.promises.mkdir(contexDir, { recursive: true });
  } catch {
  }
  try {
    const entries = await fs.promises.readdir(workspaceDir);
    const migratable = entries.filter(
      (name) => name === "canvas-state.json" || name === "activity.json" || name === "mcp-merged.json" || name.startsWith("tile-state-") || name.startsWith("kanban-")
    );
    for (const name of migratable) {
      const sourcePath = path$1.join(workspaceDir, name);
      const destinationPath = path$1.join(contexDir, name);
      try {
        await fs.promises.access(destinationPath);
      } catch {
        await fs.promises.rename(sourcePath, destinationPath);
      }
    }
  } catch {
  }
}
const migratedStorageIds = /* @__PURE__ */ new Set();
async function resolveStorageIds(workspaceId) {
  const ids = await getWorkspaceStorageIds(workspaceId);
  return Array.from(new Set(ids));
}
async function ensureWorkspaceStorageMigrated(workspaceId) {
  const storageIds = await resolveStorageIds(workspaceId);
  for (const storageId of storageIds) {
    if (migratedStorageIds.has(storageId)) continue;
    migratedStorageIds.add(storageId);
    await migrateStorageToContexDir(storageId);
  }
  return storageIds;
}
function canvasStatePath(storageId) {
  assertSafeWorkspaceArtifactId(storageId);
  return path$1.join(CONTEX_HOME, "workspaces", storageId, ".contex", "canvas-state.json");
}
function kanbanStatePath(storageId, tileId) {
  assertSafeWorkspaceArtifactId(storageId);
  assertSafeWorkspaceArtifactId(tileId);
  return path$1.join(CONTEX_HOME, "workspaces", storageId, ".contex", `kanban-${tileId}.json`);
}
function tileStatePath(storageId, tileId) {
  assertSafeWorkspaceArtifactId(storageId);
  assertSafeWorkspaceArtifactId(tileId);
  return path$1.join(CONTEX_HOME, "workspaces", storageId, ".contex", `tile-state-${tileId}.json`);
}
function tileSessionSummaryPath(storageId, tileId) {
  assertSafeWorkspaceArtifactId(storageId);
  assertSafeWorkspaceArtifactId(tileId);
  return path$1.join(CONTEX_HOME, "workspaces", storageId, ".contex", `tile-session-${tileId}.json`);
}
function sessionArchiveStatePath(storageId) {
  assertSafeWorkspaceArtifactId(storageId);
  return path$1.join(CONTEX_HOME, "workspaces", storageId, ".contex", "session-archives.json");
}
async function loadWorkspaceTileState(workspaceId, tileId, fallback) {
  const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
  for (const storageId of storageIds) {
    const path2 = tileStatePath(storageId, tileId);
    const parsed = await readJsonArtifact(path2);
    if (parsed) {
      if (parsed.recovered) {
        await writeJsonArtifactAtomic(path2, parsed.value).catch(() => {
        });
      }
      return parsed.value;
    }
  }
  return fallback;
}
async function saveWorkspaceTileState(workspaceId, tileId, state) {
  const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
  const storageId = storageIds[0] ?? workspaceId;
  const dir = path$1.join(CONTEX_HOME, "workspaces", storageId, ".contex");
  const path2 = tileStatePath(storageId, tileId);
  await fs.promises.mkdir(dir, { recursive: true });
  await writeJsonArtifactAtomic(path2, state);
  return { storageId, path: path2 };
}
function selectImageProvider(settings, requestedProvider) {
  const providers = Object.values(settings.generationProviders ?? {});
  const normalize = (value) => value.trim().toLowerCase();
  if (requestedProvider?.trim()) {
    const requested = normalize(requestedProvider);
    const provider2 = providers.find((entry) => normalize(entry.id) === requested || normalize(entry.label) === requested);
    if (!provider2) return `Image generation provider "${requestedProvider}" is not configured`;
    if (!provider2.enabled) return `Image generation provider "${provider2.label}" is disabled in Settings > Providers`;
    if (!provider2.capabilities.includes("image")) return `Image generation provider "${provider2.label}" does not support images`;
    if (!provider2.apiKey?.trim() && provider2.id !== "local") return `Image generation provider "${provider2.label}" needs an API key in Settings > Providers`;
    return { provider: provider2, model: provider2.imageModel?.trim() || defaultImageModelForProvider(provider2.id) };
  }
  const candidates = providers.filter(
    (provider2) => provider2.enabled && provider2.capabilities.includes("image") && (provider2.apiKey?.trim() || provider2.id === "local")
  );
  const provider = candidates.find((entry) => entry.id === "gemini") ?? candidates[0];
  if (!provider) return "No enabled image provider with an API key. Open Settings > Providers, enable Gemini / Nano Banana, and add an API key.";
  return { provider, model: provider.imageModel?.trim() || defaultImageModelForProvider(provider.id) };
}
function defaultImageModelForProvider(providerId) {
  if (providerId === "gemini") return "gemini-2.5-flash-image";
  return "";
}
function mimeTypeForImagePath(filePath) {
  const ext = path$1.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}
function extensionForMimeType(mimeType, fallbackPath) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  const fallback = fallbackPath ? path$1.extname(fallbackPath) : "";
  return fallback || ".png";
}
function makeImageOutputPath(sourcePath, explicitOutputPath, mimeType = "image/png") {
  if (explicitOutputPath?.trim()) {
    const requested = explicitOutputPath.trim();
    return path$1.isAbsolute(requested) ? requested : path$1.join(path$1.dirname(sourcePath), requested);
  }
  const ext = extensionForMimeType(mimeType, sourcePath);
  const base = path$1.basename(sourcePath, path$1.extname(sourcePath) || ext).replace(/[^\w.-]+/g, "-");
  return path$1.join(path$1.dirname(sourcePath), `${base}-edited-${Date.now()}${ext}`);
}
function extractGeminiInlineImage(payload) {
  const root = payload && typeof payload === "object" ? payload : {};
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  for (const candidate of candidates) {
    const candidateObj = candidate && typeof candidate === "object" ? candidate : {};
    const content = candidateObj.content && typeof candidateObj.content === "object" ? candidateObj.content : {};
    const parts = Array.isArray(content.parts) ? content.parts : [];
    for (const part of parts) {
      const partObj = part && typeof part === "object" ? part : {};
      const inlineData = partObj.inlineData ?? partObj.inline_data;
      const inlineObj = inlineData && typeof inlineData === "object" ? inlineData : null;
      const data = typeof inlineObj?.data === "string" ? inlineObj.data : "";
      if (!data) continue;
      const mimeType = typeof inlineObj?.mimeType === "string" ? inlineObj.mimeType : typeof inlineObj?.mime_type === "string" ? inlineObj.mime_type : "image/png";
      return { data, mimeType };
    }
  }
  return null;
}
const MCP_TOKEN = node_crypto.randomUUID();
const MAX_BODY = 1024 * 1024;
const sseClients = /* @__PURE__ */ new Map();
const getContexDir = () => CONTEX_HOME;
const SETTINGS_PATH$1 = path$1.join(CONTEX_HOME, "settings.json");
const LEGACY_CONFIG_PATH$1 = path$1.join(CONTEX_HOME, "config.json");
async function readAppSettingsForMcp() {
  for (const path2 of [SETTINGS_PATH$1, LEGACY_CONFIG_PATH$1]) {
    try {
      const raw = await fs.promises.readFile(path2, "utf8");
      const parsed = JSON.parse(raw);
      const settings = parsed && typeof parsed === "object" && "settings" in parsed ? parsed.settings : parsed;
      return withDefaultSettings(settings);
    } catch {
    }
  }
  return withDefaultSettings({});
}
async function readCanvasStateTiles(workspaceId) {
  const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
  for (const storageId of storageIds) {
    try {
      const raw = await fs.promises.readFile(canvasStatePath(storageId), "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tiles)) return parsed.tiles;
    } catch {
    }
  }
  return [];
}
async function findNoteTileBackingFile(tileId) {
  const workspaces = await readWorkspaceRefsFromUserConfig();
  for (const ws of workspaces) {
    try {
      const notePath = path$1.join(ws.path, ".contex", tileId, "context", "note.txt");
      const stat = await fs.promises.stat(notePath).catch(() => null);
      if (stat?.isFile()) return notePath;
    } catch {
    }
    try {
      const tiles = await readCanvasStateTiles(ws.id);
      const tile = tiles.find((entry) => entry?.id === tileId && entry?.type === "note");
      const filePath = typeof tile?.filePath === "string" ? tile.filePath.trim() : "";
      if (filePath) return filePath;
    } catch {
    }
  }
  return null;
}
async function findImageTileSourcePath(tileId) {
  const workspaces = await readWorkspaceRefsFromUserConfig();
  for (const ws of workspaces) {
    try {
      const tiles = await readCanvasStateTiles(ws.id);
      const tile = tiles.find((entry) => entry?.id === tileId && entry?.type === "image");
      const filePath = typeof tile?.filePath === "string" ? tile.filePath.trim() : "";
      if (filePath) return { workspaceId: ws.id, filePath };
    } catch {
    }
    try {
      const state = await loadWorkspaceTileState(ws.id, tileId, {});
      const contextPath = state._context?.["ctx:image:path"]?.value ?? state._context?.["ctx:file:path"]?.value;
      const filePath = typeof contextPath === "string" ? contextPath.trim() : "";
      if (filePath) return { workspaceId: ws.id, filePath };
    } catch {
    }
  }
  return null;
}
async function setTileContextFromMcp(workspaceId, tileId, key, value) {
  const state = await loadWorkspaceTileState(workspaceId, tileId, {});
  if (!state._context) state._context = {};
  state._context[key] = { key, value, updatedAt: Date.now(), source: "mcp:contex" };
  await saveWorkspaceTileState(workspaceId, tileId, state);
}
async function readWorkspaceRefsFromUserConfig() {
  try {
    const userConfigPath = path$1.join(getContexDir(), "config.json");
    const raw = await fs.promises.readFile(userConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.projects) && Array.isArray(parsed.workspaces)) {
      const projectsById = new Map(
        parsed.projects.filter((project) => typeof project?.id === "string" && typeof project?.path === "string" && project.path.trim()).map((project) => [String(project.id), String(project.path).trim()])
      );
      return parsed.workspaces.flatMap((workspace) => {
        const workspaceId = typeof workspace?.id === "string" ? workspace.id : "";
        if (!workspaceId) return [];
        const directPath = typeof workspace?.path === "string" ? workspace.path.trim() : "";
        if (directPath) return [{ id: workspaceId, path: directPath }];
        const primaryProjectId = typeof workspace?.primaryProjectId === "string" ? workspace.primaryProjectId : null;
        const projectIds = Array.isArray(workspace?.projectIds) ? workspace.projectIds : [];
        const projectPath = primaryProjectId && projectsById.get(primaryProjectId) || projectIds.map((projectId) => projectsById.get(String(projectId))).find(Boolean) || "";
        return projectPath ? [{ id: workspaceId, path: projectPath }] : [];
      });
    }
    if (Array.isArray(parsed.workspaces)) {
      return parsed.workspaces.flatMap((workspace) => {
        const workspaceId = typeof workspace?.id === "string" ? workspace.id : "";
        const workspacePath = typeof workspace?.path === "string" ? workspace.path.trim() : "";
        return workspaceId && workspacePath ? [{ id: workspaceId, path: workspacePath }] : [];
      });
    }
  } catch {
  }
  return [];
}
function normalizeMcpServer(entry, fallbackUrl) {
  if (!entry || typeof entry !== "object") return fallbackUrl ? { type: "http", url: fallbackUrl } : {};
  const server = { ...entry };
  if (server.url && typeof server.url === "string") {
    server.url = server.url.replace(/\/$/, "");
  }
  if (!server.command && server.cmd && typeof server.cmd === "string") {
    const parts = String(server.cmd).trim().split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      server.command = parts[0];
      if (parts.length > 1) server.args = parts.slice(1);
    }
  }
  if (!server.type) {
    if (server.command) {
      server.type = "stdio";
    } else if (server.url || fallbackUrl) {
      server.type = "http";
    }
  }
  if (!server.url && fallbackUrl) {
    server.url = fallbackUrl;
  }
  if (server.enabled === void 0) {
    server.enabled = true;
  }
  return server;
}
function normalizeMcpServers(servers, contexUrl) {
  const normalized = {};
  for (const [name, server] of Object.entries(servers ?? {})) {
    const fallbackUrl = name === "contex" ? contexUrl : void 0;
    normalized[name] = normalizeMcpServer(server, fallbackUrl);
  }
  return normalized;
}
let extensionRegistryProvider = null;
function setExtensionRegistryProvider(provider) {
  extensionRegistryProvider = provider;
}
function getExtensionTools() {
  return extensionRegistryProvider?.()?.getMCPTools() ?? [];
}
function getAllTools() {
  const tools = [
    ...TOOLS,
    ...getAllNodeTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    })),
    ...getExtensionTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  ];
  const seen = /* @__PURE__ */ new Set();
  return tools.filter((tool) => {
    if (seen.has(tool.name)) return false;
    seen.add(tool.name);
    return true;
  });
}
async function listWorkspaceIds() {
  try {
    const raw = await fs.promises.readFile(path$1.join(getContexDir(), "config.json"), "utf8");
    const cfg = JSON.parse(raw);
    const ids = (cfg.workspaces ?? []).map((ws) => ws.id).filter(Boolean);
    if (ids.length > 0) return ids;
  } catch {
  }
  try {
    const entries = await fs.promises.readdir(path$1.join(CONTEX_HOME, "workspaces"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}
function kanbanStateFile(workspaceId, boardTileId) {
  return path$1.join(CONTEX_HOME, "workspaces", workspaceId, ".contex", `kanban-${boardTileId}.json`);
}
async function resolveKanbanTarget(boardTileId, workspaceId) {
  const workspaceIds = workspaceId ? [workspaceId] : await listWorkspaceIds();
  const candidates = [];
  for (const wsId of workspaceIds) {
    if (boardTileId) {
      const path2 = kanbanStateFile(wsId, boardTileId);
      try {
        await fs.promises.access(path2);
        candidates.push({ workspaceId: wsId, boardTileId, path: path2 });
      } catch {
      }
      continue;
    }
    try {
      const dir = path$1.join(CONTEX_HOME, "workspaces", wsId, ".contex");
      const entries = await fs.promises.readdir(dir);
      for (const name of entries) {
        const match = /^kanban-(.+)\.json$/.exec(name);
        if (!match) continue;
        candidates.push({ workspaceId: wsId, boardTileId: match[1], path: path$1.join(dir, name) });
      }
    } catch {
    }
  }
  if (candidates.length === 0) {
    throw new Error(boardTileId ? `Kanban board '${boardTileId}' not found` : "No kanban boards found");
  }
  if (candidates.length > 1) {
    throw new Error(`Multiple kanban boards found; specify board_tile_id (${candidates.map((c) => c.boardTileId).join(", ")})`);
  }
  const target = candidates[0];
  const raw = await fs.promises.readFile(target.path, "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...target,
    state: {
      columns: Array.isArray(parsed.columns) ? parsed.columns : [],
      cards: Array.isArray(parsed.cards) ? parsed.cards : []
    }
  };
}
async function saveKanbanTarget(target, state) {
  await fs.promises.mkdir(path$1.join(CONTEX_HOME, "workspaces", target.workspaceId, ".contex"), { recursive: true });
  await fs.promises.writeFile(target.path, JSON.stringify(state, null, 2));
}
function summarizeKanbanState(target) {
  return JSON.stringify({
    workspaceId: target.workspaceId,
    boardTileId: target.boardTileId,
    columns: target.state.columns,
    cards: target.state.cards.map((card) => ({
      id: card.id,
      title: card.title,
      columnId: card.columnId,
      launched: card.launched,
      agent: card.agent,
      model: card.model,
      tools: card.tools,
      fileRefs: card.fileRefs,
      cardRefs: card.cardRefs
    }))
  }, null, 2);
}
const TOOLS = [
  // ── Canvas tools ──────────────────────────────────────────────────────────
  {
    name: "canvas_create_tile",
    description: 'Create a new block on the infinite canvas. Core types: terminal, code, note, image, kanban, browser. Extension blocks use the ext:<id> prefix, e.g. "ext:agent-kanban-board", "ext:api-proxy-config". Call list_extensions first to see installed extension block types.',
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Block type. Core: terminal|code|note|image|kanban|browser. Extensions: ext:<block-type> (use list_extensions to discover)." },
        title: { type: "string" },
        file_path: { type: "string", description: "Absolute path to open in the block (for code/note/image) or URL for browser" },
        x: { type: "number", description: "World-space X position (optional)" },
        y: { type: "number", description: "World-space Y position (optional)" }
      },
      required: ["type"]
    }
  },
  {
    name: "canvas_open_file",
    description: "Open a file from the workspace as a block on the canvas.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative or absolute path" }
      },
      required: ["path"]
    }
  },
  {
    name: "canvas_pan_to",
    description: "Pan the canvas viewport to a specific world-space position.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "canvas_list_tiles",
    description: "List all blocks currently on the canvas.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_extensions",
    description: "List all installed extensions with their block types and available actions. Call this before canvas_create_tile with an ext: type, or before ext_invoke_action, to discover what is available.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "generation_list_providers",
    description: "List configured image and video generation providers. API keys are redacted; use this to choose provider and model ids for image/video tooling requests.",
    inputSchema: { type: "object", properties: {} }
  },
  // ── Kanban tools ─────────────────────────────────────────────────────────
  {
    name: "card_complete",
    description: "Call this when your task is complete. Moves the card to the next column on the canvas.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "Your card ID — available as $CARD_ID" },
        summary: { type: "string", description: "What was done" },
        next_col: { type: "string", description: "Override target column id (optional)" }
      },
      required: ["card_id", "summary"]
    }
  },
  {
    name: "card_update",
    description: "Stream a progress note to the canvas mid-task.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string" },
        note: { type: "string", description: "Progress update visible on the canvas" },
        status: { type: "string", enum: ["working", "blocked", "waiting"], description: "Optional status" }
      },
      required: ["card_id", "note"]
    }
  },
  {
    name: "card_error",
    description: "Signal that the task failed or needs human review.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string" },
        reason: { type: "string" }
      },
      required: ["card_id", "reason"]
    }
  },
  {
    name: "canvas_event",
    description: "Send a custom event to the canvas host.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string" },
        event: { type: "string" },
        payload: { type: "object" }
      },
      required: ["card_id", "event"]
    }
  },
  {
    name: "request_input",
    description: "Ask the canvas operator for input or clarification. Blocks until the canvas responds via /inject.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string" },
        question: { type: "string", description: "What do you need from the human?" },
        options: { type: "array", items: { type: "string" }, description: "Optional choices to present" }
      },
      required: ["card_id", "question"]
    }
  },
  {
    name: "kanban_get_board",
    description: "Return columns and cards for a built-in kanban board. If multiple boards exist, specify board_tile_id.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" }
      }
    }
  },
  {
    name: "kanban_create_card",
    description: "Create a kanban card on a built-in kanban board.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        instructions: { type: "string" },
        column_id: { type: "string" },
        agent: { type: "string" },
        model: { type: "string" },
        tools: { type: "array", items: { type: "string" } },
        file_refs: { type: "array", items: { type: "string" } },
        card_refs: { type: "array", items: { type: "string" } },
        color: { type: "string" }
      },
      required: ["title"]
    }
  },
  {
    name: "kanban_update_card",
    description: "Edit an existing kanban card on a built-in kanban board.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" },
        card_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        instructions: { type: "string" },
        column_id: { type: "string" },
        agent: { type: "string" },
        model: { type: "string" },
        tools: { type: "array", items: { type: "string" } },
        file_refs: { type: "array", items: { type: "string" } },
        card_refs: { type: "array", items: { type: "string" } },
        color: { type: "string" },
        launched: { type: "boolean" }
      },
      required: ["card_id"]
    }
  },
  {
    name: "kanban_move_card",
    description: "Move a kanban card to another column.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" },
        card_id: { type: "string" },
        column_id: { type: "string" }
      },
      required: ["card_id", "column_id"]
    }
  },
  {
    name: "kanban_pause_card",
    description: "Pause a running kanban card.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" },
        card_id: { type: "string" }
      },
      required: ["card_id"]
    }
  },
  {
    name: "kanban_delete_card",
    description: "Delete a kanban card.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" },
        card_id: { type: "string" }
      },
      required: ["card_id"]
    }
  },
  {
    name: "kanban_create_column",
    description: "Create a new kanban column/list.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" },
        title: { type: "string" },
        column_id: { type: "string" }
      },
      required: ["title"]
    }
  },
  {
    name: "kanban_rename_column",
    description: "Rename a kanban column/list.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" },
        column_id: { type: "string" },
        title: { type: "string" }
      },
      required: ["column_id", "title"]
    }
  },
  {
    name: "kanban_delete_column",
    description: "Delete a kanban column/list and its cards.",
    inputSchema: {
      type: "object",
      properties: {
        board_tile_id: { type: "string" },
        workspace_id: { type: "string" },
        column_id: { type: "string" }
      },
      required: ["column_id"]
    }
  },
  // ── Bus tools (universal) ────────────────────────────────────────────────
  {
    name: "update_progress",
    description: "Report progress on a task. Any block subscribed to this channel will see the update.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel to publish to (e.g. tile:abc123, task:xyz)" },
        status: { type: "string", description: "Current status text" },
        percent: { type: "number", description: "Progress 0-100 (optional)" },
        detail: { type: "string", description: "Additional detail (optional)" }
      },
      required: ["channel", "status"]
    }
  },
  {
    name: "log_activity",
    description: "Log an activity event. Appears in any subscribed activity feed or block indicator.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel to publish to" },
        message: { type: "string", description: "Activity message" },
        level: { type: "string", enum: ["info", "warn", "error", "success"], description: "Severity level" }
      },
      required: ["channel", "message"]
    }
  },
  {
    name: "create_task",
    description: "Create a new task visible to any subscribed task list or kanban.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel to publish to" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] }
      },
      required: ["channel", "title"]
    }
  },
  {
    name: "update_task",
    description: "Update a task status.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        task_id: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] },
        title: { type: "string", description: "Updated title (optional)" },
        detail: { type: "string", description: "Status detail (optional)" }
      },
      required: ["channel", "task_id", "status"]
    }
  },
  {
    name: "notify",
    description: "Send a notification to the canvas operator.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        title: { type: "string" },
        message: { type: "string" },
        level: { type: "string", enum: ["info", "warn", "error", "success"] }
      },
      required: ["channel", "message"]
    }
  },
  {
    name: "ask",
    description: "Ask the canvas operator a question. Returns when they respond.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        question: { type: "string" },
        options: { type: "array", items: { type: "string" }, description: "Optional choices" }
      },
      required: ["channel", "question"]
    }
  },
  // ── Collab tools ────────────────────────────────────────────────────────
  {
    name: "reload_objective",
    description: "Read the latest objective.md for a block. Call this when you receive a reload signal or need to refresh your instructions.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "The block ID whose objective to read" }
      },
      required: ["tile_id"]
    }
  },
  {
    name: "pause_task",
    description: "Pause a task. The drawer UI will show it as paused and the operator can resume it.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel to publish to (e.g. tile:abc123)" },
        task_id: { type: "string" },
        reason: { type: "string", description: "Why the task is being paused" }
      },
      required: ["channel", "task_id"]
    }
  },
  {
    name: "get_context",
    description: "Read all context files dropped into a block's .contex context folder. Returns concatenated content of all notes and reference files.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "The block ID whose context to read" }
      },
      required: ["tile_id"]
    }
  },
  // ── Peer collaboration tools ───────────────────────────────────────────
  {
    name: "peer_set_state",
    description: "Declare your current work state so linked peers can see what you are doing. Call this when you start a task, change status, or update your file list.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "Your block ID (use $CARD_ID)" },
        tile_type: { type: "string", description: "Your block type (terminal, chat, etc.)" },
        status: { type: "string", enum: ["idle", "working", "blocked", "waiting", "done"], description: "Current status" },
        task: { type: "string", description: "What you are currently working on" },
        files: { type: "array", items: { type: "string" }, description: "Files you are actively editing" }
      },
      required: ["tile_id"]
    }
  },
  {
    name: "peer_get_state",
    description: "Read the work state of all linked peers — their status, current task, todos, and files. Call this to coordinate and avoid duplicating work.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "Your block ID — returns states of your linked peers" }
      },
      required: ["tile_id"]
    }
  },
  {
    name: "peer_send_message",
    description: "Send a direct message to a linked peer. The peer will see it as a notification and can read it with peer_read_messages.",
    inputSchema: {
      type: "object",
      properties: {
        from_tile_id: { type: "string", description: "Your block ID" },
        to_tile_id: { type: "string", description: "Recipient peer block ID" },
        message: { type: "string", description: "Message text" }
      },
      required: ["from_tile_id", "to_tile_id", "message"]
    }
  },
  {
    name: "peer_read_messages",
    description: "Read messages sent to you by linked peers. Returns all messages (marks unread as read).",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "Your block ID" }
      },
      required: ["tile_id"]
    }
  },
  {
    name: "peer_add_todo",
    description: "Add a todo item to your shared list. Linked peers are notified and can see your todos via peer_get_state.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "Your block ID" },
        text: { type: "string", description: "Todo item text" }
      },
      required: ["tile_id", "text"]
    }
  },
  {
    name: "peer_complete_todo",
    description: "Mark one of your todos as done. Linked peers are notified.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "Your block ID" },
        todo_id: { type: "string", description: "The todo ID to complete" }
      },
      required: ["tile_id", "todo_id"]
    }
  },
  // ── Context tools ───────────────────────────────────────────────────────
  {
    name: "tile_context_get",
    description: "Read context entries from a block. Agents can read/write any block context across workspaces.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "The block ID to read context from" },
        workspace_id: { type: "string", description: "The workspace ID (optional; uses first workspace if omitted)" },
        tag: { type: "string", description: 'Filter by tag prefix (e.g., "ctx:design"; optional)' }
      },
      required: ["tile_id"]
    }
  },
  {
    name: "tile_context_set",
    description: "Write a context entry to a block. Agents can read/write any block context across workspaces.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "The block ID to write context to" },
        workspace_id: { type: "string", description: "The workspace ID (optional; uses first workspace if omitted)" },
        key: { type: "string", description: 'Context key (e.g., "ctx:design:palette")' },
        value: { description: "Context value (any JSON-serializable value)" }
      },
      required: ["tile_id", "key", "value"]
    }
  },
  // ── Extension action tools ──────────────────────────────────────────────
  {
    name: "ext_invoke_action",
    description: "Invoke a registered action on an extension block. Extensions declare actions that connected blocks can call (e.g. generate, setHtml). Use tile_context_get to read extension state afterwards.",
    inputSchema: {
      type: "object",
      properties: {
        tile_id: { type: "string", description: "Target extension block ID" },
        action: { type: "string", description: 'Action name to invoke (e.g. "generate", "setHtml")' },
        params: { type: "object", description: "Parameters for the action" }
      },
      required: ["tile_id", "action"]
    }
  }
];
function getMCPToken() {
  return MCP_TOKEN;
}
function getContexMcpToolNames() {
  return Array.from(/* @__PURE__ */ new Set([
    ...TOOLS.map((t) => t.name),
    ...getAllNodeTools().map((t) => t.name),
    ...getExtensionTools().map((t) => t.name)
  ]));
}
function pushSSE(cardId, event, data) {
  const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
  sseClients.get(cardId)?.forEach((res) => {
    try {
      res.write(payload);
    } catch {
    }
  });
  sseClients.get("global")?.forEach((res) => {
    try {
      res.write(payload);
    } catch {
    }
  });
}
function sendToRenderer(event, data) {
  electron.BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("mcp:kanban", { event, data });
  });
}
function asString$1(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function asBoolean(value) {
  return value === true;
}
function publishPeerCommand(tileId, command, payload) {
  const evt = bus.publish({
    channel: `tile:${tileId}`,
    type: "data",
    source: "mcp:contex",
    payload: buildPeerCommandPayload(tileId, command, payload)
  });
  sendToRenderer("bus:event", evt);
  return `Dispatched ${command} to ${tileId}`;
}
async function runGeminiImageEdit(options) {
  const sourceBytes = await fs.promises.readFile(options.sourcePath);
  const sourceMimeType = mimeTypeForImagePath(options.sourcePath);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": options.apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: options.prompt },
          {
            inline_data: {
              mime_type: sourceMimeType,
              data: sourceBytes.toString("base64")
            }
          }
        ]
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    })
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object" ? payload.error?.message ?? text : text;
    throw new Error(`Gemini image edit failed (${response.status}): ${message || response.statusText}`);
  }
  const generated = extractGeminiInlineImage(payload);
  if (!generated) {
    throw new Error("Gemini completed the request but did not return an image");
  }
  const outputPath = makeImageOutputPath(options.sourcePath, options.outputPath, generated.mimeType);
  await fs.promises.mkdir(path$1.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, Buffer.from(generated.data, "base64"));
  return { outputPath, mimeType: generated.mimeType };
}
async function executeImageEditTool(tileId, name, args) {
  const prompt = asString$1(args.prompt) ?? (name === "image_generate_variation" ? "Create a natural variation of this image." : "");
  if (!prompt) return "Missing prompt";
  const requestPayload = {
    prompt,
    provider: asString$1(args.provider) ?? "",
    model: asString$1(args.model) ?? "",
    maskPath: asString$1(args.mask_path) ?? "",
    outputPath: asString$1(args.output_path) ?? "",
    status: "running"
  };
  publishPeerCommand(tileId, name, requestPayload);
  const source = await findImageTileSourcePath(tileId);
  if (!source) {
    const message = `Image block ${tileId} has no source file path, so it cannot be edited`;
    publishPeerCommand(tileId, "image_edit_error", { message, prompt });
    return message;
  }
  await setTileContextFromMcp(source.workspaceId, tileId, "ctx:image:edit:request", {
    kind: name === "image_edit_request" ? "edit" : "variation",
    prompt,
    provider: requestPayload.provider,
    model: requestPayload.model,
    maskPath: requestPayload.maskPath,
    outputPath: requestPayload.outputPath,
    sourcePath: source.filePath,
    status: "running",
    at: Date.now()
  }).catch(() => {
  });
  const settings = await readAppSettingsForMcp();
  const selection = selectImageProvider(settings, asString$1(args.provider));
  if (typeof selection === "string") {
    await setTileContextFromMcp(source.workspaceId, tileId, "ctx:image:edit:last", {
      sourcePath: source.filePath,
      status: "error",
      error: selection,
      prompt,
      at: Date.now()
    }).catch(() => {
    });
    publishPeerCommand(tileId, "image_edit_error", { message: selection, prompt, sourcePath: source.filePath });
    return selection;
  }
  const model = asString$1(args.model) ?? selection.model;
  if (selection.provider.id !== "gemini") {
    const message = `Image generation provider "${selection.provider.label}" is configured but not implemented yet. Use Gemini / Nano Banana for image edits for now.`;
    await setTileContextFromMcp(source.workspaceId, tileId, "ctx:image:edit:last", {
      sourcePath: source.filePath,
      status: "error",
      error: message,
      prompt,
      provider: selection.provider.id,
      model,
      at: Date.now()
    }).catch(() => {
    });
    publishPeerCommand(tileId, "image_edit_error", { message, prompt, sourcePath: source.filePath });
    return message;
  }
  const apiKey = selection.provider.apiKey?.trim();
  if (!apiKey) {
    const message = "Gemini / Nano Banana needs an API key in Settings > Providers before it can edit images.";
    await setTileContextFromMcp(source.workspaceId, tileId, "ctx:image:edit:last", {
      sourcePath: source.filePath,
      status: "error",
      error: message,
      prompt,
      provider: selection.provider.id,
      model,
      at: Date.now()
    }).catch(() => {
    });
    publishPeerCommand(tileId, "image_edit_error", { message, prompt, sourcePath: source.filePath });
    return message;
  }
  try {
    const result = await runGeminiImageEdit({
      apiKey,
      model,
      prompt,
      sourcePath: source.filePath,
      outputPath: asString$1(args.output_path)
    });
    publishPeerCommand(tileId, "image_replace_source", {
      filePath: result.outputPath,
      note: prompt,
      provider: selection.provider.id,
      model
    });
    await Promise.all([
      setTileContextFromMcp(source.workspaceId, tileId, "ctx:image:path", result.outputPath),
      setTileContextFromMcp(source.workspaceId, tileId, "ctx:file:path", result.outputPath),
      setTileContextFromMcp(source.workspaceId, tileId, "ctx:image:edit:last", {
        sourcePath: source.filePath,
        outputPath: result.outputPath,
        note: prompt,
        provider: selection.provider.id,
        model,
        status: "done",
        at: Date.now()
      })
    ]).catch(() => {
    });
    return `Image updated via ${selection.provider.label} (${model}): ${result.outputPath}`;
  } catch (err) {
    const message = err?.message ? String(err.message) : "Image edit failed";
    await setTileContextFromMcp(source.workspaceId, tileId, "ctx:image:edit:last", {
      sourcePath: source.filePath,
      status: "error",
      error: message,
      prompt,
      provider: selection.provider.id,
      model,
      at: Date.now()
    }).catch(() => {
    });
    publishPeerCommand(tileId, "image_edit_error", {
      message,
      prompt,
      provider: selection.provider.id,
      model,
      sourcePath: source.filePath
    });
    return message;
  }
}
async function handleTool(name, args) {
  const cardId = args.card_id;
  const toolSchema = getNodeToolSchemaByName(name);
  const nodeToolNames = new Set(getPeerBridgeNodeTools().map((tool) => tool.name));
  if (toolSchema && nodeToolNames.has(name)) {
    const tileId = asString$1(args.tile_id);
    if (!tileId) return "Missing tile_id";
    if (name.startsWith("browser_") || name === "browser_set_mode") {
      const mode = asString$1(args.mode);
      const url2 = asString$1(args.url);
      if (name === "browser_navigate" && !url2) return "Missing url";
      if (name === "browser_set_mode" && (mode !== "desktop" && mode !== "mobile")) return "Invalid mode";
      return publishPeerCommand(tileId, name, { url: url2 ?? "", mode });
    }
    if (name === "terminal_send_input") {
      const input = asString$1(args.input);
      if (!input) return "Missing input";
      return publishPeerCommand(tileId, name, { input, enter: asBoolean(args.enter) });
    }
    if (name === "chat_send_message" || name === "chat_acknowledge") {
      const message = asString$1(args.message) ?? asString$1(args.note);
      if (!message) return "Missing message";
      return publishPeerCommand(tileId, name, { message });
    }
    if (name === "code_open_file") {
      const filePath = asString$1(args.file_path);
      if (!filePath) return "Missing file_path";
      return publishPeerCommand(tileId, name, { filePath });
    }
    if (name === "note_read_content") {
      try {
        const notePath = await findNoteTileBackingFile(tileId);
        if (notePath) return await fs.promises.readFile(notePath, "utf8");
      } catch {
      }
      return `Note block ${tileId} is empty or not found`;
    }
    if (name === "note_write_content") {
      const content = asString$1(args.content);
      if (content === void 0) return "Missing content";
      try {
        const notePath = await findNoteTileBackingFile(tileId);
        if (notePath) await fs.promises.writeFile(notePath, content, "utf8");
      } catch {
      }
      return publishPeerCommand(tileId, name, { content });
    }
    if (name === "note_append_context" || name === "file_open_context" || name === "image_annotate" || name === "kanban_set_status") {
      const content = asString$1(name === "kanban_set_status" ? args.message : args.snippet ?? args.context ?? args.note ?? args.message);
      if (!content) return "Missing message";
      if (name === "note_append_context") {
        try {
          const notePath = await findNoteTileBackingFile(tileId);
          if (notePath) {
            const previous = await fs.promises.readFile(notePath, "utf8").catch(() => "");
            const next = previous ? `${previous}
${content}` : content;
            await fs.promises.writeFile(notePath, next, "utf8");
          }
        } catch {
        }
      }
      return publishPeerCommand(tileId, name, { content });
    }
    if (name === "image_edit_request" || name === "image_generate_variation") {
      return executeImageEditTool(tileId, name, args);
    }
    if (name === "image_replace_source") {
      const filePath = asString$1(args.file_path);
      if (!filePath) return "Missing file_path";
      return publishPeerCommand(tileId, name, {
        filePath,
        note: asString$1(args.note) ?? ""
      });
    }
    if (name === "kanban_create_card" || name === "kanban_update_card" || name === "kanban_move_card" || name === "kanban_pause_card" || name === "kanban_delete_card" || name === "kanban_create_column" || name === "kanban_rename_column" || name === "kanban_delete_column") {
      return publishPeerCommand(tileId, name, { ...args });
    }
    return publishPeerCommand(tileId, name, {});
  }
  if (name === "canvas_create_tile") {
    sendToRenderer("canvas_create_tile", {
      type: args.type,
      title: args.title,
      filePath: args.file_path,
      x: args.x,
      y: args.y
    });
    return `Block created: ${args.type}${args.title ? ` "${args.title}"` : ""}`;
  }
  if (name === "canvas_open_file") {
    sendToRenderer("canvas_open_file", { path: args.path });
    return `Opening file: ${args.path}`;
  }
  if (name === "canvas_pan_to") {
    sendToRenderer("canvas_pan_to", { x: args.x, y: args.y });
    return `Canvas panned to (${args.x}, ${args.y})`;
  }
  if (name === "canvas_list_tiles") {
    sendToRenderer("canvas_list_tiles", {});
    return "Block list requested — canvas will emit canvas_tiles_response event";
  }
  if (name === "card_complete") {
    const payload = { cardId, summary: args.summary, nextCol: args.next_col };
    pushSSE(cardId, "card_complete", payload);
    sendToRenderer("card_complete", payload);
    bus.publish({
      channel: `card:${cardId}`,
      type: "task",
      source: "mcp",
      payload: { cardId, summary: args.summary, nextCol: args.next_col, action: "complete" }
    });
    return `Card ${cardId} marked complete: ${args.summary}`;
  }
  if (name === "card_update") {
    const payload = { cardId, note: args.note, status: args.status };
    pushSSE(cardId, "card_update", payload);
    sendToRenderer("card_update", payload);
    bus.publish({
      channel: `card:${cardId}`,
      type: "progress",
      source: "mcp",
      payload: { cardId, note: args.note, status: args.status }
    });
    return `Card ${cardId} updated`;
  }
  if (name === "card_error") {
    const payload = { cardId, reason: args.reason };
    pushSSE(cardId, "card_error", payload);
    sendToRenderer("card_error", payload);
    bus.publish({
      channel: `card:${cardId}`,
      type: "notification",
      source: "mcp",
      payload: { cardId, reason: args.reason, level: "error" }
    });
    return `Card ${cardId} flagged: ${args.reason}`;
  }
  if (name === "canvas_event") {
    const payload = { cardId, event: args.event, data: args.payload ?? {} };
    pushSSE(cardId, args.event, payload);
    sendToRenderer("canvas_event", payload);
    bus.publish({
      channel: `card:${cardId}`,
      type: "data",
      source: "mcp",
      payload: { cardId, event: args.event, data: args.payload ?? {} }
    });
    return `Event '${args.event}' sent to canvas`;
  }
  if (name === "request_input") {
    const payload = { cardId, question: args.question, options: args.options ?? [] };
    pushSSE(cardId, "input_requested", payload);
    sendToRenderer("input_requested", payload);
    bus.publish({
      channel: `card:${cardId}`,
      type: "ask",
      source: "mcp",
      payload: { cardId, question: args.question, options: args.options ?? [] }
    });
    return `Input requested from canvas operator: "${args.question}"`;
  }
  if (name.startsWith("kanban_")) {
    const boardTileId = asString$1(args.board_tile_id);
    const workspaceId = asString$1(args.workspace_id);
    try {
      const target = await resolveKanbanTarget(boardTileId, workspaceId);
      const state = {
        columns: [...target.state.columns],
        cards: [...target.state.cards]
      };
      if (name === "kanban_get_board") {
        return summarizeKanbanState(target);
      }
      if (name === "kanban_create_card") {
        const title = asString$1(args.title);
        if (!title) return "Missing title";
        const columnId = asString$1(args.column_id) ?? state.columns[0]?.id ?? "backlog";
        const now = Date.now();
        const card = {
          id: `card-${target.boardTileId}-${now}`,
          title,
          description: asString$1(args.description) ?? "",
          instructions: asString$1(args.instructions) ?? "",
          columnId,
          color: asString$1(args.color) ?? "rgba(88, 166, 255, 0.16)",
          agent: asString$1(args.agent) ?? "claude",
          model: asString$1(args.model),
          mcpConfig: void 0,
          mcpServers: [],
          tools: Array.isArray(args.tools) ? args.tools.filter((v) => typeof v === "string") : ["all"],
          skillsAndCommands: [],
          fileRefs: Array.isArray(args.file_refs) ? args.file_refs.filter((v) => typeof v === "string") : [],
          cardRefs: Array.isArray(args.card_refs) ? args.card_refs.filter((v) => typeof v === "string") : [],
          hooks: [],
          launched: false,
          comments: [],
          attachments: []
        };
        state.cards.push(card);
        await saveKanbanTarget(target, state);
        sendToRenderer("kanban_card_created", { boardTileId: target.boardTileId, workspaceId: target.workspaceId, card });
        return `Created card ${card.id} (${card.title}) on board ${target.boardTileId}`;
      }
      if (name === "kanban_update_card") {
        const targetCardId = asString$1(args.card_id);
        if (!targetCardId) return "Missing card_id";
        const idx = state.cards.findIndex((card2) => card2.id === targetCardId);
        if (idx < 0) return `Card ${targetCardId} not found`;
        const current = state.cards[idx];
        const patch = {};
        if (asString$1(args.title) !== void 0) patch.title = asString$1(args.title);
        if (asString$1(args.description) !== void 0) patch.description = asString$1(args.description);
        if (asString$1(args.instructions) !== void 0) patch.instructions = asString$1(args.instructions);
        if (asString$1(args.column_id) !== void 0) patch.columnId = asString$1(args.column_id);
        if (asString$1(args.agent) !== void 0) patch.agent = asString$1(args.agent);
        if (asString$1(args.model) !== void 0) patch.model = asString$1(args.model);
        if (asString$1(args.color) !== void 0) patch.color = asString$1(args.color);
        if (Array.isArray(args.tools)) patch.tools = args.tools.filter((v) => typeof v === "string");
        if (Array.isArray(args.file_refs)) patch.fileRefs = args.file_refs.filter((v) => typeof v === "string");
        if (Array.isArray(args.card_refs)) patch.cardRefs = args.card_refs.filter((v) => typeof v === "string");
        if (typeof args.launched === "boolean") patch.launched = args.launched;
        const card = { ...current, ...patch };
        state.cards[idx] = card;
        await saveKanbanTarget(target, state);
        sendToRenderer("kanban_card_updated", { boardTileId: target.boardTileId, workspaceId: target.workspaceId, cardId: targetCardId, patch });
        return `Updated card ${targetCardId}`;
      }
      if (name === "kanban_move_card") {
        const targetCardId = asString$1(args.card_id);
        const columnId = asString$1(args.column_id);
        if (!targetCardId || !columnId) return "Missing card_id or column_id";
        const idx = state.cards.findIndex((card) => card.id === targetCardId);
        if (idx < 0) return `Card ${targetCardId} not found`;
        state.cards[idx] = { ...state.cards[idx], columnId };
        await saveKanbanTarget(target, state);
        sendToRenderer("kanban_card_moved", { boardTileId: target.boardTileId, workspaceId: target.workspaceId, cardId: targetCardId, columnId });
        return `Moved card ${targetCardId} to ${columnId}`;
      }
      if (name === "kanban_pause_card") {
        const targetCardId = asString$1(args.card_id);
        if (!targetCardId) return "Missing card_id";
        const idx = state.cards.findIndex((card) => card.id === targetCardId);
        if (idx < 0) return `Card ${targetCardId} not found`;
        const current = state.cards[idx];
        state.cards[idx] = { ...current, launched: false, columnId: current.columnId === "running" ? "backlog" : current.columnId };
        await saveKanbanTarget(target, state);
        sendToRenderer("kanban_card_paused", { boardTileId: target.boardTileId, workspaceId: target.workspaceId, cardId: targetCardId });
        return `Paused card ${targetCardId}`;
      }
      if (name === "kanban_delete_card") {
        const targetCardId = asString$1(args.card_id);
        if (!targetCardId) return "Missing card_id";
        state.cards = state.cards.filter((card) => card.id !== targetCardId);
        await saveKanbanTarget(target, state);
        sendToRenderer("kanban_card_deleted", { boardTileId: target.boardTileId, workspaceId: target.workspaceId, cardId: targetCardId });
        return `Deleted card ${targetCardId}`;
      }
      if (name === "kanban_create_column") {
        const title = asString$1(args.title);
        if (!title) return "Missing title";
        const column = { id: asString$1(args.column_id) ?? `col-${Date.now()}`, title };
        state.columns.push(column);
        await saveKanbanTarget(target, state);
        sendToRenderer("kanban_column_created", { boardTileId: target.boardTileId, workspaceId: target.workspaceId, column });
        return `Created column ${column.id} (${column.title})`;
      }
      if (name === "kanban_rename_column") {
        const columnId = asString$1(args.column_id);
        const title = asString$1(args.title);
        if (!columnId || !title) return "Missing column_id or title";
        state.columns = state.columns.map((column) => column.id === columnId ? { ...column, title } : column);
        await saveKanbanTarget(target, state);
        sendToRenderer("kanban_column_renamed", { boardTileId: target.boardTileId, workspaceId: target.workspaceId, columnId, title });
        return `Renamed column ${columnId} to ${title}`;
      }
      if (name === "kanban_delete_column") {
        const columnId = asString$1(args.column_id);
        if (!columnId) return "Missing column_id";
        state.columns = state.columns.filter((column) => column.id !== columnId);
        state.cards = state.cards.filter((card) => card.columnId !== columnId);
        await saveKanbanTarget(target, state);
        sendToRenderer("kanban_column_deleted", { boardTileId: target.boardTileId, workspaceId: target.workspaceId, columnId });
        return `Deleted column ${columnId}`;
      }
    } catch (err) {
      return `Kanban tool error: ${err.message}`;
    }
  }
  if (name === "update_progress") {
    const evt = bus.publish({
      channel: args.channel,
      type: "progress",
      source: "mcp",
      payload: { status: args.status, percent: args.percent, detail: args.detail }
    });
    sendToRenderer("bus:event", evt);
    return `Progress updated on ${args.channel}: ${args.status}`;
  }
  if (name === "log_activity") {
    const evt = bus.publish({
      channel: args.channel,
      type: "activity",
      source: "mcp",
      payload: { message: args.message, level: args.level ?? "info" }
    });
    sendToRenderer("bus:event", evt);
    return `Activity logged on ${args.channel}: ${args.message}`;
  }
  if (name === "create_task") {
    const evt = bus.publish({
      channel: args.channel,
      type: "task",
      source: "mcp",
      payload: { title: args.title, description: args.description, status: args.status ?? "pending", action: "create" }
    });
    sendToRenderer("bus:event", evt);
    return `Task created on ${args.channel}: ${args.title}`;
  }
  if (name === "update_task") {
    const evt = bus.publish({
      channel: args.channel,
      type: "task",
      source: "mcp",
      payload: { task_id: args.task_id, status: args.status, title: args.title, detail: args.detail, action: "update" }
    });
    sendToRenderer("bus:event", evt);
    return `Task ${args.task_id} updated on ${args.channel}: ${args.status}`;
  }
  if (name === "notify") {
    const evt = bus.publish({
      channel: args.channel,
      type: "notification",
      source: "mcp",
      payload: { title: args.title, message: args.message, level: args.level ?? "info" }
    });
    sendToRenderer("bus:event", evt);
    return `Notification sent on ${args.channel}: ${args.message}`;
  }
  if (name === "ask") {
    const evt = bus.publish({
      channel: args.channel,
      type: "ask",
      source: "mcp",
      payload: { question: args.question, options: args.options ?? [] }
    });
    sendToRenderer("bus:event", evt);
    return `Question asked on ${args.channel}: "${args.question}"`;
  }
  if (name === "reload_objective") {
    const tileId = args.tile_id;
    try {
      const workspaces = await readWorkspaceRefsFromUserConfig();
      for (const ws of workspaces) {
        const objPath = path$1.join(ws.path, ".contex", tileId, "objective.md");
        try {
          const content = await fs.promises.readFile(objPath, "utf8");
          return content;
        } catch {
        }
      }
    } catch {
    }
    return `No objective.md found for block ${tileId}`;
  }
  if (name === "pause_task") {
    const evt = bus.publish({
      channel: args.channel,
      type: "task",
      source: "mcp",
      payload: { task_id: args.task_id, status: "paused", action: "update", reason: args.reason }
    });
    sendToRenderer("bus:event", evt);
    return `Task ${args.task_id} paused${args.reason ? `: ${args.reason}` : ""}`;
  }
  if (name === "get_context") {
    const tileId = args.tile_id;
    try {
      const workspaces = await readWorkspaceRefsFromUserConfig();
      for (const ws of workspaces) {
        const ctxDir = path$1.join(ws.path, ".contex", tileId, "context");
        try {
          const entries = await fs.promises.readdir(ctxDir);
          const parts = [];
          for (const entry of entries) {
            if (entry.startsWith(".")) continue;
            try {
              const content = await fs.promises.readFile(path$1.join(ctxDir, entry), "utf8");
              parts.push(`--- ${entry} ---
${content}`);
            } catch {
            }
          }
          if (parts.length > 0) return parts.join("\n\n");
        } catch {
        }
      }
    } catch {
    }
    return `No context files found for block ${tileId}`;
  }
  if (name === "peer_set_state") {
    const tileId = asString$1(args.tile_id);
    if (!tileId) return "Missing tile_id";
    const state = setState(tileId, {
      tileType: asString$1(args.tile_type) ?? void 0,
      status: asString$1(args.status) ?? void 0,
      task: asString$1(args.task) ?? void 0,
      files: Array.isArray(args.files) ? args.files.filter((f) => typeof f === "string") : void 0
    });
    return JSON.stringify(state, null, 2);
  }
  if (name === "peer_get_state") {
    const tileId = asString$1(args.tile_id);
    if (!tileId) return "Missing tile_id";
    const peerStates = getLinkedPeerStates(tileId);
    if (peerStates.length === 0) return "No linked peers with registered state. Peers must call peer_set_state first.";
    return JSON.stringify(peerStates, null, 2);
  }
  if (name === "peer_send_message") {
    const from = asString$1(args.from_tile_id);
    const to = asString$1(args.to_tile_id);
    const message = asString$1(args.message);
    if (!from || !to || !message) return "Missing from_tile_id, to_tile_id, or message";
    const msg = sendMessage(from, to, message);
    return `Message sent to ${to}: "${message}" (id: ${msg.id})`;
  }
  if (name === "peer_read_messages") {
    const tileId = asString$1(args.tile_id);
    if (!tileId) return "Missing tile_id";
    const msgs = readMessages(tileId);
    if (msgs.length === 0) return "No messages.";
    return JSON.stringify(msgs, null, 2);
  }
  if (name === "peer_add_todo") {
    const tileId = asString$1(args.tile_id);
    const text = asString$1(args.text);
    if (!tileId || !text) return "Missing tile_id or text";
    try {
      const todo = addTodo(tileId, text);
      return `Todo added: "${text}" (id: ${todo.id})`;
    } catch (err) {
      return err.message;
    }
  }
  if (name === "peer_complete_todo") {
    const tileId = asString$1(args.tile_id);
    const todoId = asString$1(args.todo_id);
    if (!tileId || !todoId) return "Missing tile_id or todo_id";
    const ok = completeTodo(tileId, todoId);
    return ok ? `Todo ${todoId} marked done` : `Todo ${todoId} not found or already done`;
  }
  const assertMcpSafeId = (id) => /[/\\]|\.\./.test(id) ? `Unsafe ID: ${id}` : null;
  if (name === "tile_context_get") {
    const tileId = asString$1(args.tile_id);
    const workspaceId = asString$1(args.workspace_id);
    const tagPrefix = asString$1(args.tag);
    if (!tileId) return "Missing tile_id";
    const tileIdErr = assertMcpSafeId(tileId);
    if (tileIdErr) return tileIdErr;
    if (workspaceId) {
      const wsErr = assertMcpSafeId(workspaceId);
      if (wsErr) return wsErr;
    }
    try {
      const workspaceRefs = await readWorkspaceRefsFromUserConfig();
      const workspace = workspaceId ? workspaceRefs.find((ws) => ws.id === workspaceId) : workspaceRefs[0];
      if (!workspace) return "Workspace not found";
      try {
        const state = await loadWorkspaceTileState(workspace.id, tileId, {});
        const ctx = state._context ?? {};
        const entries = Object.values(ctx);
        if (tagPrefix) {
          return JSON.stringify(entries.filter((e) => e.key?.startsWith(tagPrefix)), null, 2);
        }
        return JSON.stringify(entries, null, 2);
      } catch {
        return "[]";
      }
    } catch (err) {
      return `Error reading context: ${err.message}`;
    }
  }
  if (name === "ext_invoke_action") {
    const tileId = asString$1(args.tile_id);
    const action = asString$1(args.action);
    if (!tileId || !action) return "Missing tile_id or action";
    if (!getState(tileId)) return `Block '${tileId}' is not registered — action refused`;
    const params = typeof args.params === "object" && args.params ? args.params : {};
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("tileContext:changed", {
        tileId,
        key: "_action",
        value: { action, params, ts: Date.now() }
      });
    });
    return `Action '${action}' dispatched to extension block ${tileId}`;
  }
  if (name === "tile_context_set") {
    const tileId = asString$1(args.tile_id);
    const workspaceId = asString$1(args.workspace_id);
    const key = asString$1(args.key);
    const value = args.value;
    if (!tileId || !key) return "Missing tile_id or key";
    const tileIdErrS = assertMcpSafeId(tileId);
    if (tileIdErrS) return tileIdErrS;
    if (workspaceId) {
      const wsErr = assertMcpSafeId(workspaceId);
      if (wsErr) return wsErr;
    }
    try {
      const workspaceRefs = await readWorkspaceRefsFromUserConfig();
      const workspace = workspaceId ? workspaceRefs.find((ws) => ws.id === workspaceId) : workspaceRefs[0];
      if (!workspace) return "Workspace not found";
      const state = await loadWorkspaceTileState(workspace.id, tileId, {});
      if (!state._context) state._context = {};
      state._context[key] = { key, value, updatedAt: Date.now(), source: tileId };
      await saveWorkspaceTileState(workspace.id, tileId, state);
      bus.publish({
        channel: `ctx:${tileId}`,
        type: "data",
        source: "mcp:context",
        payload: { action: "context_changed", key, value, tileId }
      });
      return `Context ${key} set to: ${JSON.stringify(value)}`;
    } catch (err) {
      return `Error writing context: ${err.message}`;
    }
  }
  if (name === "list_extensions") {
    const registry = extensionRegistryProvider?.();
    if (!registry) return JSON.stringify([]);
    const exts = registry.getAll().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      enabled: m._enabled !== false,
      tileTypes: (m.contributes?.tiles ?? []).map((t) => ({
        type: `ext:${t.type}`,
        label: t.label
      })),
      actions: (m.contributes?.actions ?? []).map((a) => ({
        name: a.name,
        description: a.description
      })),
      contextProduces: m.contributes?.context?.produces ?? [],
      contextConsumes: m.contributes?.context?.consumes ?? []
    }));
    return JSON.stringify(exts, null, 2);
  }
  if (name === "generation_list_providers") {
    const settings = await readAppSettingsForMcp();
    const providers = Object.values(settings.generationProviders ?? {}).map((provider) => ({
      id: provider.id,
      label: provider.label,
      enabled: provider.enabled,
      capabilities: provider.capabilities,
      hasApiKey: Boolean(provider.apiKey?.trim()),
      baseUrl: provider.baseUrl ?? "",
      textModel: provider.textModel ?? "",
      imageModel: provider.imageModel ?? "",
      videoModel: provider.videoModel ?? "",
      videoAspectRatio: provider.videoAspectRatio ?? "",
      videoResolution: provider.videoResolution ?? ""
    }));
    return JSON.stringify(providers, null, 2);
  }
  const extensionTool = getExtensionTools().find((tool) => tool.name === name);
  if (extensionTool) {
    if (!extensionTool.handler) {
      return `Extension tool ${name} is declared but has no handler`;
    }
    return extensionTool.handler(args);
  }
  return "Unknown tool";
}
async function handleMCP(req) {
  if (req.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: req.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "contex", version: "1.0.0" },
        instructions: [
          "You are connected to the CodeSurf canvas collaboration server.",
          "Your block ID is in the CARD_ID environment variable.",
          "",
          'IMMEDIATELY call peer_set_state with your tile_id, tile_type, and status="idle" to register yourself.',
          "Then call peer_get_state to see linked peers.",
          "",
          "Before editing any file, call peer_get_state to check if a peer is already working on it.",
          "When you see [contex] notifications, call peer_read_messages to read incoming messages.",
          "Always call peer_set_state when changing tasks or files."
        ].join("\n")
      }
    };
  }
  if (req.method === "tools/list") {
    return { jsonrpc: "2.0", id: req.id, result: { tools: getAllTools() } };
  }
  if (req.method === "tools/call") {
    const name = req.params?.name ?? "";
    const args = req.params?.arguments ?? {};
    const result = await handleTool(name, args);
    return {
      jsonrpc: "2.0",
      id: req.id,
      result: { content: [{ type: "text", text: result }] }
    };
  }
  return {
    jsonrpc: "2.0",
    id: req.id,
    error: { code: -32601, message: "Method not found" }
  };
}
let serverPort = null;
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Authorization");
}
async function startMCPServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url2 = new URL(req.url ?? "/", `http://127.0.0.1`);
      const pathname = url2.pathname.replace(/\/+$/, "") || "/";
      const normalizedEventsPath = pathname.endsWith("/events") ? "/events" : pathname;
      const isEvents = req.method === "GET" && normalizedEventsPath === "/events";
      if (req.method === "OPTIONS") {
        setCorsHeaders(res);
        res.writeHead(200);
        res.end();
        return;
      }
      if (isEvents) {
        const cardId = url2.searchParams.get("card_id") ?? "global";
        setCorsHeaders(res);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });
        res.write(":connected\n\n");
        if (!sseClients.has(cardId)) sseClients.set(cardId, /* @__PURE__ */ new Set());
        sseClients.get(cardId).add(res);
        const ping = setInterval(() => {
          try {
            res.write(":ping\n\n");
          } catch {
            clearInterval(ping);
          }
        }, 15e3);
        req.on("close", () => {
          clearInterval(ping);
          sseClients.get(cardId)?.delete(res);
        });
        return;
      }
      if (req.method === "POST" && url2.pathname === "/push") {
        let body2 = "";
        let bodySize2 = 0;
        req.on("data", (chunk) => {
          bodySize2 += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
          if (bodySize2 > MAX_BODY) {
            setCorsHeaders(res);
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Request body too large" }));
            req.destroy();
            return;
          }
          body2 += chunk;
        });
        req.on("end", () => {
          try {
            const { card_id, event, data } = JSON.parse(body2);
            pushSSE(card_id, event, data);
            sendToRenderer(event, { cardId: card_id, ...data });
            setCorsHeaders(res);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end('{"ok":true}');
          } catch {
            setCorsHeaders(res);
            res.writeHead(400);
            res.end();
          }
        });
        return;
      }
      if (req.method === "POST" && url2.pathname === "/inject") {
        let body2 = "";
        let bodySize2 = 0;
        req.on("data", (chunk) => {
          bodySize2 += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
          if (bodySize2 > MAX_BODY) {
            setCorsHeaders(res);
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Request body too large" }));
            req.destroy();
            return;
          }
          body2 += chunk;
        });
        req.on("end", () => {
          try {
            const { card_id, message, append_newline = true } = JSON.parse(body2);
            electron.BrowserWindow.getAllWindows().forEach((win) => {
              win.webContents.send("mcp:inject", { cardId: card_id, message, appendNewline: append_newline });
            });
            pushSSE(card_id, "canvas_message", { message });
            setCorsHeaders(res);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end('{"ok":true}');
          } catch {
            setCorsHeaders(res);
            res.writeHead(400);
            res.end();
          }
        });
        return;
      }
      if (req.method !== "POST") {
        setCorsHeaders(res);
        res.writeHead(405);
        res.end();
        return;
      }
      let body = "";
      let bodySize = 0;
      req.on("data", (chunk) => {
        bodySize += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
        if (bodySize > MAX_BODY) {
          setCorsHeaders(res);
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request body too large" }));
          req.destroy();
          return;
        }
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const mcpReq = JSON.parse(body);
          const response = await handleMCP(mcpReq);
          setCorsHeaders(res);
          res.writeHead(200, {
            "Content-Type": "application/json"
          });
          res.end(JSON.stringify(response));
        } catch (e) {
          setCorsHeaders(res);
          res.writeHead(400);
          res.end();
        }
      });
    });
    server.listen(0, "127.0.0.1", async () => {
      const addr = server.address();
      serverPort = addr.port;
      const baseUrl = `http://127.0.0.1:${serverPort}`;
      const contexUrl = `${baseUrl}/mcp`;
      const configPath = path$1.join(getContexDir(), "mcp-server.json");
      const COLLAB_DIR = getContexDir();
      await fs.promises.mkdir(COLLAB_DIR, { recursive: true });
      let existingConfig = {};
      try {
        const existingRaw = await fs.promises.readFile(configPath, "utf8");
        const parsed = JSON.parse(existingRaw);
        if (parsed && typeof parsed === "object") existingConfig = parsed;
      } catch {
      }
      const existingServers = typeof existingConfig.mcpServers === "object" && existingConfig.mcpServers !== null ? existingConfig.mcpServers : {};
      const normalizedServers = normalizeMcpServers(existingServers, contexUrl);
      normalizedServers["contex"] = {
        ...normalizeMcpServer(existingConfig.mcpServers && typeof existingConfig.mcpServers === "object" ? existingConfig.mcpServers["contex"] : void 0, contexUrl),
        type: "http",
        url: contexUrl
      };
      const mcpConfig = {
        ...existingConfig ?? {},
        port: serverPort,
        url: baseUrl,
        token: MCP_TOKEN,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        mcpServers: normalizedServers,
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
        endpoints: {
          mcp: baseUrl,
          events: `${baseUrl}/events`,
          push: `${baseUrl}/push`,
          inject: `${baseUrl}/inject`
        }
      };
      await fs.promises.writeFile(configPath, JSON.stringify(mcpConfig, null, 2));
      try {
        const workspaceRefs = await readWorkspaceRefsFromUserConfig();
        for (const ws of workspaceRefs) {
          writeMCPConfigToWorkspace(ws.path).catch(() => {
          });
        }
      } catch {
      }
      console.log(`[MCP] Kanban server running on port ${serverPort}`);
      resolve(serverPort);
    });
    server.on("error", reject);
  });
}
function getMCPPort() {
  return serverPort;
}
async function writeMCPConfigToWorkspace(workspacePath) {
  if (!serverPort) return;
  const mcpJsonPath = path$1.join(workspacePath, ".mcp.json");
  const contexUrl = `http://127.0.0.1:${serverPort}/mcp`;
  let existing = {};
  try {
    const raw = await fs.promises.readFile(mcpJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") existing = parsed;
  } catch {
  }
  const existingServers = typeof existing.mcpServers === "object" && existing.mcpServers !== null ? existing.mcpServers : {};
  existingServers["contex"] = {
    type: "http",
    url: contexUrl
  };
  const config = {
    ...existing,
    mcpServers: existingServers
  };
  await fs.promises.writeFile(mcpJsonPath, JSON.stringify(config, null, 2));
  console.log(`[MCP] Wrote .mcp.json to ${workspacePath}`);
  await writeContexClaudeMd(workspacePath);
}
async function writeContexClaudeMd(workspacePath) {
  const claudeDir = path$1.join(workspacePath, ".claude");
  const claudeMdPath = path$1.join(claudeDir, "CLAUDE.md");
  try {
    const existing = await fs.promises.readFile(claudeMdPath, "utf8");
    if (existing.includes("<!-- contex-managed -->")) return;
  } catch {
  }
  await fs.promises.mkdir(claudeDir, { recursive: true });
  const content = `<!-- contex-managed -->
# CodeSurf Canvas Agent

You are running inside CodeSurf, an infinite canvas workspace where multiple AI agents collaborate.
Your block ID is available as the environment variable \`CARD_ID\`.

## MANDATORY: First Action on Every Session

Before doing ANYTHING else, you MUST run these two commands:

\`\`\`
1. mcp__contex__peer_set_state(tile_id=$CARD_ID, tile_type="terminal", status="idle", task="Ready")
2. mcp__contex__peer_get_state(tile_id=$CARD_ID)
\`\`\`

This registers you with the collaboration system and shows you who else is working.

## Peer Collaboration Protocol

**When you receive a task:**
1. Call \`peer_set_state\` with status "working" and describe your task
2. Call \`peer_get_state\` to check what linked peers are doing
3. If a peer lists the same files in their state, call \`peer_send_message\` to coordinate BEFORE editing

**During work:**
- Call \`peer_set_state\` whenever you switch files or tasks
- Call \`peer_read_messages\` to check for incoming messages from peers
- Use \`peer_add_todo\` for work you need a peer to handle
- When you see a \`[contex]\` notification, call \`peer_read_messages\` immediately

**On completion:**
- Call \`peer_set_state\` with status "done" and a summary
- Call \`peer_complete_todo\` for any todos you finished

**File conflict rule:**
NEVER edit a file that a linked peer lists in their \`files\` array. Send them a \`peer_send_message\` first and wait for coordination.

## Available Tool Prefixes

All contex tools use the prefix \`mcp__contex__\`. Examples:
- \`mcp__contex__peer_set_state\` — declare your state
- \`mcp__contex__peer_get_state\` — read peer states
- \`mcp__contex__peer_send_message\` — message a peer
- \`mcp__contex__peer_read_messages\` — read your messages
- \`mcp__contex__peer_add_todo\` / \`peer_complete_todo\` — shared todos
- \`mcp__contex__canvas_create_tile\` — create blocks on the canvas
- \`mcp__contex__terminal_send_input\` — type into a peer terminal block
- \`mcp__contex__chat_send_message\` — message a peer chat block
`;
  await fs.promises.writeFile(claudeMdPath, content);
  console.log(`[MCP] Wrote .claude/CLAUDE.md to ${workspacePath}`);
}
const TRANSPARENT_WINDOW_BACKGROUND = "#00000000";
function getWindowAppearanceOptions() {
  const isMac = process.platform === "darwin";
  const isWin2 = process.platform === "win32";
  return {
    // Transparent windows on Windows cause rendering issues (crash on focus change,
    // invisible window when packaged). Use opaque background on Windows instead.
    transparent: !isWin2,
    backgroundColor: isWin2 ? "#1e1e1e" : TRANSPARENT_WINDOW_BACKGROUND,
    vibrancy: isMac ? "sidebar" : void 0,
    visualEffectState: isMac ? "active" : void 0
  };
}
function applyWindowAppearance(win) {
  if (process.platform === "win32") {
    win.setBackgroundColor("#1e1e1e");
  } else {
    win.setBackgroundColor(TRANSPARENT_WINDOW_BACKGROUND);
  }
  if (process.platform === "darwin") {
    win.setVibrancy("sidebar");
  }
}
function hashString(input) {
  let h1 = 3735928559 ^ input.length;
  let h2 = 1103547991 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}
function normalizeThinkingSignature(message) {
  const blocks = Array.isArray(message.thinkingBlocks) && message.thinkingBlocks.length > 0 ? message.thinkingBlocks : message.thinking ? [message.thinking] : [];
  return blocks.map((block) => String(block?.content ?? "").trim()).filter(Boolean).join("");
}
function normalizeToolSignature(message) {
  return (message.toolBlocks ?? []).map((block) => [
    String(block?.name ?? ""),
    String(block?.input ?? ""),
    String(block?.summary ?? ""),
    (block?.fileChanges ?? []).map((change) => `${change.changeType}:${change.path}:${change.previousPath ?? ""}`).join(""),
    (block?.commandEntries ?? []).map((entry) => `${entry.kind ?? ""}:${entry.label}:${entry.command ?? ""}`).join("")
  ].join("")).join("");
}
function buildChatMessageHistoryFingerprint(message) {
  const canonical = [
    String(message.role ?? ""),
    String(Number.isFinite(message.timestamp) ? message.timestamp : ""),
    String(message.content ?? ""),
    normalizeThinkingSignature(message),
    normalizeToolSignature(message)
  ].join("\0");
  return hashString(canonical);
}
const STANDARD_CODESURF_SUBDIRS = ["sessions", "agents", "skills", "tools", "plugins", "extensions"];
const EXTERNAL_SESSION_CACHE_MS = 6e4;
const EXTERNAL_SESSION_STATE_CACHE_MAX_ENTRIES = 64;
const EXTERNAL_SESSION_FULL_STATE_CACHE_MAX_ENTRIES = 8;
const LARGE_EXTERNAL_SESSION_BYTES = 6 * 1024 * 1024;
const EXTERNAL_SESSION_HEAD_SAMPLE_BYTES = 128 * 1024;
const EXTERNAL_SESSION_TAIL_SAMPLE_BYTES = 4 * 1024 * 1024;
const MAX_SESSION_LISTING_JSON_BYTES = 2 * 1024 * 1024;
const MAX_SESSION_LISTING_TEXT_SAMPLE_BYTES = 16 * 1024;
const CLAUDE_SESSION_LISTING_HEAD_BYTES = 24 * 1024;
const CLAUDE_SESSION_LISTING_TAIL_BYTES = 96 * 1024;
const CLAUDE_SESSION_EXACT_SCAN_MAX_BYTES = 256 * 1024;
const CODEX_SESSION_LISTING_HEAD_BYTES = 24 * 1024;
const CODEX_SESSION_LISTING_TAIL_BYTES = 96 * 1024;
const CODEX_SESSION_EXACT_SCAN_MAX_BYTES = 256 * 1024;
const externalSessionCache = /* @__PURE__ */ new Map();
const externalSessionStateCache = /* @__PURE__ */ new Map();
const externalSessionFullStateCache = /* @__PURE__ */ new Map();
const GENERIC_OPENCLAW_LABELS = /* @__PURE__ */ new Set(["openclaw studio", "openclawstudio", "openclaw-tui", "vibeclaw", "heartbeat"]);
function isExternalSessionImportableInChat(messageCount, lastMessage) {
  if (Number.isFinite(messageCount) && Number(messageCount) > 0) return true;
  return typeof lastMessage === "string" && lastMessage.trim().length > 0;
}
function getProjectCodeSurfDir(workspacePath) {
  return path$1.join(workspacePath, ".codesurf");
}
async function ensureDir$5(path2) {
  await fs.promises.mkdir(path2, { recursive: true });
}
async function ensureCodeSurfStructure(workspacePath) {
  await ensureDir$5(CONTEX_HOME);
  await Promise.all(STANDARD_CODESURF_SUBDIRS.map((dir) => ensureDir$5(path$1.join(CONTEX_HOME, dir))));
  if (!workspacePath) return;
  const projectDir = getProjectCodeSurfDir(workspacePath);
  await ensureDir$5(projectDir);
  await Promise.all(STANDARD_CODESURF_SUBDIRS.map((dir) => ensureDir$5(path$1.join(projectDir, dir))));
}
async function fileExists$1(path2) {
  try {
    await fs.promises.access(path2);
    return true;
  } catch {
    return false;
  }
}
async function readJsonSafe$1(path2, options) {
  try {
    if (options?.maxBytes != null) {
      const stat = await fs.promises.stat(path2);
      if (!stat.isFile() || stat.size > options.maxBytes) return null;
    }
    const raw = await fs.promises.readFile(path2, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function readTextSafe(path2) {
  try {
    return await fs.promises.readFile(path2, "utf8");
  } catch {
    return null;
  }
}
async function readTextPreviewSafe(path2, maxBytes = MAX_SESSION_LISTING_TEXT_SAMPLE_BYTES) {
  try {
    const handle = await fs.promises.open(path2, "r");
    try {
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.toString("utf8", 0, bytesRead);
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}
async function readTextTailSafe(path2, maxBytes) {
  try {
    const stat = await fs.promises.stat(path2);
    if (!stat.isFile()) return null;
    const start = Math.max(0, stat.size - maxBytes);
    const length = stat.size - start;
    const handle = await fs.promises.open(path2, "r");
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      let text = buffer.toString("utf8", 0, bytesRead);
      if (start > 0) {
        const firstNewline = text.indexOf("\n");
        text = firstNewline === -1 ? "" : text.slice(firstNewline + 1);
      }
      return text;
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}
async function statSafe(path2) {
  try {
    return await fs.promises.stat(path2);
  } catch {
    return null;
  }
}
function touchCachedExternalSessionState(cache, maxEntries, key, value) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
  return value.state;
}
async function getCachedExternalSessionChatState(cache, maxEntries, cacheKey, filePath, load) {
  const stat = await statSafe(filePath);
  if (!stat?.isFile()) {
    cache.delete(cacheKey);
    return null;
  }
  const cached2 = cache.get(cacheKey);
  if (cached2 && cached2.mtimeMs === stat.mtimeMs && cached2.size === stat.size) {
    return touchCachedExternalSessionState(cache, maxEntries, cacheKey, cached2);
  }
  const state = await load();
  return touchCachedExternalSessionState(cache, maxEntries, cacheKey, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    state
  });
}
async function getFreshCachedExternalSessionChatState(cache, maxEntries, cacheKey, filePath) {
  const stat = await statSafe(filePath);
  if (!stat?.isFile()) {
    cache.delete(cacheKey);
    return null;
  }
  const cached2 = cache.get(cacheKey);
  if (!cached2 || cached2.mtimeMs !== stat.mtimeMs || cached2.size !== stat.size) return null;
  return touchCachedExternalSessionState(cache, maxEntries, cacheKey, cached2);
}
async function scanJsonlFile(filePath, onLine) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      if (!line) continue;
      lineNumber += 1;
      await onLine(line, lineNumber);
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}
function truncate(text, length = 120) {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > length ? normalized.slice(0, length) : normalized;
}
function epochMsFromUnknown(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric < 1e10 ? Math.round(numeric * 1e3) : Math.round(numeric);
}
function isSessionTitleBoilerplateLine$1(line) {
  const normalized = line.trim();
  if (!normalized) return true;
  return /^(?:#\s*)?AGENTS\.md instructions for\b/i.test(normalized) || /^(?:#\s*)?CLAUDE\.md instructions for\b/i.test(normalized) || /^<\/?environment_context>$/i.test(normalized) || /^<INSTRUCTIONS>$/i.test(normalized) || /^<\/INSTRUCTIONS>$/i.test(normalized) || /^---\s*project-doc\s*---$/i.test(normalized) || /^#+\s*(?:Non-Negotiable Rules|GSDN Native Mode|Installed GSDN assets|Usage rules|Skills|Files mentioned by the user)\b/i.test(normalized) || /^Launching skill:/i.test(normalized) || /^Base directory for this skill:/i.test(normalized) || /^The `?\.codesurf\/DREAMING\.md`? has been written/i.test(normalized);
}
function firstMeaningfulSessionTitleLine(text) {
  const source = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!source) return null;
  const explicitRequest = source.match(/#+\s*My request for Codex:\s*([\s\S]+)/i);
  if (explicitRequest?.[1]?.trim()) return firstMeaningfulSessionTitleLine(explicitRequest[1]);
  const userRequest = source.match(/^#+\s*User Request\s*\n([\s\S]+)/im);
  if (userRequest?.[1]?.trim()) return firstMeaningfulSessionTitleLine(userRequest[1]);
  let insideInstructions = false;
  let insideEnvironmentContext = false;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^<environment_context>$/i.test(line)) {
      insideEnvironmentContext = true;
      continue;
    }
    if (/^<\/environment_context>$/i.test(line)) {
      insideEnvironmentContext = false;
      continue;
    }
    if (insideEnvironmentContext) continue;
    if (/<INSTRUCTIONS>/i.test(line)) {
      insideInstructions = true;
      continue;
    }
    if (/<\/INSTRUCTIONS>/i.test(line)) {
      insideInstructions = false;
      continue;
    }
    if (insideInstructions) continue;
    const workspacePrompt = line.match(/^Workspace:\s+.+?\bPrimary path:\s+\S+\s+(.+)$/i);
    if (workspacePrompt?.[1]?.trim()) return workspacePrompt[1].trim();
    if (isSessionTitleBoilerplateLine$1(line)) continue;
    return line;
  }
  return null;
}
function sessionTitleFromText(fallback, text) {
  const trimmed = firstMeaningfulSessionTitleLine(text) ?? text?.trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\r?\n/, 1)[0].slice(0, 80);
}
function normalizeSessionPath$1(path2) {
  return String(path2 ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
}
function pathBelongsToWorkspace(workspacePath, sessionProjectPath) {
  const workspace = normalizeSessionPath$1(workspacePath);
  const project = normalizeSessionPath$1(sessionProjectPath);
  if (!workspace || !project) return false;
  return project === workspace || project.startsWith(`${workspace}/`);
}
function pathScope(workspacePath, sessionProjectPath, fallback = "user") {
  if (pathBelongsToWorkspace(workspacePath, sessionProjectPath)) return "project";
  return fallback;
}
function extractProjectPathFromSessionText(text) {
  const source = String(text ?? "");
  if (!source.trim()) return null;
  const backtickWorkspace = source.match(/\bWorkspace:\s*`([^`]+)`/i);
  if (backtickWorkspace?.[1]?.startsWith("/")) return normalizeSessionPath$1(backtickWorkspace[1]);
  const primaryPath = source.match(/\bPrimary path:\s*`?([^\s`]+)`?/i);
  if (primaryPath?.[1]?.startsWith("/")) return normalizeSessionPath$1(primaryPath[1]);
  const cwd = source.match(/\b(?:cwd|projectPath|project_path|workspacePath|workspace_path)["':\s]+`?((?:\/[^`"'\s]+)+)`?/i);
  if (cwd?.[1]?.startsWith("/")) return normalizeSessionPath$1(cwd[1]);
  return null;
}
function compareSessions(a, b) {
  return b.updatedAt - a.updatedAt;
}
function humanizeSlug(value) {
  return value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (char) => char.toUpperCase());
}
function isGenericOpenClawLabel(value) {
  if (!value) return true;
  return GENERIC_OPENCLAW_LABELS.has(value.trim().toLowerCase());
}
function roleFromUnknown(value) {
  return value === "user" || value === "assistant" || value === "system" ? value : null;
}
function makeImportedMessage(id, role, content, timestamp) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return { id, role, content: trimmed, timestamp };
}
function makeImportedRichMessage(params) {
  const trimmedContent = params.content.trim();
  const toolBlocks = params.toolBlocks?.filter((block) => {
    return Boolean(block.name.trim()) && (Boolean(block.input.trim()) || Boolean(block.summary?.trim()) || (block.fileChanges?.length ?? 0) > 0 || (block.commandEntries?.length ?? 0) > 0);
  }) ?? [];
  const thinking = params.thinking && params.thinking.content.trim() ? { ...params.thinking, content: params.thinking.content.trim() } : void 0;
  if (!trimmedContent && !thinking && toolBlocks.length === 0) return null;
  const contentBlocks = [];
  for (const block of toolBlocks) contentBlocks.push({ type: "tool", toolId: block.id });
  if (trimmedContent) contentBlocks.push({ type: "text", text: trimmedContent });
  return {
    id: params.id,
    role: params.role,
    content: trimmedContent,
    timestamp: params.timestamp,
    thinking,
    toolBlocks: toolBlocks.length > 0 ? toolBlocks : void 0,
    contentBlocks: contentBlocks.length > 0 ? contentBlocks : void 0
  };
}
function stripCodexSystemMarkers(text) {
  if (!text) return text;
  return text.replace(/<turn_aborted>[\s\S]*?<\/turn_aborted>/g, "").trim();
}
function extractTextParts(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (typeof part?.text === "string") return part.text;
      if (typeof part?.content === "string") return part.content;
      if (typeof part?.value === "string") return part.value;
      if (typeof part?.input_text === "string") return part.input_text;
      if (typeof part?.output_text === "string") return part.output_text;
      return "";
    }).filter(Boolean).join("\n\n");
  }
  if (content && typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    if (typeof content.content === "string") return content.content;
    if (typeof content.value === "string") return content.value;
  }
  return "";
}
function makeTranscriptTruncationMessage(provider, fileSizeBytes) {
  const sizeMb = Math.max(1, Math.round(fileSizeBytes / (1024 * 1024)));
  const label = provider === "codex" ? "Codex" : provider === "claude" ? "Claude" : "CLI";
  return {
    id: `${provider}-truncated-notice`,
    role: "system",
    content: `${label} transcript trimmed for faster loading. Showing the start of the conversation and recent activity from a ${sizeMb} MB session.`,
    timestamp: Date.now()
  };
}
function dedupeImportedMessages(messages) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const message of messages) {
    const thinkingKey = message.thinking ? `${message.thinking.done ? "1" : "0"}::${message.thinking.content}` : "";
    const toolKey = (message.toolBlocks ?? []).map((block) => `${block.id}::${block.name}::${block.status}::${block.input}::${block.summary ?? ""}`).join("");
    const key = `${message.role}::${message.timestamp}::${message.content}::${thinkingKey}::${toolKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(message);
  }
  return out;
}
function parseJsonlLines(raw) {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function getClaudeProjectPathCandidate(evt) {
  if (!evt) return null;
  const candidate = typeof evt.cwd === "string" ? evt.cwd : typeof evt.workingDirectory === "string" ? evt.workingDirectory : typeof evt.projectPath === "string" ? evt.projectPath : typeof evt.project?.path === "string" ? evt.project.path : typeof evt.meta?.cwd === "string" ? evt.meta.cwd : typeof evt.session?.cwd === "string" ? evt.session.cwd : null;
  return candidate && candidate.startsWith("/") ? candidate : null;
}
function getClaudeRole(evt) {
  if (!evt) return null;
  return roleFromUnknown(evt.message?.role) ?? roleFromUnknown(evt.type) ?? roleFromUnknown(evt.role);
}
function extractClaudeContentText(content, options) {
  if (!Array.isArray(content)) return extractTextParts(content);
  return content.map((part) => {
    if (typeof part === "string") return part;
    const type = typeof part?.type === "string" ? part.type : "";
    if (type === "text") return typeof part.text === "string" ? part.text : "";
    if (type === "thinking") {
      if (!options?.includeThinking) return "";
      return typeof part.thinking === "string" ? part.thinking : typeof part.text === "string" ? part.text : "";
    }
    if (type === "tool_result") {
      return options?.includeToolResults ? extractTextParts(part.content) : "";
    }
    if (type === "input_text") return typeof part.text === "string" ? part.text : typeof part.input_text === "string" ? part.input_text : "";
    if (type === "output_text") return typeof part.text === "string" ? part.text : typeof part.output_text === "string" ? part.output_text : "";
    if (type === "tool_use") return "";
    return extractTextParts(part);
  }).filter(Boolean).join("\n\n").trim();
}
function getClaudeEventText(evt, options) {
  if (!evt) return "";
  return extractClaudeContentText(evt.message?.content ?? evt.content, options).trim();
}
function isClaudeToolResultOnly(evt) {
  const content = evt?.message?.content;
  return Array.isArray(content) && content.length > 0 && content.every((part) => part?.type === "tool_result");
}
function shouldImportClaudeEvent(evt) {
  const role = getClaudeRole(evt);
  if (!role || role === "system") return false;
  if (role === "user" && isClaudeToolResultOnly(evt)) return false;
  return true;
}
function getClaudeModel(evt) {
  if (!evt) return "";
  const candidate = typeof evt.message?.model === "string" ? evt.message.model : typeof evt.advisorModel === "string" ? evt.advisorModel : typeof evt.model === "string" ? evt.model : "";
  return candidate.trim();
}
function encodeClaudeProjectDirName(workspacePath) {
  return workspacePath.replace(/\\/g, "/").replace(/\//g, "-");
}
function scanClaudeListingLines(lines, meta, options) {
  for (const line of lines) {
    const evt = parseJsonObject(line);
    if (!evt) continue;
    if (!meta.projectPath) meta.projectPath = getClaudeProjectPathCandidate(evt);
    if (!meta.sessionId && typeof evt.sessionId === "string" && evt.sessionId.trim()) meta.sessionId = evt.sessionId.trim();
    if (!meta.model) meta.model = getClaudeModel(evt);
    if (!meta.gitBranch && typeof evt.gitBranch === "string" && evt.gitBranch.trim()) meta.gitBranch = evt.gitBranch.trim();
    if (!meta.lastPrompt && evt.type === "last-prompt" && typeof evt.lastPrompt === "string" && evt.lastPrompt.trim()) {
      meta.lastPrompt = truncate(evt.lastPrompt, 400);
    }
    if (!shouldImportClaudeEvent(evt)) continue;
    const role = getClaudeRole(evt);
    const rawText = getClaudeEventText(evt);
    const titleText = firstMeaningfulSessionTitleLine(rawText) ?? rawText;
    const text = truncate(titleText, 400);
    if (!text) continue;
    if (options?.countMessages) meta.messageCount += 1;
    if (role === "user" && !meta.firstUserPrompt) meta.firstUserPrompt = text;
    if (role === "assistant") meta.lastAssistantText = text;
  }
}
async function readClaudeListingMeta(filePath, stat, fallbackProjectPath) {
  const baseMeta = {
    sessionId: path$1.basename(filePath, ".jsonl"),
    projectPath: fallbackProjectPath ?? null,
    model: "",
    gitBranch: null,
    firstUserPrompt: null,
    lastPrompt: null,
    lastAssistantText: null,
    messageCount: 0
  };
  if (stat.size <= CLAUDE_SESSION_EXACT_SCAN_MAX_BYTES) {
    const raw = await readTextSafe(filePath);
    scanClaudeListingLines(parseJsonlLines(raw ?? ""), baseMeta, { countMessages: true });
  } else {
    const [headRaw, tailRaw] = await Promise.all([
      readTextPreviewSafe(filePath, CLAUDE_SESSION_LISTING_HEAD_BYTES),
      readTextTailSafe(filePath, CLAUDE_SESSION_LISTING_TAIL_BYTES)
    ]);
    scanClaudeListingLines(parseJsonlLines(headRaw ?? ""), baseMeta);
    scanClaudeListingLines(parseJsonlLines(tailRaw ?? ""), baseMeta);
  }
  const title = sessionTitleFromText("Claude session", baseMeta.lastPrompt ?? baseMeta.firstUserPrompt ?? baseMeta.lastAssistantText);
  return {
    sessionId: baseMeta.sessionId,
    title,
    lastMessage: baseMeta.lastAssistantText ?? baseMeta.lastPrompt ?? baseMeta.firstUserPrompt,
    messageCount: baseMeta.messageCount,
    projectPath: baseMeta.projectPath,
    model: baseMeta.model,
    gitBranch: baseMeta.gitBranch
  };
}
function parseClaudeLine(line, index) {
  try {
    const evt = JSON.parse(line);
    if (!shouldImportClaudeEvent(evt)) return null;
    const role = getClaudeRole(evt);
    if (!role) return null;
    const text = getClaudeEventText(evt);
    if (!text) return null;
    return makeImportedMessage(
      `claude-${index}`,
      role,
      text,
      Date.parse(evt?.timestamp ?? "") || Date.now() + index
    );
  } catch {
    return null;
  }
}
function parseClaudeMessagesFromLines(lines, offset = 0) {
  return lines.map((line, index) => parseClaudeLine(line, offset + index)).filter(Boolean);
}
function truncateToolPreview(text, length = 800) {
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length)}
…` : text;
}
function sanitizeToolOutputText$1(text) {
  if (!text) return "";
  return text.replace(/\r\n/g, "\n").split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(/^Chunk ID:/i.test(trimmed) || /^Wall time:/i.test(trimmed) || /^Process exited with code /i.test(trimmed) || /^Process running with session ID /i.test(trimmed) || /^Original token count:/i.test(trimmed) || /^Output:$/i.test(trimmed) || /^\[CodeSurf memory guard\] Older tool (output|summary) /i.test(trimmed));
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function extractReasoningSummary(payload) {
  if (!Array.isArray(payload?.summary)) return "";
  return payload.summary.map((entry) => typeof entry?.text === "string" ? entry.text.trim() : "").filter(Boolean).join("\n\n");
}
function parseJsonObject(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function extractCommandFromToolCall(name, rawInput) {
  const parsed = parseJsonObject(rawInput);
  if (name === "exec_command") return typeof parsed?.cmd === "string" ? parsed.cmd : rawInput;
  if (name === "shell_command") return typeof parsed?.command === "string" ? parsed.command : rawInput;
  if (name === "shell") {
    if (Array.isArray(parsed?.command)) return parsed.command.map((part) => String(part)).join(" ");
    if (typeof parsed?.command === "string") return parsed.command;
  }
  return rawInput;
}
function extractApplyPatchText(rawInput) {
  const beginIndex = rawInput.indexOf("*** Begin Patch");
  const endIndex = rawInput.lastIndexOf("*** End Patch");
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) return null;
  return rawInput.slice(beginIndex, endIndex + "*** End Patch".length);
}
function parseApplyPatchFileChanges(patchText) {
  const lines = patchText.replace(/\r\n/g, "\n").split("\n");
  const changes = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    current.diff = current.lines.join("\n").trim();
    current.additions = current.lines.filter((line) => line.startsWith("+")).length;
    current.deletions = current.lines.filter((line) => line.startsWith("-")).length;
    changes.push({
      path: current.path,
      previousPath: current.previousPath,
      changeType: current.changeType,
      additions: current.additions,
      deletions: current.deletions,
      diff: current.diff
    });
    current = null;
  };
  for (const line of lines) {
    if (line.startsWith("*** Add File: ")) {
      flush();
      current = {
        path: line.slice("*** Add File: ".length).trim(),
        changeType: "add",
        additions: 0,
        deletions: 0,
        diff: "",
        lines: [line]
      };
      continue;
    }
    if (line.startsWith("*** Update File: ")) {
      flush();
      current = {
        path: line.slice("*** Update File: ".length).trim(),
        changeType: "update",
        additions: 0,
        deletions: 0,
        diff: "",
        lines: [line]
      };
      continue;
    }
    if (line.startsWith("*** Delete File: ")) {
      flush();
      current = {
        path: line.slice("*** Delete File: ".length).trim(),
        changeType: "delete",
        additions: 0,
        deletions: 0,
        diff: "",
        lines: [line]
      };
      continue;
    }
    if (line.startsWith("*** Move to: ")) {
      if (current) {
        current.previousPath = current.path;
        current.path = line.slice("*** Move to: ".length).trim();
        current.changeType = "move";
        current.lines.push(line);
      }
      continue;
    }
    if (line === "*** End Patch") {
      if (current) current.lines.push(line);
      flush();
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return changes;
}
function classifyCommand(command) {
  const normalized = command.trim();
  if (/(^|\s)(rg|grep|fd|findstr)\b/.test(normalized)) return "search";
  if (/(^|\s)(cat|sed|head|tail|less|more|bat)\b/.test(normalized)) return "read";
  if (/(^|\s)ls\b/.test(normalized)) return "read";
  return "command";
}
function isImportedPlanToolName(name) {
  return name === "TodoWrite" || name === "update_plan";
}
function buildImportedToolBlocks(calls) {
  const blocks = [];
  const handledIds = /* @__PURE__ */ new Set();
  const fileChangeMap = /* @__PURE__ */ new Map();
  for (const change of calls.flatMap((call) => call.fileChanges ?? [])) {
    const key = `${change.path}::${change.previousPath ?? ""}::${change.changeType}`;
    const existing = fileChangeMap.get(key);
    if (!existing) {
      fileChangeMap.set(key, { ...change });
      continue;
    }
    existing.additions += change.additions;
    existing.deletions += change.deletions;
    existing.diff = `${existing.diff}

${change.diff}`.trim();
  }
  const fileChanges = Array.from(fileChangeMap.values());
  if (fileChanges.length > 0) {
    blocks.push({
      id: "tool-edits",
      name: `Edited ${fileChanges.length} file${fileChanges.length === 1 ? "" : "s"}`,
      input: calls.filter((call) => (call.fileChanges?.length ?? 0) > 0).map((call) => call.input).join("\n\n"),
      status: "done",
      fileChanges
    });
    for (const call of calls) {
      if ((call.fileChanges?.length ?? 0) > 0) handledIds.add(call.id);
    }
  }
  const exploreEntries = calls.filter((call) => call.commandEntry && (call.commandEntry.kind === "search" || call.commandEntry.kind === "read")).map((call) => call.commandEntry);
  if (exploreEntries.length > 0) {
    const readCount = exploreEntries.filter((entry) => entry.kind === "read").length;
    const searchCount = exploreEntries.filter((entry) => entry.kind === "search").length;
    const labelParts = [];
    if (readCount > 0) labelParts.push(`${readCount} file${readCount === 1 ? "" : "s"}`);
    if (searchCount > 0) labelParts.push(`${searchCount} search${searchCount === 1 ? "" : "es"}`);
    blocks.push({
      id: "tool-explore",
      name: `Explored ${labelParts.join(", ")}`,
      input: exploreEntries.map((entry) => entry.command ?? entry.label).join("\n"),
      status: "done",
      commandEntries: exploreEntries
    });
    for (const call of calls) {
      if (call.commandEntry && (call.commandEntry.kind === "search" || call.commandEntry.kind === "read")) handledIds.add(call.id);
    }
  }
  for (const call of calls) {
    if (handledIds.has(call.id)) continue;
    blocks.push({
      id: call.id,
      name: call.name,
      input: call.input,
      summary: truncateToolPreview(sanitizeToolOutputText$1(call.output), 240) || void 0,
      status: call.status,
      commandEntries: call.commandEntry ? [call.commandEntry] : void 0
    });
  }
  return blocks;
}
function parseCodexToolCall(payload) {
  const callId = typeof payload?.call_id === "string" ? payload.call_id : null;
  const toolName = typeof payload?.name === "string" ? payload.name : null;
  if (!callId || !toolName) return null;
  const rawInput = typeof payload?.arguments === "string" ? payload.arguments : typeof payload?.input === "string" ? payload.input : "";
  const command = extractCommandFromToolCall(toolName, rawInput);
  const patchText = toolName === "apply_patch" ? extractApplyPatchText(rawInput) ?? rawInput : toolName === "shell" ? extractApplyPatchText(command) : null;
  const fileChanges = patchText ? parseApplyPatchFileChanges(patchText) : void 0;
  const normalizedName = fileChanges && fileChanges.length > 0 ? "apply_patch" : toolName;
  const commandEntry = !fileChanges && command.trim() ? {
    label: command.trim(),
    command: command.trim(),
    kind: classifyCommand(command.trim())
  } : void 0;
  return {
    id: callId,
    name: normalizedName,
    input: fileChanges && fileChanges.length > 0 ? patchText ?? rawInput : rawInput,
    status: payload?.status === "errored" ? "error" : "done",
    fileChanges,
    commandEntry
  };
}
async function listFilesRecursive(root, predicate, maxDepth = 4) {
  const out = [];
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path$1.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "deleted") continue;
        await walk(fullPath, depth + 1);
      } else if (predicate(fullPath)) {
        out.push(fullPath);
      }
    }
  }
  await walk(root, 0);
  return out;
}
function parseOpenClawKey(sessionKey) {
  const parts = sessionKey.split(":");
  const agentId = parts[1] || "main";
  const route = parts[2] || "main";
  return {
    agentId,
    route,
    groupId: `openclaw:${agentId}`,
    isSubagent: route === "subagent"
  };
}
function formatOpenClawTitle(agentId, sessionKey, meta) {
  const parsed = parseOpenClawKey(sessionKey);
  const agentLabel = humanizeSlug(agentId);
  const preferred = typeof meta?.label === "string" && meta.label.trim() ? meta.label.trim() : typeof meta?.origin?.label === "string" && meta.origin.label.trim() ? meta.origin.label.trim() : "";
  let title = preferred;
  if (isGenericOpenClawLabel(title)) {
    if (parsed.isSubagent) title = `Subagent ${meta?.sessionId ? String(meta.sessionId).slice(0, 8) : ""}`.trim();
    else if (parsed.route === "cron") title = "Scheduled task";
    else if (parsed.route === "webchat") title = "Web chat";
    else if (parsed.route === "main") title = `${agentLabel} chat`;
    else title = humanizeSlug(parsed.route);
  }
  const detailParts = ["OpenClaw", agentLabel];
  if (parsed.route !== "main" && parsed.route !== "subagent") detailParts.push(humanizeSlug(parsed.route));
  if (parsed.isSubagent) detailParts.push("Subagent");
  return {
    title,
    detail: detailParts.join(" · "),
    relatedGroupId: parsed.groupId,
    nestingLevel: parsed.isSubagent ? 1 : 0
  };
}
async function listCodeSurfSessionFiles(workspacePath) {
  const roots = [];
  if (workspacePath) roots.push({ dir: path$1.join(getProjectCodeSurfDir(workspacePath), "sessions"), scope: "project" });
  roots.push({ dir: path$1.join(CONTEX_HOME, "sessions"), scope: "user" });
  const entries = [];
  for (const root of roots) {
    if (!await fileExists$1(root.dir)) continue;
    const files = await listFilesRecursive(root.dir, (path2) => [".json", ".jsonl", ".md", ".txt"].includes(path$1.extname(path2).toLowerCase()), 3);
    for (const filePath of files) {
      const stat = await statSafe(filePath);
      if (!stat?.isFile()) continue;
      let title = path$1.basename(filePath);
      let lastMessage = null;
      let messageCount = 0;
      let sessionId = path$1.basename(filePath, path$1.extname(filePath));
      let provider = "codesurf";
      let model = "";
      const ext = path$1.extname(filePath).toLowerCase();
      if (ext === ".json") {
        const parsed = await readJsonSafe$1(filePath, { maxBytes: MAX_SESSION_LISTING_JSON_BYTES });
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.messages)) {
            messageCount = parsed.messages.length;
            const last = parsed.messages[parsed.messages.length - 1];
            lastMessage = truncate(typeof last?.content === "string" ? last.content : extractTextParts(last?.content));
            title = sessionTitleFromText(title, lastMessage);
          } else if (Array.isArray(parsed.entries)) {
            messageCount = parsed.entries.length;
          }
          if (typeof parsed.sessionId === "string") sessionId = parsed.sessionId;
          if (typeof parsed.provider === "string") provider = parsed.provider;
          if (typeof parsed.model === "string") model = parsed.model;
          if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title.trim();
        }
      } else if (ext === ".md" || ext === ".txt") {
        const raw = await readTextPreviewSafe(filePath);
        lastMessage = truncate(raw);
        title = sessionTitleFromText(title, raw);
      }
      entries.push({
        id: `codesurf-file:${filePath}`,
        source: "codesurf",
        scope: root.scope,
        tileId: null,
        sessionId,
        provider,
        model,
        messageCount,
        lastMessage,
        updatedAt: stat.mtimeMs,
        filePath,
        title,
        projectPath: root.scope === "project" ? workspacePath : null,
        sourceLabel: "CodeSurf",
        sourceDetail: root.scope === "project" ? "Project session" : "User session",
        canOpenInChat: true,
        canOpenInApp: false
      });
    }
  }
  return entries;
}
async function listClaudeSessions(workspacePath) {
  const projectRoot = path$1.join(os.homedir(), ".claude", "projects");
  const transcriptRoot = path$1.join(os.homedir(), ".claude", "transcripts");
  const candidateFiles = /* @__PURE__ */ new Map();
  if (workspacePath) {
    const exactProjectDir = path$1.join(projectRoot, encodeClaudeProjectDirName(workspacePath));
    if (await fileExists$1(exactProjectDir)) {
      try {
        const names = await fs.promises.readdir(exactProjectDir);
        for (const name of names) {
          if (!name.endsWith(".jsonl")) continue;
          candidateFiles.set(path$1.join(exactProjectDir, name), workspacePath);
        }
      } catch {
      }
    }
  }
  if (candidateFiles.size === 0 && await fileExists$1(projectRoot)) {
    const files = await listFilesRecursive(projectRoot, (path2) => path$1.extname(path2).toLowerCase() === ".jsonl", 2);
    for (const filePath of files) candidateFiles.set(filePath, null);
  }
  if (await fileExists$1(transcriptRoot)) {
    try {
      const names = await fs.promises.readdir(transcriptRoot);
      for (const name of names) {
        if (!name.endsWith(".jsonl")) continue;
        const filePath = path$1.join(transcriptRoot, name);
        if (!candidateFiles.has(filePath)) candidateFiles.set(filePath, null);
      }
    } catch {
    }
  }
  const withStat = await Promise.all(
    [...candidateFiles.entries()].map(async ([filePath, projectPathHint]) => ({
      filePath,
      projectPathHint,
      stat: await statSafe(filePath)
    }))
  );
  const recent = withStat.filter((item) => item.stat?.isFile()).sort((a, b) => (b.stat?.mtimeMs ?? 0) - (a.stat?.mtimeMs ?? 0)).slice(0, 500);
  const entries = await Promise.all(recent.map(async ({ filePath, projectPathHint, stat }) => {
    const listing = await readClaudeListingMeta(filePath, stat, projectPathHint);
    return {
      id: `claude:${filePath}`,
      source: "claude",
      scope: pathScope(workspacePath, listing.projectPath, "user"),
      tileId: null,
      sessionId: listing.sessionId,
      provider: "claude",
      model: listing.model,
      messageCount: listing.messageCount,
      lastMessage: listing.lastMessage,
      updatedAt: stat?.mtimeMs ?? 0,
      sizeBytes: stat?.size ?? 0,
      filePath,
      title: listing.title,
      projectPath: listing.projectPath,
      sourceLabel: "Claude",
      sourceDetail: listing.gitBranch ?? void 0,
      canOpenInChat: isExternalSessionImportableInChat(listing.messageCount, listing.lastMessage),
      canOpenInApp: true,
      resumeBin: "claude",
      resumeArgs: listing.sessionId ? ["--resume", listing.sessionId] : ["--resume"]
    };
  }));
  return entries;
}
function parseCodexCreatedTimestamp(filePath) {
  const base = path$1.basename(filePath);
  const match = base.match(/rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  const [, y, m, d, hh, mm, ss] = match;
  return Date.parse(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`) || 0;
}
function scanCodexListingLines(lines, meta, options) {
  for (const line of lines) {
    const evt = parseJsonObject(line);
    if (!evt) continue;
    const payload = evt.payload;
    if (evt.type === "session_meta") {
      if (!meta.sessionId && typeof payload?.id === "string" && payload.id.trim()) meta.sessionId = payload.id.trim();
      if (!meta.projectPath && typeof payload?.cwd === "string" && payload.cwd.trim()) meta.projectPath = payload.cwd.trim();
      if (!meta.model && typeof payload?.model === "string" && payload.model.trim()) meta.model = payload.model.trim();
      if (!meta.gitBranch && typeof payload?.git?.branch === "string" && payload.git.branch.trim()) meta.gitBranch = payload.git.branch.trim();
      if (!meta.createdAt) {
        const createdAt = Date.parse(typeof payload?.timestamp === "string" ? payload.timestamp : "");
        if (Number.isFinite(createdAt) && createdAt > 0) meta.createdAt = createdAt;
      }
      continue;
    }
    if (evt.type === "turn_context") {
      if (!meta.projectPath && typeof payload?.cwd === "string" && payload.cwd.trim()) meta.projectPath = payload.cwd.trim();
      if (!meta.model && typeof payload?.model === "string" && payload.model.trim()) meta.model = payload.model.trim();
      continue;
    }
    if (evt.type === "event_msg") {
      if (!meta.threadName && payload?.type === "thread_name_updated" && typeof payload?.thread_name === "string" && payload.thread_name.trim()) {
        meta.threadName = truncate(payload.thread_name, 200);
      }
      if (!meta.firstUserPrompt && payload?.type === "user_message" && typeof payload?.message === "string") {
        const rawMessage = stripCodexSystemMarkers(payload.message);
        meta.firstUserPrompt = truncate(firstMeaningfulSessionTitleLine(rawMessage) ?? rawMessage, 400);
      }
      continue;
    }
    if (evt.type !== "response_item" || payload?.type !== "message") continue;
    const role = roleFromUnknown(payload?.role);
    if (!role || role === "system") continue;
    const rawText = stripCodexSystemMarkers(extractTextParts(payload.content));
    const titleText = firstMeaningfulSessionTitleLine(rawText) ?? rawText;
    const text = truncate(titleText, 400);
    if (!text) continue;
    if (options?.countMessages) meta.messageCount += 1;
    if (role === "user" && !meta.firstUserPrompt) meta.firstUserPrompt = text;
    if (role === "assistant") meta.lastAssistantText = text;
    meta.lastConversationText = text;
  }
}
async function readCodexListingMeta(filePath, stat) {
  const baseMeta = {
    sessionId: path$1.basename(filePath, ".jsonl"),
    projectPath: null,
    model: "",
    gitBranch: null,
    threadName: null,
    firstUserPrompt: null,
    lastAssistantText: null,
    lastConversationText: null,
    messageCount: 0,
    createdAt: parseCodexCreatedTimestamp(filePath)
  };
  if (stat.size <= CODEX_SESSION_EXACT_SCAN_MAX_BYTES) {
    const raw = await readTextSafe(filePath);
    scanCodexListingLines(parseJsonlLines(raw ?? ""), baseMeta, { countMessages: true });
  } else {
    const [headRaw, tailRaw] = await Promise.all([
      readTextPreviewSafe(filePath, CODEX_SESSION_LISTING_HEAD_BYTES),
      readTextTailSafe(filePath, CODEX_SESSION_LISTING_TAIL_BYTES)
    ]);
    scanCodexListingLines(parseJsonlLines(headRaw ?? ""), baseMeta);
    scanCodexListingLines(parseJsonlLines(tailRaw ?? ""), baseMeta);
  }
  const title = sessionTitleFromText("Codex session", baseMeta.threadName ?? baseMeta.firstUserPrompt ?? baseMeta.lastAssistantText ?? baseMeta.lastConversationText);
  return {
    sessionId: baseMeta.sessionId,
    title,
    lastMessage: baseMeta.lastAssistantText ?? baseMeta.lastConversationText ?? baseMeta.firstUserPrompt,
    messageCount: baseMeta.messageCount,
    projectPath: baseMeta.projectPath,
    model: baseMeta.model,
    gitBranch: baseMeta.gitBranch,
    createdAt: baseMeta.createdAt
  };
}
async function listCodexSessions(workspacePath) {
  const root = path$1.join(os.homedir(), ".codex", "sessions");
  if (!await fileExists$1(root)) return [];
  const withStat = await Promise.all((await listFilesRecursive(root, (path2) => {
    const ext = path$1.extname(path2).toLowerCase();
    return ext === ".jsonl" || ext === ".json";
  }, 4)).map(async (filePath) => ({
    filePath,
    stat: await statSafe(filePath)
  })));
  const recent = withStat.filter((item) => item.stat?.isFile()).sort((a, b) => (b.stat?.mtimeMs ?? 0) - (a.stat?.mtimeMs ?? 0)).slice(0, 500);
  const entries = await Promise.all(recent.map(async ({ filePath, stat }) => {
    const ext = path$1.extname(filePath).toLowerCase();
    let listing = {
      sessionId: path$1.basename(filePath, ext),
      title: "Codex session",
      lastMessage: null,
      messageCount: 0,
      projectPath: null,
      model: "",
      gitBranch: null,
      createdAt: parseCodexCreatedTimestamp(filePath)
    };
    if (ext === ".jsonl") {
      listing = await readCodexListingMeta(filePath, stat);
    } else {
      const parsed = await readJsonSafe$1(filePath, { maxBytes: MAX_SESSION_LISTING_JSON_BYTES });
      if (parsed && typeof parsed === "object") {
        const messages = Array.isArray(parsed.items) ? parsed.items.filter((item) => item?.type === "message") : [];
        const meaningfulMessages = messages.map((item) => ({
          role: roleFromUnknown(item?.role),
          text: truncate(firstMeaningfulSessionTitleLine(stripCodexSystemMarkers(extractTextParts(item?.content))) ?? stripCodexSystemMarkers(extractTextParts(item?.content)), 400)
        })).filter((item) => item.role && item.role !== "system" && item.text);
        const firstUserPrompt = meaningfulMessages.find((item) => item.role === "user")?.text ?? null;
        const lastAssistantText = [...meaningfulMessages].reverse().find((item) => item.role === "assistant")?.text ?? null;
        const lastConversationText = meaningfulMessages[meaningfulMessages.length - 1]?.text ?? null;
        const sessionId = typeof parsed.session?.id === "string" && parsed.session.id.trim() ? parsed.session.id.trim() : path$1.basename(filePath, ext);
        const createdAt = Date.parse(typeof parsed.session?.timestamp === "string" ? parsed.session.timestamp : "") || parseCodexCreatedTimestamp(filePath);
        const title = sessionTitleFromText("Codex session", firstUserPrompt ?? lastAssistantText ?? lastConversationText);
        listing = {
          sessionId,
          title,
          lastMessage: lastAssistantText ?? lastConversationText ?? firstUserPrompt,
          messageCount: meaningfulMessages.length,
          projectPath: null,
          model: typeof parsed.session?.model === "string" ? parsed.session.model.trim() : "",
          gitBranch: typeof parsed.session?.git?.branch === "string" ? parsed.session.git.branch.trim() : null,
          createdAt
        };
      }
    }
    return {
      id: `codex:${filePath}`,
      source: "codex",
      scope: pathScope(workspacePath, listing.projectPath, "user"),
      tileId: null,
      sessionId: listing.sessionId,
      provider: "codex",
      model: listing.model,
      messageCount: listing.messageCount,
      lastMessage: listing.lastMessage,
      updatedAt: stat?.mtimeMs ?? listing.createdAt,
      sizeBytes: stat?.size ?? 0,
      filePath,
      title: listing.title,
      projectPath: listing.projectPath,
      sourceLabel: "Codex",
      sourceDetail: listing.gitBranch ?? void 0,
      canOpenInChat: isExternalSessionImportableInChat(listing.messageCount, listing.lastMessage),
      canOpenInApp: true,
      resumeBin: "codex",
      resumeArgs: listing.sessionId ? ["resume", listing.sessionId] : ["resume"]
    };
  }));
  return entries;
}
async function listHermesSessions(workspacePath) {
  const dbPath = path$1.join(os.homedir(), ".hermes", "state.db");
  const stat = await statSafe(dbPath);
  if (!stat?.isFile()) return [];
  let db = null;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db.prepare(`
      SELECT
        s.id,
        s.source,
        s.model,
        s.billing_provider,
        s.title,
        s.system_prompt,
        s.started_at,
        s.message_count,
        (
          SELECT m.content
          FROM messages m
          WHERE m.session_id = s.id
            AND m.role = 'user'
            AND m.content IS NOT NULL
          ORDER BY m.timestamp, m.id
          LIMIT 1
        ) AS first_user,
        (
          SELECT m.content
          FROM messages m
          WHERE m.session_id = s.id
            AND m.role IN ('user', 'assistant')
            AND m.content IS NOT NULL
          ORDER BY m.timestamp DESC, m.id DESC
          LIMIT 1
        ) AS last_message,
        COALESCE(
          (SELECT MAX(m2.timestamp) FROM messages m2 WHERE m2.session_id = s.id),
          s.started_at
        ) AS last_active
      FROM sessions s
      WHERE s.parent_session_id IS NULL
      ORDER BY last_active DESC
      LIMIT 500
    `).all();
    return rows.map((row) => {
      const sessionId = String(row.id ?? "").trim();
      const firstUser = typeof row.first_user === "string" ? row.first_user : null;
      const systemPrompt = typeof row.system_prompt === "string" ? row.system_prompt : null;
      const projectPath = extractProjectPathFromSessionText(firstUser) ?? extractProjectPathFromSessionText(systemPrompt);
      const titleFromUser = sessionTitleFromText("", firstUser);
      const dbTitle = String(row.title ?? "").trim();
      const title = titleFromUser || dbTitle || "Hermes session";
      const detailSource = String(row.source ?? "").trim();
      const billingProvider = String(row.billing_provider ?? "").trim();
      const sourceDetail = detailSource && billingProvider && detailSource.toLowerCase() !== billingProvider.toLowerCase() ? `${detailSource} via ${billingProvider}` : detailSource || "cli";
      return {
        id: `hermes:${sessionId}`,
        source: "hermes",
        scope: pathScope(workspacePath, projectPath, "user"),
        tileId: null,
        sessionId,
        provider: "hermes",
        model: String(row.model ?? "").trim(),
        messageCount: Number(row.message_count) || 0,
        lastMessage: truncate(row.last_message, 400),
        updatedAt: epochMsFromUnknown(row.last_active ?? row.started_at),
        filePath: dbPath,
        title,
        projectPath,
        sourceLabel: "Hermes",
        sourceDetail,
        canOpenInChat: isExternalSessionImportableInChat(row.message_count, row.last_message),
        canOpenInApp: true,
        resumeBin: "hermes",
        resumeArgs: sessionId ? ["--resume", sessionId] : []
      };
    }).filter((entry) => entry.sessionId);
  } catch {
    return [];
  } finally {
    try {
      db?.close();
    } catch {
    }
  }
}
function decodeCursorMeta(hex) {
  try {
    return JSON.parse(Buffer.from(hex.trim(), "hex").toString("utf8"));
  } catch {
    return null;
  }
}
async function listCursorSessions(_workspacePath) {
  const root = path$1.join(os.homedir(), ".cursor", "chats");
  if (!await fileExists$1(root)) return [];
  const dbFiles = await listFilesRecursive(root, (path2) => path$1.basename(path2) === "store.db", 3);
  const withStat = await Promise.all(dbFiles.map(async (filePath) => ({ filePath, stat: await statSafe(filePath) })));
  const recent = withStat.filter((item) => item.stat?.isFile()).sort((a, b) => (b.stat?.mtimeMs ?? 0) - (a.stat?.mtimeMs ?? 0)).slice(0, 60);
  return recent.map(({ filePath, stat }) => {
    let title = "Cursor chat";
    let sessionId = path$1.basename(filePath);
    try {
      const db = new Database(filePath, { readonly: true });
      const row = db.prepare("select value from meta where key='0'").get();
      const meta = row?.value ? decodeCursorMeta(row.value) : null;
      if (typeof meta?.name === "string" && meta.name.trim()) title = meta.name.trim();
      if (typeof meta?.agentId === "string") sessionId = meta.agentId;
      db.close();
    } catch {
    }
    return {
      id: `cursor:${filePath}`,
      source: "cursor",
      scope: "user",
      tileId: null,
      sessionId,
      provider: "cursor",
      model: "",
      messageCount: 0,
      lastMessage: null,
      updatedAt: stat?.mtimeMs ?? 0,
      filePath,
      title,
      projectPath: null,
      sourceLabel: "Cursor",
      sourceDetail: "Local chat store",
      canOpenInChat: false,
      canOpenInApp: false
    };
  });
}
async function listOpenClawSessions(workspacePath) {
  const root = path$1.join(os.homedir(), ".openclaw", "agents");
  if (!await fileExists$1(root)) return [];
  let agentDirs = [];
  try {
    agentDirs = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const entries = [];
  for (const dirent of agentDirs) {
    if (!dirent.isDirectory()) continue;
    const agentId = dirent.name;
    const sessionsIndexPath = path$1.join(root, agentId, "sessions", "sessions.json");
    const parsed = await readJsonSafe$1(sessionsIndexPath);
    if (!parsed || typeof parsed !== "object") continue;
    for (const [key, value] of Object.entries(parsed)) {
      const meta = value;
      if (typeof meta?.deletedAt === "number") continue;
      const updatedAt = typeof meta?.updatedAt === "number" ? meta.updatedAt : 0;
      const sessionFile = typeof meta?.sessionFile === "string" ? meta.sessionFile : void 0;
      const label = formatOpenClawTitle(agentId, key, meta);
      const projectPath = typeof meta?.cwd === "string" && meta.cwd.startsWith("/") ? meta.cwd : typeof meta?.projectPath === "string" && meta.projectPath.startsWith("/") ? meta.projectPath : typeof meta?.workingDirectory === "string" && meta.workingDirectory.startsWith("/") ? meta.workingDirectory : null;
      entries.push({
        id: `openclaw:${agentId}:${key}`,
        source: "openclaw",
        scope: pathScope(workspacePath, projectPath, "user"),
        tileId: null,
        sessionId: typeof meta?.sessionId === "string" ? meta.sessionId : null,
        provider: "openclaw",
        model: agentId,
        messageCount: 0,
        lastMessage: null,
        updatedAt,
        filePath: sessionFile,
        title: label.title,
        projectPath,
        sourceLabel: "OpenClaw",
        sourceDetail: label.detail,
        canOpenInChat: Boolean(sessionFile),
        canOpenInApp: true,
        resumeBin: "openclaw",
        resumeArgs: ["tui", "--session", key],
        relatedGroupId: label.relatedGroupId,
        nestingLevel: label.nestingLevel
      });
    }
  }
  return entries.sort(compareSessions).slice(0, 500);
}
function parseOpenCodeTimestamp(filePath) {
  const base = path$1.basename(filePath);
  const match = base.match(/_(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_/);
  if (!match) return 0;
  const [, date, hh, mm, ss, ms] = match;
  return Date.parse(`${date}T${hh}:${mm}:${ss}.${ms}Z`) || 0;
}
async function listOpenCodeSessions(workspacePath) {
  const root = path$1.join(os.homedir(), ".opencode", "conversations");
  if (!await fileExists$1(root)) return [];
  const files = await listFilesRecursive(root, (path2) => path$1.extname(path2).toLowerCase() === ".json", 3);
  const recent = files.map((filePath) => ({ filePath, ts: parseOpenCodeTimestamp(filePath) })).sort((a, b) => b.ts - a.ts).slice(0, 500);
  const entries = await Promise.all(recent.map(async ({ filePath, ts }) => {
    const parsed = await readJsonSafe$1(filePath, { maxBytes: MAX_SESSION_LISTING_JSON_BYTES });
    const projectPath = typeof parsed?.projectPath === "string" ? parsed.projectPath : null;
    const meaningfulMessages = Array.isArray(parsed?.messages) ? parsed.messages.filter((m) => typeof m?.content === "string" && m.role !== "system" && m.content.trim()) : [];
    const lastMessage = truncate(meaningfulMessages.slice(-1)[0]?.content);
    const sessionId = typeof parsed?.id === "string" ? parsed.id : path$1.basename(filePath, ".json");
    return {
      id: `opencode:${filePath}`,
      source: "opencode",
      scope: pathScope(workspacePath, projectPath, "user"),
      tileId: null,
      sessionId,
      provider: "opencode",
      model: typeof parsed?.model === "string" ? parsed.model : "",
      messageCount: meaningfulMessages.length,
      lastMessage,
      updatedAt: ts || Date.parse(parsed?.startTime ?? "") || 0,
      filePath,
      title: sessionTitleFromText("OpenCode session", lastMessage),
      projectPath,
      sourceLabel: "OpenCode",
      sourceDetail: typeof parsed?.model === "string" ? parsed.model : "Conversation",
      canOpenInChat: isExternalSessionImportableInChat(meaningfulMessages.length, lastMessage),
      canOpenInApp: true,
      resumeBin: "opencode",
      resumeArgs: sessionId ? ["--session", sessionId] : []
    };
  }));
  return entries;
}
async function listExternalSessionEntries(workspacePath, options) {
  const cacheKey = workspacePath ?? "__no_workspace__";
  const cached2 = externalSessionCache.get(cacheKey);
  if (options?.force && cached2) {
    void refreshExternalSessionEntries(workspacePath, cacheKey);
    return cached2.entries;
  }
  if (cached2 && Date.now() - cached2.at < EXTERNAL_SESSION_CACHE_MS) {
    return cached2.entries;
  }
  return refreshExternalSessionEntries(workspacePath, cacheKey);
}
const inflightRefreshes = /* @__PURE__ */ new Map();
async function refreshExternalSessionEntries(workspacePath, cacheKey) {
  const existing = inflightRefreshes.get(cacheKey);
  if (existing) return existing;
  const promise = (async () => {
    await ensureCodeSurfStructure(workspacePath);
    const results = await Promise.allSettled([
      listCodeSurfSessionFiles(workspacePath),
      listClaudeSessions(workspacePath),
      listCodexSessions(workspacePath),
      listHermesSessions(workspacePath),
      listCursorSessions(workspacePath),
      listOpenClawSessions(workspacePath),
      listOpenCodeSessions(workspacePath)
    ]);
    const entries = results.flatMap((result) => result.status === "fulfilled" ? result.value : []).sort(compareSessions);
    externalSessionCache.set(cacheKey, { at: Date.now(), entries });
    return entries;
  })();
  inflightRefreshes.set(cacheKey, promise);
  promise.finally(() => {
    inflightRefreshes.delete(cacheKey);
  });
  return promise;
}
function buildEntryFromHint(workspacePath, hint) {
  return {
    id: hint.id,
    source: hint.source,
    scope: pathScope(workspacePath, hint.projectPath ?? null, "user"),
    tileId: null,
    sessionId: hint.sessionId,
    provider: hint.provider,
    model: hint.model,
    messageCount: hint.messageCount,
    lastMessage: null,
    updatedAt: 0,
    filePath: hint.filePath,
    title: hint.title,
    projectPath: hint.projectPath ?? null,
    sourceLabel: hint.provider || hint.source,
    canOpenInChat: true,
    canOpenInApp: false
  };
}
async function resolveSessionEntry(workspacePath, id, entryHint) {
  if (entryHint && entryHint.id === id && entryHint.filePath) {
    const stat = await statSafe(entryHint.filePath);
    if (stat?.isFile()) return buildEntryFromHint(workspacePath, entryHint);
  }
  return findSessionEntryById(workspacePath, id);
}
async function findSessionEntryById(workspacePath, id) {
  const scoped = await listExternalSessionEntries(workspacePath);
  const scopedHit = scoped.find((entry) => entry.id === id);
  if (scopedHit) return scopedHit;
  if (workspacePath) {
    const global = await listExternalSessionEntries(null);
    const globalHit = global.find((entry) => entry.id === id);
    if (globalHit) return globalHit;
  }
  const refreshed = await listExternalSessionEntries(workspacePath, { force: true });
  const refreshedHit = refreshed.find((entry) => entry.id === id);
  if (refreshedHit) return refreshedHit;
  if (workspacePath) {
    const refreshedGlobal = await listExternalSessionEntries(null, { force: true });
    return refreshedGlobal.find((entry) => entry.id === id) ?? null;
  }
  return null;
}
async function parseCodeSurfChatState(filePath) {
  const parsed = await readJsonSafe$1(filePath);
  if (parsed && Array.isArray(parsed.messages)) {
    const messages = parsed.messages.map((message, index) => {
      const role = roleFromUnknown(message?.role) ?? "assistant";
      return makeImportedRichMessage({
        id: `codesurf-${index}`,
        role,
        content: typeof message?.content === "string" ? message.content : extractTextParts(message?.content),
        timestamp: Number(message?.timestamp) || Date.now() + index,
        thinking: typeof message?.thinking?.content === "string" ? { content: message.thinking.content, done: message.thinking.done !== false } : void 0,
        toolBlocks: Array.isArray(message?.toolBlocks) ? message.toolBlocks : void 0
      });
    }).filter(Boolean);
    return {
      provider: typeof parsed.provider === "string" ? parsed.provider : "claude",
      model: typeof parsed.model === "string" ? parsed.model : "",
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
      messages
    };
  }
  const raw = await readTextSafe(filePath);
  if (!raw) return null;
  return {
    provider: "claude",
    model: "",
    sessionId: null,
    messages: [
      {
        id: "codesurf-import-0",
        role: "system",
        content: raw,
        timestamp: Date.now()
      }
    ]
  };
}
async function parseClaudeChatState(filePath, entry, options) {
  const stat = await statSafe(filePath);
  if (!stat?.isFile()) return null;
  if (!options?.full && stat.size > LARGE_EXTERNAL_SESSION_BYTES) {
    const [headRaw, tailRaw] = await Promise.all([
      readTextPreviewSafe(filePath, EXTERNAL_SESSION_HEAD_SAMPLE_BYTES),
      readTextTailSafe(filePath, EXTERNAL_SESSION_TAIL_SAMPLE_BYTES)
    ]);
    const headMessages = parseClaudeMessagesFromLines(parseJsonlLines(headRaw ?? ""), 0);
    const tailLines = parseJsonlLines(tailRaw ?? "");
    const tailMessages = parseClaudeMessagesFromLines(tailLines, Math.max(0, tailLines.length * -1));
    const firstMessage = headMessages.find((message) => message.role !== "system") ?? headMessages[0] ?? null;
    const messages2 = dedupeImportedMessages([
      ...firstMessage ? [firstMessage] : [],
      makeTranscriptTruncationMessage("claude", stat.size),
      ...tailMessages
    ]);
    return {
      provider: "claude",
      model: entry.model,
      sessionId: entry.sessionId,
      messages: messages2
    };
  }
  const messages = [];
  try {
    await scanJsonlFile(filePath, (line, lineNumber) => {
      const message = parseClaudeLine(line, lineNumber - 1);
      if (message) messages.push(message);
    });
  } catch {
    return null;
  }
  return {
    provider: "claude",
    model: entry.model,
    sessionId: entry.sessionId,
    messages
  };
}
function parseCodexChatStateFromLines(lines, entry, offset = 0) {
  const messages = [];
  const pendingToolCalls = /* @__PURE__ */ new Map();
  let pendingThinking = [];
  let pendingCalls = [];
  let model = entry.model;
  let sessionId = entry.sessionId;
  const flushAssistantArtifacts = (index, timestamp, content = "") => {
    const next = makeImportedRichMessage({
      // Assistant artifact flushes can happen immediately before a user
      // message at the same absolute line index, so they need their own id
      // namespace to keep React keys stable.
      id: `codex-assistant-${index}`,
      role: "assistant",
      content,
      timestamp,
      thinking: pendingThinking.length > 0 ? { content: pendingThinking.join("\n\n"), done: true } : void 0,
      toolBlocks: buildImportedToolBlocks(pendingCalls)
    });
    if (next) messages.push(next);
    pendingThinking = [];
    pendingCalls = [];
    pendingToolCalls.clear();
  };
  let lastIndex = offset;
  lines.forEach((line, index) => {
    const absoluteIndex = offset + index;
    lastIndex = absoluteIndex;
    try {
      const evt = JSON.parse(line);
      const timestamp = Date.parse(evt?.timestamp ?? "") || Date.now() + absoluteIndex;
      const payload = evt?.payload;
      if (!model && typeof payload?.model === "string") model = payload.model;
      if (!sessionId && typeof payload?.id === "string") sessionId = payload.id;
      if (evt?.type !== "response_item") return;
      if (payload?.type === "reasoning") {
        const summary = extractReasoningSummary(payload);
        if (summary) pendingThinking.push(summary);
        return;
      }
      if (payload?.type === "function_call" || payload?.type === "custom_tool_call") {
        const call = parseCodexToolCall(payload);
        if (!call) return;
        pendingToolCalls.set(call.id, call);
        pendingCalls.push(call);
        return;
      }
      if (payload?.type === "function_call_output") {
        const callId = typeof payload?.call_id === "string" ? payload.call_id : null;
        if (!callId) return;
        const existing = pendingToolCalls.get(callId);
        if (!existing) return;
        existing.output = sanitizeToolOutputText$1(typeof payload?.output === "string" ? payload.output : "");
        if (existing.commandEntry) existing.commandEntry.output = existing.output;
        return;
      }
      if (payload?.type !== "message") return;
      const role = roleFromUnknown(payload?.role);
      if (!role) return;
      const content = stripCodexSystemMarkers(extractTextParts(payload.content));
      if (role === "assistant") {
        flushAssistantArtifacts(absoluteIndex, timestamp, content);
        return;
      }
      if (pendingThinking.length > 0 || pendingCalls.length > 0) {
        flushAssistantArtifacts(absoluteIndex, timestamp, "");
      }
      const message = makeImportedMessage(`codex-${absoluteIndex}`, role, content, timestamp);
      if (message) messages.push(message);
    } catch {
    }
  });
  if (pendingThinking.length > 0 || pendingCalls.length > 0) {
    flushAssistantArtifacts(lastIndex + 1, Date.now());
  }
  return {
    provider: "codex",
    model,
    sessionId,
    messages
  };
}
async function findLatestCodexPlanSnapshotMessage(filePath) {
  let latest = null;
  try {
    await scanJsonlFile(filePath, (line, lineNumber) => {
      try {
        const evt = JSON.parse(line);
        const payload = evt?.payload;
        if (evt?.type !== "response_item") return;
        if (payload?.type !== "function_call" && payload?.type !== "custom_tool_call") return;
        if (!isImportedPlanToolName(typeof payload?.name === "string" ? payload.name : null)) return;
        const call = parseCodexToolCall(payload);
        if (!call) return;
        const timestamp = Date.parse(evt?.timestamp ?? "") || Date.now() + lineNumber;
        latest = { lineNumber, timestamp, call };
      } catch {
      }
    });
  } catch {
    return null;
  }
  if (!latest) return null;
  return makeImportedRichMessage({
    id: `codex-plan-${latest.lineNumber}`,
    role: "assistant",
    content: "",
    timestamp: latest.timestamp,
    toolBlocks: buildImportedToolBlocks([latest.call])
  });
}
async function parseCodexChatState(filePath, entry, options) {
  const stat = await statSafe(filePath);
  if (!stat?.isFile()) return null;
  if (!options?.full && stat.size > LARGE_EXTERNAL_SESSION_BYTES) {
    const [headRaw, tailRaw, recoveredPlanMessage] = await Promise.all([
      readTextPreviewSafe(filePath, EXTERNAL_SESSION_HEAD_SAMPLE_BYTES),
      readTextTailSafe(filePath, EXTERNAL_SESSION_TAIL_SAMPLE_BYTES),
      findLatestCodexPlanSnapshotMessage(filePath)
    ]);
    const headLines = parseJsonlLines(headRaw ?? "");
    const tailLines = parseJsonlLines(tailRaw ?? "");
    const firstChunk = parseCodexChatStateFromLines(headLines, entry, 0);
    const recentChunk = parseCodexChatStateFromLines(tailLines, entry, Math.max(1e4, tailLines.length));
    const firstMessage = firstChunk.messages.find((message) => message.role === "user") ?? firstChunk.messages[0] ?? null;
    const messages = dedupeImportedMessages([
      ...firstMessage ? [firstMessage] : [],
      makeTranscriptTruncationMessage("codex", stat.size),
      ...recoveredPlanMessage ? [recoveredPlanMessage] : [],
      ...recentChunk.messages
    ]);
    return {
      provider: "codex",
      model: recentChunk.model || firstChunk.model,
      sessionId: recentChunk.sessionId ?? firstChunk.sessionId,
      messages
    };
  }
  const lines = [];
  try {
    await scanJsonlFile(filePath, (line) => {
      lines.push(line);
    });
  } catch {
    return null;
  }
  return parseCodexChatStateFromLines(lines, entry, 0);
}
async function parseOpenClawChatState(filePath, entry) {
  const raw = await readTextSafe(filePath);
  if (!raw) return null;
  const messages = raw.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      const evt = JSON.parse(line);
      if (evt?.type !== "message") return null;
      const role = roleFromUnknown(evt?.message?.role);
      if (!role) return null;
      return makeImportedMessage(`openclaw-${index}`, role, extractTextParts(evt?.message?.content), Date.parse(evt?.timestamp ?? "") || Number(evt?.message?.timestamp) || Date.now() + index);
    } catch {
      return null;
    }
  }).filter(Boolean);
  return {
    provider: "openclaw",
    model: entry.model,
    sessionId: entry.sessionId,
    messages
  };
}
async function parseHermesChatState(filePath, entry) {
  const sessionId = String(entry.sessionId ?? "").trim();
  if (!sessionId) return null;
  let db = null;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
    const session = db.prepare("SELECT model FROM sessions WHERE id = ?").get(sessionId);
    const rows = db.prepare(`
      SELECT id, role, content, timestamp, reasoning, reasoning_content
      FROM messages
      WHERE session_id = ?
      ORDER BY timestamp, id
    `).all(sessionId);
    const messages = rows.map((row, index) => {
      const role = roleFromUnknown(row.role);
      if (!role) return null;
      const thinkingContent = role === "assistant" ? String(row.reasoning_content ?? row.reasoning ?? "").trim() : "";
      return makeImportedRichMessage({
        id: `hermes-${sessionId}-${row.id ?? index}`,
        role,
        content: typeof row.content === "string" ? row.content : "",
        timestamp: epochMsFromUnknown(row.timestamp) || Date.now() + index,
        thinking: thinkingContent ? { content: thinkingContent, done: true } : void 0
      });
    }).filter(Boolean);
    return {
      provider: "hermes",
      model: String(session?.model ?? entry.model ?? "").trim(),
      sessionId,
      messages
    };
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
    }
  }
}
async function parseOpenCodeChatState(filePath, entry) {
  const parsed = await readJsonSafe$1(filePath);
  if (!parsed || !Array.isArray(parsed.messages)) return null;
  const messages = parsed.messages.map((message, index) => {
    const role = roleFromUnknown(message?.role);
    if (!role) return null;
    return makeImportedMessage(`opencode-${index}`, role, extractTextParts(message?.content), Number(message?.timestamp) || Date.now() + index);
  }).filter(Boolean);
  return {
    provider: "opencode",
    model: entry.model,
    sessionId: entry.sessionId,
    messages
  };
}
function invalidateExternalSessionCache(workspacePath) {
  if (workspacePath) {
    externalSessionCache.delete(workspacePath);
    for (const key of externalSessionStateCache.keys()) {
      if (key.startsWith(`${workspacePath}::`)) externalSessionStateCache.delete(key);
    }
    for (const key of externalSessionFullStateCache.keys()) {
      if (key.startsWith(`${workspacePath}::`)) externalSessionFullStateCache.delete(key);
    }
    return;
  }
  externalSessionCache.clear();
  externalSessionStateCache.clear();
  externalSessionFullStateCache.clear();
}
async function loadCachedExternalSessionState(entry, cacheKey) {
  if (!entry.filePath) return null;
  return await getCachedExternalSessionChatState(
    externalSessionStateCache,
    EXTERNAL_SESSION_STATE_CACHE_MAX_ENTRIES,
    cacheKey,
    entry.filePath,
    async () => {
      if (entry.source === "codesurf") return parseCodeSurfChatState(entry.filePath);
      if (entry.source === "claude") return parseClaudeChatState(entry.filePath, entry);
      if (entry.source === "codex") return parseCodexChatState(entry.filePath, entry);
      if (entry.source === "hermes") return parseHermesChatState(entry.filePath, entry);
      if (entry.source === "openclaw") return parseOpenClawChatState(entry.filePath, entry);
      if (entry.source === "opencode") return parseOpenCodeChatState(entry.filePath, entry);
      return null;
    }
  );
}
async function loadCachedFullExternalSessionState(entry, cacheKey) {
  if (!entry.filePath) return null;
  return await getCachedExternalSessionChatState(
    externalSessionFullStateCache,
    EXTERNAL_SESSION_FULL_STATE_CACHE_MAX_ENTRIES,
    `${cacheKey}::full`,
    entry.filePath,
    async () => {
      if (entry.source === "codesurf") return parseCodeSurfChatState(entry.filePath);
      if (entry.source === "claude") return parseClaudeChatState(entry.filePath, entry, { full: true });
      if (entry.source === "codex") return parseCodexChatState(entry.filePath, entry, { full: true });
      if (entry.source === "hermes") return parseHermesChatState(entry.filePath, entry);
      if (entry.source === "openclaw") return parseOpenClawChatState(entry.filePath, entry);
      if (entry.source === "opencode") return parseOpenCodeChatState(entry.filePath, entry);
      return null;
    }
  );
}
function inferHasEarlierMessages(entry, loadedCount, tailLimit) {
  if (tailLimit == null) return false;
  if (loadedCount > tailLimit) return true;
  return Number.isFinite(entry.messageCount) && entry.messageCount > Math.max(loadedCount, tailLimit);
}
async function getExternalSessionChatState(workspacePath, id, options) {
  const entry = await resolveSessionEntry(workspacePath, id, options?.entryHint);
  if (!entry?.filePath || !entry.canOpenInChat) return null;
  const cacheKey = `${workspacePath ?? "__no_workspace__"}::${entry.source}::${entry.filePath}::${entry.id}`;
  const tailLimit = typeof options?.tailLimit === "number" && options.tailLimit > 0 ? Math.max(1, Math.floor(options.tailLimit)) : null;
  const cachedFullState = tailLimit == null ? null : await getFreshCachedExternalSessionChatState(
    externalSessionFullStateCache,
    EXTERNAL_SESSION_FULL_STATE_CACHE_MAX_ENTRIES,
    `${cacheKey}::full`,
    entry.filePath
  );
  const state = cachedFullState ?? await loadCachedExternalSessionState(entry, cacheKey);
  if (!state) return null;
  if (tailLimit == null || state.messages.length <= tailLimit) {
    return {
      ...state,
      hasEarlierMessages: inferHasEarlierMessages(entry, state.messages.length, tailLimit ?? void 0)
    };
  }
  return {
    ...state,
    messages: state.messages.slice(-tailLimit),
    hasEarlierMessages: true
  };
}
async function loadExternalSessionMessagesPage(workspacePath, id, options) {
  const entry = await resolveSessionEntry(workspacePath, id, options.entryHint);
  if (!entry?.filePath || !entry.canOpenInChat) return null;
  const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 20)));
  const largePage = await loadLargeExternalSessionMessagesPageFromTail(entry, {
    beforeFingerprint: String(options.beforeFingerprint ?? "").trim(),
    limit
  });
  if (largePage) return largePage;
  const cacheKey = `${workspacePath ?? "__no_workspace__"}::${entry.source}::${entry.filePath}::${entry.id}`;
  const state = await loadCachedFullExternalSessionState(entry, cacheKey);
  if (!state) return null;
  const beforeFingerprint = String(options.beforeFingerprint ?? "").trim();
  let endIndex = state.messages.length;
  if (beforeFingerprint) {
    const matchIndex = state.messages.findIndex((message) => buildChatMessageHistoryFingerprint(message) === beforeFingerprint);
    if (matchIndex < 0) {
      return {
        provider: state.provider,
        model: state.model,
        sessionId: state.sessionId,
        total: state.messages.length,
        hasMore: false,
        messages: []
      };
    }
    endIndex = matchIndex;
  }
  const startIndex = Math.max(0, endIndex - limit);
  return {
    provider: state.provider,
    model: state.model,
    sessionId: state.sessionId,
    total: state.messages.length,
    hasMore: startIndex > 0,
    messages: state.messages.slice(startIndex, endIndex)
  };
}
async function loadLargeExternalSessionMessagesPageFromTail(entry, options) {
  if (entry.source !== "claude" && entry.source !== "codex") return null;
  if (!entry.filePath) return null;
  const stat = await statSafe(entry.filePath);
  if (!stat?.isFile() || stat.size <= LARGE_EXTERNAL_SESSION_BYTES) return null;
  const sampleBytes = Math.min(stat.size, EXTERNAL_SESSION_TAIL_SAMPLE_BYTES * 2);
  const raw = await readTextTailSafe(entry.filePath, sampleBytes);
  const lines = parseJsonlLines(raw ?? "");
  const state = entry.source === "claude" ? {
    provider: "claude",
    model: entry.model,
    sessionId: entry.sessionId,
    messages: parseClaudeMessagesFromLines(lines, Math.max(0, lines.length * -1))
  } : parseCodexChatStateFromLines(lines, entry, Math.max(1e4, lines.length));
  const messages = dedupeImportedMessages(state.messages);
  const beforeFingerprint = options.beforeFingerprint;
  let endIndex = messages.length;
  if (beforeFingerprint) {
    const matchIndex = messages.findIndex((message) => buildChatMessageHistoryFingerprint(message) === beforeFingerprint);
    if (matchIndex < 0) {
      return {
        provider: state.provider,
        model: state.model,
        sessionId: state.sessionId,
        total: Number.isFinite(entry.messageCount) ? Number(entry.messageCount) : messages.length,
        hasMore: false,
        messages: []
      };
    }
    endIndex = matchIndex;
  }
  const startIndex = Math.max(0, endIndex - options.limit);
  return {
    provider: state.provider,
    model: state.model,
    sessionId: state.sessionId,
    total: Number.isFinite(entry.messageCount) ? Number(entry.messageCount) : messages.length,
    hasMore: startIndex > 0,
    messages: messages.slice(startIndex, endIndex)
  };
}
function asString(value) {
  return typeof value === "string" ? value : "";
}
function asStringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
function stripModelPrefix(name) {
  return name.replace(/^models\//, "");
}
function normalizeGeminiModel(raw) {
  const name = asString(raw.name);
  const id = stripModelPrefix(asString(raw.baseModelId) || name);
  const label = asString(raw.displayName) || id;
  const methods = asStringArray(raw.supportedGenerationMethods);
  const searchable = `${id} ${name} ${label} ${asString(raw.description)}`.toLowerCase();
  const capabilities = /* @__PURE__ */ new Set();
  if (methods.includes("generateContent")) capabilities.add("text");
  if (searchable.includes("image") || searchable.includes("imagen") || searchable.includes("nano banana") || /gemini-[\w.-]+-flash-image/.test(searchable)) {
    capabilities.add("image");
  }
  if (searchable.includes("veo") || methods.includes("predictLongRunning")) {
    capabilities.add("video");
  }
  return { id, name, label, methods, capabilities: Array.from(capabilities) };
}
function splitProviderModels(models) {
  return {
    models,
    textModels: models.filter((model) => model.capabilities.includes("text")),
    imageModels: models.filter((model) => model.capabilities.includes("image")),
    videoModels: models.filter((model) => model.capabilities.includes("video"))
  };
}
function normalizeAnthropicModel(raw) {
  const id = asString(raw.id);
  return {
    id,
    name: id,
    label: asString(raw.display_name) || id,
    methods: ["messages"],
    capabilities: ["text"]
  };
}
function normalizeOpenRouterModel(raw) {
  const id = asString(raw.id);
  const architecture = raw.architecture && typeof raw.architecture === "object" ? raw.architecture : {};
  const outputModalities = asStringArray(architecture.output_modalities);
  const capabilities = /* @__PURE__ */ new Set();
  if (outputModalities.includes("text")) capabilities.add("text");
  if (outputModalities.includes("image")) capabilities.add("image");
  if (outputModalities.includes("video")) capabilities.add("video");
  if (capabilities.size === 0) capabilities.add("text");
  return {
    id,
    name: id,
    label: asString(raw.name) || id,
    methods: ["chat.completions"],
    capabilities: Array.from(capabilities)
  };
}
async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
}
async function validateGenerationProvider(provider) {
  if (provider.id === "gemini") {
    const apiKey = provider.apiKey?.trim();
    if (!apiKey) {
      return {
        ok: false,
        providerId: provider.id,
        message: "Missing Gemini API key.",
        models: [],
        textModels: [],
        imageModels: [],
        videoModels: []
      };
    }
    const allModels = [];
    let pageToken = "";
    do {
      const url2 = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url2.searchParams.set("pageSize", "1000");
      if (pageToken) url2.searchParams.set("pageToken", pageToken);
      const response = await fetch(url2, { headers: { "x-goog-api-key": apiKey } });
      const payload = await parseResponse(response);
      if (!response.ok) {
        return {
          ok: false,
          providerId: provider.id,
          message: payload.error?.message || `Gemini key validation failed (${response.status}).`,
          models: [],
          textModels: [],
          imageModels: [],
          videoModels: []
        };
      }
      allModels.push(...(payload.models ?? []).map(normalizeGeminiModel));
      pageToken = payload.nextPageToken ?? "";
    } while (pageToken);
    const split = splitProviderModels(allModels);
    return {
      ok: true,
      providerId: provider.id,
      message: `Gemini key valid. Found ${allModels.length} models, ${split.imageModels.length} image models, ${split.videoModels.length} video models.`,
      ...split
    };
  }
  if (provider.id === "anthropic") {
    const apiKey = provider.apiKey?.trim();
    if (!apiKey) {
      return { ok: false, providerId: provider.id, message: "Missing Anthropic API key.", models: [], textModels: [], imageModels: [], videoModels: [] };
    }
    const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, providerId: provider.id, message: payload.error?.message || `Anthropic key validation failed (${response.status}).`, models: [], textModels: [], imageModels: [], videoModels: [] };
    }
    const models = (payload.data ?? []).map(normalizeAnthropicModel);
    return { ok: true, providerId: provider.id, message: `Anthropic key valid. Found ${models.length} models.`, ...splitProviderModels(models) };
  }
  if (provider.id === "openrouter") {
    const apiKey = provider.apiKey?.trim();
    if (!apiKey) {
      return { ok: false, providerId: provider.id, message: "Missing OpenRouter API key.", models: [], textModels: [], imageModels: [], videoModels: [] };
    }
    const baseUrl = (provider.baseUrl?.trim() || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/models/user`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, providerId: provider.id, message: payload.error?.message || `OpenRouter key validation failed (${response.status}).`, models: [], textModels: [], imageModels: [], videoModels: [] };
    }
    const models = (payload.data ?? []).map(normalizeOpenRouterModel);
    const split = splitProviderModels(models);
    return {
      ok: true,
      providerId: provider.id,
      message: `OpenRouter key valid. Found ${models.length} models, ${split.imageModels.length} image-capable models.`,
      ...split
    };
  }
  if (provider.id === "local") {
    const baseUrl = provider.baseUrl?.trim();
    if (!baseUrl) {
      return { ok: false, providerId: provider.id, message: "Missing local provider base URL.", models: [], textModels: [], imageModels: [], videoModels: [] };
    }
    const response = await fetch(new URL("/v1/models", baseUrl));
    if (!response.ok) {
      return { ok: false, providerId: provider.id, message: `Local provider model listing failed (${response.status}).`, models: [], textModels: [], imageModels: [], videoModels: [] };
    }
    const payload = await response.json().catch(() => ({}));
    const models = (payload.data ?? []).flatMap((model) => {
      const id = model.id || model.name || "";
      return id ? [{ id, name: id, label: id, methods: [], capabilities: ["text"] }] : [];
    });
    return { ok: true, providerId: provider.id, message: `Local provider reachable. Found ${models.length} models.`, ...splitProviderModels(models) };
  }
  return {
    ok: false,
    providerId: provider.id,
    message: `${provider.label} validation is not implemented yet.`,
    models: [],
    textModels: [],
    imageModels: [],
    videoModels: []
  };
}
const SETTINGS_PATH = path$1.join(CONTEX_HOME, "settings.json");
const LEGACY_CONFIG_PATH = path$1.join(CONTEX_HOME, "config.json");
function extractWorkspacePrimaryPath(workspace) {
  if (!workspace) return null;
  const projectPath = Array.isArray(workspace.projectPaths) && workspace.projectPaths.length > 0 ? workspace.projectPaths[0] : workspace.path;
  const normalized = String(projectPath ?? "").trim();
  return normalized || null;
}
function normalizeSettingsDocument(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "settings" in parsed) {
      return withDefaultSettings(parsed.settings ?? {});
    }
  } catch {
  }
  return { ...DEFAULT_SETTINGS };
}
async function ensureWorkspaceSideEffects(workspace) {
  const projectPaths = Array.isArray(workspace?.projectPaths) ? workspace?.projectPaths ?? [] : [];
  for (const projectPath of projectPaths) {
    if (!projectPath) continue;
    await ensureCodeSurfStructure(projectPath);
    writeMCPConfigToWorkspace(projectPath).catch(() => {
    });
  }
}
async function applySettingsSideEffects() {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    applyWindowAppearance(win);
  }
}
async function getWorkspacePathById(workspaceId) {
  await ensureDaemonRunning();
  const workspaces = await daemonClient.listWorkspaces();
  return extractWorkspacePrimaryPath(workspaces.find((workspace) => workspace.id === workspaceId) ?? null);
}
async function getWorkspaceStorageIds(workspaceId) {
  return [workspaceId];
}
async function initWorkspaces() {
  await ensureCodeSurfStructure();
  await ensureDaemonRunning();
  const projects = await daemonClient.listProjects();
  for (const project of projects) {
    await ensureCodeSurfStructure(project.path);
  }
}
function readSettingsSync() {
  try {
    return normalizeSettingsDocument(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    try {
      return normalizeSettingsDocument(fs.readFileSync(LEGACY_CONFIG_PATH, "utf8"));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}
function registerWorkspaceIPC() {
  electron.ipcMain.handle("workspace:list", async () => {
    await ensureDaemonRunning();
    return await daemonClient.listWorkspaces();
  });
  electron.ipcMain.handle("workspace:listProjects", async () => {
    await ensureDaemonRunning();
    return await daemonClient.listProjects();
  });
  electron.ipcMain.handle("workspace:getActive", async () => {
    await ensureDaemonRunning();
    return await daemonClient.getActiveWorkspace();
  });
  electron.ipcMain.handle("workspace:create", async (_, name) => {
    await ensureDaemonRunning();
    const workspace = await daemonClient.createWorkspace(name);
    await ensureWorkspaceSideEffects(workspace);
    return workspace;
  });
  electron.ipcMain.handle("workspace:createWithPath", async (_, name, projectPath) => {
    await ensureDaemonRunning();
    const workspace = await daemonClient.createWorkspaceWithPath(name, projectPath);
    await ensureWorkspaceSideEffects(workspace);
    return workspace;
  });
  electron.ipcMain.handle("workspace:openFolder", async () => {
    const win = electron.BrowserWindow.getFocusedWindow();
    const result = await electron.dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
      title: "Open Project Folder"
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  electron.ipcMain.handle("workspace:addProjectFolder", async (_, workspaceId, folderPath) => {
    await ensureDaemonRunning();
    const workspace = await daemonClient.addProjectFolder(workspaceId, folderPath);
    await ensureWorkspaceSideEffects(workspace);
    return workspace;
  });
  electron.ipcMain.handle("workspace:removeProjectFolder", async (_, workspaceId, folderPath) => {
    await ensureDaemonRunning();
    return await daemonClient.removeProjectFolder(workspaceId, folderPath);
  });
  electron.ipcMain.handle("workspace:renameProject", async (_, args) => {
    await ensureDaemonRunning();
    return await daemonClient.renameProject(args).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }));
  });
  electron.ipcMain.handle("workspace:createProjectWorktree", async (_, args) => {
    await ensureDaemonRunning();
    return await daemonClient.createProjectWorktree(args).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }));
  });
  electron.ipcMain.handle("workspace:createFromFolder", async (_, folderPath) => {
    await ensureDaemonRunning();
    const workspace = await daemonClient.createWorkspaceFromFolder(folderPath);
    await ensureWorkspaceSideEffects(workspace);
    return workspace;
  });
  electron.ipcMain.handle("workspace:setActive", async (_, id) => {
    await ensureDaemonRunning();
    await daemonClient.setActiveWorkspace(id);
    const activeWorkspace = await daemonClient.getActiveWorkspace();
    await ensureWorkspaceSideEffects(activeWorkspace);
  });
  electron.ipcMain.handle("settings:get", async () => {
    await ensureDaemonRunning();
    return withDefaultSettings(await daemonClient.getSettings());
  });
  electron.ipcMain.handle("settings:set", async (_, settings) => {
    await ensureDaemonRunning();
    const next = withDefaultSettings(await daemonClient.setSettings(withDefaultSettings(settings)));
    await applySettingsSideEffects();
    return next;
  });
  electron.ipcMain.handle("settings:getRawJson", async () => {
    await ensureDaemonRunning();
    return await daemonClient.getRawSettingsJson();
  });
  electron.ipcMain.handle("settings:setRawJson", async (_, json) => {
    await ensureDaemonRunning();
    const result = await daemonClient.setRawSettingsJson(json);
    if (result.ok) {
      await applySettingsSideEffects();
    }
    if (result.ok && result.settings) {
      return { ...result, settings: withDefaultSettings(result.settings) };
    }
    return result;
  });
  electron.ipcMain.handle("settings:validateGenerationProvider", async (_, providerId, providerPatch) => {
    const settings = readSettingsSync();
    const provider = settings.generationProviders?.[providerId];
    if (!provider) {
      return {
        ok: false,
        providerId,
        message: `Provider "${providerId}" is not configured.`,
        models: [],
        imageModels: [],
        videoModels: []
      };
    }
    return validateGenerationProvider({ ...provider, ...providerPatch ?? {}, id: providerId });
  });
  electron.ipcMain.handle("workspace:delete", async (_, id) => {
    await ensureDaemonRunning();
    await daemonClient.deleteWorkspace(id);
  });
}
const watchers = /* @__PURE__ */ new Map();
const senderWatchPaths = /* @__PURE__ */ new WeakMap();
const senderWatchCleanupAttached = /* @__PURE__ */ new WeakSet();
function trackWatchSender(sender, resolvedPath) {
  const existing = senderWatchPaths.get(sender);
  if (existing) existing.add(resolvedPath);
  else senderWatchPaths.set(sender, /* @__PURE__ */ new Set([resolvedPath]));
  if (senderWatchCleanupAttached.has(sender)) return;
  senderWatchCleanupAttached.add(sender);
  sender.once("destroyed", () => {
    const watchedPaths = senderWatchPaths.get(sender);
    if (watchedPaths) {
      for (const watchedPath of watchedPaths) {
        const watcher = watchers.get(watchedPath);
        if (watcher) {
          watcher.close();
          watchers.delete(watchedPath);
        }
      }
    }
    senderWatchPaths.delete(sender);
    senderWatchCleanupAttached.delete(sender);
  });
}
const SENSITIVE_DIRS = [".ssh", ".gnupg", ".aws", ".config"];
function validateFsPath(filePath) {
  const resolved = path.resolve(resolveFsPath(filePath));
  const home = resolveHome();
  if (resolved.startsWith(CONTEX_HOME + path.sep) || resolved === CONTEX_HOME) return resolved;
  for (const dir of SENSITIVE_DIRS) {
    const sensitive = path.join(home, dir);
    if (resolved.startsWith(sensitive + path.sep) || resolved === sensitive) {
      throw new Error(`Access denied: path "${filePath}" targets a sensitive directory (~/${dir})`);
    }
  }
  if (resolved.includes(`${path.sep}..${path.sep}`) || resolved.endsWith(`${path.sep}..`)) {
    throw new Error(`Path "${filePath}" contains directory traversal`);
  }
  return resolved;
}
const resolveHome = () => electron.app.getPath("home") || process.env.HOME || process.env.USERPROFILE || os.homedir();
function resolveFsPath(rawPath) {
  const home = resolveHome();
  if (rawPath === "~") return home;
  if (rawPath.startsWith("~/.contex/")) {
    return path$1.join(CONTEX_HOME, rawPath.slice("~/.contex/".length));
  }
  if (rawPath.startsWith("~\\.contex\\")) {
    return path$1.join(CONTEX_HOME, rawPath.slice("~\\.contex\\".length));
  }
  if (rawPath.startsWith(`~/${CONTEX_HOME_DIRNAME}/`)) {
    return path$1.join(CONTEX_HOME, rawPath.slice(`~/${CONTEX_HOME_DIRNAME}/`.length));
  }
  if (rawPath.startsWith("~/") || rawPath.startsWith("~\\")) return path$1.join(home, rawPath.slice(2));
  if (rawPath.startsWith("/.contex/")) return path$1.join(CONTEX_HOME, rawPath.slice("/.contex/".length));
  if (rawPath === "/.contex") return CONTEX_HOME;
  if (rawPath.startsWith(`/${CONTEX_HOME_DIRNAME}/`)) return path$1.join(CONTEX_HOME, rawPath.slice(`/${CONTEX_HOME_DIRNAME}/`.length));
  if (rawPath === `/${CONTEX_HOME_DIRNAME}`) return CONTEX_HOME;
  return rawPath;
}
async function getUniqueCopyPath(destDir, sourcePath) {
  const resolvedDir = resolveFsPath(destDir);
  const parsed = path$1.parse(resolveFsPath(sourcePath));
  let attempt = 0;
  while (true) {
    const suffix = attempt === 0 ? "" : ` ${attempt + 1}`;
    const candidate = path$1.join(resolvedDir, `${parsed.name}${suffix}${parsed.ext}`);
    try {
      await fs.promises.access(candidate);
      attempt += 1;
    } catch {
      return candidate;
    }
  }
}
async function isProbablyTextFile(filePath) {
  const resolved = validateFsPath(filePath);
  const handle = await fs.promises.open(resolved, "r");
  try {
    const sampleSize = 8192;
    const buffer = Buffer.alloc(sampleSize);
    const { bytesRead } = await handle.read(buffer, 0, sampleSize, 0);
    if (bytesRead === 0) return true;
    let suspicious = 0;
    for (let i = 0; i < bytesRead; i += 1) {
      const byte = buffer[i];
      if (byte === 0) return false;
      const isAllowedControl = byte === 9 || byte === 10 || byte === 13 || byte === 12 || byte === 8;
      const isPrintableAscii = byte >= 32 && byte <= 126;
      const isExtended = byte >= 128;
      if (!isAllowedControl && !isPrintableAscii && !isExtended) suspicious += 1;
    }
    return suspicious / bytesRead < 0.1;
  } finally {
    await handle.close();
  }
}
function registerFsIPC() {
  electron.ipcMain.handle("fs:readDir", async (_, dirPath) => {
    try {
      const resolvedDirPath = validateFsPath(dirPath);
      const entries = await fs.promises.readdir(resolvedDirPath, { withFileTypes: true });
      const result = entries.map((e) => ({
        name: e.name,
        path: `${resolvedDirPath}/${e.name}`,
        isDir: e.isDirectory(),
        ext: e.isDirectory() ? "" : path$1.extname(e.name).toLowerCase()
      }));
      result.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return result;
    } catch {
      return [];
    }
  });
  electron.ipcMain.handle("fs:readFile", async (_, filePath) => {
    try {
      return await fs.promises.readFile(validateFsPath(filePath), "utf8");
    } catch (error) {
      const code = error.code;
      if (code === "ENOENT" || code === "EPERM" || code === "EACCES") {
        return "";
      }
      throw error;
    }
  });
  electron.ipcMain.handle("fs:writeFile", async (_, filePath, content) => {
    await fs.promises.writeFile(validateFsPath(filePath), content, "utf8");
  });
  electron.ipcMain.handle("fs:createFile", async (_, filePath) => {
    await fs.promises.writeFile(validateFsPath(filePath), "", "utf8");
  });
  electron.ipcMain.handle("fs:createDir", async (_, dirPath) => {
    await fs.promises.mkdir(validateFsPath(dirPath), { recursive: true });
  });
  electron.ipcMain.handle("fs:delete", async (_, fspath) => {
    await fs.promises.rm(validateFsPath(fspath), { recursive: true, force: true });
  });
  electron.ipcMain.handle("fs:deleteFile", async (_, fspath) => {
    await fs.promises.rm(validateFsPath(fspath), { recursive: true, force: true });
  });
  electron.ipcMain.handle("fs:rename", async (_, oldPath, newPath) => {
    await fs.promises.rename(validateFsPath(oldPath), validateFsPath(newPath));
  });
  electron.ipcMain.handle("fs:renameFile", async (_, oldPath, newPath) => {
    await fs.promises.rename(validateFsPath(oldPath), validateFsPath(newPath));
  });
  electron.ipcMain.handle("fs:basename", async (_, filePath) => {
    return path$1.basename(filePath);
  });
  electron.ipcMain.handle("fs:revealInFinder", async (_, filePath) => {
    electron.shell.showItemInFolder(validateFsPath(filePath));
  });
  electron.ipcMain.handle("fs:writeBrief", async (_, cardId, content) => {
    const { join: join2 } = await import("path");
    const briefDir = join2(CONTEX_HOME, "briefs");
    await fs.promises.mkdir(briefDir, { recursive: true });
    const briefPath = join2(briefDir, `${cardId}.md`);
    await fs.promises.writeFile(briefPath, content, "utf8");
    return briefPath;
  });
  electron.ipcMain.handle("fs:stat", async (_, filePath) => {
    try {
      const stats2 = await fs.promises.stat(validateFsPath(filePath));
      return {
        size: stats2.size,
        mtimeMs: stats2.mtimeMs,
        isFile: stats2.isFile(),
        isDir: stats2.isDirectory()
      };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  });
  electron.ipcMain.handle("fs:isProbablyTextFile", async (_, filePath) => {
    const stats2 = await fs.promises.stat(validateFsPath(filePath));
    if (!stats2.isFile()) return false;
    return isProbablyTextFile(filePath);
  });
  electron.ipcMain.handle("fs:copyIntoDir", async (_, sourcePath, destDir) => {
    const resolvedSource = validateFsPath(sourcePath);
    const resolvedDestDir = validateFsPath(destDir);
    await fs.promises.mkdir(resolvedDestDir, { recursive: true });
    const sourceStats = await fs.promises.stat(resolvedSource);
    if (!sourceStats.isFile()) throw new Error("Only files can be copied into a workspace");
    const directTarget = path$1.join(resolvedDestDir, path$1.basename(resolvedSource));
    const destPath = directTarget === resolvedSource ? resolvedSource : await getUniqueCopyPath(resolvedDestDir, resolvedSource);
    if (destPath !== resolvedSource) {
      await fs.promises.copyFile(resolvedSource, destPath);
    }
    return { path: destPath };
  });
  electron.ipcMain.handle("fs:watchStart", async (event, dirPath) => {
    const resolved = validateFsPath(dirPath);
    if (watchers.has(resolved)) return;
    let debounce = null;
    try {
      const watcher = fs.watch(resolved, { recursive: true }, () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          if (event.sender.isDestroyed()) return;
          const win = electron.BrowserWindow.fromWebContents(event.sender);
          win?.webContents.send(`fs:watch:${dirPath}`);
        }, 200);
      });
      watchers.set(resolved, watcher);
      trackWatchSender(event.sender, resolved);
    } catch {
    }
  });
  electron.ipcMain.handle("fs:watchStop", async (_, dirPath) => {
    const resolved = validateFsPath(dirPath);
    const watcher = watchers.get(resolved);
    if (watcher) {
      watcher.close();
      watchers.delete(resolved);
    }
  });
}
const LOG_PATH = path$1.join(CONTEX_HOME, "queued-messages.log.jsonl");
const LOG_MAX_BYTES = 512 * 1024;
async function ensureLogDir() {
  await fs.promises.mkdir(CONTEX_HOME, { recursive: true });
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function coerceEvent(raw) {
  if (!isPlainObject(raw)) return null;
  const type = raw.type;
  if (type !== "enqueue" && type !== "dispatch" && type !== "delete" && type !== "complete" && type !== "clear") return null;
  const workspaceId = typeof raw.workspaceId === "string" ? raw.workspaceId : "";
  const tileId = typeof raw.tileId === "string" ? raw.tileId : "";
  if (!workspaceId || !tileId) return null;
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : Date.now();
  const ev = { type, workspaceId, tileId, at };
  if (typeof raw.queueId === "string") ev.queueId = raw.queueId;
  if (typeof raw.content === "string") ev.content = raw.content;
  if (typeof raw.preview === "string") ev.preview = raw.preview;
  if (typeof raw.attachmentCount === "number") ev.attachmentCount = raw.attachmentCount;
  if (typeof raw.createdAt === "number") ev.createdAt = raw.createdAt;
  return ev;
}
let appendsSinceLastSizeCheck = 0;
async function appendQueuedMessageEvent(event) {
  try {
    await ensureLogDir();
    const line = JSON.stringify(event) + "\n";
    await fs.promises.appendFile(LOG_PATH, line, "utf8");
    appendsSinceLastSizeCheck += 1;
    if (appendsSinceLastSizeCheck >= 50) {
      appendsSinceLastSizeCheck = 0;
      try {
        const stat = await fs.promises.stat(LOG_PATH);
        if (stat.size > LOG_MAX_BYTES) {
          await compactQueuedMessagesLog();
        }
      } catch {
      }
    }
  } catch {
  }
}
async function listActiveQueuedMessages() {
  let raw;
  try {
    raw = await fs.promises.readFile(LOG_PATH, "utf8");
  } catch {
    return [];
  }
  const active = /* @__PURE__ */ new Map();
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const ev = coerceEvent(parsed);
    if (!ev) continue;
    if (ev.type === "clear") {
      for (const [key2, entry] of active) {
        if (entry.tileId === ev.tileId && entry.workspaceId === ev.workspaceId) {
          active.delete(key2);
        }
      }
      continue;
    }
    const keyId = ev.queueId;
    if (!keyId) continue;
    const key = `${ev.workspaceId}:${ev.tileId}:${keyId}`;
    if (ev.type === "enqueue") {
      active.set(key, {
        queueId: keyId,
        workspaceId: ev.workspaceId,
        tileId: ev.tileId,
        content: ev.content ?? "",
        preview: ev.preview ?? "",
        attachmentCount: ev.attachmentCount ?? 0,
        createdAt: ev.createdAt ?? ev.at,
        enqueuedAt: ev.at
      });
    } else {
      active.delete(key);
    }
  }
  return Array.from(active.values()).sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}
async function compactQueuedMessagesLog() {
  try {
    const active = await listActiveQueuedMessages();
    if (active.length === 0) {
      await fs.promises.writeFile(LOG_PATH, "", "utf8");
      return;
    }
    const lines = active.map((entry) => JSON.stringify({
      type: "enqueue",
      at: entry.enqueuedAt,
      workspaceId: entry.workspaceId,
      tileId: entry.tileId,
      queueId: entry.queueId,
      content: entry.content,
      preview: entry.preview,
      attachmentCount: entry.attachmentCount,
      createdAt: entry.createdAt
    }));
    await fs.promises.writeFile(LOG_PATH, lines.join("\n") + "\n", "utf8");
  } catch {
  }
}
function queuedMessagesLogPath() {
  return LOG_PATH;
}
async function deleteFileIfExists(path2) {
  try {
    await fs.promises.unlink(path2);
  } catch {
  }
}
function broadcastToRenderer(channel, payload) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
let relayHostActive = false;
function setRelayHostActive(value) {
  relayHostActive = value;
}
function isRelayHostActive() {
  return relayHostActive;
}
function encodeValue(value) {
  if (value === void 0) return "null";
  return JSON.stringify(value);
}
function decodeValue(raw) {
  const trimmed = raw.trim();
  if (trimmed === "null") return null;
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : trimmed;
}
function extractStructuredData(body) {
  const match = body.match(/\n```contex-data\n([\s\S]*?)\n```\s*$/);
  if (!match) return { body: body.trim() };
  try {
    return {
      body: body.slice(0, match.index).trim(),
      data: JSON.parse(match[1])
    };
  } catch {
    return { body: body.trim() };
  }
}
function renderRelayMessage(meta, body, data) {
  const lines = [
    "---",
    `protocol: ${encodeValue(meta.protocol)}`,
    `id: ${encodeValue(meta.id)}`,
    `threadId: ${encodeValue(meta.threadId)}`,
    `scope: ${encodeValue(meta.scope)}`,
    `kind: ${encodeValue(meta.kind)}`,
    `priority: ${encodeValue(meta.priority)}`,
    `from: ${encodeValue(meta.from)}`,
    `to: ${encodeValue(meta.to)}`,
    `channel: ${encodeValue(meta.channel)}`,
    `subject: ${encodeValue(meta.subject)}`,
    `status: ${encodeValue(meta.status)}`,
    `createdAt: ${encodeValue(meta.createdAt)}`,
    `createdTs: ${encodeValue(meta.createdTs)}`,
    `updatedAt: ${encodeValue(meta.updatedAt)}`,
    `updatedTs: ${encodeValue(meta.updatedTs)}`,
    `replyToId: ${encodeValue(meta.replyToId)}`,
    `bcc: ${encodeValue(meta.bcc)}`,
    "---",
    "",
    body.trim()
  ];
  if (data && Object.keys(data).length > 0) {
    lines.push("", "```contex-data", JSON.stringify(data, null, 2), "```");
  }
  lines.push("");
  return lines.join("\n");
}
function parseRelayMessage(content, mailbox, filename) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const values = /* @__PURE__ */ new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    values.set(line.slice(0, idx).trim(), decodeValue(line.slice(idx + 1)));
  }
  if (values.get("protocol") !== "contex-relay/v1") return null;
  const payload = extractStructuredData(match[2] ?? "");
  const meta = {
    protocol: "contex-relay/v1",
    id: String(values.get("id") ?? ""),
    threadId: String(values.get("threadId") ?? ""),
    scope: String(values.get("scope") ?? "direct"),
    kind: String(values.get("kind") ?? "request"),
    priority: String(values.get("priority") ?? "normal"),
    from: String(values.get("from") ?? ""),
    to: values.get("to") ? String(values.get("to")) : void 0,
    channel: values.get("channel") ? String(values.get("channel")) : void 0,
    subject: String(values.get("subject") ?? ""),
    status: String(values.get("status") ?? "unread"),
    createdAt: String(values.get("createdAt") ?? ""),
    createdTs: Number(values.get("createdTs") ?? 0),
    updatedAt: String(values.get("updatedAt") ?? values.get("createdAt") ?? ""),
    updatedTs: Number(values.get("updatedTs") ?? values.get("createdTs") ?? 0),
    replyToId: values.get("replyToId") ? String(values.get("replyToId")) : void 0,
    bcc: "central"
  };
  if (!meta.id || !meta.from) return null;
  return {
    mailbox,
    filename,
    meta,
    body: payload.body,
    data: payload.data
  };
}
const INVALID_ID_PATTERN = /\.\.|\/|\\|^\.|\0/;
function nowStamp() {
  const now = /* @__PURE__ */ new Date();
  return { iso: now.toISOString(), ts: now.getTime() };
}
function safeSlug(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "message";
}
function unique(items) {
  return Array.from(new Set(items));
}
function validateParticipantId(id) {
  if (!id || typeof id !== "string") throw new Error("Participant ID is required");
  if (INVALID_ID_PATTERN.test(id)) throw new Error(`Invalid participant ID: ${id}`);
  if (id.length > 128) throw new Error("Participant ID too long (max 128 chars)");
}
function validateChannelId(id) {
  if (!id || typeof id !== "string") throw new Error("Channel ID is required");
  if (INVALID_ID_PATTERN.test(id)) throw new Error(`Invalid channel ID: ${id}`);
  if (id.length > 128) throw new Error("Channel ID too long (max 128 chars)");
}
async function ensureDir$4(path2) {
  await node_fs.promises.mkdir(path2, { recursive: true });
}
async function readJson(path2, fallback) {
  try {
    return JSON.parse(await node_fs.promises.readFile(path2, "utf8"));
  } catch {
    return fallback;
  }
}
async function writeJson$1(path$12, value) {
  await ensureDir$4(path.join(path$12, ".."));
  await node_fs.promises.writeFile(path$12, JSON.stringify(value, null, 2));
}
async function readMessage(path2, mailbox, filename) {
  try {
    return parseRelayMessage(await node_fs.promises.readFile(path2, "utf8"), mailbox, filename);
  } catch {
    return null;
  }
}
class ContexRelay {
  workspacePath;
  paths;
  events = new node_events.EventEmitter();
  initialized = false;
  initializing = null;
  constructor(options) {
    this.workspacePath = options.workspacePath;
    this.paths = {
      root: path.join(this.workspacePath, ".contex", "relay"),
      participants: path.join(this.workspacePath, ".contex", "relay", "participants"),
      channels: path.join(this.workspacePath, ".contex", "relay", "channels"),
      archive: path.join(this.workspacePath, ".contex", "relay", "archive", "all"),
      relationships: path.join(this.workspacePath, ".contex", "relay", "relationships")
    };
  }
  async init() {
    if (this.initialized) return;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      await Promise.all([
        ensureDir$4(this.paths.participants),
        ensureDir$4(this.paths.channels),
        ensureDir$4(this.paths.archive),
        ensureDir$4(this.paths.relationships)
      ]);
      const systemFile = this.participantFile("system");
      const existing = await readJson(systemFile, null);
      if (!existing) {
        const stamp = nowStamp();
        const systemParticipant = {
          id: "system",
          name: "System",
          kind: "system",
          status: "ready",
          channels: [],
          readyAt: stamp.iso,
          readyTs: stamp.ts,
          metadata: {}
        };
        await Promise.all([
          ensureDir$4(this.participantMailboxDir("system", "inbox")),
          ensureDir$4(this.participantMailboxDir("system", "sent")),
          ensureDir$4(this.participantMailboxDir("system", "memory")),
          ensureDir$4(this.participantMailboxDir("system", "bin")),
          ensureDir$4(path.join(this.participantDir("system"), "cursors"))
        ]);
        await writeJson$1(systemFile, systemParticipant);
      }
      this.initialized = true;
      this.initializing = null;
    })();
    return this.initializing;
  }
  on(listener) {
    this.events.on("event", listener);
    return () => this.events.off("event", listener);
  }
  emit(type, payload) {
    this.events.emit("event", { type, timestamp: Date.now(), payload });
  }
  participantDir(id) {
    validateParticipantId(id);
    return path.join(this.paths.participants, id);
  }
  participantFile(id) {
    return path.join(this.participantDir(id), "participant.json");
  }
  participantMailboxDir(id, mailbox) {
    return path.join(this.participantDir(id), "mailboxes", mailbox);
  }
  participantCursorFile(id, channel) {
    return path.join(this.participantDir(id), "cursors", `${channel}.json`);
  }
  channelDir(id) {
    validateChannelId(id);
    return path.join(this.paths.channels, id);
  }
  channelFile(id) {
    return path.join(this.channelDir(id), "channel.json");
  }
  channelMessagesDir(id) {
    return path.join(this.channelDir(id), "messages");
  }
  tileMailboxDir(tileId, mailbox) {
    return path.join(this.workspacePath, ".contex", tileId, "messages", mailbox);
  }
  async listParticipants() {
    await this.init();
    try {
      const entries = await node_fs.promises.readdir(this.paths.participants);
      const participants = await Promise.all(entries.map((id) => readJson(this.participantFile(id), null)));
      return participants.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }
  async getParticipant(id) {
    await this.init();
    return readJson(this.participantFile(id), null);
  }
  async upsertParticipant(input) {
    validateParticipantId(input.id);
    await this.init();
    const existing = await this.getParticipant(input.id);
    const participant = {
      id: input.id,
      name: input.name,
      kind: input.kind,
      status: input.status,
      task: input.task ?? existing?.task,
      tileId: input.tileId ?? existing?.tileId,
      provider: input.provider ?? existing?.provider,
      model: input.model ?? existing?.model,
      channels: unique(input.channels ?? existing?.channels ?? []),
      readyAt: input.readyAt ?? existing?.readyAt,
      readyTs: input.readyTs ?? existing?.readyTs,
      startedAt: input.startedAt ?? existing?.startedAt,
      startedTs: input.startedTs ?? existing?.startedTs,
      stoppedAt: input.stoppedAt ?? existing?.stoppedAt,
      stoppedTs: input.stoppedTs ?? existing?.stoppedTs,
      work: input.work ?? existing?.work,
      metadata: { ...existing?.metadata ?? {}, ...input.metadata ?? {} }
    };
    await Promise.all([
      ensureDir$4(this.participantMailboxDir(participant.id, "inbox")),
      ensureDir$4(this.participantMailboxDir(participant.id, "sent")),
      ensureDir$4(this.participantMailboxDir(participant.id, "memory")),
      ensureDir$4(this.participantMailboxDir(participant.id, "bin")),
      ensureDir$4(path.join(this.participantDir(participant.id), "cursors"))
    ]);
    await writeJson$1(this.participantFile(participant.id), participant);
    for (const channel of participant.channels) {
      await this.joinChannel(channel, participant.id);
    }
    this.emit("participant_upserted", { participant });
    if (participant.status === "ready") {
      this.emit("ready", { participantId: participant.id });
    }
    await this.writeRelationshipsSnapshot();
    return participant;
  }
  async setParticipantStatus(participantId, status2) {
    const participant = await this.getParticipant(participantId);
    if (!participant) throw new Error(`Unknown participant: ${participantId}`);
    const stamp = nowStamp();
    const next = {
      ...participant,
      status: status2,
      readyAt: status2 === "ready" && !participant.readyAt ? stamp.iso : participant.readyAt,
      readyTs: status2 === "ready" && !participant.readyTs ? stamp.ts : participant.readyTs,
      startedAt: status2 === "running" && !participant.startedAt ? stamp.iso : participant.startedAt,
      startedTs: status2 === "running" && !participant.startedTs ? stamp.ts : participant.startedTs,
      stoppedAt: ["done", "stopped", "error"].includes(status2) ? stamp.iso : participant.stoppedAt,
      stoppedTs: ["done", "stopped", "error"].includes(status2) ? stamp.ts : participant.stoppedTs
    };
    await this.upsertParticipant(next);
    this.emit("participant_status", { participantId, status: status2 });
    return next;
  }
  async updateWorkContext(participantId, work) {
    const participant = await this.getParticipant(participantId);
    if (!participant) throw new Error(`Unknown participant: ${participantId}`);
    const stamp = nowStamp();
    return this.upsertParticipant({
      ...participant,
      status: participant.status,
      work: {
        ...participant.work,
        ...work,
        files: unique(work.files ?? participant.work?.files ?? []),
        topics: unique(work.topics ?? participant.work?.topics ?? []),
        collaborators: unique(work.collaborators ?? participant.work?.collaborators ?? []),
        blockers: unique(work.blockers ?? participant.work?.blockers ?? []),
        impacts: work.impacts ?? participant.work?.impacts ?? [],
        updatedAt: stamp.iso,
        updatedTs: stamp.ts
      }
    });
  }
  async listChannels() {
    await this.init();
    try {
      const entries = await node_fs.promises.readdir(this.paths.channels);
      const channels = await Promise.all(entries.map((id) => readJson(this.channelFile(id), null)));
      return channels.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }
  async getChannel(id) {
    await this.init();
    return readJson(this.channelFile(id), null);
  }
  async upsertChannel(input) {
    await this.init();
    const existing = await this.getChannel(input.id);
    const stamp = nowStamp();
    const channel = {
      id: input.id,
      name: input.name,
      description: input.description ?? existing?.description,
      members: unique(input.members ?? existing?.members ?? []),
      bridges: input.bridges ?? existing?.bridges ?? [],
      metadata: { ...existing?.metadata ?? {}, ...input.metadata ?? {} },
      createdAt: existing?.createdAt ?? stamp.iso,
      createdTs: existing?.createdTs ?? stamp.ts,
      updatedAt: stamp.iso,
      updatedTs: stamp.ts
    };
    await ensureDir$4(this.channelMessagesDir(channel.id));
    await writeJson$1(this.channelFile(channel.id), channel);
    return channel;
  }
  async joinChannel(channelId, participantId) {
    const channel = await this.upsertChannel({ id: channelId, name: channelId });
    if (!channel.members.includes(participantId)) {
      const next = await this.upsertChannel({ ...channel, members: [...channel.members, participantId] });
      return next;
    }
    return channel;
  }
  async leaveChannel(channelId, participantId) {
    const channel = await this.getChannel(channelId);
    if (!channel) return null;
    return this.upsertChannel({ ...channel, members: channel.members.filter((member) => member !== participantId) });
  }
  async writeMessageCopies(options) {
    const content = renderRelayMessage(options.meta, options.body, options.data);
    if (options.meta.scope === "direct" || options.meta.scope === "system") {
      await Promise.all([
        ensureDir$4(this.participantMailboxDir(options.meta.from, "sent")),
        node_fs.promises.writeFile(path.join(this.participantMailboxDir(options.meta.from, "sent"), options.filename), content),
        options.sender?.tileId ? ensureDir$4(this.tileMailboxDir(options.sender.tileId, "sent")).then(() => node_fs.promises.writeFile(path.join(this.tileMailboxDir(options.sender.tileId, "sent"), options.filename), content)) : Promise.resolve()
      ]);
      if (options.meta.to) {
        const inboxMeta = { ...options.meta, status: "unread" };
        const inboxContent = renderRelayMessage(inboxMeta, options.body, options.data);
        await Promise.all([
          ensureDir$4(this.participantMailboxDir(options.meta.to, "inbox")),
          node_fs.promises.writeFile(path.join(this.participantMailboxDir(options.meta.to, "inbox"), options.filename), inboxContent),
          options.recipient?.tileId ? ensureDir$4(this.tileMailboxDir(options.recipient.tileId, "inbox")).then(() => node_fs.promises.writeFile(path.join(this.tileMailboxDir(options.recipient.tileId, "inbox"), options.filename), inboxContent)) : Promise.resolve()
        ]);
      }
    }
    if (options.meta.scope === "channel" && options.channelId) {
      await ensureDir$4(this.channelMessagesDir(options.channelId));
      await node_fs.promises.writeFile(path.join(this.channelMessagesDir(options.channelId), options.filename), content);
    }
    await ensureDir$4(this.paths.archive);
    await node_fs.promises.writeFile(path.join(this.paths.archive, options.filename), content);
    return {
      mailbox: options.meta.scope === "channel" ? "channel" : "sent",
      filename: options.filename,
      meta: options.meta,
      body: options.body,
      data: options.data
    };
  }
  async sendDirectMessage(from, draft) {
    await this.init();
    const sender = await this.getParticipant(from);
    const recipient = await this.getParticipant(draft.to);
    if (!sender) throw new Error(`Unknown sender: ${from}`);
    if (!recipient) throw new Error(`Unknown recipient: ${draft.to}`);
    const stamp = nowStamp();
    const id = node_crypto.randomUUID();
    const filename = `${stamp.iso.replace(/[:.]/g, "-")}-${safeSlug(draft.subject)}.md`;
    const meta = {
      protocol: "contex-relay/v1",
      id,
      threadId: draft.threadId ?? id,
      scope: from === "system" ? "system" : "direct",
      kind: draft.kind ?? "request",
      priority: draft.priority ?? "normal",
      from,
      to: draft.to,
      subject: draft.subject,
      status: "sent",
      createdAt: stamp.iso,
      createdTs: stamp.ts,
      updatedAt: stamp.iso,
      updatedTs: stamp.ts,
      replyToId: draft.replyToId,
      bcc: "central"
    };
    const message = await this.writeMessageCopies({
      filename,
      meta,
      body: draft.body,
      data: draft.data,
      sender,
      recipient
    });
    this.emit("direct_message", { from, to: draft.to, message });
    this.emit("central_message", { message: { ...message, mailbox: "central" } });
    return message;
  }
  async sendChannelMessage(from, draft) {
    await this.init();
    const sender = await this.getParticipant(from);
    if (!sender) throw new Error(`Unknown sender: ${from}`);
    const channel = await this.joinChannel(draft.channel, from);
    const stamp = nowStamp();
    const id = node_crypto.randomUUID();
    const filename = `${stamp.iso.replace(/[:.]/g, "-")}-${safeSlug(draft.subject)}.md`;
    const meta = {
      protocol: "contex-relay/v1",
      id,
      threadId: draft.threadId ?? id,
      scope: "channel",
      kind: draft.kind ?? "channel",
      priority: draft.priority ?? "normal",
      from,
      channel: channel.id,
      subject: draft.subject,
      status: "sent",
      createdAt: stamp.iso,
      createdTs: stamp.ts,
      updatedAt: stamp.iso,
      updatedTs: stamp.ts,
      replyToId: draft.replyToId,
      bcc: "central"
    };
    const message = await this.writeMessageCopies({
      filename,
      meta,
      body: draft.body,
      data: draft.data,
      sender,
      channelId: channel.id
    });
    this.emit("channel_message", { from, channel: channel.id, message });
    this.emit("central_message", { message: { ...message, mailbox: "central" } });
    return message;
  }
  async storeMemory(participantId, subject, body, data) {
    const participant = await this.getParticipant(participantId);
    if (!participant) throw new Error(`Unknown participant: ${participantId}`);
    const stamp = nowStamp();
    const id = node_crypto.randomUUID();
    const filename = `${stamp.iso.replace(/[:.]/g, "-")}-${safeSlug(subject)}.md`;
    const meta = {
      protocol: "contex-relay/v1",
      id,
      threadId: id,
      scope: "system",
      kind: "memory",
      priority: "normal",
      from: participantId,
      to: participantId,
      subject,
      status: "archived",
      createdAt: stamp.iso,
      createdTs: stamp.ts,
      updatedAt: stamp.iso,
      updatedTs: stamp.ts,
      bcc: "central"
    };
    const content = renderRelayMessage(meta, body, data);
    await Promise.all([
      ensureDir$4(this.participantMailboxDir(participantId, "memory")),
      node_fs.promises.writeFile(path.join(this.participantMailboxDir(participantId, "memory"), filename), content),
      participant.tileId ? ensureDir$4(this.tileMailboxDir(participant.tileId, "memory")).then(() => node_fs.promises.writeFile(path.join(this.tileMailboxDir(participant.tileId, "memory"), filename), content)) : Promise.resolve(),
      node_fs.promises.writeFile(path.join(this.paths.archive, filename), content)
    ]);
    return { mailbox: "memory", filename, meta, body, data };
  }
  async listMessages(participantId, mailbox, limit) {
    const dir = this.participantMailboxDir(participantId, mailbox);
    try {
      const files = (await node_fs.promises.readdir(dir)).filter((name) => name.endsWith(".md")).sort().reverse();
      const selected = limit ? files.slice(0, limit) : files;
      const messages = await Promise.all(selected.map(async (filename) => {
        const message = await readMessage(path.join(dir, filename), mailbox, filename);
        return message ? { mailbox, filename, meta: message.meta } : null;
      }));
      return messages.filter(Boolean);
    } catch {
      return [];
    }
  }
  async readParticipantMessage(participantId, mailbox, filename) {
    return readMessage(path.join(this.participantMailboxDir(participantId, mailbox), filename), mailbox, filename);
  }
  async updateMessageStatus(participantId, mailbox, filename, status2) {
    const existing = await this.readParticipantMessage(participantId, mailbox, filename);
    if (!existing) return false;
    const stamp = nowStamp();
    const next = {
      ...existing,
      meta: {
        ...existing.meta,
        status: status2,
        updatedAt: stamp.iso,
        updatedTs: stamp.ts
      }
    };
    const content = renderRelayMessage(next.meta, next.body, next.data);
    await node_fs.promises.writeFile(path.join(this.participantMailboxDir(participantId, mailbox), filename), content);
    const participant = await this.getParticipant(participantId);
    if (participant?.tileId) {
      await ensureDir$4(this.tileMailboxDir(participant.tileId, mailbox));
      await node_fs.promises.writeFile(path.join(this.tileMailboxDir(participant.tileId, mailbox), filename), content);
    }
    return true;
  }
  async listChannelMessages(channelId, limit) {
    try {
      const files = (await node_fs.promises.readdir(this.channelMessagesDir(channelId))).filter((name) => name.endsWith(".md")).sort().reverse();
      const selected = limit ? files.slice(0, limit) : files;
      const messages = await Promise.all(selected.map(async (filename) => {
        const message = await readMessage(path.join(this.channelMessagesDir(channelId), filename), "channel", filename);
        return message ? { mailbox: "channel", filename, meta: message.meta } : null;
      }));
      return messages.filter(Boolean);
    } catch {
      return [];
    }
  }
  async readChannelMessage(channelId, filename) {
    return readMessage(path.join(this.channelMessagesDir(channelId), filename), "channel", filename);
  }
  async listCentralFeed(limit) {
    try {
      const files = (await node_fs.promises.readdir(this.paths.archive)).filter((name) => name.endsWith(".md")).sort().reverse();
      const selected = limit ? files.slice(0, limit) : files;
      const messages = await Promise.all(selected.map(async (filename) => {
        const message = await readMessage(path.join(this.paths.archive, filename), "central", filename);
        return message ? { mailbox: "central", filename, meta: message.meta } : null;
      }));
      return messages.filter(Boolean);
    } catch {
      return [];
    }
  }
  async listUnreadDirectMessages(participantId) {
    const items = await this.listMessages(participantId, "inbox");
    const unread = items.filter((item) => item.meta.status === "unread");
    const messages = await Promise.all(unread.map((item) => this.readParticipantMessage(participantId, "inbox", item.filename)));
    return messages.filter(Boolean);
  }
  async listUnreadChannelMessages(participantId) {
    const participant = await this.getParticipant(participantId);
    if (!participant) return [];
    const all = [];
    for (const channel of participant.channels) {
      const cursor = await readJson(this.participantCursorFile(participantId, channel), { lastReadTs: 0 });
      const items = await this.listChannelMessages(channel);
      const fresh = items.filter((item) => item.meta.createdTs > cursor.lastReadTs && item.meta.from !== participantId);
      const messages = await Promise.all(fresh.map((item) => this.readChannelMessage(channel, item.filename)));
      all.push(...messages.filter(Boolean));
    }
    return all.sort((a, b) => a.meta.createdTs - b.meta.createdTs);
  }
  async markDirectMessagesRead(participantId, messages) {
    await Promise.all(messages.map((message) => this.updateMessageStatus(participantId, "inbox", message.filename, "read")));
  }
  async advanceChannelCursor(participantId, channelId, timestamp) {
    await writeJson$1(this.participantCursorFile(participantId, channelId), { lastReadTs: timestamp });
  }
  async analyzeRelationships() {
    const participants = (await this.listParticipants()).filter((participant) => participant.id !== "system");
    const hints = [];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const a = participants[i];
        const b = participants[j];
        const sharedChannels = a.channels.filter((channel) => b.channels.includes(channel));
        const overlappingFiles = (a.work?.files ?? []).filter((file) => (b.work?.files ?? []).includes(file));
        const sameBranch = !!a.work?.branch && a.work?.branch === b.work?.branch;
        const sameWorktree = !!a.work?.worktreePath && a.work?.worktreePath === b.work?.worktreePath;
        const impacts = [
          ...(a.work?.impacts ?? []).filter((impact) => impact.targetType === "agent" && impact.targetId === b.id),
          ...(b.work?.impacts ?? []).filter((impact) => impact.targetType === "agent" && impact.targetId === a.id)
        ];
        if (!sharedChannels.length && !overlappingFiles.length && !sameBranch && !sameWorktree && !impacts.length) continue;
        const parts = [];
        if (sharedChannels.length) parts.push(`share channels ${sharedChannels.join(", ")}`);
        if (overlappingFiles.length) parts.push(`touch the same files (${overlappingFiles.slice(0, 5).join(", ")})`);
        if (sameBranch) parts.push(`are on the same branch ${a.work?.branch}`);
        if (sameWorktree) parts.push("share the same worktree");
        if (impacts.length) parts.push(`have explicit impact alerts (${impacts.map((impact) => impact.description).join("; ")})`);
        const priority = impacts.some((impact) => impact.severity === "high") || overlappingFiles.length > 2 ? "critical" : sameBranch || sameWorktree || overlappingFiles.length > 0 ? "high" : "normal";
        hints.push({
          participants: [a.id, b.id],
          sameBranch,
          sameWorktree,
          sharedChannels,
          overlappingFiles,
          impacts,
          priority,
          summary: `${a.name} and ${b.name} ${parts.join(", ")}`
        });
      }
    }
    const order = { critical: 0, high: 1, normal: 2, low: 3 };
    return hints.sort((a, b) => order[a.priority] - order[b.priority] || a.summary.localeCompare(b.summary));
  }
  async writeRelationshipsSnapshot() {
    const hints = await this.analyzeRelationships();
    await writeJson$1(path.join(this.paths.relationships, "latest.json"), { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), hints });
  }
  async waitForReady(ids, options = {}) {
    const timeoutMs = options.timeoutMs ?? 6e4;
    const pending = new Set(ids);
    const current = await this.listParticipants();
    current.filter((participant) => participant.status === "ready").forEach((participant) => pending.delete(participant.id));
    if (pending.size === 0) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for ready: ${Array.from(pending).join(", ")}`));
      }, timeoutMs);
      const listener = (event) => {
        if (event.type !== "ready") return;
        pending.delete(event.payload.participantId);
        if (pending.size === 0) {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        }
      };
      const unsubscribe = this.on(listener);
    });
  }
  async waitForAny(ids, options = {}) {
    const timeoutMs = options.timeoutMs ?? 5 * 6e4;
    const doneStates = /* @__PURE__ */ new Set(["done", "error", "stopped"]);
    const current = await this.listParticipants();
    const immediate = current.find((participant) => ids.includes(participant.id) && doneStates.has(participant.status));
    if (immediate) return immediate;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for any of: ${ids.join(", ")}`));
      }, timeoutMs);
      const listener = async (event) => {
        if (event.type !== "participant_status") return;
        const payload = event.payload;
        if (!ids.includes(payload.participantId)) return;
        if (!doneStates.has(payload.status)) return;
        clearTimeout(timer);
        unsubscribe();
        const participant = await this.getParticipant(payload.participantId);
        if (!participant) return reject(new Error(`Participant disappeared: ${payload.participantId}`));
        resolve(participant);
      };
      const unsubscribe = this.on(listener);
    });
  }
  async moveMessage(participantId, fromMailbox, toMailbox, filename) {
    try {
      await ensureDir$4(this.participantMailboxDir(participantId, toMailbox));
      await node_fs.promises.rename(
        path.join(this.participantMailboxDir(participantId, fromMailbox), filename),
        path.join(this.participantMailboxDir(participantId, toMailbox), path.basename(filename))
      );
      const participant = await this.getParticipant(participantId);
      if (participant?.tileId) {
        await ensureDir$4(this.tileMailboxDir(participant.tileId, toMailbox));
        await node_fs.promises.rename(
          path.join(this.tileMailboxDir(participant.tileId, fromMailbox), filename),
          path.join(this.tileMailboxDir(participant.tileId, toMailbox), path.basename(filename))
        ).catch(() => void 0);
      }
      return true;
    } catch {
      return false;
    }
  }
}
class RelayTimeoutError extends Error {
  constructor(participantId, timeoutMs) {
    super(`Agent ${participantId} turn timed out after ${timeoutMs}ms`);
    this.name = "RelayTimeoutError";
  }
}
function extractJsonBlock(raw) {
  const fenced = raw.match(/```json\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1);
  return raw;
}
function sanitizeForPrompt(text, maxLength = 4e3) {
  return text.replace(/```/g, "\\`\\`\\`").replace(/<\|/g, "\\<\\|").replace(/\|>/g, "\\|\\>").slice(0, maxLength);
}
function sanitizeMessageForPrompt(msg) {
  return {
    meta: msg.meta,
    body: sanitizeForPrompt(msg.body),
    data: msg.data
  };
}
function parseTurnOutput(raw) {
  const json = extractJsonBlock(raw);
  return JSON.parse(json);
}
function buildPrompt(input, task) {
  const relationships = input.relationships.map((item) => ({
    with: item.participants.find((id) => id !== input.participant.id),
    priority: item.priority,
    summary: item.summary,
    overlappingFiles: item.overlappingFiles,
    sharedChannels: item.sharedChannels
  }));
  return [
    `You are ${input.participant.name} in the Contex relay runtime.`,
    `Your persistent task: ${task}`,
    "",
    "You are coordinating work, surfacing dependencies, and telling others when your work could affect them.",
    "Messaging priority is NOT tied to spatial/canvas connections.",
    "",
    "Return JSON only with this schema:",
    "{",
    '  "ready": true,',
    '  "status": "ready|running|blocked|done|error",',
    '  "work": {',
    '    "summary": "what you are currently doing",',
    '    "branch": "optional git branch",',
    '    "worktreePath": "optional worktree path",',
    '    "files": ["optional file paths"],',
    '    "topics": ["optional topics"],',
    '    "collaborators": ["optional participant ids"],',
    '    "blockers": ["optional blockers"],',
    '    "impacts": [{"targetType":"agent|human|system","targetId":"optional","description":"impact","severity":"low|medium|high"}]',
    "  },",
    '  "messages": [',
    '    {"mode":"direct","to":"participantId","subject":"subject","body":"markdown body","priority":"low|normal|high|critical","kind":"request|reply|update|handoff|alert|memory|channel|system"},',
    '    {"mode":"channel","channel":"channelId","subject":"subject","body":"markdown body","priority":"low|normal|high|critical","kind":"channel|update|alert"}',
    "  ],",
    '  "memory": [{"subject":"short title","body":"markdown note"}]',
    "}",
    "",
    "Rules:",
    "- only send a message when there is a real coordination need",
    "- always mention branch/worktree/files if overlap or impact matters",
    "- if your work could affect a human or another agent, record it in work.impacts and usually send a message",
    "- use channels for shared-room updates, direct messages for targeted coordination",
    "- if nothing needs sending, return an empty messages array",
    "",
    "Current participant state:",
    JSON.stringify(input.participant, null, 2),
    "",
    "Unread direct messages:",
    "<<<BEGIN MESSAGES>>>",
    JSON.stringify(input.unreadDirectMessages.map(sanitizeMessageForPrompt), null, 2),
    "<<<END MESSAGES>>>",
    "",
    "Unread channel messages:",
    "<<<BEGIN MESSAGES>>>",
    JSON.stringify(input.unreadChannelMessages.map(sanitizeMessageForPrompt), null, 2),
    "<<<END MESSAGES>>>",
    "",
    "Relationship hints:",
    JSON.stringify(relationships, null, 2)
  ].join("\n");
}
class RelayRuntime {
  relay;
  options;
  agents = /* @__PURE__ */ new Map();
  unsubscribe;
  constructor(relay, options) {
    this.relay = relay;
    this.options = options;
    this.unsubscribe = this.relay.on((event) => {
      void this.onRelayEvent(event);
    });
  }
  destroy() {
    this.unsubscribe();
    this.agents.clear();
  }
  async spawn(request) {
    const id = request.id ?? request.tileId ?? request.name;
    const participant = await this.relay.upsertParticipant({
      id,
      name: request.name,
      kind: "agent",
      status: "spawning",
      tileId: request.tileId,
      provider: request.provider ?? "unknown",
      model: request.model,
      task: request.task,
      channels: request.channels ?? [],
      metadata: {
        ...request.metadata ?? {},
        relayMode: request.mode,
        relayThinking: request.thinking
      }
    });
    const executor = this.options.executorFactory(participant, { ...request, id });
    this.agents.set(id, {
      spawn: { ...request, id },
      running: true,
      busy: false,
      ready: false,
      executor
    });
    await this.relay.sendDirectMessage("system", {
      to: id,
      subject: "Initial task",
      body: request.task,
      kind: "system",
      priority: "high",
      data: {
        relaySpawn: true,
        channels: request.channels ?? [],
        provider: request.provider,
        model: request.model
      }
    });
    await this.schedule(id);
    return participant;
  }
  async stop(participantId) {
    const state = this.agents.get(participantId);
    if (!state) return;
    state.running = false;
    await this.relay.setParticipantStatus(participantId, "stopped");
  }
  async start(participantId) {
    const state = this.agents.get(participantId);
    if (!state) return;
    state.running = true;
    await this.schedule(participantId);
  }
  async schedule(participantId) {
    const state = this.agents.get(participantId);
    if (!state || !state.running || state.busy) return;
    state.busy = true;
    try {
      await this.runAgentTickWithErrorHandling(participantId, state);
    } finally {
      state.busy = false;
    }
  }
  async tick(participantId, state) {
    const participant = await this.relay.getParticipant(participantId);
    if (!participant) return;
    const unreadDirectMessages = await this.relay.listUnreadDirectMessages(participantId);
    const unreadChannelMessages = await this.relay.listUnreadChannelMessages(participantId);
    if (unreadDirectMessages.length === 0 && unreadChannelMessages.length === 0 && state.ready) return;
    const relationships = (await this.relay.analyzeRelationships()).filter((hint) => hint.participants.includes(participantId));
    const prompt = buildPrompt({
      participant,
      prompt: "",
      unreadDirectMessages,
      unreadChannelMessages,
      relationships
    }, state.spawn.task);
    const input = {
      participant,
      prompt,
      unreadDirectMessages,
      unreadChannelMessages,
      relationships
    };
    await this.relay.setParticipantStatus(participantId, state.ready ? "running" : "spawning");
    const turnTimeoutMs = this.options.turnTimeoutMs ?? 3e5;
    const raw = await this.runTurnWithTimeout(participantId, state, input, turnTimeoutMs);
    const output = parseTurnOutput(raw);
    if (output.work) {
      await this.relay.updateWorkContext(participantId, output.work);
    }
    if (!state.ready && (output.ready ?? true)) {
      state.ready = true;
      await this.relay.setParticipantStatus(participantId, output.status ?? "ready");
    } else if (output.status) {
      await this.relay.setParticipantStatus(participantId, output.status);
    }
    for (const message of output.messages ?? []) {
      if (message.mode === "direct") {
        const draft = {
          to: message.to,
          subject: message.subject,
          body: message.body,
          kind: message.kind,
          priority: message.priority,
          threadId: message.threadId,
          replyToId: message.replyToId,
          data: message.data
        };
        await this.relay.sendDirectMessage(participantId, draft);
      } else {
        const draft = {
          channel: message.channel,
          subject: message.subject,
          body: message.body,
          kind: message.kind,
          priority: message.priority,
          threadId: message.threadId,
          replyToId: message.replyToId,
          data: message.data
        };
        await this.relay.sendChannelMessage(participantId, draft);
      }
    }
    for (const memory of output.memory ?? []) {
      await this.relay.storeMemory(participantId, memory.subject, memory.body, memory.data);
    }
    if (unreadDirectMessages.length > 0) {
      await this.relay.markDirectMessagesRead(participantId, unreadDirectMessages);
    }
    if (unreadChannelMessages.length > 0) {
      const latestByChannel = /* @__PURE__ */ new Map();
      for (const message of unreadChannelMessages) {
        if (!message.meta.channel) continue;
        latestByChannel.set(message.meta.channel, Math.max(latestByChannel.get(message.meta.channel) ?? 0, message.meta.createdTs));
      }
      for (const [channel, timestamp] of latestByChannel) {
        await this.relay.advanceChannelCursor(participantId, channel, timestamp);
      }
    }
  }
  async onRelayEvent(event) {
    if (event.type === "direct_message") {
      const target = event.payload.to;
      if (this.agents.has(target)) await this.schedule(target);
      return;
    }
    if (event.type === "channel_message") {
      const channel = event.payload.channel;
      const participants = await this.relay.listParticipants();
      await Promise.all(participants.filter((participant) => participant.channels.includes(channel)).map((participant) => this.schedule(participant.id)));
    }
  }
  async runTurnWithTimeout(participantId, state, input, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new RelayTimeoutError(participantId, timeoutMs));
      }, timeoutMs);
      state.executor.runTurn(input).then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
  async runAgentTickWithErrorHandling(participantId, state) {
    try {
      await this.tick(participantId, state);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.relay.events.emit("event", {
        type: "error",
        timestamp: Date.now(),
        payload: { participantId, error: errorMessage }
      });
      await this.relay.setParticipantStatus(participantId, "error");
      state.running = false;
    }
  }
}
const PATHS_FILE = path$1.join(CONTEX_HOME, "agent-paths.json");
const AGENT_KEYS = ["claude", "codex", "opencode", "openclaw", "hermes", "cursor-agent", "gemini", "cline", "amp", "kilo"];
let cachedPaths = null;
function resolveShellPath() {
  const isWin2 = process.platform === "win32";
  if (!isWin2) {
    try {
      const shell = process.env.SHELL || "/bin/zsh";
      return child_process.execFileSync(shell, ["-ilc", 'echo -n "$PATH"'], {
        timeout: 5e3,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      }).trim();
    } catch {
    }
  }
  if (isWin2) {
    if (process.env.PATH) return process.env.PATH;
    const home = os.homedir();
    return [
      path$1.join(home, "AppData", "Roaming", "npm"),
      path$1.join(home, ".bun", "bin"),
      path$1.join(home, "go", "bin"),
      path$1.join(home, ".cargo", "bin"),
      "C:\\Program Files\\nodejs"
    ].join(";");
  }
  return [
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
    `${os.homedir()}/.bun/bin`,
    `${os.homedir()}/.npm-global/bin`,
    `${os.homedir()}/.local/bin`,
    `${os.homedir()}/.nvm/versions/node`,
    `${os.homedir()}/go/bin`,
    `${os.homedir()}/.yarn/bin`
  ].join(":");
}
let _shellPath = null;
function getShellPath() {
  if (!_shellPath) _shellPath = resolveShellPath();
  return _shellPath;
}
function whichSync(cmd) {
  try {
    const prog = process.platform === "win32" ? "where.exe" : "which";
    const result = child_process.execFileSync(prog, [cmd], {
      timeout: 3e3,
      encoding: "utf8",
      env: { ...process.env, PATH: getShellPath() },
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    if (!result || result.includes("not found") || result.includes("Could not find")) return null;
    const lines = result.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    if (process.platform === "win32") {
      const exeMatch = lines.find((line) => /\.exe$/i.test(line));
      if (exeMatch) return exeMatch;
    }
    return lines[0] || null;
  } catch {
    return null;
  }
}
async function isExecutable(filePath) {
  const mode = process.platform === "win32" ? fs.promises.constants.F_OK : fs.promises.constants.X_OK;
  try {
    await fs.promises.access(filePath, mode);
    return true;
  } catch {
  }
  if (process.platform === "win32" && !/\.\w+$/.test(filePath)) {
    for (const ext of [".exe", ".cmd", ".bat", ".ps1"]) {
      try {
        await fs.promises.access(filePath + ext, fs.promises.constants.F_OK);
        return true;
      } catch {
      }
    }
  }
  return false;
}
async function resolveExecutablePath(filePath) {
  if (process.platform === "win32") {
    const hasExt = /\.\w+$/i.test(filePath);
    if (hasExt) {
      if (!/\.exe$/i.test(filePath)) return null;
      try {
        await fs.promises.access(filePath);
        return filePath;
      } catch {
        return null;
      }
    }
    const candidate = filePath + ".exe";
    try {
      await fs.promises.access(candidate);
      return candidate;
    } catch {
      return null;
    }
  }
  try {
    await fs.promises.access(filePath);
    return filePath;
  } catch {
  }
  return null;
}
async function findInNvm(cmd) {
  const nvmBase = path$1.join(os.homedir(), ".nvm", "versions", "node");
  try {
    const versions = await fs.promises.readdir(nvmBase);
    versions.sort((a, b) => b.localeCompare(a, void 0, { numeric: true }));
    for (const ver of versions) {
      const binPath = path$1.join(nvmBase, ver, "bin", cmd);
      if (await isExecutable(binPath)) return binPath;
    }
  } catch {
  }
  return null;
}
function getVersionSync(binPath) {
  try {
    const out = child_process.execFileSync(binPath, ["--version"], {
      timeout: 5e3,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    const match = out.match(/[\d]+\.[\d]+[\d.]*/);
    return match ? match[0] : out.trim().split("\n")[0]?.substring(0, 40) || null;
  } catch {
    return null;
  }
}
const isWin = process.platform === "win32";
function buildFallbackPaths(cmd, extras = []) {
  const home = os.homedir();
  if (isWin) {
    return [
      path$1.join(home, "AppData", "Roaming", "npm", `${cmd}.exe`),
      path$1.join(home, ".bun", "bin", `${cmd}.exe`),
      path$1.join(home, ".local", "bin", `${cmd}.exe`),
      path$1.join(home, "go", "bin", `${cmd}.exe`),
      path$1.join(home, ".cargo", "bin", `${cmd}.exe`),
      ...extras
    ];
  }
  return [
    `/usr/local/bin/${cmd}`,
    `/opt/homebrew/bin/${cmd}`,
    `${home}/.bun/bin/${cmd}`,
    `${home}/.npm-global/bin/${cmd}`,
    `${home}/.local/bin/${cmd}`,
    `${home}/.yarn/bin/${cmd}`,
    ...extras
  ];
}
const FALLBACK_PATHS = {
  claude: buildFallbackPaths("claude"),
  codex: buildFallbackPaths("codex"),
  opencode: buildFallbackPaths("opencode", isWin ? [] : [`${os.homedir()}/go/bin/opencode`]),
  openclaw: buildFallbackPaths("openclaw", isWin ? [] : [`${os.homedir()}/.cargo/bin/openclaw`]),
  hermes: buildFallbackPaths("hermes", [
    ...isWin ? [] : [`${os.homedir()}/.hermes/bin/hermes`],
    path$1.join(os.homedir(), "Documents", "GitHub", "hermes-agent", isWin ? "hermes.exe" : "hermes")
  ]),
  "cursor-agent": buildFallbackPaths("cursor-agent"),
  gemini: buildFallbackPaths("gemini"),
  cline: buildFallbackPaths("cline"),
  amp: buildFallbackPaths("amp"),
  kilo: buildFallbackPaths("kilo")
};
async function detectBinary(agentId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const found = whichSync(agentId);
  if (found) {
    const version = getVersionSync(found);
    return { path: found, version, detectedAt: now, confirmed: false };
  }
  const nvmPath = await findInNvm(agentId);
  if (nvmPath) {
    const version = getVersionSync(nvmPath);
    return { path: nvmPath, version, detectedAt: now, confirmed: false };
  }
  for (const p of FALLBACK_PATHS[agentId] ?? []) {
    const resolved = await resolveExecutablePath(p);
    if (resolved) {
      const version = getVersionSync(resolved);
      return { path: resolved, version, detectedAt: now, confirmed: false };
    }
  }
  return { path: null, version: null, detectedAt: now, confirmed: false };
}
async function loadSavedPaths() {
  try {
    const raw = await fs.promises.readFile(PATHS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function initializeAgentPathsCache() {
  if (cachedPaths) return cachedPaths;
  const saved = await loadSavedPaths();
  if (!saved) return null;
  let mutated = false;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const key of AGENT_KEYS) {
    if (!saved[key]) {
      saved[key] = { path: null, version: null, detectedAt: now, confirmed: false };
      mutated = true;
    }
  }
  for (const key of AGENT_KEYS) {
    const entry = saved[key];
    if (!entry?.path) continue;
    const resolved = await resolveExecutablePath(entry.path);
    let best = resolved && resolved !== entry.path ? resolved : null;
    if (process.platform === "win32" && !resolved) {
      const fromWhich = whichSync(key);
      if (fromWhich && /\.exe$/i.test(fromWhich)) best = fromWhich;
    }
    if (best && best !== entry.path) {
      entry.path = best;
      mutated = true;
    }
  }
  cachedPaths = saved;
  if (mutated) await savePaths(saved).catch(() => {
  });
  return cachedPaths;
}
async function savePaths(config) {
  await fs.promises.mkdir(CONTEX_HOME, { recursive: true });
  await fs.promises.writeFile(PATHS_FILE, JSON.stringify(config, null, 2));
  cachedPaths = config;
}
async function detectAllAgents() {
  console.log("[AgentPaths] Detecting agent binaries...");
  const shellPath = getShellPath();
  const detectedPairs = await Promise.all(AGENT_KEYS.map(async (key) => [key, await detectBinary(key)]));
  const detected = Object.fromEntries(detectedPairs);
  const saved = await loadSavedPaths();
  const merge = (detectedEntry, savedEntry) => {
    if (savedEntry?.confirmed && savedEntry.path) {
      return { ...detectedEntry, path: savedEntry.path, confirmed: true };
    }
    return detectedEntry;
  };
  const config = {
    shellPath,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  for (const key of AGENT_KEYS) {
    config[key] = merge(detected[key], saved?.[key]);
  }
  for (const key of AGENT_KEYS) {
    const entry = config[key];
    if (entry.path && entry.confirmed) {
      const resolved = await resolveExecutablePath(entry.path);
      if (!resolved) {
        console.log(`[AgentPaths] Previously confirmed ${key} at ${entry.path} no longer exists, re-detecting`);
        config[key] = await detectBinary(key);
      } else if (resolved !== entry.path) {
        entry.path = resolved;
      }
    }
  }
  await savePaths(config);
  const found = AGENT_KEYS.map((key) => config[key].path ? `${key}=${config[key].path}` : null).filter(Boolean).join(", ");
  console.log(`[AgentPaths] Detection complete: ${found || "none found"}`);
  return config;
}
function getAgentPath(agentId) {
  return cachedPaths?.[agentId]?.path ?? null;
}
function getShellEnvPath() {
  return cachedPaths?.shellPath ?? null;
}
function getAgentPathsConfig() {
  return cachedPaths;
}
function registerAgentPathsIPC() {
  electron.ipcMain.handle("agentPaths:get", () => cachedPaths);
  electron.ipcMain.handle("agentPaths:detect", async () => detectAllAgents());
  electron.ipcMain.handle("agentPaths:set", async (_, agentId, inputPath) => {
    if (!cachedPaths) return null;
    if (!AGENT_KEYS.includes(agentId)) return null;
    const key = agentId;
    let resolvedPath = null;
    let version = null;
    if (inputPath) {
      const normalized = inputPath.replace(/\//g, process.platform === "win32" ? "\\" : "/");
      resolvedPath = await resolveExecutablePath(normalized);
      if (!resolvedPath) {
        return { error: `Not found: ${inputPath}` };
      }
      version = getVersionSync(resolvedPath);
    }
    cachedPaths[key] = {
      path: resolvedPath,
      version,
      detectedAt: (/* @__PURE__ */ new Date()).toISOString(),
      confirmed: true
    };
    cachedPaths.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await savePaths(cachedPaths);
    return cachedPaths;
  });
  electron.ipcMain.handle("agentPaths:needsSetup", () => {
    if (!cachedPaths) return true;
    return AGENT_KEYS.every((key) => !cachedPaths?.[key]?.confirmed);
  });
  electron.ipcMain.handle("agentPaths:confirmAll", async () => {
    if (!cachedPaths) return null;
    for (const key of AGENT_KEYS) {
      cachedPaths[key].confirmed = true;
    }
    cachedPaths.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await savePaths(cachedPaths);
    return cachedPaths;
  });
}
function pushFlag(args, flag, value) {
  if (value === null || value === void 0) return;
  const str = String(value);
  if (!str) return;
  args.push(flag, str);
}
const HERMES_MODEL_PROVIDER_PREFIXES = {
  "anthropic": "anthropic",
  "arcee": "arcee",
  "arcee-ai": "arcee",
  "copilot": "copilot",
  "copilot-acp": "copilot-acp",
  "gemini": "gemini",
  "google": "gemini",
  "huggingface": "huggingface",
  "kimi-coding": "kimi-coding",
  "kimi-coding-cn": "kimi-coding-cn",
  "kilocode": "kilocode",
  "minimax": "minimax",
  "minimax-cn": "minimax-cn",
  "nous": "nous",
  "nvidia": "nvidia",
  "ollama-cloud": "ollama-cloud",
  "openai": "openai",
  "openai-codex": "openai-codex",
  "openrouter": "openrouter",
  "stepfun": "stepfun",
  "x-ai": "xai",
  "xai": "xai",
  "xiaomi": "xiaomi",
  "z-ai": "zai",
  "zai": "zai"
};
function resolveHermesModelSelection(model, provider) {
  const rawModel = String(model ?? "").trim();
  const explicitProvider = String(provider ?? "").trim();
  if (!rawModel) return { model: null, provider: explicitProvider || null };
  if (explicitProvider) return { model: rawModel, provider: explicitProvider };
  const slashIndex = rawModel.indexOf("/");
  if (slashIndex <= 0) return { model: rawModel, provider: null };
  const prefix = rawModel.slice(0, slashIndex).trim().toLowerCase();
  const remainder = rawModel.slice(slashIndex + 1).trim();
  const inferredProvider = HERMES_MODEL_PROVIDER_PREFIXES[prefix];
  if (!inferredProvider || !remainder) return { model: rawModel, provider: null };
  return { model: remainder, provider: inferredProvider };
}
function parseJsonLines(stdout) {
  const parsed = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      parsed.push(JSON.parse(trimmed));
    } catch {
    }
  }
  return parsed;
}
function extractSessionId(value) {
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value.sessionId,
    value.session_id,
    value.sessionID,
    value.session_id,
    value.id,
    value.result?.sessionId,
    value.result?.session_id,
    value.result?.sessionID
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}
function extractContentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (!part || typeof part !== "object") return "";
    const record = part;
    return typeof record.text === "string" ? record.text : typeof record.content === "string" ? record.content : "";
  }).filter(Boolean).join("");
}
function buildHermesChatArgs(request) {
  const outputFlag = request.streamJson ? "--stream-json" : "--quiet";
  const args = ["chat", "--query", request.prompt, outputFlag, "--source", "tool"];
  const selection = resolveHermesModelSelection(request.model, request.provider);
  pushFlag(args, "--model", selection.model);
  pushFlag(args, "--provider", selection.provider);
  const toolsets = Array.isArray(request.toolsets) ? request.toolsets.filter(Boolean).join(",") : request.toolsets;
  pushFlag(args, "--toolsets", toolsets);
  pushFlag(args, "--resume", request.resumeSessionId);
  if (request.ignoreRules) args.push("--ignore-rules");
  if (request.ignoreUserConfig) args.push("--ignore-user-config");
  if (request.bypassPermissions) args.push("--yolo");
  return args;
}
function parseHermesOutput(stdout) {
  let sessionId = null;
  const visibleLines = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:session_id|session)\s*:\s*(\S+)\s*$/i);
    if (match) {
      sessionId ??= match[1];
      continue;
    }
    visibleLines.push(line);
  }
  return {
    text: visibleLines.join("\n").trim(),
    sessionId
  };
}
function parseHermesStreamJsonOutput(stdout) {
  const raw = [];
  const textParts = [];
  let sessionId = null;
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let evt;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      textParts.push(line);
      continue;
    }
    raw.push(evt);
    if (!evt || typeof evt !== "object") continue;
    if (typeof evt.type !== "string") continue;
    switch (evt.type) {
      case "text":
        if (typeof evt.text === "string") textParts.push(evt.text);
        break;
      case "session":
        if (typeof evt.sessionId === "string" && evt.sessionId.trim()) {
          sessionId = evt.sessionId.trim();
        }
        break;
      default:
        break;
    }
  }
  return {
    text: textParts.join("").trim(),
    sessionId,
    raw
  };
}
function buildOpenClawAgentArgs(request) {
  const args = ["agent", "--json"];
  if (request.sessionId) {
    args.push("--session-id", request.sessionId);
  } else {
    args.push("--agent", request.agentId || "main");
  }
  args.push("--message", request.prompt);
  pushFlag(args, "--thinking", request.thinking);
  pushFlag(args, "--timeout", request.timeoutSeconds);
  if (request.local) args.push("--local");
  return args;
}
function extractOpenClawTextPayload$1(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.content === "string") return payload.content;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.summary === "string") return payload.summary;
  if (Array.isArray(payload.parts)) {
    return payload.parts.map((part) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("");
  }
  return "";
}
function parseOpenClawOutput(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    const payloads = Array.isArray(parsed?.payloads) ? parsed.payloads : Array.isArray(parsed?.result?.payloads) ? parsed.result.payloads : [];
    const text = payloads.map((payload) => extractOpenClawTextPayload$1(payload)).filter(Boolean).join("\n\n") || parsed?.summary || parsed?.result?.summary || parsed?.message || "";
    return {
      text: String(text).trim(),
      sessionId: extractSessionId(parsed),
      raw: [parsed]
    };
  } catch {
    return { text: stdout.trim(), sessionId: null };
  }
}
function buildOpenCodeRunArgs(request) {
  const args = ["run", "--format", "json"];
  pushFlag(args, "--model", request.model);
  pushFlag(args, "--agent", request.agent);
  pushFlag(args, "--session", request.sessionId);
  if (request.continueSession) args.push("--continue");
  pushFlag(args, "--dir", request.cwd);
  pushFlag(args, "--attach", request.attachUrl);
  pushFlag(args, "--variant", request.variant);
  if (request.thinking) args.push("--thinking");
  if (request.bypassPermissions) args.push("--dangerously-skip-permissions");
  args.push(request.prompt);
  return args;
}
function parseOpenCodeRunOutput(stdout) {
  const raw = parseJsonLines(stdout);
  if (raw.length === 0) return { text: stdout.trim(), sessionId: null };
  const textParts = [];
  let sessionId = null;
  for (const event of raw) {
    const value = event;
    sessionId ??= extractSessionId(value);
    if (!value || typeof value !== "object") continue;
    if (typeof value.result === "string") textParts.push(value.result);
    if (typeof value.text === "string" && (value.role === "assistant" || value.type === "assistant")) textParts.push(value.text);
    if (typeof value.message === "string" && (value.role === "assistant" || value.type === "assistant")) textParts.push(value.message);
    if (value.type === "message" && value.role === "assistant") {
      textParts.push(extractContentText(value.content));
    } else if (value.role === "assistant") {
      textParts.push(extractContentText(value.content));
    }
    if (value.type === "assistant") textParts.push(extractContentText(value.message?.content ?? value.content));
  }
  return {
    text: textParts.filter(Boolean).join("").trim(),
    sessionId,
    raw
  };
}
function buildCursorAgentPrintArgs(request) {
  const args = ["--print", "--output-format", "stream-json"];
  if (request.streamPartialOutput) args.push("--stream-partial-output");
  pushFlag(args, "--workspace", request.cwd);
  pushFlag(args, "--model", request.model);
  pushFlag(args, "--resume", request.resumeChatId);
  if (request.continuePrevious) args.push("--continue");
  pushFlag(args, "--mode", request.mode);
  if (request.trustWorkspace) args.push("--trust");
  if (request.bypassPermissions) args.push("--force");
  args.push(request.prompt);
  return { command: "cursor-agent", args };
}
function buildGeminiPromptArgs(request) {
  const args = ["--prompt", request.prompt];
  pushFlag(args, "--output-format", request.outputFormat ?? "stream-json");
  pushFlag(args, "--model", request.model);
  pushFlag(args, "--resume", request.resumeSessionId);
  pushFlag(args, "--approval-mode", request.approvalMode);
  if (request.sandbox) args.push("--sandbox");
  for (const dir of request.includeDirectories ?? []) pushFlag(args, "--include-directories", dir);
  if (request.yolo) args.push("--yolo");
  if (request.rawOutput) args.push("--raw-output", "--accept-raw-output-risk");
  return args;
}
function buildClineTaskArgs(request) {
  const args = ["task"];
  if (request.json !== false) args.push("--json");
  pushFlag(args, "--cwd", request.cwd);
  pushFlag(args, "--model", request.model);
  if (request.mode === "plan") args.push("--plan");
  if (request.mode === "act") args.push("--act");
  pushFlag(args, "--taskId", request.taskId);
  if (request.continueLatest) args.push("--continue");
  pushFlag(args, "--timeout", request.timeoutSeconds);
  if (request.bypassPermissions) args.push("--yolo");
  args.push(request.prompt);
  return args;
}
function buildAmpExecuteArgs(request) {
  const args = [];
  args.push(request.useIdeContext ? "--ide" : "--no-ide");
  pushFlag(args, "--mode", request.mode);
  args.push("--execute", request.prompt);
  if (request.streamJson !== false) args.push("--stream-json");
  if (request.bypassPermissions) args.push("--dangerously-allow-all");
  pushFlag(args, "--mcp-config", request.mcpConfig);
  for (const label of request.labels ?? []) pushFlag(args, "--label", label);
  return args;
}
function buildAmpContinueArgs(request) {
  const args = ["threads", "continue"];
  if (request.threadIdOrUrl) args.push(request.threadIdOrUrl);
  if (request.last) args.push("--last");
  args.push(request.useIdeContext ? "--ide" : "--no-ide");
  pushFlag(args, "--mode", request.mode);
  return args;
}
function buildKiloRunArgs(request) {
  return ["run", request.prompt];
}
function sanitizeAgentCliDiagnostic(message) {
  const secretName = String.raw`[A-Z0-9_./-]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_./-]*`;
  const quotedOrBareValue = String.raw`(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s\r\n]+)`;
  return message.replace(new RegExp(`\\b(${secretName})\\s*=\\s*${quotedOrBareValue}`, "gi"), "$1=[REDACTED]").replace(/\b(authorization\s*:\s*(?:bearer|token)\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s\r\n]+)/gi, "$1[REDACTED]").replace(/\b(api\s*key|api[_-]?key|token|secret|password)\s*:\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s\r\n]+)/gi, "$1: [REDACTED]");
}
const PERMISSIONS_PATH = path$1.join(CONTEX_HOME, "permissions.json");
const PERMISSIONS_VERSION = 1;
const sessionGrants = /* @__PURE__ */ new Map();
function ensureDir$3(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}
function atomicWriteJson(filePath, value) {
  ensureDir$3(path$1.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
  fs.renameSync(tempPath, filePath);
}
function normalizeWorkspaceDir(workspaceDir) {
  const trimmed = String(workspaceDir ?? "").trim();
  if (!trimmed) return null;
  try {
    return path$1.resolve(trimmed);
  } catch {
    return trimmed;
  }
}
function normalizeStore(raw) {
  const grants = Array.isArray(raw?.grants) ? raw.grants.filter((grant) => {
    return Boolean(
      grant && typeof grant.id === "string" && grant.id && typeof grant.provider === "string" && grant.provider && typeof grant.toolName === "string" && grant.toolName && (grant.action === "allow" || grant.action === "deny") && (grant.scope === "session" || grant.scope === "today" || grant.scope === "forever" || grant.scope === "never") && typeof grant.createdAt === "string"
    );
  }) : [];
  return {
    version: PERMISSIONS_VERSION,
    grants
  };
}
function readPersistedStore() {
  try {
    return normalizeStore(JSON.parse(fs.readFileSync(PERMISSIONS_PATH, "utf8")));
  } catch {
    return { version: PERMISSIONS_VERSION, grants: [] };
  }
}
function writePersistedStore(store) {
  atomicWriteJson(PERMISSIONS_PATH, store);
}
function isGrantExpired(grant) {
  if (!grant.expiresAt) return false;
  const expiry = Date.parse(grant.expiresAt);
  return Number.isFinite(expiry) && expiry <= Date.now();
}
function pruneExpiredPersistedGrants(store) {
  const next = {
    ...store,
    grants: store.grants.filter((grant) => !isGrantExpired(grant))
  };
  if (next.grants.length !== store.grants.length) {
    writePersistedStore(next);
  }
  return next;
}
function purgeExpiredSessionGrants() {
  for (const [key, grant] of sessionGrants.entries()) {
    if (isGrantExpired(grant)) sessionGrants.delete(key);
  }
}
function makeGrantId() {
  return `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function endOfTodayIso() {
  const end = /* @__PURE__ */ new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}
function sameGrantTarget(grant, request) {
  if (grant.provider !== request.provider) return false;
  if (grant.toolName !== request.toolName) return false;
  const requestedWorkspace = normalizeWorkspaceDir(request.workspaceDir);
  return (grant.workspaceDir ?? null) === requestedWorkspace;
}
function grantAppliesToRequest(grant, request) {
  if (grant.provider !== request.provider) return false;
  if (grant.toolName !== request.toolName) return false;
  const grantWorkspace = normalizeWorkspaceDir(grant.workspaceDir);
  if (grantWorkspace === null) return true;
  return grantWorkspace === normalizeWorkspaceDir(request.workspaceDir);
}
function buildGrant(request, scope) {
  const action = scope === "never" ? "deny" : "allow";
  return {
    id: makeGrantId(),
    provider: request.provider,
    toolName: request.toolName,
    action,
    scope,
    workspaceDir: normalizeWorkspaceDir(request.workspaceDir),
    title: request.title ?? null,
    description: request.description ?? null,
    blockedPath: request.blockedPath ?? null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: scope === "today" ? endOfTodayIso() : null
  };
}
function persistGrant(request, scope) {
  const store = pruneExpiredPersistedGrants(readPersistedStore());
  const nextGrant = buildGrant(request, scope);
  const filtered = store.grants.filter((grant) => !sameGrantTarget(grant, request));
  const nextStore = { ...store, grants: [nextGrant, ...filtered] };
  writePersistedStore(nextStore);
  return nextGrant;
}
function storeSessionGrant(request) {
  const nextGrant = buildGrant(request, "session");
  const key = `${nextGrant.provider}::${nextGrant.toolName}::${nextGrant.workspaceDir ?? ""}`;
  sessionGrants.set(key, nextGrant);
  return nextGrant;
}
function listPermissionGrants() {
  purgeExpiredSessionGrants();
  const persisted = pruneExpiredPersistedGrants(readPersistedStore()).grants;
  const session = Array.from(sessionGrants.values());
  return [...session, ...persisted].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
function clearPermissionGrant(id) {
  for (const [key, grant] of sessionGrants.entries()) {
    if (grant.id === id) {
      sessionGrants.delete(key);
    }
  }
  const store = readPersistedStore();
  const nextStore = {
    ...store,
    grants: store.grants.filter((grant) => grant.id !== id)
  };
  if (nextStore.grants.length !== store.grants.length) {
    writePersistedStore(nextStore);
  }
  return listPermissionGrants();
}
function clearAllPermissionGrants() {
  sessionGrants.clear();
  writePersistedStore({ version: PERMISSIONS_VERSION, grants: [] });
  return [];
}
function resolveStoredPermission(request) {
  purgeExpiredSessionGrants();
  const persisted = pruneExpiredPersistedGrants(readPersistedStore()).grants;
  const grant = [...sessionGrants.values(), ...persisted].find((candidate) => grantAppliesToRequest(candidate, request));
  if (!grant) return null;
  return grant.action;
}
function hasStoredAllow(request) {
  return resolveStoredPermission(request) === "allow";
}
async function promptForPermission(request) {
  const detailLines = [
    request.description?.trim() || "",
    request.blockedPath ? `Path: ${request.blockedPath}` : "",
    normalizeWorkspaceDir(request.workspaceDir) ? `Workspace: ${normalizeWorkspaceDir(request.workspaceDir)}` : ""
  ].filter(Boolean);
  const win = electron.BrowserWindow.getFocusedWindow() ?? electron.BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed()) ?? null;
  const dialogOptions = {
    type: "question",
    // Order is significant — `response` index is used below. "Never" sits
    // next to "Deny" since both are negative decisions; the rest are
    // scopes of positive approval.
    buttons: ["Deny", "Never", "Allow Once", "This Session", "All Day", "Always"],
    defaultId: 2,
    cancelId: 0,
    noLink: true,
    title: "Tool Permission",
    message: request.title?.trim() || `${request.provider} wants to run ${request.toolName}`,
    detail: detailLines.join("\n")
  };
  const { response } = win ? await electron.dialog.showMessageBox(win, dialogOptions) : await electron.dialog.showMessageBox(dialogOptions);
  switch (response) {
    case 1:
      return "never";
    case 2:
      return "once";
    case 3:
      return "session";
    case 4:
      return "today";
    case 5:
      return "forever";
    default:
      return "deny";
  }
}
async function requestToolPermissionDetailed(request, interactive) {
  const stored = resolveStoredPermission(request);
  if (stored === "allow") return { allowed: true, fromStored: true };
  if (stored === "deny") return { allowed: false, fromStored: true };
  if (!interactive) return { allowed: false };
  const decision = await promptForPermission(request);
  if (decision === "deny") return { allowed: false, scope: void 0 };
  if (decision === "never") {
    persistGrant(request, "never");
    return { allowed: false, scope: "never" };
  }
  if (decision === "session") {
    storeSessionGrant(request);
  } else if (decision === "today" || decision === "forever") {
    persistGrant(request, decision);
  }
  return { allowed: true, scope: decision };
}
async function requestToolPermission(request, interactive) {
  return (await requestToolPermissionDetailed(request, interactive)).allowed;
}
function getPermissionsStorePath() {
  if (!fs.existsSync(path$1.dirname(PERMISSIONS_PATH))) ensureDir$3(path$1.dirname(PERMISSIONS_PATH));
  return PERMISSIONS_PATH;
}
const DAEMON_AUTOREAD_PREFIXES = [
  path$1.resolve(CONTEX_HOME, "chat-attachments") + path$1.sep,
  path$1.resolve(CONTEX_HOME, "chat-vision") + path$1.sep,
  // Legacy compat: the pre-fix build wrote sketches under
  // os.tmpdir()/contex-chat-attach. Keep this in the allowlist until all
  // dist-electron bundles in the wild have been rebuilt with the fix that
  // moved sketches into CONTEX_HOME.
  path$1.resolve(os.tmpdir(), "contex-chat-attach") + path$1.sep
];
function isDaemonAutoReadablePath(filePath) {
  if (typeof filePath !== "string" || filePath.length === 0) return false;
  let resolved;
  try {
    resolved = path$1.resolve(filePath);
  } catch {
    return false;
  }
  return DAEMON_AUTOREAD_PREFIXES.some((prefix) => resolved.startsWith(prefix));
}
const claudeSessions = /* @__PURE__ */ new Map();
const hermesSessions = /* @__PURE__ */ new Map();
const openClawSessions = /* @__PURE__ */ new Map();
const openCodeSessions = /* @__PURE__ */ new Map();
const OPENCLAW_AGENT_LIST_TIMEOUT_MS = 15e3;
function workspaceDirFromSpawnRequest(spawnRequest) {
  return typeof spawnRequest.metadata?.workspaceDir === "string" ? spawnRequest.metadata.workspaceDir : typeof spawnRequest.metadata?.projectPath === "string" ? spawnRequest.metadata.projectPath : typeof spawnRequest.metadata?.cwd === "string" ? spawnRequest.metadata.cwd : null;
}
function modeForClaude(mode) {
  const modeMap = {
    default: "default",
    acceptEdits: "acceptEdits",
    plan: "plan",
    bypassPermissions: "bypassPermissions"
  };
  return modeMap[mode ?? "plan"] ?? "plan";
}
function thinkingForClaude(thinking) {
  const thinkingMap = {
    adaptive: { type: "adaptive" },
    none: { type: "disabled" },
    low: { type: "enabled", budget_tokens: 2048 },
    medium: { type: "enabled", budget_tokens: 8192 },
    high: { type: "enabled", budget_tokens: 32768 },
    max: { type: "enabled", budget_tokens: 131072 }
  };
  return thinkingMap[thinking ?? "adaptive"] ?? { type: "adaptive" };
}
async function runClaudeTurn(participantId, spawnRequest, input, timeoutMs = 3e5) {
  const claudePermissionMode = modeForClaude(spawnRequest.mode);
  const workspaceDir = workspaceDirFromSpawnRequest(spawnRequest);
  const options = {
    model: spawnRequest.model ?? "claude-sonnet-4-6",
    permissionMode: claudePermissionMode,
    thinking: thinkingForClaude(spawnRequest.thinking),
    persistSession: true,
    includePartialMessages: false,
    ...claudePermissionMode === "bypassPermissions" ? { allowDangerouslySkipPermissions: true } : {},
    ...claudePermissionMode !== "bypassPermissions" ? {
      // Background relay has no UI, so we can only consult the persisted
      // permission store — any tool without a standing allow-grant is
      // rejected. A `never` (persistent deny) grant now produces a
      // distinct, clearer message so the user knows why calls keep
      // failing and where to clear it.
      canUseTool: async (toolName, input2, toolOptions) => {
        if (toolName === "Read" && typeof input2?.file_path === "string" && isDaemonAutoReadablePath(input2.file_path)) {
          return { behavior: "allow", toolUseID: toolOptions?.toolUseID };
        }
        const decision = resolveStoredPermission({
          provider: "claude",
          toolName,
          title: typeof toolOptions?.title === "string" ? toolOptions.title : null,
          description: typeof toolOptions?.description === "string" ? toolOptions.description : null,
          blockedPath: typeof toolOptions?.blockedPath === "string" ? toolOptions.blockedPath : null,
          workspaceDir
        });
        if (decision === "allow") {
          return { behavior: "allow", toolUseID: toolOptions?.toolUseID };
        }
        if (decision === "deny") {
          return {
            behavior: "deny",
            message: `Permission for ${toolName} is set to Never. Clear it in Settings → Permissions to re-enable prompts.`,
            toolUseID: toolOptions?.toolUseID
          };
        }
        return {
          behavior: "deny",
          message: `Permission required for ${toolName}. Save a session, all-day, or all-time grant from an interactive chat before using this relay agent.`,
          toolUseID: toolOptions?.toolUseID
        };
      }
    } : {}
  };
  const existingSessionId = claudeSessions.get(participantId);
  if (existingSessionId) {
    options.resume = existingSessionId;
  }
  const claudePath = getAgentPath("claude");
  if (claudePath) {
    ;
    options.pathToClaudeCodeExecutable = claudePath;
  }
  const q = claudeAgentSdk.query({ prompt: input.prompt, options });
  let text = "";
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Claude turn timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  const queryPromise = (async () => {
    for await (const msg of q) {
      const sid = msg.session_id;
      if (sid) claudeSessions.set(participantId, sid);
      if (msg.type === "assistant") {
        const blocks = msg.message?.content ?? [];
        const blockText = blocks.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("");
        if (blockText) text += blockText;
      }
      if (msg.type === "result") {
        const result = msg.result;
        if (typeof result === "string" && result.trim()) return result;
      }
    }
    return text;
  })();
  return Promise.race([queryPromise, timeoutPromise]);
}
async function runCodexTurn(spawnRequest, input, timeoutMs = 3e5) {
  const codexBin = getAgentPath("codex") || "codex";
  const shellPath = getShellEnvPath();
  const workspaceDir = workspaceDirFromSpawnRequest(spawnRequest);
  const mode = spawnRequest.mode ?? "default";
  const modeArgs = mode === "bypassPermissions" || mode === "full-access" ? ["--dangerously-bypass-approvals-and-sandbox"] : mode === "auto" || mode === "full-auto" ? ["--full-auto"] : mode === "read-only" || mode === "plan" ? ["--sandbox", "read-only"] : ["--sandbox", "workspace-write"];
  return await new Promise((resolve, reject) => {
    const proc = child_process.spawn(codexBin, [
      "exec",
      "--model",
      spawnRequest.model ?? "gpt-5.3-codex",
      ...modeArgs,
      "--skip-git-repo-check",
      ...workspaceDir ? ["-C", workspaceDir] : [],
      input.prompt
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...shellPath && { PATH: shellPath } }
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error(`Codex turn timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0) {
        reject(new Error(sanitizeAgentCliDiagnostic(stderr.trim() || `Codex exited with ${code}`)));
        return;
      }
      resolve(stdout.trim());
    });
  });
}
async function runOpenCodeTurn(participantId, spawnRequest, input, timeoutMs = 3e5) {
  const opencodeBin = getAgentPath("opencode") || "opencode";
  const shellPath = getShellEnvPath();
  const workspaceDir = workspaceDirFromSpawnRequest(spawnRequest);
  const existingSessionId = openCodeSessions.get(participantId) ?? null;
  const agent = typeof spawnRequest.metadata?.agent === "string" ? spawnRequest.metadata.agent : typeof spawnRequest.metadata?.agentName === "string" ? spawnRequest.metadata.agentName : null;
  return await new Promise((resolve, reject) => {
    const args = buildOpenCodeRunArgs({
      prompt: input.prompt,
      model: spawnRequest.model,
      agent,
      sessionId: existingSessionId,
      cwd: workspaceDir,
      bypassPermissions: spawnRequest.mode === "bypassPermissions"
    });
    const proc = child_process.spawn(opencodeBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...shellPath && { PATH: shellPath } }
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error(`OpenCode turn timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0) {
        reject(new Error(sanitizeAgentCliDiagnostic(stderr.trim() || stdout.trim() || `OpenCode exited with ${code}`)));
        return;
      }
      const parsed = parseOpenCodeRunOutput(stdout);
      if (parsed.sessionId) openCodeSessions.set(participantId, parsed.sessionId);
      resolve(parsed.text || stdout.trim());
    });
  });
}
function normalizeOpenClawModelRef(model) {
  return (model ?? "").trim().toLowerCase();
}
function parseOpenClawAgents$1(openclawBin, shellPath) {
  try {
    const raw = child_process.execFileSync(openclawBin, ["agents", "list", "--json"], {
      encoding: "utf-8",
      env: { ...process.env, ...shellPath && { PATH: shellPath } },
      timeout: OPENCLAW_AGENT_LIST_TIMEOUT_MS,
      windowsHide: true
    }).trim();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function selectOpenClawAgentId$1(openclawBin, shellPath, preferredModel) {
  const agents = parseOpenClawAgents$1(openclawBin, shellPath);
  if (agents.length === 0) return "main";
  const requested = normalizeOpenClawModelRef(preferredModel);
  const isStable = (id) => !id.startsWith("mc-gateway-") && !/^lead-[0-9a-f-]+$/i.test(id);
  if (requested) {
    const directStable = agents.find((agent) => isStable(agent.id) && normalizeOpenClawModelRef(agent.id) === requested);
    if (directStable) return directStable.id;
    const directAny = agents.find((agent) => normalizeOpenClawModelRef(agent.id) === requested);
    if (directAny) return directAny.id;
    const exactStable = agents.find((agent) => isStable(agent.id) && normalizeOpenClawModelRef(agent.model) === requested);
    if (exactStable) return exactStable.id;
    const exactAny = agents.find((agent) => normalizeOpenClawModelRef(agent.model) === requested);
    if (exactAny) return exactAny.id;
    return null;
  }
  return agents.find((agent) => agent.isDefault)?.id ?? agents[0]?.id ?? "main";
}
async function runOpenClawTurn(participantId, spawnRequest, input, timeoutMs = 3e5) {
  const openclawBin = getAgentPath("openclaw") || "openclaw";
  const shellPath = getShellEnvPath();
  const existingSessionId = openClawSessions.get(participantId) ?? null;
  const agentId = existingSessionId ? null : selectOpenClawAgentId$1(openclawBin, shellPath, spawnRequest.model);
  if (!existingSessionId && !agentId) {
    const agents = parseOpenClawAgents$1(openclawBin, shellPath);
    const available = agents.map((agent) => agent.model || agent.id).filter((value, index, all) => typeof value === "string" && value.trim().length > 0 && all.indexOf(value) === index);
    const details = available.length > 0 ? ` Available: ${available.join(", ")}` : "";
    throw new Error(`OpenClaw model must match exactly: ${spawnRequest.model}.${details}`);
  }
  return await new Promise((resolve, reject) => {
    const args = buildOpenClawAgentArgs({
      prompt: input.prompt,
      agentId,
      sessionId: existingSessionId,
      thinking: spawnRequest.thinking
    });
    const proc = child_process.spawn(openclawBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...shellPath && { PATH: shellPath } }
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error(`OpenClaw turn timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0) {
        reject(new Error(sanitizeAgentCliDiagnostic(stderr.trim() || stdout.trim() || `OpenClaw exited with ${code}`)));
        return;
      }
      const parsed = parseOpenClawOutput(stdout);
      if (parsed.sessionId) openClawSessions.set(participantId, parsed.sessionId);
      resolve(parsed.text || stdout.trim());
    });
  });
}
async function runHermesTurn(participantId, spawnRequest, input, timeoutMs = 3e5) {
  const hermesBin = getAgentPath("hermes") || "hermes";
  const shellPath = getShellEnvPath();
  const modeMap = {
    "full": "terminal,file,web,browser",
    "terminal": "terminal,file",
    "web": "web,browser",
    "query": "",
    "bypassPermissions": "terminal,file,web,browser",
    "default": "terminal,file",
    "plan": ""
  };
  const toolsets = modeMap[spawnRequest.mode ?? ""] ?? "terminal,file";
  const existingSessionId = hermesSessions.get(participantId) ?? null;
  const provider = typeof spawnRequest.metadata?.provider === "string" ? spawnRequest.metadata.provider : null;
  return await new Promise((resolve, reject) => {
    const args = buildHermesChatArgs({
      prompt: input.prompt,
      model: spawnRequest.model,
      provider,
      toolsets,
      resumeSessionId: existingSessionId,
      ignoreRules: true,
      bypassPermissions: spawnRequest.mode === "bypassPermissions",
      // Relay path is batch (Promise<string>); we still use --stream-json so
      // the consumer sees a faithful event log if it ever taps stdout, and
      // so a single Hermes binary version is required across both chat and
      // relay paths. The NDJSON parser concatenates text deltas into the
      // final string we return here.
      streamJson: true
    });
    const proc = child_process.spawn(hermesBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...shellPath && { PATH: shellPath } }
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error(`Hermes turn timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0) {
        reject(new Error(sanitizeAgentCliDiagnostic(stderr.trim() || `Hermes exited with ${code}`)));
        return;
      }
      const parsed = parseHermesStreamJsonOutput(stdout);
      if (parsed.sessionId) hermesSessions.set(participantId, parsed.sessionId);
      if (!parsed.text && (!parsed.raw || parsed.raw.length === 0)) {
        const legacy = parseHermesOutput(stdout);
        if (legacy.sessionId) hermesSessions.set(participantId, legacy.sessionId);
        resolve(legacy.text);
        return;
      }
      resolve(parsed.text);
    });
  });
}
class MainProcessRelayExecutor {
  constructor(participantId, spawnRequest) {
    this.participantId = participantId;
    this.spawnRequest = spawnRequest;
  }
  async runTurn(input) {
    switch (this.spawnRequest.provider) {
      case "claude":
        return runClaudeTurn(this.participantId, this.spawnRequest, input, this.spawnRequest.timeoutMs);
      case "codex":
        return runCodexTurn(this.spawnRequest, input, this.spawnRequest.timeoutMs);
      case "opencode":
        return runOpenCodeTurn(this.participantId, this.spawnRequest, input, this.spawnRequest.timeoutMs);
      case "openclaw":
        return runOpenClawTurn(this.participantId, this.spawnRequest, input, this.spawnRequest.timeoutMs);
      case "hermes":
        return runHermesTurn(this.participantId, this.spawnRequest, input, this.spawnRequest.timeoutMs);
      default:
        throw new Error(`Unsupported relay provider: ${this.spawnRequest.provider ?? "unknown"}`);
    }
  }
}
function createMainProcessRelayExecutor(participantId, spawnRequest) {
  return new MainProcessRelayExecutor(participantId, spawnRequest);
}
const instances = /* @__PURE__ */ new Map();
function broadcast(event, workspacePath) {
  const channel = event.type === "channel_message" && "channel" in event.payload ? `relay:channel:${event.payload.channel}` : event.type === "direct_message" && "to" in event.payload ? `relay:participant:${event.payload.to}` : "relay:system";
  bus.publish({
    channel,
    type: "data",
    source: "relay",
    payload: { workspacePath, event }
  });
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send("relay:event", { workspacePath, event });
    }
  }
}
async function readTileState(workspaceId, tileId) {
  return loadWorkspaceTileState(workspaceId, tileId, null);
}
async function getWorkspaceRelay(workspacePath) {
  const existing = instances.get(workspacePath);
  if (existing) return existing;
  const relay = new ContexRelay({ workspacePath });
  await relay.init();
  const runtime = new RelayRuntime(relay, {
    executorFactory: (participant, spawn) => createMainProcessRelayExecutor(participant.id, spawn)
  });
  const unsubscribe = relay.on((event) => broadcast(event, workspacePath));
  const instance = { relay, runtime, unsubscribe };
  instances.set(workspacePath, instance);
  return instance;
}
async function syncWorkspaceRelayParticipants(workspaceId, workspacePath, tiles) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  const seen = /* @__PURE__ */ new Set();
  for (const tile of tiles) {
    if (tile.type !== "chat") continue;
    const tileState = await readTileState(workspaceId, tile.id);
    const provider = tileState?.provider ?? "claude";
    const model = tileState?.model ?? void 0;
    const agentMode = Boolean(tileState?.agentMode);
    const name = tileState?.title ?? `Agent ${tile.id.slice(-4)}`;
    seen.add(tile.id);
    await relay.upsertParticipant({
      id: tile.id,
      name,
      kind: "agent",
      status: agentMode ? "ready" : "stopped",
      tileId: tile.id,
      provider,
      model,
      channels: [],
      metadata: {
        tileType: tile.type,
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        agentMode
      }
    });
  }
  const existing = await relay.listParticipants();
  const stale = existing.filter((participant) => participant.kind === "agent" && participant.tileId && !seen.has(participant.tileId));
  for (const participant of stale) {
    await relay.setParticipantStatus(participant.id, "stopped");
  }
  return relay.listParticipants();
}
async function spawnWorkspaceRelayAgent(workspacePath, request) {
  const { runtime } = await getWorkspaceRelay(workspacePath);
  return runtime.spawn(request);
}
async function stopWorkspaceRelayAgent(workspacePath, participantId) {
  const { runtime } = await getWorkspaceRelay(workspacePath);
  await runtime.stop(participantId);
}
async function sendWorkspaceDirectRelayMessage(workspacePath, from, draft) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.sendDirectMessage(from, draft);
}
async function sendWorkspaceChannelRelayMessage(workspacePath, from, draft) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.sendChannelMessage(from, draft);
}
async function listWorkspaceRelayParticipants(workspacePath) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.listParticipants();
}
async function listWorkspaceRelayChannels(workspacePath) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.listChannels();
}
async function listWorkspaceRelayCentralFeed(workspacePath, limit) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.listCentralFeed(limit);
}
async function listWorkspaceRelayMessages(workspacePath, participantId, mailbox, limit) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.listMessages(participantId, mailbox, limit);
}
async function readWorkspaceRelayMessage(workspacePath, participantId, mailbox, filename) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.readParticipantMessage(participantId, mailbox, filename);
}
async function updateWorkspaceRelayMessageStatus(workspacePath, participantId, mailbox, filename, status2) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.updateMessageStatus(participantId, mailbox, filename, status2);
}
async function moveWorkspaceRelayMessage(workspacePath, participantId, fromMailbox, toMailbox, filename) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.moveMessage(participantId, fromMailbox, toMailbox, filename);
}
async function setWorkspaceRelayWorkContext(workspacePath, participantId, work) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.updateWorkContext(participantId, work);
}
async function analyzeWorkspaceRelayRelationships(workspacePath) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.analyzeRelationships();
}
async function waitForWorkspaceRelayReady(workspacePath, ids, timeoutMs) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  await relay.waitForReady(ids, { timeoutMs });
  return true;
}
async function waitForWorkspaceRelayAny(workspacePath, ids, timeoutMs) {
  const { relay } = await getWorkspaceRelay(workspacePath);
  return relay.waitForAny(ids, { timeoutMs });
}
function stopAllRelayServices() {
  for (const instance of instances.values()) {
    instance.unsubscribe();
    instance.runtime.destroy();
  }
  instances.clear();
}
const DB_DIRNAME = "db";
const DB_FILENAME = "codesurf.db";
const DB_BACKUPS_DIRNAME = "backups";
const DB_DIR = path$1.join(CONTEX_HOME, DB_DIRNAME);
const DB_PATH = path$1.join(DB_DIR, DB_FILENAME);
const DB_BACKUPS_DIR = path$1.join(DB_DIR, DB_BACKUPS_DIRNAME);
function dbBackupPath(label) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const safeLabel = label.replace(/[^a-z0-9._-]+/gi, "-");
  return path$1.join(DB_BACKUPS_DIR, `${DB_FILENAME}.${safeLabel}-${timestamp}`);
}
function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
}
function getCurrentVersion(db) {
  const row = db.prepare(
    "SELECT MAX(version) AS version FROM schema_migrations"
  ).get();
  return row?.version ?? 0;
}
function backupDatabase(version) {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    fs.mkdirSync(DB_BACKUPS_DIR, { recursive: true });
    const target = dbBackupPath(`premigrate-v${version}`);
    fs.copyFileSync(DB_PATH, target);
    return target;
  } catch (err) {
    console.warn("[db] Pre-migration backup failed:", err);
    return null;
  }
}
function runMigrations(db, migrations) {
  ensureMigrationsTable(db);
  const currentVersion = getCurrentVersion(db);
  const pending = migrations.slice().sort((a, b) => a.version - b.version).filter((m) => m.version > currentVersion);
  if (pending.length === 0) {
    return { applied: [], currentVersion };
  }
  if (currentVersion > 0) {
    const backup = backupDatabase(currentVersion);
    if (backup) {
      console.log(`[db] Backup taken before migrating v${currentVersion} -> v${pending[pending.length - 1].version}: ${backup}`);
    }
  }
  const insert = db.prepare(
    "INSERT INTO schema_migrations (version, name) VALUES (?, ?)"
  );
  const applied = [];
  const txn = db.transaction((list) => {
    for (const migration of list) {
      migration.up(db);
      insert.run(migration.version, migration.name);
      applied.push(migration);
    }
  });
  txn(pending);
  return { applied, currentVersion: getCurrentVersion(db) };
}
const migration001Bootstrap = {
  version: 1,
  name: "bootstrap",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
};
const migration002Threads = {
  version: 2,
  name: "threads-index",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        path        TEXT NOT NULL UNIQUE,
        device_id   TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        deleted_at  TEXT,
        version     INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        project_id  TEXT,
        is_active   INTEGER NOT NULL DEFAULT 0,
        device_id   TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        deleted_at  TEXT,
        version     INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS threads (
        -- Sync prelude
        id                    TEXT PRIMARY KEY,           -- uuid v4 for sync; stable across devices
        device_id             TEXT NOT NULL,
        created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        deleted_at            TEXT,
        version               INTEGER NOT NULL DEFAULT 1,

        -- Identity against the aggregator
        entry_id              TEXT NOT NULL UNIQUE,       -- AggregatedSessionEntry.id
        source                TEXT NOT NULL,              -- 'codesurf'|'claude'|'codex'|'cursor'|'openclaw'|'opencode'
        scope                 TEXT NOT NULL,              -- 'workspace'|'project'|'user'
        session_id            TEXT,                       -- provider-side session id
        file_path             TEXT,                       -- absolute path on disk (null for DB-sourced)
        provider              TEXT NOT NULL DEFAULT '',
        model                 TEXT NOT NULL DEFAULT '',
        source_label          TEXT NOT NULL DEFAULT '',
        source_detail         TEXT,
        tile_id               TEXT,

        -- Content snapshot
        title                 TEXT NOT NULL,
        title_override        TEXT,                       -- user rename overlay (owned by us)
        last_message          TEXT,
        message_count         INTEGER NOT NULL DEFAULT 0,

        -- Placement
        project_path          TEXT,                       -- for grouping
        workspace_dir         TEXT,
        related_group_id      TEXT,
        nesting_level         INTEGER NOT NULL DEFAULT 0,

        -- Overlay metadata we own
        is_pinned             INTEGER NOT NULL DEFAULT 0,
        is_archived           INTEGER NOT NULL DEFAULT 0,
        is_starred            INTEGER NOT NULL DEFAULT 0,
        last_opened_at        TEXT,

        -- Resume metadata
        can_open_in_chat      INTEGER NOT NULL DEFAULT 0,
        can_open_in_app       INTEGER NOT NULL DEFAULT 0,
        resume_bin            TEXT,
        resume_args_json      TEXT,                       -- JSON array

        -- Source freshness signals (for incremental re-index)
        source_updated_ms     INTEGER NOT NULL DEFAULT 0, -- AggregatedSessionEntry.updatedAt
        source_mtime_ms       INTEGER NOT NULL DEFAULT 0, -- file mtime
        source_size_bytes     INTEGER NOT NULL DEFAULT 0,
        indexed_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE INDEX IF NOT EXISTS idx_threads_updated      ON threads(source_updated_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_threads_project      ON threads(project_path, source_updated_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_threads_source       ON threads(source);
      CREATE INDEX IF NOT EXISTS idx_threads_workspace    ON threads(workspace_dir);
      CREATE INDEX IF NOT EXISTS idx_threads_deleted      ON threads(deleted_at) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_entry ON threads(entry_id);
    `);
  }
};
const migration003ThreadIndex = {
  version: 3,
  name: "thread-index-v2",
  up(db) {
    db.exec(`
      DROP TABLE IF EXISTS threads;

      CREATE TABLE thread_index (
        -- Sync prelude
        id                TEXT PRIMARY KEY,
        device_id         TEXT NOT NULL,
        created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        deleted_at        TEXT,
        version           INTEGER NOT NULL DEFAULT 1,

        -- Identity
        entry_id          TEXT NOT NULL UNIQUE,          -- AggregatedSessionEntry.id
        source            TEXT NOT NULL,                  -- codesurf|claude|codex|cursor|openclaw|opencode
        file_path         TEXT,                           -- absolute path on disk (null only for DB-native)
        session_id        TEXT,                           -- provider's own id (for resume)

        -- Display
        title             TEXT NOT NULL,
        title_override    TEXT,                           -- user rename, preserved across reindex
        preview           TEXT,                           -- last-message snippet
        message_count     INTEGER NOT NULL DEFAULT 0,

        -- Placement
        project_path      TEXT,
        scope             TEXT NOT NULL DEFAULT 'user',   -- 'workspace'|'project'|'user'
        related_group_id  TEXT,
        nesting_level     INTEGER NOT NULL DEFAULT 0,
        tile_id           TEXT,

        -- Provider metadata
        provider          TEXT NOT NULL DEFAULT '',
        model             TEXT NOT NULL DEFAULT '',
        source_label      TEXT NOT NULL DEFAULT '',
        source_detail     TEXT,

        -- Source freshness (drives incremental re-index)
        source_mtime_ms   INTEGER NOT NULL DEFAULT 0,
        source_size_bytes INTEGER NOT NULL DEFAULT 0,
        source_updated_ms INTEGER NOT NULL DEFAULT 0,

        -- Overlay (user-owned)
        is_pinned         INTEGER NOT NULL DEFAULT 0,
        is_archived       INTEGER NOT NULL DEFAULT 0,
        is_starred        INTEGER NOT NULL DEFAULT 0,
        last_opened_at    TEXT,

        -- Resume metadata
        can_open_in_chat  INTEGER NOT NULL DEFAULT 0,
        can_open_in_app   INTEGER NOT NULL DEFAULT 0,
        resume_bin        TEXT,
        resume_args_json  TEXT
      );

      CREATE INDEX idx_ti_updated     ON thread_index(source_updated_ms DESC);
      CREATE INDEX idx_ti_project     ON thread_index(project_path, source_updated_ms DESC);
      CREATE INDEX idx_ti_source      ON thread_index(source);
      CREATE INDEX idx_ti_file_path   ON thread_index(file_path) WHERE file_path IS NOT NULL;
      CREATE INDEX idx_ti_live        ON thread_index(deleted_at) WHERE deleted_at IS NULL;
    `);
  }
};
const migration004JobIndex = {
  version: 4,
  name: "job-index-v1",
  up(db) {
    db.exec(`
      CREATE TABLE job_index (
        id                   TEXT PRIMARY KEY,
        device_id            TEXT NOT NULL,
        created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        deleted_at           TEXT,
        version              INTEGER NOT NULL DEFAULT 1,

        job_id               TEXT NOT NULL UNIQUE,
        file_path            TEXT NOT NULL,

        task_label           TEXT,
        initial_prompt       TEXT,
        status               TEXT,
        provider             TEXT,
        model                TEXT,
        run_mode             TEXT,
        workspace_id         TEXT,
        workspace_dir        TEXT,
        card_id              TEXT,
        session_id           TEXT,
        requested_at_ms      INTEGER,
        completed_at_ms      INTEGER,
        duration_ms          INTEGER,
        error_text           TEXT,

        event_count          INTEGER NOT NULL DEFAULT 0,
        error_count          INTEGER NOT NULL DEFAULT 0,
        last_event_type      TEXT,
        last_event_at_ms     INTEGER,
        last_sequence        INTEGER NOT NULL DEFAULT 0,

        -- Derived: COALESCE(last_event_at_ms, requested_at_ms). Populated by
        -- the indexer so default "recent" list views can sort on a single
        -- indexed column without a COALESCE-at-query-time index miss.
        last_activity_at_ms  INTEGER,

        source_mtime_ms      INTEGER NOT NULL DEFAULT 0,
        source_size_bytes    INTEGER NOT NULL DEFAULT 0,
        timeline_mtime_ms    INTEGER NOT NULL DEFAULT 0,
        timeline_size_bytes  INTEGER NOT NULL DEFAULT 0,

        is_starred           INTEGER NOT NULL DEFAULT 0,
        is_archived          INTEGER NOT NULL DEFAULT 0,
        notes                TEXT,

        extra_json           TEXT
      );

      -- Default list sort: most recent activity first. The partial variant
      -- lets the planner do an index-only scan for the hot dashboard query
      -- (live jobs, sorted by activity, LIMIT N) with no temp b-tree sort.
      CREATE INDEX idx_ji_activity      ON job_index(last_activity_at_ms DESC);
      CREATE INDEX idx_ji_ws_activity   ON job_index(workspace_id, last_activity_at_ms DESC);
      CREATE INDEX idx_ji_live_activity ON job_index(last_activity_at_ms DESC) WHERE deleted_at IS NULL;
      -- Still useful for "jobs that started in the last hour" style queries.
      CREATE INDEX idx_ji_requested   ON job_index(requested_at_ms DESC);
      CREATE INDEX idx_ji_provider    ON job_index(provider, status);
      CREATE INDEX idx_ji_status      ON job_index(status);
      CREATE INDEX idx_ji_card        ON job_index(card_id) WHERE card_id IS NOT NULL;
      CREATE INDEX idx_ji_live        ON job_index(deleted_at) WHERE deleted_at IS NULL;

      CREATE TABLE timeline_event_index (
        id             TEXT PRIMARY KEY,
        device_id      TEXT NOT NULL,
        created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        job_id         TEXT NOT NULL,
        sequence       INTEGER NOT NULL,
        timestamp_ms   INTEGER NOT NULL,
        event_type     TEXT NOT NULL,
        error_text     TEXT,
        payload_json   TEXT NOT NULL,

        UNIQUE (job_id, sequence)
      );

      CREATE INDEX idx_tei_job_seq   ON timeline_event_index(job_id, sequence);
      CREATE INDEX idx_tei_time      ON timeline_event_index(timestamp_ms DESC);
      CREATE INDEX idx_tei_type      ON timeline_event_index(event_type);
      CREATE INDEX idx_tei_errors    ON timeline_event_index(job_id) WHERE error_text IS NOT NULL;

      CREATE VIRTUAL TABLE job_search USING fts5(
        job_id UNINDEXED,
        task_label,
        error_text,
        content,
        tokenize = 'porter unicode61'
      );

      CREATE VIRTUAL TABLE timeline_search USING fts5(
        job_id UNINDEXED,
        sequence UNINDEXED,
        event_type UNINDEXED,
        content,
        tokenize = 'porter unicode61'
      );

      CREATE TRIGGER job_search_ai AFTER INSERT ON job_index BEGIN
        INSERT INTO job_search(rowid, job_id, task_label, error_text, content)
        VALUES (
          new.rowid, new.job_id, new.task_label, new.error_text,
          coalesce(new.task_label,'') || ' '
          || coalesce(new.initial_prompt,'') || ' '
          || coalesce(new.error_text,'')
        );
      END;
      CREATE TRIGGER job_search_au AFTER UPDATE ON job_index BEGIN
        UPDATE job_search SET
          task_label = new.task_label,
          error_text = new.error_text,
          content    = coalesce(new.task_label,'') || ' '
                    || coalesce(new.initial_prompt,'') || ' '
                    || coalesce(new.error_text,'')
        WHERE rowid = new.rowid;
      END;
      CREATE TRIGGER job_search_ad AFTER DELETE ON job_index BEGIN
        DELETE FROM job_search WHERE rowid = old.rowid;
      END;

      CREATE TRIGGER timeline_search_ai AFTER INSERT ON timeline_event_index BEGIN
        INSERT INTO timeline_search(rowid, job_id, sequence, event_type, content)
        VALUES (
          new.rowid, new.job_id, new.sequence, new.event_type,
          coalesce(new.error_text,'') || ' ' || coalesce(new.payload_json,'')
        );
      END;
      CREATE TRIGGER timeline_search_ad AFTER DELETE ON timeline_event_index BEGIN
        DELETE FROM timeline_search WHERE rowid = old.rowid;
      END;
    `);
  }
};
const SCHEMA_SQL = [
  `CREATE TABLE provider_rate_limits_index (
    provider             TEXT PRIMARY KEY,
    device_id            TEXT NOT NULL,
    updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    file_path            TEXT NOT NULL,
    primary_window       TEXT,
    primary_used_pct     REAL,
    primary_resets_at    TEXT,
    secondary_window     TEXT,
    secondary_used_pct   REAL,
    secondary_resets_at  TEXT,
    status               TEXT,
    source               TEXT NOT NULL,
    source_mtime_ms      INTEGER NOT NULL DEFAULT 0,
    source_size_bytes    INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX idx_prl_primary_used    ON provider_rate_limits_index(primary_used_pct DESC)`,
  `CREATE INDEX idx_prl_secondary_used  ON provider_rate_limits_index(secondary_used_pct DESC)`,
  `CREATE INDEX idx_prl_resets_primary  ON provider_rate_limits_index(primary_resets_at)   WHERE primary_resets_at   IS NOT NULL`,
  `CREATE INDEX idx_prl_resets_secondary ON provider_rate_limits_index(secondary_resets_at) WHERE secondary_resets_at IS NOT NULL`
];
const migration005ProviderRateLimits = {
  version: 5,
  name: "provider-rate-limits-v1",
  up(db) {
    for (const statement of SCHEMA_SQL) {
      db.prepare(statement).run();
    }
  }
};
const ALL_MIGRATIONS = [
  migration001Bootstrap,
  migration002Threads,
  migration003ThreadIndex,
  migration004JobIndex,
  migration005ProviderRateLimits
  // Future phases append here:
  //   migration006Canvas,
  //   migration007Kanban,
  //   ...
];
let dbInstance = null;
let cachedDeviceId = null;
function ensureDirs() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(DB_BACKUPS_DIR, { recursive: true });
}
function applyPragmas(db) {
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("journal_size_limit = 67108864");
  db.pragma("temp_store = MEMORY");
}
function seedDeviceId(db) {
  const row = db.prepare(
    "SELECT value FROM app_meta WHERE key = ?"
  ).get("device_id");
  if (row?.value) return row.value;
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run("device_id", id);
  return id;
}
function openAndMigrate() {
  ensureDirs();
  const db = new Database(DB_PATH);
  applyPragmas(db);
  const { applied, currentVersion } = runMigrations(db, ALL_MIGRATIONS);
  if (applied.length > 0) {
    console.log(`[db] Applied ${applied.length} migration(s); now at v${currentVersion}: ${applied.map((m) => `${m.version}:${m.name}`).join(", ")}`);
  }
  cachedDeviceId = seedDeviceId(db);
  return db;
}
function getDb() {
  if (!dbInstance) dbInstance = openAndMigrate();
  return dbInstance;
}
function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  getDb();
  return cachedDeviceId ?? "";
}
function closeDb() {
  if (!dbInstance) return;
  try {
    dbInstance.close();
  } catch (err) {
    console.warn("[db] close failed:", err);
  }
  dbInstance = null;
}
function resetDatabase() {
  closeDb();
  let backupPath = null;
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.mkdirSync(DB_BACKUPS_DIR, { recursive: true });
      backupPath = dbBackupPath("reset");
      fs.renameSync(DB_PATH, backupPath);
      for (const suffix of ["-wal", "-shm"]) {
        const side = `${DB_PATH}${suffix}`;
        if (fs.existsSync(side)) {
          try {
            fs.renameSync(side, `${backupPath}${suffix}`);
          } catch {
          }
        }
      }
    }
  } catch (err) {
    console.warn("[db] reset failed:", err);
  }
  cachedDeviceId = null;
  return { backupPath };
}
function getDbStatus() {
  const db = getDb();
  const version = db.prepare(
    "SELECT MAX(version) AS v FROM schema_migrations"
  ).get()?.v ?? 0;
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  ).all().map((r) => r.name);
  return {
    path: DB_PATH,
    deviceId: getDeviceId(),
    schemaVersion: version,
    tables
  };
}
const status$1 = {
  initialIndexDone: false,
  lastScanStartedAt: 0,
  lastScanFinishedAt: 0,
  lastScanDurationMs: 0,
  lastScanInserts: 0,
  lastScanUpdates: 0,
  lastScanTombstoned: 0,
  lastScanSkipped: 0,
  scanningInFlight: false,
  lastError: null
};
let currentScan$1 = null;
const SCAN_MIN_INTERVAL_MS = 1e4;
function nowIso$1() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function rowToEntry(row) {
  let resumeArgs;
  if (typeof row.resume_args_json === "string" && row.resume_args_json.length) {
    try {
      resumeArgs = JSON.parse(row.resume_args_json);
    } catch {
    }
  }
  return {
    id: row.entry_id,
    source: row.source,
    scope: row.scope,
    tileId: row.tile_id ?? null,
    sessionId: row.session_id ?? null,
    provider: row.provider ?? "",
    model: row.model ?? "",
    messageCount: row.message_count ?? 0,
    lastMessage: row.preview ?? null,
    updatedAt: row.source_updated_ms ?? 0,
    sizeBytes: row.source_size_bytes ?? 0,
    filePath: row.file_path ?? void 0,
    title: row.title_override ?? row.title,
    projectPath: row.project_path ?? void 0,
    sourceLabel: row.source_label ?? "",
    sourceDetail: row.source_detail ?? void 0,
    canOpenInChat: !!row.can_open_in_chat,
    canOpenInApp: !!row.can_open_in_app,
    resumeBin: row.resume_bin ?? void 0,
    resumeArgs,
    relatedGroupId: row.related_group_id ?? void 0,
    nestingLevel: row.nesting_level ?? 0
  };
}
function listThreadsFromDb(workspacePath) {
  const db = getDb();
  if (!workspacePath) {
    const rows2 = db.prepare(`
      SELECT * FROM thread_index
       WHERE deleted_at IS NULL
       ORDER BY source_updated_ms DESC
    `).all();
    return rows2.map(rowToEntry);
  }
  const wsPrefix = workspacePath.endsWith("/") ? workspacePath : `${workspacePath}/`;
  const rows = db.prepare(`
    SELECT * FROM thread_index
     WHERE deleted_at IS NULL
       AND project_path IS NOT NULL
       AND (project_path = @workspace_path OR project_path LIKE @workspace_prefix)
     ORDER BY source_updated_ms DESC
  `).all({
    workspace_path: workspacePath,
    workspace_prefix: `${wsPrefix}%`
  });
  return rows.map(rowToEntry);
}
function countThreadsInDb() {
  return getDb().prepare(
    `SELECT COUNT(*) AS c FROM thread_index WHERE deleted_at IS NULL`
  ).get().c;
}
function getIndexerStatus() {
  return {
    ...status$1,
    totalRows: (() => {
      try {
        return countThreadsInDb();
      } catch {
        return 0;
      }
    })()
  };
}
function indexAllSources(options) {
  if (currentScan$1) return currentScan$1;
  if (!options?.force && status$1.lastScanFinishedAt > 0 && Date.now() - status$1.lastScanFinishedAt < SCAN_MIN_INTERVAL_MS) {
    return Promise.resolve();
  }
  const promise = runScan$1();
  currentScan$1 = promise;
  promise.finally(() => {
    currentScan$1 = null;
  });
  return promise;
}
async function runScan$1() {
  status$1.scanningInFlight = true;
  status$1.lastScanStartedAt = Date.now();
  status$1.lastError = null;
  try {
    invalidateExternalSessionCache();
    const entries = await listExternalSessionEntries(null, { force: true }).catch(() => []);
    const db = getDb();
    const deviceId = getDeviceId();
    const now = nowIso$1();
    const existing = /* @__PURE__ */ new Map();
    for (const row of db.prepare(
      `SELECT entry_id, source_mtime_ms, source_size_bytes, project_path, title, preview, message_count, can_open_in_chat, can_open_in_app, deleted_at FROM thread_index`
    ).all()) {
      existing.set(row.entry_id, {
        source_mtime_ms: row.source_mtime_ms,
        source_size_bytes: row.source_size_bytes,
        project_path: row.project_path,
        title: row.title,
        preview: row.preview,
        message_count: row.message_count,
        can_open_in_chat: row.can_open_in_chat,
        can_open_in_app: row.can_open_in_app,
        deleted_at: row.deleted_at
      });
    }
    const insert = db.prepare(`
      INSERT INTO thread_index (
        id, device_id, entry_id, source, scope, session_id, file_path, provider, model,
        source_label, source_detail, tile_id,
        title, preview, message_count,
        project_path, related_group_id, nesting_level,
        can_open_in_chat, can_open_in_app, resume_bin, resume_args_json,
        source_mtime_ms, source_size_bytes, source_updated_ms
      ) VALUES (
        @id, @device_id, @entry_id, @source, @scope, @session_id, @file_path, @provider, @model,
        @source_label, @source_detail, @tile_id,
        @title, @preview, @message_count,
        @project_path, @related_group_id, @nesting_level,
        @can_open_in_chat, @can_open_in_app, @resume_bin, @resume_args_json,
        @source_mtime_ms, @source_size_bytes, @source_updated_ms
      )
    `);
    const update = db.prepare(`
      UPDATE thread_index SET
        source             = @source,
        scope              = @scope,
        session_id         = @session_id,
        file_path          = @file_path,
        provider           = @provider,
        model              = @model,
        source_label       = @source_label,
        source_detail      = @source_detail,
        tile_id            = @tile_id,
        title              = @title,
        preview            = @preview,
        message_count      = @message_count,
        project_path       = @project_path,
        related_group_id   = @related_group_id,
        nesting_level      = @nesting_level,
        can_open_in_chat   = @can_open_in_chat,
        can_open_in_app    = @can_open_in_app,
        resume_bin         = @resume_bin,
        resume_args_json   = @resume_args_json,
        source_mtime_ms    = @source_mtime_ms,
        source_size_bytes  = @source_size_bytes,
        source_updated_ms  = @source_updated_ms,
        deleted_at         = NULL,
        updated_at         = @now,
        version            = version + 1
      WHERE entry_id = @entry_id
    `);
    const tombstone = db.prepare(`
      UPDATE thread_index
         SET deleted_at = @now, updated_at = @now, version = version + 1
       WHERE entry_id = @entry_id AND deleted_at IS NULL
    `);
    let inserts = 0, updates = 0, skipped = 0;
    const txn = db.transaction(() => {
      const seenIds = /* @__PURE__ */ new Set();
      const duplicateIds = /* @__PURE__ */ new Set();
      for (const entry of entries) {
        if (seenIds.has(entry.id)) {
          duplicateIds.add(entry.id);
          continue;
        }
        seenIds.add(entry.id);
        const prev = existing.get(entry.id);
        const mtime = Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0;
        const sizeBytes = Number.isFinite(entry.sizeBytes) ? Number(entry.sizeBytes) : 0;
        const params = {
          id: crypto.randomUUID(),
          device_id: deviceId,
          entry_id: entry.id,
          source: entry.source,
          scope: entry.scope,
          session_id: entry.sessionId ?? null,
          file_path: entry.filePath ?? null,
          provider: entry.provider ?? "",
          model: entry.model ?? "",
          source_label: entry.sourceLabel ?? "",
          source_detail: entry.sourceDetail ?? null,
          tile_id: entry.tileId ?? null,
          title: entry.title,
          preview: entry.lastMessage ?? null,
          message_count: entry.messageCount ?? 0,
          project_path: entry.projectPath ?? null,
          related_group_id: entry.relatedGroupId ?? null,
          nesting_level: entry.nestingLevel ?? 0,
          can_open_in_chat: entry.canOpenInChat ? 1 : 0,
          can_open_in_app: entry.canOpenInApp ? 1 : 0,
          resume_bin: entry.resumeBin ?? null,
          resume_args_json: entry.resumeArgs ? JSON.stringify(entry.resumeArgs) : null,
          source_mtime_ms: mtime,
          source_size_bytes: sizeBytes,
          source_updated_ms: mtime,
          now
        };
        if (!prev) {
          insert.run(params);
          inserts += 1;
        } else if (prev.deleted_at !== null || prev.source_mtime_ms !== mtime || prev.source_size_bytes !== sizeBytes || (prev.project_path ?? null) !== (entry.projectPath ?? null) || (prev.title ?? "") !== entry.title || (prev.preview ?? null) !== (entry.lastMessage ?? null) || prev.message_count !== (entry.messageCount ?? 0) || prev.can_open_in_chat !== (entry.canOpenInChat ? 1 : 0) || prev.can_open_in_app !== (entry.canOpenInApp ? 1 : 0)) {
          update.run(params);
          updates += 1;
        } else {
          skipped += 1;
        }
      }
      if (duplicateIds.size > 0) {
        console.warn("[threads] scan skipped duplicate entry ids:", Array.from(duplicateIds).slice(0, 20));
      }
      let tombstoned2 = 0;
      for (const [entry_id, prev] of existing.entries()) {
        if (prev.deleted_at !== null) continue;
        if (!seenIds.has(entry_id)) {
          tombstone.run({ entry_id, now });
          tombstoned2 += 1;
        }
      }
      return tombstoned2;
    });
    const tombstoned = txn();
    const finishedAt = Date.now();
    status$1.lastScanFinishedAt = finishedAt;
    status$1.lastScanDurationMs = finishedAt - status$1.lastScanStartedAt;
    status$1.lastScanInserts = inserts;
    status$1.lastScanUpdates = updates;
    status$1.lastScanTombstoned = tombstoned;
    status$1.lastScanSkipped = skipped;
    status$1.initialIndexDone = true;
    status$1.scanningInFlight = false;
    console.log(`[threads] scan: inserts=${inserts} updates=${updates} tombstoned=${tombstoned} skipped=${skipped} in ${status$1.lastScanDurationMs}ms`);
    if (inserts > 0 || tombstoned > 0 || updates > 0) {
      broadcastToRenderer("canvas:sessionsChanged", { workspaceId: "*" });
    }
  } catch (err) {
    status$1.scanningInFlight = false;
    status$1.lastError = err instanceof Error ? err.message : String(err);
    console.error("[threads] scan failed:", err);
  }
}
async function ensureInitialIndex() {
  try {
    if (countThreadsInDb() > 0) {
      status$1.initialIndexDone = true;
      console.log("[threads] index already populated, skipping initial scan");
      return;
    }
  } catch {
  }
  console.log("[threads] index empty, running one-time initial scan");
  await indexAllSources();
}
function renameIndexedThread(entryId, newTitle) {
  const info = getDb().prepare(
    `UPDATE thread_index
        SET title_override = @title, updated_at = @now, version = version + 1
      WHERE entry_id = @entry_id`
  ).run({ title: newTitle, entry_id: entryId, now: nowIso$1() });
  return info.changes > 0;
}
function togglePinned(entryId, pinned) {
  const info = getDb().prepare(
    `UPDATE thread_index
        SET is_pinned = @pinned, updated_at = @now, version = version + 1
      WHERE entry_id = @entry_id`
  ).run({ pinned: pinned ? 1 : 0, entry_id: entryId, now: nowIso$1() });
  return info.changes > 0;
}
function startThreadWatchers(_workspacePath) {
}
function stopThreadWatchers() {
}
function isThreadIndexerActive() {
  return status$1.initialIndexDone;
}
async function seedThreadsIndex(_workspacePath) {
  await indexAllSources();
}
function ensureThreadIndexer(_workspacePath) {
  if (!status$1.initialIndexDone && !status$1.scanningInFlight) {
    void ensureInitialIndex();
  }
}
function initThreadIndexerForWorkspace(_workspacePath) {
  void ensureInitialIndex();
}
function normalizeArchivedSessionIds(value) {
  const normalized = /* @__PURE__ */ new Set();
  for (const entry of Array.isArray(value) ? value : []) {
    if (typeof entry !== "string") continue;
    const sessionId = entry.trim();
    if (!sessionId) continue;
    normalized.add(sessionId);
  }
  return Array.from(normalized).sort((a, b) => a.localeCompare(b));
}
async function readArchivedSessionIds(paths) {
  const archived = /* @__PURE__ */ new Set();
  for (const path2 of paths) {
    try {
      const raw = JSON.parse(await fs.promises.readFile(path2, "utf8"));
      for (const sessionId of normalizeArchivedSessionIds(raw?.archivedSessionIds)) {
        archived.add(sessionId);
      }
    } catch {
    }
  }
  return archived;
}
async function writeArchivedSessionIds(path2, archivedSessionIds) {
  const normalized = normalizeArchivedSessionIds(Array.from(archivedSessionIds));
  await fs.promises.mkdir(path$1.dirname(path2), { recursive: true });
  await fs.promises.writeFile(path2, JSON.stringify({
    version: 1,
    archivedSessionIds: normalized
  }, null, 2));
}
const GENERATED_TITLE_MODEL = "claude-haiku-4-5-20251001";
const GENERATED_TITLE_MAX_CHARS = 64;
const GENERATED_TITLE_MIN_WORDS = 3;
const GENERATED_TITLE_MAX_WORDS = 4;
const GENERATED_TITLE_TRANSCRIPT_BUDGET = 9e4;
const GENERATED_TITLE_HEAD_MESSAGES = 32;
const GENERATED_TITLE_TAIL_MESSAGES = 96;
const OPENAI_TITLE_MODEL = "gpt-5.1-codex-mini";
const OPENROUTER_FREE_TITLE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.1-8b-instruct:free"
];
const TITLE_TOKEN_OVERRIDES = /* @__PURE__ */ new Map([
  ["api", "API"],
  ["cli", "CLI"],
  ["css", "CSS"],
  ["html", "HTML"],
  ["ipc", "IPC"],
  ["json", "JSON"],
  ["llm", "LLM"],
  ["mcp", "MCP"],
  ["sdk", "SDK"],
  ["ui", "UI"],
  ["url", "URL"],
  ["codex", "Codex"],
  ["claude", "Claude"],
  ["openai", "OpenAI"]
]);
function envValue(env, key) {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function normalizeProviderRef(value) {
  return String(value ?? "").trim().toLowerCase();
}
function stripModelProviderPrefix(model) {
  return model.trim().replace(/^(?:openai|anthropic|google|meta-llama|deepseek)\//i, "");
}
function selectFastOpenAiTitleModel(model) {
  const stripped = stripModelProviderPrefix(String(model ?? "").trim());
  const normalized = stripped.toLowerCase();
  if (normalized.includes("mini") && stripped) return stripped;
  if (normalized === "o4-mini" || normalized === "o3-mini") return stripped;
  return OPENAI_TITLE_MODEL;
}
function addUniqueCandidate(candidates, candidate) {
  const key = candidate.kind === "openai-compatible" ? `${candidate.kind}:${candidate.provider}:${candidate.model}:${candidate.source}` : `${candidate.kind}:${candidate.model}:${candidate.source}`;
  const exists2 = candidates.some((existing) => {
    const existingKey = existing.kind === "openai-compatible" ? `${existing.kind}:${existing.provider}:${existing.model}:${existing.source}` : `${existing.kind}:${existing.model}:${existing.source}`;
    return existingKey === key;
  });
  if (!exists2) candidates.push(candidate);
}
function resolveSessionTitleModelCandidates(input, env = process.env) {
  const provider = normalizeProviderRef(input.provider);
  const model = String(input.model ?? "").trim();
  const normalizedModel = model.toLowerCase();
  const candidates = [];
  const openAiKey = envValue(env, "OPENAI_API_KEY");
  const openRouterKey = envValue(env, "OPENROUTER_API_KEY");
  const isOpenAiProvider = provider === "openai" || provider === "codex" || normalizedModel.startsWith("openai/") || /^gpt-|^o\d/.test(normalizedModel);
  if (openAiKey && isOpenAiProvider) {
    addUniqueCandidate(candidates, {
      kind: "openai-compatible",
      provider: "openai",
      model: selectFastOpenAiTitleModel(model),
      baseUrl: "https://api.openai.com/v1",
      apiKey: openAiKey,
      apiKeyEnv: "OPENAI_API_KEY",
      source: "current-provider"
    });
  }
  const isOpenRouterProvider = provider === "openrouter" || normalizedModel.includes(":free");
  if (openRouterKey && isOpenRouterProvider && model) {
    addUniqueCandidate(candidates, {
      kind: "openai-compatible",
      provider: "openrouter",
      model,
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: openRouterKey,
      apiKeyEnv: "OPENROUTER_API_KEY",
      source: "current-provider"
    });
  }
  if (openRouterKey) {
    for (const freeModel of OPENROUTER_FREE_TITLE_MODELS) {
      addUniqueCandidate(candidates, {
        kind: "openai-compatible",
        provider: "openrouter",
        model: freeModel,
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: openRouterKey,
        apiKeyEnv: "OPENROUTER_API_KEY",
        source: "free-fallback"
      });
    }
  }
  const isClaudeProvider = provider === "claude" || normalizedModel.includes("claude") || normalizedModel.startsWith("anthropic/");
  if (isClaudeProvider) {
    addUniqueCandidate(candidates, {
      kind: "claude-sdk",
      provider: "claude",
      model: stripModelProviderPrefix(model) || GENERATED_TITLE_MODEL,
      source: provider === "claude" ? "current-provider" : "last-resort-claude"
    });
  }
  return candidates;
}
function describeSessionTitleModelCandidate(candidate) {
  if (candidate.kind === "openai-compatible") {
    const source2 = candidate.source === "free-fallback" ? "free fallback" : "current provider";
    return `${candidate.provider}/${candidate.model} (${source2})`;
  }
  const source = candidate.source === "last-resort-claude" ? "last-resort Claude" : "current provider";
  return `claude-sdk/${candidate.model} (${source})`;
}
function redactTitleGenerationError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]").replace(/(?:sk|sk-or|sk-ant|sess)-[A-Za-z0-9_\-]{10,}/g, "[REDACTED]");
}
const FILLER_WORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "for",
  "from",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with"
]);
const LEADING_FILLER_WORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "about",
  "and",
  "conversation",
  "chat",
  "session",
  "summary",
  "the",
  "this",
  "thread",
  "title"
]);
function truncateHard(text, hardCap) {
  const trimmed = text.trim();
  if (trimmed.length <= hardCap) return trimmed;
  return trimmed.slice(0, hardCap).trimEnd();
}
function isSessionTitleBoilerplateLine(line) {
  const normalized = line.trim();
  if (!normalized) return true;
  return /^(?:#\s*)?AGENTS\.md instructions for\b/i.test(normalized) || /^(?:#\s*)?CLAUDE\.md instructions for\b/i.test(normalized) || /^<\/?environment_context>$/i.test(normalized) || /^<INSTRUCTIONS>$/i.test(normalized) || /^<\/INSTRUCTIONS>$/i.test(normalized) || /^---\s*project-doc\s*---$/i.test(normalized) || /^#+\s*(?:Non-Negotiable Rules|GSDN Native Mode|Installed GSDN assets|Usage rules|Skills|Files mentioned by the user)\b/i.test(normalized) || /^Launching skill:/i.test(normalized) || /^Base directory for this skill:/i.test(normalized) || /^The `?\.codesurf\/DREAMING\.md`? has been written/i.test(normalized);
}
function firstMeaningfulTitleLine(text) {
  const source = text.replace(/\r\n/g, "\n").trim();
  if (!source) return null;
  const explicitRequest = source.match(/#+\s*My request for Codex:\s*([\s\S]+)/i);
  if (explicitRequest?.[1]?.trim()) return firstMeaningfulTitleLine(explicitRequest[1]);
  let insideInstructions = false;
  let insideEnvironmentContext = false;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^<environment_context>$/i.test(line)) {
      insideEnvironmentContext = true;
      continue;
    }
    if (/^<\/environment_context>$/i.test(line)) {
      insideEnvironmentContext = false;
      continue;
    }
    if (insideEnvironmentContext) continue;
    if (/<INSTRUCTIONS>/i.test(line)) {
      insideInstructions = true;
      continue;
    }
    if (/<\/INSTRUCTIONS>/i.test(line)) {
      insideInstructions = false;
      continue;
    }
    if (insideInstructions) continue;
    const workspacePrompt = line.match(/^Workspace:\s+.+?\bPrimary path:\s+\S+\s+(.+)$/i);
    if (workspacePrompt?.[1]?.trim()) return workspacePrompt[1].trim();
    if (isSessionTitleBoilerplateLine(line)) continue;
    return line;
  }
  return null;
}
function cleanSessionTitleCandidate(text, hardCap = GENERATED_TITLE_MAX_CHARS) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;
  let next = (firstMeaningfulTitleLine(trimmed) ?? trimmed).replace(/^```(?:json|JSON)?\s*/i, "").replace(/```$/i, "").replace(/\r\n/g, "\n").split(/\r?\n/, 1)[0].trim();
  next = next.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  next = next.replace(/`([^`]+)`/g, "$1");
  next = next.replace(/^[-*+]\s+/, "");
  next = next.replace(/^\[[ xX]\]\s+/, "");
  next = next.replace(/^\d+\.\s+/, "");
  next = next.replace(/^#+\s+/, "");
  next = next.replace(/\s+/g, " ").trim();
  next = next.replace(/[.!?。]+$/g, "").trim();
  if (isSessionTitleBoilerplateLine(next)) return null;
  if (!next) return null;
  return truncateHard(next, hardCap);
}
function trimTranscriptText(text, maxChars = 2e3) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}…`;
}
function formatTranscriptMessage(message, index) {
  const role = typeof message.role === "string" && message.role.trim() ? message.role.trim() : "unknown";
  const content = typeof message.content === "string" ? trimTranscriptText(message.content) : "";
  if (!content) return null;
  return `${index + 1}. ${role}: ${content}`;
}
function buildTitleTranscript(messages) {
  if (messages.length === 0) return "";
  const selected = messages.length <= GENERATED_TITLE_HEAD_MESSAGES + GENERATED_TITLE_TAIL_MESSAGES ? messages : [
    ...messages.slice(0, GENERATED_TITLE_HEAD_MESSAGES),
    ...messages.slice(-GENERATED_TITLE_TAIL_MESSAGES)
  ];
  const chunks = [];
  let used = 0;
  for (let index = 0; index < selected.length; index += 1) {
    if (messages.length > selected.length && index === GENERATED_TITLE_HEAD_MESSAGES) {
      const omittedCount = messages.length - selected.length;
      const omitted = `... ${omittedCount} earlier middle messages omitted for brevity ...`;
      if (used + omitted.length > GENERATED_TITLE_TRANSCRIPT_BUDGET) break;
      chunks.push(omitted);
      used += omitted.length + 1;
    }
    const rawIndex = messages.length <= selected.length ? index : index < GENERATED_TITLE_HEAD_MESSAGES ? index : messages.length - (selected.length - index);
    const formatted = formatTranscriptMessage(selected[index], rawIndex);
    if (!formatted) continue;
    if (used + formatted.length > GENERATED_TITLE_TRANSCRIPT_BUDGET) break;
    chunks.push(formatted);
    used += formatted.length + 1;
  }
  return chunks.join("\n");
}
function extractJsonTitle(rawText) {
  const trimmed = rawText.trim();
  const withoutFence = trimmed.replace(/^```(?:json|JSON)?\s*/i, "").replace(/```$/i, "").trim();
  for (const candidate of [withoutFence, trimmed]) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed.title === "string" && parsed.title.trim()) return parsed.title.trim();
    } catch {
    }
  }
  const jsonMatch = withoutFence.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  if (!jsonMatch?.[1]) return null;
  try {
    return JSON.parse(`"${jsonMatch[1]}"`);
  } catch {
    return jsonMatch[1];
  }
}
function extractQuotedTitle(rawText) {
  const titlePattern = /(?:title|thread title|concise title)\s*(?:is|would be|should be|:)\s*["“']([^"”'\n.]+)["”']/i;
  const titleMatch = rawText.match(titlePattern);
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim();
  const quoted = rawText.match(/["“']([^"”'\n.]{6,80})["”']/);
  return quoted?.[1]?.trim() ?? null;
}
function stripVerboseTitlePreamble(value) {
  let next = value.trim();
  next = next.replace(/^(?:sure|okay|ok)[,.:\s-]+/i, "").replace(/^(?:here(?:'|’)s|here is)\s+(?:a\s+)?(?:concise\s+)?(?:thread\s+)?title\s*(?:for\s+this\s+thread)?\s*[:—–-]?\s*/i, "").replace(/^(?:i(?:'|’)d|i would)\s+(?:title|call)\s+(?:this\s+)?(?:thread\s+)?[:—–-]?\s*/i, "").replace(/^(?:the\s+)?(?:generated\s+)?(?:thread\s+)?title\s*(?:is|would be|should be)?\s*[:—–-]?\s*/i, "").replace(/^(?:this|the)\s+(?:thread|conversation|chat|session)\s+(?:is\s+)?(?:about|focused\s+on|focuses\s+on|covers|discusses|summarizes)\s+/i, "").replace(/^about\s+/i, "").trim();
  return next;
}
function titleCaseToken(token) {
  if (!token) return token;
  const override = TITLE_TOKEN_OVERRIDES.get(token.toLowerCase());
  if (override) return override;
  if (/[A-Z].*[A-Z]/.test(token) || /\d/.test(token)) return token;
  return token.split("-").map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : part).join("-");
}
function tokenizeTitle(value) {
  const cleaned = stripVerboseTitlePreamble(value).replace(/[\[\]{}()*_`~<>]/g, " ").replace(/[,:;.!?]+/g, " ").replace(/[“”"']/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  let tokens = cleaned.split(/\s+/).map((token) => token.replace(/^[^A-Za-z0-9+#./-]+|[^A-Za-z0-9+#./-]+$/g, "")).filter(Boolean);
  while (tokens.length > GENERATED_TITLE_MIN_WORDS && LEADING_FILLER_WORDS.has(tokens[0].toLowerCase())) {
    tokens = tokens.slice(1);
  }
  if (tokens.length > GENERATED_TITLE_MAX_WORDS) {
    const withoutFiller = tokens.filter((token) => !FILLER_WORDS.has(token.toLowerCase()));
    if (withoutFiller.length >= GENERATED_TITLE_MIN_WORDS) tokens = withoutFiller;
  }
  return tokens;
}
function coerceTitlePhrase(value) {
  const cleaned = cleanSessionTitleCandidate(value);
  if (!cleaned) return null;
  const tokens = tokenizeTitle(cleaned);
  if (tokens.length === 0) return null;
  const selected = tokens.slice(0, GENERATED_TITLE_MAX_WORDS).map(titleCaseToken);
  if (selected.length < GENERATED_TITLE_MIN_WORDS) return null;
  const title = truncateHard(selected.join(" "), GENERATED_TITLE_MAX_CHARS);
  return title || null;
}
function isOperationalNonTitleLine(value) {
  const normalized = value.trim();
  if (!normalized) return false;
  return /^(?:reading additional input from stdin|openai codex v|workdir:|model:|provider:|approval:|sandbox:|reasoning(?:\s|:)|session id:|--------|user$|assistant$|system$)/i.test(normalized);
}
function isGenericFallbackTitle(value) {
  const comparable = normalizeComparableSessionTitle(value);
  if (!comparable) return true;
  if (comparable.endsWith(" session")) return true;
  return /^(?:untitled chat thread|untitled thread|untitled chat|new chat|new thread|chat thread|old fallback title|long old thread title)$/.test(comparable);
}
const FALLBACK_TITLE_STOPWORDS = /* @__PURE__ */ new Set([
  ...Array.from(FILLER_WORDS),
  "about",
  "also",
  "assistant",
  "back",
  "because",
  "can",
  "comes",
  "current",
  "does",
  "done",
  "error",
  "from",
  "have",
  "into",
  "invoking",
  "make",
  "message",
  "messages",
  "method",
  "need",
  "needs",
  "ok",
  "okay",
  "please",
  "remote",
  "remove",
  "return",
  "sure",
  "task",
  "text",
  "thi",
  "use",
  "user",
  "wee",
  "why"
]);
const FALLBACK_DOMAIN_ORDER = [
  "bypass",
  "codex",
  "mcp",
  "config",
  "ignore",
  "title",
  "generation",
  "sidebar",
  "race",
  "thread",
  "daemon",
  "dreaming",
  "electron",
  "renderer",
  "preload",
  "provider",
  "model"
];
function normalizeFallbackToken(token) {
  const normalized = token.toLowerCase().replace(/^[^a-z0-9+#./-]+|[^a-z0-9+#./-]+$/g, "");
  if (!normalized || normalized.length < 2) return null;
  if (/^\d+(?:\.\d+)*$/.test(normalized)) return null;
  if (FALLBACK_TITLE_STOPWORDS.has(normalized)) return null;
  if (normalized === "coedx") return "codex";
  if (normalized === "configg") return "config";
  return normalized;
}
function deriveFallbackSessionTitle(transcript, fallback) {
  const fallbackTitle = coerceTitlePhrase(fallback);
  if (fallbackTitle && !isGenericFallbackTitle(fallbackTitle)) return fallbackTitle;
  const weights = /* @__PURE__ */ new Map();
  for (const rawLine of String(transcript ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || isOperationalNonTitleLine(line)) continue;
    const roleMatch = line.match(/^\d+\.\s*(user|assistant|system|tool)\s*:\s*(.*)$/i);
    const role = roleMatch?.[1]?.toLowerCase() ?? "";
    const content = roleMatch?.[2] ?? line;
    const baseWeight = role === "user" ? 4 : role === "assistant" ? 1 : 2;
    const tokens = content.match(/[A-Za-z][A-Za-z0-9+#./-]*/g) ?? [];
    for (const token of tokens) {
      const normalized = normalizeFallbackToken(token);
      if (!normalized) continue;
      const domainBoost = FALLBACK_DOMAIN_ORDER.includes(normalized) ? 3 : 0;
      weights.set(normalized, (weights.get(normalized) ?? 0) + baseWeight + domainBoost);
    }
  }
  const domainTokens = FALLBACK_DOMAIN_ORDER.filter((token) => weights.has(token));
  let selected = domainTokens.length >= GENERATED_TITLE_MIN_WORDS ? domainTokens.slice(0, GENERATED_TITLE_MAX_WORDS) : Array.from(weights.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([token]) => token).slice(0, GENERATED_TITLE_MAX_WORDS);
  if (selected.length < GENERATED_TITLE_MIN_WORDS && domainTokens.length > 0) {
    selected = Array.from(/* @__PURE__ */ new Set([...selected, ...domainTokens])).slice(0, GENERATED_TITLE_MAX_WORDS);
  }
  const derived = coerceTitlePhrase(selected.map(titleCaseToken).join(" "));
  return derived ?? fallbackTitle ?? "Untitled Chat Thread";
}
function sanitizeGeneratedSessionTitle(raw, fallback) {
  const rawText = String(raw ?? "").trim();
  const fallbackTitle = coerceTitlePhrase(fallback) ?? "Untitled Chat Thread";
  if (!rawText) return fallbackTitle;
  const candidates = [
    extractJsonTitle(rawText),
    extractQuotedTitle(rawText),
    ...rawText.split(/\r?\n/)
  ].filter((value) => typeof value === "string" && value.trim().length > 0);
  for (const candidate of candidates) {
    const normalized = stripVerboseTitlePreamble(candidate).replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!normalized) continue;
    if (isOperationalNonTitleLine(normalized)) continue;
    if (/^(?:i('|’)ll|i will|let me|i can|based on)\b/i.test(normalized)) continue;
    if (/\b(?:read|reading|transcript|understand|appropriate title)\b/i.test(normalized)) continue;
    const title = coerceTitlePhrase(normalized);
    if (title) return title;
  }
  return fallbackTitle;
}
function buildSessionTitlePrompt(input) {
  return [
    "Task: Generate a title for this thread.",
    "This is title generation only. Do not answer the transcript. Do not summarize in a sentence.",
    'Return JSON only: {"title":"Three Four Word Title"}.',
    "The title value must be 3 to 4 words.",
    "Use the concrete task, bug, feature, or decision that best represents the whole thread.",
    "No preamble. No markdown. No quotes inside the title. No trailing punctuation.",
    "Avoid generic words unless they are part of the actual topic.",
    `Keep the title under ${GENERATED_TITLE_MAX_CHARS} characters.`,
    "",
    `Current title: ${input.currentTitle}`,
    `Provider: ${input.provider || "unknown"}`,
    `Model: ${input.model || "unknown"}`,
    `Message count: ${input.messageCount}`,
    "",
    "Transcript:",
    input.transcript
  ].join("\n");
}
function normalizeComparableSessionTitle(value) {
  return (cleanSessionTitleCandidate(value) ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}
function hasSessionTitleChangedDuringGeneration(initialTitle, currentTitle) {
  const initial = normalizeComparableSessionTitle(initialTitle);
  const current = normalizeComparableSessionTitle(currentTitle);
  if (!current) return false;
  if (!initial) return true;
  return initial !== current;
}
function createSessionTitleGenerationGate() {
  const inFlight = /* @__PURE__ */ new Map();
  return {
    isRunning: (key) => inFlight.has(key),
    run: (key, factory) => {
      const existing = inFlight.get(key);
      if (existing) return existing;
      const promise = Promise.resolve().then(factory).finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key);
      });
      inFlight.set(key, promise);
      return promise;
    }
  };
}
const tileSessionSummaryCache = /* @__PURE__ */ new Map();
const sessionTitleGenerationGate = createSessionTitleGenerationGate();
function truncateSessionText(text, length = 120) {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > length ? normalized.slice(0, length) : normalized;
}
function extractInitialSessionTitle(messages) {
  for (const rawMessage of messages) {
    if (!rawMessage || typeof rawMessage !== "object") continue;
    const text = truncateSessionText(typeof rawMessage.content === "string" ? rawMessage.content : null);
    const title = cleanSessionTitleCandidate(text);
    if (title) return title;
  }
  return null;
}
function extractTileSessionSummary(tileId, state) {
  if (!state || typeof state !== "object") return null;
  const record = state;
  const messages = Array.isArray(record.messages) ? record.messages : null;
  if (!messages || messages.length === 0) return null;
  let lastMessage = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    const text = truncateSessionText(typeof message.content === "string" ? message.content : null);
    if (text) {
      lastMessage = text;
      break;
    }
  }
  const provider = typeof record.provider === "string" && record.provider.trim() ? record.provider : "claude";
  const model = typeof record.model === "string" ? record.model : "";
  const sessionId = typeof record.sessionId === "string" ? record.sessionId : null;
  const explicitTitle = cleanSessionTitleCandidate(typeof record.title === "string" ? record.title : null);
  return {
    version: 1,
    tileId,
    sessionId,
    provider,
    model,
    messageCount: messages.length,
    lastMessage,
    title: explicitTitle ?? extractInitialSessionTitle(messages) ?? `${provider} session`,
    updatedAt: Date.now()
  };
}
function isLocalSessionEntry(sessionEntryId) {
  return sessionEntryId.startsWith("codesurf-runtime:") || sessionEntryId.startsWith("codesurf-tile:") || sessionEntryId.startsWith("codesurf-job:");
}
async function generateTitleWithClaude(prompt, model = GENERATED_TITLE_MODEL) {
  const options = {
    model,
    permissionMode: "plan",
    thinking: { type: "disabled" },
    tools: [],
    maxTurns: 1,
    includePartialMessages: false,
    persistSession: false
  };
  const claudePath = getAgentPath("claude");
  if (claudePath) {
    ;
    options.pathToClaudeCodeExecutable = claudePath;
  }
  const q = claudeAgentSdk.query({ prompt, options });
  let text = "";
  for await (const msg of q) {
    if (msg.type === "assistant") {
      const blocks = msg.message?.content ?? [];
      text += blocks.filter((block) => block?.type === "text" && typeof block.text === "string").map((block) => block.text).join("");
    } else if (msg.type === "result" && typeof msg.result === "string" && msg.result.trim()) {
      text = msg.result;
    }
  }
  return text.trim();
}
function extractOpenAiCompatibleTitleText(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  for (const choice of choices) {
    const messageContent = choice?.message?.content;
    if (typeof messageContent === "string" && messageContent.trim()) return messageContent.trim();
    if (Array.isArray(messageContent)) {
      const text = messageContent.map((part) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("").trim();
      if (text) return text;
    }
    if (typeof choice?.text === "string" && choice.text.trim()) return choice.text.trim();
  }
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  if (Array.isArray(payload?.output)) {
    const text = payload.output.flatMap((item) => Array.isArray(item?.content) ? item.content : []).map((part) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("").trim();
    if (text) return text;
  }
  return "";
}
function providerErrorMessage(payload, raw, fallback) {
  const value = payload?.error?.message ?? payload?.error?.details ?? payload?.error ?? payload?.message ?? raw ?? fallback;
  return redactTitleGenerationError(String(value || fallback)).slice(0, 500);
}
function buildOpenAiCompatibleTitleBody(candidate, prompt) {
  const messages = [
    {
      role: "system",
      content: 'Generate compact thread titles only. Return JSON only: {"title":"Three Four Word Title"}. No markdown, no explanation, no tools.'
    },
    { role: "user", content: prompt }
  ];
  if (candidate.provider === "openai") {
    return {
      model: candidate.model,
      stream: false,
      max_completion_tokens: 80,
      messages
    };
  }
  return {
    model: candidate.model,
    stream: false,
    max_tokens: 80,
    temperature: 0,
    messages
  };
}
async function generateTitleWithOpenAiCompatible(prompt, candidate) {
  const response = await fetch(`${candidate.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${candidate.apiKey}`,
      ...candidate.provider === "openrouter" ? {
        "HTTP-Referer": "https://codesurf.local",
        "X-Title": "CodeSurf"
      } : {}
    },
    body: JSON.stringify(buildOpenAiCompatibleTitleBody(candidate, prompt)),
    signal: AbortSignal.timeout(2e4)
  });
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw.trim() ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(`${candidate.provider} title request failed (${response.status}): ${providerErrorMessage(payload, raw, response.statusText)}`);
  }
  const text = extractOpenAiCompatibleTitleText(payload);
  if (!text) throw new Error(`${candidate.provider} title request returned no text`);
  return text;
}
async function generateTitleWithCandidate(prompt, candidate) {
  if (candidate.kind === "claude-sdk") return generateTitleWithClaude(prompt, candidate.model);
  return generateTitleWithOpenAiCompatible(prompt, candidate);
}
async function generateSessionTitleFromMessages(session, messages) {
  const transcript = buildTitleTranscript(messages);
  const fallbackTitle = cleanSessionTitleCandidate(session.title, GENERATED_TITLE_MAX_CHARS) ?? "Untitled Chat Thread";
  if (!transcript) return fallbackTitle;
  const prompt = buildSessionTitlePrompt({
    currentTitle: fallbackTitle,
    provider: session.provider || "unknown",
    model: session.model || "unknown",
    messageCount: messages.length,
    transcript
  });
  const candidates = resolveSessionTitleModelCandidates({
    provider: session.provider,
    model: session.model
  });
  for (const candidate of candidates) {
    try {
      const generated = await generateTitleWithCandidate(prompt, candidate);
      return sanitizeGeneratedSessionTitle(generated, fallbackTitle);
    } catch (error) {
      console.warn(
        `[sessions] ${describeSessionTitleModelCandidate(candidate)} title generation failed, trying next title fallback:`,
        redactTitleGenerationError(error)
      );
    }
  }
  if (candidates.length === 0) {
    console.warn("[sessions] No provider title model configured, using local title fallback.");
  } else {
    console.warn("[sessions] Provider title generation failed, using local title fallback.");
  }
  return deriveFallbackSessionTitle(transcript, fallbackTitle);
}
async function loadSessionStateForTitleGeneration(workspaceId, sessionEntryId, entryHint) {
  const workspacePath = await getWorkspacePathById(workspaceId);
  if (isLocalSessionEntry(sessionEntryId)) {
    const local = await daemonClient.getLocalSessionState(workspaceId, sessionEntryId).catch(() => null);
    if (local && Array.isArray(local.messages)) {
      return {
        provider: typeof local.provider === "string" ? local.provider : entryHint?.provider ?? "claude",
        model: typeof local.model === "string" ? local.model : entryHint?.model ?? "",
        messages: local.messages
      };
    }
    if (sessionEntryId.startsWith("codesurf-tile:tile-state-")) {
      const tileId = sessionEntryId.replace("codesurf-tile:tile-state-", "").replace(/\.json$/, "");
      const tileState = await loadWorkspaceTileState(workspaceId, tileId, null);
      if (tileState && Array.isArray(tileState.messages)) {
        return {
          provider: typeof tileState.provider === "string" ? tileState.provider : entryHint?.provider ?? "claude",
          model: typeof tileState.model === "string" ? tileState.model : entryHint?.model ?? "",
          messages: tileState.messages
        };
      }
    }
    throw new Error("Could not load local session transcript.");
  }
  const external = await getExternalSessionChatState(workspacePath, sessionEntryId, { entryHint }).catch(() => null);
  if (external && Array.isArray(external.messages)) {
    return {
      provider: external.provider,
      model: external.model,
      messages: external.messages
    };
  }
  const fallback = await daemonClient.getExternalSessionState(workspacePath, sessionEntryId).catch(() => null);
  if (fallback && Array.isArray(fallback.messages)) {
    return {
      provider: typeof fallback.provider === "string" ? fallback.provider : entryHint?.provider ?? "unknown",
      model: typeof fallback.model === "string" ? fallback.model : entryHint?.model ?? "",
      messages: fallback.messages
    };
  }
  throw new Error("Could not load session transcript.");
}
async function getCurrentSessionTitleForTitleGeneration(workspaceId, sessionEntryId, workspacePath) {
  if (isLocalSessionEntry(sessionEntryId)) {
    const localSessions = await daemonClient.listLocalSessions(workspaceId).catch(() => []);
    const match = localSessions.find((session) => session.id === sessionEntryId);
    return typeof match?.title === "string" ? match.title : null;
  }
  const indexedMatch = listThreadsFromDb(workspacePath).find((session) => session.id === sessionEntryId);
  if (typeof indexedMatch?.title === "string") return indexedMatch.title;
  const daemonMatch = await daemonClient.listExternalSessions(workspacePath, true).then((sessions) => sessions.find((session) => session.id === sessionEntryId) ?? null).catch(() => null);
  return typeof daemonMatch?.title === "string" ? daemonMatch.title : null;
}
async function renameSessionTitleForSidebar(workspaceId, sessionEntryId, workspacePath, title) {
  if (isLocalSessionEntry(sessionEntryId)) {
    return await daemonClient.renameLocalSession(workspaceId, sessionEntryId, title).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }));
  }
  const scopedResult = await daemonClient.renameExternalSession(workspacePath, sessionEntryId, title).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }));
  if (scopedResult.ok) {
    renameIndexedThread(sessionEntryId, title);
    return scopedResult;
  }
  const globalResult = workspacePath ? await daemonClient.renameExternalSession(null, sessionEntryId, title).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  })) : scopedResult;
  if (globalResult.ok) {
    renameIndexedThread(sessionEntryId, title);
    return globalResult;
  }
  if (renameIndexedThread(sessionEntryId, title)) return { ok: true, title };
  return globalResult.ok ? globalResult : scopedResult;
}
function sameTileSessionSummary(a, b) {
  if (!a || !b) return a === b;
  return a.tileId === b.tileId && a.sessionId === b.sessionId && a.provider === b.provider && a.model === b.model && a.messageCount === b.messageCount && a.lastMessage === b.lastMessage && a.title === b.title;
}
async function readTileSessionSummary(summaryPath) {
  if (tileSessionSummaryCache.has(summaryPath)) {
    return tileSessionSummaryCache.get(summaryPath) ?? null;
  }
  try {
    const raw = await fs.promises.readFile(summaryPath, "utf8");
    const parsed = JSON.parse(raw);
    tileSessionSummaryCache.set(summaryPath, parsed);
    return parsed;
  } catch {
    tileSessionSummaryCache.set(summaryPath, null);
    return null;
  }
}
async function writeTileSessionSummary(storageId, tileId, state) {
  const summaryPath = tileSessionSummaryPath(storageId, tileId);
  const previous = await readTileSessionSummary(summaryPath);
  const record = state && typeof state === "object" ? state : null;
  const linkedSessionEntryId = typeof record?.linkedSessionEntryId === "string" ? record.linkedSessionEntryId.trim() : "";
  const preserveSessionSummary = record?.preserveSessionSummary === true;
  if (linkedSessionEntryId) {
    const changed = previous !== null;
    await deleteFileIfExists(summaryPath);
    tileSessionSummaryCache.set(summaryPath, null);
    return { changed, summary: null };
  }
  if (preserveSessionSummary) {
    if (previous) {
      tileSessionSummaryCache.set(summaryPath, previous);
      return { changed: false, summary: previous };
    }
    tileSessionSummaryCache.set(summaryPath, null);
    return { changed: false, summary: null };
  }
  const next = extractTileSessionSummary(tileId, state);
  if (!next) {
    const changed = previous !== null;
    await deleteFileIfExists(summaryPath);
    tileSessionSummaryCache.set(summaryPath, null);
    return { changed, summary: null };
  }
  if (sameTileSessionSummary(previous, next)) {
    const stable = previous ?? next;
    tileSessionSummaryCache.set(summaryPath, stable);
    return { changed: false, summary: stable };
  }
  const summaryToWrite = {
    ...next,
    updatedAt: previous ? Date.now() : next.updatedAt
  };
  await writeJsonArtifactAtomic(summaryPath, summaryToWrite);
  tileSessionSummaryCache.set(summaryPath, summaryToWrite);
  return { changed: true, summary: summaryToWrite };
}
const sessionSummarySignatures = /* @__PURE__ */ new Map();
const SESSIONS_CHANGED_DEBOUNCE_MS = 3e3;
const sessionsChangedTimers = /* @__PURE__ */ new Map();
const sessionsChangedCallCounts = /* @__PURE__ */ new Map();
function broadcastSessionsChanged(workspaceId, reason = "unknown") {
  const key = workspaceId || "*";
  const existing = sessionsChangedTimers.get(key);
  const callCount = (sessionsChangedCallCounts.get(key) ?? 0) + 1;
  sessionsChangedCallCounts.set(key, callCount);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    sessionsChangedTimers.delete(key);
    const count = sessionsChangedCallCounts.get(key) ?? 1;
    sessionsChangedCallCounts.delete(key);
    console.log(`[sessions] broadcast workspaceId=${workspaceId || "(empty)"} reason=${reason} coalesced=${count}`);
    broadcastToRenderer("canvas:sessionsChanged", { workspaceId });
  }, SESSIONS_CHANGED_DEBOUNCE_MS);
  if (typeof timer.unref === "function") timer.unref();
  sessionsChangedTimers.set(key, timer);
}
function broadcastSessionsChangedNow(workspaceId, reason = "explicit") {
  const existing = sessionsChangedTimers.get(workspaceId || "*");
  if (existing) {
    clearTimeout(existing);
    sessionsChangedTimers.delete(workspaceId || "*");
  }
  sessionsChangedCallCounts.delete(workspaceId || "*");
  console.log(`[sessions] broadcast(now) workspaceId=${workspaceId || "(empty)"} reason=${reason}`);
  broadcastToRenderer("canvas:sessionsChanged", { workspaceId });
}
async function readWorkspaceArchivedSessionIds(workspaceId) {
  const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
  const paths = storageIds.map((storageId) => sessionArchiveStatePath(storageId));
  return await readArchivedSessionIds(paths);
}
async function setWorkspaceSessionArchived(workspaceId, sessionEntryId, archived) {
  const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
  const primaryStorageId = storageIds[0] ?? workspaceId;
  const archivePath = sessionArchiveStatePath(primaryStorageId);
  const archivedIds = await readArchivedSessionIds(storageIds.map((storageId) => sessionArchiveStatePath(storageId)));
  const hadEntry = archivedIds.has(sessionEntryId);
  if (archived) archivedIds.add(sessionEntryId);
  else archivedIds.delete(sessionEntryId);
  if (hadEntry === archived) return false;
  await writeArchivedSessionIds(archivePath, Array.from(archivedIds));
  return true;
}
function applyArchivedSessionState(sessions, archivedIds) {
  return sessions.map((session) => {
    const isArchived = archivedIds.has(session.id);
    return session.isArchived === isArchived ? session : { ...session, isArchived };
  });
}
function normalizeSessionPath(path2) {
  const normalized = String(path2 ?? "").trim();
  return normalized || null;
}
function listIndexedSessionsForWorkspacePaths(workspaceProjectPaths) {
  const byId = /* @__PURE__ */ new Map();
  for (const projectPath of workspaceProjectPaths) {
    const normalizedPath = normalizeSessionPath(projectPath);
    if (!normalizedPath) continue;
    const scopedEntries = listThreadsFromDb(normalizedPath);
    for (const entry of scopedEntries) {
      const existing = byId.get(entry.id);
      if (!existing || entry.updatedAt > existing.updatedAt) {
        byId.set(entry.id, entry);
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
function sessionIdentityAgent(entry) {
  if (entry.source === "codesurf") {
    const provider = String(entry.provider ?? "").trim().toLowerCase();
    if (provider) return provider;
  }
  return String(entry.source ?? "codesurf").trim().toLowerCase() || "codesurf";
}
function normalizeSessionIdentityText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}
function fallbackSessionIdentityKey(entry) {
  const agent = sessionIdentityAgent(entry);
  const title = normalizeSessionIdentityText(entry.title);
  if (!agent || !title) return null;
  const projectPath = normalizeSessionIdentityText(entry.projectPath);
  return `${agent}:${projectPath}:${title}`;
}
function mergeSessionEntries(localSessions, nativeSessions) {
  const byKey = /* @__PURE__ */ new Map();
  const priority = (entry) => {
    if (entry.id.startsWith("codesurf-runtime:")) return 5;
    if (entry.id.startsWith("codesurf-job:")) return 4;
    if (entry.id.startsWith("codesurf-tile:")) return 3;
    return 1;
  };
  const mergeCanonicalMetadata = (preferred, alternate) => {
    const canonical = [preferred, alternate].find(
      (candidate) => candidate.source !== "codesurf" && typeof candidate.title === "string" && candidate.title.trim().length > 0
    ) ?? null;
    if (!canonical) return preferred;
    return {
      ...preferred,
      title: canonical.title,
      filePath: preferred.filePath || canonical.filePath,
      sizeBytes: typeof preferred.sizeBytes === "number" && preferred.sizeBytes > 0 ? preferred.sizeBytes : canonical.sizeBytes,
      sourceDetail: preferred.sourceDetail || canonical.sourceDetail,
      model: preferred.model || canonical.model
    };
  };
  for (const entry of [...nativeSessions, ...localSessions]) {
    const key = entry.sessionId ? `session:${sessionIdentityAgent(entry)}:${entry.sessionId}` : `entry:${entry.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      continue;
    }
    const existingPriority = priority(existing);
    const nextPriority = priority(entry);
    if (nextPriority > existingPriority || nextPriority === existingPriority && entry.updatedAt > existing.updatedAt) {
      byKey.set(key, mergeCanonicalMetadata(entry, existing));
      continue;
    }
    byKey.set(key, mergeCanonicalMetadata(existing, entry));
  }
  const merged = [...byKey.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  const hermesNativeByFallbackKey = /* @__PURE__ */ new Map();
  for (const entry of merged) {
    if (entry.source !== "hermes" || !entry.sessionId) continue;
    const key = fallbackSessionIdentityKey(entry);
    if (key) hermesNativeByFallbackKey.set(key, entry);
  }
  return merged.filter((entry) => {
    if (entry.source !== "codesurf") return true;
    if (sessionIdentityAgent(entry) !== "hermes") return true;
    if (entry.sessionId) return true;
    const key = fallbackSessionIdentityKey(entry);
    const native = key ? hermesNativeByFallbackKey.get(key) : null;
    if (!native) return true;
    const timeDelta = Math.abs((entry.updatedAt || 0) - (native.updatedAt || 0));
    return timeDelta > 30 * 60 * 1e3;
  });
}
function registerCanvasIPC() {
  electron.ipcMain.handle("canvas:load", async (_, workspaceId) => {
    const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
    for (const storageId of storageIds) {
      try {
        const raw = await fs.promises.readFile(canvasStatePath(storageId), "utf8");
        return JSON.parse(raw);
      } catch {
      }
    }
    return null;
  });
  electron.ipcMain.handle("canvas:save", async (_, workspaceId, state) => {
    const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
    const storageId = storageIds[0] ?? workspaceId;
    const path2 = canvasStatePath(storageId);
    await fs.promises.mkdir(path$1.dirname(path2), { recursive: true });
    await writeJsonArtifactAtomic(path2, state);
    if (isRelayHostActive() && state && typeof state === "object" && Array.isArray(state.tiles)) {
      const tiles = state.tiles;
      const wsPath = await getWorkspacePathById(workspaceId);
      if (wsPath) {
        void syncWorkspaceRelayParticipants(workspaceId, wsPath, tiles).catch((err) => {
          console.warn("[Canvas] relay participant sync skipped:", err);
        });
      }
    }
  });
  electron.ipcMain.handle("kanban:load", async (_, workspaceId, tileId) => {
    const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
    for (const storageId of storageIds) {
      try {
        const raw = await fs.promises.readFile(kanbanStatePath(storageId, tileId), "utf8");
        return JSON.parse(raw);
      } catch {
      }
    }
    return null;
  });
  electron.ipcMain.handle("kanban:save", async (_, workspaceId, tileId, state) => {
    const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
    const storageId = storageIds[0] ?? workspaceId;
    const path2 = kanbanStatePath(storageId, tileId);
    await fs.promises.mkdir(path$1.dirname(path2), { recursive: true });
    await writeJsonArtifactAtomic(path2, state);
  });
  electron.ipcMain.handle("canvas:loadTileState", async (_, workspaceId, tileId) => {
    return await loadWorkspaceTileState(workspaceId, tileId, null);
  });
  electron.ipcMain.handle("canvas:saveTileState", async (_, workspaceId, tileId, state) => {
    const { storageId } = await saveWorkspaceTileState(workspaceId, tileId, state);
    const { changed, summary } = await writeTileSessionSummary(storageId, tileId, state);
    const isStreaming = state && typeof state === "object" && state.isStreaming === true;
    const prevKey = sessionSummarySignatures.get(`${storageId}:${tileId}`) ?? null;
    const nextKey = summary ? `${summary.title}|${summary.messageCount}` : null;
    const titleOrFirstSaveChanged = prevKey === null ? nextKey !== null : nextKey !== null && prevKey.split("|")[0] !== nextKey.split("|")[0];
    if (summary) sessionSummarySignatures.set(`${storageId}:${tileId}`, nextKey);
    else sessionSummarySignatures.delete(`${storageId}:${tileId}`);
    if (changed && !isStreaming && titleOrFirstSaveChanged) {
      broadcastSessionsChanged(workspaceId, "saveTileState/title");
    }
  });
  electron.ipcMain.handle("canvas:clearTileState", async (_, workspaceId, tileId) => {
    const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
    await Promise.all(storageIds.flatMap((storageId) => [
      deleteFileIfExists(tileStatePath(storageId, tileId)),
      deleteFileIfExists(tileSessionSummaryPath(storageId, tileId))
    ]));
    for (const storageId of storageIds) {
      tileSessionSummaryCache.delete(tileSessionSummaryPath(storageId, tileId));
    }
    broadcastSessionsChanged(workspaceId);
  });
  electron.ipcMain.handle("canvas:listSessions", async (_, workspaceId, forceRefresh = false) => {
    assertSafeWorkspaceArtifactId(workspaceId);
    const workspaces = await daemonClient.listWorkspaces().catch(() => []);
    const workspaceEntry = workspaces.find((entry) => entry.id === workspaceId) ?? null;
    const workspacePath = normalizeSessionPath(workspaceEntry?.path) ?? await getWorkspacePathById(workspaceId);
    const workspaceProjectPaths = new Set(
      (workspaceEntry?.projectPaths ?? []).map((projectPath) => normalizeSessionPath(projectPath)).filter((projectPath) => Boolean(projectPath))
    );
    if (workspacePath) workspaceProjectPaths.add(workspacePath);
    const localSessions = await daemonClient.listLocalSessions(workspaceId).catch(() => []);
    for (const session of localSessions) {
      if (!session.projectPath) session.projectPath = workspacePath;
    }
    let nativeSessions = [];
    if (workspaceProjectPaths.size > 0) {
      if (forceRefresh) {
        await indexAllSources().catch((error) => {
          console.warn("[sessions] thread index refresh failed:", error);
        });
      }
      nativeSessions = listIndexedSessionsForWorkspacePaths(workspaceProjectPaths);
      if (nativeSessions.length === 0) {
        await indexAllSources().catch((error) => {
          console.warn("[sessions] initial thread index build failed:", error);
        });
        nativeSessions = listIndexedSessionsForWorkspacePaths(workspaceProjectPaths);
      }
    }
    const relevantNativeSessions = nativeSessions.filter((session) => session.source !== "codesurf").map((session) => ({
      ...session,
      projectPath: normalizeSessionPath(session.projectPath) ?? workspacePath
    }));
    const archivedIds = await readWorkspaceArchivedSessionIds(workspaceId);
    return applyArchivedSessionState(mergeSessionEntries(localSessions, relevantNativeSessions), archivedIds);
  });
  electron.ipcMain.handle("threads:indexStatus", () => {
    try {
      return { ok: true, status: getIndexerStatus() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  electron.ipcMain.handle("threads:reindex", async () => {
    try {
      await indexAllSources({ force: true });
      return { ok: true, ...getIndexerStatus() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  electron.ipcMain.handle("canvas:getSessionState", async (_, workspaceId, sessionEntryId, options) => {
    const workspacePath = await getWorkspacePathById(workspaceId);
    if (sessionEntryId.startsWith("codesurf-runtime:") || sessionEntryId.startsWith("codesurf-tile:") || sessionEntryId.startsWith("codesurf-job:")) {
      const local2 = await daemonClient.getLocalSessionState(workspaceId, sessionEntryId).catch(() => null);
      if (local2) return local2;
      if (sessionEntryId.startsWith("codesurf-tile:tile-state-")) {
        const tileId = sessionEntryId.replace("codesurf-tile:tile-state-", "").replace(/\.json$/, "");
        return await loadWorkspaceTileState(workspaceId, tileId, null);
      }
      return null;
    }
    const local = await getExternalSessionChatState(workspacePath, sessionEntryId, {
      entryHint: options?.entryHint ?? null,
      tailLimit: typeof options?.tailLimit === "number" ? options.tailLimit : void 0
    }).catch(() => null);
    if (local) return local;
    return await daemonClient.getExternalSessionState(workspacePath, sessionEntryId).catch(() => null);
  });
  electron.ipcMain.handle("canvas:deleteSession", async (_, workspaceId, sessionEntryId) => {
    assertSafeWorkspaceArtifactId(workspaceId);
    const workspacePath = await getWorkspacePathById(workspaceId);
    if (sessionEntryId.startsWith("codesurf-runtime:") || sessionEntryId.startsWith("codesurf-tile:") || sessionEntryId.startsWith("codesurf-job:")) {
      const result2 = await daemonClient.deleteLocalSession(workspaceId, sessionEntryId).catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }));
      if (result2.ok) broadcastSessionsChangedNow(workspaceId);
      return result2;
    }
    const result = await daemonClient.deleteExternalSession(workspacePath, sessionEntryId).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }));
    if (result.ok) {
      await indexAllSources().catch((error) => {
        console.warn("[sessions] thread index refresh after delete failed:", error);
      });
      broadcastSessionsChangedNow(workspaceId);
    }
    return result;
  });
  electron.ipcMain.handle("canvas:renameSession", async (_, workspaceId, sessionEntryId, title) => {
    assertSafeWorkspaceArtifactId(workspaceId);
    const workspacePath = await getWorkspacePathById(workspaceId);
    const result = await renameSessionTitleForSidebar(workspaceId, sessionEntryId, workspacePath, title);
    if (result.ok) {
      broadcastSessionsChangedNow(workspaceId);
    }
    return result;
  });
  electron.ipcMain.handle("canvas:generateSessionTitle", async (_, workspaceId, sessionEntryId, entryHint) => {
    assertSafeWorkspaceArtifactId(workspaceId);
    const generationKey = `${workspaceId}::${sessionEntryId}`;
    return await sessionTitleGenerationGate.run(generationKey, async () => {
      const workspacePath = await getWorkspacePathById(workspaceId);
      const currentTitleBeforeGeneration = await getCurrentSessionTitleForTitleGeneration(workspaceId, sessionEntryId, workspacePath);
      const initialTitle = cleanSessionTitleCandidate(entryHint?.title) ?? currentTitleBeforeGeneration ?? "";
      const state = await loadSessionStateForTitleGeneration(workspaceId, sessionEntryId, entryHint ?? null);
      if (!Array.isArray(state.messages) || state.messages.length === 0) {
        return { ok: false, error: "Session has no transcript to title." };
      }
      const title = await generateSessionTitleFromMessages({
        id: sessionEntryId,
        source: entryHint?.source ?? "codesurf",
        provider: state.provider,
        model: state.model,
        messageCount: state.messages.length,
        title: initialTitle,
        sessionId: entryHint?.sessionId ?? null,
        filePath: entryHint?.filePath,
        projectPath: entryHint?.projectPath ?? null
      }, state.messages);
      if (!title.trim()) {
        return { ok: false, error: "Title generation returned an empty title." };
      }
      const currentTitle = await getCurrentSessionTitleForTitleGeneration(workspaceId, sessionEntryId, workspacePath);
      if (hasSessionTitleChangedDuringGeneration(initialTitle, currentTitle)) {
        return {
          ok: false,
          error: "Thread title changed while title generation was running; generated title was not applied."
        };
      }
      const result = await renameSessionTitleForSidebar(workspaceId, sessionEntryId, workspacePath, title);
      if (result.ok) {
        broadcastSessionsChangedNow(workspaceId, "generateSessionTitle");
      }
      return result.ok ? { ok: true, title } : { ok: false, error: result.error || "Failed to apply generated title." };
    });
  });
  electron.ipcMain.handle("canvas:setSessionArchived", async (_, workspaceId, sessionEntryId, archived) => {
    assertSafeWorkspaceArtifactId(workspaceId);
    const changed = await setWorkspaceSessionArchived(workspaceId, sessionEntryId, archived).catch((error) => {
      throw new Error(error instanceof Error ? error.message : String(error));
    });
    if (changed) broadcastSessionsChangedNow(workspaceId, archived ? "archiveSession" : "unarchiveSession");
    return { ok: true, changed, archived };
  });
  electron.ipcMain.handle("canvas:listCheckpoints", async (_, workspaceId, sessionEntryId) => {
    assertSafeWorkspaceArtifactId(workspaceId);
    if (!sessionEntryId.startsWith("codesurf-runtime:")) return [];
    return await daemonClient.listCheckpoints(workspaceId, sessionEntryId).catch(() => []);
  });
  electron.ipcMain.handle("canvas:restoreCheckpoint", async (_, workspaceId, checkpointId, sessionEntryId) => {
    assertSafeWorkspaceArtifactId(workspaceId);
    const result = await daemonClient.restoreCheckpoint(workspaceId, checkpointId, sessionEntryId ?? null).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }));
    if (result.ok) broadcastSessionsChangedNow(workspaceId);
    return result;
  });
  electron.ipcMain.handle("canvas:deleteTileArtifacts", async (_, workspaceId, tileId) => {
    const storageIds = await ensureWorkspaceStorageMigrated(workspaceId);
    await Promise.all(storageIds.flatMap((storageId) => [
      deleteFileIfExists(tileStatePath(storageId, tileId)),
      deleteFileIfExists(tileSessionSummaryPath(storageId, tileId)),
      deleteFileIfExists(kanbanStatePath(storageId, tileId))
    ]));
    for (const storageId of storageIds) {
      tileSessionSummaryCache.delete(tileSessionSummaryPath(storageId, tileId));
    }
    try {
      await appendQueuedMessageEvent({
        type: "clear",
        at: Date.now(),
        workspaceId,
        tileId
      });
    } catch {
    }
    broadcastSessionsChanged(workspaceId);
  });
  electron.ipcMain.handle("canvas:queuedMessages:append", async (_, event) => {
    if (!event || typeof event !== "object") return;
    const record = event;
    const type = record.type;
    if (type !== "enqueue" && type !== "dispatch" && type !== "delete" && type !== "complete" && type !== "clear") return;
    const workspaceId = typeof record.workspaceId === "string" ? record.workspaceId : "";
    const tileId = typeof record.tileId === "string" ? record.tileId : "";
    if (!workspaceId || !tileId) return;
    const payload = {
      type,
      workspaceId,
      tileId,
      at: typeof record.at === "number" ? record.at : Date.now()
    };
    if (typeof record.queueId === "string") payload.queueId = record.queueId;
    if (typeof record.content === "string") payload.content = record.content;
    if (typeof record.preview === "string") payload.preview = record.preview;
    if (typeof record.attachmentCount === "number") payload.attachmentCount = record.attachmentCount;
    if (typeof record.createdAt === "number") payload.createdAt = record.createdAt;
    await appendQueuedMessageEvent(payload);
  });
  electron.ipcMain.handle("canvas:queuedMessages:listActive", async () => {
    return await listActiveQueuedMessages();
  });
}
function ensureNodePtySpawnHelperExecutable() {
  if (process.platform === "win32") return;
  const candidates = [
    path$1.join(__dirname, "../../node_modules/node-pty/build/Release/spawn-helper"),
    path$1.join(__dirname, "../../node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper"),
    path$1.join(__dirname, "../../node_modules/node-pty/prebuilds/darwin-x64/spawn-helper"),
    path$1.join(__dirname, "../../node_modules/node-pty/prebuilds/linux-x64/spawn-helper"),
    path$1.join(__dirname, "../../node_modules/node-pty/prebuilds/linux-arm64/spawn-helper"),
    path$1.join(process.cwd(), "node_modules/node-pty/build/Release/spawn-helper"),
    path$1.join(process.cwd(), "node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper"),
    path$1.join(process.cwd(), "node_modules/node-pty/prebuilds/darwin-x64/spawn-helper"),
    path$1.join(process.cwd(), "node_modules/node-pty/prebuilds/linux-x64/spawn-helper"),
    path$1.join(process.cwd(), "node_modules/node-pty/prebuilds/linux-arm64/spawn-helper")
  ];
  let found = false;
  for (const helperPath of candidates) {
    try {
      if (!fs.existsSync(helperPath)) continue;
      found = true;
      fs.chmodSync(helperPath, 493);
    } catch {
    }
  }
  if (!found) {
    console.warn("node-pty spawn-helper: no candidates found among checked paths");
  }
}
ensureNodePtySpawnHelperExecutable();
const ALLOWED_SHELLS = /* @__PURE__ */ new Set([
  "/bin/bash",
  "/bin/zsh",
  "/bin/sh",
  "/usr/bin/bash",
  "/usr/bin/zsh",
  "/usr/local/bin/bash",
  "/usr/local/bin/zsh",
  "/usr/local/bin/fish",
  "/opt/homebrew/bin/bash",
  "/opt/homebrew/bin/zsh",
  "/opt/homebrew/bin/fish"
]);
if (process.platform === "win32") {
  ALLOWED_SHELLS.add("powershell.exe");
  ALLOWED_SHELLS.add("pwsh.exe");
  ALLOWED_SHELLS.add("cmd.exe");
  const sysRoot = process.env.SystemRoot || "C:\\Windows";
  ALLOWED_SHELLS.add(`${sysRoot}\\System32\\cmd.exe`);
  ALLOWED_SHELLS.add(`${sysRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`);
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  ALLOWED_SHELLS.add(`${programFiles}\\PowerShell\\7\\pwsh.exe`);
}
const userShell = process.env.SHELL || (process.platform === "win32" ? process.env.COMSPEC : void 0);
if (userShell) ALLOWED_SHELLS.add(userShell);
const ALLOWED_AGENT_BINS = ["claude", "codex", "aider", "opencode", "openclaw", "hermes"];
function isAllowedBinary(bin) {
  if (ALLOWED_SHELLS.has(bin)) return true;
  const base = (bin.split(/[/\\]/).pop() || "").replace(/\.(exe|cmd|bat|ps1)$/i, "");
  if (ALLOWED_AGENT_BINS.includes(base)) return true;
  return false;
}
const pty = require("node-pty");
function expandHome(arg) {
  if (!arg.startsWith("~")) return arg;
  const home = os.homedir();
  if (arg === "~") return home;
  if (arg.startsWith("~/.contex/")) {
    return path$1.join(CONTEX_HOME, arg.slice("~/.contex/".length));
  }
  if (arg.startsWith("~\\.contex\\")) {
    return path$1.join(CONTEX_HOME, arg.slice("~\\.contex\\".length));
  }
  if (arg.startsWith("~/.codesurf/")) {
    return path$1.join(CONTEX_HOME, arg.slice("~/.codesurf/".length));
  }
  if (arg.startsWith("~/") || arg.startsWith("~\\")) return path$1.join(home, arg.slice(2));
  return arg;
}
let _tmuxPath = null;
function getTmuxPath() {
  if (_tmuxPath !== null) return _tmuxPath || null;
  if (process.platform === "win32") {
    _tmuxPath = "";
    return null;
  }
  const candidates = [
    "/opt/homebrew/bin/tmux",
    "/usr/local/bin/tmux",
    "/usr/bin/tmux",
    "/bin/tmux"
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      _tmuxPath = p;
      return p;
    }
  }
  _tmuxPath = "";
  return null;
}
const CONTEX_TMUX_CONF = path$1.join(CONTEX_HOME, "tmux.conf");
function ensureTmuxConf() {
  try {
    if (fs.existsSync(CONTEX_TMUX_CONF)) return;
    const conf = [
      "# contex-managed tmux config — do not edit",
      "set -g status off",
      "set -g mouse on",
      "set -g history-limit 50000",
      'set -g default-terminal "xterm-256color"'
    ].join("\n") + "\n";
    require("fs").writeFileSync(CONTEX_TMUX_CONF, conf);
  } catch {
  }
}
const TMUX_PREFIX = "contex-";
function tmuxSessionName(tileId) {
  return `${TMUX_PREFIX}${tileId}`;
}
function tmuxSessionExists(sessionName) {
  const tmux = getTmuxPath();
  if (!tmux) return false;
  try {
    child_process.execFileSync(tmux, ["has-session", "-t", sessionName], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function tmuxKillSession(sessionName) {
  const tmux = getTmuxPath();
  if (!tmux) return;
  try {
    child_process.execFileSync(tmux, ["kill-session", "-t", sessionName], { stdio: "ignore" });
  } catch {
  }
}
function updateTmuxStatus(_sessionName, _tileId) {
}
function tmuxNewSessionArgs(sessionName, cwd, bin, args, env) {
  const tmuxArgs = [
    "-u",
    // Force UTF-8 so Nerd Font / Unicode glyphs are not stripped
    "-f",
    CONTEX_TMUX_CONF,
    "new-session",
    "-d",
    "-s",
    sessionName,
    "-x",
    "80",
    "-y",
    "24",
    "-c",
    cwd
  ];
  for (const [k, v] of Object.entries(env)) {
    if (k === "PATH" || k === "HOME" || k === "SHELL" || k === "TERM") continue;
    if (k.startsWith("CONTEX_") || k.startsWith("COLLAB_") || k === "CARD_ID" || k === "LANG" || k === "LC_ALL" || k === "LC_CTYPE") {
      tmuxArgs.push("-e", `${k}=${v}`);
    }
  }
  const hasLang = Object.keys(env).some((k) => k === "LANG" || k === "LC_ALL" || k === "LC_CTYPE");
  if (!hasLang) {
    tmuxArgs.splice(tmuxArgs.indexOf("new-session") + 1, 0, "-e", "LANG=en_US.UTF-8");
  }
  tmuxArgs.push(bin, ...args);
  return tmuxArgs;
}
const terminals = /* @__PURE__ */ new Map();
const terminalBuffers = /* @__PURE__ */ new Map();
const senderTerminalTiles = /* @__PURE__ */ new WeakMap();
const terminalSenderCleanupAttached = /* @__PURE__ */ new WeakSet();
const TERMINAL_BUS_DEBOUNCE = 800;
function trackTerminalSender(sender, tileId) {
  const existing = senderTerminalTiles.get(sender);
  if (existing) existing.add(tileId);
  else senderTerminalTiles.set(sender, /* @__PURE__ */ new Set([tileId]));
  if (terminalSenderCleanupAttached.has(sender)) return;
  terminalSenderCleanupAttached.add(sender);
  sender.once("destroyed", () => {
    const tileIds = senderTerminalTiles.get(sender);
    if (tileIds) {
      for (const id of tileIds) {
        terminals.get(id)?.listeners.delete(sender);
      }
    }
    senderTerminalTiles.delete(sender);
    terminalSenderCleanupAttached.delete(sender);
  });
}
function flushTerminalToBus(tileId) {
  const buf = terminalBuffers.get(tileId);
  if (!buf || !buf.data) return;
  const data = buf.data;
  buf.data = "";
  const clean = data.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  if (!clean) return;
  const truncated = clean.length > 200 ? clean.slice(-200) : clean;
  bus.publish({
    channel: `tile:${tileId}`,
    type: "activity",
    source: `terminal:${tileId}`,
    payload: { output: truncated }
  });
}
function registerTerminalIPC() {
  setTerminalNotifier((tileId, line) => {
    const session = terminals.get(tileId);
    if (!session?.tmuxSession) return;
    updateTmuxStatus(session.tmuxSession, tileId);
  });
  electron.ipcMain.handle("terminal:create", async (event, tileId, workspaceDir, launchBin, launchArgs) => {
    const existing = terminals.get(tileId);
    if (existing) {
      existing.listeners.add(event.sender);
      trackTerminalSender(event.sender, tileId);
      return { cols: 80, rows: 24, buffer: existing.buffer };
    }
    if (launchBin && !isAllowedBinary(launchBin)) {
      console.warn(`[terminal] Blocked non-allowlisted binary: ${launchBin} — falling back to default shell`);
      launchBin = void 0;
    }
    const defaultShell = process.platform === "win32" ? process.env.COMSPEC || "cmd.exe" : process.env.SHELL || "/bin/zsh";
    const bin = launchBin || defaultShell;
    const args = launchBin ? (launchArgs ?? []).map(expandHome) : [];
    const agentBins = ["claude", "codex", "aider", "opencode"];
    const isAgent = launchBin && agentBins.some((a) => launchBin.includes(a));
    const spawnEnv = { ...process.env, CARD_ID: tileId };
    const contexDir = workspaceTileDir(workspaceDir, tileId);
    const legacyContexDir = legacyWorkspaceTileDir(workspaceDir, tileId);
    spawnEnv.CONTEX_DIR = contexDir;
    spawnEnv.COLLAB_DIR = contexDir;
    if (isAgent) {
      const mcpConfigPath = path$1.join(CONTEX_HOME, "mcp-server.json");
      spawnEnv.CONTEX_MCP_CONFIG = mcpConfigPath;
      await fs.promises.mkdir(path$1.join(contexDir, "context"), { recursive: true });
      const objectivePath = path$1.join(contexDir, "objective.md");
      let objective = "";
      try {
        objective = await fs.promises.readFile(objectivePath, "utf8");
      } catch {
      }
      const preamble = [
        objective.trim() || "# Objective\n\nAwaiting tasks from the contex drawer.",
        "",
        "## Contex Directory",
        `Your per-block directory is at: ${contexDir}`,
        `Legacy path (if you see old docs): ${legacyContexDir}`,
        `Check ${contexDir}/objective.md for updated objectives.`,
        `Use the reload_objective MCP tool to fetch the latest version.`,
        "",
        "## Peer Collaboration",
        "You are part of a linked block group on an infinite canvas. When other blocks are linked to you, you will see [contex] notifications in your terminal.",
        "",
        "Collaboration tools (call via MCP):",
        "- `peer_set_state` — declare your status, current task, and files (DO THIS FIRST when starting work)",
        "- `peer_get_state` — see what linked peers are working on, their todos, and files",
        "- `peer_send_message` — send a direct message to a linked peer",
        "- `peer_read_messages` — read messages from peers",
        "- `peer_add_todo` — add a todo visible to peers",
        "- `peer_complete_todo` — mark a todo done (peers get notified)",
        "",
        "Workflow: When you start a task, call peer_set_state first. Before editing files, call peer_get_state to check if a peer is already working on them. Coordinate via peer_send_message to avoid conflicts.",
        `Your block ID is available as $CARD_ID. Reference file: ${contexDir}/peers.md`
      ].join("\n");
      args.push("-p", preamble);
      let skillFilter = null;
      try {
        const skillsRaw = await fs.promises.readFile(path$1.join(contexDir, "skills.json"), "utf8");
        const skills = JSON.parse(skillsRaw);
        if (skills.disabled && skills.disabled.length > 0) {
          skillFilter = skills.disabled;
        }
      } catch {
      }
      const isClaude = launchBin.includes("claude");
      if (isClaude) {
        const mcpToolNames = [
          "mcp__contex__canvas_create_tile",
          "mcp__contex__canvas_open_file",
          "mcp__contex__canvas_pan_to",
          "mcp__contex__canvas_list_tiles",
          "mcp__contex__card_complete",
          "mcp__contex__card_update",
          "mcp__contex__card_error",
          "mcp__contex__canvas_event",
          "mcp__contex__request_input",
          "mcp__contex__kanban_get_board",
          "mcp__contex__kanban_create_card",
          "mcp__contex__kanban_update_card",
          "mcp__contex__kanban_move_card",
          "mcp__contex__kanban_pause_card",
          "mcp__contex__kanban_delete_card",
          "mcp__contex__kanban_create_column",
          "mcp__contex__kanban_rename_column",
          "mcp__contex__kanban_delete_column",
          "mcp__contex__update_progress",
          "mcp__contex__log_activity",
          "mcp__contex__create_task",
          "mcp__contex__update_task",
          "mcp__contex__notify",
          "mcp__contex__ask",
          // Collab tools
          "mcp__contex__reload_objective",
          "mcp__contex__pause_task",
          "mcp__contex__get_context",
          // Peer collaboration tools
          "mcp__contex__peer_set_state",
          "mcp__contex__peer_get_state",
          "mcp__contex__peer_send_message",
          "mcp__contex__peer_read_messages",
          "mcp__contex__peer_add_todo",
          "mcp__contex__peer_complete_todo",
          // Node bridge tools — peer-to-peer interaction with linked tiles
          ...getAllNodeTools().map((t) => `mcp__contex__${t.name}`)
        ];
        const filteredTools = skillFilter ? mcpToolNames.filter((t) => !skillFilter.some((d) => t.includes(d))) : mcpToolNames;
        args.push("--allowedTools", filteredTools.join(","));
      }
      const proxySettings = readSettingsSync();
      if (proxySettings.localProxyEnabled && proxySettings.localProxyPort) {
        spawnEnv.ANTHROPIC_BASE_URL = `http://localhost:${proxySettings.localProxyPort}/v1`;
      }
      bus.publish({
        channel: `tile:${tileId}`,
        type: "system",
        source: `terminal:${tileId}`,
        payload: { action: "agent_launched", agent: launchBin }
      });
    }
    writeMCPConfigToWorkspace(workspaceDir).catch(() => {
    });
    const tmux = getTmuxPath();
    const sessName = tmuxSessionName(tileId);
    let useTmux = false;
    let reattaching = false;
    if (tmux) {
      ensureTmuxConf();
      reattaching = tmuxSessionExists(sessName);
      if (!reattaching) {
        try {
          const newArgs = tmuxNewSessionArgs(sessName, workspaceDir, bin, args, spawnEnv);
          child_process.execFileSync(tmux, newArgs, { stdio: "ignore", env: spawnEnv });
          useTmux = true;
        } catch (err) {
          console.warn(`[terminal] tmux new-session failed, falling back to direct PTY:`, err);
        }
      } else {
        useTmux = true;
        console.log(`[terminal] Reattaching to existing tmux session: ${sessName}`);
      }
    }
    if (useTmux && tmux) {
      try {
        child_process.execFileSync(tmux, ["set-option", "-t", sessName, "status", "off"], { stdio: "ignore" });
      } catch {
      }
    }
    let term;
    if (useTmux && tmux) {
      term = pty.spawn(tmux, ["-u", "-f", CONTEX_TMUX_CONF, "attach-session", "-t", sessName], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: workspaceDir,
        env: spawnEnv
      });
    } else {
      term = pty.spawn(bin, args, {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: workspaceDir,
        env: spawnEnv
      });
    }
    const session = {
      pty: term,
      listeners: /* @__PURE__ */ new Set([event.sender]),
      buffer: "",
      tmuxSession: useTmux ? sessName : void 0,
      shell: bin
    };
    terminals.set(tileId, session);
    trackTerminalSender(event.sender, tileId);
    bus.publish({
      channel: `tile:${tileId}`,
      type: "system",
      source: `terminal:${tileId}`,
      payload: { action: reattaching ? "reattached" : "created", workspaceDir, tmux: useTmux }
    });
    term.onData((data) => {
      session.buffer = (session.buffer + data).slice(-2e5);
      for (const listener of [...session.listeners]) {
        try {
          if (!listener.isDestroyed()) {
            listener.send(`terminal:data:${tileId}`, data);
            listener.send(`terminal:active:${tileId}`);
          } else {
            session.listeners.delete(listener);
          }
        } catch {
          session.listeners.delete(listener);
        }
      }
      let buf = terminalBuffers.get(tileId);
      if (!buf) {
        buf = { data: "", timer: void 0 };
        terminalBuffers.set(tileId, buf);
      }
      buf.data += data;
      if (buf.timer) clearTimeout(buf.timer);
      buf.timer = setTimeout(() => flushTerminalToBus(tileId), TERMINAL_BUS_DEBOUNCE);
    });
    return { cols: 80, rows: 24, buffer: "" };
  });
  electron.ipcMain.handle("terminal:write", (_, tileId, data) => {
    terminals.get(tileId)?.pty.write(data);
  });
  electron.ipcMain.handle("terminal:cd", (_, tileId, dirPath) => {
    const session = terminals.get(tileId);
    if (!session) return;
    const shellBase = (session.shell.split(/[/\\]/).pop() || "").toLowerCase();
    let cdLine;
    if (shellBase === "cmd.exe") {
      cdLine = `cd /d "${dirPath.replace(/"/g, '""')}"`;
    } else if (shellBase === "powershell.exe" || shellBase === "pwsh.exe") {
      cdLine = `Set-Location -LiteralPath '${dirPath.replace(/'/g, "''")}'`;
    } else {
      cdLine = `cd '${dirPath.replace(/'/g, "'\\''")}'`;
    }
    session.pty.write(`${cdLine}\r`);
  });
  electron.ipcMain.handle("terminal:resize", (_, tileId, cols, rows) => {
    if (cols > 0 && rows > 0) {
      terminals.get(tileId)?.pty.resize(Math.floor(cols), Math.floor(rows));
    }
  });
  electron.ipcMain.handle("terminal:destroy", (_, tileId) => {
    const session = terminals.get(tileId);
    if (session) {
      if (session.tmuxSession) {
        tmuxKillSession(session.tmuxSession);
      }
      try {
        session.pty.kill();
      } catch {
      }
      terminals.delete(tileId);
    }
    bus.publish({
      channel: `tile:${tileId}`,
      type: "system",
      source: `terminal:${tileId}`,
      payload: { action: "destroyed" }
    });
    const buf = terminalBuffers.get(tileId);
    if (buf?.timer) clearTimeout(buf.timer);
    terminalBuffers.delete(tileId);
    removeTile(tileId);
  });
  electron.ipcMain.handle("terminal:detach", (_, tileId) => {
    const session = terminals.get(tileId);
    if (session) {
      try {
        session.pty.kill();
      } catch {
      }
      terminals.delete(tileId);
    }
    const buf = terminalBuffers.get(tileId);
    if (buf?.timer) clearTimeout(buf.timer);
    terminalBuffers.delete(tileId);
  });
  electron.ipcMain.handle("terminal:update-peers", async (_, tileId, workspaceDir, peers) => {
    updateLinks(tileId, (peers ?? []).map((p) => p.peerId));
    const session = terminals.get(tileId);
    if (session?.tmuxSession) {
      updateTmuxStatus(session.tmuxSession, tileId);
    }
    const contexDir = workspaceTileDir(workspaceDir, tileId);
    const peersPath = path$1.join(contexDir, "peers.md");
    if (!peers || peers.length === 0) {
      try {
        await fs.promises.unlink(peersPath);
      } catch {
      }
      bus.publish({
        channel: `tile:${tileId}`,
        type: "system",
        source: `terminal:${tileId}`,
        payload: { action: "peers_updated", count: 0 }
      });
      return;
    }
    const lines = [
      "# Connected Peers",
      "",
      "These blocks are linked to you on the canvas. Use MCP peer bridge tools to interact with them.",
      ""
    ];
    for (const peer of peers) {
      lines.push(`## ${peer.peerType} — \`${peer.peerId}\``);
      if (peer.tools.length > 0) {
        lines.push("Available tools:");
        for (const tool of peer.tools) {
          lines.push(`- \`mcp__contex__${tool}\` (pass \`tile_id: "${peer.peerId}"\`)`);
        }
      }
      lines.push("");
    }
    lines.push("---");
    lines.push("*This file is auto-updated when canvas links change. Use `reload_objective` or re-read this file for the latest state.*");
    let persisted = true;
    try {
      await fs.promises.mkdir(contexDir, { recursive: true });
      await fs.promises.writeFile(peersPath, lines.join("\n"), "utf8");
    } catch (error) {
      const code = error.code;
      if (code !== "EPERM" && code !== "EACCES") throw error;
      persisted = false;
    }
    bus.publish({
      channel: `tile:${tileId}`,
      type: "system",
      source: `terminal:${tileId}`,
      payload: { action: "peers_updated", count: peers.length, peerIds: peers.map((p) => p.peerId), persisted }
    });
  });
}
const AGENTS_TO_DETECT = [
  {
    id: "claude",
    label: "Claude Code",
    cmd: "claude",
    bins: ["claude", "/usr/local/bin/claude", `${os.homedir()}/.bun/bin/claude`, `${os.homedir()}/.npm-global/bin/claude`, `${os.homedir()}/.local/bin/claude`],
    versionFlag: "--version"
  },
  {
    id: "codex",
    label: "Codex",
    cmd: "codex",
    bins: ["codex", "/usr/local/bin/codex", `${os.homedir()}/.bun/bin/codex`, `${os.homedir()}/.npm-global/bin/codex`],
    versionFlag: "--version"
  },
  {
    id: "cursor",
    label: "Cursor",
    cmd: "cursor",
    bins: [
      "cursor",
      "/usr/local/bin/cursor",
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
      `${os.homedir()}/Applications/Cursor.app/Contents/Resources/app/bin/cursor`
    ],
    versionFlag: "--version"
  },
  {
    id: "aider",
    label: "Aider",
    cmd: "aider",
    bins: ["aider", "/usr/local/bin/aider", `${os.homedir()}/.local/bin/aider`, `${os.homedir()}/.bun/bin/aider`],
    versionFlag: "--version"
  },
  {
    id: "goose",
    label: "Goose",
    cmd: "goose",
    bins: ["goose", "/usr/local/bin/goose", `${os.homedir()}/.local/bin/goose`],
    versionFlag: "--version"
  },
  {
    id: "continue",
    label: "Continue",
    cmd: "continue",
    bins: ["continue", `${os.homedir()}/.continue/bin/continue`],
    versionFlag: "--version"
  },
  {
    id: "cline",
    label: "Cline",
    cmd: "cline",
    bins: ["cline", `${os.homedir()}/.bun/bin/cline`, `${os.homedir()}/.npm-global/bin/cline`],
    versionFlag: "--version"
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    cmd: "gemini",
    bins: ["gemini", "/usr/local/bin/gemini", `${os.homedir()}/.bun/bin/gemini`, `${os.homedir()}/.npm-global/bin/gemini`],
    versionFlag: "--version"
  },
  {
    id: "opencode",
    label: "OpenCode",
    cmd: "opencode",
    bins: ["opencode", "/usr/local/bin/opencode", `${os.homedir()}/.bun/bin/opencode`],
    versionFlag: "--version"
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    cmd: "openclaw",
    bins: ["openclaw", "/usr/local/bin/openclaw", "/opt/homebrew/bin/openclaw", `${os.homedir()}/.local/bin/openclaw`, `${os.homedir()}/.cargo/bin/openclaw`],
    versionFlag: "--version"
  },
  {
    id: "hermes",
    label: "Hermes",
    cmd: "hermes",
    bins: ["hermes", "/usr/local/bin/hermes", `${os.homedir()}/.local/bin/hermes`, `${os.homedir()}/.hermes/bin/hermes`, `${os.homedir()}/Documents/GitHub/hermes-agent/hermes`],
    versionFlag: "--version"
  },
  {
    id: "shell",
    label: "Shell",
    cmd: process.platform === "win32" ? process.env.COMSPEC ?? "cmd.exe" : process.env.SHELL ?? "/bin/zsh",
    bins: process.platform === "win32" ? [process.env.COMSPEC ?? "cmd.exe", "powershell.exe", "pwsh.exe"] : [process.env.SHELL ?? "/bin/zsh"],
    versionFlag: "--version"
  }
];
async function fileExists(path2) {
  try {
    await fs.promises.access(path2);
    return true;
  } catch {
    return false;
  }
}
function runExec(prog, args) {
  return new Promise((resolve) => {
    child_process.execFile(prog, args, { timeout: 3e3 }, (err, stdout, stderr) => {
      resolve(err ? "" : (stdout || stderr).toString().trim());
    });
  });
}
function extractVersion(out) {
  const match = out.match(/[\d]+\.[\d]+[\d.]*/);
  if (match) return match[0];
  const firstLine = out.split("\n")[0]?.trim();
  return firstLine ? firstLine.substring(0, 30) : void 0;
}
async function detectAgent(agent) {
  const probeVersion = agent.id !== "shell" && !!agent.versionFlag;
  for (const bin of agent.bins) {
    let resolved2 = null;
    if (await fileExists(bin).catch(() => false)) {
      resolved2 = bin;
    } else if (!/[\\/]/.test(bin)) {
      resolved2 = whichSync(bin);
    }
    if (resolved2) {
      const version = probeVersion ? extractVersion(await runExec(resolved2, [agent.versionFlag])) : void 0;
      return { id: agent.id, label: agent.label, cmd: resolved2, path: resolved2, version, available: true };
    }
  }
  const resolved = whichSync(agent.cmd);
  if (resolved) {
    const version = probeVersion ? extractVersion(await runExec(resolved, [agent.versionFlag])) : void 0;
    return { id: agent.id, label: agent.label, cmd: resolved, path: resolved, version, available: true };
  }
  return { id: agent.id, label: agent.label, cmd: agent.cmd, available: false };
}
function registerAgentsIPC() {
  electron.ipcMain.handle("agents:detect", async () => {
    const results = await Promise.all(AGENTS_TO_DETECT.map(detectAgent));
    return results;
  });
}
function sendStream$1(cardId, event) {
  electron.BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send("agent:stream", event);
    }
  });
}
function parseClaudeStream(cardId, res) {
  let buffer = "";
  res.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        sendStream$1(cardId, { cardId, type: "done" });
        continue;
      }
      try {
        const evt = JSON.parse(data);
        if (evt.type === "content_block_delta") {
          const delta = evt.delta;
          if (delta?.type === "text_delta") {
            sendStream$1(cardId, { cardId, type: "text", text: delta.text });
          } else if (delta?.type === "thinking_delta") {
            sendStream$1(cardId, { cardId, type: "thinking", text: delta.thinking });
          }
        } else if (evt.type === "content_block_start") {
          if (evt.content_block?.type === "tool_use") {
            sendStream$1(cardId, { cardId, type: "tool_use", toolName: evt.content_block.name });
          }
        } else if (evt.type === "message_stop") {
          sendStream$1(cardId, { cardId, type: "done" });
        } else if (evt.type === "error") {
          sendStream$1(cardId, { cardId, type: "error", error: evt.error?.message ?? "Unknown error" });
        }
      } catch {
      }
    }
  });
  res.on("error", (err) => sendStream$1(cardId, { cardId, type: "error", error: err.message }));
  res.on("end", () => sendStream$1(cardId, { cardId, type: "done" }));
}
function parseCodexStream(cardId, res) {
  let buffer = "";
  res.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        sendStream$1(cardId, { cardId, type: "done" });
        continue;
      }
      try {
        const evt = JSON.parse(data);
        const delta = evt.choices?.[0]?.delta;
        if (delta?.content) {
          sendStream$1(cardId, { cardId, type: "text", text: delta.content });
        }
        if (delta?.tool_calls?.[0]?.function?.name) {
          sendStream$1(cardId, { cardId, type: "tool_use", toolName: delta.tool_calls[0].function.name });
        }
        if (evt.choices?.[0]?.finish_reason === "stop") {
          sendStream$1(cardId, { cardId, type: "done" });
        }
      } catch {
      }
    }
  });
  res.on("error", (err) => sendStream$1(cardId, { cardId, type: "error", error: err.message }));
  res.on("end", () => sendStream$1(cardId, { cardId, type: "done" }));
}
function parsePiStream(cardId, res) {
  let buffer = "";
  res.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const evt = JSON.parse(line);
        if (evt.type === "text" || evt.type === "content") {
          sendStream$1(cardId, { cardId, type: "text", text: evt.content ?? evt.text ?? "" });
        } else if (evt.type === "tool_call" || evt.type === "tool_use") {
          sendStream$1(cardId, { cardId, type: "tool_use", toolName: evt.name ?? evt.tool, toolInput: evt.input ?? evt.arguments });
        } else if (evt.type === "done" || evt.type === "end") {
          sendStream$1(cardId, { cardId, type: "done" });
        } else if (evt.type === "error") {
          sendStream$1(cardId, { cardId, type: "error", error: evt.message ?? evt.error });
        }
      } catch {
      }
    }
  });
  res.on("error", (err) => sendStream$1(cardId, { cardId, type: "error", error: err.message }));
  res.on("end", () => sendStream$1(cardId, { cardId, type: "done" }));
}
function parseGenericStream(cardId, res) {
  res.on("data", (chunk) => {
    const text = chunk.toString();
    sendStream$1(cardId, { cardId, type: "text", text });
  });
  res.on("error", (err) => sendStream$1(cardId, { cardId, type: "error", error: err.message }));
  res.on("end", () => sendStream$1(cardId, { cardId, type: "done" }));
}
function getStreamParser(agentId) {
  switch (agentId) {
    case "claude":
      return parseClaudeStream;
    case "codex":
      return parseCodexStream;
    case "pi":
      return parsePiStream;
    default:
      return parseGenericStream;
  }
}
const activeStreams = /* @__PURE__ */ new Map();
function registerStreamIPC() {
  electron.ipcMain.handle("stream:start", async (event, req) => {
    if (activeStreams.has(req.cardId)) {
      activeStreams.get(req.cardId)?.destroy();
      activeStreams.delete(req.cardId);
    }
    const url2 = new URL(req.url);
    const isHttps = url2.protocol === "https:";
    const reqFn = isHttps ? https.request : http.request;
    const options = {
      hostname: url2.hostname,
      port: url2.port || (isHttps ? 443 : 80),
      path: url2.pathname + url2.search,
      method: req.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        ...req.headers ?? {}
      }
    };
    return new Promise((resolve, reject) => {
      const httpReq = reqFn(options, (res) => {
        const parse = getStreamParser(req.agentId);
        parse(req.cardId, res);
        resolve({ ok: true });
      });
      httpReq.on("error", (err) => {
        electron.BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.webContents.isDestroyed()) {
            win.webContents.send("agent:stream", {
              cardId: req.cardId,
              type: "error",
              error: err.message
            });
          }
        });
        reject(err);
      });
      if (req.body) httpReq.write(req.body);
      httpReq.end();
      activeStreams.set(req.cardId, httpReq);
    });
  });
  electron.ipcMain.handle("stream:stop", async (_, cardId) => {
    activeStreams.get(cardId)?.destroy();
    activeStreams.delete(cardId);
  });
}
const execFileAsync$2 = util.promisify(node_child_process.execFile);
function parseStatus(code) {
  if (code === "??" || code === "!!") return "untracked";
  if (code.includes("A")) return "added";
  if (code.includes("D")) return "deleted";
  if (code.includes("R")) return "renamed";
  if (code.includes("U") || code === "AA" || code === "DD") return "conflict";
  return "modified";
}
function registerGitIPC() {
  electron.ipcMain.handle("git:status", async (_, dirPath) => {
    try {
      const resolvedDir = path.resolve(dirPath);
      if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        return { isRepo: false, root: dirPath, files: [] };
      }
      const { stdout: rootRaw } = await execFileAsync$2("git", ["rev-parse", "--show-toplevel"], { cwd: resolvedDir });
      const root = rootRaw.trim();
      const { stdout } = await execFileAsync$2("git", ["status", "--porcelain", "-u"], { cwd: root });
      const files = [];
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        const xy = line.slice(0, 2);
        const rest = line.slice(3).trim();
        const filePath = rest.includes(" -> ") ? rest.split(" -> ")[1] : rest;
        files.push({ path: filePath, status: parseStatus(xy.trim()) });
      }
      return { isRepo: true, root, files };
    } catch {
      return { isRepo: false, root: dirPath, files: [] };
    }
  });
  electron.ipcMain.handle("git:branches", async (_, dirPath) => {
    try {
      const resolvedDir = path.resolve(dirPath);
      if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        return { isRepo: false, root: dirPath, current: null, branches: [] };
      }
      const { stdout: rootRaw } = await execFileAsync$2("git", ["rev-parse", "--show-toplevel"], { cwd: resolvedDir });
      const root = rootRaw.trim();
      const { stdout: currentRaw } = await execFileAsync$2("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root });
      const current = currentRaw.trim() || null;
      const { stdout: branchRaw } = await execFileAsync$2("git", ["for-each-ref", "--format=%(refname:short)|%(HEAD)", "refs/heads"], { cwd: root });
      const branches = branchRaw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
        const [name, headMarker] = line.split("|");
        return {
          name: name.trim(),
          current: headMarker?.trim() === "*" || name.trim() === current
        };
      });
      return { isRepo: true, root, current, branches };
    } catch {
      return { isRepo: false, root: dirPath, current: null, branches: [] };
    }
  });
  electron.ipcMain.handle("git:checkoutBranch", async (_, dirPath, branchName) => {
    try {
      const resolvedDir = path.resolve(dirPath);
      if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        return { ok: false, error: "Directory not found" };
      }
      const { stdout: rootRaw } = await execFileAsync$2("git", ["rev-parse", "--show-toplevel"], { cwd: resolvedDir });
      const root = rootRaw.trim();
      await execFileAsync$2("git", ["checkout", branchName], { cwd: root });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "checkout-failed" };
    }
  });
  electron.ipcMain.handle("git:createBranch", async (_, dirPath, branchName) => {
    try {
      const resolvedDir = path.resolve(dirPath);
      if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        return { ok: false, error: "Directory not found" };
      }
      const { stdout: rootRaw } = await execFileAsync$2("git", ["rev-parse", "--show-toplevel"], { cwd: resolvedDir });
      const root = rootRaw.trim();
      await execFileAsync$2("git", ["checkout", "-b", branchName], { cwd: root });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "create-branch-failed" };
    }
  });
}
const senderSubscriberIds = /* @__PURE__ */ new WeakMap();
const senderCleanupAttached = /* @__PURE__ */ new WeakSet();
function trackSenderSubscription(sender, subscriberId) {
  const existing = senderSubscriberIds.get(sender);
  if (existing) existing.add(subscriberId);
  else senderSubscriberIds.set(sender, /* @__PURE__ */ new Set([subscriberId]));
  if (senderCleanupAttached.has(sender)) return;
  senderCleanupAttached.add(sender);
  sender.once("destroyed", () => {
    const subscriberIds = senderSubscriberIds.get(sender);
    if (subscriberIds) {
      for (const id of subscriberIds) bus.unsubscribeAll(id);
    }
    senderSubscriberIds.delete(sender);
    senderCleanupAttached.delete(sender);
  });
}
function registerBusIPC() {
  electron.ipcMain.handle("bus:publish", (_, channel, type, source, payload) => {
    return bus.publish({ channel, type, source, payload });
  });
  electron.ipcMain.handle("bus:subscribe", (event, channel, subscriberId) => {
    const sub = bus.subscribe(channel, subscriberId, (busEvent) => {
      try {
        event.sender.send("bus:event", busEvent);
      } catch {
      }
    });
    trackSenderSubscription(event.sender, subscriberId);
    return sub.id;
  });
  electron.ipcMain.handle("bus:unsubscribe", (_, subscriptionId) => {
    bus.unsubscribe(subscriptionId);
  });
  electron.ipcMain.handle("bus:unsubscribeAll", (_, subscriberId) => {
    bus.unsubscribeAll(subscriberId);
  });
  electron.ipcMain.handle("bus:history", (_, channel, limit) => {
    return bus.getHistory(channel, limit);
  });
  electron.ipcMain.handle("bus:channelInfo", (_, channel) => {
    return bus.getChannelInfo(channel);
  });
  electron.ipcMain.handle("bus:unreadCount", (_, channel, subscriberId) => {
    return bus.getUnreadCount(channel, subscriberId);
  });
  electron.ipcMain.handle("bus:markRead", (_, channel, subscriberId) => {
    bus.markRead(channel, subscriberId);
  });
  electron.ipcMain.handle("bus:dropChannel", (_, channel) => {
    return bus.dropChannel(channel);
  });
  electron.ipcMain.handle("bus:dropChannelsMatching", (_, prefix) => {
    return bus.dropChannelsMatching(prefix);
  });
  electron.ipcMain.handle("bus:stats", () => {
    return bus.getStats();
  });
}
let proxyServer = null;
let proxyPort = null;
let stats = {
  requestsServed: 0,
  requestsFailed: 0,
  startedAt: null,
  activeConnections: []
};
let connCounter = 0;
const LOCAL_BACKENDS = [
  { name: "Ollama", base: "http://localhost:11434", chatPath: "/api/chat", format: "ollama" },
  { name: "LM Studio", base: "http://localhost:1234", chatPath: "/v1/chat/completions", format: "openai" },
  { name: "llama.cpp", base: "http://localhost:8080", chatPath: "/v1/chat/completions", format: "openai" }
];
async function probeBackend(base, path2) {
  return new Promise((resolve) => {
    const url2 = new URL(base);
    const options = {
      hostname: url2.hostname,
      port: url2.port || 80,
      path: path2,
      method: "GET",
      timeout: 800
    };
    const req = http__namespace.request(options, (res) => {
      resolve(res.statusCode !== void 0 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}
async function findLiveBackend() {
  for (const backend of LOCAL_BACKENDS) {
    const live = await probeBackend(backend.base, backend.chatPath);
    if (live) return backend;
  }
  return null;
}
function anthropicToOpenAI(body) {
  const messages = [];
  if (typeof body.system === "string" && body.system) {
    messages.push({ role: "system", content: body.system });
  }
  const incoming = body.messages ?? [];
  for (const m of incoming) {
    let text = "";
    if (typeof m.content === "string") {
      text = m.content;
    } else if (Array.isArray(m.content)) {
      text = m.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    }
    messages.push({ role: m.role, content: text });
  }
  return {
    model: body.model ?? "default",
    messages,
    max_tokens: body.max_tokens ?? 4096,
    temperature: body.temperature ?? 1,
    stream: body.stream ?? false,
    stop: body.stop_sequences ?? void 0
  };
}
function anthropicToOllama(body) {
  const openai = anthropicToOpenAI(body);
  return {
    model: openai.model,
    messages: openai.messages,
    stream: openai.stream,
    options: { temperature: openai.temperature }
  };
}
function bufferBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    res.on("error", reject);
  });
}
function forwardRequest(backendBase, backendPath, outgoingBody, stream, clientRes, onDone) {
  const url2 = new URL(backendBase);
  const options = {
    hostname: url2.hostname,
    port: url2.port || 80,
    path: backendPath,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(outgoingBody)
    },
    timeout: 12e4
  };
  const backendReq = http__namespace.request(options, (backendRes) => {
    if (stream) {
      clientRes.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      const msgId = `msg_${Date.now().toString(36)}`;
      clientRes.write(`event: message_start
data: ${JSON.stringify({
        type: "message_start",
        message: { id: msgId, type: "message", role: "assistant", model: "", content: [], stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } }
      })}

`);
      clientRes.write(`event: content_block_start
data: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}

`);
      let buf = "";
      backendRes.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim() || line === "data: [DONE]") continue;
          const dataPart = line.startsWith("data: ") ? line.slice(6) : line;
          try {
            const parsed = JSON.parse(dataPart);
            let text = null;
            if (parsed.message?.content !== void 0) {
              text = parsed.message.content;
            } else if (parsed.choices?.[0]?.delta?.content !== void 0) {
              text = parsed.choices[0].delta.content;
            }
            if (text !== null && text !== "") {
              clientRes.write(`event: content_block_delta
data: ${JSON.stringify({
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text }
              })}

`);
            }
            const done = parsed.done === true || parsed.choices?.[0]?.finish_reason != null;
            if (done) {
              clientRes.write(`event: content_block_stop
data: ${JSON.stringify({ type: "content_block_stop", index: 0 })}

`);
              clientRes.write(`event: message_delta
data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 0 } })}

`);
              clientRes.write(`event: message_stop
data: ${JSON.stringify({ type: "message_stop" })}

`);
              clientRes.end();
              onDone(true);
            }
          } catch {
          }
        }
      });
      backendRes.on("end", () => {
        if (!clientRes.writableEnded) {
          clientRes.write(`event: content_block_stop
data: ${JSON.stringify({ type: "content_block_stop", index: 0 })}

`);
          clientRes.write(`event: message_stop
data: ${JSON.stringify({ type: "message_stop" })}

`);
          clientRes.end();
        }
        onDone(true);
      });
      backendRes.on("error", () => {
        if (!clientRes.writableEnded) clientRes.end();
        onDone(false);
      });
    } else {
      bufferBody(backendRes).then((raw) => {
        let anthropicResponse;
        try {
          const parsed = JSON.parse(raw);
          let text = "";
          if (parsed.message?.content) text = parsed.message.content;
          else if (parsed.choices?.[0]?.message?.content) text = parsed.choices[0].message.content;
          anthropicResponse = {
            id: `msg_${Date.now().toString(36)}`,
            type: "message",
            role: "assistant",
            content: [{ type: "text", text }],
            model: parsed.model ?? "",
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          };
        } catch {
          anthropicResponse = { error: { type: "api_error", message: "Backend parse error" } };
        }
        const responseBody = JSON.stringify(anthropicResponse);
        clientRes.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(responseBody),
          "Access-Control-Allow-Origin": "*"
        });
        clientRes.end(responseBody);
        onDone(true);
      }).catch(() => {
        clientRes.writeHead(502);
        clientRes.end(JSON.stringify({ error: { type: "api_error", message: "Backend error" } }));
        onDone(false);
      });
    }
  });
  backendReq.on("error", () => {
    if (!clientRes.writableEnded) {
      clientRes.writeHead(502, { "Content-Type": "application/json" });
      clientRes.end(JSON.stringify({ error: { type: "api_error", message: "Backend unreachable" } }));
    }
    onDone(false);
  });
  backendReq.write(outgoingBody);
  backendReq.end();
}
function createProxyServer(_port) {
  const server = http__namespace.createServer(async (req, clientRes) => {
    if (req.method === "OPTIONS") {
      clientRes.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, anthropic-version",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
      });
      clientRes.end();
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      clientRes.writeHead(200, { "Content-Type": "application/json" });
      clientRes.end(JSON.stringify({ status: "ok", uptime: stats.startedAt ? Date.now() - stats.startedAt : 0 }));
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/messages") {
      clientRes.writeHead(404, { "Content-Type": "application/json" });
      clientRes.end(JSON.stringify({ error: { type: "not_found", message: "Only /v1/messages is proxied" } }));
      return;
    }
    const rawChunks = [];
    for await (const chunk of req) rawChunks.push(chunk);
    let body;
    try {
      body = JSON.parse(Buffer.concat(rawChunks).toString("utf8"));
    } catch {
      clientRes.writeHead(400, { "Content-Type": "application/json" });
      clientRes.end(JSON.stringify({ error: { type: "invalid_request_error", message: "Invalid JSON" } }));
      return;
    }
    const backend = await findLiveBackend();
    if (!backend) {
      clientRes.writeHead(503, { "Content-Type": "application/json" });
      clientRes.end(JSON.stringify({ error: { type: "api_error", message: "No local backend found. Start Ollama, LM Studio, or llama.cpp first." } }));
      stats.requestsFailed++;
      return;
    }
    const stream = body.stream === true;
    let outgoingBody;
    if (backend.format === "ollama") {
      outgoingBody = JSON.stringify(anthropicToOllama(body));
    } else {
      outgoingBody = JSON.stringify(anthropicToOpenAI(body));
    }
    const connId = `conn_${++connCounter}`;
    const conn = {
      id: connId,
      remoteAddr: req.socket.remoteAddress ?? "unknown",
      model: String(body.model ?? "unknown"),
      backend: backend.name,
      startedAt: Date.now(),
      requestCount: 1
    };
    stats.activeConnections.push(conn);
    forwardRequest(backend.base, backend.chatPath, outgoingBody, stream, clientRes, (ok) => {
      if (ok) stats.requestsServed++;
      else stats.requestsFailed++;
      stats.activeConnections = stats.activeConnections.filter((c) => c.id !== connId);
      bus.publish({ channel: "localProxy:stats", type: "data", source: "localProxy", payload: { action: "update", ...stats } });
    });
  });
  return server;
}
async function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net__namespace.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close();
      resolve(true);
    });
    tester.listen(port, "127.0.0.1");
  });
}
function getProxyStatus() {
  const settings = readSettingsSync();
  return {
    running: proxyServer !== null,
    port: proxyPort ?? settings.localProxyPort ?? 1337,
    stats: { ...stats, activeConnections: [...stats.activeConnections] }
  };
}
async function startProxyServer(port) {
  if (proxyServer) {
    if (proxyPort === port) return { ok: true, port };
    return { ok: false, message: `Proxy already running on port ${proxyPort}` };
  }
  const free = await isPortFree(port);
  if (!free) {
    return { ok: false, message: `Port ${port} is already in use` };
  }
  return new Promise((resolve) => {
    try {
      proxyServer = createProxyServer(port);
      proxyServer.listen(port, "127.0.0.1", () => {
        proxyPort = port;
        stats = { requestsServed: 0, requestsFailed: 0, startedAt: Date.now(), activeConnections: [] };
        bus.publish({ channel: "localProxy:stats", type: "data", source: "localProxy", payload: { action: "started", port } });
        resolve({ ok: true, port });
      });
      proxyServer.on("error", (err) => {
        proxyServer = null;
        proxyPort = null;
        resolve({ ok: false, message: err.message });
      });
    } catch (err) {
      proxyServer = null;
      proxyPort = null;
      resolve({ ok: false, message: String(err) });
    }
  });
}
async function ensureLocalProxyRunning(portOverride) {
  const settings = readSettingsSync();
  return startProxyServer(portOverride ?? settings.localProxyPort ?? 1337);
}
function registerLocalProxyIPC() {
  electron.ipcMain.handle("localProxy:start", async () => {
    if (proxyServer) return { ok: true, message: "Already running" };
    return ensureLocalProxyRunning();
  });
  electron.ipcMain.handle("localProxy:stop", async () => {
    if (!proxyServer) return { ok: true, message: "Not running" };
    return new Promise((resolve) => {
      proxyServer.close(() => {
        proxyServer = null;
        proxyPort = null;
        stats = { ...stats, startedAt: null, activeConnections: [] };
        bus.publish({ channel: "localProxy:stats", type: "data", source: "localProxy", payload: { action: "stopped" } });
        resolve({ ok: true });
      });
    });
  });
  electron.ipcMain.handle("localProxy:getStatus", () => getProxyStatus());
  electron.ipcMain.handle("localProxy:probeBackends", async () => {
    const results = await Promise.all(
      LOCAL_BACKENDS.map(async (b) => ({
        name: b.name,
        base: b.base,
        live: await probeBackend(b.base, b.chatPath)
      }))
    );
    return results;
  });
}
function buildProviderContextPolicy(args) {
  const executionTarget = args.executionTarget ?? "local";
  const hostType = args.hostType ?? "runtime";
  const remoteBoundary = executionTarget === "cloud" || hostType === "remote-daemon";
  if (remoteBoundary) {
    return {
      includeWorkspaceDir: false,
      includeGitRemoteUrl: true,
      includeGitBranch: true,
      includeRepoName: true,
      reason: "remote-boundary"
    };
  }
  return {
    includeWorkspaceDir: true,
    includeGitRemoteUrl: true,
    includeGitBranch: true,
    includeRepoName: true,
    reason: "local-execution"
  };
}
function applyProjectContextPolicy(context, policy) {
  const workspaceDir = policy.includeWorkspaceDir || !context.gitRemoteUrl ? context.workspaceDir : null;
  return {
    workspaceDir,
    gitRemoteUrl: policy.includeGitRemoteUrl ? context.gitRemoteUrl : null,
    gitBranch: policy.includeGitBranch ? context.gitBranch : null,
    repoName: policy.includeRepoName ? context.repoName : null
  };
}
function describeProjectContextEnvelope(context) {
  return {
    hasWorkspaceDir: Boolean(context.workspaceDir),
    hasGitRemoteUrl: Boolean(context.gitRemoteUrl),
    hasGitBranch: Boolean(context.gitBranch),
    hasRepoName: Boolean(context.repoName)
  };
}
const RUNTIME_HOST_ID = "local-runtime";
const LOCAL_DAEMON_HOST_ID = "local-daemon";
function getBuiltinExecutionHosts() {
  return [
    {
      id: RUNTIME_HOST_ID,
      type: "runtime",
      label: "This app",
      enabled: true,
      url: null,
      authToken: null
    },
    {
      id: LOCAL_DAEMON_HOST_ID,
      type: "local-daemon",
      label: "Local daemon",
      enabled: true,
      url: "http://127.0.0.1",
      authToken: null
    }
  ];
}
function canonicalHostOrder(host) {
  if (host.id === RUNTIME_HOST_ID) return 0;
  if (host.id === LOCAL_DAEMON_HOST_ID) return 1;
  return 2;
}
function mergeExecutionHosts(records) {
  const merged = /* @__PURE__ */ new Map();
  for (const builtin of getBuiltinExecutionHosts()) {
    merged.set(builtin.id, builtin);
  }
  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.id) continue;
    const trimmedId = String(record.id).trim();
    if (!trimmedId) continue;
    const base = merged.get(trimmedId);
    merged.set(trimmedId, {
      ...base ?? {},
      ...record,
      id: trimmedId,
      label: String(record.label ?? base?.label ?? trimmedId).trim() || trimmedId,
      enabled: record.enabled !== false,
      url: typeof record.url === "string" && record.url.trim().length > 0 ? record.url.trim() : null,
      authToken: typeof record.authToken === "string" && record.authToken.trim().length > 0 ? record.authToken.trim() : null
    });
  }
  return [...merged.values()].sort((a, b) => {
    const orderDelta = canonicalHostOrder(a) - canonicalHostOrder(b);
    if (orderDelta !== 0) return orderDelta;
    return a.label.localeCompare(b.label, void 0, { sensitivity: "base" });
  });
}
function resolveExecutionTarget(args) {
  const hosts = mergeExecutionHosts(args.hosts);
  const enabledHosts = hosts.filter((host) => host.enabled !== false);
  const byId = new Map(enabledHosts.map((host) => [host.id, host]));
  const runtime = byId.get(RUNTIME_HOST_ID) ?? getBuiltinExecutionHosts()[0];
  const localDaemon = byId.get(LOCAL_DAEMON_HOST_ID) ?? getBuiltinExecutionHosts()[1];
  switch (args.preference.mode) {
    case "runtime-only":
      return { host: runtime, fallback: false, reason: "Execution is pinned to the in-process runtime." };
    case "daemon-only":
      if (args.localDaemonAvailable) {
        return { host: localDaemon, fallback: false, reason: "Execution requires the local daemon and it is available." };
      }
      return { host: runtime, fallback: true, reason: "Local daemon is unavailable, so the runtime is the only viable fallback." };
    case "specific-host": {
      const selected = args.preference.hostId ? byId.get(args.preference.hostId) : null;
      if (selected) {
        return { host: selected, fallback: false, reason: `Execution is pinned to ${selected.label}.` };
      }
      if (args.localDaemonAvailable) {
        return { host: localDaemon, fallback: true, reason: "Pinned host is missing or disabled, so execution fell back to the local daemon." };
      }
      return { host: runtime, fallback: true, reason: "Pinned host is missing or disabled, so execution fell back to the runtime." };
    }
    case "prefer-local-daemon":
      if (args.localDaemonAvailable) {
        return { host: localDaemon, fallback: false, reason: "Execution prefers the local daemon and it is available." };
      }
      return { host: runtime, fallback: true, reason: "Local daemon is unavailable, so execution fell back to the runtime." };
    case "auto":
    default:
      if (args.localDaemonAvailable) {
        return { host: localDaemon, fallback: false, reason: "Auto mode selected the local daemon." };
      }
      return { host: runtime, fallback: true, reason: "Auto mode fell back to the runtime because the local daemon is unavailable." };
  }
}
const READ_SAFE_PERMISSIONS = ["read", "list", "grep", "glob", "todoread", "question", "codesearch", "lsp"];
const RISKY_PERMISSIONS = [
  "edit",
  "bash",
  "task",
  "external_directory",
  "todowrite",
  "webfetch",
  "websearch",
  "doom_loop",
  "skill"
];
function rulesFor(permissions, action) {
  return permissions.map((permission) => ({
    permission,
    pattern: "*",
    action
  }));
}
function buildOpenCodeSessionPermissions(mode) {
  if (mode === "plan") {
    return [
      ...rulesFor(READ_SAFE_PERMISSIONS, "allow"),
      ...rulesFor(RISKY_PERMISSIONS, "deny")
    ];
  }
  if (mode === "bypassPermissions") {
    return [
      ...rulesFor(READ_SAFE_PERMISSIONS, "allow"),
      ...rulesFor(RISKY_PERMISSIONS, "allow")
    ];
  }
  return [
    ...rulesFor(READ_SAFE_PERMISSIONS, "allow"),
    ...rulesFor(RISKY_PERMISSIONS, "ask")
  ];
}
let _createOpencodeClient = null;
async function getOpencodeClient() {
  if (!_createOpencodeClient) {
    try {
      const mod = await import("@opencode-ai/sdk/v2/client");
      _createOpencodeClient = mod.createOpencodeClient;
    } catch {
      throw new Error(
        "OpenCode SDK could not be loaded (ESM/CJS mismatch). Use the opencode CLI directly or check @opencode-ai/sdk compatibility."
      );
    }
  }
  return _createOpencodeClient;
}
function log(...args) {
  if (process.env.CODESURF_CHAT_DEBUG !== "1") return;
  console.log("[Chat]", ...args);
}
function sendStream(cardId, event) {
  log("sendStream", event.type, event.text ? `"${String(event.text).slice(0, 50)}"` : "", event.error ?? "");
  electron.BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send("agent:stream", { cardId, ...event });
    }
  });
}
function cloneChatMessages(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: String(message.content ?? "")
  }));
}
function getPreparedMessages(req) {
  return Array.isArray(req.expandedMessages) && req.expandedMessages.length > 0 ? req.expandedMessages : req.messages;
}
function mayContainFileReferences(text) {
  return text.includes("@") || text.includes("Attached file paths:");
}
async function expandLatestUserFileReferences(req) {
  if (!req.workspaceId && !req.workspaceDir) {
    return { request: req, expansion: null };
  }
  const preparedMessages = getPreparedMessages(req);
  let lastUserIndex = -1;
  for (let index = preparedMessages.length - 1; index >= 0; index -= 1) {
    if (preparedMessages[index]?.role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  if (lastUserIndex < 0) {
    return { request: req, expansion: null };
  }
  const lastUserMessage = preparedMessages[lastUserIndex];
  if (!mayContainFileReferences(String(lastUserMessage?.content ?? ""))) {
    return { request: req, expansion: null };
  }
  const expansion = await daemonClient.expandFileReferences({
    message: lastUserMessage.content,
    workspaceId: req.workspaceId ?? null,
    workspaceDir: req.workspaceDir ?? null,
    executionTarget: req.executionTarget === "cloud" ? "cloud" : "local"
  });
  if (!expansion.changed) {
    return { request: req, expansion: null };
  }
  const expandedMessages = cloneChatMessages(preparedMessages);
  expandedMessages[lastUserIndex] = {
    ...expandedMessages[lastUserIndex],
    content: expansion.message
  };
  const imageAttachments = [];
  for (const reference of expansion.references ?? []) {
    if (!reference.binary) continue;
    const mediaType = String(reference.mediaType ?? "");
    const resolvedPath = String(reference.resolvedPath ?? "").trim();
    if (!resolvedPath) continue;
    if (isSupportedVisionMediaType(mediaType)) {
      imageAttachments.push({
        path: resolvedPath,
        mediaType,
        displayPath: reference.displayPath,
        byteCount: reference.byteCount
      });
      continue;
    }
    const converted = await convertVisionImageToPng(resolvedPath, reference.displayPath, mediaType);
    if (converted) imageAttachments.push(converted);
  }
  return {
    request: {
      ...req,
      expandedMessages,
      ...imageAttachments.length > 0 ? { imageAttachments } : {}
    },
    expansion
  };
}
const ANTHROPIC_SUPPORTED_IMAGE_TYPES = /* @__PURE__ */ new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp"
]);
function isSupportedVisionMediaType(mediaType) {
  return ANTHROPIC_SUPPORTED_IMAGE_TYPES.has(mediaType.toLowerCase());
}
function isConvertibleVisionImage(path2, mediaType) {
  const normalized = mediaType.toLowerCase();
  if (normalized === "image/heic" || normalized === "image/heif" || normalized === "image/tiff" || normalized === "image/bmp") return true;
  return /\.(heic|heif|tiff?|bmp)$/i.test(path2);
}
async function convertVisionImageToPng(sourcePath, displayPath, mediaType) {
  if (!isConvertibleVisionImage(sourcePath, mediaType)) return null;
  try {
    const dir = path$1.join(CONTEX_HOME, "chat-vision");
    await fs.promises.mkdir(dir, { recursive: true });
    const safeBase = path$1.basename(displayPath || sourcePath).replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "image";
    const dest = path$1.join(dir, `${safeBase}-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}.png`);
    await execFileAsync$1("sips", ["-s", "format", "png", sourcePath, "--out", dest], { maxBuffer: 1024 * 1024 * 4 });
    const stat = await fs.promises.stat(dest);
    return {
      path: dest,
      mediaType: "image/png",
      displayPath: `${displayPath || sourcePath} (converted to PNG)`,
      byteCount: stat.size
    };
  } catch (error) {
    log("failed to convert image attachment for vision", sourcePath, mediaType, error instanceof Error ? error.message : String(error));
    return null;
  }
}
function buildRuntimeSessionEntryId(req) {
  return `codesurf-runtime:${req.cardId}`;
}
function buildCheckpointLabel(toolName, filePaths, workspaceDir) {
  if (filePaths.length === 0) return `Before ${toolName}`;
  if (filePaths.length === 1) return `Before ${toolName} ${getDisplayPath(filePaths[0], workspaceDir)}`;
  return `Before ${toolName} (${filePaths.length} files)`;
}
function extractAnthropicCheckpointPaths(toolName, input, workspaceDir) {
  const resolveFile = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    return resolveCodexFilePath(value, workspaceDir);
  };
  if (toolName === "Edit" || toolName === "MultiEdit" || toolName === "Write") {
    const filePath = resolveFile(input.file_path);
    return filePath ? [filePath] : [];
  }
  if (toolName === "NotebookEdit") {
    const filePath = resolveFile(input.notebook_path) ?? resolveFile(input.file_path);
    return filePath ? [filePath] : [];
  }
  return [];
}
function emitCheckpointSaved(req, toolName, filePaths, checkpointId) {
  const displayPaths = filePaths.slice(0, 2).map((filePath) => getDisplayPath(filePath, req.workspaceDir));
  const suffix = filePaths.length > 2 ? ` +${filePaths.length - 2} more` : "";
  const summary = `Saved checkpoint before ${toolName}${displayPaths.length > 0 ? ` for ${displayPaths.join(", ")}${suffix}` : ""}`;
  const toolId = `codesurf-checkpoint-${checkpointId}`;
  sendStream(req.cardId, { type: "tool_start", toolId, toolName: "Checkpoint saved" });
  sendStream(req.cardId, { type: "tool_summary", toolId, toolName: "Checkpoint saved", text: summary });
}
async function createRuntimeCheckpoint(req, toolName, filePaths, metadata = {}) {
  if (filePaths.length === 0) return { ok: true, skipped: true };
  if (!req.workspaceId) return { ok: true, skipped: true };
  try {
    const response = await daemonClient.createCheckpoint(req.workspaceId, buildRuntimeSessionEntryId(req), {
      label: buildCheckpointLabel(toolName, filePaths, req.workspaceDir),
      reason: `tool:${toolName}`,
      files: filePaths,
      metadata: {
        provider: req.provider,
        model: req.model,
        toolName,
        cardId: req.cardId,
        ...metadata
      },
      source: "main-ipc-chat"
    });
    if (!response.ok) {
      return { ok: false, error: response.error ?? `Failed to create checkpoint for ${toolName}` };
    }
    if (response.checkpoint?.id) {
      emitCheckpointSaved(req, toolName, filePaths, response.checkpoint.id);
    }
    return { ok: true, checkpointId: response.checkpoint?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("createRuntimeCheckpoint error", req.cardId, toolName, message);
    return { ok: false, error: message };
  }
}
async function allowToolWithCheckpoint(req, toolName, input, toolOptions) {
  const checkpoint = await createRuntimeCheckpoint(req, toolName, extractAnthropicCheckpointPaths(toolName, input, req.workspaceDir), {
    toolUseID: typeof toolOptions?.toolUseID === "string" ? toolOptions.toolUseID : null
  });
  if (!checkpoint.ok) {
    return {
      behavior: "deny",
      message: `Checkpoint creation failed before ${toolName}: ${checkpoint.error ?? "unknown error"}`,
      toolUseID: toolOptions?.toolUseID
    };
  }
  return { behavior: "allow", toolUseID: toolOptions?.toolUseID };
}
async function upsertRuntimeSessionState(req, state) {
  if (!req.workspaceId) return;
  try {
    await daemonClient.upsertRuntimeSession(req.workspaceId, req.cardId, state);
  } catch (error) {
    log("upsertRuntimeSession error", req.cardId, error);
  }
}
const activeQueries = /* @__PURE__ */ new Map();
const intentionallyClosedQueries = /* @__PURE__ */ new WeakSet();
const cardPermissionModes = /* @__PURE__ */ new Map();
const activeProcesses = /* @__PURE__ */ new Map();
const activeHttpRequests = /* @__PURE__ */ new Map();
const activeDaemonStreams = /* @__PURE__ */ new Map();
const sessionIds = /* @__PURE__ */ new Map();
const SESSION_IDS_PATH = path$1.join(CONTEX_HOME, "session-ids.json");
let sessionIdsPersistTimer = null;
function persistSessionIds() {
  if (sessionIdsPersistTimer) return;
  sessionIdsPersistTimer = setTimeout(async () => {
    sessionIdsPersistTimer = null;
    try {
      const data = {};
      for (const [key, value] of sessionIds) data[key] = value;
      await fs.promises.mkdir(path$1.dirname(SESSION_IDS_PATH), { recursive: true });
      await fs.promises.writeFile(SESSION_IDS_PATH, JSON.stringify(data), "utf8");
    } catch {
    }
  }, 1e3);
}
function loadPersistedSessionIds() {
  try {
    const raw = fs.readFileSync(SESSION_IDS_PATH, "utf8");
    const data = JSON.parse(raw);
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string" && value && !sessionIds.has(key)) {
          sessionIds.set(key, value);
        }
      }
    }
  } catch {
  }
}
loadPersistedSessionIds();
const execFileAsync$1 = util.promisify(child_process.execFile);
function isActiveQuery(cardId, query2) {
  return activeQueries.get(cardId) === query2;
}
function clearActiveQuery(cardId, query2) {
  if (isActiveQuery(cardId, query2)) {
    activeQueries.delete(cardId);
  }
}
const pendingAskUserQuestions = /* @__PURE__ */ new Map();
function askUserQuestionKey(cardId, toolUseID) {
  return `${cardId}::${toolUseID ?? ""}`;
}
function awaitAskUserQuestionAnswer(cardId, toolUseID, questions) {
  const key = askUserQuestionKey(cardId, toolUseID);
  const prior = pendingAskUserQuestions.get(key);
  if (prior) {
    try {
      prior.reject(new Error("AskUserQuestion superseded"));
    } catch {
    }
    pendingAskUserQuestions.delete(key);
  }
  return new Promise((resolve2, reject) => {
    pendingAskUserQuestions.set(key, { resolve: resolve2, reject });
    sendStream(cardId, {
      type: "ask_user_question",
      toolId: toolUseID,
      questions
    });
  });
}
function resolvePendingAskUserQuestion(cardId, toolUseID, payload) {
  const key = askUserQuestionKey(cardId, toolUseID);
  const pending = pendingAskUserQuestions.get(key);
  if (!pending) return false;
  pendingAskUserQuestions.delete(key);
  pending.resolve(payload);
  return true;
}
function cancelPendingAskUserQuestionsForCard(cardId, reason = "Cancelled") {
  const prefix = `${cardId}::`;
  for (const [key, pending] of pendingAskUserQuestions.entries()) {
    if (key.startsWith(prefix)) {
      pendingAskUserQuestions.delete(key);
      try {
        pending.reject(new Error(reason));
      } catch {
      }
    }
  }
}
const pendingToolPermissions = /* @__PURE__ */ new Map();
function toolPermissionKey(cardId, toolUseID) {
  return `${cardId}::${toolUseID ?? ""}`;
}
function awaitToolPermissionAnswer(cardId, toolUseID, request) {
  const key = toolPermissionKey(cardId, toolUseID);
  const prior = pendingToolPermissions.get(key);
  if (prior) {
    try {
      prior.reject(new Error("Tool permission superseded"));
    } catch {
    }
    pendingToolPermissions.delete(key);
  }
  return new Promise((resolve2, reject) => {
    pendingToolPermissions.set(key, { resolve: resolve2, reject });
    sendStream(cardId, {
      type: "tool_permission_request",
      toolId: toolUseID,
      provider: request.provider,
      toolName: request.toolName,
      title: request.title ?? null,
      description: request.description ?? null,
      blockedPath: request.blockedPath ?? null,
      workspaceDir: request.workspaceDir ?? null
    });
  });
}
function resolvePendingToolPermission(cardId, toolUseID, decision) {
  const key = toolPermissionKey(cardId, toolUseID);
  const pending = pendingToolPermissions.get(key);
  if (!pending) return false;
  pendingToolPermissions.delete(key);
  pending.resolve(decision);
  return true;
}
function cancelPendingToolPermissionsForCard(cardId, reason = "Cancelled") {
  const prefix = `${cardId}::`;
  for (const [key, pending] of pendingToolPermissions.entries()) {
    if (key.startsWith(prefix)) {
      pendingToolPermissions.delete(key);
      try {
        pending.reject(new Error(reason));
      } catch {
      }
    }
  }
}
function sanitizeToolOutputText(text) {
  if (!text) return "";
  return text.replace(/\r\n/g, "\n").split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(/^Chunk ID:/i.test(trimmed) || /^Wall time:/i.test(trimmed) || /^Process exited with code /i.test(trimmed) || /^Process running with session ID /i.test(trimmed) || /^Original token count:/i.test(trimmed) || /^Output:$/i.test(trimmed) || /^\[CodeSurf memory guard\] Older tool (output|summary) /i.test(trimmed));
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function sanitizeClaudeStderrText(text) {
  if (!text) return "";
  return text.replace(/\r\n/g, "\n").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").split("\n").map((line) => line.trimEnd()).filter((line) => line.trim().length > 0).join("\n").trim();
}
function formatClaudeSdkError(error, stderrText) {
  const message = error instanceof Error ? error.message : String(error);
  const stderr = sanitizeClaudeStderrText(stderrText);
  if (!stderr) return message;
  if (message && stderr.includes(message)) return stderr.slice(-6e3);
  return `${message}

Claude Code stderr:
${stderr}`.slice(-6e3);
}
function bufferHttpResponse(res) {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => resolve2(Buffer.concat(chunks).toString("utf8")));
    res.on("error", reject);
  });
}
function stopDaemonStream(cardId) {
  const active = activeDaemonStreams.get(cardId);
  if (!active) return;
  active.abortController.abort();
  activeDaemonStreams.delete(cardId);
}
async function resolveHostEndpoint(host) {
  if (host.type === "local-daemon") {
    const info = await ensureDaemonRunning();
    return {
      baseUrl: `http://127.0.0.1:${info.port}`,
      token: info.token
    };
  }
  if (host.type === "remote-daemon") {
    const baseUrl = String(host.url ?? "").trim().replace(/\/+$/, "");
    if (!baseUrl) throw new Error(`Remote host ${host.label} is missing a URL`);
    return {
      baseUrl,
      token: host.authToken ?? null
    };
  }
  throw new Error(`Host ${host.label} does not expose a daemon endpoint`);
}
async function hostRequest(host, path2, options) {
  const endpoint = await resolveHostEndpoint(host);
  const response = await fetch(`${endpoint.baseUrl}${path2}`, {
    method: options?.method ?? (options?.body == null ? "GET" : "POST"),
    headers: {
      ...endpoint.token ? { Authorization: `Bearer ${endpoint.token}` } : {},
      ...options?.body == null ? {} : { "Content-Type": "application/json" }
    },
    body: options?.body == null ? void 0 : JSON.stringify(options.body),
    signal: options?.signal ?? AbortSignal.timeout(2e4)
  });
  const text = await response.text();
  const payload = text.trim() ? JSON.parse(text) : null;
  if (!response.ok) {
    const errorMessage = typeof payload === "object" && payload && "error" in payload ? String(payload.error ?? `Daemon request failed (${response.status})`) : text.trim() || `Daemon request failed (${response.status})`;
    throw new Error(errorMessage);
  }
  return payload;
}
async function getExecutionRoutingState() {
  try {
    await ensureDaemonRunning();
    const hosts = await daemonClient.listHosts();
    return {
      hosts,
      localDaemonAvailable: true
    };
  } catch {
    return {
      hosts: getBuiltinExecutionHosts(),
      localDaemonAvailable: false
    };
  }
}
function supportsDaemonChatProvider(provider) {
  return provider === "claude" || provider === "codex" || provider === "opencode" || provider === "hermes";
}
function supportsProviderNativeBackground(provider) {
  return provider === "claude" || provider === "codex";
}
function buildAsyncExecutionContext(params) {
  const requestedRunMode = params.request.runMode === "background" ? "background" : "foreground";
  const backend = params.daemonHost ? "daemon" : "runtime";
  const hostType = params.daemonHost?.type ?? "runtime";
  const hostLabel = params.daemonHost?.label ?? "Electron runtime";
  const providerNativeBackground = supportsProviderNativeBackground(params.request.provider);
  const detachedDaemonAvailable = Boolean(params.daemonHost) || params.localDaemonAvailable;
  return {
    requestedRunMode,
    backend,
    hostType,
    hostLabel,
    providerNativeBackground,
    detachedDaemonAvailable,
    detachedDaemonPreferred: detachedDaemonAvailable && !providerNativeBackground
  };
}
function joinPromptSections(...sections) {
  const normalized = sections.map((section) => String(section ?? "").trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join("\n\n") : void 0;
}
const CODESURF_OUTPUT_CONVENTION = [
  "## CodeSurf Task-Completion Convention",
  "",
  "Default to a short natural-language completion. For simple edits, one sentence plus any verification result is enough.",
  "",
  "Only use the structured completion card for substantial work: multi-file changes, long-running tasks, risky edits, migrations, debugging sessions, or work where the user needs a durable handoff. When you do use it, use this exact format (literal uppercase section headers inside a fenced code block):",
  "",
  "```",
  "CHANGES MADE:",
  "  <path>: <one-line what + why>",
  "  <path>: <one-line what + why>",
  "",
  "DIDN'T TOUCH:",
  "  <path or area>: <one-line why you left it alone>",
  "",
  "CONCERNS:",
  "  - <risk, assumption, or follow-up the user should verify>",
  "```",
  "",
  "Rules:",
  "- Do NOT use the structured card for trivial changes such as copy tweaks, captions, one-line edits, formatting, or small visual adjustments.",
  "- For simple tasks, say what changed and whether verification passed, then stop.",
  "- Include CHANGES MADE only when the structured card is warranted. Skip the block entirely for pure Q&A turns.",
  "- DIDN'T TOUCH is only useful when there were adjacent risky areas you deliberately left alone.",
  '- CONCERNS is never empty if you had to make a judgment call, guess a value, or skip verification. If there are truly no concerns, write "CONCERNS: none".',
  "- One line per entry. No prose paragraphs inside the block.",
  "- Put the block inside a single fenced code block so the host UI can render it as a structured card."
].join("\n");
function buildCodeSurfOutputConvention() {
  return CODESURF_OUTPUT_CONVENTION;
}
const CODESURF_INSIGHT_CONVENTION = [
  "## CodeSurf Insight Convention",
  "",
  "Do not emit an Insight block unless the user explicitly asks for an insight.",
  "",
  "When explicitly requested, use this exact wrapper:",
  "`★ Insight ─────────────────────────────────────`",
  "- [point 1]",
  "- [point 2]",
  "`─────────────────────────────────────────────────`",
  "",
  "Keep it to 1–2 bullets. It must explain non-obvious reasoning, not summarize the work."
].join("\n");
function buildCodeSurfInsightConvention() {
  return CODESURF_INSIGHT_CONVENTION;
}
const MAX_IMAGE_BYTES_PER_FILE = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES_PER_REQUEST = 20 * 1024 * 1024;
function buildClaudePromptWithImages(text, imageAttachments) {
  async function* generator() {
    const contentBlocks = [];
    const normalizedText = String(text ?? "").trim();
    if (normalizedText) {
      contentBlocks.push({ type: "text", text: normalizedText });
    }
    let totalBytes = 0;
    for (const attachment of imageAttachments) {
      try {
        if (attachment.byteCount > MAX_IMAGE_BYTES_PER_FILE) {
          log(`skipping oversize image attachment (${attachment.byteCount} B > ${MAX_IMAGE_BYTES_PER_FILE}):`, attachment.displayPath);
          continue;
        }
        if (totalBytes + attachment.byteCount > MAX_IMAGE_BYTES_PER_REQUEST) {
          log("per-request image byte limit reached; dropping remaining attachments");
          break;
        }
        const buffer = await fs.promises.readFile(attachment.path);
        totalBytes += buffer.byteLength;
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: attachment.mediaType,
            data: buffer.toString("base64")
          }
        });
      } catch (err) {
        log("failed to load image attachment", attachment.path, err.message);
      }
    }
    if (contentBlocks.length === 0) {
      contentBlocks.push({ type: "text", text: normalizedText || "(empty message)" });
    }
    yield {
      type: "user",
      message: {
        role: "user",
        content: contentBlocks
      },
      parent_tool_use_id: null
    };
  }
  return generator();
}
function buildClaudeTextInput(text, priority = "now") {
  async function* generator() {
    yield {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text }]
      },
      parent_tool_use_id: null,
      priority,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  return generator();
}
function buildAsyncExecutionPrompt(asyncExecution) {
  if (!asyncExecution) return void 0;
  const lines = [
    "## Async Execution",
    `- Active execution backend: ${asyncExecution.backend} (${asyncExecution.hostLabel}).`
  ];
  if (asyncExecution.providerNativeBackground) {
    lines.push("- Provider-native background agents may be available. Prefer that path for subagents or long-running delegated work when it keeps the main chat responsive.");
  }
  if (asyncExecution.detachedDaemonAvailable) {
    lines.push("- CodeSurf also supports daemon-backed detached jobs that can continue outside the foreground chat.");
  }
  if (asyncExecution.requestedRunMode === "background") {
    lines.push("- This turn is running as a detached background orchestration job. Continue autonomously and do not expect interactive clarification from the foreground chat unless the task is blocked.");
  } else if (asyncExecution.detachedDaemonAvailable) {
    lines.push("- If the user wants the main conversation to stay free while work continues, prefer detached daemon orchestration for the main task thread.");
  }
  return lines.join("\n");
}
function buildClaudeAgentPrompt(basePrompt, memoryPrompt, skillsPrompt, asyncExecution) {
  const asyncPrompt = buildAsyncExecutionPrompt(asyncExecution);
  const outputConvention = buildCodeSurfOutputConvention();
  return joinPromptSections(basePrompt, memoryPrompt, skillsPrompt, asyncPrompt, outputConvention);
}
function buildCodexPrompt(userText, asyncExecution, basePrompt, memoryPrompt, skillsPrompt) {
  const asyncPrompt = buildAsyncExecutionPrompt(asyncExecution);
  const outputConvention = buildCodeSurfOutputConvention();
  const preamble = joinPromptSections(basePrompt, memoryPrompt, skillsPrompt, asyncPrompt, outputConvention);
  return preamble ? `${preamble}

## User Request
${userText}` : userText;
}
function buildPeerSystemPrompt(peers) {
  if (!peers || peers.length === 0) return void 0;
  const hasExtensionActions = peers.some((peer) => peer.actions && peer.actions.length > 0);
  const browserPeers = peers.filter((peer) => peer.tools.some((tool) => tool.startsWith("browser_")));
  const peerLines = peers.map((peer) => {
    const lines = [];
    if (peer.tools.length > 0) {
      lines.push("  Tools: " + peer.tools.join(", "));
    }
    if (peer.actions && peer.actions.length > 0) {
      lines.push("  Actions (call via ext_invoke_action):");
      for (const action of peer.actions) {
        lines.push(`    - ${action.name}: ${action.description}`);
      }
    }
    if (peer.context && Object.keys(peer.context).length > 0) {
      lines.push("  Current context:");
      for (const [key, value] of Object.entries(peer.context)) {
        const display = value === null ? "null" : typeof value === "object" ? JSON.stringify(value) : String(value);
        lines.push(`    ${key}: ${display}`);
      }
    }
    if (lines.length === 0) lines.push("  (no specific tools)");
    return `- Block "${peer.peerId}" (${peer.peerType}):
${lines.join("\n")}`;
  }).join("\n");
  const browserGuide = browserPeers.length > 0 ? [
    "",
    "## Browser Control",
    "If a connected browser block is relevant, use its browser_* tools with that block's tile_id instead of asking the user to navigate manually.",
    "Use the browser context values (for example ctx:browser:url and ctx:browser:navigation) to understand where the browser currently is before deciding the next action."
  ] : [];
  const extActionGuide = hasExtensionActions ? [
    "",
    "## Extension Actions",
    "To control extension blocks, use ext_invoke_action(tile_id, action, params).",
    "To read extension state afterwards, use tile_context_get(tile_id, tag).",
    'IMPORTANT: For artifact/content generation, ALWAYS prefer the "generate" action over "setHtml".',
    "Do NOT generate HTML yourself — let the extension handle it. Just describe what you want in the prompt."
  ] : [];
  return [
    "You are an AI agent running inside CodeSurf, an infinite canvas workspace.",
    "",
    "The following peer blocks are directly connected to you on the canvas:",
    peerLines,
    "",
    "Treat the connected peer list above as authoritative for this turn.",
    "Do not waste time rediscovering tools or the canvas when a connected peer already exposes the needed tool.",
    "",
    "## Peer Collaboration",
    "Use these MCP tools to coordinate with linked peers:",
    "- peer_set_state: Declare your status, task, and files (do this when starting work)",
    "- peer_get_state: See what peers are working on, their todos, and files",
    "- peer_send_message: Send a direct message to a peer",
    "- peer_read_messages: Read incoming messages from peers",
    "- peer_add_todo: Add a shared todo (peers are notified)",
    "- peer_complete_todo: Mark a todo done",
    "",
    "Peer bridge tools for connected blocks require the block ID from the list above as tile_id.",
    "When a connected block already exposes a direct tool for the job, use it immediately instead of stalling or asking the user to perform the action manually.",
    "Do not call canvas_list_tiles or list_extensions first unless the connected peers above do not cover the request.",
    "All tools are prefixed mcp__contex__ (for example mcp__contex__peer_get_state).",
    ...browserGuide,
    ...extActionGuide
  ].join("\n");
}
function syncPeerLinks(req) {
  updateLinks(req.cardId, req.peers?.map((peer) => peer.peerId) ?? []);
}
function normalizeContextBucketBundle(context) {
  if (context?.contextBuckets && Array.isArray(context.contextBuckets.buckets)) {
    return context.contextBuckets;
  }
  if (!context) return void 0;
  const includedBuckets = Array.isArray(context.includedBuckets) ? context.includedBuckets.filter((bucket) => typeof bucket === "string" && bucket.trim().length > 0) : [];
  const sections = Array.isArray(context.sections) ? context.sections.filter((section) => includedBuckets.includes(section.bucket)) : [];
  const bucketOrder = Array.from(/* @__PURE__ */ new Set(["local-only", "remote-safe", ...includedBuckets, ...sections.map((section) => section.bucket)]));
  return {
    version: 1,
    includedBuckets,
    buckets: bucketOrder.map((bucket) => {
      const bucketSections = sections.filter((section) => section.bucket === bucket).map((section) => ({
        scope: section.scope,
        displayPath: section.displayPath,
        importedFrom: section.importedFrom ?? null
      }));
      return {
        bucket,
        included: includedBuckets.includes(bucket),
        sectionCount: bucketSections.length,
        sections: bucketSections
      };
    })
  };
}
function summarizeContextBucketBundle(bundle) {
  const inspectSummary = String(bundle?.inspect?.summary ?? "").trim();
  if (inspectSummary) return inspectSummary;
  if (!bundle) return void 0;
  const sections = bundle.buckets.filter((bucket) => bucket.included).flatMap((bucket) => bucket.sections);
  if (sections.length === 0) return void 0;
  const paths = sections.slice(0, 3).map((section) => section.displayPath);
  const suffix = sections.length > 3 ? ` +${sections.length - 3} more` : "";
  const bucketSummary = bundle.buckets.filter((bucket) => bucket.included).map((bucket) => `${bucket.bucket}: ${bucket.sectionCount}`).join(", ");
  return `Loaded ${sections.length} instruction section${sections.length === 1 ? "" : "s"} [${bucketSummary}]: ${paths.join(", ")}${suffix}`;
}
function buildContextBucketInput(bundle, prompt) {
  const inspectInput = String(bundle?.inspect?.input ?? "").trim();
  if (inspectInput) return inspectInput;
  const promptText = String(prompt ?? "").trim() || void 0;
  if (!bundle) return promptText;
  const lines = [
    "## Outbound Context Buckets",
    `Included buckets: ${bundle.includedBuckets.length > 0 ? bundle.includedBuckets.join(", ") : "none"}`,
    ""
  ];
  for (const bucket of bundle.buckets) {
    if (bucket.included) {
      lines.push(`### ${bucket.bucket}`);
      if (bucket.sections.length === 0) {
        lines.push("- no sections");
      } else {
        for (const section of bucket.sections) {
          lines.push(`- ${section.displayPath}${section.importedFrom ? ` (imported from ${section.importedFrom})` : ""}`);
        }
      }
    } else {
      lines.push(`### ${bucket.bucket} (omitted from outbound bundle)`);
      lines.push("- omitted from outbound bundle");
    }
    lines.push("");
  }
  if (promptText) {
    lines.push("## Injected Prompt");
    lines.push(promptText);
  }
  return lines.join("\n").trim() || void 0;
}
function summarizeMemoryContext(context) {
  return summarizeContextBucketBundle(normalizeContextBucketBundle(context));
}
function buildMemoryContextInput(context) {
  return buildContextBucketInput(
    normalizeContextBucketBundle(context),
    String(context?.prompt ?? "").trim() || void 0
  );
}
function emitMemoryContextLoaded(cardId, context) {
  const summary = summarizeMemoryContext(context);
  if (!summary) return;
  const toolId = `codesurf-memory-${Date.now()}`;
  sendStream(cardId, { type: "tool_start", toolId, toolName: "Workspace Instructions" });
  const input = buildMemoryContextInput(context);
  if (input) {
    sendStream(cardId, { type: "tool_input", toolId, text: input });
  }
  sendStream(cardId, { type: "tool_summary", toolId, toolName: "Workspace Instructions", text: summary });
}
function summarizeSelectedSkills(index) {
  return String(index?.selection?.summary ?? "").trim() || void 0;
}
function buildSelectedSkillsPrompt(index) {
  return String(index?.selection?.prompt ?? "").trim() || void 0;
}
function emitSelectedSkillsLoaded(cardId, index) {
  const summary = summarizeSelectedSkills(index);
  if (!summary) return;
  const toolId = `codesurf-skills-${Date.now()}`;
  sendStream(cardId, { type: "tool_start", toolId, toolName: "Included Skills" });
  const input = buildSelectedSkillsPrompt(index);
  if (input) {
    sendStream(cardId, { type: "tool_input", toolId, text: input });
  }
  sendStream(cardId, { type: "tool_summary", toolId, toolName: "Included Skills", text: summary });
}
function emitFileReferenceExpansion(cardId, expansion) {
  const summary = String(expansion?.summaryText ?? "").trim();
  if (!summary) return;
  const toolId = `codesurf-file-refs-${Date.now()}`;
  sendStream(cardId, { type: "tool_start", toolId, toolName: "Workspace File References" });
  const input = String(expansion?.inputText ?? "").trim();
  if (input) {
    sendStream(cardId, { type: "tool_input", toolId, text: input });
  }
  sendStream(cardId, { type: "tool_summary", toolId, toolName: "Workspace File References", text: summary });
}
async function loadRuntimeMemoryContext(req) {
  if (!req.workspaceId) return null;
  return await daemonClient.loadMemoryContext(
    req.workspaceId,
    req.executionTarget === "cloud" ? "cloud" : "local"
  );
}
async function loadRuntimeSkillsContext(req) {
  const workspaceId = String(req.workspaceId ?? "").trim();
  const workspaceDir = String(req.workspaceDir ?? "").trim();
  if (!workspaceId && !workspaceDir) return null;
  return await daemonClient.listSkills({
    workspaceId: workspaceId || null,
    workspaceDir: workspaceDir || null,
    cardId: req.cardId
  });
}
async function selectChatExecutionHost(req) {
  const { hosts, localDaemonAvailable } = await getExecutionRoutingState();
  const settings = readSettingsSync();
  const executionPreference = req.executionPreference ?? settings.execution;
  const provider = String(req.provider ?? "").trim();
  if (!supportsDaemonChatProvider(provider)) {
    const providerLabel = provider || "This provider";
    if (req.executionTarget === "cloud") {
      throw new Error(`${providerLabel} does not support remote daemon execution yet. Daemon-backed chat currently supports Claude, Codex, OpenCode, and Hermes only.`);
    }
    if (executionPreference.mode === "daemon-only" || executionPreference.mode === "specific-host") {
      throw new Error(`${providerLabel} does not support daemon-backed chat yet. Supported daemon providers: Claude, Codex, OpenCode, and Hermes.`);
    }
    return null;
  }
  if (req.executionTarget === "cloud") {
    const remoteHosts = hosts.filter((host) => host.type === "remote-daemon" && host.enabled !== false);
    const chosen = remoteHosts.find((host) => host.id === req.cloudHostId) ?? remoteHosts.find((host) => host.id === executionPreference.hostId) ?? remoteHosts[0];
    if (!chosen) {
      throw new Error("No remote daemon is registered for cloud execution");
    }
    return chosen;
  }
  const resolution = resolveExecutionTarget({
    hosts,
    preference: executionPreference,
    localDaemonAvailable
  });
  return resolution.host.type === "runtime" ? null : resolution.host;
}
async function buildProjectContext(workspaceDir) {
  const normalizedWorkspace = String(workspaceDir ?? "").trim();
  if (!normalizedWorkspace) {
    return { workspaceDir: null, gitRemoteUrl: null, gitBranch: null, repoName: null };
  }
  const shellPath = getShellEnvPath();
  const env = { ...process.env, ...shellPath && { PATH: shellPath } };
  let repoRoot = normalizedWorkspace;
  let gitRemoteUrl = null;
  let gitBranch = null;
  try {
    repoRoot = child_process.execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: normalizedWorkspace,
      encoding: "utf8",
      env
    }).trim() || normalizedWorkspace;
    gitRemoteUrl = child_process.execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: repoRoot,
      encoding: "utf8",
      env
    }).trim() || null;
    gitBranch = child_process.execFileSync("git", ["branch", "--show-current"], {
      cwd: repoRoot,
      encoding: "utf8",
      env
    }).trim() || null;
  } catch {
    repoRoot = normalizedWorkspace;
  }
  return {
    workspaceDir: repoRoot,
    gitRemoteUrl,
    gitBranch,
    repoName: path$1.basename(repoRoot) || null
  };
}
async function attachDaemonJobStream(cardId, host, jobId, sinceSequence = 0) {
  stopDaemonStream(cardId);
  const endpoint = await resolveHostEndpoint(host);
  const abortController = new AbortController();
  activeDaemonStreams.set(cardId, { abortController, host, jobId });
  try {
    const response = await fetch(`${endpoint.baseUrl}/chat/job/events?jobId=${encodeURIComponent(jobId)}&since=${encodeURIComponent(String(sinceSequence))}`, {
      headers: {
        Accept: "text/event-stream",
        ...endpoint.token ? { Authorization: `Bearer ${endpoint.token}` } : {}
      },
      signal: abortController.signal
    });
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Failed to stream daemon job (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLines = chunk.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
        if (dataLines.length > 0) {
          try {
            const payload = JSON.parse(dataLines.join("\n"));
            sendStream(cardId, payload);
          } catch (error) {
            log("daemon stream parse error", error);
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    if (abortController.signal.aborted) return;
    if (error instanceof Error && error.name === "AbortError") return;
    throw error;
  } finally {
    const active = activeDaemonStreams.get(cardId);
    if (active?.jobId === jobId) {
      activeDaemonStreams.delete(cardId);
    }
  }
}
async function sendChatToDaemon(req, host) {
  const rawProjectContext = await buildProjectContext(req.workspaceDir);
  const contextPolicy = buildProviderContextPolicy({
    executionTarget: req.executionTarget,
    hostType: host.type
  });
  const projectContext = applyProjectContextPolicy(rawProjectContext, contextPolicy);
  log("daemon projectContext policy", {
    hostType: host.type,
    executionTarget: req.executionTarget ?? "local",
    reason: contextPolicy.reason,
    raw: describeProjectContextEnvelope(rawProjectContext),
    effective: describeProjectContextEnvelope(projectContext)
  });
  const job = await hostRequest(host, "/chat/job/start", {
    body: {
      request: {
        ...req,
        messages: getPreparedMessages(req),
        projectContext
      }
    }
  });
  if (req.runMode !== "background") {
    void attachDaemonJobStream(req.cardId, host, job.id, 0).catch((error) => {
      sendStream(req.cardId, { type: "error", error: error.message, jobId: job.id });
      sendStream(req.cardId, { type: "done", jobId: job.id });
    });
  }
  return { ok: true, jobId: job.id, detached: req.runMode === "background" };
}
async function resumeChatDaemonJob(req) {
  if (!req.jobId) return { ok: false, resumed: false, jobId: null };
  const host = await selectChatExecutionHost(req);
  if (!host) return { ok: false, resumed: false, jobId: req.jobId };
  const state = await hostRequest(host, `/chat/job/state?jobId=${encodeURIComponent(req.jobId)}`);
  const sinceSequence = Number(req.jobSequence ?? 0);
  if (state.status !== "running" && sinceSequence >= Number(state.lastSequence ?? 0)) {
    if (state.error) {
      sendStream(req.cardId, { type: "error", error: state.error, jobId: req.jobId, sequence: state.lastSequence });
    }
    sendStream(req.cardId, { type: "done", jobId: req.jobId, sequence: state.lastSequence, sessionId: state.sessionId ?? void 0 });
    return { ok: true, resumed: false, jobId: req.jobId };
  }
  void attachDaemonJobStream(req.cardId, host, req.jobId, sinceSequence).catch((error) => {
    sendStream(req.cardId, { type: "error", error: error.message, jobId: req.jobId });
    sendStream(req.cardId, { type: "done", jobId: req.jobId });
  });
  return { ok: true, resumed: true, jobId: req.jobId };
}
async function cancelChatDaemonJob(cardId) {
  const active = activeDaemonStreams.get(cardId);
  if (!active) return;
  try {
    await hostRequest(active.host, "/chat/job/cancel", {
      body: { jobId: active.jobId }
    });
  } catch (error) {
    log("daemon cancel error", error);
  } finally {
    stopDaemonStream(cardId);
  }
}
function chatLocalProxy(req) {
  const transport = req.providerTransport;
  if (!transport || transport.type !== "local-proxy") {
    sendStream(req.cardId, { type: "error", error: `Unsupported provider: ${req.provider}` });
    sendStream(req.cardId, { type: "done" });
    return;
  }
  void (async () => {
    if (transport.autoStart !== false) {
      const configuredPort = (() => {
        try {
          const url2 = new URL(transport.baseUrl);
          return url2.port ? Number(url2.port) : 80;
        } catch {
          return void 0;
        }
      })();
      const started = await ensureLocalProxyRunning(configuredPort);
      if (!started.ok) {
        throw new Error(started.message || "Failed to start the local proxy");
      }
    }
    const baseUrl = transport.baseUrl.replace(/\/+$/, "");
    const targetUrl = new URL(`${baseUrl}/messages`);
    const body = JSON.stringify({
      model: req.model,
      stream: true,
      max_tokens: 4096,
      messages: getPreparedMessages(req).map((message) => ({
        role: message.role,
        content: message.content
      }))
    });
    const request = http__namespace.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port ? Number(targetUrl.port) : 80,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "anthropic-version": "2023-06-01",
        ...transport.apiKey ? {
          "x-api-key": transport.apiKey,
          Authorization: `Bearer ${transport.apiKey}`
        } : {}
      },
      timeout: 12e4
    }, (res) => {
      if ((res.statusCode ?? 500) >= 400) {
        void bufferHttpResponse(res).then((raw) => {
          activeHttpRequests.delete(req.cardId);
          let errorMessage = `Proxy request failed (${res.statusCode ?? 500})`;
          try {
            const parsed = JSON.parse(raw);
            errorMessage = parsed?.error?.message ?? errorMessage;
          } catch {
            if (raw.trim()) errorMessage = raw.trim();
          }
          sendStream(req.cardId, { type: "error", error: errorMessage });
          sendStream(req.cardId, { type: "done" });
        }).catch((err) => {
          activeHttpRequests.delete(req.cardId);
          sendStream(req.cardId, { type: "error", error: err.message });
          sendStream(req.cardId, { type: "done" });
        });
        return;
      }
      res.on("close", () => {
        activeHttpRequests.delete(req.cardId);
      });
      parseClaudeStream(req.cardId, res);
    });
    request.on("timeout", () => {
      request.destroy(new Error("Proxy request timed out"));
    });
    request.on("error", (err) => {
      if (!activeHttpRequests.has(req.cardId)) return;
      activeHttpRequests.delete(req.cardId);
      sendStream(req.cardId, { type: "error", error: err.message });
      sendStream(req.cardId, { type: "done" });
    });
    activeHttpRequests.set(req.cardId, request);
    request.write(body);
    request.end();
  })().catch((err) => {
    activeHttpRequests.delete(req.cardId);
    sendStream(req.cardId, { type: "error", error: err.message });
    sendStream(req.cardId, { type: "done" });
  });
}
function findAvailablePort() {
  return new Promise((resolve2, reject) => {
    const server = net__namespace.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      server.close(() => resolve2(addr.port));
    });
    server.on("error", reject);
  });
}
function resolveOpenCodeBinary() {
  const detected = getAgentPath("opencode");
  if (detected) return detected;
  try {
    const shellPath = getShellEnvPath();
    return child_process.execFileSync("which", ["opencode"], {
      encoding: "utf-8",
      env: { ...process.env, ...shellPath && { PATH: shellPath } }
    }).trim() || null;
  } catch {
    return null;
  }
}
class OpenCodeServerManager {
  static instance = null;
  server = null;
  port = null;
  startPromise = null;
  static getInstance() {
    if (!OpenCodeServerManager.instance) {
      OpenCodeServerManager.instance = new OpenCodeServerManager();
    }
    return OpenCodeServerManager.instance;
  }
  async ensureRunning() {
    if (this.startPromise) return this.startPromise;
    if (this.server && this.port && !this.server.killed) {
      return { port: this.port, url: `http://127.0.0.1:${this.port}` };
    }
    this.startPromise = this.startServer();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }
  async startServer() {
    const binary = resolveOpenCodeBinary();
    if (!binary) throw new Error("opencode CLI not found. Install: go install github.com/opencodeco/opencode@latest");
    this.port = await findAvailablePort();
    const url2 = `http://127.0.0.1:${this.port}`;
    return new Promise((resolve2, reject) => {
      const shellPath = getShellEnvPath();
      this.server = child_process.spawn(binary, ["serve", "--port", String(this.port)], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...shellPath && { PATH: shellPath } }
      });
      let started = false;
      const timeout = setTimeout(() => {
        if (!started) reject(new Error("OpenCode server startup timeout (30s)"));
      }, 3e4);
      this.server.stdout?.on("data", (data) => {
        const output = data.toString();
        log("opencode stdout:", output.trim().slice(0, 200));
        if (output.includes("listening on") && !started) {
          started = true;
          clearTimeout(timeout);
          resolve2({ port: this.port, url: url2 });
        }
      });
      this.server.stderr?.on("data", (data) => {
        log("opencode stderr:", data.toString().trim().slice(0, 200));
      });
      this.server.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      this.server.on("exit", (code) => {
        if (!started) {
          clearTimeout(timeout);
          reject(new Error(`OpenCode server exited with code ${code}`));
        }
        this.server = null;
        this.port = null;
      });
    });
  }
  async shutdown() {
    if (this.server && !this.server.killed) {
      this.server.kill("SIGTERM");
      await new Promise((resolve2) => {
        const t = setTimeout(() => {
          this.server?.kill("SIGKILL");
          resolve2();
        }, 5e3);
        this.server?.on("exit", () => {
          clearTimeout(t);
          resolve2();
        });
      });
    }
    this.server = null;
    this.port = null;
  }
  isRunning() {
    return !!(this.server && this.port && !this.server.killed);
  }
}
const OPEN_CODE_FALLBACK_MODELS = [
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "openai/gpt-5.4", label: "GPT-5.4" },
  { id: "openai/o4-mini", label: "o4-mini" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" }
];
let cachedOpenCodeModels = [];
let openCodeModelsInflight = null;
let openCodeModelsRefreshPromise = null;
let cachedOpenCodeModelsAt = 0;
const OPEN_CODE_MODELS_CACHE_MS = 15e3;
function getOpenCodeFallbackModels() {
  return OPEN_CODE_FALLBACK_MODELS.map((model) => ({ ...model }));
}
function broadcastOpenCodeModelsUpdated(payload) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send("chat:opencodeModelsUpdated", payload);
  }
}
function refreshOpenCodeModelsInBackground(force = false) {
  if (openCodeModelsRefreshPromise && !force) return openCodeModelsRefreshPromise;
  const isFresh = cachedOpenCodeModels.length > 0 && Date.now() - cachedOpenCodeModelsAt < OPEN_CODE_MODELS_CACHE_MS;
  if (isFresh && !force) return Promise.resolve();
  openCodeModelsRefreshPromise = (async () => {
    try {
      const models = await fetchOpenCodeModels();
      const nextModels = models.length > 0 ? models : getOpenCodeFallbackModels();
      broadcastOpenCodeModelsUpdated({
        models: nextModels,
        source: models.length > 0 ? "opencode" : "fallback"
      });
    } catch (err) {
      log("refreshOpenCodeModelsInBackground error:", err.message ?? String(err));
      const nextModels = cachedOpenCodeModels.length > 0 ? cachedOpenCodeModels : getOpenCodeFallbackModels();
      broadcastOpenCodeModelsUpdated({
        models: nextModels,
        source: cachedOpenCodeModels.length > 0 ? "cache" : "fallback",
        error: err.message ?? String(err)
      });
    } finally {
      openCodeModelsRefreshPromise = null;
    }
  })();
  return openCodeModelsRefreshPromise;
}
function warmOpenCodeModelsOnStartup() {
}
async function fetchOpenCodeModels() {
  const now = Date.now();
  if (cachedOpenCodeModels.length > 0 && now - cachedOpenCodeModelsAt < OPEN_CODE_MODELS_CACHE_MS) {
    return cachedOpenCodeModels;
  }
  if (openCodeModelsInflight) return openCodeModelsInflight;
  openCodeModelsInflight = (async () => {
    const { client } = await getOrCreateOpencodeClient();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("OpenCode provider.list timed out after 10s")), 1e4);
    });
    const response = await Promise.race([
      client.provider.list(),
      timeoutPromise
    ]);
    if (response.error) {
      throw new Error(`Failed to fetch OpenCode providers: ${JSON.stringify(response.error)}`);
    }
    const providers = response.data;
    if (!providers) return [];
    const connectedIds = new Set(providers.connected ?? []);
    if (connectedIds.size === 0) {
      log("OpenCode: no connected providers found");
      return [];
    }
    const models = [];
    for (const provider of providers.all ?? []) {
      if (!connectedIds.has(provider.id)) continue;
      for (const [modelId, model] of Object.entries(provider.models ?? {})) {
        const m = model;
        models.push({
          id: `${provider.id}/${modelId}`,
          label: m.name ?? modelId,
          description: `${provider.name ?? provider.id} - ${m.family ?? ""}`.trim()
        });
      }
    }
    log(`OpenCode: fetched ${models.length} models from ${connectedIds.size} connected providers`);
    cachedOpenCodeModels = models;
    cachedOpenCodeModelsAt = Date.now();
    return models;
  })();
  try {
    return await openCodeModelsInflight;
  } finally {
    openCodeModelsInflight = null;
  }
}
function chatClaude(req) {
  const lastUserMsg = [...getPreparedMessages(req)].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    sendStream(req.cardId, { type: "error", error: "No user message" });
    return;
  }
  if (req.sessionId && !sessionIds.has(req.cardId)) {
    sessionIds.set(req.cardId, req.sessionId);
    persistSessionIds();
  }
  const existingSessionId = sessionIds.get(req.cardId);
  const runtimeMessages = cloneChatMessages(req.messages);
  const runtimeSession = {
    provider: req.provider,
    model: req.model,
    sessionId: existingSessionId ?? req.sessionId ?? null,
    jobId: req.jobId ?? null,
    jobSequence: typeof req.jobSequence === "number" ? req.jobSequence : 0,
    executionTarget: req.executionTarget === "cloud" ? "cloud" : "local",
    cloudHostId: req.cloudHostId ?? null,
    isStreaming: true,
    messages: runtimeMessages
  };
  void upsertRuntimeSessionState(req, runtimeSession);
  log("chatClaude starting", {
    model: req.model,
    prompt: lastUserMsg.content.slice(0, 100),
    resuming: !!existingSessionId,
    sessionId: existingSessionId?.slice(0, 8)
  });
  const abortController = new AbortController();
  let claudeStderr = "";
  const modeMap = {
    default: "default",
    acceptEdits: "acceptEdits",
    plan: "plan",
    bypassPermissions: "bypassPermissions"
  };
  const permMode = modeMap[req.mode ?? ""] ?? "default";
  cardPermissionModes.set(req.cardId, permMode);
  const thinkingMap = {
    adaptive: { type: "adaptive" },
    none: { type: "disabled" },
    low: { type: "enabled", budget_tokens: 2048 },
    medium: { type: "enabled", budget_tokens: 8192 },
    high: { type: "enabled", budget_tokens: 32768 },
    max: { type: "enabled", budget_tokens: 131072 }
  };
  const thinkingConfig = thinkingMap[req.thinking ?? ""] ?? { type: "adaptive" };
  const mcpPort = getMCPPort();
  const mcpServers = {};
  if (req.mcpEnabled !== false && mcpPort) {
    mcpServers.contex = {
      type: "http",
      url: `http://127.0.0.1:${mcpPort}/mcp`,
      headers: { Authorization: `Bearer ${getMCPToken()}` }
    };
    log("MCP server attached at port", mcpPort);
  }
  const contexToolNames = getContexMcpToolNames();
  const disallowedPeerBridgeTools = req.mcpEnabled === false ? [] : getDisconnectedPeerBridgeMcpToolNames(req.negotiatedTools ?? req.peers?.flatMap((peer) => peer.tools) ?? []);
  if (req.peers && req.peers.length > 0) {
    log("Peer data:", JSON.stringify(req.peers.map((p) => ({ id: p.peerId, type: p.peerType, tools: p.tools.length, actions: p.actions?.length ?? 0 }))));
  }
  let systemPrompt = buildPeerSystemPrompt(req.peers);
  if (systemPrompt) {
    log("systemPrompt built for", req.peers?.length ?? 0, "peers, contex tools:", contexToolNames.length);
  }
  systemPrompt = buildClaudeAgentPrompt(systemPrompt, req.memoryPrompt, req.skillsPrompt, req.asyncExecution);
  const claudePath = getAgentPath("claude");
  const options = {
    model: req.model,
    abortController,
    persistSession: true,
    includePartialMessages: true,
    permissionMode: permMode,
    ...permMode === "bypassPermissions" ? { allowDangerouslySkipPermissions: true } : {},
    thinking: thinkingConfig,
    // AskUserQuestion must be intercepted regardless of permission mode so the
    // agent's question actually reaches the user. Everything else honours permMode.
    canUseTool: async (toolName, input, toolOptions) => {
      if (toolName === "AskUserQuestion") {
        try {
          const rawQuestions = input?.questions;
          const questions = Array.isArray(rawQuestions) ? rawQuestions.filter((q) => q && typeof q.question === "string" && Array.isArray(q.options)) : [];
          if (questions.length > 0) {
            const toolUseID2 = typeof toolOptions?.toolUseID === "string" ? toolOptions.toolUseID : null;
            const { answers, annotations } = await awaitAskUserQuestionAnswer(req.cardId, toolUseID2, questions);
            return {
              behavior: "allow",
              updatedInput: {
                ...input,
                answers,
                ...annotations && Object.keys(annotations).length > 0 ? { annotations } : {}
              },
              toolUseID: toolOptions?.toolUseID
            };
          }
        } catch (err) {
          log("AskUserQuestion interception error:", err.message);
        }
        return { behavior: "allow", toolUseID: toolOptions?.toolUseID };
      }
      const currentMode = cardPermissionModes.get(req.cardId) ?? permMode;
      if (currentMode === "bypassPermissions") {
        return await allowToolWithCheckpoint(req, toolName, input, toolOptions);
      }
      const permissionRequest = {
        provider: "claude",
        toolName,
        title: typeof toolOptions?.title === "string" ? toolOptions.title : null,
        description: typeof toolOptions?.description === "string" ? toolOptions.description : null,
        blockedPath: typeof toolOptions?.blockedPath === "string" ? toolOptions.blockedPath : null,
        workspaceDir: req.workspaceDir
      };
      const storedDecision = resolveStoredPermission(permissionRequest);
      if (storedDecision === "allow") {
        return await allowToolWithCheckpoint(req, toolName, input, toolOptions);
      }
      if (storedDecision === "deny") {
        const toolUseID2 = typeof toolOptions?.toolUseID === "string" ? toolOptions.toolUseID : `claude-permission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        sendStream(req.cardId, {
          type: "tool_permission_resolved",
          toolId: toolUseID2,
          toolName,
          decision: "never"
        });
        return {
          behavior: "deny",
          message: "Tool permission permanently denied (Never). Clear it in Settings → Permissions to re-enable prompts.",
          toolUseID: toolOptions?.toolUseID
        };
      }
      const sdkToolUseID = typeof toolOptions?.toolUseID === "string" ? toolOptions.toolUseID : null;
      const toolUseID = sdkToolUseID ?? `claude-permission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let decision;
      try {
        decision = await awaitToolPermissionAnswer(req.cardId, toolUseID, permissionRequest);
      } catch (err) {
        log("tool permission await error:", err.message);
        return {
          behavior: "deny",
          message: "Tool permission request was cancelled.",
          toolUseID: sdkToolUseID ?? toolOptions?.toolUseID
        };
      }
      sendStream(req.cardId, {
        type: "tool_permission_resolved",
        toolId: toolUseID,
        toolName,
        decision
      });
      if (decision === "deny" || decision === "never") {
        if (decision === "never") {
          try {
            persistGrant(permissionRequest, "never");
          } catch (err) {
            log("tool permission persist (never) error:", err.message);
          }
        }
        return {
          behavior: "deny",
          message: decision === "never" ? "Tool permission permanently denied. Future calls will be auto-rejected." : "Tool permission denied by the user.",
          toolUseID: sdkToolUseID ?? toolOptions?.toolUseID
        };
      }
      try {
        if (decision === "session") storeSessionGrant(permissionRequest);
        else if (decision === "today" || decision === "forever") persistGrant(permissionRequest, decision);
      } catch (err) {
        log("tool permission persist error:", err.message);
      }
      return await allowToolWithCheckpoint(req, toolName, input, toolOptions);
    },
    ...Object.keys(mcpServers).length > 0 && { mcpServers },
    ...disallowedPeerBridgeTools.length > 0 && { disallowedTools: disallowedPeerBridgeTools },
    // Use detected system binary, not the SDK's bundled cli.js
    ...claudePath && { pathToClaudeCodeExecutable: claudePath },
    stderr: (data) => {
      claudeStderr += data;
    }
  };
  if (existingSessionId) {
    options.resume = existingSessionId;
  }
  try {
    log("calling query()...");
    if (systemPrompt) {
      options.agent = "contex";
      options.agents = {
        contex: {
          description: "CodeSurf canvas AI agent with peer block awareness",
          prompt: systemPrompt
        }
      };
    }
    const promptForQuery = buildClaudePromptWithImages(lastUserMsg.content, req.imageAttachments);
    const q = claudeAgentSdk.query({ prompt: promptForQuery, options });
    log("query() returned, consuming generator...", req.imageAttachments?.length ? `(with ${req.imageAttachments.length} image attachment${req.imageAttachments.length === 1 ? "" : "s"})` : "");
    activeQueries.set(req.cardId, q);
    (async () => {
      let capturedSessionId = false;
      let assistantText = "";
      const streamedTextByIndex = /* @__PURE__ */ new Map();
      let streamTurn = 0;
      let currentThinkingId = null;
      try {
        for await (const msg of q) {
          if (!isActiveQuery(req.cardId, q)) {
            return;
          }
          if (!capturedSessionId) {
            const sid = msg.session_id;
            if (sid) {
              log("captured session_id:", sid.slice(0, 8));
              sessionIds.set(req.cardId, sid);
              persistSessionIds();
              runtimeSession.sessionId = sid;
              void upsertRuntimeSessionState(req, runtimeSession);
              sendStream(req.cardId, { type: "session", sessionId: sid });
              capturedSessionId = true;
            }
          }
          log("msg received:", msg.type, msg.type === "stream_event" ? msg.event?.type : "");
          if (msg.type === "stream_event") {
            const evt = msg.event;
            if (evt.type === "content_block_delta") {
              if (evt.delta?.type === "text_delta" && evt.delta.text) {
                const key = `${streamTurn}:${evt.index ?? 0}`;
                streamedTextByIndex.set(key, (streamedTextByIndex.get(key) ?? "") + evt.delta.text);
                assistantText += evt.delta.text;
                sendStream(req.cardId, { type: "text", text: evt.delta.text });
              } else if (evt.delta?.type === "thinking_delta" && evt.delta.thinking) {
                sendStream(req.cardId, { type: "thinking", text: evt.delta.thinking, thinkingId: currentThinkingId });
              } else if (evt.delta?.type === "input_json_delta" && evt.delta.partial_json) {
                sendStream(req.cardId, { type: "tool_input", text: evt.delta.partial_json });
              }
            } else if (evt.type === "content_block_start") {
              if (evt.content_block?.type === "tool_use") {
                sendStream(req.cardId, {
                  type: "tool_start",
                  toolName: evt.content_block.name,
                  toolId: evt.content_block.id
                });
              } else if (evt.content_block?.type === "thinking") {
                const thinkingId = `think-${streamTurn}-${evt.index ?? 0}`;
                currentThinkingId = thinkingId;
                sendStream(req.cardId, { type: "thinking_start", thinkingId });
              }
            } else if (evt.type === "content_block_stop") {
              sendStream(req.cardId, { type: "block_stop", index: evt.index, thinkingId: currentThinkingId });
              currentThinkingId = null;
            }
          } else if (msg.type === "assistant") {
            const message = msg.message;
            if (message?.content) {
              for (let idx = 0; idx < message.content.length; idx++) {
                const block = message.content[idx];
                if (block.type === "tool_use") {
                  const toolInputStr = JSON.stringify(block.input, null, 2);
                  sendStream(req.cardId, {
                    type: "tool_use",
                    toolName: block.name,
                    toolId: block.id,
                    toolInput: toolInputStr
                  });
                  const fileChanges = buildAnthropicFileChanges(
                    block.name,
                    toolInputStr,
                    req.workspaceDir
                  );
                  if (fileChanges.length > 0) {
                    sendStream(req.cardId, {
                      type: "tool_summary",
                      toolId: block.id,
                      toolName: block.name,
                      fileChanges
                    });
                  }
                } else if (block.type === "text" && typeof block.text === "string" && block.text.length > 0) {
                  const key = `${streamTurn}:${idx}`;
                  const alreadyStreamed = streamedTextByIndex.get(key) ?? "";
                  if (block.text === alreadyStreamed) continue;
                  const tail = block.text.startsWith(alreadyStreamed) ? block.text.slice(alreadyStreamed.length) : block.text;
                  if (tail.length > 0) {
                    assistantText += tail;
                    sendStream(req.cardId, { type: "text", text: tail });
                    streamedTextByIndex.set(key, block.text);
                  }
                }
              }
            }
            streamTurn += 1;
          } else if (msg.type === "tool_use_summary") {
            sendStream(req.cardId, {
              type: "tool_summary",
              text: msg.summary
            });
          } else if (msg.type === "tool_progress") {
            sendStream(req.cardId, {
              type: "tool_progress",
              toolName: msg.tool_name,
              elapsed: msg.elapsed_time_seconds
            });
          } else if (msg.type === "result") {
            if (!isActiveQuery(req.cardId, q)) {
              return;
            }
            const result = msg;
            if (!assistantText && typeof result.result === "string" && result.result.trim()) {
              assistantText = result.result;
            }
            if (assistantText.trim()) {
              runtimeSession.messages = [
                ...runtimeMessages,
                { role: "assistant", content: assistantText }
              ];
            }
            runtimeSession.sessionId = result.session_id ?? runtimeSession.sessionId;
            runtimeSession.isStreaming = false;
            void upsertRuntimeSessionState(req, runtimeSession);
            sendStream(req.cardId, {
              type: "done",
              cost: result.total_cost_usd,
              turns: result.num_turns,
              resultText: result.result,
              sessionId: result.session_id
            });
            clearActiveQuery(req.cardId, q);
            if (result.session_id && !sessionIds.has(req.cardId)) {
              sessionIds.set(req.cardId, result.session_id);
              persistSessionIds();
            }
          }
        }
        if (isActiveQuery(req.cardId, q)) {
          if (assistantText.trim()) {
            runtimeSession.messages = [
              ...runtimeMessages,
              { role: "assistant", content: assistantText }
            ];
          }
          runtimeSession.isStreaming = false;
          void upsertRuntimeSessionState(req, runtimeSession);
          sendStream(req.cardId, { type: "done", sessionId: runtimeSession.sessionId ?? void 0 });
          clearActiveQuery(req.cardId, q);
        }
      } catch (err) {
        if (intentionallyClosedQueries.has(q) || !isActiveQuery(req.cardId, q)) {
          log("generator closed for inactive Claude query:", err?.message ?? String(err));
          clearActiveQuery(req.cardId, q);
          return;
        }
        const errorMessage = formatClaudeSdkError(err, claudeStderr);
        log("generator error:", errorMessage);
        if (assistantText.trim()) {
          runtimeSession.messages = [
            ...runtimeMessages,
            { role: "assistant", content: assistantText }
          ];
        }
        runtimeSession.isStreaming = false;
        void upsertRuntimeSessionState(req, runtimeSession);
        sendStream(req.cardId, { type: "error", error: errorMessage });
        clearActiveQuery(req.cardId, q);
      }
    })();
  } catch (err) {
    const errorMessage = formatClaudeSdkError(err, claudeStderr);
    log("query() threw:", errorMessage);
    sendStream(req.cardId, { type: "error", error: errorMessage });
  }
}
function normalizeCodexShellCommand(command) {
  const trimmed = command.trim();
  const quotedMatch = trimmed.match(/^\/bin\/zsh -lc '([\s\S]*)'$/);
  if (quotedMatch) return quotedMatch[1].replace(/'\\''/g, "'");
  const plainMatch = trimmed.match(/^\/bin\/zsh -lc (.+)$/);
  if (plainMatch) return plainMatch[1].trim();
  return trimmed;
}
function classifyCodexCommand(command) {
  const normalized = command.trim();
  if (/(^|\s)(rg|grep|fd|findstr)\b/.test(normalized)) return "search";
  if (/(^|\s)(cat|sed|head|tail|less|more|bat|ls)\b/.test(normalized)) return "read";
  return "command";
}
function buildExploreToolName(entries) {
  const readCount = entries.filter((entry) => entry.kind === "read").length;
  const searchCount = entries.filter((entry) => entry.kind === "search").length;
  const labelParts = [];
  if (readCount > 0) labelParts.push(`${readCount} file${readCount === 1 ? "" : "s"}`);
  if (searchCount > 0) labelParts.push(`${searchCount} search${searchCount === 1 ? "" : "es"}`);
  return labelParts.length > 0 ? `Explored ${labelParts.join(", ")}` : "Explored workspace";
}
function buildEditedToolName(fileChanges) {
  return `Edited ${fileChanges.length} file${fileChanges.length === 1 ? "" : "s"}`;
}
function displayPathForWorkspace(absPath, workspaceDir) {
  if (!absPath) return "";
  if (!workspaceDir) return absPath;
  const ws = workspaceDir.replace(/\/$/, "");
  if (absPath === ws) return "";
  if (absPath.startsWith(ws + "/")) return absPath.slice(ws.length + 1);
  return absPath;
}
function countLines(s) {
  if (!s) return 0;
  const trimmed = s.replace(/\n$/, "");
  if (trimmed === "") return 0;
  return trimmed.split("\n").length;
}
function makeEditDiff(oldStr, newStr) {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const chunks = [];
  for (const line of oldLines) chunks.push("-" + line);
  for (const line of newLines) chunks.push("+" + line);
  return chunks.join("\n");
}
function makeWholeFileDiff(content, kind) {
  const marker = kind === "add" ? "+" : "-";
  return content.split("\n").map((line) => marker + line).join("\n");
}
function buildAnthropicFileChanges(toolName, rawInput, workspaceDir) {
  let parsed;
  try {
    parsed = JSON.parse(rawInput);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed;
  const getStr = (k) => typeof obj[k] === "string" ? obj[k] : null;
  if (toolName === "Edit") {
    const filePath = getStr("file_path") ?? "";
    if (!filePath) return [];
    const oldStr = getStr("old_string") ?? "";
    const newStr = getStr("new_string") ?? "";
    const diff = makeEditDiff(oldStr, newStr);
    return [{
      path: displayPathForWorkspace(filePath, workspaceDir),
      changeType: "update",
      additions: countLines(newStr),
      deletions: countLines(oldStr),
      diff
    }];
  }
  if (toolName === "MultiEdit") {
    const filePath = getStr("file_path") ?? "";
    if (!filePath) return [];
    const edits = Array.isArray(obj.edits) ? obj.edits : [];
    let additions = 0;
    let deletions = 0;
    const diffChunks = [];
    for (const edit of edits) {
      if (!edit || typeof edit !== "object") continue;
      const e = edit;
      const oldStr = typeof e.old_string === "string" ? e.old_string : "";
      const newStr = typeof e.new_string === "string" ? e.new_string : "";
      additions += countLines(newStr);
      deletions += countLines(oldStr);
      diffChunks.push(makeEditDiff(oldStr, newStr));
    }
    if (additions === 0 && deletions === 0) return [];
    return [{
      path: displayPathForWorkspace(filePath, workspaceDir),
      changeType: "update",
      additions,
      deletions,
      diff: diffChunks.join("\n")
    }];
  }
  if (toolName === "Write") {
    const filePath = getStr("file_path") ?? "";
    if (!filePath) return [];
    const content = getStr("content") ?? "";
    const priorExisted = (() => {
      try {
        return fs.existsSync(filePath);
      } catch {
        return true;
      }
    })();
    return [{
      path: displayPathForWorkspace(filePath, workspaceDir),
      changeType: priorExisted ? "update" : "add",
      additions: countLines(content),
      deletions: 0,
      diff: makeWholeFileDiff(content, "add")
    }];
  }
  if (toolName === "NotebookEdit") {
    const filePath = getStr("notebook_path") ?? getStr("file_path") ?? "";
    if (!filePath) return [];
    const newSource = getStr("new_source") ?? "";
    if (!newSource) return [];
    return [{
      path: displayPathForWorkspace(filePath, workspaceDir),
      changeType: "update",
      additions: countLines(newSource),
      deletions: 0,
      diff: makeWholeFileDiff(newSource, "add")
    }];
  }
  return [];
}
function countDiffStats(diff) {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) additions += 1;
    if (line.startsWith("-")) deletions += 1;
  }
  return { additions, deletions };
}
function changeTypeFromCodexKind(kind) {
  if (kind === "add" || kind === "delete" || kind === "move") return kind;
  return "update";
}
function mergeFileChanges(fileChanges) {
  const merged = /* @__PURE__ */ new Map();
  for (const change of fileChanges) {
    const key = `${change.path}::${change.previousPath ?? ""}::${change.changeType}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...change });
      continue;
    }
    existing.additions += change.additions;
    existing.deletions += change.deletions;
    existing.diff = `${existing.diff}

${change.diff}`.trim();
  }
  return Array.from(merged.values());
}
async function readSnapshotContent(filePath) {
  try {
    const buffer = await fs.promises.readFile(filePath);
    if (buffer.includes(0)) return { existed: true, content: null };
    return { existed: true, content: buffer.toString("utf8") };
  } catch {
    return { existed: false, content: null };
  }
}
function readSnapshotContentSync(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.includes(0)) return { existed: true, content: null };
    return { existed: true, content: buffer.toString("utf8") };
  } catch {
    return { existed: false, content: null };
  }
}
function getDisplayPath(filePath, workspaceDir) {
  const resolvedPath = path$1.resolve(filePath);
  const resolvedWorkspace = workspaceDir ? path$1.resolve(workspaceDir) : "";
  if (resolvedWorkspace && (resolvedPath === resolvedWorkspace || resolvedPath.startsWith(`${resolvedWorkspace}${path$1.sep}`))) {
    const rel = path$1.relative(resolvedWorkspace, resolvedPath);
    return rel || resolvedPath.split(path$1.sep).pop() || resolvedPath;
  }
  return resolvedPath;
}
function resolveCodexFilePath(filePath, workspaceDir) {
  if (workspaceDir && !filePath.startsWith("/")) return path$1.resolve(workspaceDir, filePath);
  return path$1.resolve(filePath);
}
function normalizeNoIndexDiffPaths(diff, beforePath, afterPath, displayPath) {
  let normalized = diff;
  if (beforePath) normalized = normalized.split(beforePath).join(`a/${displayPath}`);
  if (afterPath) normalized = normalized.split(afterPath).join(`b/${displayPath}`);
  return normalized.trim();
}
async function buildSnapshotDiff(before, currentPath) {
  const after = await readSnapshotContent(currentPath);
  if (before.content == null || after.existed && after.content == null) {
    return { diff: "", additions: 0, deletions: 0 };
  }
  const tempRoot = await fs.promises.mkdtemp(path$1.join(os.tmpdir(), "codesurf-codex-diff-"));
  const beforeTempPath = before.existed ? path$1.join(tempRoot, "before", before.displayPath) : null;
  const afterTempPath = after.existed ? path$1.join(tempRoot, "after", before.displayPath) : null;
  try {
    if (beforeTempPath) {
      await fs.promises.mkdir(path$1.dirname(beforeTempPath), { recursive: true });
      await fs.promises.writeFile(beforeTempPath, before.content ?? "", "utf8");
    }
    if (afterTempPath) {
      await fs.promises.mkdir(path$1.dirname(afterTempPath), { recursive: true });
      await fs.promises.writeFile(afterTempPath, after.content ?? "", "utf8");
    }
    const args = ["diff", "--no-index", "--no-ext-diff", "--unified=3", "--"];
    args.push(beforeTempPath ?? "/dev/null", afterTempPath ?? "/dev/null");
    let diff = "";
    try {
      const result = await execFileAsync$1("git", args, { maxBuffer: 1024 * 1024 * 4 });
      diff = result.stdout || result.stderr || "";
    } catch (error) {
      if (error?.code === 1) {
        diff = error.stdout || error.stderr || "";
      } else {
        throw error;
      }
    }
    const normalizedDiff = normalizeNoIndexDiffPaths(diff, beforeTempPath, afterTempPath, before.displayPath);
    const { additions, deletions } = countDiffStats(normalizedDiff);
    return { diff: normalizedDiff, additions, deletions };
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {
    });
  }
}
async function summarizeCodexFileChanges(changes, snapshots, workspaceDir) {
  const fileChanges = [];
  for (const change of changes) {
    if (typeof change?.path !== "string") continue;
    const resolvedPath = resolveCodexFilePath(change.path, workspaceDir);
    const snapshot = snapshots.get(resolvedPath) ?? {
      displayPath: getDisplayPath(resolvedPath, workspaceDir),
      changeType: changeTypeFromCodexKind(change.kind),
      existed: false,
      content: null
    };
    const diffSummary = await buildSnapshotDiff(snapshot, resolvedPath).catch(() => ({
      diff: "",
      additions: 0,
      deletions: 0
    }));
    fileChanges.push({
      path: snapshot.displayPath,
      changeType: snapshot.changeType,
      additions: diffSummary.additions,
      deletions: diffSummary.deletions,
      diff: diffSummary.diff
    });
    snapshots.delete(resolvedPath);
  }
  return mergeFileChanges(fileChanges);
}
function chatCodex(req) {
  const lastUserMsg = [...getPreparedMessages(req)].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    sendStream(req.cardId, { type: "error", error: "No user message" });
    return;
  }
  const codexBin = getAgentPath("codex") || "codex";
  const shellPath = getShellEnvPath();
  const peerPrompt = buildPeerSystemPrompt(req.peers);
  const runtimeMessages = cloneChatMessages(req.messages);
  const runtimeSession = {
    provider: req.provider,
    model: req.model,
    sessionId: req.sessionId ?? sessionIds.get(req.cardId) ?? null,
    jobId: req.jobId ?? null,
    jobSequence: typeof req.jobSequence === "number" ? req.jobSequence : 0,
    executionTarget: req.executionTarget === "cloud" ? "cloud" : "local",
    cloudHostId: req.cloudHostId ?? null,
    isStreaming: true,
    messages: runtimeMessages
  };
  void upsertRuntimeSessionState(req, runtimeSession);
  const args = [
    "exec",
    "--json",
    "--model",
    req.model
  ];
  const codexMode = req.mode === "default" || req.mode === "auto" || req.mode === "read-only" || req.mode === "full-access" ? req.mode : "default";
  if (codexMode === "full-access") {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  } else if (codexMode === "auto") {
    args.push("--full-auto");
  } else {
    if (codexMode === "default") {
      args.push("--sandbox", "workspace-write");
    } else {
      args.push("--sandbox", "read-only");
    }
  }
  args.push(
    // App-launched Codex runs should not inherit user-global MCP servers.
    // A stale localhost entry there can abort the whole run before the model
    // does useful work. Workspace-level `.mcp.json` remains available.
    "-c",
    "mcp_servers={}"
  );
  if (req.workspaceDir) {
    args.push("--skip-git-repo-check", "-C", req.workspaceDir);
  } else {
    args.push("--skip-git-repo-check");
  }
  args.push(buildCodexPrompt(lastUserMsg.content, req.asyncExecution, peerPrompt, req.memoryPrompt, req.skillsPrompt));
  if (req.workspaceDir) {
    void writeMCPConfigToWorkspace(req.workspaceDir).catch(() => {
    });
  }
  const spawnEnv = { ...process.env, ...shellPath && { PATH: shellPath } };
  spawnEnv.CONTEX_MCP_CONFIG = path$1.join(CONTEX_HOME, "mcp-server.json");
  const proc = child_process.spawn(codexBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: spawnEnv
  });
  activeProcesses.set(req.cardId, proc);
  const pendingSnapshots = /* @__PURE__ */ new Map();
  const aggregatedFileChanges = /* @__PURE__ */ new Map();
  const exploreEntries = [];
  let assistantText = "";
  let editsStarted = false;
  let exploreStarted = false;
  let pendingStdout = "";
  let stdoutChain = Promise.resolve();
  const handleCodexJsonEvent = async (evt) => {
    if (!evt || typeof evt !== "object") return;
    if (evt.type === "thread.started" && typeof evt.thread_id === "string") {
      sessionIds.set(req.cardId, evt.thread_id);
      persistSessionIds();
      runtimeSession.sessionId = evt.thread_id;
      void upsertRuntimeSessionState(req, runtimeSession);
      sendStream(req.cardId, { type: "session", sessionId: evt.thread_id });
      return;
    }
    if (evt.type === "item.started") {
      const item2 = evt.item;
      if (item2?.type === "file_change" && Array.isArray(item2.changes)) {
        const checkpointPaths = [];
        for (const change of item2.changes) {
          if (typeof change?.path !== "string") continue;
          const resolvedPath = resolveCodexFilePath(change.path, req.workspaceDir);
          checkpointPaths.push(resolvedPath);
          const snapshot = readSnapshotContentSync(resolvedPath);
          pendingSnapshots.set(resolvedPath, {
            displayPath: getDisplayPath(resolvedPath, req.workspaceDir),
            changeType: changeTypeFromCodexKind(change.kind),
            existed: snapshot.existed,
            content: snapshot.content
          });
        }
        const checkpoint = await createRuntimeCheckpoint(req, "CodexFileChange", checkpointPaths, {
          changeKinds: item2.changes.map((change) => String(change?.kind ?? "update"))
        });
        if (!checkpoint.ok) {
          proc.kill("SIGTERM");
          sendStream(req.cardId, { type: "error", error: `Checkpoint creation failed before Codex file changes: ${checkpoint.error ?? "unknown error"}` });
          return;
        }
      }
      return;
    }
    if (evt.type !== "item.completed") return;
    const item = evt.item;
    if (!item || typeof item !== "object") return;
    if (item.type === "agent_message" && typeof item.text === "string" && item.text) {
      assistantText += item.text;
      sendStream(req.cardId, { type: "text", text: item.text });
      return;
    }
    if (item.type === "command_execution" && typeof item.command === "string") {
      const command = normalizeCodexShellCommand(item.command);
      const kind = classifyCodexCommand(command);
      if (kind === "search" || kind === "read") {
        if (!exploreStarted) {
          sendStream(req.cardId, { type: "tool_start", toolId: "codex-explore", toolName: "Exploring workspace" });
          exploreStarted = true;
        }
        exploreEntries.push({
          label: command,
          command,
          output: sanitizeToolOutputText(typeof item.aggregated_output === "string" ? item.aggregated_output : ""),
          kind
        });
        sendStream(req.cardId, {
          type: "tool_summary",
          toolId: "codex-explore",
          toolName: buildExploreToolName(exploreEntries),
          commandEntries: [...exploreEntries]
        });
      }
      return;
    }
    if (item.type === "file_change" && Array.isArray(item.changes)) {
      const fileChanges = await summarizeCodexFileChanges(item.changes, pendingSnapshots, req.workspaceDir);
      if (fileChanges.length === 0) return;
      for (const change of fileChanges) {
        const key = `${change.path}::${change.previousPath ?? ""}::${change.changeType}`;
        aggregatedFileChanges.set(key, change);
      }
      const mergedFileChanges = Array.from(aggregatedFileChanges.values());
      if (!editsStarted) {
        sendStream(req.cardId, { type: "tool_start", toolId: "codex-file-changes", toolName: buildEditedToolName(mergedFileChanges) });
        editsStarted = true;
      }
      sendStream(req.cardId, {
        type: "tool_summary",
        toolId: "codex-file-changes",
        toolName: buildEditedToolName(mergedFileChanges),
        fileChanges: mergedFileChanges
      });
    }
  };
  proc.stdout?.on("data", (chunk) => {
    pendingStdout += chunk.toString();
    const lines = pendingStdout.split(/\r?\n/);
    pendingStdout = lines.pop() ?? "";
    stdoutChain = stdoutChain.then(async () => {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const evt = JSON.parse(trimmed);
          await handleCodexJsonEvent(evt);
        } catch {
          sendStream(req.cardId, { type: "text", text: `${line}
` });
        }
      }
    }).catch(() => {
    });
  });
  let stderrBuf = "";
  proc.stderr?.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });
  proc.on("close", (code) => {
    activeProcesses.delete(req.cardId);
    stdoutChain = stdoutChain.then(async () => {
      if (pendingStdout.trim()) {
        try {
          await handleCodexJsonEvent(JSON.parse(pendingStdout.trim()));
        } catch {
          assistantText += pendingStdout;
          sendStream(req.cardId, { type: "text", text: pendingStdout });
        }
      }
      if (assistantText.trim()) {
        runtimeSession.messages = [
          ...runtimeMessages,
          { role: "assistant", content: assistantText }
        ];
      }
      runtimeSession.sessionId = sessionIds.get(req.cardId) ?? runtimeSession.sessionId;
      runtimeSession.isStreaming = false;
      void upsertRuntimeSessionState(req, runtimeSession);
      if (code !== 0 && stderrBuf.trim()) {
        sendStream(req.cardId, { type: "error", error: stderrBuf.trim() });
      }
      sendStream(req.cardId, { type: "done", sessionId: runtimeSession.sessionId ?? void 0 });
    }).catch(() => {
      if (assistantText.trim()) {
        runtimeSession.messages = [
          ...runtimeMessages,
          { role: "assistant", content: assistantText }
        ];
      }
      runtimeSession.sessionId = sessionIds.get(req.cardId) ?? runtimeSession.sessionId;
      runtimeSession.isStreaming = false;
      void upsertRuntimeSessionState(req, runtimeSession);
      if (code !== 0 && stderrBuf.trim()) {
        sendStream(req.cardId, { type: "error", error: stderrBuf.trim() });
      }
      sendStream(req.cardId, { type: "done", sessionId: runtimeSession.sessionId ?? void 0 });
    });
  });
  proc.on("error", (err) => {
    activeProcesses.delete(req.cardId);
    runtimeSession.isStreaming = false;
    void upsertRuntimeSessionState(req, runtimeSession);
    sendStream(req.cardId, { type: "error", error: err.message.includes("ENOENT") ? "Codex CLI not found. Install: npm install -g @openai/codex" : err.message });
  });
}
const opencodeSessionIds = /* @__PURE__ */ new Map();
let _cachedOpencodeClient = null;
let _cachedClientUrl = null;
async function getOrCreateOpencodeClient() {
  const mgr = OpenCodeServerManager.getInstance();
  const { url: url2 } = await mgr.ensureRunning();
  if (_cachedOpencodeClient && _cachedClientUrl === url2) {
    return { client: _cachedOpencodeClient, url: url2 };
  }
  const createClient = await getOpencodeClient();
  _cachedOpencodeClient = createClient({ baseUrl: url2 });
  _cachedClientUrl = url2;
  return { client: _cachedOpencodeClient, url: url2 };
}
function chatOpencode(req) {
  const lastUserMsg = [...getPreparedMessages(req)].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    sendStream(req.cardId, { type: "error", error: "No user message" });
    return;
  }
  const slashIdx = req.model.indexOf("/");
  const providerID = slashIdx > 0 ? req.model.slice(0, slashIdx) : "anthropic";
  const modelID = slashIdx > 0 ? req.model.slice(slashIdx + 1) : req.model;
  if (req.sessionId && !opencodeSessionIds.has(req.cardId)) {
    opencodeSessionIds.set(req.cardId, req.sessionId);
  }
  const existingSessionId = opencodeSessionIds.get(req.cardId);
  log("chatOpencode starting", {
    model: req.model,
    providerID,
    modelID,
    prompt: lastUserMsg.content.slice(0, 100),
    resuming: !!existingSessionId
  });
  (async () => {
    try {
      const { client } = await getOrCreateOpencodeClient();
      let sessionID = existingSessionId;
      if (!sessionID) {
        const permission = buildOpenCodeSessionPermissions(req.mode);
        const sessionRes = await client.session.create({
          title: `Chat ${req.cardId.slice(0, 8)}`,
          permission,
          ...req.workspaceDir && { directory: req.workspaceDir }
        });
        const sessionData = sessionRes.data ?? sessionRes;
        sessionID = sessionData?.info?.id ?? sessionData?.id;
        if (!sessionID) {
          throw new Error("Failed to create OpenCode session — no session ID returned");
        }
        opencodeSessionIds.set(req.cardId, sessionID);
        log("opencode session created:", sessionID, req.mode === "plan" ? "(plan mode)" : req.mode === "bypassPermissions" ? "(bypass mode)" : "(default ask mode)");
      }
      const sseResult = await client.event.subscribe();
      const stream = sseResult.stream;
      let assistantMessageId = null;
      let isDone = false;
      const seenParts = /* @__PURE__ */ new Map();
      const assistantPartIds = /* @__PURE__ */ new Set();
      const userMessageIds = /* @__PURE__ */ new Set();
      const isFirstTurn = !existingSessionId;
      const promptText = isFirstTurn ? `${buildCodeSurfOutputConvention()}

---

${lastUserMsg.content}` : lastUserMsg.content;
      const promptPromise = client.session.prompt({
        sessionID,
        model: { providerID, modelID },
        parts: [{ type: "text", text: promptText }]
      }).catch((err) => {
        if (!isDone) {
          log("opencode prompt error:", err.message);
          sendStream(req.cardId, { type: "error", error: err.message ?? String(err) });
        }
      });
      const streamTimeout = setTimeout(() => {
        if (!isDone) {
          log("opencode SSE stream timeout (5min)");
          isDone = true;
          sendStream(req.cardId, { type: "done" });
        }
      }, 5 * 6e4);
      try {
        for await (const event of stream) {
          if (isDone) break;
          const evt = event;
          const evtType = evt?.type ?? "";
          if (evtType.startsWith("file.watcher")) continue;
          if (evtType !== "message.part.delta") {
            log("opencode SSE event:", evtType, JSON.stringify(evt?.properties ?? {}).slice(0, 300));
          }
          const props = evt?.properties ?? {};
          const evtSessionID = props.sessionID ?? props.info?.sessionID ?? "";
          if (evtSessionID && evtSessionID !== sessionID) continue;
          switch (evtType) {
            case "message.updated": {
              const info = props.info;
              if (info?.role === "user") {
                userMessageIds.add(info.id);
              } else if (info?.role === "assistant") {
                assistantMessageId = info.id;
                if (info.finish) {
                  sendStream(req.cardId, {
                    type: "done",
                    cost: info.cost,
                    tokens: info.tokens,
                    sessionId: sessionID
                  });
                  isDone = true;
                }
              }
              break;
            }
            case "message.part.updated": {
              const part = props.part;
              if (!part) break;
              if (userMessageIds.has(part.messageID)) break;
              if (assistantMessageId && part.messageID !== assistantMessageId) break;
              assistantPartIds.add(part.id);
              if (part.type === "text") {
                const prev = seenParts.get(part.id) ?? "";
                if (part.text && part.text.length > prev.length) {
                  const newText = part.text.slice(prev.length);
                  seenParts.set(part.id, part.text);
                  sendStream(req.cardId, { type: "text", text: newText });
                }
              } else if (part.type === "tool") {
                const toolId = part.callID ?? part.id;
                const toolName = part.tool ?? "tool";
                const state = part.state;
                const seenKey = `tool:${part.id}`;
                const prevStatus = seenParts.get(seenKey);
                if (!prevStatus) {
                  sendStream(req.cardId, { type: "tool_start", toolId, toolName });
                  if (state?.input) {
                    const inputStr = typeof state.input === "string" ? state.input : JSON.stringify(state.input, null, 2);
                    sendStream(req.cardId, { type: "tool_input", text: inputStr });
                  }
                }
                if (state?.status === "running" && prevStatus !== "running") {
                  if (state.title) {
                    sendStream(req.cardId, { type: "tool_use", toolName, toolInput: state.title });
                  }
                } else if (state?.status === "completed") {
                  const summary = state.title ? `${state.title}${state.output ? "\n" + state.output.slice(0, 500) : ""}` : state.output?.slice(0, 500) ?? "Done";
                  sendStream(req.cardId, { type: "tool_summary", text: summary, toolName });
                } else if (state?.status === "error") {
                  sendStream(req.cardId, { type: "tool_summary", text: `Error: ${state.error}`, toolName });
                }
                seenParts.set(seenKey, state?.status ?? "unknown");
              } else if (part.type === "reasoning") {
                const prev = seenParts.get(part.id) ?? "";
                if (part.text && part.text.length > prev.length) {
                  const newText = part.text.slice(prev.length);
                  seenParts.set(part.id, part.text);
                  sendStream(req.cardId, { type: "reasoning", text: newText });
                }
              } else if (part.type === "step-finish") {
                sendStream(req.cardId, {
                  type: "step_finish",
                  cost: part.cost,
                  tokens: part.tokens,
                  reason: part.reason
                });
              }
              break;
            }
            case "message.part.delta": {
              const { partID, field, delta, messageID } = props;
              if (messageID && userMessageIds.has(messageID)) break;
              if (partID && !assistantPartIds.has(partID)) {
                if (messageID && assistantMessageId && messageID !== assistantMessageId) break;
              }
              if (field === "text" && delta) {
                const prev = seenParts.get(partID) ?? "";
                seenParts.set(partID, prev + delta);
                sendStream(req.cardId, { type: "text", text: delta });
              }
              break;
            }
            case "session.status": {
              if (props.status?.type === "idle" && assistantMessageId) {
                if (!isDone) {
                  isDone = true;
                  sendStream(req.cardId, { type: "done", sessionId: sessionID });
                }
              }
              break;
            }
            case "session.error": {
              isDone = true;
              sendStream(req.cardId, {
                type: "error",
                error: props.error ?? "OpenCode session error"
              });
              break;
            }
            case "permission.asked": {
              const permReq = props;
              log("opencode permission asked:", permReq.permission, "id:", permReq.id);
              try {
                const toolUseID = typeof permReq.id === "string" && permReq.id.trim() ? permReq.id : `opencode-permission-${Date.now()}`;
                const permissionRequest = {
                  provider: "opencode",
                  toolName: typeof permReq.permission === "string" ? permReq.permission : "tool",
                  // Prefer a structured summary if OpenCode supplies one —
                  title: typeof permReq.title === "string" ? permReq.title : null,
                  description: typeof permReq.description === "string" ? permReq.description : typeof permReq.command === "string" ? permReq.command : null,
                  blockedPath: typeof permReq.path === "string" ? permReq.path : null,
                  workspaceDir: req.workspaceDir
                };
                const storedDecision = resolveStoredPermission(permissionRequest);
                let decision;
                let fromStored = false;
                if (storedDecision === "allow") {
                  decision = "once";
                  fromStored = true;
                } else if (storedDecision === "deny") {
                  decision = "never";
                  fromStored = true;
                } else {
                  sendStream(req.cardId, {
                    type: "tool_permission_request",
                    toolId: toolUseID,
                    provider: "opencode",
                    toolName: permissionRequest.toolName,
                    title: permissionRequest.title,
                    description: permissionRequest.description,
                    blockedPath: permissionRequest.blockedPath,
                    workspaceDir: permissionRequest.workspaceDir
                  });
                  decision = await awaitToolPermissionAnswer(req.cardId, toolUseID, permissionRequest);
                }
                sendStream(req.cardId, {
                  type: "tool_permission_resolved",
                  toolId: toolUseID,
                  toolName: permissionRequest.toolName,
                  decision
                });
                if (!fromStored) {
                  if (decision === "never") {
                    persistGrant(permissionRequest, "never");
                  } else if (decision === "session") {
                    storeSessionGrant(permissionRequest);
                  } else if (decision === "today" || decision === "forever") {
                    persistGrant(permissionRequest, decision);
                  }
                }
                const allowed = decision !== "deny" && decision !== "never";
                const reply = allowed ? decision === "forever" ? "always" : "once" : "reject";
                await client.permission.reply({
                  requestID: toolUseID,
                  reply,
                  ...allowed ? {} : { message: decision === "never" ? "Tool permission permanently denied. Future calls will be auto-rejected." : "Tool permission denied by the user." }
                });
                log("opencode permission decision:", permReq.id, reply, decision ? `(scope=${decision})` : "");
              } catch (permErr) {
                log("opencode permission reply error:", permErr.message);
              }
              break;
            }
            case "question.asked": {
              const qReq = props;
              log("opencode question asked:", qReq.id, JSON.stringify(qReq.questions ?? []).slice(0, 200));
              try {
                const answers = (qReq.questions ?? []).map((q) => {
                  if (q.options?.length > 0) return [q.options[0].value ?? q.options[0].label ?? "yes"];
                  return ["yes"];
                });
                await client.question.reply({
                  requestID: qReq.id,
                  answers
                });
                log("opencode question auto-answered:", qReq.id);
              } catch (qErr) {
                log("opencode question reply error:", qErr.message);
              }
              break;
            }
          }
        }
      } finally {
        clearTimeout(streamTimeout);
      }
      await promptPromise;
      if (!isDone) {
        sendStream(req.cardId, { type: "done", sessionId: sessionID });
      }
    } catch (err) {
      log("chatOpencode error:", err.message ?? String(err));
      const errorMsg = err.message?.includes("opencode CLI not found") ? "OpenCode CLI not found. Install: go install github.com/opencodeco/opencode@latest" : err.message?.includes("ESM/CJS") ? "OpenCode SDK could not be loaded. Check @opencode-ai/sdk compatibility." : err.message ?? String(err);
      sendStream(req.cardId, { type: "error", error: errorMsg });
      sendStream(req.cardId, { type: "done" });
    }
  })();
}
const openclawSessionIds = /* @__PURE__ */ new Map();
function resolveOpenClawBinary() {
  const detected = getAgentPath("openclaw");
  if (detected) return detected;
  try {
    const shellPath = getShellEnvPath();
    return child_process.execFileSync("which", ["openclaw"], {
      encoding: "utf-8",
      env: { ...process.env, ...shellPath && { PATH: shellPath } }
    }).trim() || null;
  } catch {
    return null;
  }
}
function normalizeModelRef(model) {
  return (model ?? "").trim().toLowerCase();
}
function parseOpenClawAgents(openclawBin, shellPath) {
  try {
    const raw = child_process.execFileSync(openclawBin, ["agents", "list", "--json"], {
      encoding: "utf-8",
      env: { ...process.env, ...shellPath && { PATH: shellPath } }
    }).trim();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function selectOpenClawAgentId(openclawBin, shellPath, preferredModel) {
  const agents = parseOpenClawAgents(openclawBin, shellPath);
  if (agents.length === 0) return "main";
  const requested = normalizeModelRef(preferredModel);
  const isStable = (id) => !id.startsWith("mc-gateway-") && !/^lead-[0-9a-f-]+$/i.test(id);
  if (requested) {
    const directStable = agents.find((agent) => isStable(agent.id) && normalizeModelRef(agent.id) === requested);
    if (directStable) return directStable.id;
    const directAny = agents.find((agent) => normalizeModelRef(agent.id) === requested);
    if (directAny) return directAny.id;
    const exactStable = agents.find((agent) => isStable(agent.id) && normalizeModelRef(agent.model) === requested);
    if (exactStable) return exactStable.id;
    const exactAny = agents.find((agent) => normalizeModelRef(agent.model) === requested);
    if (exactAny) return exactAny.id;
    return null;
  }
  return agents.find((agent) => agent.isDefault)?.id ?? agents[0]?.id ?? "main";
}
function extractOpenClawTextPayload(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.content === "string") return payload.content;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.summary === "string") return payload.summary;
  if (Array.isArray(payload.parts)) {
    return payload.parts.map((part) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("");
  }
  return "";
}
function chatOpenclaw(req) {
  const lastUserMsg = [...getPreparedMessages(req)].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    sendStream(req.cardId, { type: "error", error: "No user message" });
    return;
  }
  const openclawBin = resolveOpenClawBinary();
  if (!openclawBin) {
    sendStream(req.cardId, { type: "error", error: "OpenClaw CLI not found. Install: npm install -g openclaw" });
    return;
  }
  const shellPath = getShellEnvPath();
  if (req.sessionId && !openclawSessionIds.has(req.cardId)) {
    openclawSessionIds.set(req.cardId, req.sessionId);
  }
  const existingSessionId = openclawSessionIds.get(req.cardId);
  const selectedAgentId = existingSessionId ? null : selectOpenClawAgentId(openclawBin, shellPath, req.model);
  if (!existingSessionId && req.model && !selectedAgentId) {
    const agents = parseOpenClawAgents(openclawBin, shellPath);
    const available = agents.map((agent) => agent.model || agent.id).filter((value, index, all) => typeof value === "string" && value.trim().length > 0 && all.indexOf(value) === index);
    const details = available.length > 0 ? ` Available: ${available.join(", ")}` : "";
    sendStream(req.cardId, { type: "error", error: `OpenClaw model must match exactly: ${req.model}.${details}` });
    sendStream(req.cardId, { type: "done" });
    return;
  }
  log("chatOpenclaw starting", {
    model: req.model,
    prompt: lastUserMsg.content.slice(0, 100),
    resuming: !!existingSessionId,
    agentId: selectedAgentId
  });
  const args = ["agent", "--json"];
  if (existingSessionId) {
    args.push("--session-id", existingSessionId);
  } else {
    args.push("--agent", selectedAgentId ?? "main");
  }
  const thinkingMap = {
    none: "off",
    low: "minimal",
    medium: "medium",
    high: "high",
    max: "xhigh",
    adaptive: "medium"
  };
  const thinking = thinkingMap[req.thinking ?? ""];
  if (thinking) {
    args.push("--thinking", thinking);
  }
  const openClawIsFirstTurn = !existingSessionId;
  const openClawMessage = openClawIsFirstTurn ? `${buildCodeSurfOutputConvention()}

---

${lastUserMsg.content}` : lastUserMsg.content;
  args.push("--message", openClawMessage);
  const proc = child_process.spawn(openclawBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...shellPath && { PATH: shellPath } },
    ...req.workspaceDir && { cwd: req.workspaceDir }
  });
  activeProcesses.set(req.cardId, proc);
  let stdoutBuf = "";
  proc.stdout?.on("data", (chunk) => {
    stdoutBuf += chunk.toString();
  });
  let stderrBuf = "";
  proc.stderr?.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });
  proc.on("close", (code) => {
    activeProcesses.delete(req.cardId);
    if (code !== 0) {
      sendStream(req.cardId, { type: "error", error: stderrBuf.trim() || stdoutBuf.trim() || `OpenClaw exited with ${code}` });
      sendStream(req.cardId, { type: "done" });
      return;
    }
    let sessionId;
    let resultText = stdoutBuf.trim();
    try {
      const parsed = JSON.parse(stdoutBuf);
      const meta = parsed?.meta ?? parsed?.result?.meta;
      const payloads = Array.isArray(parsed?.payloads) ? parsed.payloads : Array.isArray(parsed?.result?.payloads) ? parsed.result.payloads : [];
      sessionId = meta?.sessionId ?? meta?.session_id ?? parsed?.sessionId ?? parsed?.session_id;
      resultText = payloads.map((payload) => extractOpenClawTextPayload(payload)).filter(Boolean).join("\n\n") || parsed?.summary || parsed?.result?.summary || resultText;
    } catch {
    }
    if (sessionId) {
      openclawSessionIds.set(req.cardId, sessionId);
      sendStream(req.cardId, { type: "session", sessionId });
    }
    if (resultText) {
      sendStream(req.cardId, { type: "text", text: resultText });
    }
    sendStream(req.cardId, { type: "done", sessionId });
  });
  proc.on("error", (err) => {
    activeProcesses.delete(req.cardId);
    sendStream(req.cardId, {
      type: "error",
      error: err.message.includes("ENOENT") ? "OpenClaw CLI not found. Install: npm install -g openclaw" : err.message
    });
  });
}
const hermesSessionIds = /* @__PURE__ */ new Map();
function resolveHermesBinary() {
  const detected = getAgentPath("hermes");
  if (detected) return detected;
  try {
    const shellPath = getShellEnvPath();
    return child_process.execFileSync("which", ["hermes"], {
      encoding: "utf-8",
      env: { ...process.env, ...shellPath && { PATH: shellPath } }
    }).trim() || null;
  } catch {
    return null;
  }
}
function chatHermes(req) {
  const lastUserMsg = [...getPreparedMessages(req)].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    sendStream(req.cardId, { type: "error", error: "No user message" });
    return;
  }
  const hermesBin = resolveHermesBinary();
  if (!hermesBin) {
    sendStream(req.cardId, { type: "error", error: "Hermes CLI not found. Install: pip install hermes-agent" });
    return;
  }
  const shellPath = getShellEnvPath();
  if (req.sessionId && !hermesSessionIds.has(req.cardId)) {
    hermesSessionIds.set(req.cardId, req.sessionId);
  }
  const existingSessionId = hermesSessionIds.get(req.cardId);
  log("chatHermes starting", {
    model: req.model,
    prompt: lastUserMsg.content.slice(0, 100),
    resuming: !!existingSessionId
  });
  const modeMap = {
    "full": "terminal,file,web,browser",
    "terminal": "terminal,file",
    "web": "web,browser",
    "query": ""
  };
  const toolsets = modeMap[req.mode ?? ""] ?? "terminal,file,web";
  const hermesIsFirstTurn = !existingSessionId;
  const hermesPrompt = hermesIsFirstTurn ? `${buildCodeSurfOutputConvention()}

---

${lastUserMsg.content}` : lastUserMsg.content;
  const args = buildHermesChatArgs({
    prompt: hermesPrompt,
    model: req.model,
    resumeSessionId: existingSessionId,
    toolsets,
    streamJson: true
  });
  const proc = child_process.spawn(hermesBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...shellPath && { PATH: shellPath } },
    ...req.workspaceDir && { cwd: req.workspaceDir }
  });
  activeProcesses.set(req.cardId, proc);
  let stdoutBuf = "";
  const dispatchHermesEvents = (chunk, flushPartial = false) => {
    stdoutBuf += chunk;
    const lines = stdoutBuf.split(/\r?\n/);
    stdoutBuf = flushPartial ? "" : lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const sessionLineMatch = trimmed.match(/^(?:session_id|session)\s*:\s*(\S+)$/i);
      if (sessionLineMatch?.[1]) {
        const sid = sessionLineMatch[1];
        hermesSessionIds.set(req.cardId, sid);
        sendStream(req.cardId, { type: "session", sessionId: sid });
        continue;
      }
      let evt;
      try {
        evt = JSON.parse(trimmed);
      } catch {
        sendStream(req.cardId, { type: "text", text: line + "\n" });
        continue;
      }
      if (!evt || typeof evt !== "object" || typeof evt.type !== "string") {
        continue;
      }
      switch (evt.type) {
        case "session":
          if (typeof evt.sessionId === "string" && evt.sessionId.trim()) {
            const sid = evt.sessionId.trim();
            hermesSessionIds.set(req.cardId, sid);
            sendStream(req.cardId, { type: "session", sessionId: sid });
          }
          break;
        case "text":
          if (typeof evt.text === "string") {
            sendStream(req.cardId, { type: "text", text: evt.text });
          }
          break;
        case "thinking":
          if (typeof evt.text === "string") {
            sendStream(req.cardId, { type: "thinking", text: evt.text });
          }
          break;
        case "tool_start":
          sendStream(req.cardId, {
            type: "tool_start",
            toolId: typeof evt.toolId === "string" ? evt.toolId : void 0,
            toolName: typeof evt.toolName === "string" ? evt.toolName : "tool"
          });
          break;
        case "tool_input":
          sendStream(req.cardId, {
            type: "tool_input",
            toolId: typeof evt.toolId === "string" ? evt.toolId : void 0,
            text: typeof evt.text === "string" ? evt.text : ""
          });
          break;
        case "tool_summary":
          sendStream(req.cardId, {
            type: "tool_summary",
            toolId: typeof evt.toolId === "string" ? evt.toolId : void 0,
            toolName: typeof evt.toolName === "string" ? evt.toolName : void 0,
            text: typeof evt.text === "string" ? evt.text : ""
          });
          break;
        case "error":
          sendStream(req.cardId, {
            type: "error",
            error: typeof evt.error === "string" ? evt.error : "Unknown Hermes error"
          });
          break;
        case "done":
          break;
        default:
          sendStream(req.cardId, evt);
      }
    }
  };
  proc.stdout?.on("data", (chunk) => {
    dispatchHermesEvents(chunk.toString(), false);
  });
  let stderrBuf = "";
  proc.stderr?.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });
  proc.on("close", (code) => {
    dispatchHermesEvents("", true);
    activeProcesses.delete(req.cardId);
    if (code !== 0 && stderrBuf.trim()) {
      sendStream(req.cardId, { type: "error", error: sanitizeAgentCliDiagnostic(stderrBuf.trim()) });
    }
    sendStream(req.cardId, { type: "done" });
  });
  proc.on("error", (err) => {
    activeProcesses.delete(req.cardId);
    sendStream(req.cardId, {
      type: "error",
      error: err.message.includes("ENOENT") ? "Hermes CLI not found. Install: pip install hermes-agent" : err.message
    });
  });
}
function registerChatIPC() {
  log("registerChatIPC: handlers registered");
  electron.ipcMain.handle("chat:send", async (_, req) => {
    log("chat:send received", { provider: req.provider, model: req.model, msgCount: req.messages.length });
    const requestedRunMode = req.runMode === "background" ? "background" : "foreground";
    if (requestedRunMode === "foreground") {
      const existingQuery = activeQueries.get(req.cardId);
      if (existingQuery) {
        intentionallyClosedQueries.add(existingQuery);
        existingQuery.close();
        activeQueries.delete(req.cardId);
      }
      const existingProc = activeProcesses.get(req.cardId);
      if (existingProc) {
        existingProc.kill("SIGTERM");
        activeProcesses.delete(req.cardId);
      }
      const existingHttpRequest = activeHttpRequests.get(req.cardId);
      if (existingHttpRequest) {
        existingHttpRequest.destroy();
        activeHttpRequests.delete(req.cardId);
      }
      await cancelChatDaemonJob(req.cardId);
    }
    let daemonHost = null;
    let localDaemonAvailable = false;
    try {
      localDaemonAvailable = (await getExecutionRoutingState()).localDaemonAvailable;
      daemonHost = await selectChatExecutionHost(req);
    } catch (error) {
      sendStream(req.cardId, {
        type: "error",
        error: error instanceof Error ? error.message : String(error)
      });
      sendStream(req.cardId, { type: "done" });
      return { ok: false };
    }
    const effectiveRequest = {
      ...req,
      runMode: requestedRunMode,
      asyncExecution: buildAsyncExecutionContext({
        request: { ...req, runMode: requestedRunMode },
        daemonHost,
        localDaemonAvailable
      })
    };
    let memoryPrompt;
    let memoryContext = null;
    try {
      memoryContext = await loadRuntimeMemoryContext(effectiveRequest);
      memoryPrompt = String(memoryContext?.prompt ?? "").trim() || void 0;
    } catch (error) {
      sendStream(req.cardId, {
        type: "error",
        error: error instanceof Error ? error.message : String(error)
      });
      sendStream(req.cardId, { type: "done" });
      return { ok: false };
    }
    let skillsPrompt;
    let skillsSummary = null;
    let skillsContext = null;
    try {
      skillsContext = await loadRuntimeSkillsContext(effectiveRequest);
      skillsPrompt = buildSelectedSkillsPrompt(skillsContext);
      skillsSummary = summarizeSelectedSkills(skillsContext) ?? null;
    } catch (error) {
      sendStream(req.cardId, {
        type: "error",
        error: error instanceof Error ? error.message : String(error)
      });
      sendStream(req.cardId, { type: "done" });
      return { ok: false };
    }
    const requestWithContext = {
      ...effectiveRequest,
      ...memoryPrompt ? { memoryPrompt } : {},
      ...memoryContext?.contextBuckets ? { contextBuckets: memoryContext.contextBuckets } : {},
      ...skillsPrompt ? { skillsPrompt, skillsSummary } : {}
    };
    let requestWithFileReferences = requestWithContext;
    let fileReferenceExpansion = null;
    try {
      const expanded = await expandLatestUserFileReferences(requestWithContext);
      requestWithFileReferences = expanded.request;
      fileReferenceExpansion = expanded.expansion;
    } catch (error) {
      sendStream(req.cardId, {
        type: "error",
        error: error instanceof Error ? error.message : String(error)
      });
      sendStream(req.cardId, { type: "done" });
      return { ok: false };
    }
    emitFileReferenceExpansion(req.cardId, fileReferenceExpansion);
    if (daemonHost) {
      log("chat execution route", {
        cardId: req.cardId,
        provider: req.provider,
        model: req.model,
        runMode: requestedRunMode,
        executionTarget: req.executionTarget ?? "local",
        executionPreference: req.executionPreference ?? null,
        backend: "daemon",
        hostId: daemonHost.id,
        hostType: daemonHost.type
      });
      return await sendChatToDaemon(requestWithFileReferences, daemonHost);
    }
    emitMemoryContextLoaded(req.cardId, memoryContext);
    emitSelectedSkillsLoaded(req.cardId, skillsContext);
    syncPeerLinks(requestWithFileReferences);
    if (requestedRunMode === "background") {
      sendStream(req.cardId, {
        type: "error",
        error: "Detached background chat execution currently requires a daemon-backed Claude or Codex host."
      });
      sendStream(req.cardId, { type: "done" });
      return { ok: false };
    }
    log("chat execution route", {
      cardId: req.cardId,
      provider: req.provider,
      model: req.model,
      runMode: requestedRunMode,
      executionTarget: req.executionTarget ?? "local",
      executionPreference: req.executionPreference ?? null,
      backend: "runtime"
    });
    switch (requestWithFileReferences.provider) {
      case "claude":
        chatClaude(requestWithFileReferences);
        break;
      case "codex":
        chatCodex(requestWithFileReferences);
        break;
      case "opencode":
        chatOpencode(requestWithFileReferences);
        break;
      case "openclaw":
        chatOpenclaw(requestWithFileReferences);
        break;
      case "hermes":
        chatHermes(requestWithFileReferences);
        break;
      default:
        if (requestWithFileReferences.providerTransport?.type === "local-proxy") {
          chatLocalProxy(requestWithFileReferences);
        } else {
          sendStream(requestWithFileReferences.cardId, { type: "error", error: `Unsupported provider: ${requestWithFileReferences.provider}` });
          sendStream(requestWithFileReferences.cardId, { type: "done" });
        }
    }
    return { ok: true };
  });
  electron.ipcMain.handle("chat:resumeJob", async (_, req) => {
    return await resumeChatDaemonJob(req);
  });
  electron.ipcMain.handle("chat:steer", async (_, payload) => {
    const cardId = String(payload?.cardId ?? "").trim();
    const message = String(payload?.message ?? "").trim();
    if (!cardId || !message) return { ok: false, error: "missing cardId or message" };
    const q = activeQueries.get(cardId);
    if (!q) return { ok: false, error: "no active steerable Claude stream" };
    try {
      await q.streamInput(buildClaudeTextInput(message, "now"));
      sendStream(cardId, { type: "steer_sent", text: message });
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log("chat:steer failed:", msg);
      return { ok: false, error: msg };
    }
  });
  electron.ipcMain.handle("chat:stop", async (_, cardId) => {
    const q = activeQueries.get(cardId);
    if (q) {
      intentionallyClosedQueries.add(q);
      q.close();
      activeQueries.delete(cardId);
    }
    const proc = activeProcesses.get(cardId);
    if (proc) {
      proc.kill("SIGTERM");
      activeProcesses.delete(cardId);
    }
    const httpRequest = activeHttpRequests.get(cardId);
    if (httpRequest) {
      httpRequest.destroy();
      activeHttpRequests.delete(cardId);
    }
    await cancelChatDaemonJob(cardId);
    cancelPendingAskUserQuestionsForCard(cardId, "Chat stopped");
    cancelPendingToolPermissionsForCard(cardId, "Chat stopped");
    cardPermissionModes.delete(cardId);
    const ocSessionId = opencodeSessionIds.get(cardId);
    if (ocSessionId) {
      try {
        const mgr = OpenCodeServerManager.getInstance();
        if (mgr.isRunning()) {
          const createClient = await getOpencodeClient();
          const { url: url2 } = await mgr.ensureRunning();
          const client = createClient({ baseUrl: url2 });
          await client.session.abort({ sessionID: ocSessionId });
          log("opencode session aborted:", ocSessionId);
        }
      } catch (err) {
        log("opencode abort error (non-fatal):", err.message);
      }
    }
    sendStream(cardId, { type: "done" });
  });
  electron.ipcMain.handle("chat:clearSession", async (_, cardId) => {
    sessionIds.delete(cardId);
    opencodeSessionIds.delete(cardId);
    openclawSessionIds.delete(cardId);
    hermesSessionIds.delete(cardId);
    cancelPendingAskUserQuestionsForCard(cardId, "Session cleared");
    cancelPendingToolPermissionsForCard(cardId, "Session cleared");
    cardPermissionModes.delete(cardId);
    log("session cleared for card", cardId);
    return { ok: true };
  });
  electron.ipcMain.handle("chat:setPermissionMode", async (_, payload) => {
    if (!payload || typeof payload.cardId !== "string") {
      return { ok: false, error: "invalid payload" };
    }
    const sdkModeMap = {
      default: "default",
      acceptEdits: "acceptEdits",
      plan: "plan",
      bypassPermissions: "bypassPermissions"
    };
    const sdkMode = sdkModeMap[payload.mode ?? ""];
    if (!sdkMode) {
      return { ok: false, error: `unknown mode: ${payload.mode}` };
    }
    const previous = cardPermissionModes.get(payload.cardId) ?? "default";
    cardPermissionModes.set(payload.cardId, sdkMode);
    const activeQuery = activeQueries.get(payload.cardId);
    if (activeQuery) {
      try {
        await activeQuery.setPermissionMode(sdkMode);
      } catch (err) {
        log("setPermissionMode SDK call failed:", err.message);
      }
    }
    if (sdkMode === "bypassPermissions") {
      const prefix = `${payload.cardId}::`;
      for (const [key, pending] of pendingToolPermissions.entries()) {
        if (key.startsWith(prefix)) {
          pendingToolPermissions.delete(key);
          try {
            pending.resolve("once");
          } catch {
          }
          const toolUseID = key.slice(prefix.length) || null;
          sendStream(payload.cardId, {
            type: "tool_permission_resolved",
            toolId: toolUseID,
            decision: "once",
            reason: "mode_change"
          });
        }
      }
    }
    sendStream(payload.cardId, {
      type: "permission_mode_changed",
      mode: sdkMode,
      previous
    });
    return { ok: true };
  });
  electron.ipcMain.handle("chat:answerToolPermission", async (_, payload) => {
    if (!payload || typeof payload.cardId !== "string") {
      return { ok: false, error: "invalid payload" };
    }
    const validDecisions = ["deny", "never", "once", "session", "today", "forever"];
    if (!validDecisions.includes(payload.decision)) {
      return { ok: false, error: "invalid decision" };
    }
    const delivered = resolvePendingToolPermission(payload.cardId, payload.toolId ?? null, payload.decision);
    if (!delivered) {
      const activeDaemon = activeDaemonStreams.get(payload.cardId);
      if (activeDaemon) {
        try {
          return await hostRequest(activeDaemon.host, "/chat/job/permission/answer", {
            body: {
              jobId: activeDaemon.jobId,
              toolId: payload.toolId ?? "",
              decision: payload.decision
            }
          });
        } catch (error) {
          log("chat:answerToolPermission daemon reply failed:", error instanceof Error ? error.message : String(error));
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      }
      log("chat:answerToolPermission: no pending request for", payload.cardId, payload.toolId);
      return { ok: false, error: "no pending request" };
    }
    return { ok: true };
  });
  electron.ipcMain.handle("chat:answerUserQuestion", async (_, payload) => {
    if (!payload || typeof payload.cardId !== "string") {
      return { ok: false, error: "invalid payload" };
    }
    const answers = payload.answers && typeof payload.answers === "object" ? payload.answers : {};
    const annotations = payload.annotations && typeof payload.annotations === "object" ? payload.annotations : void 0;
    const delivered = resolvePendingAskUserQuestion(payload.cardId, payload.toolId ?? null, { answers, annotations });
    if (!delivered) {
      log("chat:answerUserQuestion: no pending question for", payload.cardId, payload.toolId);
      return { ok: false, error: "no pending question" };
    }
    const summaryLines = Object.entries(answers).map(([q, a]) => `• ${q} — ${a}`);
    if (summaryLines.length > 0) {
      sendStream(payload.cardId, {
        type: "tool_summary",
        toolId: payload.toolId,
        toolName: "AskUserQuestion",
        text: summaryLines.join("\n")
      });
    }
    return { ok: true };
  });
  electron.ipcMain.handle("chat:selectFiles", async () => {
    const win = electron.BrowserWindow.getFocusedWindow();
    if (!win) return [];
    const result = await electron.dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      title: "Attach Files"
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });
  electron.ipcMain.handle("chat:openclawAgents", async () => {
    const openclawBin = resolveOpenClawBinary();
    if (!openclawBin) {
      return { agents: [] };
    }
    const shellPath = getShellEnvPath();
    const agents = parseOpenClawAgents(openclawBin, shellPath).map((agent) => ({
      id: agent.id,
      label: agent.name ? `${agent.name}${agent.isDefault ? " (default)" : ""}` : `${agent.id}${agent.isDefault ? " (default)" : ""}`,
      description: agent.model ?? agent.id
    }));
    return { agents };
  });
  electron.ipcMain.handle("chat:writeTempAttachment", async (_, payload) => {
    try {
      if (!payload || typeof payload.data !== "string" || !payload.data) {
        return { ok: false, error: "missing data" };
      }
      const ext = (payload.ext || payload.mime?.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
      const safeHint = (payload.filenameHint || "sketch").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "-").slice(0, 40) || "sketch";
      const dir = path$1.join(CONTEX_HOME, "chat-attachments");
      await fs.promises.mkdir(dir, { recursive: true });
      const filename = `${safeHint}-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}.${ext}`;
      const dest = path$1.join(dir, filename);
      const buf = Buffer.from(payload.data, "base64");
      await fs.promises.writeFile(dest, buf);
      return { ok: true, path: dest };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  electron.ipcMain.handle("chat:loadSessionHistory", async (_, payload) => {
    const workspaceId = String(payload?.workspaceId || "").trim();
    const sessionEntryId = String(payload?.sessionEntryId || "").trim();
    if (!sessionEntryId) return { ok: false, error: "sessionEntryId required", messages: [], total: 0, hasMore: false };
    const rawHint = payload?.entryHint;
    const entryHint = rawHint && typeof rawHint === "object" && typeof rawHint.id === "string" && typeof rawHint.source === "string" ? {
      id: rawHint.id,
      source: rawHint.source,
      filePath: typeof rawHint.filePath === "string" ? rawHint.filePath : void 0,
      sessionId: typeof rawHint.sessionId === "string" || rawHint.sessionId === null ? rawHint.sessionId : null,
      provider: typeof rawHint.provider === "string" ? rawHint.provider : "",
      model: typeof rawHint.model === "string" ? rawHint.model : "",
      messageCount: typeof rawHint.messageCount === "number" ? rawHint.messageCount : 0,
      title: typeof rawHint.title === "string" ? rawHint.title : "",
      projectPath: typeof rawHint.projectPath === "string" || rawHint.projectPath === null ? rawHint.projectPath : null
    } : null;
    const workspacePath = workspaceId ? await getWorkspacePathById(workspaceId).catch(() => null) : null;
    const page = await loadExternalSessionMessagesPage(workspacePath, sessionEntryId, {
      entryHint,
      beforeFingerprint: typeof payload?.beforeFingerprint === "string" ? payload.beforeFingerprint : null,
      limit: typeof payload?.limit === "number" ? payload.limit : void 0
    }).catch((error) => {
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    });
    if (!page || "error" in page) {
      return {
        ok: false,
        error: page && "error" in page ? page.error : "Could not load earlier messages",
        messages: [],
        total: 0,
        hasMore: false
      };
    }
    return {
      ok: true,
      messages: page.messages,
      total: page.total,
      hasMore: page.hasMore,
      provider: page.provider,
      model: page.model,
      sessionId: page.sessionId
    };
  });
  electron.ipcMain.handle("chat:opencodeModels", async () => {
    const isFresh = cachedOpenCodeModels.length > 0 && Date.now() - cachedOpenCodeModelsAt < OPEN_CODE_MODELS_CACHE_MS;
    if (!isFresh) void refreshOpenCodeModelsInBackground();
    const models = isFresh ? cachedOpenCodeModels : cachedOpenCodeModels.length > 0 ? cachedOpenCodeModels : getOpenCodeFallbackModels();
    return {
      models,
      source: isFresh ? "cache" : cachedOpenCodeModels.length > 0 ? "stale-cache" : "fallback",
      loading: openCodeModelsRefreshPromise !== null
    };
  });
}
const CONTEX_DIR = CONTEX_HOME;
const SAVE_DEBOUNCE_MS = 1e3;
const stores = /* @__PURE__ */ new Map();
function storePath(workspaceId) {
  return path$1.join(CONTEX_DIR, "workspaces", workspaceId, ".contex", "activity.json");
}
async function ensureDir$2(workspaceId) {
  await fs.promises.mkdir(path$1.join(CONTEX_DIR, "workspaces", workspaceId, ".contex"), { recursive: true });
}
async function loadStore(workspaceId) {
  const existing = stores.get(workspaceId);
  if (existing) return existing;
  let records = [];
  try {
    const raw = await fs.promises.readFile(storePath(workspaceId), "utf8");
    records = JSON.parse(raw);
  } catch {
  }
  const state = { records, dirty: false, saveTimer: null };
  stores.set(workspaceId, state);
  return state;
}
function scheduleSave(workspaceId, state) {
  state.dirty = true;
  if (state.saveTimer) return;
  state.saveTimer = setTimeout(async () => {
    state.saveTimer = null;
    if (!state.dirty) return;
    state.dirty = false;
    try {
      await ensureDir$2(workspaceId);
      await fs.promises.writeFile(storePath(workspaceId), JSON.stringify(state.records, null, 2));
    } catch {
      state.dirty = true;
    }
  }, SAVE_DEBOUNCE_MS);
}
async function upsertActivity(workspaceId, data) {
  const store = await loadStore(workspaceId);
  const now = Date.now();
  if (data.id) {
    const idx = store.records.findIndex((r) => r.id === data.id);
    if (idx !== -1) {
      const existing = store.records[idx];
      store.records[idx] = {
        ...existing,
        status: data.status ?? existing.status,
        title: data.title ?? existing.title,
        detail: data.detail ?? existing.detail,
        metadata: data.metadata ? { ...existing.metadata, ...data.metadata } : existing.metadata,
        agent: data.agent ?? existing.agent,
        updatedAt: now
      };
      scheduleSave(workspaceId, store);
      return store.records[idx];
    }
  }
  const record = {
    id: data.id ?? node_crypto.randomUUID(),
    tileId: data.tileId,
    workspaceId,
    type: data.type,
    status: data.status ?? "pending",
    title: data.title,
    detail: data.detail,
    metadata: data.metadata,
    agent: data.agent,
    createdAt: now,
    updatedAt: now
  };
  store.records.push(record);
  scheduleSave(workspaceId, store);
  return record;
}
async function queryActivity(query) {
  const store = await loadStore(query.workspaceId);
  let results = store.records;
  if (query.tileId) results = results.filter((r) => r.tileId === query.tileId);
  if (query.type) results = results.filter((r) => r.type === query.type);
  if (query.status) results = results.filter((r) => r.status === query.status);
  if (query.agent) results = results.filter((r) => r.agent === query.agent);
  results = results.sort((a, b) => b.updatedAt - a.updatedAt);
  if (query.limit) results = results.slice(0, query.limit);
  return results;
}
async function getActivityByTile(workspaceId, tileId) {
  return queryActivity({ workspaceId, tileId });
}
async function deleteActivity(workspaceId, id) {
  const store = await loadStore(workspaceId);
  const idx = store.records.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  store.records.splice(idx, 1);
  scheduleSave(workspaceId, store);
  return true;
}
async function clearTileActivity(workspaceId, tileId) {
  const store = await loadStore(workspaceId);
  const before = store.records.length;
  store.records = store.records.filter((r) => r.tileId !== tileId);
  const removed = before - store.records.length;
  if (removed > 0) scheduleSave(workspaceId, store);
  return removed;
}
async function getActivityByAgent(workspaceId) {
  const store = await loadStore(workspaceId);
  const groups = {};
  for (const r of store.records) {
    const key = r.agent ?? `tile:${r.tileId}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}
async function flushAll() {
  for (const [workspaceId, state] of stores) {
    if (state.saveTimer) clearTimeout(state.saveTimer);
    if (state.dirty) {
      try {
        await ensureDir$2(workspaceId);
        await fs.promises.writeFile(storePath(workspaceId), JSON.stringify(state.records, null, 2));
        state.dirty = false;
      } catch {
      }
    }
  }
}
function registerActivityIPC() {
  electron.ipcMain.handle("activity:upsert", (_, workspaceId, data) => {
    return upsertActivity(workspaceId, data);
  });
  electron.ipcMain.handle("activity:query", (_, query) => {
    return queryActivity(query);
  });
  electron.ipcMain.handle("activity:byTile", (_, workspaceId, tileId) => {
    return getActivityByTile(workspaceId, tileId);
  });
  electron.ipcMain.handle("activity:delete", (_, workspaceId, id) => {
    return deleteActivity(workspaceId, id);
  });
  electron.ipcMain.handle("activity:clearTile", (_, workspaceId, tileId) => {
    return clearTileActivity(workspaceId, tileId);
  });
  electron.ipcMain.handle("activity:byAgent", (_, workspaceId) => {
    return getActivityByAgent(workspaceId);
  });
}
const MESSAGE_PROTOCOL = "contex-message/v1";
const MESSAGE_MAILBOXES = ["inbox", "sent", "memory", "bin"];
const MESSAGE_MAILBOX_SET = new Set(MESSAGE_MAILBOXES);
function assertSafeWorkspacePath(workspacePath) {
  const resolved = path$1.resolve(String(workspacePath ?? "").trim());
  if (!resolved) throw new Error("Invalid workspace path");
  return resolved;
}
function assertSafePathSegment(value, label) {
  const segment = String(value ?? "").trim();
  if (!segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\") || segment.includes("\0")) {
    throw new Error(`Invalid ${label}`);
  }
  return segment;
}
function assertSafeMailbox(mailbox) {
  if (!MESSAGE_MAILBOX_SET.has(String(mailbox))) throw new Error("Invalid mailbox");
  return mailbox;
}
function resolveInside(root, ...segments) {
  const base = path$1.resolve(root);
  const target = path$1.resolve(base, ...segments);
  const rel = path$1.relative(base, target);
  if (rel.startsWith("..") || path$1.isAbsolute(rel)) {
    throw new Error("Path escapes expected directory");
  }
  return target;
}
function collabDir(workspacePath, tileId) {
  return workspaceTileDir(assertSafeWorkspacePath(workspacePath), assertSafePathSegment(tileId, "tileId"));
}
function legacyCollabDir(workspacePath, tileId) {
  return legacyWorkspaceTileDir(assertSafeWorkspacePath(workspacePath), assertSafePathSegment(tileId, "tileId"));
}
function contextDir(workspacePath, tileId) {
  return workspaceTileContextDir(workspacePath, tileId);
}
function legacyContextDir(workspacePath, tileId) {
  return legacyWorkspaceTileContextDir(workspacePath, tileId);
}
function messagesDir(workspacePath, tileId) {
  return workspaceTileMessagesDir(workspacePath, tileId);
}
function mailboxDir(workspacePath, tileId, mailbox) {
  return workspaceTileMessageMailboxDir(assertSafeWorkspacePath(workspacePath), assertSafePathSegment(tileId, "tileId"), assertSafeMailbox(mailbox));
}
function contextFilePath(workspacePath, tileId, filename) {
  return resolveInside(contextDir(workspacePath, tileId), assertSafePathSegment(filename, "filename"));
}
function legacyContextFilePath(workspacePath, tileId, filename) {
  return resolveInside(legacyContextDir(workspacePath, tileId), assertSafePathSegment(filename, "filename"));
}
function messageFilePath(workspacePath, tileId, mailbox, filename) {
  return resolveInside(mailboxDir(workspacePath, tileId, mailbox), assertSafePathSegment(filename, "filename"));
}
async function ensureTileProtocolDirs(workspacePath, tileId) {
  await fs.promises.mkdir(contextDir(workspacePath, tileId), { recursive: true });
  await Promise.all(MESSAGE_MAILBOXES.map((mailbox) => fs.promises.mkdir(mailboxDir(workspacePath, tileId, mailbox), { recursive: true })));
}
async function readJsonSafe(path2, fallback) {
  try {
    const raw = await fs.promises.readFile(path2, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
async function readJsonFromEither(primary, legacy, fallback) {
  try {
    const raw = await fs.promises.readFile(primary, "utf8");
    return JSON.parse(raw);
  } catch {
    return readJsonSafe(legacy, fallback);
  }
}
async function writeJson(path2, data) {
  await fs.promises.writeFile(path2, JSON.stringify(data, null, 2));
}
async function removeDirIfExists(path2) {
  try {
    await fs.promises.rm(path2, { recursive: true, force: true });
  } catch {
  }
}
async function pruneOrphanedTileDirs(rootDir, validTileIds) {
  try {
    const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
    const removed = [];
    await Promise.all(entries.map(async (entry) => {
      if (!entry.isDirectory()) return;
      if (entry.name.startsWith(".")) return;
      if (validTileIds.has(entry.name)) return;
      await removeDirIfExists(path$1.join(rootDir, entry.name));
      removed.push(entry.name);
    }));
    return removed.sort();
  } catch {
    return [];
  }
}
function sanitizeFilenamePart(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "message";
}
function frontmatterValue(value) {
  if (value === void 0) return "null";
  return JSON.stringify(value);
}
function parseFrontmatterValue(raw) {
  const trimmed = raw.trim();
  if (trimmed === "null") return null;
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : trimmed;
}
function extractPayload(body) {
  const match = body.match(/\n```(?:json\s+)?contex-data\n([\s\S]*?)\n```\s*$/);
  if (!match) return { body: body.trim() };
  try {
    return {
      body: body.slice(0, match.index).trim(),
      data: JSON.parse(match[1])
    };
  } catch {
    return { body: body.trim() };
  }
}
function renderMessageMarkdown(meta, body, data) {
  const lines = [
    "---",
    `protocol: ${frontmatterValue(meta.protocol)}`,
    `id: ${frontmatterValue(meta.id)}`,
    `threadId: ${frontmatterValue(meta.threadId)}`,
    `fromTileId: ${frontmatterValue(meta.fromTileId)}`,
    `toTileId: ${frontmatterValue(meta.toTileId)}`,
    `type: ${frontmatterValue(meta.type)}`,
    `subject: ${frontmatterValue(meta.subject)}`,
    `status: ${frontmatterValue(meta.status)}`,
    `createdAt: ${frontmatterValue(meta.createdAt)}`,
    `createdTs: ${frontmatterValue(meta.createdTs)}`,
    `updatedAt: ${frontmatterValue(meta.updatedAt)}`,
    `updatedTs: ${frontmatterValue(meta.updatedTs)}`,
    `replyToId: ${frontmatterValue(meta.replyToId)}`,
    "---",
    "",
    body.trim()
  ];
  if (data && Object.keys(data).length > 0) {
    lines.push("", "```contex-data", JSON.stringify(data, null, 2), "```");
  }
  lines.push("");
  return lines.join("\n");
}
function parseMessageMarkdown(content, mailbox, filename) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const values = /* @__PURE__ */ new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1);
    values.set(key, parseFrontmatterValue(rawValue));
  }
  if (values.get("protocol") !== MESSAGE_PROTOCOL) return null;
  const payload = extractPayload(match[2] ?? "");
  const meta = {
    protocol: MESSAGE_PROTOCOL,
    id: String(values.get("id") ?? ""),
    threadId: String(values.get("threadId") ?? ""),
    fromTileId: String(values.get("fromTileId") ?? ""),
    toTileId: String(values.get("toTileId") ?? ""),
    type: String(values.get("type") ?? "note"),
    subject: String(values.get("subject") ?? ""),
    status: String(values.get("status") ?? "unread"),
    createdAt: String(values.get("createdAt") ?? ""),
    createdTs: Number(values.get("createdTs") ?? 0),
    updatedAt: String(values.get("updatedAt") ?? values.get("createdAt") ?? ""),
    updatedTs: Number(values.get("updatedTs") ?? values.get("createdTs") ?? 0),
    replyToId: values.get("replyToId") ? String(values.get("replyToId")) : void 0
  };
  if (!meta.id || !meta.fromTileId || !meta.toTileId) return null;
  return {
    mailbox,
    filename,
    meta,
    body: payload.body,
    data: payload.data
  };
}
async function readMessageFile(path2, mailbox, filename) {
  try {
    const raw = await fs.promises.readFile(path2, "utf8");
    return parseMessageMarkdown(raw, mailbox, filename);
  } catch {
    return null;
  }
}
async function broadcastMessageChange(payload) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    win.webContents.send("collab:messageChanged", payload);
  }
}
function parseMailboxAndFilename(rootDir, changedPath) {
  const relative2 = changedPath.slice(rootDir.length + 1);
  const parts = relative2.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const mailbox = parts[0];
  if (!MESSAGE_MAILBOXES.includes(mailbox)) return null;
  return { mailbox, filename: parts.slice(1).join("/") };
}
const stateWatchers = /* @__PURE__ */ new Map();
const messageWatchers = /* @__PURE__ */ new Map();
async function startStateWatcher(workspacePath, tileId) {
  const key = `${workspacePath}:${tileId}`;
  if (stateWatchers.has(key)) return;
  const statePath = path$1.join(collabDir(workspacePath, tileId), "state.json");
  const chokidar = await import("chokidar");
  const watcher = chokidar.watch(statePath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
  });
  watcher.on("change", async () => {
    const state = await readJsonSafe(statePath, { tasks: [], paused: false });
    for (const win of electron.BrowserWindow.getAllWindows()) {
      win.webContents.send("collab:stateChanged", { workspacePath, tileId, state });
    }
  });
  stateWatchers.set(key, { close: () => watcher.close() });
}
function stopStateWatcher(workspacePath, tileId) {
  const key = `${workspacePath}:${tileId}`;
  const watcher = stateWatchers.get(key);
  if (!watcher) return;
  watcher.close();
  stateWatchers.delete(key);
}
async function startMessageWatcher(workspacePath, tileId) {
  const key = `${workspacePath}:${tileId}`;
  if (messageWatchers.has(key)) return;
  const rootDir = messagesDir(workspacePath, tileId);
  await ensureTileProtocolDirs(workspacePath, tileId);
  const chokidar = await import("chokidar");
  const watcher = chokidar.watch(path$1.join(rootDir, "**/*.md"), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
  });
  const onChange = async (event, changedPath) => {
    const parsed = parseMailboxAndFilename(rootDir, changedPath);
    if (!parsed) return;
    if (event === "unlink") {
      await broadcastMessageChange({
        workspacePath,
        tileId,
        mailbox: parsed.mailbox,
        filename: parsed.filename,
        event
      });
      return;
    }
    const message = await readMessageFile(changedPath, parsed.mailbox, parsed.filename);
    await broadcastMessageChange({
      workspacePath,
      tileId,
      mailbox: parsed.mailbox,
      filename: parsed.filename,
      event,
      message
    });
  };
  watcher.on("add", (path2) => void onChange("add", path2));
  watcher.on("change", (path2) => void onChange("change", path2));
  watcher.on("unlink", (path2) => void onChange("unlink", path2));
  messageWatchers.set(key, { close: () => watcher.close() });
}
function stopMessageWatcher(workspacePath, tileId) {
  const key = `${workspacePath}:${tileId}`;
  const watcher = messageWatchers.get(key);
  if (!watcher) return;
  watcher.close();
  messageWatchers.delete(key);
}
function registerCollabIPC() {
  electron.ipcMain.handle("collab:ensureDir", async (_, workspacePath, tileId) => {
    await ensureTileProtocolDirs(workspacePath, tileId);
    return true;
  });
  electron.ipcMain.handle("collab:writeObjective", async (_, workspacePath, tileId, md) => {
    const dir = collabDir(workspacePath, tileId);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path$1.join(dir, "objective.md"), md);
    return true;
  });
  electron.ipcMain.handle("collab:readObjective", async (_, workspacePath, tileId) => {
    try {
      return await fs.promises.readFile(path$1.join(collabDir(workspacePath, tileId), "objective.md"), "utf8");
    } catch {
      try {
        return await fs.promises.readFile(path$1.join(legacyCollabDir(workspacePath, tileId), "objective.md"), "utf8");
      } catch {
        return null;
      }
    }
  });
  electron.ipcMain.handle("collab:writeSkills", async (_, workspacePath, tileId, skills) => {
    const dir = collabDir(workspacePath, tileId);
    await fs.promises.mkdir(dir, { recursive: true });
    await writeJson(path$1.join(dir, "skills.json"), skills);
    return true;
  });
  electron.ipcMain.handle("collab:readSkills", async (_, workspacePath, tileId) => {
    return readJsonFromEither(
      path$1.join(collabDir(workspacePath, tileId), "skills.json"),
      path$1.join(legacyCollabDir(workspacePath, tileId), "skills.json"),
      { enabled: [], disabled: [] }
    );
  });
  electron.ipcMain.handle("collab:writeState", async (_, workspacePath, tileId, state) => {
    const dir = collabDir(workspacePath, tileId);
    await fs.promises.mkdir(dir, { recursive: true });
    await writeJson(path$1.join(dir, "state.json"), state);
    return true;
  });
  electron.ipcMain.handle("collab:readState", async (_, workspacePath, tileId) => {
    return readJsonFromEither(
      path$1.join(collabDir(workspacePath, tileId), "state.json"),
      path$1.join(legacyCollabDir(workspacePath, tileId), "state.json"),
      { tasks: [], paused: false }
    );
  });
  electron.ipcMain.handle("collab:addContext", async (_, workspacePath, tileId, filename, content) => {
    const dir = contextDir(workspacePath, tileId);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(contextFilePath(workspacePath, tileId, filename), content);
    return true;
  });
  electron.ipcMain.handle("collab:removeContext", async (_, workspacePath, tileId, filename) => {
    try {
      await fs.promises.unlink(contextFilePath(workspacePath, tileId, filename));
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("collab:listContext", async (_, workspacePath, tileId) => {
    try {
      const dir = contextDir(workspacePath, tileId);
      const entries = await fs.promises.readdir(dir);
      return entries.filter((entry) => !entry.startsWith("."));
    } catch {
      try {
        const entries = await fs.promises.readdir(legacyContextDir(workspacePath, tileId));
        return entries.filter((entry) => !entry.startsWith("."));
      } catch {
        return [];
      }
    }
  });
  electron.ipcMain.handle("collab:readContext", async (_, workspacePath, tileId, filename) => {
    try {
      return await fs.promises.readFile(contextFilePath(workspacePath, tileId, filename), "utf8");
    } catch {
      try {
        return await fs.promises.readFile(legacyContextFilePath(workspacePath, tileId, filename), "utf8");
      } catch {
        return null;
      }
    }
  });
  electron.ipcMain.handle("collab:listMessages", async (_, workspacePath, tileId, mailbox) => {
    try {
      const dir = mailboxDir(workspacePath, tileId, mailbox);
      await fs.promises.mkdir(dir, { recursive: true });
      const entries = (await fs.promises.readdir(dir)).filter((entry) => entry.endsWith(".md") && !entry.startsWith("."));
      const messages = await Promise.all(entries.map(async (filename) => {
        const message = await readMessageFile(path$1.join(dir, filename), mailbox, filename);
        if (!message) return null;
        const listItem = { mailbox, filename, meta: message.meta };
        return listItem;
      }));
      return messages.filter(Boolean).sort((a, b) => (b?.meta.createdTs ?? 0) - (a?.meta.createdTs ?? 0));
    } catch {
      return [];
    }
  });
  electron.ipcMain.handle("collab:readMessage", async (_, workspacePath, tileId, mailbox, filename) => {
    return readMessageFile(messageFilePath(workspacePath, tileId, mailbox, filename), mailbox, assertSafePathSegment(filename, "filename"));
  });
  electron.ipcMain.handle("collab:sendMessage", async (_, workspacePath, fromTileId, draft) => {
    await ensureTileProtocolDirs(workspacePath, fromTileId);
    await ensureTileProtocolDirs(workspacePath, draft.toTileId);
    const id = crypto.randomUUID();
    const threadId = draft.threadId ?? id;
    const now = /* @__PURE__ */ new Date();
    const iso = now.toISOString();
    const ts = now.getTime();
    const slug = sanitizeFilenamePart(draft.subject);
    const filename = `${iso.replace(/[:.]/g, "-")}-${slug}.md`;
    const baseMeta = {
      protocol: MESSAGE_PROTOCOL,
      id,
      threadId,
      fromTileId,
      toTileId: draft.toTileId,
      type: draft.type ?? (draft.replyToId ? "reply" : "request"),
      subject: draft.subject,
      createdAt: iso,
      createdTs: ts,
      updatedAt: iso,
      updatedTs: ts,
      replyToId: draft.replyToId
    };
    const senderMeta = { ...baseMeta, status: "sent" };
    const recipientMeta = { ...baseMeta, status: "unread" };
    const senderPath = messageFilePath(workspacePath, fromTileId, "sent", filename);
    const recipientPath = messageFilePath(workspacePath, draft.toTileId, "inbox", filename);
    await Promise.all([
      fs.promises.writeFile(senderPath, renderMessageMarkdown(senderMeta, draft.body, draft.data)),
      fs.promises.writeFile(recipientPath, renderMessageMarkdown(recipientMeta, draft.body, draft.data))
    ]);
    return {
      id,
      threadId,
      filename,
      fromTileId,
      toTileId: draft.toTileId,
      senderPath,
      recipientPath
    };
  });
  electron.ipcMain.handle("collab:updateMessageStatus", async (_, workspacePath, tileId, mailbox, filename, status2) => {
    const path2 = messageFilePath(workspacePath, tileId, mailbox, filename);
    const existing = await readMessageFile(path2, mailbox, filename);
    if (!existing) return false;
    const now = /* @__PURE__ */ new Date();
    const next = {
      ...existing,
      meta: {
        ...existing.meta,
        status: status2,
        updatedAt: now.toISOString(),
        updatedTs: now.getTime()
      }
    };
    await fs.promises.writeFile(path2, renderMessageMarkdown(next.meta, next.body, next.data));
    return true;
  });
  electron.ipcMain.handle("collab:moveMessage", async (_, workspacePath, tileId, fromMailbox, toMailbox, filename) => {
    const source = messageFilePath(workspacePath, tileId, fromMailbox, filename);
    const targetDir = mailboxDir(workspacePath, tileId, toMailbox);
    const target = resolveInside(targetDir, path$1.basename(assertSafePathSegment(filename, "filename")));
    try {
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.rename(source, target);
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("collab:watchMessages", async (_, workspacePath, tileId) => {
    await startMessageWatcher(workspacePath, tileId);
    return true;
  });
  electron.ipcMain.handle("collab:unwatchMessages", (_, workspacePath, tileId) => {
    stopMessageWatcher(workspacePath, tileId);
    return true;
  });
  electron.ipcMain.handle("collab:watchState", async (_, workspacePath, tileId) => {
    await startStateWatcher(workspacePath, tileId);
    return true;
  });
  electron.ipcMain.handle("collab:unwatchState", (_, workspacePath, tileId) => {
    stopStateWatcher(workspacePath, tileId);
    return true;
  });
  electron.ipcMain.handle("collab:removeTileDir", async (_, workspacePath, tileId) => {
    stopStateWatcher(workspacePath, tileId);
    stopMessageWatcher(workspacePath, tileId);
    await Promise.all([
      removeDirIfExists(collabDir(workspacePath, tileId)),
      removeDirIfExists(legacyCollabDir(workspacePath, tileId))
    ]);
    return true;
  });
  electron.ipcMain.handle("collab:pruneOrphanedTileDirs", async (_, workspacePath, tileIds) => {
    const workspaceRoot = assertSafeWorkspacePath(workspacePath);
    const validTileIds = new Set(tileIds.map((id) => {
      try {
        return assertSafePathSegment(id, "tileId");
      } catch {
        return "";
      }
    }).filter(Boolean));
    const removed = await Promise.all([
      pruneOrphanedTileDirs(path$1.join(workspaceRoot, ".contex"), validTileIds),
      pruneOrphanedTileDirs(path$1.join(workspaceRoot, ".collab"), validTileIds)
    ]);
    return {
      removed: Array.from(/* @__PURE__ */ new Set([...removed[0], ...removed[1]])).sort()
    };
  });
}
function stopAllCollabWatchers() {
  for (const watcher of stateWatchers.values()) watcher.close();
  for (const watcher of messageWatchers.values()) watcher.close();
  stateWatchers.clear();
  messageWatchers.clear();
}
async function loadTileState(workspaceId, tileId) {
  return loadWorkspaceTileState(workspaceId, tileId, {});
}
async function saveTileState(workspaceId, tileId, state) {
  await saveWorkspaceTileState(workspaceId, tileId, state);
}
function publishContextChanged(tileId, key, value) {
  const evt = bus.publish({
    channel: `ctx:${tileId}`,
    type: "data",
    source: `tile:${tileId}`,
    payload: { action: "context_changed", key, value, tileId }
  });
  electron.BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("tileContext:changed", { tileId, key, value });
  });
}
function registerTileContextIPC() {
  electron.ipcMain.handle("tileContext:get", async (_, workspaceId, tileId, key) => {
    const state = await loadTileState(workspaceId, tileId);
    const ctx = state._context ?? {};
    if (key) return ctx[key] ?? null;
    return ctx;
  });
  electron.ipcMain.handle("tileContext:getAll", async (_, workspaceId, tileId, tagPrefix) => {
    const state = await loadTileState(workspaceId, tileId);
    const ctx = state._context ?? {};
    if (!tagPrefix) return Object.values(ctx);
    return Object.values(ctx).filter((e) => e.key.startsWith(tagPrefix));
  });
  electron.ipcMain.handle("tileContext:set", async (_, workspaceId, tileId, key, value) => {
    const state = await loadTileState(workspaceId, tileId);
    if (!state._context) state._context = {};
    state._context[key] = { key, value, updatedAt: Date.now(), source: tileId };
    await saveTileState(workspaceId, tileId, state);
    publishContextChanged(tileId, key, value);
    return true;
  });
  electron.ipcMain.handle("tileContext:delete", async (_, workspaceId, tileId, key) => {
    const state = await loadTileState(workspaceId, tileId);
    if (state._context) {
      delete state._context[key];
      await saveTileState(workspaceId, tileId, state);
      publishContextChanged(tileId, key, null);
    }
    return true;
  });
}
let gcTimer = null;
function scheduleGC() {
  if (gcTimer) clearTimeout(gcTimer);
  gcTimer = setTimeout(() => {
    gcTimer = null;
    runGC();
  }, 1e3);
}
function runGC() {
  const g = globalThis;
  if (typeof g.gc === "function") {
    try {
      g.gc();
    } catch (err) {
      console.warn("[system] main gc() threw:", err);
    }
  }
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    try {
      win.webContents.send("system:gc-requested");
    } catch {
    }
  }
}
function sanitizeDaemonState(result) {
  if (!result.info) {
    return { running: result.running, info: null };
  }
  return {
    running: result.running,
    info: {
      pid: result.info.pid,
      port: result.info.port,
      startedAt: result.info.startedAt,
      protocolVersion: result.info.protocolVersion,
      appVersion: result.info.appVersion
    }
  };
}
function readDaemonJobSummary() {
  const jobsDir = path$1.join(CONTEX_HOME, "jobs");
  if (!fs.existsSync(jobsDir)) {
    return {
      total: 0,
      active: 0,
      backgroundActive: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      other: 0,
      recent: []
    };
  }
  const records = [];
  for (const entry of fs.readdirSync(jobsDir)) {
    if (!entry.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path$1.join(jobsDir, entry), "utf8"));
      if (parsed && typeof parsed.id === "string") records.push(parsed);
    } catch {
    }
  }
  const normalized = records.map((record) => ({
    id: record.id,
    taskLabel: typeof record.taskLabel === "string" ? record.taskLabel : null,
    status: typeof record.status === "string" ? record.status : "unknown",
    runMode: typeof record.runMode === "string" ? record.runMode : "foreground",
    workspaceId: typeof record.workspaceId === "string" ? record.workspaceId : null,
    cardId: typeof record.cardId === "string" ? record.cardId : null,
    provider: typeof record.provider === "string" ? record.provider : null,
    model: typeof record.model === "string" ? record.model : null,
    workspaceDir: typeof record.workspaceDir === "string" ? record.workspaceDir : null,
    sessionId: typeof record.sessionId === "string" ? record.sessionId : null,
    initialPrompt: typeof record.initialPrompt === "string" ? record.initialPrompt : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    requestedAt: typeof record.requestedAt === "string" ? record.requestedAt : null,
    lastSequence: typeof record.lastSequence === "number" ? record.lastSequence : 0,
    error: typeof record.error === "string" ? record.error : null
  })).sort((a, b) => {
    const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return bTime - aTime;
  });
  const counts = normalized.reduce((acc, record) => {
    if (record.status === "running" || record.status === "starting" || record.status === "queued" || record.status === "reconnecting") {
      acc.active += 1;
      if (record.runMode === "background") acc.backgroundActive += 1;
    } else if (record.status === "completed") {
      acc.completed += 1;
    } else if (record.status === "failed" || record.status === "lost") {
      acc.failed += 1;
    } else if (record.status === "cancelled") {
      acc.cancelled += 1;
    } else {
      acc.other += 1;
    }
    return acc;
  }, {
    active: 0,
    backgroundActive: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    other: 0
  });
  return {
    total: normalized.length,
    active: counts.active,
    backgroundActive: counts.backgroundActive,
    completed: counts.completed,
    failed: counts.failed,
    cancelled: counts.cancelled,
    other: counts.other,
    recent: normalized.slice(0, 20)
  };
}
function registerSystemIPC() {
  electron.ipcMain.handle("db:status", () => {
    try {
      return { ok: true, status: getDbStatus() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  electron.ipcMain.handle("db:reset", () => {
    try {
      const { backupPath } = resetDatabase();
      getDb();
      return { ok: true, backupPath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  electron.ipcMain.handle("system:cleanupTile", (_, tileId) => {
    if (!tileId || typeof tileId !== "string") return { ok: false };
    const channelsDropped = bus.dropChannelsMatching(`tile:${tileId}`);
    removeTile(tileId);
    scheduleGC();
    return { ok: true, channelsDropped };
  });
  electron.ipcMain.handle("system:gc", () => {
    runGC();
    return { ok: true, exposed: typeof globalThis.gc === "function" };
  });
  electron.ipcMain.handle("system:memStats", () => {
    const mem = process.memoryUsage();
    const heap = v8.getHeapStatistics();
    return {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      heapLimit: heap.heap_size_limit,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      bus: bus.getStats()
    };
  });
  electron.ipcMain.handle("system:daemonStatus", async () => {
    return sanitizeDaemonState(await getDaemonStatus());
  });
  electron.ipcMain.handle("system:daemonSummary", async () => {
    const status2 = sanitizeDaemonState(await getDaemonStatus());
    const dashboard = await daemonClient.getJobDashboard().catch(() => null);
    if (dashboard) {
      return {
        ...status2,
        jobs: {
          total: dashboard.summary.total,
          active: dashboard.summary.active,
          backgroundActive: dashboard.summary.backgroundActive,
          completed: dashboard.summary.completed,
          failed: dashboard.summary.failed,
          cancelled: dashboard.summary.cancelled,
          other: dashboard.summary.other,
          recent: dashboard.jobs.slice(0, 6).map((job) => ({
            id: job.id,
            taskLabel: job.taskLabel,
            status: job.status,
            runMode: job.runMode ?? null,
            workspaceId: job.workspaceId ?? null,
            cardId: job.cardId ?? null,
            provider: job.provider,
            model: job.model,
            workspaceDir: job.workspaceDir,
            sessionId: job.sessionId ?? null,
            initialPrompt: job.initialPrompt ?? null,
            updatedAt: job.updatedAt,
            requestedAt: job.requestedAt,
            lastSequence: job.lastSequence,
            error: job.error
          })).slice(0, 20)
        },
        dreaming: dashboard.dreaming ?? null
      };
    }
    return {
      ...status2,
      jobs: readDaemonJobSummary(),
      dreaming: null
    };
  });
  electron.ipcMain.handle("system:restartDaemon", async () => {
    const info = await restartDaemon();
    return sanitizeDaemonState({ running: true, info });
  });
}
async function listExecutionHostsSafe() {
  try {
    await ensureDaemonRunning();
    return await daemonClient.listHosts();
  } catch {
    return getBuiltinExecutionHosts();
  }
}
function registerExecutionIPC() {
  electron.ipcMain.handle("execution:listHosts", async () => {
    await ensureDaemonRunning();
    return await daemonClient.listHosts();
  });
  electron.ipcMain.handle("execution:upsertHost", async (_, host) => {
    await ensureDaemonRunning();
    return await daemonClient.upsertHost(host);
  });
  electron.ipcMain.handle("execution:deleteHost", async (_, id) => {
    await ensureDaemonRunning();
    return await daemonClient.deleteHost(id);
  });
  electron.ipcMain.handle("execution:resolveTarget", async (_, preference) => {
    const [hosts, daemonStatus] = await Promise.all([
      listExecutionHostsSafe(),
      getDaemonStatus()
    ]);
    return resolveExecutionTarget({
      hosts,
      preference,
      localDaemonAvailable: daemonStatus.running === true
    });
  });
}
function registerPermissionsIPC() {
  electron.ipcMain.handle("permissions:list", async () => {
    return {
      path: getPermissionsStorePath(),
      grants: listPermissionGrants()
    };
  });
  electron.ipcMain.handle("permissions:clear", async (_, id) => {
    return {
      path: getPermissionsStorePath(),
      grants: clearPermissionGrant(String(id ?? "").trim())
    };
  });
  electron.ipcMain.handle("permissions:clearAll", async () => {
    return {
      path: getPermissionsStorePath(),
      grants: clearAllPermissionGrants()
    };
  });
}
const UI_STATE_PATH = path$1.join(CONTEX_HOME, "ui-state.json");
let cached = null;
async function readState() {
  if (cached) return cached;
  try {
    const raw = await fs.promises.readFile(UI_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    cached = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    cached = {};
  }
  return cached;
}
async function writeState(next) {
  cached = next;
  try {
    await fs.promises.mkdir(CONTEX_HOME, { recursive: true });
    await fs.promises.writeFile(UI_STATE_PATH, JSON.stringify(next, null, 2));
  } catch {
  }
}
async function getSavedZoomLevel() {
  const state = await readState();
  return typeof state.zoomLevel === "number" ? state.zoomLevel : 0;
}
function registerUIIPC() {
  electron.ipcMain.handle("ui:getZoomLevel", async () => getSavedZoomLevel());
  electron.ipcMain.handle("ui:setZoomLevel", async (event, level) => {
    if (typeof level !== "number" || !Number.isFinite(level)) return;
    const state = await readState();
    await writeState({ ...state, zoomLevel: level });
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.setZoomLevel(level);
    }
  });
}
function rowToRecentJob(row) {
  return {
    jobId: row.job_id,
    taskLabel: row.task_label,
    initialPrompt: row.initial_prompt,
    status: row.status,
    provider: row.provider,
    model: row.model,
    runMode: row.run_mode,
    workspaceId: row.workspace_id,
    workspaceDir: row.workspace_dir,
    cardId: row.card_id,
    requestedAtMs: row.requested_at_ms,
    completedAtMs: row.completed_at_ms,
    durationMs: row.duration_ms,
    lastActivityAtMs: row.last_activity_at_ms,
    lastEventType: row.last_event_type,
    eventCount: row.event_count,
    errorCount: row.error_count,
    isStarred: row.is_starred === 1,
    isArchived: row.is_archived === 1
  };
}
function clampLimit(raw) {
  const n = Number.isFinite(raw) ? Math.floor(raw) : 50;
  if (n < 1) return 1;
  if (n > 500) return 500;
  return n;
}
function clampOffset(raw) {
  const n = Number.isFinite(raw) ? Math.floor(raw) : 0;
  return n < 0 ? 0 : n;
}
function normalizeWorkspace(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}
function registerJobsIPC() {
  electron.ipcMain.handle(
    "jobs:recent",
    async (_, req) => {
      const db = getDb();
      const workspaceId = normalizeWorkspace(req?.workspaceId);
      const includeArchived = req?.includeArchived === true;
      const limit = clampLimit(req?.limit);
      const offset = clampOffset(req?.offset);
      const clauses = ["deleted_at IS NULL"];
      const params = [];
      if (workspaceId) {
        clauses.push("workspace_id = ?");
        params.push(workspaceId);
      }
      if (!includeArchived) {
        clauses.push("is_archived = 0");
      }
      const whereSql = clauses.join(" AND ");
      const countStmt = db.prepare(
        `SELECT COUNT(*) AS n FROM job_index WHERE ${whereSql}`
      );
      const total = countStmt.get(...params)?.n ?? 0;
      const listStmt = db.prepare(
        `SELECT
           job_id, task_label, initial_prompt, status, provider, model,
           run_mode, workspace_id, workspace_dir, card_id,
           requested_at_ms, completed_at_ms, duration_ms,
           last_activity_at_ms, last_event_type,
           event_count, error_count, is_starred, is_archived
         FROM job_index
         WHERE ${whereSql}
         ORDER BY last_activity_at_ms DESC
         LIMIT ? OFFSET ?`
      );
      const rows = listStmt.all(...params, limit, offset);
      return {
        jobs: rows.map(rowToRecentJob),
        total,
        limit,
        offset
      };
    }
  );
}
const DEFAULT_SKILLS_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Claude",
  "skills"
);
const pendingSkillFiles = [];
let rendererReady = false;
function queuePendingSkillFile(filePath) {
  if (!filePath || !filePath.toLowerCase().endsWith(".skill")) return;
  if (rendererReady) {
    broadcastSkillFile(filePath);
  } else {
    pendingSkillFiles.push(filePath);
  }
}
function broadcastSkillFile(filePath) {
  const win = electron.BrowserWindow.getFocusedWindow() ?? electron.BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) {
    pendingSkillFiles.push(filePath);
    return;
  }
  win.webContents.send("skill:file-opened", { path: filePath });
}
function markRendererReadyAndFlushSkillQueue() {
  rendererReady = true;
  while (pendingSkillFiles.length > 0) {
    const next = pendingSkillFiles.shift();
    if (next) broadcastSkillFile(next);
  }
}
function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = node_child_process.spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${args.join(" ")} failed (code ${code}): ${stderr || stdout}`));
    });
  });
}
async function listZipEntries(zipPath) {
  const { stdout } = await runCmd("/usr/bin/unzip", ["-Z1", zipPath]);
  return stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}
async function readZipEntry(zipPath, entryName) {
  const { stdout } = await runCmd("/usr/bin/unzip", ["-p", zipPath, entryName]);
  return stdout;
}
function inferTopFolder(entries) {
  const tops = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    const first = entry.split("/")[0];
    if (!first) continue;
    tops.add(first);
  }
  if (tops.size !== 1) return null;
  return Array.from(tops)[0] ?? null;
}
async function readSkillManifest(zipPath) {
  const entries = await listZipEntries(zipPath);
  const topFolder = inferTopFolder(entries) ?? path.basename(zipPath, path.extname(zipPath));
  const skillEntry = entries.find((e) => /(^|\/)skill\.md$/i.test(e));
  let name = topFolder;
  let description = "";
  let preview = "";
  let hasSkillMd = false;
  if (skillEntry) {
    hasSkillMd = true;
    const content = await readZipEntry(zipPath, skillEntry);
    preview = content.slice(0, 4e3);
    const nameMatch = content.match(/^---[\s\S]*?name:\s*(.+?)$/m);
    const descMatch = content.match(/^---[\s\S]*?description:\s*(.+?)$/m);
    if (nameMatch?.[1]) name = nameMatch[1].trim();
    if (descMatch?.[1]) description = descMatch[1].trim();
  }
  return { name, description, topFolder, entryCount: entries.length, hasSkillMd, preview };
}
async function ensureDir$1(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}
async function pathExists(p) {
  try {
    await fs.promises.stat(p);
    return true;
  } catch {
    return false;
  }
}
async function extractSkill(zipPath, targetDir, opts) {
  await ensureDir$1(targetDir);
  const manifest = await readSkillManifest(zipPath);
  const installedPath = path.join(targetDir, manifest.topFolder);
  if (await pathExists(installedPath)) {
    if (!opts.overwrite) {
      throw new Error(`Skill already installed at ${installedPath}. Pass overwrite=true to replace.`);
    }
    await fs.promises.rm(installedPath, { recursive: true, force: true });
  }
  await runCmd("/usr/bin/unzip", ["-o", "-qq", zipPath, "-d", targetDir]);
  const entries = await listZipEntries(zipPath);
  return { installedPath, entries };
}
function registerSkillsIPC() {
  electron.ipcMain.handle("skills:inspect", async (_evt, zipPath) => {
    if (typeof zipPath !== "string" || !zipPath.toLowerCase().endsWith(".skill")) {
      throw new Error("skills:inspect requires a .skill file path");
    }
    const stat = await fs.promises.stat(zipPath);
    if (!stat.isFile()) throw new Error(`${zipPath} is not a file`);
    const manifest = await readSkillManifest(zipPath);
    return { ...manifest, zipPath, sizeBytes: stat.size };
  });
  electron.ipcMain.handle("skills:install", async (_evt, args) => {
    const zipPath = args?.zipPath;
    if (typeof zipPath !== "string" || !zipPath.toLowerCase().endsWith(".skill")) {
      throw new Error("skills:install requires args.zipPath pointing at a .skill file");
    }
    const targetDir = typeof args?.targetDir === "string" && args.targetDir.trim() ? args.targetDir.trim() : DEFAULT_SKILLS_DIR;
    const { installedPath, entries } = await extractSkill(zipPath, targetDir, { overwrite: !!args?.overwrite });
    return { installedPath, entries, targetDir };
  });
  electron.ipcMain.handle("skills:getDefaultTargetDir", () => DEFAULT_SKILLS_DIR);
  electron.ipcMain.handle("skills:rendererReady", () => {
    markRendererReadyAndFlushSkillQueue();
    return true;
  });
  electron.app.on("browser-window-created", (_evt, win) => {
    win.webContents.once("did-finish-load", () => {
      markRendererReadyAndFlushSkillQueue();
    });
  });
}
const SCHEME = "contex-file";
const SENSITIVE_HOME_DIRS = /* @__PURE__ */ new Set([".ssh", ".gnupg", ".aws", ".config"]);
const MIME_TYPES$1 = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".pdf": "application/pdf"
};
function inferMimeType(filePath) {
  return MIME_TYPES$1[path$1.extname(filePath).toLowerCase()] || "application/octet-stream";
}
function isSensitiveHomePath(filePath) {
  const home = path$1.resolve(os.homedir());
  const resolved = path$1.resolve(filePath);
  if (resolved === home) return false;
  if (!resolved.startsWith(`${home}/`)) return false;
  const firstSegment = resolved.slice(home.length + 1).split(/[\/]/)[0];
  return SENSITIVE_HOME_DIRS.has(firstSegment);
}
function validateRequestPath(filePath) {
  const resolved = path$1.resolve(filePath);
  const mimeType = inferMimeType(resolved);
  if (mimeType === "application/octet-stream") {
    throw new Error(`Unsupported contex-file type: ${path$1.extname(resolved) || "(none)"}`);
  }
  if (isSensitiveHomePath(resolved)) {
    throw new Error("Access denied: sensitive home directory");
  }
  return resolved;
}
function decodeRequestPath(url2) {
  const host = decodeURIComponent(url2.host || "");
  const pathname = decodeURIComponent(url2.pathname || "");
  if (process.platform === "win32") {
    if (/^[a-zA-Z]:$/.test(host)) return `${host}${pathname}`;
    if (host) return `//${host}${pathname}`;
  }
  return host ? `/${host}${pathname}` : pathname;
}
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);
function registerFileProtocol() {
  electron.protocol.handle(SCHEME, async (request) => {
    try {
      const url$1 = new URL(request.url);
      const filePath = validateRequestPath(decodeRequestPath(url$1));
      const rangeHeader = request.headers.get("range");
      const init = rangeHeader ? { headers: { range: rangeHeader } } : {};
      const resp = await electron.net.fetch(url.pathToFileURL(filePath).toString(), init);
      const headers = new Headers(resp.headers);
      if (!headers.get("content-type")) {
        headers.set("content-type", inferMimeType(filePath));
      }
      headers.set("cache-control", "no-store, no-cache, must-revalidate");
      headers.set("access-control-allow-origin", "*");
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(`contex-file error: ${message}`, { status: 500 });
    }
  });
}
const RELAY_CHANNELS = [
  "relay:init",
  "relay:syncWorkspace",
  "relay:listParticipants",
  "relay:listChannels",
  "relay:listCentralFeed",
  "relay:listMessages",
  "relay:readMessage",
  "relay:sendDirectMessage",
  "relay:sendChannelMessage",
  "relay:updateMessageStatus",
  "relay:moveMessage",
  "relay:setWorkContext",
  "relay:analyzeRelationships",
  "relay:spawnAgent",
  "relay:stopAgent",
  "relay:waitForReady",
  "relay:waitForAny"
];
function registerRelayIPC() {
  unregisterRelayIPC();
  setRelayHostActive(true);
  electron.ipcMain.handle("relay:init", async (_, workspacePath) => {
    await getWorkspaceRelay(workspacePath);
    return true;
  });
  electron.ipcMain.handle("relay:syncWorkspace", async (_, workspaceId, workspacePath, tiles) => {
    return syncWorkspaceRelayParticipants(workspaceId, workspacePath, tiles);
  });
  electron.ipcMain.handle("relay:listParticipants", async (_, workspacePath) => {
    return listWorkspaceRelayParticipants(workspacePath);
  });
  electron.ipcMain.handle("relay:listChannels", async (_, workspacePath) => {
    return listWorkspaceRelayChannels(workspacePath);
  });
  electron.ipcMain.handle("relay:listCentralFeed", async (_, workspacePath, limit) => {
    return listWorkspaceRelayCentralFeed(workspacePath, limit);
  });
  electron.ipcMain.handle("relay:listMessages", async (_, workspacePath, participantId, mailbox, limit) => {
    return listWorkspaceRelayMessages(workspacePath, participantId, mailbox, limit);
  });
  electron.ipcMain.handle("relay:readMessage", async (_, workspacePath, participantId, mailbox, filename) => {
    return readWorkspaceRelayMessage(workspacePath, participantId, mailbox, filename);
  });
  electron.ipcMain.handle("relay:sendDirectMessage", async (_, workspacePath, from, draft) => {
    return sendWorkspaceDirectRelayMessage(workspacePath, from, draft);
  });
  electron.ipcMain.handle("relay:sendChannelMessage", async (_, workspacePath, from, draft) => {
    return sendWorkspaceChannelRelayMessage(workspacePath, from, draft);
  });
  electron.ipcMain.handle("relay:updateMessageStatus", async (_, workspacePath, participantId, mailbox, filename, status2) => {
    return updateWorkspaceRelayMessageStatus(workspacePath, participantId, mailbox, filename, status2);
  });
  electron.ipcMain.handle("relay:moveMessage", async (_, workspacePath, participantId, fromMailbox, toMailbox, filename) => {
    return moveWorkspaceRelayMessage(workspacePath, participantId, fromMailbox, toMailbox, filename);
  });
  electron.ipcMain.handle("relay:setWorkContext", async (_, workspacePath, participantId, work) => {
    return setWorkspaceRelayWorkContext(workspacePath, participantId, work);
  });
  electron.ipcMain.handle("relay:analyzeRelationships", async (_, workspacePath) => {
    return analyzeWorkspaceRelayRelationships(workspacePath);
  });
  electron.ipcMain.handle("relay:spawnAgent", async (_, workspacePath, request) => {
    return spawnWorkspaceRelayAgent(workspacePath, request);
  });
  electron.ipcMain.handle("relay:stopAgent", async (_, workspacePath, participantId) => {
    await stopWorkspaceRelayAgent(workspacePath, participantId);
    return true;
  });
  electron.ipcMain.handle("relay:waitForReady", async (_, workspacePath, ids, timeoutMs) => {
    return waitForWorkspaceRelayReady(workspacePath, ids, timeoutMs);
  });
  electron.ipcMain.handle("relay:waitForAny", async (_, workspacePath, ids, timeoutMs) => {
    return waitForWorkspaceRelayAny(workspacePath, ids, timeoutMs);
  });
}
function unregisterRelayIPC() {
  for (const ch of RELAY_CHANNELS) {
    try {
      electron.ipcMain.removeHandler(ch);
    } catch {
    }
  }
  setRelayHostActive(false);
}
class ExtensionContext {
  constructor(manifest, eventBus, registry) {
    this.eventBus = eventBus;
    this.registry = registry;
    const extId = manifest.id;
    const prefix = `[Ext:${manifest.name}]`;
    this.relayHost = void 0;
    this.bus = {
      publish: (channel, type, payload) => {
        this.eventBus.publish({
          channel,
          type,
          source: `ext:${extId}`,
          payload
        });
      },
      subscribe: (channel, subscriberId, cb) => {
        const sub = this.eventBus.subscribe(channel, subscriberId, cb);
        this.busSubscriptions.push(sub.id);
        return sub.id;
      },
      unsubscribe: (id) => {
        this.eventBus.unsubscribe(id);
        this.busSubscriptions = this.busSubscriptions.filter((s) => s !== id);
      }
    };
    this.mcp = {
      registerTool: (tool) => {
        const registered = {
          name: `ext_${extId}_${tool.name}`,
          description: tool.description,
          inputSchema: tool.inputSchema,
          handler: tool.handler
        };
        this.registeredTools.push(registered);
        this.registry.registerMCPTool(extId, registered);
        console.log(`${prefix} Registered MCP tool: ${registered.name}`);
      }
    };
    this.ipc = {
      handle: (channel, handler) => {
        const fullChannel = `ext:${extId}:${channel}`;
        electron.ipcMain.handle(fullChannel, async (event, ...args) => {
          return handler(...args);
        });
        this.ipcHandlers.push(fullChannel);
        console.log(`${prefix} Registered IPC: ${fullChannel}`);
      }
    };
    if (manifest.id === "contex-relay-suite") {
      this.relayHost = {
        install: () => {
          registerRelayIPC();
          return () => {
            unregisterRelayIPC();
            stopAllRelayServices();
          };
        }
      };
    }
    this.settings = {
      get: (key) => {
        const setting = manifest.contributes?.settings?.find((s) => s.key === key);
        return setting?.default;
      }
    };
    this.log = (msg) => console.log(`${prefix} ${msg}`);
  }
  registeredTools = [];
  ipcHandlers = [];
  busSubscriptions = [];
  bus;
  mcp;
  ipc;
  /**
   * Relay Suite only: registers relay:* IPC + ContexRelay host. Returns dispose
   * (unregister IPC + stop relay services). Core app does not register relay.
   */
  relayHost;
  settings;
  log;
  /** Get tools registered by this extension's activate() */
  getRegisteredTools() {
    return [...this.registeredTools];
  }
  /** Cleanup everything this extension registered */
  dispose() {
    for (const id of this.busSubscriptions) {
      this.eventBus.unsubscribe(id);
    }
    for (const channel of this.ipcHandlers) {
      electron.ipcMain.removeHandler(channel);
    }
    this.busSubscriptions = [];
    this.ipcHandlers = [];
    this.registeredTools = [];
  }
}
async function loadPowerExtension(manifest, ctx) {
  if (!manifest.main || !manifest._path) return null;
  const entryPath = path$1.join(manifest._path, manifest.main);
  const prefix = `[Ext:${manifest.name}]`;
  try {
    delete require.cache[require.resolve(entryPath)];
    const mod = require(entryPath);
    if (typeof mod.activate !== "function") {
      console.warn(`${prefix} No activate() export found in ${entryPath}`);
      return null;
    }
    console.log(`${prefix} Activating power extension...`);
    const result = await mod.activate(ctx);
    if (typeof result === "function") {
      return () => {
        try {
          result();
          ctx.dispose();
        } catch (err) {
          console.error(`${prefix} Error during deactivation:`, err);
        }
      };
    }
    return () => ctx.dispose();
  } catch (err) {
    console.error(`${prefix} Failed to load power extension:`, err);
    return null;
  }
}
const raycastAdapter = {
  name: "raycast",
  async canLoad(dir) {
    try {
      const raw = await fs.promises.readFile(path$1.join(dir, "package.json"), "utf8");
      const pkg = JSON.parse(raw);
      const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
      return "@raycast/api" in deps;
    } catch {
      return false;
    }
  },
  async toManifest(dir) {
    const raw = await fs.promises.readFile(path$1.join(dir, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    const dirName = path$1.basename(dir);
    const tiles = (pkg.commands ?? []).filter((cmd) => cmd.mode === "view").map((cmd) => ({
      type: `ext:raycast-${dirName}-${cmd.name}`,
      label: cmd.title,
      icon: cmd.icon,
      entry: `dist/_raycast_shim_${cmd.name}.html`,
      defaultSize: { w: 500, h: 400 },
      minSize: { w: 300, h: 200 }
    }));
    return {
      id: `raycast-${dirName}`,
      name: pkg.name ?? dirName,
      version: pkg.version ?? "0.0.0",
      description: pkg.description ?? `Raycast extension: ${dirName}`,
      author: typeof pkg.author === "string" ? pkg.author : void 0,
      tier: "safe",
      contributes: { tiles },
      _path: dir,
      _enabled: true,
      _adapter: "raycast"
    };
  },
  async wrapEntry(dir, manifest) {
    const raw = await fs.promises.readFile(path$1.join(dir, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    const distDir = path$1.join(dir, "dist");
    await fs.promises.mkdir(distDir, { recursive: true });
    for (const cmd of (pkg.commands ?? []).filter((c) => c.mode === "view")) {
      const shimHtml = generateRaycastShim(cmd);
      const shimPath = path$1.join(distDir, `_raycast_shim_${cmd.name}.html`);
      await fs.promises.writeFile(shimPath, shimHtml);
    }
    return distDir;
  }
};
function generateRaycastShim(cmd) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    background: #1e1e1e;
    color: #e0ddd4;
    padding: 12px;
    font-size: 13px;
    overflow-y: auto;
  }
  .raycast-list-item {
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .raycast-list-item:hover { background: #2a2a30; }
  .raycast-list-item.selected { background: #2a3a4a; }
  .raycast-list-item .title { font-weight: 500; }
  .raycast-list-item .subtitle { color: #888; font-size: 12px; }
  .raycast-detail { padding: 16px; }
  .raycast-detail h1 { font-size: 18px; margin-bottom: 12px; }
  .raycast-search {
    width: 100%;
    padding: 8px 12px;
    background: #2a2a30;
    border: 1px solid #3a3a40;
    border-radius: 6px;
    color: #e0ddd4;
    font-size: 13px;
    margin-bottom: 8px;
    outline: none;
  }
  .raycast-search:focus { border-color: #5d8aa8; }
  .shim-notice {
    text-align: center;
    color: #666;
    padding: 40px 20px;
    font-size: 12px;
  }
  .shim-notice code { background: #2a2a30; padding: 2px 6px; border-radius: 3px; }
</style>
</head>
<body>
<div class="shim-notice">
  <div style="font-size: 24px; margin-bottom: 12px;">🔮</div>
  <div style="margin-bottom: 8px; font-weight: 500;">${cmd.title}</div>
  <div style="margin-bottom: 16px; color: #888;">${cmd.description ?? "Raycast extension"}</div>
  <div>
    This is a Raycast extension running in compatibility mode.<br>
    Build the extension with <code>npm run build</code> and place<br>
    the output in the <code>dist/</code> folder.
  </div>
</div>
<script>
  // Raycast API compatibility shim
  // This provides a minimal @raycast/api that maps to contex bridge
  if (window.contex) {
    window.contex.tile.getState().then(state => {
      console.log('[Raycast shim] Loaded state:', state);
    });
  }
<\/script>
</body>
</html>`;
}
const piAdapter = {
  name: "pi-skill",
  async canLoad(dir) {
    try {
      await fs.promises.access(path$1.join(dir, "SKILL.md"));
      return true;
    } catch {
      return false;
    }
  },
  async toManifest(dir) {
    const dirName = path$1.basename(dir);
    const skillMd = await fs.promises.readFile(path$1.join(dir, "SKILL.md"), "utf8");
    const nameMatch = skillMd.match(/^#\s+(.+)/m);
    const descMatch = skillMd.match(/^(?:description|Description):\s*(.+)/m) ?? skillMd.match(/^[^#\n].{10,100}/m);
    const name = nameMatch?.[1]?.trim() ?? dirName;
    const description = descMatch?.[1]?.trim() ?? `Pi skill: ${dirName}`;
    const tools = extractToolsFromSkillMd(skillMd, dirName);
    let main;
    for (const candidate of ["main.js", "index.js", "dist/index.js"]) {
      try {
        await fs.promises.access(path$1.join(dir, candidate));
        main = candidate;
        break;
      } catch {
      }
    }
    return {
      id: `pi-${dirName}`,
      name,
      version: "1.0.0",
      description,
      tier: main ? "power" : "safe",
      main,
      contributes: {
        mcpTools: tools.length > 0 ? tools : void 0
      },
      permissions: ["shell:exec"],
      _path: dir,
      _enabled: true,
      _adapter: "pi-skill"
    };
  }
};
function extractToolsFromSkillMd(md, dirName) {
  const tools = [];
  const codeBlocks = md.matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g);
  const commands = /* @__PURE__ */ new Set();
  for (const match of codeBlocks) {
    const lines = match[1].trim().split("\n");
    for (const line of lines) {
      const cmd = line.replace(/^\$\s*/, "").trim();
      if (cmd && !cmd.startsWith("#") && cmd.length < 80) {
        commands.add(cmd.split(/\s+/)[0]);
      }
    }
  }
  for (const cmd of commands) {
    if (["cd", "echo", "cat", "ls", "mkdir"].includes(cmd)) continue;
    tools.push({
      name: `pi_${dirName}_${cmd}`.replace(/[^a-zA-Z0-9_]/g, "_"),
      description: `Run ${cmd} from pi skill: ${dirName}`,
      inputSchema: {
        type: "object",
        properties: {
          args: { type: "string", description: "Arguments to pass to the command" }
        }
      }
    });
  }
  return tools;
}
const openclawAdapter = {
  name: "openclaw",
  async canLoad(dir) {
    try {
      await fs.promises.access(path$1.join(dir, "openclaw.json"));
      return true;
    } catch {
      try {
        await fs.promises.access(path$1.join(dir, ".openclaw", "config.json"));
        return true;
      } catch {
        return false;
      }
    }
  },
  async toManifest(dir) {
    const dirName = path$1.basename(dir);
    let config;
    try {
      const raw = await fs.promises.readFile(path$1.join(dir, "openclaw.json"), "utf8");
      config = JSON.parse(raw);
    } catch {
      const raw = await fs.promises.readFile(path$1.join(dir, ".openclaw", "config.json"), "utf8");
      config = JSON.parse(raw);
    }
    const mcpTools = (config.tools ?? []).map((tool) => ({
      name: `oc_${dirName}_${tool.name}`.replace(/[^a-zA-Z0-9_]/g, "_"),
      description: tool.description,
      inputSchema: {
        type: "object",
        properties: tool.parameters ?? {}
      }
    }));
    const tiles = (config.ui ?? []).map((ui) => ({
      type: `ext:oc-${dirName}-${ui.name}`,
      label: ui.title,
      icon: "🦀",
      entry: ui.entry,
      defaultSize: { w: 500, h: 400 },
      minSize: { w: 300, h: 200 }
    }));
    return {
      id: `openclaw-${dirName}`,
      name: config.name ?? dirName,
      version: config.version ?? "1.0.0",
      description: config.description ?? `OpenClaw extension: ${dirName}`,
      tier: mcpTools.length > 0 ? "power" : "safe",
      contributes: {
        tiles: tiles.length > 0 ? tiles : void 0,
        mcpTools: mcpTools.length > 0 ? mcpTools : void 0
      },
      _path: dir,
      _enabled: true,
      _adapter: "openclaw"
    };
  }
};
const adapters = [
  raycastAdapter,
  piAdapter,
  openclawAdapter
];
async function tryAdaptExtension(dir) {
  for (const adapter of adapters) {
    try {
      if (await adapter.canLoad(dir)) {
        const manifest = await adapter.toManifest(dir);
        if (adapter.wrapEntry) {
          await adapter.wrapEntry(dir, manifest);
        }
        console.log(`[Extensions] Adapted ${dir} via ${adapter.name} adapter`);
        return manifest;
      }
    } catch (err) {
      console.warn(`[Extensions] Adapter ${adapter.name} failed for ${dir}:`, err);
    }
  }
  return null;
}
const DISABLED_EXTS_PATH = path$1.join(CONTEX_HOME, "disabled-extensions.json");
const ENABLED_CATALOG_PATH = path$1.join(CONTEX_HOME, "enabled-catalog-extensions.json");
async function loadDisabledSet() {
  try {
    const raw = await fs.promises.readFile(DISABLED_EXTS_PATH, "utf8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function saveDisabledSet(ids) {
  await fs.promises.mkdir(CONTEX_HOME, { recursive: true });
  await fs.promises.writeFile(DISABLED_EXTS_PATH, JSON.stringify([...ids], null, 2));
}
async function loadEnabledCatalogSet() {
  try {
    const raw = await fs.promises.readFile(ENABLED_CATALOG_PATH, "utf8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function saveEnabledCatalogSet(ids) {
  await fs.promises.mkdir(CONTEX_HOME, { recursive: true });
  await fs.promises.writeFile(ENABLED_CATALOG_PATH, JSON.stringify([...ids], null, 2));
}
const EXTENSIONS_DIRNAME = "extensions";
function normalizeManifestUi(manifest) {
  manifest.ui = manifest.ui ?? {};
  if (!manifest.ui.mode) {
    manifest.ui.mode = manifest.tier === "safe" ? "native" : "custom";
  }
}
class ExtensionRegistry {
  extensions = /* @__PURE__ */ new Map();
  extraMCPTools = [];
  activeWorkspacePath = null;
  disabledIds = /* @__PURE__ */ new Set();
  enabledCatalogIds = /* @__PURE__ */ new Set();
  bundledDirs;
  /** Catalog dirs: scanned for manifests but extensions default to DISABLED
   *  so their power-tier main scripts do not execute. They appear in the
   *  gallery as available-to-install entries. */
  catalogDirs;
  constructor(opts) {
    this.bundledDirs = (opts?.bundledDirs ?? []).filter(Boolean);
    this.catalogDirs = (opts?.catalogDirs ?? []).filter(Boolean);
  }
  async scan() {
    this.disabledIds = await loadDisabledSet();
    this.enabledCatalogIds = await loadEnabledCatalogSet();
    for (const bundledDir of this.bundledDirs) {
      await this.scanDir(bundledDir);
    }
    const globalDir = path$1.join(CONTEX_HOME, EXTENSIONS_DIRNAME);
    await this.scanDir(globalDir);
    for (const catalogDir of this.catalogDirs) {
      await this.scanDir(catalogDir, { defaultEnabled: false });
    }
  }
  async scanWorkspace(workspacePath) {
    const wsDir = path$1.join(workspacePath, ".contex", EXTENSIONS_DIRNAME);
    await this.scanDir(wsDir);
  }
  async rescan(workspacePath) {
    this.deactivateAll();
    this.extensions.clear();
    this.extraMCPTools = [];
    this.activeWorkspacePath = workspacePath ?? null;
    await this.scan();
    if (workspacePath) {
      await this.scanWorkspace(workspacePath);
    }
  }
  async scanLightweight(workspacePath) {
    const disabledIds = await loadDisabledSet();
    const manifests = /* @__PURE__ */ new Map();
    const targetWorkspacePath = workspacePath ?? this.activeWorkspacePath;
    for (const bundledDir of this.bundledDirs) {
      await this.scanDirLight(bundledDir, manifests, disabledIds);
    }
    await this.scanDirLight(path$1.join(CONTEX_HOME, EXTENSIONS_DIRNAME), manifests, disabledIds);
    if (targetWorkspacePath) {
      await this.scanDirLight(path$1.join(targetWorkspacePath, ".contex", EXTENSIONS_DIRNAME), manifests, disabledIds);
    }
    for (const catalogDir of this.catalogDirs) {
      await this.scanDirLight(catalogDir, manifests, disabledIds, { defaultEnabled: false });
    }
    return [...manifests.values()];
  }
  getActiveWorkspacePath() {
    return this.activeWorkspacePath;
  }
  async scanDir(dir, opts) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const extDir = path$1.join(dir, name);
      const stat = await fs.promises.stat(extDir).catch(() => null);
      if (!stat?.isDirectory()) continue;
      try {
        await this.loadExtension(extDir, opts);
      } catch {
        try {
          const adapted = await tryAdaptExtension(extDir);
          if (adapted) {
            await this.loadFromManifest(adapted, opts);
          }
        } catch (err) {
          console.error(`[Extensions] Failed to load ${extDir}:`, err);
        }
      }
    }
  }
  async scanDirLight(dir, manifests, disabledIds, opts) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const extDir = path$1.join(dir, name);
      const stat = await fs.promises.stat(extDir).catch(() => null);
      if (!stat?.isDirectory()) continue;
      const manifest = await this.readManifestLight(extDir, disabledIds, opts);
      if (!manifest) continue;
      if (manifests.has(manifest.id)) continue;
      manifests.set(manifest.id, manifest);
    }
  }
  async readManifestLight(extDir, disabledIds, opts) {
    try {
      const raw = await fs.promises.readFile(path$1.join(extDir, "extension.json"), "utf8");
      const manifest = JSON.parse(raw);
      if (!manifest.id || !manifest.name || !manifest.version) {
        return null;
      }
      if (!manifest.tier) manifest.tier = "safe";
      normalizeManifestUi(manifest);
      manifest._path = path$1.resolve(extDir);
      const defaultEnabled = opts?.defaultEnabled !== false;
      manifest._enabled = disabledIds.has(manifest.id) ? false : defaultEnabled ? manifest._enabled !== false : false;
      if (manifest.contributes?.tiles) {
        for (const tile of manifest.contributes.tiles) {
          if (!tile.type.startsWith("ext:")) {
            tile.type = `ext:${tile.type}`;
          }
        }
      }
      return manifest;
    } catch {
      try {
        let adapted = null;
        for (const adapter of adapters) {
          if (await adapter.canLoad(extDir)) {
            adapted = await adapter.toManifest(extDir);
            break;
          }
        }
        if (!adapted) return null;
        normalizeManifestUi(adapted);
        adapted._path = path$1.resolve(extDir);
        const defaultEnabledAdapted = opts?.defaultEnabled !== false;
        adapted._enabled = disabledIds.has(adapted.id) ? false : defaultEnabledAdapted ? adapted._enabled !== false : false;
        if (adapted.contributes?.tiles) {
          for (const tile of adapted.contributes.tiles) {
            if (!tile.type.startsWith("ext:")) {
              tile.type = `ext:${tile.type}`;
            }
          }
        }
        return adapted;
      } catch {
        return null;
      }
    }
  }
  async loadExtension(extDir, opts) {
    const manifestPath = path$1.join(extDir, "extension.json");
    const raw = await fs.promises.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error(`Invalid manifest in ${extDir}: missing id, name, or version`);
    }
    if (!manifest.tier) manifest.tier = "safe";
    normalizeManifestUi(manifest);
    manifest._path = path$1.resolve(extDir);
    const defaultEnabled = opts?.defaultEnabled !== false;
    const catalogUserEnabled = !defaultEnabled && this.enabledCatalogIds.has(manifest.id);
    manifest._enabled = this.disabledIds.has(manifest.id) ? false : defaultEnabled ? manifest._enabled !== false : catalogUserEnabled;
    if (manifest.contributes?.tiles) {
      for (const tile of manifest.contributes.tiles) {
        if (!tile.type.startsWith("ext:")) {
          tile.type = `ext:${tile.type}`;
        }
      }
    }
    if (this.extensions.has(manifest.id) && opts?.defaultEnabled === false) {
      return;
    }
    if (this.extensions.has(manifest.id)) {
      const existing = this.extensions.get(manifest.id);
      if (existing.deactivate) existing.deactivate();
      this.extensions.delete(manifest.id);
    }
    const loaded = { manifest };
    if (manifest.tier === "power" && manifest.main && manifest._enabled) {
      const ctx = new ExtensionContext(manifest, bus, this);
      const deactivate = await loadPowerExtension(manifest, ctx);
      loaded.deactivate = deactivate ?? void 0;
      for (const tool of ctx.getRegisteredTools()) {
        this.extraMCPTools.push({ ...tool, extId: manifest.id });
      }
    }
    this.extensions.set(manifest.id, loaded);
    console.log(`[Extensions] Loaded: ${manifest.name} v${manifest.version} (${manifest.tier})`);
  }
  /** Load an already-parsed manifest (used by adapters) */
  async loadFromManifest(manifest, opts) {
    if (this.extensions.has(manifest.id)) return;
    normalizeManifestUi(manifest);
    const defaultEnabled = opts?.defaultEnabled !== false;
    if (this.disabledIds.has(manifest.id)) manifest._enabled = false;
    else if (!defaultEnabled) manifest._enabled = false;
    if (manifest.contributes?.tiles) {
      for (const tile of manifest.contributes.tiles) {
        if (!tile.type.startsWith("ext:")) {
          tile.type = `ext:${tile.type}`;
        }
      }
    }
    const loaded = { manifest };
    if (manifest.tier === "power" && manifest.main && manifest._enabled && manifest._path) {
      const ctx = new ExtensionContext(manifest, bus, this);
      const deactivate = await loadPowerExtension(manifest, ctx);
      loaded.deactivate = deactivate ?? void 0;
      for (const tool of ctx.getRegisteredTools()) {
        this.extraMCPTools.push({ ...tool, extId: manifest.id });
      }
    }
    this.extensions.set(manifest.id, loaded);
    console.log(`[Extensions] Loaded (adapted): ${manifest.name} v${manifest.version}`);
  }
  // ── Queries ──────────────────────────────────────────────────────────────
  getAll() {
    return [...this.extensions.values()].map((e) => e.manifest);
  }
  get(id) {
    return this.extensions.get(id);
  }
  getTileTypes() {
    const tiles = [];
    for (const ext of this.extensions.values()) {
      if (!ext.manifest._enabled) continue;
      if (ext.manifest.contributes?.tiles) {
        for (const tile of ext.manifest.contributes.tiles) {
          tiles.push({ ...tile, extId: ext.manifest.id, uiMode: ext.manifest.ui?.mode });
        }
      }
    }
    return tiles;
  }
  getChatSurfaces() {
    const surfaces = [];
    for (const ext of this.extensions.values()) {
      if (!ext.manifest._enabled) continue;
      if (ext.manifest.contributes?.chatSurfaces) {
        for (const surface of ext.manifest.contributes.chatSurfaces) {
          surfaces.push({ ...surface, extId: ext.manifest.id, uiMode: ext.manifest.ui?.mode });
        }
      }
    }
    return surfaces;
  }
  getExtensionActions() {
    const result = /* @__PURE__ */ new Map();
    for (const ext of this.extensions.values()) {
      if (!ext.manifest._enabled) continue;
      const contributes = ext.manifest.contributes;
      const actions = contributes?.actions;
      if (Array.isArray(actions) && actions.length > 0) {
        result.set(ext.manifest.id, actions.map((a) => ({ name: String(a.name ?? ""), description: String(a.description ?? "") })));
      }
    }
    return result;
  }
  getMCPTools() {
    const tools = [];
    for (const ext of this.extensions.values()) {
      if (!ext.manifest._enabled) continue;
      if (ext.manifest.contributes?.mcpTools) {
        for (const tool of ext.manifest.contributes.mcpTools) {
          tools.push({ ...tool, extId: ext.manifest.id });
        }
      }
    }
    tools.push(...this.extraMCPTools);
    return tools;
  }
  getContextMenuItems() {
    const items = [];
    for (const ext of this.extensions.values()) {
      if (!ext.manifest._enabled) continue;
      if (ext.manifest.contributes?.contextMenu) {
        for (const item of ext.manifest.contributes.contextMenu) {
          items.push({ ...item, extId: ext.manifest.id });
        }
      }
    }
    return items;
  }
  getTileEntry(extId, tileType, tileId) {
    const ext = this.extensions.get(extId);
    if (!ext?.manifest._path || !ext.manifest._enabled) return null;
    const tile = ext.manifest.contributes?.tiles?.find((t) => t.type === tileType);
    if (!tile) return null;
    const entrySegments = tile.entry.split(/[\\/]/).filter(Boolean).map((segment) => encodeURIComponent(segment));
    const query = tileId ? `?tileId=${encodeURIComponent(tileId)}&_t=${Date.now()}` : "";
    return `contex-ext://extension/${encodeURIComponent(extId)}/${entrySegments.join("/")}${query}`;
  }
  getChatSurfaceEntry(extId, surfaceId, instanceId) {
    const ext = this.extensions.get(extId);
    if (!ext?.manifest._path || !ext.manifest._enabled) return null;
    const surface = ext.manifest.contributes?.chatSurfaces?.find((s) => s.id === surfaceId);
    if (!surface) return null;
    const entrySegments = surface.entry.split(/[\\/]/).filter(Boolean).map((segment) => encodeURIComponent(segment));
    const params = [];
    if (instanceId) params.push(`surfaceId=${encodeURIComponent(instanceId)}`);
    params.push(`surfaceKind=chat`);
    params.push(`_t=${Date.now()}`);
    const query = `?${params.join("&")}`;
    return `contex-ext://extension/${encodeURIComponent(extId)}/${entrySegments.join("/")}${query}`;
  }
  // ── Lifecycle ────────────────────────────────────────────────────────────
  /** Is this extension's path under one of the registered catalog dirs? */
  isCatalogExtension(manifest) {
    if (!manifest._path) return false;
    const p = path$1.resolve(manifest._path);
    return this.catalogDirs.some((dir) => {
      const root = path$1.resolve(dir);
      return p === root || p.startsWith(root + "/") || p.startsWith(root + "\\");
    });
  }
  async enable(id) {
    const ext = this.extensions.get(id);
    if (!ext) return false;
    ext.manifest._enabled = true;
    this.disabledIds.delete(id);
    const isCatalog = this.isCatalogExtension(ext.manifest);
    if (isCatalog) {
      this.enabledCatalogIds.add(id);
    }
    await Promise.allSettled([
      saveDisabledSet(this.disabledIds),
      isCatalog ? saveEnabledCatalogSet(this.enabledCatalogIds) : Promise.resolve()
    ]);
    const m = ext.manifest;
    if (m.tier === "power" && m.main && !ext.deactivate && m._path) {
      try {
        const ctx = new ExtensionContext(m, bus, this);
        const deactivate = await loadPowerExtension(m, ctx);
        ext.deactivate = deactivate ?? void 0;
        for (const tool of ctx.getRegisteredTools()) {
          this.extraMCPTools.push({ ...tool, extId: m.id });
        }
      } catch (err) {
        console.error(`[Extensions] enable() failed to load power ext ${m.id}:`, err);
      }
    }
    return true;
  }
  async disable(id) {
    const ext = this.extensions.get(id);
    if (!ext) return false;
    ext.manifest._enabled = false;
    this.disabledIds.add(id);
    const isCatalog = this.isCatalogExtension(ext.manifest);
    if (isCatalog) {
      this.enabledCatalogIds.delete(id);
    }
    await Promise.allSettled([
      saveDisabledSet(this.disabledIds),
      isCatalog ? saveEnabledCatalogSet(this.enabledCatalogIds) : Promise.resolve()
    ]);
    if (ext.deactivate) {
      ext.deactivate();
      ext.deactivate = void 0;
    }
    this.extraMCPTools = this.extraMCPTools.filter((t) => t.extId !== id);
    return true;
  }
  deactivateAll() {
    for (const ext of this.extensions.values()) {
      if (ext.deactivate) ext.deactivate();
    }
  }
  /** Register a programmatic MCP tool (called from ExtensionContext) */
  registerMCPTool(extId, tool) {
    this.extraMCPTools.push({ ...tool, extId });
  }
}
function getBridgeScript(tileId, extId) {
  return `
;(function() {
  const _tileId = ${JSON.stringify(tileId)};
  const _extId = ${JSON.stringify(extId)};
  let _reqId = 0;
  const _pending = new Map();
  const _listeners = new Map();
  const _actionHandlers = new Map();

  function _rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++_reqId;
      const timeoutMs = method === 'ext.invoke' ? 15 * 60 * 1000 : 10000;
      _pending.set(id, { resolve, reject });
      window.parent.postMessage({
        type: 'contex-rpc',
        id,
        method,
        params: params ?? null,
        tileId: _tileId,
        extId: _extId,
      }, '*');
      setTimeout(() => {
        if (_pending.has(id)) {
          _pending.delete(id);
          reject(new Error('RPC timeout: ' + method));
        }
      }, timeoutMs);
    });
  }

  function _on(event, cb) {
    if (!_listeners.has(event)) _listeners.set(event, []);
    _listeners.get(event).push(cb);
    return () => {
      const arr = _listeners.get(event);
      if (arr) {
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  function _emit(event, data) {
    const cbs = _listeners.get(event);
    if (cbs) cbs.forEach(cb => { try { cb(data); } catch(e) { console.error('[contex bridge]', e); } });
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    // Theme CSS variable injection from host
    if (msg.type === 'contex-theme-vars' && msg.vars) {
      var style = document.getElementById('__contex_theme__');
      if (!style) {
        style = document.createElement('style');
        style.id = '__contex_theme__';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = ':root{' + Object.entries(msg.vars).map(function(e) { return e[0]+':'+e[1]; }).join(';') + '}';
      var mode = String(msg.vars['--ct-mode'] || '').replace(/"/g, '');
      if (mode) {
        document.documentElement.setAttribute('data-ct-mode', mode);
        document.documentElement.style.colorScheme = mode;
      }
      return;
    }

    // RPC response
    if (msg.type === 'contex-rpc-response' && msg.id) {
      const p = _pending.get(msg.id);
      if (p) {
        _pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error));
        else p.resolve(msg.result);
      }
      return;
    }

    // Event push from host
    if (msg.type === 'contex-event') {
      _emit(msg.event, msg.data);
      return;
    }

    // Action invocation from a connected peer
    if (msg.type === 'contex-action-invoke') {
      console.log('[contex bridge] action invoke:', msg.action, 'registered:', Array.from(_actionHandlers.keys()));
      var handler = _actionHandlers.get(msg.action);
      if (handler) {
        Promise.resolve().then(function() { return handler(msg.params || {}); }).then(function(result) {
          window.parent.postMessage({ type: 'contex-action-result', requestId: msg.requestId, tileId: _tileId, result: result }, '*');
        }).catch(function(err) {
          window.parent.postMessage({ type: 'contex-action-result', requestId: msg.requestId, tileId: _tileId, error: err.message || String(err) }, '*');
        });
      } else {
        window.parent.postMessage({ type: 'contex-action-result', requestId: msg.requestId, tileId: _tileId, error: 'Unknown action: ' + msg.action }, '*');
      }
      return;
    }
  });

  window.contex = {
    tileId: _tileId,
    extId: _extId,

    tile: {
      getState: (key) => _rpc('tile.getState', { key: key ?? null }),
      setState: (keyOrData, maybeValue) => {
        if (typeof keyOrData === 'string') {
          return _rpc('tile.setState', { key: keyOrData, value: maybeValue });
        }
        return _rpc('tile.setState', { data: keyOrData });
      },
      getSize: () => _rpc('tile.getSize'),
      onResize: (cb) => _on('tile.resize', cb),
      getMeta: () => _rpc('tile.getMeta'),
    },

    bus: {
      publish: (channel, type, payload) => _rpc('bus.publish', { channel, type, payload }),
      subscribe: (channel, cb) => {
        _on('bus.event.' + channel, cb);
        _on('bus.event.*', (evt) => {
          if (evt && evt.channel === channel) cb(evt);
        });
        return _rpc('bus.subscribe', { channel });
      },
    },

    canvas: {
      createTile: (type, opts) => _rpc('canvas.createTile', { type, ...(opts || {}) }),
      listTiles: () => _rpc('canvas.listTiles'),
    },

    settings: {
      get: (key) => _rpc('settings.get', { key }),
      set: (settings) => _rpc('settings.set', settings),
    },

    ext: {
      invoke: (method, ...args) => _rpc('ext.invoke', { method, args }),
    },

    workspace: {
      getPath: () => _rpc('workspace.getPath'),
    },

    chat: {
      send: (request) => _rpc('chat.send', { request }),
      stop: (cardId) => _rpc('chat.stop', { cardId }),
      clearSession: (cardId) => _rpc('chat.clearSession', { cardId }),
      onStream: (cb) => _on('chat.stream', cb),
    },

    relay: {
      init: () => _rpc('relay.init'),
      listParticipants: () => _rpc('relay.listParticipants'),
      listChannels: () => _rpc('relay.listChannels'),
      listCentralFeed: (limit) => _rpc('relay.listCentralFeed', { limit }),
      listMessages: (participantId, mailbox, limit) => _rpc('relay.listMessages', { participantId, mailbox, limit }),
      readMessage: (participantId, mailbox, filename) => _rpc('relay.readMessage', { participantId, mailbox, filename }),
      sendDirectMessage: (from, draft) => _rpc('relay.sendDirectMessage', { from, draft }),
      sendChannelMessage: (from, draft) => _rpc('relay.sendChannelMessage', { from, draft }),
      setWorkContext: (participantId, work) => _rpc('relay.setWorkContext', { participantId, work }),
      analyzeRelationships: () => _rpc('relay.analyzeRelationships'),
      spawnAgent: (request) => _rpc('relay.spawnAgent', { request }),
      stopAgent: (participantId) => _rpc('relay.stopAgent', { participantId }),
      waitForReady: (ids, timeoutMs) => _rpc('relay.waitForReady', { ids, timeoutMs }),
      waitForAny: (ids, timeoutMs) => _rpc('relay.waitForAny', { ids, timeoutMs }),
      onEvent: (cb) => _on('relay.event', cb),
    },

    theme: {
      getColors: () => _rpc('theme.getColors'),
      onChanged: (cb) => {
        const offA = _on('theme.change', cb)
        const offB = _on('theme.changed', cb)
        return () => { offA(); offB(); }
      },
    },

    actions: {
      register: (name, description, handler) => {
        _actionHandlers.set(name, handler);
        return _rpc('actions.register', { name, description: description || '' });
      },
      invoke: (peerId, action, params) => _rpc('actions.invoke', { peerId, action, params: params || {} }),
      list: () => Array.from(_actionHandlers.keys()),
    },

    context: {
      get: (key) => _rpc('context.get', { key }),
      set: (key, value) => _rpc('context.set', { key, value }),
      getAll: (tagPrefix) => _rpc('context.getAll', { tagPrefix }),
      delete: (key) => _rpc('context.delete', { key }),
      getPeerContext: (peerId, tagPrefix) => _rpc('context.getPeerContext', { peerId, tagPrefix }),
      getAllPeerContext: (tagPrefix) => _rpc('context.getAllPeerContext', { tagPrefix }),
      onChanged: (cb) => _on('context.changed', cb),
      onPeerContextChanged: (cb) => _on('context.peerChanged', cb),
    },

    // Chat surface API — extensions that contribute a "chatSurfaces" entry
    // mount above the chat composer. setPayload caches the current payload
    // with the host; when the user sends, the host emits 'surface.requestFlush'
    // and the extension should respond with setPayload({ kind, data, ... }).
    surface: {
      /**
       * Cache the current outgoing payload on the host.
       *   payload = { kind: 'image'|'text', data: base64-or-string, mime?: string, ext?: string }
       */
      setPayload: (payload) => _rpc('surface.setPayload', { payload: payload || null }),
      clear: () => _rpc('surface.setPayload', { payload: null }),
      onRequestFlush: (cb) => _on('surface.requestFlush', cb),
      onClear: (cb) => _on('surface.clear', cb),
    },
  };

  // Inject base component stylesheet (uses --ct-* vars; structural styles baked in at load time)
  (function() {
    var baseStyle = document.createElement('style');
    baseStyle.id = '__contex_base__';
    baseStyle.textContent = [
      '*,*::before,*::after{box-sizing:border-box}',
      'html,body{margin:0;padding:0;font-family:var(--ct-font-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif);font-size:var(--ct-font-size,13px);line-height:var(--ct-font-line,1.5);font-weight:var(--ct-font-weight,400);color:var(--ct-text,#111);background:var(--ct-bg,transparent)}',
      'a{color:var(--ct-accent,#4f46e5);text-decoration:none}',
      'a:hover{text-decoration:underline}',
      'button{cursor:pointer;background:var(--ct-panel,rgba(0,0,0,.06));color:var(--ct-text,#111);border:1px solid var(--ct-border,rgba(0,0,0,.12));border-radius:var(--ct-radius,6px);padding:5px 12px;font-size:var(--ct-font-size,13px);font-family:var(--ct-font-sans,inherit);transition:background 0.15s,opacity 0.15s;outline:none}',
      'button:hover:not(:disabled){background:var(--ct-hover,rgba(0,0,0,.1))}',
      'button:disabled{opacity:0.45;cursor:default}',
      'button.primary,button[data-primary]{background:var(--ct-accent,#4f46e5);color:#fff;border-color:transparent}',
      'button.primary:hover:not(:disabled),button[data-primary]:hover:not(:disabled){opacity:0.88}',
      'button.danger,button[data-danger]{background:rgba(220,38,38,.1);color:#dc2626;border-color:rgba(220,38,38,.25)}',
      'button.danger:hover:not(:disabled),button[data-danger]:hover:not(:disabled){background:rgba(220,38,38,.18)}',
      'input,textarea,select{background:var(--ct-panel,rgba(0,0,0,.04));color:var(--ct-text,#111);border:1px solid var(--ct-border,rgba(0,0,0,.12));border-radius:var(--ct-radius,6px);padding:5px 10px;font-size:var(--ct-font-size,13px);font-family:var(--ct-font-sans,inherit);outline:none;transition:border-color 0.15s,box-shadow 0.15s}',
      'input:focus,textarea:focus,select:focus{border-color:var(--ct-accent,#4f46e5);box-shadow:0 0 0 2px var(--ct-accent-s,rgba(79,70,229,.15))}',
      'input::placeholder,textarea::placeholder{color:var(--ct-dim,#888)}',
      'select option{background:var(--ct-panel,#fff);color:var(--ct-text,#111)}',
      'label{color:var(--ct-text,#111);font-size:var(--ct-font-subtle-size,var(--ct-font-secondary-size,12px));font-family:var(--ct-font-subtle,var(--ct-font-secondary,var(--ct-font-sans,inherit)));line-height:var(--ct-font-subtle-line,var(--ct-font-secondary-line,1.4));font-weight:var(--ct-font-subtle-weight,var(--ct-font-secondary-weight,500))}',
      'hr{border:none;border-top:1px solid var(--ct-border,rgba(0,0,0,.1));margin:12px 0}',
      '::-webkit-scrollbar{width:6px;height:6px}',
      '::-webkit-scrollbar-track{background:transparent}',
      '::-webkit-scrollbar-thumb{background:var(--ct-border,rgba(0,0,0,.2));border-radius:3px}',
      '::-webkit-scrollbar-thumb:hover{background:var(--ct-muted,rgba(0,0,0,.35))}',
      '.ct-card{background:var(--ct-panel,rgba(0,0,0,.04));border:1px solid var(--ct-border,rgba(0,0,0,.1));border-radius:var(--ct-radius,8px);padding:12px}',
      '.ct-card-2{background:var(--ct-panel-2,var(--ct-panel,rgba(0,0,0,.06)));border:1px solid var(--ct-border,rgba(0,0,0,.1));border-radius:var(--ct-radius,8px);padding:12px}',
      '.ct-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:var(--ct-font-subtle-size,var(--ct-font-secondary-size,11px));font-family:var(--ct-font-subtle,var(--ct-font-secondary,var(--ct-font-sans,inherit)));line-height:var(--ct-font-subtle-line,var(--ct-font-secondary-line,1.4));font-weight:var(--ct-font-subtle-weight,var(--ct-font-secondary-weight,500));background:var(--ct-accent-s,rgba(79,70,229,.1));color:var(--ct-accent,#4f46e5)}',
      '.ct-toolbar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--ct-border,rgba(0,0,0,.1))}',
      '.ct-toolbar-title{font-family:var(--ct-font-title,var(--ct-font-sans,inherit));font-size:var(--ct-font-title-size,13px);font-weight:var(--ct-font-title-weight,700);color:var(--ct-text,#111)}',
      '.ct-section{display:flex;flex-direction:column;gap:8px;padding:12px}',
      '.ct-list{display:flex;flex-direction:column;gap:6px}',
      '.ct-list-row{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--ct-panel,rgba(0,0,0,.04));border:1px solid var(--ct-border,rgba(0,0,0,.1));border-radius:var(--ct-radius,8px)}',
      '.ct-empty{display:flex;align-items:center;justify-content:center;min-height:96px;color:var(--ct-dim,#999);text-align:center}',
      '.ct-stat{display:flex;flex-direction:column;gap:2px;padding:10px 12px;background:var(--ct-panel-2,var(--ct-panel,rgba(0,0,0,.06)));border:1px solid var(--ct-border,rgba(0,0,0,.1));border-radius:var(--ct-radius,8px)}',
      '.ct-stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ct-dim,#999);font-family:var(--ct-font-subtle,var(--ct-font-sans,inherit))}',
      '.ct-stat-value{font-size:20px;font-weight:700;color:var(--ct-text,#111);font-variant-numeric:tabular-nums;font-family:var(--ct-font-title,var(--ct-font-sans,inherit))}',
      '.ct-kbd{display:inline-flex;align-items:center;padding:1px 6px;border-radius:6px;background:var(--ct-panel-2,var(--ct-panel,rgba(0,0,0,.06)));border:1px solid var(--ct-border,rgba(0,0,0,.1));font-size:11px;font-family:var(--ct-font-mono,monospace)}',
      '.ct-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:var(--ct-panel-2,var(--ct-panel,rgba(0,0,0,.06)));border:1px solid var(--ct-border,rgba(0,0,0,.1));font-size:var(--ct-font-subtle-size,var(--ct-font-secondary-size,11px));font-family:var(--ct-font-subtle,var(--ct-font-secondary,var(--ct-font-sans,inherit)));line-height:var(--ct-font-subtle-line,var(--ct-font-secondary-line,1.4));font-weight:var(--ct-font-subtle-weight,var(--ct-font-secondary-weight,400))}',
      '.ct-success{color:var(--ct-success,#1f8f5f)}',
      '.ct-warning{color:var(--ct-warning,#c07b12)}',
      '.ct-danger{color:var(--ct-danger,#dc2626)}',
      '.ct-muted{color:var(--ct-muted,#666)}',
      '.ct-dim{color:var(--ct-dim,#999)}',
    ].join('');
    (document.head || document.documentElement).appendChild(baseStyle);
  })();

  // Signal ready
  window.parent.postMessage({ type: 'contex-bridge-ready', tileId: _tileId, extId: _extId }, '*');
})();
`;
}
const MIME_TYPES = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};
function serveFile(filePath) {
  const ext = path$1.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  return fs.promises.readFile(filePath).then(
    (buf) => new Response(buf, {
      status: 200,
      headers: {
        "content-type": mime,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*"
      }
    }),
    () => new Response("Not found", { status: 404 })
  );
}
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "contex-ext",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);
function injectBridge(html, bridgeScript) {
  const tag = `<script>${bridgeScript}<\/script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}
${tag}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (match) => `${match}
${tag}`);
  }
  return `${tag}
${html}`;
}
function isPathInside(root, candidate) {
  const resolvedRoot = path$1.resolve(root);
  const resolvedCandidate = path$1.resolve(candidate);
  const rel = path$1.relative(resolvedRoot, resolvedCandidate);
  return rel === "" || !rel.startsWith("..") && !path$1.isAbsolute(rel);
}
function isExtensionResourcePath(registry, candidate) {
  return registry.getAll().some((ext) => {
    const root = ext._path;
    return Boolean(root && ext._enabled !== false && isPathInside(root, candidate));
  });
}
function registerExtensionProtocol(registry) {
  electron.protocol.handle("contex-ext", async (request) => {
    try {
      const url$1 = new URL(request.url);
      const segments = url$1.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
      const [firstSegment, ...restSegments] = segments;
      if (firstSegment === "__runext_resource__") {
        const absPath = path$1.resolve("/" + restSegments.join("/"));
        if (!isExtensionResourcePath(registry, absPath)) {
          return new Response("Forbidden", { status: 403 });
        }
        if (!fs.existsSync(absPath)) {
          return new Response("Resource not found", { status: 404 });
        }
        return serveFile(absPath);
      }
      if (firstSegment === "__runext_codicons__") {
        const codiconBase = path$1.join(__dirname, "..", "..", "node_modules", "@vscode", "codicons");
        const candidates = [
          path$1.join(codiconBase, ...restSegments),
          path$1.join("/Users/jkneen/clawd/runext/node_modules/@vscode/codicons", ...restSegments)
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            return serveFile(candidate);
          }
        }
        return new Response("Codicon resource not found", { status: 404 });
      }
      const extId = firstSegment;
      const fileSegments = restSegments;
      if (!extId || fileSegments.length === 0) {
        return new Response("Invalid extension URL", { status: 400 });
      }
      const ext = registry.get(extId);
      const root = ext?.manifest._path;
      if (!root || ext?.manifest._enabled === false) {
        return new Response("Extension not found", { status: 404 });
      }
      const filePath = path$1.join(root, ...fileSegments);
      const rel = path$1.relative(root, filePath);
      if (!rel || rel.startsWith("..") || path$1.isAbsolute(rel)) {
        return new Response("Forbidden", { status: 403 });
      }
      if (/\.html?$/i.test(filePath)) {
        const raw = await fs.promises.readFile(filePath, "utf8");
        const tileId = url$1.searchParams.get("tileId") || url$1.searchParams.get("surfaceId");
        const html = tileId ? injectBridge(raw, getBridgeScript(tileId, extId)) : raw;
        return new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, no-cache, must-revalidate"
          }
        });
      }
      const resp = await electron.net.fetch(url.pathToFileURL(filePath).toString());
      const headers = new Headers(resp.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(`Extension load failed: ${message}`, { status: 500 });
    }
  });
}
const execFileAsync = util.promisify(child_process.execFile);
const EXTENSIONS_DIR = path$1.join(CONTEX_HOME, "extensions");
function extensionSettingsPath(extId) {
  return path$1.join(CONTEX_HOME, "extension-settings", `${extId}.json`);
}
async function readExtensionSettings(registry, extId) {
  const ext = registry.get(extId);
  if (!ext) return {};
  const defaults = {};
  for (const s of ext.manifest.contributes?.settings ?? []) {
    defaults[s.key] = s.default;
  }
  try {
    const raw = await fs.promises.readFile(extensionSettingsPath(extId), "utf8");
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}
function registerExtensionIPC(registry) {
  let lastScannedWorkspacePath = null;
  let hasScanned = false;
  const ensureLoaded = async (workspacePath, force = false) => {
    const settings = readSettingsSync();
    if (settings.extensionsDisabled) {
      lastScannedWorkspacePath = null;
      hasScanned = false;
      return;
    }
    const targetWorkspacePath = workspacePath ?? registry.getActiveWorkspacePath() ?? null;
    if (!force && hasScanned && lastScannedWorkspacePath === targetWorkspacePath) return;
    await registry.rescan(targetWorkspacePath);
    lastScannedWorkspacePath = targetWorkspacePath;
    hasScanned = true;
  };
  electron.ipcMain.handle("ext:list", async () => {
    await ensureLoaded();
    return registry.getAll().map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description,
      author: m.author,
      tier: m.tier,
      ui: m.ui,
      enabled: m._enabled !== false,
      contributes: m.contributes,
      dirPath: m._path ?? null
    }));
  });
  electron.ipcMain.handle("ext:list-sidebar", async (_, workspacePath) => {
    const settings = readSettingsSync();
    if (settings.extensionsDisabled) {
      return { entries: [], tiles: [] };
    }
    const manifests = await registry.scanLightweight(workspacePath ?? registry.getActiveWorkspacePath());
    const extActions = registry.getExtensionActions();
    return {
      entries: manifests.map((m) => ({
        id: m.id,
        name: m.name,
        icon: m.contributes?.tiles?.[0]?.icon ?? m.contributes?.chatSurfaces?.[0]?.icon ?? null,
        enabled: m._enabled !== false
      })),
      tiles: manifests.filter((m) => m._enabled !== false).flatMap((m) => (m.contributes?.tiles ?? []).map((tile) => ({
        extId: m.id,
        type: tile.type,
        label: tile.label,
        icon: tile.icon,
        entry: tile.entry,
        defaultSize: tile.defaultSize ?? { w: 400, h: 300 },
        minSize: tile.minSize ?? { w: 200, h: 150 },
        uiMode: m.ui?.mode,
        actions: extActions.get(m.id)
      })))
    };
  });
  electron.ipcMain.handle("ext:list-tiles", async () => {
    await ensureLoaded();
    const extActions = registry.getExtensionActions();
    return registry.getTileTypes().map((t) => {
      const actions = extActions.get(t.extId);
      return {
        extId: t.extId,
        type: t.type,
        label: t.label,
        icon: t.icon,
        defaultSize: t.defaultSize ?? { w: 400, h: 300 },
        minSize: t.minSize ?? { w: 200, h: 150 },
        uiMode: t.uiMode,
        actions
      };
    });
  });
  electron.ipcMain.handle("ext:tile-entry", async (_, extId, tileType, tileId) => {
    await ensureLoaded();
    const url2 = registry.getTileEntry(extId, tileType, tileId);
    return url2;
  });
  electron.ipcMain.handle("ext:list-chat-surfaces", async () => {
    await ensureLoaded();
    return registry.getChatSurfaces().map((s) => ({
      extId: s.extId,
      id: s.id,
      label: s.label,
      description: s.description,
      icon: s.icon,
      entry: s.entry,
      emits: s.emits ?? "image",
      defaultHeight: s.defaultHeight ?? 260,
      minHeight: s.minHeight ?? 160,
      uiMode: s.uiMode
    }));
  });
  electron.ipcMain.handle("ext:chat-surface-entry", async (_, extId, surfaceId, instanceId) => {
    await ensureLoaded();
    return registry.getChatSurfaceEntry(extId, surfaceId, instanceId);
  });
  electron.ipcMain.handle("ext:get-bridge-script", (_, tileId, extId) => {
    return getBridgeScript(tileId, extId);
  });
  electron.ipcMain.handle("ext:enable", async (_, extId) => {
    return registry.enable(extId);
  });
  electron.ipcMain.handle("ext:disable", async (_, extId) => {
    return registry.disable(extId);
  });
  electron.ipcMain.handle("ext:refresh", async (_, workspacePath) => {
    if (readSettingsSync().extensionsDisabled) {
      console.log("[Extensions] Refresh skipped — extensions globally disabled");
      lastScannedWorkspacePath = null;
      hasScanned = false;
      return [];
    }
    await ensureLoaded(workspacePath ?? registry.getActiveWorkspacePath(), true);
    return registry.getAll().map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description,
      author: m.author,
      tier: m.tier,
      ui: m.ui,
      enabled: m._enabled !== false,
      contributes: m.contributes
    }));
  });
  electron.ipcMain.handle("ext:settings-get", async (_, extId) => {
    return readExtensionSettings(registry, extId);
  });
  electron.ipcMain.handle("ext:settings-set", async (_, extId, settings) => {
    const ext = registry.get(extId);
    if (!ext) return false;
    const allowedKeys = new Set((ext.manifest.contributes?.settings ?? []).map((setting) => setting.key));
    const filtered = Object.fromEntries(
      Object.entries(settings ?? {}).filter(([key]) => allowedKeys.has(key))
    );
    await fs.promises.mkdir(path$1.join(CONTEX_HOME, "extension-settings"), { recursive: true });
    await fs.promises.writeFile(extensionSettingsPath(extId), JSON.stringify(filtered, null, 2));
    return true;
  });
  electron.ipcMain.handle("ext:context-menu-items", () => {
    return registry.getContextMenuItems();
  });
  electron.ipcMain.handle("ext:install-vsix", async (_, vsixPath) => {
    try {
      const name = path$1.basename(vsixPath, ".vsix");
      const destDir = path$1.join(EXTENSIONS_DIR, name);
      await fs.promises.mkdir(EXTENSIONS_DIR, { recursive: true });
      await fs.promises.rm(destDir, { recursive: true, force: true }).catch(() => {
      });
      await fs.promises.mkdir(destDir, { recursive: true });
      await execFileAsync("unzip", ["-o", vsixPath, "-d", destDir]);
      const extensionSubdir = path$1.join(destDir, "extension");
      const hasExtDir = await fs.promises.stat(extensionSubdir).then((s) => s.isDirectory()).catch(() => false);
      if (hasExtDir) {
        const items = await fs.promises.readdir(extensionSubdir);
        for (const item of items) {
          await fs.promises.rename(path$1.join(extensionSubdir, item), path$1.join(destDir, item)).catch(() => {
          });
        }
        await fs.promises.rm(extensionSubdir, { recursive: true, force: true }).catch(() => {
        });
      }
      for (const junk of ["[Content_Types].xml", "_rels"]) {
        await fs.promises.rm(path$1.join(destDir, junk), { recursive: true, force: true }).catch(() => {
        });
      }
      await registry.rescan(registry.getActiveWorkspacePath());
      const all = registry.getAll();
      const installed = all.find((m) => m._path === destDir) || all.find((m) => m._path?.startsWith(destDir));
      return {
        ok: true,
        extId: installed?.id || name,
        name: installed?.name || name,
        tiles: registry.getTileTypes().filter((t) => t.extId === (installed?.id || name))
      };
    } catch (err) {
      console.error("[ext:install-vsix] Failed:", err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
const CHROME_BASE = path$1.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Google",
  "Chrome"
);
function listProfiles() {
  try {
    const localState = JSON.parse(
      fs.readFileSync(path$1.join(CHROME_BASE, "Local State"), "utf-8")
    );
    const cache = localState?.profile?.info_cache;
    if (!cache || typeof cache !== "object") return [];
    return Object.entries(cache).map(([dir, info]) => ({
      name: info.name || dir,
      dir,
      email: info.user_name || void 0,
      avatarIcon: info.avatar_icon || void 0
    }));
  } catch {
    return [];
  }
}
function profilePath(profileDir) {
  return path$1.join(CHROME_BASE, profileDir);
}
let cachedPassword = null;
function getChromeKeychainPassword() {
  if (cachedPassword) return Promise.resolve(cachedPassword);
  if (process.platform !== "darwin") {
    return Promise.reject(new Error("Chrome keychain access is only supported on macOS"));
  }
  return new Promise((resolve, reject) => {
    child_process.execFile("security", [
      "find-generic-password",
      "-s",
      "Chrome Safe Storage",
      "-w"
    ], (err, stdout) => {
      if (err) {
        reject(new Error("Keychain access denied or Chrome Safe Storage not found"));
      } else {
        cachedPassword = stdout.trim();
        resolve(cachedPassword);
      }
    });
  });
}
function clearCachedPassword() {
  cachedPassword = null;
}
const TEMP_DIR$1 = path$1.join(CONTEX_HOME, "chrome-sync-temp");
const SALT = "saltysalt";
const ITERATIONS = 1003;
const KEY_LENGTH = 16;
const IV = Buffer.alloc(16, 32);
function deriveKey(password) {
  return crypto.pbkdf2Sync(password, SALT, ITERATIONS, KEY_LENGTH, "sha1");
}
function decryptValue(encrypted, key) {
  if (!encrypted || encrypted.length === 0) return "";
  if (encrypted.slice(0, 3).toString() === "v10") {
    const data = encrypted.slice(3);
    try {
      const decipher = crypto.createDecipheriv("aes-128-cbc", key, IV);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      return decrypted.toString("utf-8");
    } catch {
      return "";
    }
  }
  return encrypted.toString("utf-8");
}
function sameSiteMap(val) {
  switch (val) {
    case -1:
      return "unspecified";
    case 0:
      return "no_restriction";
    case 1:
      return "lax";
    case 2:
      return "strict";
    default:
      return "unspecified";
  }
}
const CHROME_EPOCH_OFFSET$1 = 11644473600n;
function chromeTimeToUnix(chromeTime) {
  if (!chromeTime || chromeTime === 0) return 0;
  const seconds = BigInt(chromeTime) / 1000000n - CHROME_EPOCH_OFFSET$1;
  return Number(seconds);
}
async function syncCookiesToPartition(profileDir, partition) {
  const errors = [];
  if (!fs.existsSync(TEMP_DIR$1)) fs.mkdirSync(TEMP_DIR$1, { recursive: true });
  const srcDb = path$1.join(profilePath(profileDir), "Cookies");
  if (!fs.existsSync(srcDb)) {
    return { count: 0, errors: ["Chrome Cookies database not found"] };
  }
  const tempDb = path$1.join(TEMP_DIR$1, `cookies-${Date.now()}.sqlite`);
  try {
    fs.copyFileSync(srcDb, tempDb);
    const password = await getChromeKeychainPassword();
    const key = deriveKey(password);
    const Database2 = (await import("better-sqlite3")).default;
    const db = new Database2(tempDb, { readonly: true });
    const rows = db.prepare(
      "SELECT host_key, name, path, encrypted_value, expires_utc, is_secure, is_httponly, samesite, has_expires FROM cookies"
    ).all();
    db.close();
    const ses = electron.session.fromPartition(partition);
    const now = Date.now() / 1e3;
    let count = 0;
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const promises = batch.map(async (row) => {
        const value = decryptValue(row.encrypted_value, key);
        if (!value) return;
        const expiresUnix = chromeTimeToUnix(row.expires_utc);
        if (row.has_expires && expiresUnix > 0 && expiresUnix < now) return;
        const domain = row.host_key.startsWith(".") ? row.host_key.slice(1) : row.host_key;
        const scheme = row.is_secure ? "https" : "http";
        const url2 = `${scheme}://${domain}${row.path}`;
        try {
          await ses.cookies.set({
            url: url2,
            name: row.name,
            value,
            domain: row.host_key,
            path: row.path,
            secure: Boolean(row.is_secure),
            httpOnly: Boolean(row.is_httponly),
            expirationDate: expiresUnix > 0 ? expiresUnix : void 0,
            sameSite: sameSiteMap(row.samesite)
          });
          count++;
        } catch (e) {
        }
      });
      await Promise.all(promises);
    }
    return { count, errors };
  } catch (e) {
    errors.push(e.message || String(e));
    return { count: 0, errors };
  } finally {
    try {
      fs.unlinkSync(tempDb);
    } catch {
    }
  }
}
function parseNode(node) {
  const result = {
    id: node.id ?? "",
    name: node.name ?? ""
  };
  if (node.type === "url" && node.url) {
    result.url = node.url;
  }
  if (node.date_added) {
    result.dateAdded = Math.floor(Number(BigInt(node.date_added) / 1000n - 11644473600000n));
  }
  if (node.children && Array.isArray(node.children)) {
    result.children = node.children.map(parseNode);
  }
  return result;
}
function getBookmarks(profileDir) {
  const file = path$1.join(profilePath(profileDir), "Bookmarks");
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    const roots = data?.roots;
    if (!roots) return [];
    const result = [];
    if (roots.bookmark_bar) result.push(parseNode(roots.bookmark_bar));
    if (roots.other) result.push(parseNode(roots.other));
    if (roots.synced) result.push(parseNode(roots.synced));
    return result;
  } catch {
    return [];
  }
}
const TEMP_DIR = path$1.join(CONTEX_HOME, "chrome-sync-temp");
const CHROME_EPOCH_OFFSET = 11644473600n;
function chromeTimeToUnixMs(chromeTime) {
  if (!chromeTime) return 0;
  const ms = BigInt(chromeTime) / 1000n - CHROME_EPOCH_OFFSET * 1000n;
  return Number(ms);
}
async function searchHistory(profileDir, query, limit = 20) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const srcDb = path$1.join(profilePath(profileDir), "History");
  if (!fs.existsSync(srcDb)) return [];
  const tempDb = path$1.join(TEMP_DIR, `history-${Date.now()}.sqlite`);
  try {
    fs.copyFileSync(srcDb, tempDb);
    const Database2 = (await import("better-sqlite3")).default;
    const db = new Database2(tempDb, { readonly: true });
    let rows;
    if (query) {
      const pattern = `%${query}%`;
      rows = db.prepare(
        "SELECT url, title, visit_count, last_visit_time FROM urls WHERE url LIKE ? OR title LIKE ? ORDER BY visit_count DESC, last_visit_time DESC LIMIT ?"
      ).all(pattern, pattern, limit);
    } else {
      rows = db.prepare(
        "SELECT url, title, visit_count, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT ?"
      ).all(limit);
    }
    db.close();
    return rows.map((r) => ({
      url: r.url,
      title: r.title || "",
      visitCount: r.visit_count,
      lastVisitTime: chromeTimeToUnixMs(r.last_visit_time)
    }));
  } catch {
    return [];
  } finally {
    try {
      fs.unlinkSync(tempDb);
    } catch {
    }
  }
}
let lastSync = null;
function registerChromeSyncIPC() {
  electron.ipcMain.handle("chromeSync:listProfiles", () => {
    return listProfiles();
  });
  electron.ipcMain.handle("chromeSync:getStatus", (_event, settings) => {
    return {
      enabled: settings.enabled,
      profileDir: settings.profileDir,
      lastSync,
      profiles: listProfiles()
    };
  });
  electron.ipcMain.handle("chromeSync:syncCookies", async (_event, profileDir, partition) => {
    const result = await syncCookiesToPartition(profileDir, partition);
    if (result.errors.length === 0) lastSync = Date.now();
    return result;
  });
  electron.ipcMain.handle("chromeSync:getBookmarks", (_event, profileDir) => {
    return getBookmarks(profileDir);
  });
  electron.ipcMain.handle("chromeSync:searchHistory", async (_event, profileDir, query, limit) => {
    return searchHistory(profileDir, query, limit);
  });
}
function registerDreamingIPC() {
  electron.ipcMain.handle("dreaming:status", async (_, workspaceId) => {
    await ensureDaemonRunning();
    return await daemonClient.getDreamStatus(workspaceId);
  });
  electron.ipcMain.handle("dreaming:listRuns", async (_, args) => {
    await ensureDaemonRunning();
    return await daemonClient.listDreamRuns(String(args?.workspaceId ?? "").trim(), args?.limit);
  });
  electron.ipcMain.handle("dreaming:run", async (_, args) => {
    await ensureDaemonRunning();
    return await daemonClient.runDream(args);
  });
  electron.ipcMain.handle("dreaming:cancel", async (_, args) => {
    await ensureDaemonRunning();
    return await daemonClient.cancelDream(args);
  });
}
function registerImageIPC() {
  electron.ipcMain.handle("image:edit", async (_, req) => {
    const tileId = typeof req?.tileId === "string" ? req.tileId.trim() : "";
    const prompt = typeof req?.prompt === "string" ? req.prompt.trim() : "";
    if (!tileId) return { ok: false, error: "Missing image block id" };
    if (!prompt) return { ok: false, error: "Missing image instruction" };
    const result = await executeImageEditTool(tileId, "image_edit_request", {
      prompt,
      provider: req.provider,
      model: req.model,
      output_path: req.outputPath
    });
    const ok = /^Image updated via /.test(result);
    return ok ? { ok: true, result } : { ok: false, error: result };
  });
}
const SECRETS_PATH = path$1.join(CONTEX_HOME, "secrets.json");
const SECRETS_VERSION = 1;
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function readFile() {
  if (!fs.existsSync(SECRETS_PATH)) {
    return { version: SECRETS_VERSION, keys: {} };
  }
  try {
    const raw = fs.readFileSync(SECRETS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      version: typeof parsed.version === "number" ? parsed.version : SECRETS_VERSION,
      keys: parsed.keys && typeof parsed.keys === "object" ? parsed.keys : {},
      plainKeys: parsed.plainKeys && typeof parsed.plainKeys === "object" ? parsed.plainKeys : void 0
    };
  } catch {
    return { version: SECRETS_VERSION, keys: {} };
  }
}
function writeFileAtomic(file) {
  ensureDir(path$1.dirname(SECRETS_PATH));
  const tempPath = `${SECRETS_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(file, null, 2)}
`, { encoding: "utf8", mode: 384 });
  fs.renameSync(tempPath, SECRETS_PATH);
}
function isSafeStorageReady() {
  try {
    return electron.app.isReady() && electron.safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}
function setSecret(name, value) {
  const file = readFile();
  if (value === "") {
    delete file.keys[name];
    if (file.plainKeys) delete file.plainKeys[name];
  } else if (isSafeStorageReady()) {
    const ciphertext = electron.safeStorage.encryptString(value).toString("base64");
    file.keys[name] = ciphertext;
    if (file.plainKeys) delete file.plainKeys[name];
  } else {
    if (!file.plainKeys) file.plainKeys = {};
    file.plainKeys[name] = Buffer.from(value, "utf8").toString("base64");
    delete file.keys[name];
  }
  writeFileAtomic(file);
}
function getSecret(name) {
  const file = readFile();
  if (file.keys[name] && isSafeStorageReady()) {
    try {
      const buf = Buffer.from(file.keys[name], "base64");
      return electron.safeStorage.decryptString(buf);
    } catch {
      return null;
    }
  }
  if (file.plainKeys?.[name]) {
    try {
      return Buffer.from(file.plainKeys[name], "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  return null;
}
function listSecretNames() {
  const file = readFile();
  return Array.from(/* @__PURE__ */ new Set([
    ...Object.keys(file.keys ?? {}),
    ...Object.keys(file.plainKeys ?? {})
  ])).sort();
}
function deleteSecret(name) {
  setSecret(name, "");
}
function hasSecret(name) {
  return getSecret(name) !== null;
}
const SPOKIFY_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const SPOKIFY_SYSTEM_PROMPT = `You rewrite an assistant's written reply into a natural spoken response that an AI voice will read aloud. Output only the rewritten text — no preamble, no quotes, no explanation.

Rules:
- Strip all markdown formatting: bold, italic, headers, links → plain prose.
- Replace fenced code blocks with a brief mention like "I've added a code example for that" or "Here's the snippet on screen." Never read code aloud, character by character or otherwise.
- Convert numbered lists into natural prose: "1. Foo  2. Bar  3. Baz" becomes "There are three options: foo, bar, and baz."
- Convert bulleted lists similarly. The listener can't see bullets.
- Keep the first-person voice if the original is first-person.
- Be decisive. "I'd recommend X" beats "X has merits and tradeoffs you might consider."
- Skip greeting and closing fluff if it's redundant — get to the point.
- Keep meaning intact. Don't add new information.
- Roughly preserve length minus structural noise.
- If the input is a single sentence already (e.g., from sentence-streaming), make minimal changes — just smooth punctuation and drop any inline markdown.

Punctuation hint: TTS engines pause on commas, full stops, and dashes. Use them to control rhythm. Avoid em-dashes and ellipses unless natural.`.trim();
async function callAnthropic(text, model) {
  const apiKey = getSecret("anthropic") ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No Anthropic API key set. Add one in Settings → Voice or set ANTHROPIC_API_KEY.");
  const body = {
    model,
    max_tokens: 1024,
    system: SPOKIFY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }]
  };
  const resp = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Spokify API error ${resp.status}: ${errText.slice(0, 300)}`);
  }
  const data = await resp.json();
  const blocks = Array.isArray(data.content) ? data.content : [];
  const text2 = blocks.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text).join("").trim();
  if (!text2) throw new Error("Spokify returned empty response");
  return text2;
}
function registerSpokifyIpc() {
  electron.ipcMain.handle("spokify:run", async (_event, args) => {
    try {
      const text = String(args?.text ?? "").trim();
      if (!text) return { ok: true, text: "" };
      const model = args?.model || SPOKIFY_MODEL;
      const spoken = await callAnthropic(text, model);
      return { ok: true, text: spoken };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
const DEFAULTS$1 = {
  cartesiaModel: "sonic-2",
  cartesiaVoice: "a0e99841-438c-4a64-b679-ae501e7d6091",
  // "Barbershop Man" — replace with your preferred default
  deepgramModel: "aura-2-thalia-en",
  elevenModel: "eleven_turbo_v2_5",
  elevenVoice: "21m00Tcm4TlvDq8ikWAM",
  // Rachel
  voiceLabBaseUrl: "http://127.0.0.1:8002"
};
async function ttsCartesia(text, voice, model) {
  const apiKey = getSecret("cartesia") ?? process.env.CARTESIA_API_KEY;
  if (!apiKey) return { ok: false, error: "No Cartesia API key set." };
  const body = {
    model_id: model || DEFAULTS$1.cartesiaModel,
    transcript: text,
    voice: { mode: "id", id: voice || DEFAULTS$1.cartesiaVoice },
    output_format: { container: "mp3", encoding: "mp3", sample_rate: 44100 },
    language: "en"
  };
  const resp = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": "2024-11-13",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `Cartesia ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  return { ok: true, audio: buf, mimeType: "audio/mpeg" };
}
async function ttsDeepgram(text, voice) {
  const apiKey = getSecret("deepgram") ?? process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return { ok: false, error: "No Deepgram API key set." };
  const model = voice || DEFAULTS$1.deepgramModel;
  const url2 = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`;
  const resp = await fetch(url2, {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `Deepgram TTS ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  return { ok: true, audio: buf, mimeType: "audio/mpeg" };
}
async function ttsElevenLabs(text, voice, modelOverride) {
  const apiKey = getSecret("elevenlabs") ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, error: "No ElevenLabs API key set." };
  const voiceId = voice || DEFAULTS$1.elevenVoice;
  const modelId = modelOverride || DEFAULTS$1.elevenModel;
  const url2 = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const resp = await fetch(url2, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `ElevenLabs ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  return { ok: true, audio: buf, mimeType: "audio/mpeg" };
}
async function ttsVoiceLab(text, voice, model, baseUrl) {
  const base = (baseUrl || DEFAULTS$1.voiceLabBaseUrl).replace(/\/+$/, "");
  const body = {
    model: model || "kokoro",
    // voice-lab understands these as MODELS_BY_ID keys
    input: text,
    voice: voice || "default",
    response_format: "mp3"
  };
  const resp = await fetch(`${base}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `Voice Lab ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  return { ok: true, audio: buf, mimeType: "audio/mpeg" };
}
async function ttsSay(text, voice) {
  if (process.platform !== "darwin") return { ok: false, error: "say is macOS-only" };
  return new Promise((resolve) => {
    const args = ["-o", "/dev/stdout", "--data-format=LEF32@22050"];
    if (voice) args.push("-v", voice);
    args.push(text);
    const child = child_process.spawn("say", args);
    const chunks = [];
    child.stdout.on("data", (c) => chunks.push(c));
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", (err) => resolve({ ok: false, error: `say: ${err.message}` }));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: `say exited ${code}: ${stderr.slice(0, 300)}` });
        return;
      }
      resolve({ ok: true, audio: new Uint8Array(Buffer.concat(chunks)), mimeType: "audio/wav" });
    });
  });
}
function registerTtsIpc() {
  electron.ipcMain.handle("tts:synthesize", async (_event, args) => {
    const text = String(args?.text ?? "").trim();
    if (!text) return { ok: false, error: "empty text" };
    const provider = args?.provider || "cartesia";
    try {
      switch (provider) {
        case "cartesia":
          return await ttsCartesia(text, args.voice, args.model);
        case "deepgram":
          return await ttsDeepgram(text, args.deepgramModel || args.voice);
        case "elevenlabs":
          return await ttsElevenLabs(text, args.voice, args.elevenModel);
        case "voicelab":
          return await ttsVoiceLab(text, args.voice, args.model, args.voiceLabBaseUrl);
        case "say":
          return await ttsSay(text, args.voice);
        default:
          return { ok: false, error: `Unknown TTS provider: ${provider}` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
const DEFAULTS = {
  openaiModel: "whisper-1",
  deepgramModel: "nova-2",
  localBaseUrl: "http://127.0.0.1:8011",
  lang: "en"
};
function toBuffer(audio) {
  if (audio instanceof Uint8Array) return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  return Buffer.from(audio);
}
function mimeToFilename(mime) {
  if (mime.includes("webm")) return "audio.webm";
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "audio.m4a";
  if (mime.includes("wav")) return "audio.wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "audio.mp3";
  return "audio.webm";
}
async function sttOpenAI(audio, mimeType, lang, model) {
  const apiKey = getSecret("openai") ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "No OpenAI API key set." };
  const form = new FormData();
  const blob = new Blob([new Uint8Array(audio)], { type: mimeType });
  form.append("file", blob, mimeToFilename(mimeType));
  form.append("model", model);
  if (lang) form.append("language", lang);
  form.append("response_format", "json");
  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: form
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `OpenAI Whisper ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const data = await resp.json();
  return { ok: true, text: (data.text ?? "").trim() };
}
async function sttDeepgram(audio, mimeType, lang, model) {
  const apiKey = getSecret("deepgram") ?? process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return { ok: false, error: "No Deepgram API key set." };
  const params = new URLSearchParams({
    model,
    smart_format: "true",
    punctuate: "true",
    language: lang || "en"
  });
  const resp = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": mimeType
    },
    body: new Uint8Array(audio)
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `Deepgram ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const data = await resp.json();
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return { ok: true, text: transcript.trim() };
}
async function sttAssemblyAI(audio, _mimeType, lang) {
  const apiKey = getSecret("assemblyai") ?? process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return { ok: false, error: "No AssemblyAI API key set." };
  const uploadResp = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/octet-stream"
    },
    body: new Uint8Array(audio)
  });
  if (!uploadResp.ok) {
    const errText = await uploadResp.text().catch(() => "");
    return { ok: false, error: `AssemblyAI upload ${uploadResp.status}: ${errText.slice(0, 300)}` };
  }
  const { upload_url } = await uploadResp.json();
  const submitResp = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      audio_url: upload_url,
      language_code: lang || "en",
      // AssemblyAI deprecated `speech_model` (singular). New API uses
      // `speech_models` (plural array, priority order). Recommended pair
      // gives universal-3-pro for supported languages with universal-2
      // fallback for everything else.
      speech_models: ["universal-3-pro", "universal-2"]
    })
  });
  if (!submitResp.ok) {
    const errText = await submitResp.text().catch(() => "");
    return { ok: false, error: `AssemblyAI submit ${submitResp.status}: ${errText.slice(0, 300)}` };
  }
  const { id } = await submitResp.json();
  const pollUrl = `https://api.assemblyai.com/v2/transcript/${id}`;
  const start = Date.now();
  const TIMEOUT_MS = 6e4;
  const POLL_INTERVAL_MS = 500;
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const pollResp = await fetch(pollUrl, { headers: { "Authorization": apiKey } });
    if (!pollResp.ok) continue;
    const data = await pollResp.json();
    if (data.status === "completed") return { ok: true, text: (data.text ?? "").trim() };
    if (data.status === "error") return { ok: false, error: `AssemblyAI: ${data.error || "unknown"}` };
  }
  return { ok: false, error: "AssemblyAI poll timeout (>60s)" };
}
async function sttLocal(audio, mimeType, lang, baseUrl) {
  const base = (baseUrl || DEFAULTS.localBaseUrl).replace(/\/+$/, "");
  const form = new FormData();
  const blob = new Blob([new Uint8Array(audio)], { type: mimeType });
  form.append("file", blob, mimeToFilename(mimeType));
  form.append("model", "whisper-1");
  if (lang) form.append("language", lang);
  form.append("response_format", "json");
  const resp = await fetch(`${base}/v1/audio/transcriptions`, {
    method: "POST",
    body: form
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `Local STT ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const data = await resp.json();
  return { ok: true, text: (data.text ?? "").trim() };
}
function registerTranscribeIpc() {
  electron.ipcMain.handle("transcribe:run", async (_event, args) => {
    if (!args?.audio) return { ok: false, error: "no audio" };
    const buf = toBuffer(args.audio);
    if (buf.length === 0) return { ok: false, error: "empty audio" };
    const mime = args.mimeType || "audio/webm";
    const lang = args.lang || DEFAULTS.lang;
    const provider = args.provider || "openai";
    try {
      switch (provider) {
        case "openai":
          return await sttOpenAI(buf, mime, lang, args.openaiModel || DEFAULTS.openaiModel);
        case "deepgram":
          return await sttDeepgram(buf, mime, lang, args.deepgramModel || DEFAULTS.deepgramModel);
        case "assemblyai":
          return await sttAssemblyAI(buf, mime, lang);
        case "local":
          return await sttLocal(buf, mime, lang, args.localBaseUrl);
        default:
          return { ok: false, error: `Unknown STT provider: ${provider}` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
function registerSecretsIpc() {
  electron.ipcMain.handle("secrets:set", (_event, args) => {
    try {
      const name = String(args?.name ?? "").trim();
      if (!name) return { ok: false, error: "name required" };
      setSecret(name, String(args?.value ?? ""));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  electron.ipcMain.handle("secrets:delete", (_event, name) => {
    try {
      deleteSecret(String(name ?? ""));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  electron.ipcMain.handle("secrets:list", () => {
    return { ok: true, names: listSecretNames() };
  });
  electron.ipcMain.handle("secrets:has", (_event, name) => {
    return { ok: true, has: hasSecret(String(name ?? "")) };
  });
}
async function exists(path2) {
  try {
    await fs.promises.access(path2);
    return true;
  } catch {
    return false;
  }
}
async function mergeDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path$1.join(src, entry.name);
    const destPath = path$1.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      if (await exists(destPath)) continue;
      const linkTarget = await fs.promises.readlink(srcPath);
      const resolvedTarget = path$1.resolve(path$1.dirname(srcPath), linkTarget);
      let linkType = "file";
      try {
        const targetStat = await fs.promises.stat(resolvedTarget);
        if (targetStat.isDirectory()) {
          linkType = process.platform === "win32" ? "junction" : "dir";
        }
      } catch {
      }
      await fs.promises.symlink(linkTarget, destPath, linkType);
      continue;
    }
    if (entry.isDirectory()) {
      await mergeDir(srcPath, destPath);
      continue;
    }
    if (entry.isFile()) {
      if (!await exists(destPath)) {
        await fs.promises.copyFile(srcPath, destPath);
      }
      continue;
    }
    console.warn(`[Migration] Skipping unsupported entry: ${srcPath}`);
  }
}
async function migrateHomeDirectory() {
  if (!await exists(LEGACY_HOME)) return;
  if (!await exists(CONTEX_HOME)) {
    await fs.promises.rename(LEGACY_HOME, CONTEX_HOME);
    console.log(`[Migration] Renamed ${LEGACY_HOME} -> ${CONTEX_HOME}`);
  } else {
    console.log(`[Migration] Merging ${LEGACY_HOME} into ${CONTEX_HOME}`);
    await mergeDir(LEGACY_HOME, CONTEX_HOME);
    console.log(`[Migration] Merge complete, removing ${LEGACY_HOME}`);
    await fs.promises.rm(LEGACY_HOME, { recursive: true, force: true });
  }
}
async function migrateConfigPaths() {
  const configPath = path$1.join(CONTEX_HOME, "config.json");
  if (!await exists(configPath)) return;
  try {
    const raw = await fs.promises.readFile(configPath, "utf8");
    const updated = raw.replaceAll(LEGACY_HOME, CONTEX_HOME);
    if (updated !== raw) {
      await fs.promises.writeFile(configPath, updated);
      console.log(`[Migration] Updated paths in config.json`);
    }
  } catch (error) {
    console.warn(`[Migration] Failed to update config paths:`, error);
  }
}
async function migrateWorkspaceTileDirs() {
  if (!await exists(WORKSPACES_DIR)) return;
  const workspaceIds = await fs.promises.readdir(WORKSPACES_DIR);
  for (const workspaceId of workspaceIds) {
    const workspacePath = path$1.join(WORKSPACES_DIR, workspaceId);
    const legacyDir = path$1.join(workspacePath, LEGACY_TILE_CONTEXT_DIRNAME);
    const newDir = path$1.join(workspacePath, TILE_CONTEXT_DIRNAME);
    if (!await exists(legacyDir) || await exists(newDir)) continue;
    await fs.promises.rename(legacyDir, newDir);
    console.log(`[Migration] Renamed ${legacyDir} -> ${newDir}`);
  }
}
async function migrateLegacyStorage() {
  try {
    await migrateHomeDirectory();
    await fs.promises.mkdir(CONTEX_HOME, { recursive: true });
    await migrateConfigPaths();
    await migrateWorkspaceTileDirs();
  } catch (error) {
    console.error(`[Migration] ${APP_NAME} storage migration failed:`, error);
    throw error;
  }
}
const status = {
  initialIndexDone: false,
  lastScanStartedAt: 0,
  lastScanFinishedAt: 0,
  lastScanDurationMs: 0,
  lastScanInserts: 0,
  lastScanUpdates: 0,
  lastScanTombstoned: 0,
  lastScanSkipped: 0,
  lastScanTimelineEvents: 0,
  scanningInFlight: false,
  lastError: null
};
let currentScan = null;
function extractJobRow(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("job JSON is not an object");
  }
  const j = raw;
  const asString2 = (v) => typeof v === "string" && v.length > 0 ? v : null;
  const asMs = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Date.parse(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const jobId = asString2(j.id);
  if (!jobId) throw new Error("job JSON missing id");
  const promoted = /* @__PURE__ */ new Set([
    "id",
    "taskLabel",
    "initialPrompt",
    "status",
    "provider",
    "model",
    "runMode",
    "workspaceId",
    "workspaceDir",
    "cardId",
    "sessionId",
    "requestedAt",
    "updatedAt",
    "completedAt",
    "error",
    // roll-up derived from timeline scan, not needed in extra_json
    "lastSequence"
  ]);
  const extra = {};
  for (const [k, v] of Object.entries(j)) {
    if (!promoted.has(k)) extra[k] = v;
  }
  return {
    jobId,
    taskLabel: asString2(j.taskLabel),
    initialPrompt: asString2(j.initialPrompt),
    status: asString2(j.status),
    provider: asString2(j.provider),
    model: asString2(j.model),
    runMode: asString2(j.runMode),
    workspaceId: asString2(j.workspaceId),
    workspaceDir: asString2(j.workspaceDir),
    cardId: asString2(j.cardId),
    sessionId: asString2(j.sessionId),
    requestedAtMs: asMs(j.requestedAt),
    completedAtMs: asMs(j.completedAt),
    errorText: asString2(j.error),
    extraJson: Object.keys(extra).length ? JSON.stringify(extra) : null
  };
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function safeStat(path2) {
  try {
    const s = fs.statSync(path2);
    return { mtimeMs: Math.floor(s.mtimeMs), size: s.size };
  } catch {
    return null;
  }
}
function parseTimeline(jsonl) {
  const out = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const sequence = typeof obj.sequence === "number" ? obj.sequence : -1;
    const timestamp = typeof obj.timestamp === "number" ? obj.timestamp : 0;
    const type = typeof obj.type === "string" ? obj.type : "unknown";
    const errorText = typeof obj.error === "string" ? obj.error : null;
    if (sequence < 0) continue;
    out.push({
      sequence,
      timestampMs: timestamp,
      eventType: type,
      errorText,
      payloadJson: trimmed
    });
  }
  return out;
}
function summarizeTimeline(events) {
  if (events.length === 0) {
    return { eventCount: 0, errorCount: 0, lastEventType: null, lastEventAtMs: null, lastSequence: 0 };
  }
  let errorCount = 0;
  let last = events[0];
  for (const e of events) {
    if (e.errorText) errorCount += 1;
    if (e.sequence > last.sequence) last = e;
  }
  return {
    eventCount: events.length,
    errorCount,
    lastEventType: last.eventType,
    lastEventAtMs: last.timestampMs,
    lastSequence: last.sequence
  };
}
function countJobsInDb() {
  return getDb().prepare(
    `SELECT COUNT(*) AS c FROM job_index WHERE deleted_at IS NULL`
  ).get().c;
}
function getJobIndexerStatus() {
  return {
    ...status,
    totalRows: (() => {
      try {
        return countJobsInDb();
      } catch {
        return 0;
      }
    })()
  };
}
function indexAllJobs() {
  if (currentScan) return currentScan;
  const promise = runScan();
  currentScan = promise;
  promise.finally(() => {
    currentScan = null;
  });
  return promise;
}
async function runScan() {
  status.scanningInFlight = true;
  status.lastScanStartedAt = Date.now();
  status.lastError = null;
  try {
    const db = getDb();
    const deviceId = getDeviceId();
    const now = nowIso();
    const existing = /* @__PURE__ */ new Map();
    for (const row of db.prepare(`
      SELECT rowid, job_id, source_mtime_ms, source_size_bytes,
             timeline_mtime_ms, timeline_size_bytes
        FROM job_index WHERE deleted_at IS NULL
    `).all()) {
      existing.set(row.job_id, {
        source_mtime_ms: row.source_mtime_ms,
        source_size_bytes: row.source_size_bytes,
        timeline_mtime_ms: row.timeline_mtime_ms,
        timeline_size_bytes: row.timeline_size_bytes,
        rowid: row.rowid
      });
    }
    let jobFiles = [];
    try {
      jobFiles = fs.readdirSync(JOBS_DIR).filter((n) => n.endsWith(".json"));
    } catch {
    }
    const upsertJob = db.prepare(`
      INSERT INTO job_index (
        id, device_id, job_id, file_path,
        task_label, initial_prompt, status, provider, model, run_mode,
        workspace_id, workspace_dir, card_id, session_id,
        requested_at_ms, completed_at_ms, duration_ms, error_text,
        event_count, error_count, last_event_type, last_event_at_ms, last_sequence,
        last_activity_at_ms,
        source_mtime_ms, source_size_bytes, timeline_mtime_ms, timeline_size_bytes,
        extra_json
      ) VALUES (
        @id, @device_id, @job_id, @file_path,
        @task_label, @initial_prompt, @status, @provider, @model, @run_mode,
        @workspace_id, @workspace_dir, @card_id, @session_id,
        @requested_at_ms, @completed_at_ms, @duration_ms, @error_text,
        @event_count, @error_count, @last_event_type, @last_event_at_ms, @last_sequence,
        @last_activity_at_ms,
        @source_mtime_ms, @source_size_bytes, @timeline_mtime_ms, @timeline_size_bytes,
        @extra_json
      )
      ON CONFLICT(job_id) DO UPDATE SET
        file_path            = excluded.file_path,
        task_label           = excluded.task_label,
        initial_prompt       = excluded.initial_prompt,
        status               = excluded.status,
        provider             = excluded.provider,
        model                = excluded.model,
        run_mode             = excluded.run_mode,
        workspace_id         = excluded.workspace_id,
        workspace_dir        = excluded.workspace_dir,
        card_id              = excluded.card_id,
        session_id           = excluded.session_id,
        requested_at_ms      = excluded.requested_at_ms,
        completed_at_ms      = excluded.completed_at_ms,
        duration_ms          = excluded.duration_ms,
        error_text           = excluded.error_text,
        event_count          = excluded.event_count,
        error_count          = excluded.error_count,
        last_event_type      = excluded.last_event_type,
        last_event_at_ms     = excluded.last_event_at_ms,
        last_sequence        = excluded.last_sequence,
        last_activity_at_ms  = excluded.last_activity_at_ms,
        source_mtime_ms      = excluded.source_mtime_ms,
        source_size_bytes    = excluded.source_size_bytes,
        timeline_mtime_ms    = excluded.timeline_mtime_ms,
        timeline_size_bytes  = excluded.timeline_size_bytes,
        extra_json           = excluded.extra_json,
        deleted_at           = NULL,
        updated_at           = @now,
        version              = version + 1
    `);
    const tombstone = db.prepare(`
      UPDATE job_index
         SET deleted_at = @now, updated_at = @now, version = version + 1
       WHERE job_id = @job_id AND deleted_at IS NULL
    `);
    const deleteTimelineEvents = db.prepare(
      `DELETE FROM timeline_event_index WHERE job_id = @job_id`
    );
    const insertTimelineEvent = db.prepare(`
      INSERT INTO timeline_event_index (
        id, device_id, job_id, sequence, timestamp_ms, event_type,
        error_text, payload_json
      ) VALUES (
        @id, @device_id, @job_id, @sequence, @timestamp_ms, @event_type,
        @error_text, @payload_json
      )
    `);
    let inserts = 0, updates = 0, skipped = 0, timelineEvents = 0;
    const txn = db.transaction(() => {
      const seen = /* @__PURE__ */ new Set();
      for (const fname of jobFiles) {
        const jobId = fname.replace(/\.json$/, "");
        const jobPath = path$1.join(JOBS_DIR, fname);
        const jobStat = safeStat(jobPath);
        if (!jobStat) continue;
        const timelinePath = path$1.join(TIMELINES_DIR, `${jobId}.jsonl`);
        const timelineStat = safeStat(timelinePath);
        const prev = existing.get(jobId);
        const jobUnchanged = prev && prev.source_mtime_ms === jobStat.mtimeMs && prev.source_size_bytes === jobStat.size;
        const timelineUnchanged = prev && prev.timeline_mtime_ms === (timelineStat?.mtimeMs ?? 0) && prev.timeline_size_bytes === (timelineStat?.size ?? 0);
        if (jobUnchanged && timelineUnchanged) {
          seen.add(jobId);
          skipped += 1;
          continue;
        }
        let extracted;
        try {
          extracted = extractJobRow(JSON.parse(fs.readFileSync(jobPath, "utf8")));
        } catch (err) {
          console.warn(`[jobs] extract failed for ${fname}:`, err);
          continue;
        }
        let summary = {
          eventCount: 0,
          errorCount: 0,
          lastEventType: null,
          lastEventAtMs: null,
          lastSequence: 0
        };
        let events = [];
        if (timelineStat) {
          if (timelineUnchanged && prev) {
            const row = db.prepare(`
              SELECT event_count, error_count, last_event_type,
                     last_event_at_ms, last_sequence
                FROM job_index WHERE rowid = ?
            `).get(prev.rowid);
            summary = {
              eventCount: row.event_count,
              errorCount: row.error_count,
              lastEventType: row.last_event_type,
              lastEventAtMs: row.last_event_at_ms,
              lastSequence: row.last_sequence
            };
          } else {
            try {
              events = parseTimeline(fs.readFileSync(timelinePath, "utf8"));
              summary = summarizeTimeline(events);
            } catch (err) {
              console.warn(`[jobs] timeline parse failed for ${jobId}:`, err);
            }
          }
        }
        const durationMs = extracted.requestedAtMs != null && extracted.completedAtMs != null ? Math.max(0, extracted.completedAtMs - extracted.requestedAtMs) : null;
        const lastActivityAtMs = summary.lastEventAtMs ?? extracted.requestedAtMs ?? null;
        upsertJob.run({
          id: prev ? void 0 : crypto.randomUUID(),
          device_id: deviceId,
          job_id: extracted.jobId,
          file_path: jobPath,
          task_label: extracted.taskLabel,
          initial_prompt: extracted.initialPrompt,
          status: extracted.status,
          provider: extracted.provider,
          model: extracted.model,
          run_mode: extracted.runMode,
          workspace_id: extracted.workspaceId,
          workspace_dir: extracted.workspaceDir,
          card_id: extracted.cardId,
          session_id: extracted.sessionId,
          requested_at_ms: extracted.requestedAtMs,
          completed_at_ms: extracted.completedAtMs,
          duration_ms: durationMs,
          error_text: extracted.errorText,
          event_count: summary.eventCount,
          error_count: summary.errorCount,
          last_event_type: summary.lastEventType,
          last_event_at_ms: summary.lastEventAtMs,
          last_sequence: summary.lastSequence,
          last_activity_at_ms: lastActivityAtMs,
          source_mtime_ms: jobStat.mtimeMs,
          source_size_bytes: jobStat.size,
          timeline_mtime_ms: timelineStat?.mtimeMs ?? 0,
          timeline_size_bytes: timelineStat?.size ?? 0,
          extra_json: extracted.extraJson,
          now
        });
        if (events.length > 0) {
          deleteTimelineEvents.run({ job_id: extracted.jobId });
          for (const e of events) {
            insertTimelineEvent.run({
              id: crypto.randomUUID(),
              device_id: deviceId,
              job_id: extracted.jobId,
              sequence: e.sequence,
              timestamp_ms: e.timestampMs,
              event_type: e.eventType,
              error_text: e.errorText,
              payload_json: e.payloadJson
            });
            timelineEvents += 1;
          }
        }
        seen.add(extracted.jobId);
        if (prev) updates += 1;
        else inserts += 1;
      }
      let tombstoned2 = 0;
      for (const jobId of existing.keys()) {
        if (!seen.has(jobId)) {
          tombstone.run({ job_id: jobId, now });
          tombstoned2 += 1;
        }
      }
      return tombstoned2;
    });
    const tombstoned = txn();
    const finishedAt = Date.now();
    status.lastScanFinishedAt = finishedAt;
    status.lastScanDurationMs = finishedAt - status.lastScanStartedAt;
    status.lastScanInserts = inserts;
    status.lastScanUpdates = updates;
    status.lastScanTombstoned = tombstoned;
    status.lastScanSkipped = skipped;
    status.lastScanTimelineEvents = timelineEvents;
    status.initialIndexDone = true;
    status.scanningInFlight = false;
    console.log(
      `[jobs] scan: inserts=${inserts} updates=${updates} tombstoned=${tombstoned} skipped=${skipped} timeline_events=${timelineEvents} in ${status.lastScanDurationMs}ms`
    );
  } catch (err) {
    status.scanningInFlight = false;
    status.lastError = err instanceof Error ? err.message : String(err);
    console.error("[jobs] scan failed:", err);
  }
}
async function ensureInitialJobIndex() {
  try {
    if (countJobsInDb() > 0) {
      status.initialIndexDone = true;
      console.log("[jobs] index already populated, skipping initial scan");
      return;
    }
  } catch {
  }
  console.log("[jobs] index empty, running one-time initial scan");
  await indexAllJobs();
}
function toggleJobStarred(jobId, starred) {
  const info = getDb().prepare(
    `UPDATE job_index
        SET is_starred = @starred, updated_at = @now, version = version + 1
      WHERE job_id = @job_id`
  ).run({ starred: starred ? 1 : 0, job_id: jobId, now: nowIso() });
  return info.changes > 0;
}
function setJobNotes(jobId, notes) {
  const info = getDb().prepare(
    `UPDATE job_index
        SET notes = @notes, updated_at = @now, version = version + 1
      WHERE job_id = @job_id`
  ).run({ notes, job_id: jobId, now: nowIso() });
  return info.changes > 0;
}
const SAFE_EXTERNAL_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]);
function normalizeSafeExternalUrl(rawUrl) {
  const trimmed = String(rawUrl ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
const DEFAULT_MAX_OLD_SPACE_SIZE_MB = 8192;
const envMaxOldSpaceSizeMb = Number.parseInt(process.env.CODESURF_MAX_OLD_SPACE_SIZE_MB ?? "", 10);
const maxOldSpaceSizeMb = Number.isFinite(envMaxOldSpaceSizeMb) && envMaxOldSpaceSizeMb > 0 ? envMaxOldSpaceSizeMb : DEFAULT_MAX_OLD_SPACE_SIZE_MB;
electron.app.commandLine.appendSwitch("js-flags", `--expose-gc --max-old-space-size=${maxOldSpaceSizeMb}`);
electron.app.commandLine.appendSwitch("enable-gpu-rasterization");
electron.app.commandLine.appendSwitch("enable-zero-copy");
electron.app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
electron.app.commandLine.appendSwitch("ignore-gpu-blocklist");
electron.app.on("open-file", (event, filePath) => {
  event.preventDefault();
  queuePendingSkillFile(filePath);
});
const gotSingleInstanceLock = electron.app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", (_evt, argv) => {
    for (const arg of argv) {
      if (typeof arg === "string" && arg.toLowerCase().endsWith(".skill")) {
        queuePendingSkillFile(arg);
      }
    }
    const wins = electron.BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  for (const arg of process.argv.slice(1)) {
    if (typeof arg === "string" && arg.toLowerCase().endsWith(".skill")) {
      queuePendingSkillFile(arg);
    }
  }
}
const windowTitles = /* @__PURE__ */ new Map();
const freshWindowIds = /* @__PURE__ */ new Set();
const miniChatWindows = /* @__PURE__ */ new Map();
const MAIN_WINDOW_TABBING_IDENTIFIER = `${APP_ID}.workspace-tabs`;
let extensionRegistry = null;
function getMiniChatWindowKey(workspaceId, tileId) {
  return `${workspaceId}:${tileId}`;
}
function getRendererQuery(params) {
  if (!params) return void 0;
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value.trim().length > 0));
}
function getMainWindowQuery(opts) {
  const query = {};
  const workspaceId = typeof opts?.workspaceId === "string" ? opts.workspaceId.trim() : "";
  if (workspaceId) query.workspaceId = workspaceId;
  if (opts?.workspacePicker) query.workspacePicker = "1";
  return Object.keys(query).length > 0 ? query : void 0;
}
function getFocusedMainWindow() {
  const focused = electron.BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed() && focused.tabbingIdentifier === MAIN_WINDOW_TABBING_IDENTIFIER) return focused;
  return getLiveWindows().find((win) => win.tabbingIdentifier === MAIN_WINDOW_TABBING_IDENTIFIER) ?? null;
}
function forceMergeNativeWorkspaceTabs(owner, tab) {
  if (process.platform !== "darwin") return;
  if (!owner || owner.isDestroyed() || owner === tab) return;
  const merge = () => {
    if (owner.isDestroyed() || tab.isDestroyed()) return;
    try {
      owner.mergeAllWindows();
      tab.focus();
    } catch (error) {
      console.warn("[window] Failed to merge native tabs:", error);
    }
  };
  setTimeout(merge, 0);
  setTimeout(merge, 120);
  setTimeout(merge, 400);
}
function addAsNativeWorkspaceTab(owner, tab) {
  if (process.platform !== "darwin") return false;
  if (!owner || owner.isDestroyed() || owner === tab) return false;
  if (owner.tabbingIdentifier !== MAIN_WINDOW_TABBING_IDENTIFIER) return false;
  try {
    owner.addTabbedWindow(tab);
    forceMergeNativeWorkspaceTabs(owner, tab);
    return true;
  } catch (error) {
    console.warn("[window] Failed to attach native tab:", error);
    forceMergeNativeWorkspaceTabs(owner, tab);
    return false;
  }
}
function createWorkspaceTab(owner, opts) {
  const win = createWindow({ ...opts, fresh: opts?.fresh ?? true, nativeTabOwner: owner });
  addAsNativeWorkspaceTab(owner, win);
  return win;
}
function loadRenderer(win, query) {
  const cleanQuery = getRendererQuery(query);
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    const url2 = new URL(process.env["ELECTRON_RENDERER_URL"]);
    if (cleanQuery) {
      for (const [key, value] of Object.entries(cleanQuery)) url2.searchParams.set(key, value);
    }
    win.loadURL(url2.toString());
  } else {
    win.loadFile(path$1.join(__dirname, "../renderer/index.html"), cleanQuery ? { query: cleanQuery } : void 0);
  }
}
function installRenderPerfProbe(win) {
  if (process.env.CODESURF_PERF_RENDER !== "1") return;
  const startedAt = performance.now();
  const log2 = (name) => {
    console.log(`[perf:render] ${name}=${(performance.now() - startedAt).toFixed(1)}ms`);
  };
  win.webContents.once("dom-ready", () => log2("domReady"));
  win.once("ready-to-show", () => log2("readyToShow"));
  win.webContents.once("did-finish-load", async () => {
    log2("didFinishLoad");
    try {
      const metrics = await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const nav = performance.getEntriesByType('navigation')[0]
            resolve({
              domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
              loadEventEnd: nav?.loadEventEnd ?? null,
              firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime ?? null,
              firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
              twoAnimationFrames: performance.now(),
              nodeCount: document.querySelectorAll('*').length
            })
          }))
        })
      `, true);
      console.log(`[perf:render] rendererMetrics=${JSON.stringify(metrics)}`);
    } catch (error) {
      console.warn("[perf:render] rendererMetrics failed:", error);
    }
    if (process.env.CODESURF_PERF_EXIT_AFTER_RENDER === "1") {
      setTimeout(() => electron.app.quit(), 250);
    }
  });
}
function resolveBundledExtensionDirs() {
  const envDir = process.env.CODESURF_BUNDLED_EXTENSIONS_DIR;
  const candidates = [
    envDir ?? "",
    path$1.join(electron.app.getAppPath(), "bundled-extensions"),
    path$1.join(electron.app.getAppPath(), "resources", "bundled-extensions"),
    path$1.join(process.resourcesPath, "bundled-extensions")
  ];
  return [...new Set(candidates.filter((candidate) => fs.existsSync(candidate)))];
}
function resolveCatalogExtensionDirs() {
  const candidates = [
    path$1.join(electron.app.getAppPath(), "examples", "extensions"),
    path$1.join(electron.app.getAppPath(), "resources", "examples", "extensions"),
    path$1.join(process.resourcesPath, "examples", "extensions")
  ];
  return [...new Set(candidates.filter((candidate) => fs.existsSync(candidate)))];
}
function resolveAppIconPath() {
  const iconName = process.platform === "win32" ? "icon.ico" : "icon.png";
  const candidates = [
    path$1.join(process.resourcesPath, iconName),
    path$1.join(process.resourcesPath, "resources", iconName),
    path$1.join(electron.app.getAppPath(), "resources", iconName),
    path$1.join(electron.app.getAppPath(), "..", "resources", iconName),
    path$1.join(__dirname, `../../resources/${iconName}`),
    // Fallback to PNG on any platform
    path$1.join(process.resourcesPath, "icon.png"),
    path$1.join(electron.app.getAppPath(), "resources", "icon.png"),
    path$1.join(__dirname, "../../resources/icon.png")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
function applyRuntimeAppBranding() {
  const iconPath = resolveAppIconPath();
  if (iconPath && process.platform === "darwin") {
    try {
      electron.app.dock.setIcon(electron.nativeImage.createFromPath(iconPath));
    } catch (err) {
      console.warn("[app] Failed to set dock icon:", err);
    }
  }
  electron.app.setName(APP_NAME);
  electron.app.setAboutPanelOptions({
    applicationName: APP_NAME
  });
}
function getLiveWindows() {
  return electron.BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && !w.webContents.isDestroyed());
}
function broadcastAppearanceToRenderers() {
  const payload = { shouldUseDark: electron.nativeTheme.shouldUseDarkColors };
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send("appearance:updated", payload);
  }
}
function broadcastWindowList() {
  const wins = getLiveWindows();
  const focused = electron.BrowserWindow.getFocusedWindow();
  const focusedId = focused && !focused.isDestroyed() && !focused.webContents.isDestroyed() ? focused.webContents.id : void 0;
  const list = wins.map((w) => ({
    id: w.webContents.id,
    title: windowTitles.get(w.webContents.id) ?? "CodeSurf",
    focused: w.webContents.id === focusedId
  }));
  for (const w of wins) {
    try {
      w.webContents.send("window:list-changed", list);
    } catch {
    }
  }
}
async function requestMacMediaAccess(kind) {
  if (process.platform !== "darwin") return true;
  try {
    return await electron.systemPreferences.askForMediaAccess(kind);
  } catch (error) {
    console.warn(`[Permissions] Failed requesting ${kind} access:`, error);
    return false;
  }
}
function installMediaPermissionHandlers() {
  const defaultSession = electron.session.defaultSession;
  if (!defaultSession) return;
  defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === "media" || permission === "display-capture";
  });
  defaultSession.setPermissionRequestHandler(async (_webContents, permission, callback) => {
    try {
      if (permission === "media") {
        const [micAllowed, camAllowed] = await Promise.all([
          requestMacMediaAccess("microphone"),
          requestMacMediaAccess("camera")
        ]);
        callback(micAllowed || camAllowed);
        return;
      }
      if (permission === "display-capture") {
        callback(true);
        return;
      }
      callback(false);
    } catch (error) {
      console.warn("[Permissions] Permission request failed:", error);
      callback(false);
    }
  });
  defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await electron.desktopCapturer.getSources({ types: ["screen", "window"] });
      callback(
        sources[0] ? { video: sources[0], audio: "loopback" } : {}
      );
    } catch (error) {
      console.warn("[Permissions] Display media request failed:", error);
      callback({});
    }
  });
}
function createWindow(opts) {
  const iconPath = resolveAppIconPath();
  const win = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    // Keep the renderer-drawn toolbar integrated with the macOS traffic lights.
    // A default titlebar adds an extra native strip above our custom workspace tabs.
    show: process.platform === "darwin" && Boolean(opts?.nativeTabOwner),
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    frame: true,
    ...process.platform === "darwin" ? { trafficLightPosition: { x: 14, y: 14 } } : {},
    ...process.platform === "darwin" ? { tabbingIdentifier: MAIN_WINDOW_TABBING_IDENTIFIER } : {},
    ...iconPath ? { icon: iconPath } : {},
    ...process.platform === "darwin" ? { transparent: false, backgroundColor: "#1e1e1e", vibrancy: void 0, visualEffectState: void 0 } : getWindowAppearanceOptions(),
    webPreferences: {
      preload: path$1.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });
  const windowId = win.webContents.id;
  installRenderPerfProbe(win);
  win.on("ready-to-show", () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    if (process.platform === "darwin") {
      win.setBackgroundColor("#1e1e1e");
      win.setVibrancy(null);
    } else {
      applyWindowAppearance(win);
    }
    if (!win.getTitle()) win.setTitle(APP_NAME);
    if (!win.isVisible()) win.show();
    broadcastWindowList();
  });
  win.webContents.on("did-finish-load", async () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    const level = await getSavedZoomLevel();
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.setZoomLevel(level);
  });
  win.on("focus", () => broadcastWindowList());
  win.on("blur", () => broadcastWindowList());
  win.on("closed", () => {
    windowTitles.delete(windowId);
    broadcastWindowList();
  });
  win.on("unresponsive", () => {
    console.error(`[window:${windowId}] BrowserWindow became unresponsive`);
  });
  win.webContents.on("render-process-gone", (_, details) => {
    console.error(`[window:${windowId}] Renderer process gone`, details);
  });
  win.webContents.setWindowOpenHandler((details) => {
    void openExternalIfSafe(details.url, "window");
    return { action: "deny" };
  });
  if (opts?.fresh) {
    freshWindowIds.add(win.webContents.id);
  }
  loadRenderer(win, getMainWindowQuery(opts));
  return win;
}
function createMiniChatWindow(owner, request) {
  const workspaceId = typeof request.workspaceId === "string" ? request.workspaceId.trim() : "";
  const tileId = typeof request.tileId === "string" ? request.tileId.trim() : "";
  if (!workspaceId || !tileId) return { ok: false, error: "workspaceId and tileId are required" };
  const key = getMiniChatWindowKey(workspaceId, tileId);
  const existing = miniChatWindows.get(key);
  if (existing && !existing.isDestroyed() && !existing.webContents.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return { ok: true, id: existing.webContents.id };
  }
  const iconPath = resolveAppIconPath();
  const ownerBounds = owner && !owner.isDestroyed() ? owner.getBounds() : electron.screen.getPrimaryDisplay().workArea;
  const display = electron.screen.getDisplayMatching(ownerBounds);
  const width = 520;
  const height = 720;
  const x = Math.max(
    display.workArea.x + 12,
    Math.min(ownerBounds.x + ownerBounds.width - width - 28, display.workArea.x + display.workArea.width - width - 12)
  );
  const y = Math.max(
    display.workArea.y + 12,
    Math.min(ownerBounds.y + 68, display.workArea.y + display.workArea.height - height - 12)
  );
  const win = new electron.BrowserWindow({
    width,
    height,
    minWidth: 380,
    minHeight: 420,
    x,
    y,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    frame: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    ...iconPath ? { icon: iconPath } : {},
    ...getWindowAppearanceOptions(),
    webPreferences: {
      preload: path$1.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });
  miniChatWindows.set(key, win);
  windowTitles.set(win.webContents.id, typeof request.title === "string" && request.title.trim() ? request.title.trim() : "Mini Chat");
  const closeWithOwner = () => {
    if (!win.isDestroyed()) win.close();
  };
  const hideWithOwner = () => {
    if (!win.isDestroyed()) win.hide();
  };
  const showWithOwner = () => {
    if (!win.isDestroyed()) win.showInactive();
  };
  const liftWithOwner = () => {
    if (!win.isDestroyed() && win.isVisible()) win.moveTop();
  };
  if (owner && !owner.isDestroyed()) {
    owner.once("closed", closeWithOwner);
    owner.on("minimize", hideWithOwner);
    owner.on("restore", showWithOwner);
    owner.on("focus", liftWithOwner);
  }
  win.on("ready-to-show", () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    applyWindowAppearance(win);
    win.show();
    win.focus();
    broadcastWindowList();
  });
  win.on("closed", () => {
    miniChatWindows.delete(key);
    windowTitles.delete(win.webContents.id);
    if (owner && !owner.isDestroyed()) {
      owner.off("closed", closeWithOwner);
      owner.off("minimize", hideWithOwner);
      owner.off("restore", showWithOwner);
      owner.off("focus", liftWithOwner);
    }
    broadcastWindowList();
  });
  win.webContents.setWindowOpenHandler((details) => {
    void openExternalIfSafe(details.url, "window");
    return { action: "deny" };
  });
  win.webContents.on("did-finish-load", async () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    const level = await getSavedZoomLevel();
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.setZoomLevel(level);
  });
  loadRenderer(win, {
    miniChat: "1",
    workspaceId,
    tileId,
    title: typeof request.title === "string" ? request.title : ""
  });
  return { ok: true, id: win.webContents.id };
}
async function openExternalIfSafe(rawUrl, source) {
  const trimmed = String(rawUrl ?? "").trim();
  if (trimmed.startsWith("file://")) {
    try {
      const errorMessage = await electron.shell.openPath(url.fileURLToPath(trimmed));
      if (errorMessage) {
        console.warn(`[shell] Failed to open local file from ${source}: ${errorMessage}`);
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`[shell] Failed to open local file from ${source}:`, error);
      return false;
    }
  }
  const safeUrl = normalizeSafeExternalUrl(rawUrl);
  if (!safeUrl) {
    console.warn(`[shell] Blocked unsafe external URL from ${source}: ${rawUrl}`);
    return false;
  }
  try {
    await electron.shell.openExternal(safeUrl);
    return true;
  } catch (error) {
    console.warn(`[shell] Failed to open external URL from ${source}:`, error);
    return false;
  }
}
electron.app.whenReady().then(async () => {
  applyRuntimeAppBranding();
  installMediaPermissionHandlers();
  electronApp.setAppUserModelId(APP_ID);
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  await migrateLegacyStorage();
  try {
    getDb();
    const status2 = getDbStatus();
    console.log(`[db] Ready at ${status2.path} (schema v${status2.schemaVersion}, tables: ${status2.tables.join(", ") || "—"})`);
  } catch (err) {
    console.error("[db] Failed to initialise local database:", err);
  }
  void ensureInitialIndex().catch((err) => {
    console.warn("[threads] initial index failed:", err);
  });
  void ensureInitialJobIndex().catch((err) => {
    console.warn("[jobs] initial index failed:", err);
  });
  await initWorkspaces();
  registerWorkspaceIPC();
  registerFsIPC();
  registerCanvasIPC();
  registerTerminalIPC();
  registerAgentsIPC();
  registerStreamIPC();
  registerGitIPC();
  registerBusIPC();
  registerChatIPC();
  registerActivityIPC();
  registerCollabIPC();
  registerTileContextIPC();
  registerSystemIPC();
  registerExecutionIPC();
  registerPermissionsIPC();
  registerUIIPC();
  registerJobsIPC();
  registerSkillsIPC();
  registerDreamingIPC();
  registerImageIPC();
  registerSpokifyIpc();
  registerTtsIpc();
  registerTranscribeIpc();
  registerSecretsIpc();
  registerFileProtocol();
  registerAgentPathsIPC();
  registerChromeSyncIPC();
  registerLocalProxyIPC();
  extensionRegistry = new ExtensionRegistry({
    bundledDirs: resolveBundledExtensionDirs(),
    catalogDirs: resolveCatalogExtensionDirs()
  });
  registerExtensionProtocol(extensionRegistry);
  registerExtensionIPC(extensionRegistry);
  setExtensionRegistryProvider(() => extensionRegistry);
  electron.nativeTheme.on("updated", broadcastAppearanceToRenderers);
  electron.ipcMain.handle("appearance:shouldUseDark", () => electron.nativeTheme.shouldUseDarkColors);
  electron.ipcMain.handle("appearance:setThemeSource", (_, mode) => {
    if (mode === "dark" || mode === "light" || mode === "system") {
      electron.nativeTheme.themeSource = mode;
    }
    broadcastAppearanceToRenderers();
    return true;
  });
  initializeAgentPathsCache().catch((err) => console.error("[AgentPaths] Cache init failed:", err));
  startMCPServer().then((port) => {
    console.log(`[MCP] Kanban tools available at http://127.0.0.1:${port}`);
  }).catch((err) => console.error("[MCP] Failed to start:", err));
  electron.ipcMain.handle("mcp:getPort", () => getMCPPort());
  const { join: pjoin } = await import("path");
  const mcpConfigPath = pjoin(CONTEX_HOME, "mcp-server.json");
  const getRuntimeContexBase = () => {
    const port = getMCPPort();
    return port ? `http://127.0.0.1:${port}/mcp` : void 0;
  };
  const normalizeMcpServer2 = (entry, fallbackUrl) => {
    if (!entry || typeof entry !== "object") return fallbackUrl ? { type: "http", url: fallbackUrl } : {};
    const server = { ...entry };
    if (server.url && typeof server.url === "string") {
      server.url = server.url.replace(/\/$/, "");
    }
    if (!server.command && server.cmd && typeof server.cmd === "string") {
      const parts = String(server.cmd).trim().split(/\s+/);
      server.command = parts[0];
      if (parts.length > 1) server.args = parts.slice(1);
    }
    if (!server.type) {
      if (server.command) {
        server.type = "stdio";
      } else if (server.url || fallbackUrl) {
        server.type = "http";
      }
    }
    if (!server.url && fallbackUrl) {
      server.url = fallbackUrl;
    }
    return server;
  };
  const normalizeMcpServers2 = (servers, fallbackUrlFn) => {
    const out = {};
    for (const [name, server] of Object.entries(servers ?? {})) {
      const fallbackUrl = fallbackUrlFn?.(name);
      const normalized = normalizeMcpServer2(server, fallbackUrl);
      out[name] = normalized;
    }
    return out;
  };
  electron.ipcMain.handle("mcp:getConfig", async () => {
    try {
      const { promises: fsP } = await import("fs");
      const raw = await fsP.readFile(mcpConfigPath, "utf8");
      const cfg = JSON.parse(raw);
      const contexBase = (typeof cfg.url === "string" ? `${cfg.url.replace(/\/$/, "")}/mcp` : void 0) ?? getRuntimeContexBase();
      const globalServers = cfg.mcpServers ?? {};
      const normalizedServers = normalizeMcpServers2(globalServers, (name) => {
        if (name === "contex" && contexBase) return contexBase;
        return void 0;
      });
      if (contexBase && !normalizedServers["contex"]) {
        normalizedServers["contex"] = { type: "http", url: contexBase };
      }
      return { ...cfg, mcpServers: normalizedServers };
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("mcp:saveServers", async (_, servers) => {
    try {
      const { promises: fsP } = await import("fs");
      const raw = await fsP.readFile(mcpConfigPath, "utf8");
      const cfg = JSON.parse(raw);
      const contexBase = (typeof cfg.url === "string" ? `${cfg.url.replace(/\/$/, "")}/mcp` : void 0) ?? getRuntimeContexBase();
      const contexServer = normalizeMcpServer2(cfg.mcpServers?.contex ?? { url: contexBase }, contexBase);
      const customServers = normalizeMcpServers2(servers);
      cfg.mcpServers = {
        contex: contexServer,
        ...customServers
      };
      cfg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await fsP.writeFile(mcpConfigPath, JSON.stringify(cfg, null, 2));
      return cfg;
    } catch (e) {
      return null;
    }
  });
  electron.ipcMain.handle("mcp:getWorkspaceServers", async (_, workspaceId) => {
    try {
      const { promises: fsP } = await import("fs");
      const p = pjoin(CONTEX_HOME, "workspaces", workspaceId, "mcp-servers.json");
      const raw = await fsP.readFile(p, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  });
  electron.ipcMain.handle("mcp:saveWorkspaceServers", async (_, workspaceId, servers) => {
    try {
      const { promises: fsP } = await import("fs");
      const dir = pjoin(CONTEX_HOME, "workspaces", workspaceId);
      await fsP.mkdir(dir, { recursive: true });
      const p = pjoin(dir, "mcp-servers.json");
      const normalized = normalizeMcpServers2(servers);
      await fsP.writeFile(p, JSON.stringify(normalized, null, 2));
      return normalized;
    } catch (e) {
      return null;
    }
  });
  electron.ipcMain.handle("mcp:getMergedConfig", async (_, workspaceId) => {
    try {
      const { promises: fsP } = await import("fs");
      let globalCfg = {};
      try {
        const raw = await fsP.readFile(mcpConfigPath, "utf8");
        globalCfg = JSON.parse(raw);
      } catch {
      }
      let wsServers = {};
      try {
        const wsPath = pjoin(CONTEX_HOME, "workspaces", workspaceId, "mcp-servers.json");
        const raw = await fsP.readFile(wsPath, "utf8");
        wsServers = JSON.parse(raw);
      } catch {
      }
      const globalServers = globalCfg.mcpServers ?? {};
      const globalCfgUrl = globalCfg.url;
      const contexBase = (typeof globalCfgUrl === "string" ? `${String(globalCfgUrl).replace(/\/$/, "")}/mcp` : void 0) ?? getRuntimeContexBase();
      const normalizedGlobal = normalizeMcpServers2(globalServers, (name) => {
        if (name === "contex" && contexBase) return contexBase;
        return void 0;
      });
      if (contexBase && !normalizedGlobal["contex"]) {
        normalizedGlobal["contex"] = { type: "http", url: contexBase };
      }
      const normalizedWorkspace = normalizeMcpServers2(wsServers);
      const merged = {
        ...globalCfg,
        mcpServers: {
          ...normalizedGlobal,
          ...normalizedWorkspace
        },
        workspace: workspaceId,
        mergedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const wsContex = pjoin(CONTEX_HOME, "workspaces", workspaceId, ".contex");
      await fsP.mkdir(wsContex, { recursive: true });
      await fsP.writeFile(
        pjoin(wsContex, "mcp-merged.json"),
        JSON.stringify(merged, null, 2)
      );
      return merged;
    } catch (e) {
      return null;
    }
  });
  electronUpdater.autoUpdater.autoDownload = false;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
  electron.ipcMain.handle("updater:check", async () => {
    try {
      const result = await electronUpdater.autoUpdater.checkForUpdates();
      const info = result?.updateInfo;
      const updateAvailable = !!info && info.version !== electron.app.getVersion();
      return {
        ok: true,
        currentVersion: electron.app.getVersion(),
        status: updateAvailable ? "update-available" : "up-to-date",
        updateAvailable,
        updateInfo: info ? {
          version: info.version,
          releaseName: info.releaseName,
          releaseDate: info.releaseDate
        } : void 0
      };
    } catch (error) {
      return {
        ok: false,
        currentVersion: electron.app.getVersion(),
        status: error instanceof Error ? error.message : "update-check-failed",
        updateAvailable: false
      };
    }
  });
  electron.ipcMain.handle("updater:download", async () => {
    try {
      await electronUpdater.autoUpdater.downloadUpdate();
      return { ok: true, status: "downloaded" };
    } catch (error) {
      return { ok: false, status: error instanceof Error ? error.message : "download-failed" };
    }
  });
  electron.ipcMain.handle("updater:quitAndInstall", async () => {
    setImmediate(() => electronUpdater.autoUpdater.quitAndInstall());
    return { ok: true };
  });
  electron.ipcMain.handle("window:new", () => {
    createWindow({ fresh: true });
    return null;
  });
  electron.ipcMain.handle("window:newTab", (event) => {
    const owner = electron.BrowserWindow.fromWebContents(event.sender) ?? getFocusedMainWindow();
    if (process.platform === "darwin") {
      createWorkspaceTab(owner, { fresh: true, workspacePicker: true });
    } else {
      createWindow({ fresh: true });
    }
    return null;
  });
  electron.ipcMain.handle("window:newWorkspaceTab", (event, workspaceId) => {
    const owner = electron.BrowserWindow.fromWebContents(event.sender) ?? getFocusedMainWindow();
    const id = typeof workspaceId === "string" ? workspaceId.trim() : "";
    const win = process.platform === "darwin" ? createWorkspaceTab(owner, { fresh: true, workspaceId: id || null, workspacePicker: !id }) : createWindow({ fresh: true, workspaceId: id || null, workspacePicker: !id });
    return { id: win.webContents.id };
  });
  electron.ipcMain.handle("window:isFresh", (event) => {
    const id = event.sender.id;
    const isFresh = freshWindowIds.has(id);
    if (isFresh) {
      freshWindowIds.delete(id);
      return true;
    }
    return false;
  });
  electron.ipcMain.handle("window:list", () => {
    const wins = getLiveWindows();
    const focused = electron.BrowserWindow.getFocusedWindow();
    const focusedId = focused && !focused.isDestroyed() && !focused.webContents.isDestroyed() ? focused.webContents.id : void 0;
    return wins.map((w) => ({
      id: w.webContents.id,
      title: windowTitles.get(w.webContents.id) ?? APP_NAME,
      focused: w.webContents.id === focusedId
    }));
  });
  electron.ipcMain.handle("window:getCurrentId", (event) => event.sender.id);
  electron.ipcMain.handle("window:setTitle", (event, title) => {
    const cleanTitle = typeof title === "string" && title.trim().length > 0 ? title.trim() : APP_NAME;
    windowTitles.set(event.sender.id, cleanTitle);
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.setTitle(cleanTitle);
    broadcastWindowList();
  });
  electron.ipcMain.handle("window:focusById", (_, id) => {
    const win = getLiveWindows().find((w) => w.webContents.id === id);
    win?.focus();
  });
  electron.ipcMain.handle("window:closeById", (_, id) => {
    const win = getLiveWindows().find((w) => w.webContents.id === id);
    win?.close();
  });
  electron.ipcMain.handle("window:openMiniChat", (event, request) => {
    const owner = electron.BrowserWindow.fromWebContents(event.sender);
    return createMiniChatWindow(owner, request ?? {});
  });
  electron.ipcMain.handle("window:setSidebarCollapsed", (event, collapsed) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    return !!win && typeof collapsed === "boolean";
  });
  electron.ipcMain.handle("app:relaunch", () => {
    electron.app.relaunch();
    electron.app.quit();
  });
  electron.ipcMain.handle("shell:openExternal", async (_, url2) => {
    return await openExternalIfSafe(url2, "ipc");
  });
  const menu = electron.Menu.buildFromTemplate([
    {
      label: electron.app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => createWindow({ fresh: true })
        },
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+T",
          click: () => {
            const win = getFocusedMainWindow();
            if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
              win.webContents.send("workspace:newTab");
              return;
            }
            if (process.platform === "darwin") {
              createWorkspaceTab(null, { fresh: true, workspacePicker: true });
            } else {
              createWindow({ fresh: true });
            }
          }
        },
        { type: "separator" },
        { role: "close" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "selectNextTab" },
        { role: "selectPreviousTab" },
        { role: "showAllTabs" },
        { role: "mergeAllWindows" },
        { role: "moveTabToNewWindow" },
        { type: "separator" },
        { role: "front" }
      ]
    }
  ]);
  electron.Menu.setApplicationMenu(menu);
  electron.app.on("new-window-for-tab", () => {
    const owner = getFocusedMainWindow();
    if (process.platform === "darwin") {
      createWorkspaceTab(owner, { fresh: true, workspacePicker: true });
    } else {
      createWindow({ fresh: true });
    }
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("before-quit", () => {
  flushAll();
  stopAllCollabWatchers();
  extensionRegistry?.deactivateAll();
  stopAllRelayServices();
  closeDb();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
