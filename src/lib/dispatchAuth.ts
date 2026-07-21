import type { Payload } from 'payload'

import type { User } from '@/payload-types'

export const parseOwnerIds = (body: { ownerId?: unknown; ownerIds?: unknown }): number[] => {
  if (Array.isArray(body.ownerIds)) {
    return body.ownerIds
      .map((id) => (typeof id === 'number' ? id : Number(id)))
      .filter((id) => Number.isFinite(id) && id > 0)
  }
  const single = typeof body.ownerId === 'number' ? body.ownerId : Number(body.ownerId)
  return Number.isFinite(single) && single > 0 ? [single] : []
}

export type DispatchAuthResult = { ok: true } | { ok: false; error: 'recipient_inactive' | 'forbidden' }

export const authorizeDispatchTarget = async (
  payload: Payload,
  sender: User,
  target: User,
): Promise<DispatchAuthResult> => {
  if (target.status !== 'active') {
    return { ok: false, error: 'recipient_inactive' }
  }

  if (sender.role === 'member') {
    const priorDispatch = await payload.find({
      collection: 'tasks',
      where: {
        owner: { equals: sender.id },
        createdBy: { equals: target.id },
        character: { equals: 'bolt' },
      },
      limit: 1,
    })

    if (priorDispatch.docs.length === 0) {
      return { ok: false, error: 'forbidden' }
    }
  }

  return { ok: true }
}
