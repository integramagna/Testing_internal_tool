import type { Payload } from 'payload'

import type { Slot } from '@/payload-types'
import { isMemberOnLeave } from './scheduler'

export interface ReportItem {
  userName: string
  status: 'submitted' | 'late' | 'missed' | 'on_leave'
  text?: string
  blocked?: boolean
  blockedReason?: string
  userId: string
}

export interface ReportResult {
  summary: string
  items: ReportItem[]
}

export const buildReport = async (
  payload: Payload,
  departmentId: number,
  slot: Slot,
  dateKey: string,
  istDate: string,
): Promise<ReportResult> => {
  const members = await payload.find({
    collection: 'users',
    where: {
      department: { equals: departmentId },
      role: { equals: 'member' },
      status: { equals: 'active' },
    },
    limit: 500,
    depth: 0,
  })

  const updates = await payload.find({
    collection: 'updates',
    where: {
      department: { equals: departmentId },
      slot: { equals: slot.id },
      date: { equals: dateKey },
    },
    limit: 500,
    depth: 0,
  })

  const updateByUserId = new Map(updates.docs.map((u) => [String(u.user), u]))

  const items: ReportItem[] = members.docs.map((member) => {
    if (isMemberOnLeave(member.pausedUntil, istDate)) {
      return { userId: String(member.id), userName: member.name, status: 'on_leave' }
    }

    const update = updateByUserId.get(String(member.id))

    if (!update || !update.status) {
      return { userId: String(member.id), userName: member.name, status: 'missed' }
    }

    return {
      userId: String(member.id),
      userName: member.name,
      status: update.status,
      text: update.text ?? undefined,
      blocked: update.blocked ?? undefined,
      blockedReason: update.blockedReason ?? undefined,
    }
  })

  items.sort((a, b) => {
    if (a.blocked && !b.blocked) return -1
    if (!a.blocked && b.blocked) return 1
    return 0
  })

  const submittedCount = items.filter((i) => i.status === 'submitted' || i.status === 'late').length
  const total = items.length

  let summary: string
  if (total === 0) {
    summary = `${slot.label}: no members to report.`
  } else if (submittedCount === total) {
    summary = `${slot.label}: everyone's in. Nice team.`
  } else if (submittedCount === 0) {
    summary = `${slot.label}: nobody's submitted yet.`
  } else {
    summary = `${slot.label}: ${submittedCount} of ${total} submitted.`
  }

  return { summary, items }
}
