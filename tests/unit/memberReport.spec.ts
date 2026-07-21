import { describe, it, expect } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'

import {
  authorizeMemberReportAccess,
  computeExpectedDays,
  summarizeMemberReport,
  type MemberReportEntry,
  type SlotConfig,
} from '@/lib/memberReport'

const makeUser = (overrides: Partial<User>): User =>
  ({
    id: 1,
    name: 'Test User',
    role: 'member',
    status: 'active',
    email: 'test@example.com',
    updatedAt: '',
    createdAt: '',
    ...overrides,
  }) as User

interface FakeDepartment {
  id: number
  lead: number | null
}

const makeFakePayload = (users: User[], departments: FakeDepartment[]) => {
  const created: unknown[] = []

  const payload = {
    findByID: async ({ collection, id }: { collection: string; id: number }) => {
      if (collection !== 'users') throw new Error(`unexpected collection ${collection}`)
      const found = users.find((u) => u.id === id)
      if (!found) throw new Error('not found')
      return found
    },
    find: async ({ collection, where }: { collection: string; where: Record<string, unknown> }) => {
      if (collection === 'departments') {
        const leadFilter = where.lead as { equals: number }
        return { docs: departments.filter((d) => d.lead === leadFilter.equals) }
      }
      throw new Error(`unexpected collection ${collection}`)
    },
    create: async (args: unknown) => {
      created.push(args)
      return {}
    },
  }

  return { payload: payload as unknown as Payload, created }
}

describe('authorizeMemberReportAccess', () => {
  it('denies a member outright, before ever looking up the target', async () => {
    const caller = makeUser({ id: 1, role: 'member' })
    const target = makeUser({ id: 2, role: 'member', department: 10 })
    const { payload } = makeFakePayload([caller, target], [])

    const result = await authorizeMemberReportAccess(payload, caller, 2)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.reason).toBe('not_lead_or_admin')
    }
  })

  it('allows a lead to pull a report for a member in a department they lead', async () => {
    const caller = makeUser({ id: 1, role: 'lead' })
    const target = makeUser({ id: 2, role: 'member', department: 10 })
    const { payload } = makeFakePayload([caller, target], [{ id: 10, lead: 1 }])

    const result = await authorizeMemberReportAccess(payload, caller, 2)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.targetUser.id).toBe(2)
    }
  })

  it('denies a lead requesting a member outside any department they lead, and logs an audit entry', async () => {
    const caller = makeUser({ id: 1, role: 'lead' })
    const target = makeUser({ id: 2, role: 'member', department: 99 })
    const { payload, created } = makeFakePayload([caller, target], [{ id: 10, lead: 1 }])

    const result = await authorizeMemberReportAccess(payload, caller, 2)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.reason).toBe('not_own_team')
    }
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ collection: 'auditLog', data: { type: 'other' } })
  })

  it('denies a lead requesting another lead even if departments would otherwise line up', async () => {
    const caller = makeUser({ id: 1, role: 'lead' })
    const otherLead = makeUser({ id: 2, role: 'lead', department: 10 })
    const { payload } = makeFakePayload([caller, otherLead], [{ id: 10, lead: 1 }])

    const result = await authorizeMemberReportAccess(payload, caller, 2)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  it('lets an admin pull a report for any user regardless of department', async () => {
    const caller = makeUser({ id: 1, role: 'admin' })
    const target = makeUser({ id: 2, role: 'member', department: 999 })
    const { payload } = makeFakePayload([caller, target], [])

    const result = await authorizeMemberReportAccess(payload, caller, 2)

    expect(result.ok).toBe(true)
  })
})

