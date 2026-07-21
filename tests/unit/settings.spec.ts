import { describe, it, expect } from 'vitest'
import type { Payload } from 'payload'

import { getSupportContactName } from '@/lib/settings'

const makeFakePayload = (global: { supportContactName?: string } | null) => {
  const payload = {
    findGlobal: async ({ slug }: { slug: string }) => {
      if (slug !== 'settings') throw new Error(`unexpected global ${slug}`)
      if (!global) throw new Error('not found')
      return global
    },
  }
  return payload as unknown as Payload
}

describe('getSupportContactName', () => {
  it('returns the configured contact name', async () => {
    const payload = makeFakePayload({ supportContactName: 'Priya' })
    expect(await getSupportContactName(payload)).toBe('Priya')
  })

  it('falls back to Veer when the global is empty', async () => {
    const payload = makeFakePayload({ supportContactName: '' })
    expect(await getSupportContactName(payload)).toBe('Veer')
  })

  it('falls back to Veer when the global lookup fails', async () => {
    const payload = makeFakePayload(null)
    expect(await getSupportContactName(payload)).toBe('Veer')
  })
})
