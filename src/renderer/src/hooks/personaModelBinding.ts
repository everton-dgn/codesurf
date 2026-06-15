import type { Persona, PersonaBinding } from '../../../shared/types'

// ─── Persona soft model/provider seeding (P1b-1) ──────────────────────────────
// Dissociates model from persona IDENTITY: a Persona carries at most an OPTIONAL
// soft `defaultBinding` (provider/model). Selecting that persona SEEDS the
// composer's provider/model control; the user remains free to change it.
//
// PRECEDENCE LADDER (model selection):
//   1) [P1b-2, NOT IMPLEMENTED] skill-required model = HARD lock. SEAM: a future
//      resolver runs ABOVE this, short-circuits, and returns a locked result the
//      composer disables. `locked` is reserved on PersonaModelSeed for that.
//   2) Persona soft default = seeds the composer when the persona is selected
//      (this module).
//   3) Composer/user pick = free override; wins over the soft default.
//
// Layer 3 needs NO code here: seeding happens once, at selection time, in the
// onSelectAgent click handler. After that the LIVE composer state is the single
// source of truth — the dispatch path (useChatTileMessaging) builds req.model /
// req.provider from the live `model`/`provider` state and NEVER reads
// `defaultBinding`. That decoupling is what makes the user's pick win. Do NOT add
// a binding fallback at dispatch (it would re-couple model to identity).
//
// model is NOT a security boundary: this never touches resolveAuthoritativeAgentMode
// (the trusted-disk tools/permission path), which stays fail-closed and model-free.

export interface PersonaModelSeed {
  /** Provider id to seed into the composer, if the binding specifies one. */
  provider?: string
  /** Model id to seed into the composer, if the binding specifies one. */
  model?: string
  // SEAM (P1b-2): a hard skill-lock will add `locked?: boolean` (+ reason) here so
  // callers can disable the composer control without reshaping this result.
}

function cleanField(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Resolve the SOFT model seed for a persona (precedence layer 2). Returns null
 * when the persona carries no usable soft default, so the caller leaves the
 * composer untouched (preserving the user's current/saved selection).
 */
export function resolvePersonaModelSeed(persona: Persona | null | undefined): PersonaModelSeed | null {
  const binding: PersonaBinding | undefined = persona?.defaultBinding
  if (!binding) return null
  const provider = cleanField(binding.provider)
  const model = cleanField(binding.model)
  if (!provider && !model) return null
  const seed: PersonaModelSeed = {}
  if (provider) seed.provider = provider
  if (model) seed.model = model
  return seed
}
