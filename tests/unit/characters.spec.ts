import { describe, it, expect } from 'vitest'
import type { Payload } from 'payload'

import { DEFAULT_CHARACTER_NAMES, getCharacterDisplayNames } from '@/lib/characters'

interface FakeCharacterDoc {
  roleSlug: string
  displayName?: string
  active?: boolean
}

const makeFakePayload = (docs: FakeCharacterDoc[]) => {
  const payload = {
    find: async ({
      collection,
      where,
    }: {
      collection: string
      where: { active?: { equals: boolean } }
    }) => {
      if (collection !== 'characters') throw new Error(`unexpected collection ${collection}`)
      const activeFilter = where.active?.equals
      const filtered =
        typeof activeFilter === 'boolean' ? docs.filter((d) => (d.active ?? true) === activeFilter) : docs
      return { docs: filtered }
    },
  }
  return payload as unknown as Payload
}

describe('getCharacterDisplayNames', () => {
  it('resolves configured display names by roleSlug', async () => {
    const payload = makeFakePayload([
      { roleSlug: 'reminders', displayName: 'Bibi', active: true },
      { roleSlug: 'reports', displayName: 'Ranger', active: true },
      { roleSlug: 'dispatch', displayName: 'Dash', active: true },
    ])

    const names = await getCharacterDisplayNames(payload)

    expect(names).toEqual({ reminders: 'Bibi', reports: 'Ranger', dispatch: 'Dash' })
  })

  it('falls back to the hardcoded Coco/Scout/Zip defaults when the collection is empty', async () => {
    const payload = makeFakePayload([])
    const names = await getCharacterDisplayNames(payload)
    expect(names).toEqual(DEFAULT_CHARACTER_NAMES)
    expect(names).toEqual({ reminders: 'Coco', reports: 'Scout', dispatch: 'Zip' })
  })

  it('falls back per-role when a single character has a blank display name', async () => {
    const payload = makeFakePayload([
      { roleSlug: 'reminders', displayName: 'Bibi', active: true },
      { roleSlug: 'reports', displayName: '', active: true },
    ])

    const names = await getCharacterDisplayNames(payload)

    expect(names.reminders).toBe('Bibi')
    expect(names.reports).toBe(DEFAULT_CHARACTER_NAMES.reports)
    expect(names.dispatch).toBe(DEFAULT_CHARACTER_NAMES.dispatch)
  })

  it('ignores an inactive character doc and falls back for that role', async () => {
    const payload = makeFakePayload([{ roleSlug: 'reminders', displayName: 'Bibi', active: false }])

    const names = await getCharacterDisplayNames(payload)

    expect(names.reminders).toBe(DEFAULT_CHARACTER_NAMES.reminders)
  })

  it('falls back entirely if the lookup throws', async () => {
    const payload = { find: async () => { throw new Error('db down') } } as unknown as Payload

    const names = await getCharacterDisplayNames(payload)
    expect(names).toEqual(DEFAULT_CHARACTER_NAMES)
  })

  it('always keys the result by the three fixed roleSlugs, never by the editable display name', async () => {
    const payload = makeFakePayload([
      { roleSlug: 'reminders', displayName: 'A Completely Different Name', active: true },
      { roleSlug: 'reports', displayName: 'Another Name Entirely', active: true },
      { roleSlug: 'dispatch', displayName: 'Yet Another', active: true },
    ])

    const names = await getCharacterDisplayNames(payload)

    expect(Object.keys(names).sort()).toEqual(['dispatch', 'reminders', 'reports'])
  })
})
