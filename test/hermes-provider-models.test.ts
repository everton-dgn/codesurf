import { describe, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { expect } from './node-expect.ts'
import { DEFAULT_MODELS, getApproxContextWindowTokens } from '../src/renderer/src/config/providers.ts'

describe('Hermes provider model options', () => {
  test('tracks the current Hermes/Codex-first model picker defaults', () => {
    const hermesIds = DEFAULT_MODELS.hermes.map(model => model.id)

    expect(hermesIds[0]).toBe('openai-codex/gpt-5.5')
    expect(hermesIds).toContain('openai-codex/gpt-5.4-mini')
    expect(hermesIds).toContain('openai-codex/gpt-5.4')
    expect(hermesIds).toContain('anthropic/claude-opus-4-7')
    expect(hermesIds).toContain('anthropic/claude-sonnet-4-6')
    expect(hermesIds).toContain('gemini/gemini-3.1-pro-preview')
    expect(hermesIds).toContain('gemini/gemini-3-flash-preview')

    expect(hermesIds).not.toContain('openai/o4-mini')
    expect(hermesIds).not.toContain('google/gemini-2.5-pro')
  })

  test('estimates GPT-5.5 context correctly when routed through Hermes', () => {
    expect(getApproxContextWindowTokens('hermes', 'openai-codex/gpt-5.5')).toBeGreaterThan(257_999)
  })

  test('keeps legacy Kanban Hermes model suggestions aligned with the current default', () => {
    const source = readFileSync(`${process.cwd()}/src/renderer/src/components/KanbanCard.tsx`, 'utf8')

    expect(source).toContain("hermes:   ['openai-codex/gpt-5.5'")
    expect(source).not.toContain("hermes:   ['anthropic/claude-opus-4-6'")
    expect(source).not.toContain("'openai/gpt-5.4'")
  })
})
