import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { logAudit } from '@/lib/auditLog'
import {
  getCurrentSlotDateKey,
  getEffectiveReportDelayMinutes,
  getISTDateString,
  getISTDayCode,
  isTestMode,
  istDateTimeToInstant,
} from '@/lib/istTime'
import { computeSlotWindow, isMemberOnLeave, isSkippableDay, shouldTriggerReport } from '@/lib/scheduler'

export const POST = async (request: Request) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config: configPromise })
  const now = new Date()

  const istDate = getISTDateString(now)
  const istDay = getISTDayCode(now)
  const dateKey = getCurrentSlotDateKey(now)

  const holidayResult = await payload.find({
    collection: 'holidays',
    where: { date: { equals: istDate } },
    limit: 1,
  })

  if (isSkippableDay(istDay, istDate, holidayResult.docs.map((h) => h.date))) {
    return Response.json({ skipped: istDay === 'sun' ? 'sunday' : 'holiday' })
  }

  const [slotsResult, departmentsResult] = await Promise.all([
    payload.find({ collection: 'slots', where: { active: { equals: true } }, limit: 100 }),
    payload.find({ collection: 'departments', where: { active: { equals: true } }, limit: 200 }),
  ])

  const departmentsById = new Map(departmentsResult.docs.map((d) => [d.id, d]))

  let processed = 0

  for (const slot of slotsResult.docs) {
    if (!(slot.days as string[] | null | undefined)?.includes(istDay)) continue

    const slotDepartmentId =
      typeof slot.department === 'object' ? (slot.department?.id ?? null) : slot.department

    const targetDepartments = slotDepartmentId
      ? [departmentsById.get(slotDepartmentId)].filter((d): d is NonNullable<typeof d> => Boolean(d))
      : [...departmentsById.values()]

    for (const department of targetDepartments) {
      const openInstant = isTestMode() ? now : istDateTimeToInstant(istDate, slot.time)
      if (now < openInstant) continue

      const membersResult = await payload.find({
        collection: 'users',
        where: {
          department: { equals: department.id },
          role: { equals: 'member' },
          status: { equals: 'active' },
        },
        limit: 500,
        depth: 0,
      })

      const applicableMembers = membersResult.docs.filter(
        (m) => !isMemberOnLeave(m.pausedUntil, istDate),
      )

      if (applicableMembers.length === 0) continue

      const existingRun = await payload.find({
        collection: 'slotRuns',
        where: {
          department: { equals: department.id },
          slot: { equals: slot.id },
          date: { equals: dateKey },
        },
        limit: 1,
      })

      const slotRun =
        existingRun.docs[0] ??
        (await payload.create({
          collection: 'slotRuns',
          data: {
            department: department.id,
            slot: slot.id,
            date: dateKey,
            openedAt: openInstant.toISOString(),
          },
        }))

      if (slotRun.reportSentAt) continue

      const effectiveDelay = getEffectiveReportDelayMinutes(department.reportDelayMinutes ?? 15)
      const openedAt = slotRun.openedAt ? new Date(slotRun.openedAt) : openInstant
      const { cutoffInstant } = computeSlotWindow(openedAt, effectiveDelay)

      const updatesResult = await payload.find({
        collection: 'updates',
        where: {
          department: { equals: department.id },
          slot: { equals: slot.id },
          date: { equals: dateKey },
        },
        limit: 500,
        depth: 0,
      })

      const submittedUserIds = new Set(
        updatesResult.docs.filter((u) => u.status).map((u) => String(u.user)),
      )

      const allSubmitted = applicableMembers.every((m) => submittedUserIds.has(String(m.id)))

      if (shouldTriggerReport(allSubmitted, now, cutoffInstant)) {
        for (const member of applicableMembers) {
          if (submittedUserIds.has(String(member.id))) continue

          const existing = updatesResult.docs.find((u) => String(u.user) === String(member.id))

          if (existing) {
            await payload.update({
              collection: 'updates',
              id: existing.id,
              data: { status: 'missed' },
            })
          } else {
            await payload.create({
              collection: 'updates',
              data: {
                user: member.id,
                department: department.id,
                slot: slot.id,
                date: dateKey,
                status: 'missed',
              },
            })
          }
        }

        const noLead = !department.lead

        if (noLead) {
          await logAudit(payload, 'no_lead', `No lead for department ${department.name}`, {
            departmentId: department.id,
            slotId: slot.id,
            date: dateKey,
          })
        }

        await payload.update({
          collection: 'slotRuns',
          id: slotRun.id,
          data: { reportSentAt: now.toISOString(), noLead },
        })
      }

      processed += 1
    }
  }

  const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const staleTasks = await payload.find({
    collection: 'tasks',
    where: {
      status: { equals: 'pending' },
      remindAt: { less_than: staleCutoff.toISOString() },
    },
    limit: 500,
    depth: 0,
  })

  for (const task of staleTasks.docs) {
    await payload.update({ collection: 'tasks', id: task.id, data: { status: 'expired' } })
  }

  return Response.json({ ok: true, istDate, istDay, dateKey, processed, expiredTasks: staleTasks.docs.length })
}
