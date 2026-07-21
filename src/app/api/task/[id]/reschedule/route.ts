import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { resolveIdentity } from '@/lib/identity'

const DEFAULT_SNOOZE_MS = 30 * 60_000

export const POST = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity
  const { id } = await context.params

  let body: { remindAt?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const task = await payload.findByID({ collection: 'tasks', id: Number(id), depth: 0 }).catch(() => null)
  if (!task) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const ownerId = typeof task.owner === 'object' ? task.owner.id : task.owner
  if (ownerId !== user.id) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  if (task.character !== 'pip' || task.status !== 'pending') {
    return Response.json({ error: 'not_reschedulable' }, { status: 400 })
  }

  const requested = typeof body.remindAt === 'string' ? new Date(body.remindAt) : null
  const remindAt =
    requested && !Number.isNaN(requested.getTime()) ? requested : new Date(Date.now() + DEFAULT_SNOOZE_MS)

  const updated = await payload.update({
    collection: 'tasks',
    id: task.id,
    data: { remindAt: remindAt.toISOString() },
  })

  return Response.json({ ok: true, task: updated })
}
