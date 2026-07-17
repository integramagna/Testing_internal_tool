import jwt from 'jsonwebtoken'

export interface DeviceTokenPayload {
  userId: number
  deviceId: string
}

const getSecret = (): string => {
  const secret = process.env.DEVICE_TOKEN_SECRET
  if (!secret) {
    throw new Error('DEVICE_TOKEN_SECRET is not set')
  }
  return secret
}

export const signDeviceToken = (payload: DeviceTokenPayload): string => {
  return jwt.sign(payload, getSecret())
}

export const verifyDeviceToken = (token: string): DeviceTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, getSecret())
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.userId === 'number' &&
      typeof decoded.deviceId === 'string'
    ) {
      return { userId: decoded.userId, deviceId: decoded.deviceId }
    }
    return null
  } catch {
    return null
  }
}
