import { describe, it, expect } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'

import { authorizeDispatchTarget, parseOwnerIds } from '@/lib/dispatchAuth'

describe('parseOwnerIds', () => {
  it('reads a single ownerId', () => {
    expect(parseOwnerIds({ ownerId: 5 })).toEqual([5])
  })

  it('reads a plural ownerIds array, coercing string numbers', () => {
    expect(parseOwnerIds({ ownerIds: [1, '2', 3] })).toEqual([1, 2, 3])
  })

  it('drops invalid entries (non-numeric, zero, negative)', () => {
    expect(parseOwnerIds({ ownerIds: [1, 'not-a-number', 0, -3, 4] })).toEqual([1, 4])
  })

  it('prefers ownerIds over ownerId when both are present', () => {
    expect(parseOwnerIds({ ownerId: 99, ownerIds: [1, 2] })).toEqual([1, 2])
  })

  it('returns an empty array when neither is present', () => {
    expect(parseOwnerIds({})).toEqual([])
  })
})

const makeUser = (overrides: Partial<User>): User =>
  ({
    id: 1,
    name: 'Test User',
    role: 'member',
    status: 'active',
    email: 'test@example.com',
    updatedAt: '',
    createdAt: '',
    ...overrides,
  }) as User

const makeFakePayload = (priorDispatchExists: boolean) => {
  const payload = {
    find: async ({ collection }: { collection: string }) => {
      if (collection !== 'tasks') throw new Error(`unexpected collection ${collection}`)
      return { docs: priorDispatchExists ? [{ id: 1 }] : [] }
    },
  }
  return payload as unknown as Payload
}

describe('authorizeDispatchTarget', () => {
  it('rejects a target whose status is not active, regardless of sender role', async () => {
    const sender = makeUser({ id: 1, role: 'admin' })
    const target = makeUser({ id: 2, role: 'member', status: 'left' })
    const payload = makeFakePayload(false)

    const result = await authorizeDispatchTarget(payload, sender, target)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('recipient_inactive')
  })

  it('allows an admin to message any active user with no further checks', async () => {
    const sender = makeUser({ id: 1, role: 'admin' })
    const target = makeUser({ id: 2, role: 'member', status: 'active' })
    const payload = makeFakePayload(false)

    const result = await authorizeDispatchTarget(payload, sender, target)
    expect(result.ok).toBe(true)
  })

  it('allows a lead to message any active user company-wide with no further checks', async () => {
    const sender = makeUser({ id: 1, role: 'lead' })
    const target = makeUser({ id: 2, role: 'member', status: 'active' })
    const payload = makeFakePayload(false)

    const result = await authorizeDispatchTarget(payload, sender, target)
    expect(result.ok).toBe(true)
  })

  it('allows a member to reply to someone who has already dispatched to them', async () => {
    const sender = makeUser({ id: 1, role: 'member' })
    const target = makeUser({ id: 2, role: 'lead', status: 'active' })
    const payload = makeFakePayload(true)

    const result = await authorizeDispatchTarget(payload, sender, target)
    expect(result.ok).toBe(true)
  })

  it('rejects a member trying to message someone who never messaged them first', async () => {
    const sender = makeUser({ id: 1, role: 'member' })
    const target = makeUser({ id: 2, role: 'member', status: 'active' })
    const payload = makeFakePayload(false)

    const result = await authorizeDispatchTarget(payload, sender, target)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('forbidden')
  })
})
