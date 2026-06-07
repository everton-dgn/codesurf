import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '../..')

export function resolveElectronExecutable(): string {
  const electronDir = join(REPO_ROOT, 'node_modules/electron')
  const pathFile = join(electronDir, 'path.txt')

  if (!existsSync(pathFile)) {
    throw new Error(
      'Electron is not installed. path.txt is missing.\n'
      + 'Try: rm -rf node_modules/electron && npm install && node node_modules/electron/install.js',
    )
  }

  const platformPath = readFileSync(pathFile, 'utf8').trim()
  const executable = join(electronDir, 'dist', platformPath)

  if (!existsSync(executable)) {
    throw new Error(`Electron binary not found at ${executable}`)
  }

  return executable
}