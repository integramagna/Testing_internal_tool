import type { Payload } from 'payload'

export type AuditLogType = 'pair_failed' | 'gemini_failed' | 'no_lead' | 'repair_blocked' | 'other'

export const logAudit = async (
  payload: Payload,
  type: AuditLogType,
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> => {
  await payload.create({
    collection: 'auditLog',
    data: {
      type,
      message,
      meta: meta ?? null,
    },
  })
}
