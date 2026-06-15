// P1b-1: a Persona's SOFT model/provider default seeds the composer; the user's
// pick always overrides it. Proves precedence ladder layers 2 (soft default) and
// 3 (user pick wins), and that model is fully DISSOCIATED from persona identity —
// it never flows through the authoritative tools/permission resolver, and the
// dispatch path never reads `defaultBinding`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Pure renderer resolver (type-only imports → loads under node's type-stripping).
import { resolvePersonaModelSeed } from '../../src/renderer/src/hooks/personaModelBinding.ts'
// Overlay/inheritance: confirm `defaultBinding` survives overlay + extends merge.
import { overlayPersonas } from '../../src/shared/agentModes.ts'
// Authoritative tools/permission resolver — must stay model-free (altitude guard).
import { resolveAuthoritativeAgentMode } from '../../src/main/chat/agent-mode-resolver.ts'
import { mkdtemp as mkdtempP, mkdir as mkdirP, rm as rmP, writeFile as writeFileP } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const ROOT_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

// ─── layer 2: a soft default seeds provider + model ───────────────────────────

test('soft default: a persona with defaultBinding seeds BOTH provider and model', () => {
  const persona = {
    id: 'polly', name: 'Polly', description: '', systemPrompt: 'S', tools: null,
    icon: 'star', color: '#b368c9', isBuiltin: true,
    defaultBinding: { provider: 'claude', model: 'claude-opus-4-8' },
  }
  assert.deepEqual(resolvePersonaModelSeed(persona), { provider: 'claude', model: 'claude-opus-4-8' })
})

test('soft default: a provider-only or model-only binding seeds just that field', () => {
  assert.deepEqual(
    resolvePersonaModelSeed({ id: 'a', defaultBinding: { provider: 'codex' } }),
    { provider: 'codex' },
  )
  assert.deepEqual(
    resolvePersonaModelSeed({ id: 'b', defaultBinding: { model: 'gpt-5' } }),
    { model: 'gpt-5' },
  )
})

test('soft default: blank/whitespace binding fields are ignored (treated as unset)', () => {
  assert.equal(resolvePersonaModelSeed({ id: 'a', defaultBinding: { provider: '   ', model: '' } }), null)
  assert.deepEqual(
    resolvePersonaModelSeed({ id: 'b', defaultBinding: { provider: '  claude  ', model: '' } }),
    { provider: 'claude' },
  )
})

// ─── (c) no default → composer unchanged ──────────────────────────────────────

test('no default: a persona without defaultBinding yields null (composer left unchanged)', () => {
  const plain = { id: 'agent', name: 'Agent', description: '', systemPrompt: '', tools: null, icon: 'robot', color: '#3568ff', isBuiltin: true }
  assert.equal(resolvePersonaModelSeed(plain), null)
  assert.equal(resolvePersonaModelSeed({ id: 'x', defaultBinding: {} }), null)
  assert.equal(resolvePersonaModelSeed(null), null, 'no persona (None state) → no seed')
  assert.equal(resolvePersonaModelSeed(undefined), null)
})

test('no default: all BUILT-IN personas leave the composer unchanged (binding unset)', () => {
  // Built-ins intentionally carry NO defaultBinding (keeps DEFAULT_PERSONAS
  // byte-identical across the shared/daemon drift guard).
  for (const p of overlayPersonas(null)) {
    assert.equal(resolvePersonaModelSeed(p), null, `${p.id} must carry no soft default`)
  }
})

// ─── (b) layer 3: user/composer pick overrides the soft default ───────────────

test('user pick OVERRIDES the soft default — the changed value is what dispatches', () => {
  // Model the composer: select a persona → its soft default seeds state; the user
  // then changes the model; the dispatch reads the LIVE state (activeModel), which
  // is the user's choice. This mirrors the real flow: seed at selection time, then
  // live composer state is the single source of truth for req.model/provider.
  const persona = { id: 'polly', defaultBinding: { provider: 'claude', model: 'claude-opus-4-8' } }
  const composer = { provider: 'codex', model: 'gpt-5' }

  // Selection seeds the composer (layer 2).
  const seed = resolvePersonaModelSeed(persona)
  if (seed?.provider) composer.provider = seed.provider
  if (seed?.model) composer.model = seed.model
  assert.deepEqual(composer, { provider: 'claude', model: 'claude-opus-4-8' }, 'soft default seeded')

  // User then freely picks a different model (layer 3).
  composer.model = 'claude-haiku-4-5'

  // The dispatch builds req.model from the LIVE composer state (activeModel) — NOT
  // from persona.defaultBinding. So the user's pick is what flows to the request.
  const reqModel = composer.model // === activeModel in useChatTileMessaging
  assert.equal(reqModel, 'claude-haiku-4-5', 'user pick wins over the soft default')
  assert.notEqual(reqModel, persona.defaultBinding.model, 'the soft default must NOT win once the user changed it')
})

// ─── dispatch decoupling: defaultBinding is read ONLY at seed time ─────────────

