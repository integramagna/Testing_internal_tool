import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { authorizeDispatchTarget, parseOwnerIds } from '@/lib/dispatchAuth'
import { resolveIdentity } from '@/lib/identity'

interface DispatchRequestBody {
  ownerId?: unknown
  ownerIds?: unknown
  text?: unknown
}

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity

  let body: DispatchRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const ownerIds = [...new Set(parseOwnerIds(body))].filter((id) => id !== user.id)

  if (ownerIds.length === 0 || !text) {
    return Response.json({ error: 'invalid_dispatch' }, { status: 400 })
  }

  const results: { ownerId: number; ok: boolean; error?: string }[] = []

  for (const ownerId of ownerIds) {
    const owner = await payload.findByID({ collection: 'users', id: ownerId, depth: 0 }).catch(() => null)

    if (!owner) {
      results.push({ ownerId, ok: false, error: 'owner_not_found' })
      continue
    }

    const authResult = await authorizeDispatchTarget(payload, user, owner)
    if (!authResult.ok) {
      results.push({ ownerId, ok: false, error: authResult.error })
      continue
    }

    await payload.create({
      collection: 'tasks',
      data: {
        owner: owner.id,
        createdBy: user.id,
        text,
        remindAt: new Date().toISOString(),
        status: 'pending',
        character: 'bolt',
      },
    })

    results.push({ ownerId, ok: true })
  }

  const sentCount = results.filter((r) => r.ok).length

  if (sentCount === 0) {
    return Response.json({ ok: false, error: results[0]?.error ?? 'forbidden', results }, { status: 403 })
  }

  return Response.json({ ok: true, sentCount, results })
}
