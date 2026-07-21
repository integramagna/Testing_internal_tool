import { describe, it, expect } from 'vitest'
import type { Payload } from 'payload'

import { resolveListReminders, resolveManageCandidates, resolveTimeQuery } from '@/lib/pipIntents'

interface FakeTask {
  id: number
  owner: number
  character: string
  status: string
  remindAt: string
  text: string
  rawInput?: string
}

interface FakeWhere {
  owner?: { equals: number }
  character?: { equals: string }
  status?: { equals: string }
  remindAt?: { greater_than_equal?: string; less_than_equal?: string }
}

const makeFakePayload = (tasks: FakeTask[]) => {
  const payload = {
    find: async ({
      collection,
      where,
      sort,
      limit,
    }: {
      collection: string
      where: FakeWhere
      sort?: string
      limit?: number
    }) => {
      if (collection !== 'tasks') throw new Error(`unexpected collection ${collection}`)

      let docs = tasks.filter((t) => {
        if (where.owner && t.owner !== where.owner.equals) return false
        if (where.character && t.character !== where.character.equals) return false
        if (where.status && t.status !== where.status.equals) return false
        if (where.remindAt?.greater_than_equal && t.remindAt < where.remindAt.greater_than_equal) return false
        if (where.remindAt?.less_than_equal && t.remindAt > where.remindAt.less_than_equal) return false
        return true
      })

      if (sort === 'remindAt') docs = [...docs].sort((a, b) => a.remindAt.localeCompare(b.remindAt))
      if (typeof limit === 'number') docs = docs.slice(0, limit)

      return { docs }
    },
  }

  return payload as unknown as Payload
}

const baseTasks: FakeTask[] = [
  { id: 1, owner: 10, character: 'pip', status: 'pending', remindAt: '2026-07-21T10:00:00.000Z', text: 'Mine, upcoming' },
  { id: 2, owner: 99, character: 'pip', status: 'pending', remindAt: '2026-07-21T11:00:00.000Z', text: "Someone else's reminder" },
  { id: 3, owner: 10, character: 'bolt', status: 'pending', remindAt: '2026-07-21T10:30:00.000Z', text: 'A dispatch, not a reminder' },
  { id: 4, owner: 10, character: 'pip', status: 'done', remindAt: '2026-07-21T09:00:00.000Z', text: 'Already handled' },
  { id: 5, owner: 10, character: 'pip', status: 'pending', remindAt: '2026-07-26T10:00:00.000Z', text: 'Later this week' },
]

describe('resolveListReminders', () => {
  const now = new Date('2026-07-21T05:00:00.000Z')

  it("only returns the caller's own pending pip tasks within today's window", async () => {
    const payload = makeFakePayload(baseTasks)
    const result = await resolveListReminders(payload, 10, 'today', now)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Mine, upcoming')
  })

  it('extends the window to 7 days out for the week listing', async () => {
    const payload = makeFakePayload(baseTasks)
    const result = await resolveListReminders(payload, 10, 'week', now)

    expect(result.map((r) => r.text)).toEqual(['Mine, upcoming', 'Later this week'])
  })

  it('never returns another user\'s reminders even inside the window', async () => {
    const payload = makeFakePayload(baseTasks)
    const result = await resolveListReminders(payload, 10, 'week', now)

    expect(result.some((r) => r.text.includes('else'))).toBe(false)
  })
})

describe('resolveManageCandidates', () => {
  const now = new Date('2026-07-21T05:00:00.000Z')

  it('only searches the caller\'s own pending pip tasks', async () => {
    const payload = makeFakePayload(baseTasks)
    const result = await resolveManageCandidates(payload, 10, '', now)

    expect(result.every((c) => baseTasks.find((t) => String(t.id) === c.taskId)?.owner === 10)).toBe(true)
    expect(result.some((c) => c.text.includes('else'))).toBe(false)
  })

  it('filters candidates by the target hint', async () => {
    const payload = makeFakePayload(baseTasks)
    const result = await resolveManageCandidates(payload, 10, 'later this week', now)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Later this week')
  })

  it('returns no candidates when the hint matches nothing', async () => {
    const payload = makeFakePayload(baseTasks)
    const result = await resolveManageCandidates(payload, 10, 'nonexistent phrase', now)

    expect(result).toHaveLength(0)
  })
})

describe('resolveTimeQuery', () => {
  it('reports the current IST time and the caller\'s own next reminder only', async () => {
    const payload = makeFakePayload(baseTasks)
    const now = new Date('2026-07-21T05:00:00.000Z')

    const result = await resolveTimeQuery(payload, 10, now)

    expect(result.currentTimeIST).toBe('10:30')
    expect(result.nextReminder).not.toBeNull()
    expect(result.nextReminder?.text).toBe('Mine, upcoming')
    expect(result.nextReminder?.minutesUntil).toBe(300)
  })

  it('returns null when the caller has no upcoming reminders', async () => {
    const payload = makeFakePayload(baseTasks)
    const now = new Date('2026-07-21T05:00:00.000Z')

    const result = await resolveTimeQuery(payload, 999, now)

    expect(result.nextReminder).toBeNull()
  })
})
