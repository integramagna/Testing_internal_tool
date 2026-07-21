import { describe, it, expect } from 'vitest'

import {
  IDENTITY_REPLY,
  JOKES,
  MOTIVATIONS,
  WHO_IS_GOD_REPLY,
  buildDeclineMessage,
  pickRandom,
} from '@/lib/pipPersonality'

describe('pickRandom', () => {
  it('always returns an item that belongs to the source array', () => {
    for (let i = 0; i < 50; i++) {
      expect(JOKES).toContain(pickRandom(JOKES))
      expect(MOTIVATIONS).toContain(pickRandom(MOTIVATIONS))
    }
  })
})

describe('curated content', () => {
  it('keeps small, non-empty curated sets for jokes and motivations', () => {
    expect(JOKES.length).toBeGreaterThan(1)
    expect(MOTIVATIONS.length).toBeGreaterThan(1)
    expect(JOKES.every((j) => j.trim().length > 0)).toBe(true)
    expect(MOTIVATIONS.every((m) => m.trim().length > 0)).toBe(true)
  })

  it('keeps identity and who-is-god replies fixed, not randomly generated', () => {
    expect(IDENTITY_REPLY.length).toBeGreaterThan(0)
    expect(WHO_IS_GOD_REPLY).toContain('Veer')
  })
})

describe('buildDeclineMessage', () => {
  it('substitutes the given support contact name', () => {
    expect(buildDeclineMessage('Priya')).toBe(
      "I'm Pip - I only handle reminders and a few quick things. For anything else, ask Priya.",
    )
  })

  it('reflects a different support contact name without a hardcoded fallback leaking through', () => {
    const message = buildDeclineMessage('Arjun')
    expect(message).toContain('Arjun')
    expect(message).not.toContain('Veer')
  })
})
