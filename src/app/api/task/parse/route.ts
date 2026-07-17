import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { parseWithFallback } from '@/lib/gemini'
import { resolveIdentity } from '@/lib/identity'

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  let body: { rawInput?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const rawInput = typeof body.rawInput === 'string' ? body.rawInput.trim() : ''
  if (!rawInput) {
    return Response.json({ error: 'missing_raw_input' }, { status: 400 })
  }

  const result = await parseWithFallback(rawInput, new Date(), payload)

  return Response.json(result)
}
