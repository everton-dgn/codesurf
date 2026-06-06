import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, test } from 'node:test'
import { expect } from './node-expect.ts'
import {
  CODESURF_OUTPUT_CONVENTION,
  CODESURF_INSIGHT_CONVENTION,
  buildCodeSurfOutputConvention,
  buildCodeSurfInsightConvention,
  joinPromptSections,
} from '../src/main/chat/prompt-conventions.ts'

/**
 * Contract tests for the CodeSurf prompt conventions injected into every chat
 * provider (Claude, Codex, OpenCode, OpenClaw, Hermes).
 *
 * The conventions themselves now live in the pure `prompt-conventions` module,
 * so we import and assert on the real values. The provider *wiring* still lives
 * in `chat.ts` / provider modules (which pull in Electron main APIs and can't
 * be imported), so those checks remain source-text assertions.
 */

const CHAT_SOURCE = readFileSync(resolve(process.cwd(), 'src/main/ipc/chat.ts'), 'utf8')
const CLAUDE_SOURCE = readFileSync(resolve(process.cwd(), 'src/main/chat/providers/claude.ts'), 'utf8')
const CODEX_SOURCE = readFileSync(resolve(process.cwd(), 'src/main/chat/providers/codex.ts'), 'utf8')
const HERMES_SOURCE = readFileSync(resolve(process.cwd(), 'src/main/chat/providers/hermes.ts'), 'utf8')
const OPENCLAW_SOURCE = readFileSync(resolve(process.cwd(), 'src/main/chat/providers/openclaw.ts'), 'utf8')
const OPENCODE_SOURCE = readFileSync(resolve(process.cwd(), 'src/main/chat/providers/opencode.ts'), 'utf8')

describe('CodeSurf prompt conventions — values', () => {
  test('CODESURF_OUTPUT_CONVENTION contains all three required sections', () => {
    expect(CODESURF_OUTPUT_CONVENTION).toContain('Default to a short natural-language completion')
    expect(CODESURF_OUTPUT_CONVENTION).toContain('Do NOT use the structured card for trivial changes')
    expect(CODESURF_OUTPUT_CONVENTION).toContain('CHANGES MADE:')
    expect(CODESURF_OUTPUT_CONVENTION).toContain("DIDN'T TOUCH:")
    expect(CODESURF_OUTPUT_CONVENTION).toContain('CONCERNS:')
  })

  test('CODESURF_INSIGHT_CONVENTION is opt-in and keeps the literal star-framed container', () => {
    expect(CODESURF_INSIGHT_CONVENTION).toContain('Do not emit an Insight block unless the user explicitly asks')
    // The exact framing must survive — the chat renderer matches on these
    // characters. Changing the framing means updating the renderer too.
    expect(CODESURF_INSIGHT_CONVENTION).toContain('★ Insight ─────────────────────────────────────')
    expect(CODESURF_INSIGHT_CONVENTION).toContain('─────────────────────────────────────────────────')
  })

  test('builder helpers return their respective constants', () => {
    assert.equal(buildCodeSurfOutputConvention(), CODESURF_OUTPUT_CONVENTION)
    assert.equal(buildCodeSurfInsightConvention(), CODESURF_INSIGHT_CONVENTION)
  })

  test('joinPromptSections joins trimmed non-empty sections and drops blanks/nullish', () => {
    assert.equal(joinPromptSections('a', '', null, undefined, '  b  '), 'a\n\nb')
    assert.equal(joinPromptSections('', null, undefined), undefined)
    assert.equal(joinPromptSections('only'), 'only')
  })
})

describe('CodeSurf prompt conventions — provider wiring', () => {
  function extractFunction(source: string, sourceLabel: string, name: string): string {
    const re = new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`)
    const match = source.match(re)
    assert.ok(match, `expected to find function ${name}(...) in ${sourceLabel}`)
    return match![0]
  }

  test('Claude prompt builder injects output convention but not automatic insights', () => {
    const block = extractFunction(CLAUDE_SOURCE, 'claude.ts', 'buildClaudeAgentPrompt')
    expect(block).toContain('buildCodeSurfOutputConvention')
    expect(block).not.toContain('buildCodeSurfInsightConvention')
    expect(block).toContain('joinPromptSections')
  })

  test('Codex prompt builder injects output convention but not automatic insights', () => {
    const block = extractFunction(CODEX_SOURCE, 'codex.ts', 'buildCodexPrompt')
    expect(block).toContain('buildCodeSurfOutputConvention')
    expect(block).not.toContain('buildCodeSurfInsightConvention')
    expect(block).toContain('joinPromptSections')
  })

  test('OpenCode prepends only the output convention on the first turn of a fresh session', () => {
    assert.match(
      OPENCODE_SOURCE,
      /const isFirstTurn = !existingSessionId[\s\S]{0,400}buildCodeSurfOutputConvention\(\)[\s\S]{0,80}---/,
    )
  })

  test('OpenClaw prepends only the output convention on the first turn', () => {
    assert.match(
      OPENCLAW_SOURCE,
      /openClawIsFirstTurn[\s\S]{0,400}buildCodeSurfOutputConvention\(\)[\s\S]{0,80}---/,
    )
  })

  test('Hermes prepends only the output convention on the first turn', () => {
    assert.match(
      HERMES_SOURCE,
      /hermesIsFirstTurn[\s\S]{0,400}buildCodeSurfOutputConvention\(\)[\s\S]{0,80}---/,
    )
  })

  test('normal provider prompt wiring never calls the insight convention helper', () => {
    const normalPromptPath = [
      extractFunction(CLAUDE_SOURCE, 'claude.ts', 'buildClaudeAgentPrompt'),
      extractFunction(CODEX_SOURCE, 'codex.ts', 'buildCodexPrompt'),
    ].join('\n')
    expect(normalPromptPath).not.toContain('buildCodeSurfInsightConvention')
    assert.doesNotMatch(
      [CHAT_SOURCE, OPENCODE_SOURCE].join('\n'),
      /buildCodeSurfOutputConvention\(\)[\s\S]{0,200}buildCodeSurfInsightConvention\(\)/,
    )
  })
})

describe('CodeSurf prompt conventions — token budget guardrails', () => {
  test('combined conventions stay within a reasonable size budget', () => {
    // Rough budget: the two convention strings together should stay under
    // ~6000 chars (~1500 tokens). Going above hints at prompt bloat that will
    // hurt every turn across every provider.
    const combined = CODESURF_OUTPUT_CONVENTION.length + CODESURF_INSIGHT_CONVENTION.length
    assert.ok(
      combined < 6000,
      `combined convention text is ${combined} chars — over the 6000 soft ceiling`,
    )
  })
})