test('dispatch path builds req.model/provider from LIVE state, never from defaultBinding (layer 3 is structural)', () => {
  const src = readFileSync(join(ROOT_DIR, 'src/renderer/src/hooks/useChatTileMessaging.ts'), 'utf8')
  // req.model / req.provider come from activeModel / activeProvider...
  assert.match(src, /model:\s*activeModel/, 'req.model must be the live activeModel')
  assert.match(src, /provider:\s*activeProvider/, 'req.provider must be the live activeProvider')
  assert.match(src, /const activeModel\s*=\s*state\?\.model\s*\?\?\s*model/, 'activeModel reads the live composer model state')
  assert.match(src, /const activeProvider\s*=\s*state\?\.provider\s*\?\?\s*provider/, 'activeProvider reads the live composer provider state')
  // ...and the binding is NEVER consulted at dispatch (that would re-couple model
  // to identity and silently break user override).
  assert.doesNotMatch(src, /defaultBinding/, 'the dispatch path must NOT read persona.defaultBinding')
  assert.doesNotMatch(src, /resolvePersonaModelSeed/, 'the dispatch path must NOT seed at send time')
})

// ─── wiring: ChatTile seeds in the onSelectAgent click handler (not an effect) ─

test('ChatTile seeds the composer via resolvePersonaModelSeed inside onSelectAgent (layer 2 wiring)', () => {
  const src = readFileSync(join(ROOT_DIR, 'src/renderer/src/components/ChatTile.tsx'), 'utf8')
  const start = src.indexOf('onSelectAgent={nextAgentId => {')
  assert.ok(start >= 0, 'onSelectAgent click handler must exist')
  const block = src.slice(start, src.indexOf('}}', start) + 2)
  assert.match(block, /setAgentId\(nextAgentId\)/, 'must set the selected agent id')
  assert.match(block, /resolvePersonaModelSeed\(/, 'must resolve the soft seed in the click handler')
  assert.match(block, /if \(modelSeed\?\.provider\) setProvider\(/, 'must seed provider only when present')
  assert.match(block, /if \(modelSeed\?\.model\) setModel\(/, 'must seed model only when present')
  // Must NOT be wired as an agentId-keyed effect (would re-clobber the user pick on
  // restore/re-render).
  assert.doesNotMatch(src, /useEffect\([^)]*resolvePersonaModelSeed/s, 'seeding must not live in an effect')
})

// ─── overlay / extends: defaultBinding flows through unchanged ─────────────────

test('overlay: a persisted persona may add a defaultBinding; it survives the overlay', () => {
  const resolved = overlayPersonas([
    { id: 'custom', name: 'Custom', description: '', systemPrompt: 'S', tools: ['Read'], icon: 'robot', color: '#111', isBuiltin: false, defaultBinding: { provider: 'hermes', model: 'm-1' } },
  ])
  const custom = resolved.find(p => p.id === 'custom')
  assert.deepEqual(custom.defaultBinding, { provider: 'hermes', model: 'm-1' })
  assert.deepEqual(resolvePersonaModelSeed(custom), { provider: 'hermes', model: 'm-1' })
})

test('overlay extends: a child inherits the base soft default unless it defines its own', () => {
  const resolved = overlayPersonas([
    { id: 'base', name: 'Base', description: '', systemPrompt: 'S', tools: ['Read'], icon: 'map', color: '#111', isBuiltin: false, defaultBinding: { provider: 'claude', model: 'base-model' } },
    { id: 'inheritor', name: 'Inheritor', extends: 'base', isBuiltin: false },
    { id: 'overrider', name: 'Overrider', extends: 'base', isBuiltin: false, defaultBinding: { model: 'own-model' } },
  ])
  assert.deepEqual(
    resolvePersonaModelSeed(resolved.find(p => p.id === 'inheritor')),
    { provider: 'claude', model: 'base-model' },
    'omitted binding inherits the base soft default',
  )
  assert.deepEqual(
    resolvePersonaModelSeed(resolved.find(p => p.id === 'overrider')),
    { model: 'own-model' },
    'a child-defined binding overlays the base',
  )
})

// ─── ALTITUDE: model never enters the authoritative tools/permission resolver ──

test('altitude: defaultBinding does NOT flow through resolveAuthoritativeAgentMode (model is not a permission boundary)', async () => {
  const root = await mkdtempP(join(tmpdir(), 'persona-binding-'))
  try {
    const dir = join(root, '.contex', 'customisation')
    await mkdirP(dir, { recursive: true })
    // A persisted persona carrying BOTH a tools restriction and a soft binding.
    await writeFileP(join(dir, 'agents.json'), JSON.stringify([
      { id: 'bound', name: 'Bound', description: '', systemPrompt: 'S', tools: ['Read'], icon: 'robot', color: '#111', isBuiltin: false, defaultBinding: { provider: 'claude', model: 'should-not-gate-anything' } },
    ]))
    const res = await resolveAuthoritativeAgentMode({ agentId: 'bound', resolveWorkspaceRoot: () => root })
    assert.equal(res.ok, true)
    // The resolver's job is tools/permissions — it must resolve them correctly...
    assert.deepEqual(res.agentMode.tools, ['Read'], 'tools resolution is unaffected by the binding')
    // ...and it carries the binding through inertly (it is plain persona data), but
    // it must NEVER consult the binding to make a permission decision. The resolver
    // source proves the decoupling: it reasons only about tools/agents.json, never model.
    const resolverSrc = readFileSync(join(ROOT_DIR, 'src/main/chat/agent-mode-resolver.ts'), 'utf8')
    assert.doesNotMatch(resolverSrc, /defaultBinding|\.model\b|preferredModel/, 'the authoritative resolver must not reference model/binding')
  } finally {
    await rmP(root, { recursive: true, force: true })
  }
})
