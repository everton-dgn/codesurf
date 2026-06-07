import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolveElectronExecutable } from './electron-path'

const REPO_ROOT = join(__dirname, '../..')
const MAIN_ENTRY = join(REPO_ROOT, 'dist-electron/main/index.js')

export interface LaunchedElectronApp {
  app: ElectronApplication
  page: Page
  homeDir: string
}

export async function launchCodeSurfElectron(): Promise<LaunchedElectronApp> {
  const homeDir = await mkdtemp(join(tmpdir(), 'codesurf-e2e-home-'))

  const app = await electron.launch({
    executablePath: resolveElectronExecutable(),
    cwd: REPO_ROOT,
    args: [MAIN_ENTRY],
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      CODESURF_E2E: '1',
    },
    timeout: 60_000,
  })

  const page = await app.firstWindow({ timeout: 45_000 })
  await page.waitForLoadState('domcontentloaded')

  return { app, page, homeDir }
}

export async function closeCodeSurfElectron(launch: LaunchedElectronApp): Promise<void> {
  try {
    await launch.app.close()
  } finally {
    await rm(launch.homeDir, { recursive: true, force: true })
  }
}