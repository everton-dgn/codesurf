import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)))
const EXT_DIR = join(ROOT_DIR, 'bundled-extensions', 'source-control')
const sourceControl = require(join(EXT_DIR, 'main.js'))

function git(dir, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile('git', args, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'CodeSurf Test',
        GIT_AUTHOR_EMAIL: 'codesurf@example.com',
        GIT_COMMITTER_NAME: 'CodeSurf Test',
        GIT_COMMITTER_EMAIL: 'codesurf@example.com',
      },
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout
        error.stderr = stderr
        rejectPromise(error)
        return
      }
      resolvePromise({ stdout: String(stdout || ''), stderr: String(stderr || '') })
    })
  })
}

async function initGit(dir) {
  try {
    await git(dir, ['init', '-b', 'main'])
  } catch {
    await git(dir, ['init'])
    await git(dir, ['checkout', '-b', 'main']).catch(() => {})
  }
  await git(dir, ['config', 'user.name', 'CodeSurf Test'])
  await git(dir, ['config', 'user.email', 'codesurf@example.com'])
}

async function createFixtureRepo() {
  const dir = await mkdtemp(join(tmpdir(), 'codesurf-source-control-'))
  await initGit(dir)
  await mkdir(join(dir, 'src'), { recursive: true })
  await writeFile(join(dir, 'README.md'), '# fixture\n')
  await writeFile(join(dir, 'src', 'main.ts'), 'export const value = 1\n')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'base commit'])

  await git(dir, ['checkout', '-b', 'feature/review-workbench'])
  await writeFile(join(dir, 'src', 'main.ts'), 'import { review } from "./review"\nexport const value = review(2)\n')
  await writeFile(join(dir, 'src', 'review.ts'), 'export function review(value: number) { return value * 2 }\n')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'add review feature'])

  await writeFile(join(dir, 'README.md'), '# fixture\n\nDirty local note.\n')
  return dir
}

function runNode(args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', rejectPromise)
    child.once('close', code => resolvePromise({ code: code ?? 1, stdout, stderr }))
  })
}

test('source-control is bundled as a safe Git Review Workbench with MCP read tools', async () => {
  const manifest = JSON.parse(await readFile(join(EXT_DIR, 'extension.json'), 'utf8'))

  assert.equal(manifest.id, 'source-control')
  assert.equal(manifest.name, 'Git Review Workbench')
  assert.equal(manifest.main, 'main.js')
  assert.equal(manifest.ui.mode, 'native')

  const tile = manifest.contributes.tiles.find(entry => entry.type === 'source-control-panel')
  assert.ok(tile, 'expected source-control-panel tile contribution')
  assert.equal(tile.entry, 'tile/index.html')
  assert.deepEqual(tile.defaultSize, { w: 860, h: 640 })

  assert.ok(manifest.contributes.context.produces.includes('ctx:git:state'))
  assert.ok(manifest.contributes.context.produces.includes('ctx:git:branch_compare'))
  assert.ok(manifest.contributes.context.produces.includes('ctx:git:changed_file_graph'))
  assert.ok(manifest.contributes.context.produces.includes('ctx:git:review_handoff'))
  assert.ok(manifest.contributes.context.consumes.includes('ctx:code-index:repo_map'))
  assert.ok(manifest.contributes.context.consumes.includes('ctx:test-loop:last_run'))

  const actionNames = manifest.contributes.actions.map(action => action.name).sort()
  assert.deepEqual(actionNames, ['compareBranches', 'generateReviewHandoff', 'getChangedFileGraph', 'getFileDiff', 'getGitState', 'writeReviewHandoff'])

  const mcpNames = manifest.contributes.mcpTools.map(tool => tool.name).sort()
  assert.deepEqual(mcpNames, ['branch_compare', 'changed_file_graph', 'file_diff', 'git_state', 'review_handoff'])
})

