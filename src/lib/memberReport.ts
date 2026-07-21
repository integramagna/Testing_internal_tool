import type { Payload } from 'payload'

import type { Update, User } from '@/payload-types'
import { logAudit } from './auditLog'
import { addDaysToDateString, compareDateStrings, getDayCodeForDateString } from './istTime'
import { getLedDepartmentIds, relationId } from './relation'
import { isMemberOnLeave, isSkippableDay } from './scheduler'

export interface SlotConfig {
  id: number
  label?: string | null
  time: string
  days?: string[] | null
  departmentId: number | null
  active?: boolean | null
}

export interface ExpectedSlotDay {
  date: string
  slotId: number
  slotLabel: string
  departmentId: number
}

export const computeExpectedDays = (
  fromDate: string,
  toDate: string,
  departmentId: number,
  slots: SlotConfig[],
  holidayDates: string[],
  pausedUntil: string | null | undefined,
): ExpectedSlotDay[] => {
  const applicableSlots = slots.filter(
    (s) => s.active !== false && (s.departmentId === null || s.departmentId === departmentId),
  )

  const entries: ExpectedSlotDay[] = []
  let cursor = fromDate

  while (compareDateStrings(cursor, toDate) <= 0) {
    const dayCode = getDayCodeForDateString(cursor)

    if (!isSkippableDay(dayCode, cursor, holidayDates) && !isMemberOnLeave(pausedUntil, cursor)) {
      for (const slot of applicableSlots) {
        if (slot.days?.includes(dayCode)) {
          entries.push({
            date: cursor,
            slotId: slot.id,
            slotLabel: slot.label || slot.time,
            departmentId,
          })
        }
      }
    }

    cursor = addDaysToDateString(cursor, 1)
  }

  return entries
}

export interface MemberReportEntry {
  date: string
  slotId: number
  slotLabel: string
  departmentId: number
  status: 'submitted' | 'late' | 'missed'
  text?: string
  blocked?: boolean
  blockedReason?: string
}

export interface MemberReportSummary {
  totalExpected: number
  submitted: number
  late: number
  missed: number
  onTimePercent: number
  blockedDays: number
  topBlockerReason: string | null
}

export const summarizeMemberReport = (entries: MemberReportEntry[]): MemberReportSummary => {
  const totalExpected = entries.length
  const submitted = entries.filter((e) => e.status === 'submitted').length
  const late = entries.filter((e) => e.status === 'late').length
  const missed = entries.filter((e) => e.status === 'missed').length
  const blockedEntries = entries.filter((e) => e.blocked)

  const onTimePercent = totalExpected > 0 ? Math.round((submitted / totalExpected) * 100) : 0

  const reasonCounts = new Map<string, number>()
  for (const entry of blockedEntries) {
    const reason = entry.blockedReason?.trim()
    if (!reason) continue
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
  }

  let topBlockerReason: string | null = null
  let topCount = 0
  for (const [reason, count] of reasonCounts) {
    if (count > topCount) {
      topCount = count
      topBlockerReason = reason
    }
  }

  return {
    totalExpected,
    submitted,
    late,
    missed,
    onTimePercent,
    blockedDays: blockedEntries.length,
    topBlockerReason,
  }
}

export type MemberReportAuthResult =
  | { ok: true; targetUser: User }
  | { ok: false; status: 403; reason: 'not_lead_or_admin' | 'not_own_team' }
  | { ok: false; status: 404; reason: 'not_found' }

export const authorizeMemberReportAccess = async (
  payload: Payload,
  caller: User,
  targetUserId: number,
): Promise<MemberReportAuthResult> => {
  if (caller.role !== 'lead' && caller.role !== 'admin') {
    return { ok: false, status: 403, reason: 'not_lead_or_admin' }
  }

  const targetUser = await payload
    .findByID({ collection: 'users', id: targetUserId, depth: 0 })
    .catch(() => null)

  if (!targetUser) {
    return { ok: false, status: 404, reason: 'not_found' }
  }

  if (caller.role === 'admin') {
    return { ok: true, targetUser }
  }

  const targetDeptId = relationId(targetUser.department)
  const ledDepartmentIds = await getLedDepartmentIds(payload, caller.id)

  if (targetUser.role !== 'member' || !targetDeptId || !ledDepartmentIds.includes(targetDeptId)) {
    await logAudit(payload, 'other', 'Unauthorized member-report request', {
      requestedBy: caller.id,
      targetUserId,
    })
    return { ok: false, status: 403, reason: 'not_own_team' }
  }

  return { ok: true, targetUser }
}

export const buildMemberReportEntries = async (
  payload: Payload,
  targetUser: User,
  fromDate: string,
  toDate: string,
  todayISTDate: string,
): Promise<MemberReportEntry[]> => {
  const departmentId = relationId(targetUser.department)
  if (!departmentId) return []

  const [slotsResult, holidaysResult, updatesResult] = await Promise.all([
    payload.find({ collection: 'slots', where: { active: { equals: true } }, limit: 100, depth: 0 }),
    payload.find({
      collection: 'holidays',
      where: { date: { greater_than_equal: fromDate, less_than_equal: toDate } },
      limit: 200,
      depth: 0,
    }),
    payload.find({
      collection: 'updates',
      where: {
        user: { equals: targetUser.id },
        date: { greater_than_equal: fromDate, less_than_equal: toDate },
      },
      limit: 1000,
      depth: 0,
    }),
  ])

  const slotConfigs: SlotConfig[] = slotsResult.docs.map((s) => ({
    id: s.id,
    label: s.label,
    time: s.time,
    days: s.days as string[] | null,
    departmentId: relationId(s.department),
    active: s.active,
  }))

  const holidayDates = holidaysResult.docs.map((h) => h.date)

  const expectedDays = computeExpectedDays(
    fromDate,
    toDate,
    departmentId,
    slotConfigs,
    holidayDates,
    targetUser.pausedUntil,
  )

  const updateByDateSlot = new Map<string, Update>()
  for (const update of updatesResult.docs) {
    const slotId = relationId(update.slot)
    if (slotId === null) continue
    updateByDateSlot.set(`${update.date}:${slotId}`, update)
  }

  const entries: MemberReportEntry[] = []

  for (const expected of expectedDays) {
    const update = updateByDateSlot.get(`${expected.date}:${expected.slotId}`)

    if (update && update.status) {
      entries.push({
        date: expected.date,
        slotId: expected.slotId,
        slotLabel: expected.slotLabel,
        departmentId: relationId(update.department) ?? expected.departmentId,
        status: update.status,
        text: update.text ?? undefined,
        blocked: update.blocked ?? undefined,
        blockedReason: update.blockedReason ?? undefined,
      })
      continue
    }

    if (compareDateStrings(expected.date, todayISTDate) < 0) {
      entries.push({
        date: expected.date,
        slotId: expected.slotId,
        slotLabel: expected.slotLabel,
        departmentId: expected.departmentId,
        status: 'missed',
      })
    }
  }

  entries.sort((a, b) => {
    const dateCompare = compareDateStrings(b.date, a.date)
    if (dateCompare !== 0) return dateCompare
    return a.slotLabel.localeCompare(b.slotLabel)
  })

  return entries
}
