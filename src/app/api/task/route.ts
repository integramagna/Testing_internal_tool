import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { resolveIdentity } from '@/lib/identity'

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity

  let body: { text?: unknown; remindAt?: unknown; rawInput?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const remindAt = typeof body.remindAt === 'string' ? new Date(body.remindAt) : null
  const rawInput = typeof body.rawInput === 'string' ? body.rawInput : undefined

  if (!text || !remindAt || Number.isNaN(remindAt.getTime())) {
    return Response.json({ error: 'invalid_task' }, { status: 400 })
  }

  const task = await payload.create({
    collection: 'tasks',
    data: {
      owner: user.id,
      createdBy: user.id,
      text,
      remindAt: remindAt.toISOString(),
      status: 'pending',
      character: 'pip',
      rawInput,
    },
  })

  return Response.json({ ok: true, task })
}
