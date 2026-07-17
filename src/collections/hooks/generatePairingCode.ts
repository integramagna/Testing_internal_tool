import type { FieldHook } from 'payload'

const generateSixDigitCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export const generatePairingCode: FieldHook = async ({ operation, value, req }) => {
  if (operation !== 'create') {
    return value
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = generateSixDigitCode()

    const existing = await req.payload.find({
      collection: 'users',
      where: { pairingCode: { equals: candidate } },
      limit: 1,
      depth: 0,
      req,
    })

    if (existing.docs.length === 0) {
      return candidate
    }
  }

  throw new Error('Could not generate a unique pairing code after 20 attempts')
}