describe('computeExpectedDays', () => {
  const dailySlot: SlotConfig = {
    id: 1,
    label: 'Midday',
    time: '12:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    departmentId: 10,
    active: true,
  }

  it('skips Sundays', () => {
    const days = computeExpectedDays('2026-07-13', '2026-07-19', 10, [dailySlot], [], null)
    expect(days.some((d) => d.date === '2026-07-19')).toBe(false)
  })

  it('skips holidays', () => {
    const days = computeExpectedDays('2026-07-16', '2026-07-17', 10, [dailySlot], ['2026-07-17'], null)
    expect(days.map((d) => d.date)).toEqual(['2026-07-16'])
  })

  it('skips days with no applicable slot for the department', () => {
    const otherDeptSlot: SlotConfig = { ...dailySlot, id: 2, departmentId: 20 }
    const days = computeExpectedDays('2026-07-16', '2026-07-16', 10, [otherDeptSlot], [], null)
    expect(days).toHaveLength(0)
  })

  it('still includes days from a global (all-department) slot', () => {
    const globalSlot: SlotConfig = { ...dailySlot, id: 3, departmentId: null }
    const days = computeExpectedDays('2026-07-16', '2026-07-16', 10, [globalSlot], [], null)
    expect(days).toHaveLength(1)
    expect(days[0].slotId).toBe(3)
  })

  it('skips days on or before the pausedUntil date', () => {
    const days = computeExpectedDays(
      '2026-07-15',
      '2026-07-17',
      10,
      [dailySlot],
      [],
      '2026-07-16T00:00:00.000Z',
    )
    expect(days.map((d) => d.date)).toEqual(['2026-07-17'])
  })

  it('excludes an inactive slot', () => {
    const inactiveSlot: SlotConfig = { ...dailySlot, active: false }
    const days = computeExpectedDays('2026-07-16', '2026-07-16', 10, [inactiveSlot], [], null)
    expect(days).toHaveLength(0)
  })

  it('excludes a day the slot does not run on', () => {
    const weekdayOnly: SlotConfig = { ...dailySlot, days: ['mon', 'tue', 'wed', 'thu', 'fri'] }
    const days = computeExpectedDays('2026-07-18', '2026-07-18', 10, [weekdayOnly], [], null)
    expect(days).toHaveLength(0)
  })
})

describe('summarizeMemberReport', () => {
  const baseEntry = (overrides: Partial<MemberReportEntry>): MemberReportEntry => ({
    date: '2026-07-16',
    slotId: 1,
    slotLabel: 'Midday',
    departmentId: 10,
    status: 'submitted',
    ...overrides,
  })

  it('counts submitted, late, and missed correctly', () => {
    const entries = [
      baseEntry({ status: 'submitted' }),
      baseEntry({ status: 'submitted' }),
      baseEntry({ status: 'late' }),
      baseEntry({ status: 'missed' }),
    ]

    const summary = summarizeMemberReport(entries)

    expect(summary.totalExpected).toBe(4)
    expect(summary.submitted).toBe(2)
    expect(summary.late).toBe(1)
    expect(summary.missed).toBe(1)
  })

  it('computes on-time percent as submitted over total, rounded', () => {
    const entries = [
      baseEntry({ status: 'submitted' }),
      baseEntry({ status: 'late' }),
      baseEntry({ status: 'missed' }),
    ]

    expect(summarizeMemberReport(entries).onTimePercent).toBe(33)
  })

  it('returns zeroes without dividing by zero for an empty range', () => {
    const summary = summarizeMemberReport([])
    expect(summary.totalExpected).toBe(0)
    expect(summary.onTimePercent).toBe(0)
    expect(summary.topBlockerReason).toBeNull()
  })

  it('counts blocked days and picks the most frequent blocker reason', () => {
    const entries = [
      baseEntry({ status: 'missed', blocked: true, blockedReason: 'Waiting on client' }),
      baseEntry({ status: 'submitted', blocked: true, blockedReason: 'Waiting on client' }),
      baseEntry({ status: 'late', blocked: true, blockedReason: 'Server down' }),
      baseEntry({ status: 'submitted', blocked: false }),
    ]

    const summary = summarizeMemberReport(entries)

    expect(summary.blockedDays).toBe(3)
    expect(summary.topBlockerReason).toBe('Waiting on client')
  })
})
