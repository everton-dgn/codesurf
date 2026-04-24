import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, test } from 'node:test'
import { expect } from './node-expect.ts'

/**
 * Contract tests for the CodeSurf prompt conventions injected into every
 * chat provider (Claude, Codex, OpenCode, OpenClaw, Hermes).
 *
 * chat.ts cannot be imported directly (it pulls in Electron main APIs), so
 * we assert on the source text. The goal is to catch silent drift:
 *   - accidental removal of a required section header
 *   - a provider path that forgets to prepend both conventions
 *   - the output-convention "card" collapsing to an unstructured blob
 *
 * These tests are deliberately shallow — they check the contract, not the
 * wording. Edit CODESURF_OUTPUT_CONVENTION or CODESURF_INSIGHT_CONVENTION
 * freely; these tests only fail if the structural invariants are lost.
 */

const CHAT_SOURCE = readFileSync(resolve(process.cwd(), 'src/main/ipc/chat.ts'), 'utf8')

describe('CodeSurf prompt conventions — exports', () => {
  test('CODESURF_OUTPUT_CONVENTION is exported and contains all three required sections', () => {
    expect(CHAT_SOURCE).toContain('export const CODESURF_OUTPUT_CONVENTION')
    expect(CHAT_SOURCE).toContain('Default to a short natural-language completion')
    expect(CHAT_SOURCE).toContain('Do NOT use the structured card for trivial changes')
    expect(CHAT_SOURCE).toContain('CHANGES MADE:')
    // Note: source uses single-quoted literal `'DIDN\\'T TOUCH:'`, so the
    // raw source text contains the escaped apostrophe. Matching on a
    // distinctive prefix avoids coupling to the escape form.
    expect(CHAT_SOURCE).toContain('DIDN')
    expect(CHAT_SOURCE).toContain('T TOUCH:')
    expect(CHAT_SOURCE).toContain('CONCERNS:')
  })

  test('CODESURF_INSIGHT_CONVENTION is opt-in and keeps the literal star-framed container', () => {
    expect(CHAT_SOURCE).toContain('export const CODESURF_INSIGHT_CONVENTION')
    expect(CHAT_SOURCE).toContain('Do not emit an Insight block unless the user explicitly asks')
    // The exact framing must survive — the chat renderer matches on these
    // characters. Changing the framing means updating the renderer too.
    expect(CHAT_SOURCE).toContain('★ Insight ─────────────────────────────────────')
    expect(CHAT_SOURCE).toContain('─────────────────────────────────────────────────')
  })

  test('both builder helpers exist and return their respective constants', () => {
    expect(CHAT_SOURCE).toContain('function buildCodeSurfOutputConvention()')
    expect(CHAT_SOURCE).toContain('function buildCodeSurfInsightConvention()')
    assert.match(CHAT_SOURCE, /buildCodeSurfOutputConvention\(\)[\s\S]{0,40}return\s+CODESURF_OUTPUT_CONVENTION/)
    assert.match(CHAT_SOURCE, /buildCodeSurfInsightConvention\(\)[\s\S]{0,40}return\s+CODESURF_INSIGHT_CONVENTION/)
  })
})

describe('CodeSurf prompt conventions — provider wiring', () => {
  function extractFunction(name: string): string {
    const re = new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`)
    const match = CHAT_SOURCE.match(re)
    assert.ok(match, `expected to find function ${name}(...) in chat.ts`)
    return match![0]
  }

  test('Claude prompt builder injects output convention but not automatic insights', () => {
    const block = extractFunction('buildClaudeAgentPrompt')
    expect(block).toContain('buildCodeSurfOutputConvention')
    expect(block).not.toContain('buildCodeSurfInsightConvention')
    expect(block).toContain('joinPromptSections')
  })

  test('Codex prompt builder injects output convention but not automatic insights', () => {
    const block = extractFunction('buildCodexPrompt')
    expect(block).toContain('buildCodeSurfOutputConvention')
    expect(block).not.toContain('buildCodeSurfInsightConvention')
    expect(block).toContain('joinPromptSections')
  })

  test('OpenCode prepends only the output convention on the first turn of a fresh session', () => {
    // chatOpencode uses `isFirstTurn` — presence of both convention calls
    // within a reasonable span of the first-turn guard proves the injection
    // is gated correctly.
    assert.match(
      CHAT_SOURCE,
      /const isFirstTurn = !existingSessionId[\s\S]{0,400}buildCodeSurfOutputConvention\(\)[\s\S]{0,80}---/,
    )
  })

  test('OpenClaw prepends only the output convention on the first turn', () => {
    assert.match(
      CHAT_SOURCE,
      /openClawIsFirstTurn[\s\S]{0,400}buildCodeSurfOutputConvention\(\)[\s\S]{0,80}---/,
    )
  })

  test('Hermes prepends only the output convention on the first turn', () => {
    assert.match(
      CHAT_SOURCE,
      /hermesIsFirstTurn[\s\S]{0,400}buildCodeSurfOutputConvention\(\)[\s\S]{0,80}---/,
    )
  })

  test('normal provider prompt wiring never calls the insight convention helper', () => {
    const normalPromptPath = [
      extractFunction('buildClaudeAgentPrompt'),
      extractFunction('buildCodexPrompt'),
    ].join('\n')
    expect(normalPromptPath).not.toContain('buildCodeSurfInsightConvention')
    assert.doesNotMatch(CHAT_SOURCE, /buildCodeSurfOutputConvention\(\)[\s\S]{0,200}buildCodeSurfInsightConvention\(\)/)
  })
})

describe('CodeSurf prompt conventions — token budget guardrails', () => {
  test('combined conventions stay within a reasonable source-size budget', () => {
    // Rough budget: the two convention array literals together should stay
    // under ~6000 chars (~1500 tokens). Going above hints at prompt bloat
    // that will hurt every turn across every provider.
    const outputMatch = CHAT_SOURCE.match(/export const CODESURF_OUTPUT_CONVENTION = \[([\s\S]*?)\]\.join\('\\n'\)/)
    const insightMatch = CHAT_SOURCE.match(/export const CODESURF_INSIGHT_CONVENTION = \[([\s\S]*?)\]\.join\('\\n'\)/)
    assert.ok(outputMatch, 'CODESURF_OUTPUT_CONVENTION array literal not found')
    assert.ok(insightMatch, 'CODESURF_INSIGHT_CONVENTION array literal not found')

    const combined = outputMatch![1].length + insightMatch![1].length
    // If this fails, either shrink the conventions or deliberately raise
    // the ceiling with a comment explaining why the extra tokens are worth
    // the per-turn cost across all providers.
    assert.ok(
      combined < 6000,
      `combined convention source is ${combined} chars — over the 6000 soft ceiling`,
    )
  })
})
