/**
 * Ensure the Electron binary is present under node_modules/electron/dist.
 *
 * Bun (and some npm postinstall runners) can exit before electron's async
 * install.js finishes, leaving only LICENSES.chromium.html in dist/.
 */

const { downloadArtifact } = require('@electron/get')
const extract = require('extract-zip')
const childProcess = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')

function getPlatformPath() {
  const platform = process.env.npm_config_platform || os.platform()
  switch (platform) {
    case 'mas':
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron'
    case 'freebsd':
    case 'openbsd':
    case 'linux':
      return 'electron'
    case 'win32':
      return 'electron.exe'
    default:
      throw new Error(`Electron builds are not available on platform: ${platform}`)
  }
}

function resolveArch(platform) {
  let arch = process.env.npm_config_arch || process.arch
  if (
    platform === 'darwin'
    && process.platform === 'darwin'
    && arch === 'x64'
    && process.env.npm_config_arch === undefined
  ) {
    try {
      const output = childProcess.execSync('sysctl -in sysctl.proc_translated')
      if (output.toString().trim() === '1') arch = 'arm64'
    } catch {
      // ignore
    }
  }
  return arch
}

function isInstalled(version, platformPath) {
  try {
    const distVersion = fs.readFileSync(path.join(electronDir, 'dist', 'version'), 'utf8').replace(/^v/, '')
    const recordedPath = fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8')
    if (distVersion !== version || recordedPath !== platformPath) return false
  } catch {
    return false
  }
  const electronPath = process.env.ELECTRON_OVERRIDE_DIST_PATH
    || path.join(electronDir, 'dist', platformPath)
  return fs.existsSync(electronPath)
}

async function main() {
  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) return

  if (!fs.existsSync(path.join(electronDir, 'package.json'))) {
    console.warn('[ensure-electron] electron package missing; skipping')
    return
  }

  const { version } = require(path.join(electronDir, 'package.json'))
  const platform = process.env.npm_config_platform || process.platform
  const arch = resolveArch(platform)
  const platformPath = getPlatformPath()

  if (isInstalled(version, platformPath)) return

  console.log(`[ensure-electron] Installing Electron ${version} (${platform}-${arch})...`)
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    force: process.env.force_no_cache === 'true',
    cacheRoot: process.env.electron_config_cache,
    checksums:
      process.env.electron_use_remote_checksums || process.env.npm_config_electron_use_remote_checksums
        ? undefined
        : require(path.join(electronDir, 'checksums.json')),
    platform,
    arch,
  })

  const distPath = process.env.ELECTRON_OVERRIDE_DIST_PATH || path.join(electronDir, 'dist')
  await fs.promises.rm(distPath, { recursive: true, force: true })
  await fs.promises.mkdir(distPath, { recursive: true })
  await extract(zipPath, { dir: distPath })

  const srcTypeDefPath = path.join(distPath, 'electron.d.ts')
  const targetTypeDefPath = path.join(electronDir, 'electron.d.ts')
  if (fs.existsSync(srcTypeDefPath)) {
    fs.renameSync(srcTypeDefPath, targetTypeDefPath)
  }

  await fs.promises.writeFile(path.join(electronDir, 'path.txt'), platformPath, 'utf8')
  console.log('[ensure-electron] Electron binary ready')
}

main().catch((error) => {
  console.error('[ensure-electron]', error.stack || error)
  process.exit(1)
})