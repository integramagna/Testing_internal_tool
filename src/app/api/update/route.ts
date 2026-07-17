import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { resolveIdentity } from '@/lib/identity'
import {
  getCurrentSlotDateKey,
  getEffectiveReportDelayMinutes,
  getISTDateString,
  istDateTimeToInstant,
  isTestMode,
} from '@/lib/istTime'
import { computeSlotWindow } from '@/lib/scheduler'

interface UpdateRequestBody {
  slotId?: unknown
  text?: unknown
  blocked?: unknown
  blockedReason?: unknown
  snooze?: unknown
}

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity

  let body: UpdateRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const slotId = typeof body.slotId === 'number' ? body.slotId : Number(body.slotId)
  if (!slotId || Number.isNaN(slotId)) {
    return Response.json({ error: 'missing_slot' }, { status: 400 })
  }

  const slot = await payload.findByID({ collection: 'slots', id: slotId, depth: 0 }).catch(() => null)
  if (!slot || !slot.active) {
    return Response.json({ error: 'slot_not_found' }, { status: 404 })
  }

  const department = user.department && typeof user.department === 'object' ? user.department : null

  const now = new Date()
  const dateKey = getCurrentSlotDateKey(now)

  const existing = await payload.find({
    collection: 'updates',
    where: {
      user: { equals: user.id },
      slot: { equals: slot.id },
      date: { equals: dateKey },
    },
    limit: 1,
  })

  if (body.snooze === true) {
    const currentCount = existing.docs[0]?.snoozeCount ?? 0
    if (currentCount >= 3) {
      return Response.json({ ok: false, error: 'snooze_limit_reached' }, { status: 400 })
    }

    const snoozed = existing.docs[0]
      ? await payload.update({
          collection: 'updates',
          id: existing.docs[0].id,
          data: { snoozeCount: currentCount + 1 },
        })
      : await payload.create({
          collection: 'updates',
          data: {
            user: user.id,
            slot: slot.id,
            date: dateKey,
            department: department?.id ?? null,
            snoozeCount: 1,
          },
        })

    return Response.json({ ok: true, snoozeCount: snoozed.snoozeCount })
  }

  const istDate = getISTDateString(now)
  const openInstant = isTestMode() ? now : istDateTimeToInstant(istDate, slot.time)
  const effectiveDelay = getEffectiveReportDelayMinutes(department?.reportDelayMinutes ?? 15)
  const { cutoffInstant } = computeSlotWindow(openInstant, effectiveDelay)
  const status: 'submitted' | 'late' = now <= cutoffInstant ? 'submitted' : 'late'

  const text = typeof body.text === 'string' ? body.text.slice(0, 2000) : undefined
  const blocked = body.blocked === true
  const blockedReason = typeof body.blockedReason === 'string' ? body.blockedReason : undefined

  const data = {
    text,
    blocked,
    blockedReason,
    submittedAt: now.toISOString(),
    status,
    department: department?.id ?? null,
  }

  const updated = existing.docs[0]
    ? await payload.update({ collection: 'updates', id: existing.docs[0].id, data })
    : await payload.create({
        collection: 'updates',
        data: { ...data, user: user.id, slot: slot.id, date: dateKey },
      })

  return Response.json({ ok: true, status: updated.status })
}
