import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { resolveIdentity } from '@/lib/identity'

export const POST = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity
  const { id } = await context.params

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (body.status !== 'done' && body.status !== 'dismissed') {
    return Response.json({ error: 'invalid_status' }, { status: 400 })
  }

  const task = await payload.findByID({ collection: 'tasks', id: Number(id), depth: 0 }).catch(() => null)
  if (!task) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const ownerId = typeof task.owner === 'object' ? task.owner.id : task.owner
  if (ownerId !== user.id) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const updated = await payload.update({
    collection: 'tasks',
    id: task.id,
    data: { status: body.status, acknowledgedAt: new Date().toISOString() },
  })

  return Response.json({ ok: true, task: updated })
}
