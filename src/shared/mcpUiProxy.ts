/**
 * Constant URL for the self-hosted MCP-UI sandbox proxy.
 *
 * Served by the contex-ext:// protocol handler (see src/main/extensions/protocol.ts
 * `__runext_sandbox__` route and src/main/extensions/sandbox-proxy.ts).
 *
 * The string is identical in dev (`http://localhost:PORT` host renderer) and packaged
 * (`file://`) builds — contex-ext:// is a registered *standard* scheme with its own
 * distinct origin, so the proxy iframe is always CROSS-ORIGIN to the host renderer.
 * That cross-origin boundary is required for the @mcp-ui/client double-iframe sandbox
 * isolation to hold.
 *
 * Authority MUST be `extension` and the route token MUST be the first PATH segment —
 * this mirrors the existing `__runext_codicons__` / `__runext_resource__` routes, which
 * the handler matches as `segments[0]` of the pathname (not the URL authority).
 */
export const MCP_UI_SANDBOX_PROXY_URL = 'contex-ext://extension/__runext_sandbox__/proxy.html'
