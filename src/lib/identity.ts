import type { Payload } from 'payload'

import type { User } from '@/payload-types'
import { verifyDeviceToken } from './deviceAuth'

export type IdentityFailureReason =
  | 'missing_token'
  | 'invalid_token'
  | 'device_mismatch'
  | 'left'

export type IdentityResult =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403; reason: IdentityFailureReason }

export const resolveIdentity = async (
  payload: Payload,
  request: Request,
): Promise<IdentityResult> => {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

  if (!token) {
    return { ok: false, status: 401, reason: 'missing_token' }
  }

  const devicePayload = verifyDeviceToken(token)
  if (!devicePayload) {
    return { ok: false, status: 401, reason: 'invalid_token' }
  }

  let user: User
  try {
    user = await payload.findByID({
      collection: 'users',
      id: devicePayload.userId,
      depth: 1,
    })
  } catch {
    return { ok: false, status: 401, reason: 'device_mismatch' }
  }

  if (!user || user.deviceId !== devicePayload.deviceId) {
    return { ok: false, status: 401, reason: 'device_mismatch' }
  }

  if (user.status === 'left') {
    return { ok: false, status: 403, reason: 'left' }
  }

  return { ok: true, user }
}
