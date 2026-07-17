import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { resolveIdentity } from '@/lib/identity'
import { getLedDepartmentIds, relationId } from '@/lib/relation'

interface DispatchRequestBody {
  ownerId?: unknown
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

  const ownerId = typeof body.ownerId === 'number' ? body.ownerId : Number(body.ownerId)
  const text = typeof body.text === 'string' ? body.text.trim() : ''

  if (!ownerId || Number.isNaN(ownerId) || !text) {
    return Response.json({ error: 'invalid_dispatch' }, { status: 400 })
  }

  const owner = await payload
    .findByID({ collection: 'users', id: ownerId, depth: 0 })
    .catch(() => null)

  if (!owner) {
    return Response.json({ error: 'owner_not_found' }, { status: 404 })
  }

  if (user.role === 'lead') {
    const ownerDeptId = relationId(owner.department)
    const ledDepartmentIds = await getLedDepartmentIds(payload, user.id)
    if (!ownerDeptId || !ledDepartmentIds.includes(ownerDeptId)) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  if (user.role === 'member') {
    // Members can't dispatch to arbitrary colleagues, but they can reply to
    // someone who has already dispatched a message to them.
    const priorDispatch = await payload.find({
      collection: 'tasks',
      where: {
        owner: { equals: user.id },
        createdBy: { equals: ownerId },
        character: { equals: 'bolt' },
      },
      limit: 1,
    })

    if (priorDispatch.docs.length === 0) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const task = await payload.create({
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

  return Response.json({ ok: true, task })
}
