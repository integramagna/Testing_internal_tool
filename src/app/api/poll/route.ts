import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { resolveIdentity } from '@/lib/identity'
import {
  getCurrentSlotDateKey,
  getEffectiveReportDelayMinutes,
  getISTDateString,
  getISTDayCode,
  isWithinQuietHoursExemptWindow,
} from '@/lib/istTime'
import { buildReport } from '@/lib/report'
import { getLedDepartmentIds, relationId } from '@/lib/relation'
import { computeSlotWindow, isMemberOnLeave } from '@/lib/scheduler'
import type { Slot, SlotRun, User } from '@/payload-types'

const deliverReport = async (payload: Payload, slotRun: SlotRun, now: Date) => {
  const slotId = relationId(slotRun.slot)
  const departmentId = relationId(slotRun.department)
  if (!slotId || !departmentId) return null

  const slot = await payload.findByID({ collection: 'slots', id: slotId, depth: 0 })
  const istDate = getISTDateString(now)
  const { summary, items } = await buildReport(payload, departmentId, slot, slotRun.date, istDate)

  await payload.update({
    collection: 'slotRuns',
    id: slotRun.id,
    data: { reportDeliveredAt: now.toISOString() },
  })

  return {
    action: 'show_report' as const,
    character: 'nimbus' as const,
    slotLabel: slot.label ?? slot.time,
    summary,
    items,
  }
}

const checkShowReport = async (payload: Payload, user: User, now: Date) => {
  if (user.role === 'lead') {
    const departmentIds = await getLedDepartmentIds(payload, user.id)
    if (departmentIds.length === 0) return null

    const result = await payload.find({
      collection: 'slotRuns',
      where: {
        department: { in: departmentIds },
        reportSentAt: { exists: true },
        reportDeliveredAt: { exists: false },
        noLead: { equals: false },
      },
      sort: 'reportSentAt',
      limit: 1,
    })

    if (!result.docs[0]) return null
    return deliverReport(payload, result.docs[0], now)
  }

  if (user.role === 'admin') {
    const result = await payload.find({
      collection: 'slotRuns',
      where: {
        reportSentAt: { exists: true },
        reportDeliveredAt: { exists: false },
        noLead: { equals: true },
      },
      sort: 'reportSentAt',
      limit: 1,
    })

    if (!result.docs[0]) return null
    return deliverReport(payload, result.docs[0], now)
  }

  return null
}

const checkRemindTask = async (payload: Payload, user: User, now: Date) => {
  const result = await payload.find({
    collection: 'tasks',
    where: {
      owner: { equals: user.id },
      status: { equals: 'pending' },
      character: { equals: 'pip' },
      remindAt: { less_than_equal: now.toISOString() },
    },
    sort: 'remindAt',
    limit: 1,
  })

  const task = result.docs[0]
  if (!task) return null

  return {
    action: 'remind_task' as const,
    character: 'pip' as const,
    taskId: String(task.id),
    text: `${task.text} in 5 minutes!`,
  }
}

const checkDispatchTask = async (payload: Payload, user: User, now: Date) => {
  const result = await payload.find({
    collection: 'tasks',
    where: {
      owner: { equals: user.id },
      status: { equals: 'pending' },
      character: { equals: 'bolt' },
      remindAt: { less_than_equal: now.toISOString() },
    },
    sort: 'remindAt',
    limit: 1,
    depth: 1,
  })

  const task = result.docs[0]
  if (!task) return null

  const fromName = task.createdBy && typeof task.createdBy === 'object' ? task.createdBy.name : 'your lead'
  const fromUserId = relationId(task.createdBy)

  return {
    action: 'dispatch' as const,
    character: 'bolt' as const,
    taskId: String(task.id),
    from: fromName,
    fromUserId: fromUserId ? String(fromUserId) : null,
    text: task.text,
  }
}

const checkMemberAction = async (payload: Payload, user: User, now: Date) => {
  const departmentId = relationId(user.department)
  if (!departmentId) return null

  const istDate = getISTDateString(now)
  const istDay = getISTDayCode(now)
  const dateKey = getCurrentSlotDateKey(now)

  if (isMemberOnLeave(user.pausedUntil, istDate)) return null

  const slotsResult = await payload.find({
    collection: 'slots',
    where: {
      active: { equals: true },
      or: [{ department: { equals: departmentId } }, { department: { exists: false } }],
    },
    limit: 50,
  })

  const applicableSlots = slotsResult.docs.filter((s: Slot) =>
    (s.days as string[] | null | undefined)?.includes(istDay),
  )

  for (const slot of applicableSlots) {
    const slotRunResult = await payload.find({
      collection: 'slotRuns',
      where: {
        department: { equals: departmentId },
        slot: { equals: slot.id },
        date: { equals: dateKey },
      },
      limit: 1,
    })

    const slotRun = slotRunResult.docs[0]
    if (!slotRun || slotRun.reportSentAt) continue

    const updateResult = await payload.find({
      collection: 'updates',
      where: {
        user: { equals: user.id },
        slot: { equals: slot.id },
        date: { equals: dateKey },
      },
      limit: 1,
    })

    const existingUpdate = updateResult.docs[0]
    if (existingUpdate?.status) continue

    const department = await payload.findByID({
      collection: 'departments',
      id: departmentId,
      depth: 1,
    })
    const effectiveDelay = getEffectiveReportDelayMinutes(department.reportDelayMinutes ?? 15)
    const openedAt = slotRun.openedAt ? new Date(slotRun.openedAt) : now
    const { escalationInstant } = computeSlotWindow(openedAt, effectiveDelay)

    if (now >= escalationInstant && !existingUpdate?.escalatedAt) {
      if (existingUpdate) {
        await payload.update({
          collection: 'updates',
          id: existingUpdate.id,
          data: { escalatedAt: now.toISOString() },
        })
      } else {
        await payload.create({
          collection: 'updates',
          data: {
            user: user.id,
            department: departmentId,
            slot: slot.id,
            date: dateKey,
            escalatedAt: now.toISOString(),
          },
        })
      }

      const leadName =
        department.lead && typeof department.lead === 'object' ? department.lead.name : 'your lead'

      return {
        action: 'escalation_warning' as const,
        character: 'nimbus' as const,
        slotId: String(slot.id),
        text: `Heads up — the report goes to ${leadName} in 5 minutes. Want to send it now?`,
      }
    }

    const snoozeCount = existingUpdate?.snoozeCount ?? 0
    if (snoozeCount >= 3) continue

    return {
      action: 'ask_update' as const,
      character: 'nimbus' as const,
      slotId: String(slot.id),
      slotLabel: slot.label ?? slot.time,
      text: `Hey ${user.name}! What's your ${slot.label ?? slot.time} update?`,
    }
  }

  return null
}

export const GET = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { lastSeenAt: new Date().toISOString() },
  })

  if (user.status === 'pending') {
    return Response.json({ action: 'not_registered' })
  }

  const now = new Date()

  const dispatchAction = await checkDispatchTask(payload, user, now)
  if (dispatchAction) return Response.json(dispatchAction)

  if (isWithinQuietHoursExemptWindow(now)) {
    const taskAction = await checkRemindTask(payload, user, now)
    if (taskAction) return Response.json(taskAction)

    if (user.role === 'lead' || user.role === 'admin') {
      const showReportAction = await checkShowReport(payload, user, now)
      if (showReportAction) return Response.json(showReportAction)
    }

    if (user.role === 'member') {
      const memberAction = await checkMemberAction(payload, user, now)
      if (memberAction) return Response.json(memberAction)
    }
  }

  return Response.json({ action: 'none' })
}