test('source-control compares branches and builds a changed-file graph without switching checkout', async () => {
  const dir = await createFixtureRepo()
  try {
    const beforeBranch = (await git(dir, ['branch', '--show-current'])).stdout.trim()
    const compare = await sourceControl.__testing.compareBranches(dir, { baseRef: 'main', headRef: 'HEAD' })
    const afterBranch = (await git(dir, ['branch', '--show-current'])).stdout.trim()

    assert.equal(beforeBranch, 'feature/review-workbench')
    assert.equal(afterBranch, beforeBranch)
    assert.equal(compare.summary.baseRef, 'main')
    assert.equal(compare.summary.headRef, 'HEAD')
    assert.equal(compare.summary.ahead, 1)
    assert.equal(compare.summary.fileCount, 2)
    assert.ok(compare.files.some(file => file.path === 'src/main.ts' && file.status === 'modified'))
    assert.ok(compare.files.some(file => file.path === 'src/review.ts' && file.status === 'added'))
    assert.ok(compare.graph.nodes.some(node => node.id === 'file:src/main.ts'))
    assert.ok(compare.graph.edges.some(edge => edge.type === 'contains' && edge.to === 'file:src/review.ts'))
    assert.ok(compare.graph.centralFiles.some(file => file.path === 'src/main.ts'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('source-control exposes git state, file diff, and review handoff markdown', async () => {
  const dir = await createFixtureRepo()
  try {
    const state = await sourceControl.__testing.getGitState(dir, { baseRef: 'main', headRef: 'HEAD' })
    assert.equal(state.currentBranch, 'feature/review-workbench')
    assert.equal(state.status.dirty, true)
    assert.ok(state.status.changes.some(change => change.path === 'README.md'))
    assert.equal(state.compare.summary.commitCount, 1)

    const diff = await sourceControl.__testing.getFileDiff(dir, { baseRef: 'main', headRef: 'HEAD', path: 'src/main.ts' })
    assert.match(diff.diff, /review\(2\)/)

    const handoff = await sourceControl.__testing.generateReviewHandoff(dir, { baseRef: 'main', headRef: 'HEAD' })
    assert.match(handoff.markdown, /^# Git Review Handoff/m)
    assert.match(handoff.markdown, /Changed-file graph/)
    assert.match(handoff.markdown, /src\/review\.ts/)

    const written = await sourceControl.__testing.writeReviewHandoff(dir, { baseRef: 'main', headRef: 'HEAD' })
    assert.match(written.filePath, /\.codesurf\/reviews\/.*main-HEAD\.md$/)
    assert.ok((await stat(written.filePath)).isFile())
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('source-control rejects path traversal for file diffs', async () => {
  const dir = await createFixtureRepo()
  try {
    await assert.rejects(
      () => sourceControl.__testing.getFileDiff(dir, { baseRef: 'main', headRef: 'HEAD', path: '../secret.txt' }),
      /Path must stay inside the workspace/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('source-control tile calls host review APIs and publishes git context', async () => {
  const tileHtml = await readFile(join(EXT_DIR, 'tile', 'index.html'), 'utf8')
  assert.match(tileHtml, /ext\.invoke\('getGitState'/)
  assert.match(tileHtml, /ext\.invoke\('generateReviewHandoff'/)
  assert.match(tileHtml, /ext\.invoke\('writeReviewHandoff'/)
  assert.match(tileHtml, /ext\.invoke\('getFileDiff'/)
  assert.match(tileHtml, /ctx:git:state/)
  assert.match(tileHtml, /ctx:git:branch_compare/)
  assert.match(tileHtml, /ctx:git:changed_file_graph/)
  assert.match(tileHtml, /ctx:git:review_handoff/)
  assert.match(tileHtml, /Git Review Workbench/)
})

test('validate-extension accepts bundled source-control target', async () => {
  const result = await runNode(['scripts/validate-extension.mjs', 'bundled-extensions/source-control'])
  assert.equal(
    result.code,
    0,
    `validate-extension failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  assert.match(result.stdout, /\[OK\] bundled-extensions\/source-control|\[OK\] source-control/)
  assert.match(result.stdout, /Summary: 1 passed, 0 failed/)
})
