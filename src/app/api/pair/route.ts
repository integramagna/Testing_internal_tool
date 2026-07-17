import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { logAudit } from '@/lib/auditLog'
import { signDeviceToken } from '@/lib/deviceAuth'

interface PairRequestBody {
  code?: unknown
  deviceInfo?: unknown
}

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })

  let body: PairRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return Response.json({ error: 'missing_code' }, { status: 400 })
  }

  const found = await payload.find({
    collection: 'users',
    where: { pairingCode: { equals: code } },
    limit: 1,
    depth: 1,
  })

  const user = found.docs[0]

  if (!user) {
    await logAudit(payload, 'pair_failed', 'No user found for pairing code', {
      code,
      deviceInfo: body.deviceInfo ?? null,
    })
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  if (user.status === 'left') {
    return Response.json({ error: 'left' }, { status: 403 })
  }

  if (user.deviceId && !user.allowRePair) {
    await logAudit(payload, 'repair_blocked', `Re-pair blocked for ${user.email}`, {
      userId: user.id,
      deviceInfo: body.deviceInfo ?? null,
    })
    return Response.json(
      {
        error: 'already_paired',
        message: 'Already paired on another device — ask your admin.',
      },
      { status: 409 },
    )
  }

  const deviceId = crypto.randomUUID()

  const updated = await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      deviceId,
      lastPairedAt: new Date().toISOString(),
      allowRePair: false,
    },
    depth: 1,
  })

  const token = signDeviceToken({ userId: updated.id, deviceId })

  const department =
    updated.department && typeof updated.department === 'object'
      ? { id: updated.department.id, name: updated.department.name }
      : null

  return Response.json({
    token,
    identity: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      department,
    },
  })
}
