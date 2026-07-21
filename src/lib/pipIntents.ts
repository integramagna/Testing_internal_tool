import type { Payload } from 'payload'

import { getISTEndOfDayInstant, getISTTimeString } from './istTime'

export interface ReminderListItem {
  taskId: string
  text: string
  remindAt: string
}

export const resolveListReminders = async (
  payload: Payload,
  userId: number,
  listWindow: 'today' | 'week',
  now: Date,
): Promise<ReminderListItem[]> => {
  const windowEnd =
    listWindow === 'week' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : getISTEndOfDayInstant(now)

  const result = await payload.find({
    collection: 'tasks',
    where: {
      owner: { equals: userId },
      character: { equals: 'pip' },
      status: { equals: 'pending' },
      remindAt: { greater_than_equal: now.toISOString(), less_than_equal: windowEnd.toISOString() },
    },
    sort: 'remindAt',
    limit: 200,
    depth: 0,
  })

  return result.docs.map((task) => ({
    taskId: String(task.id),
    text: task.text,
    remindAt: task.remindAt,
  }))
}

export const resolveManageCandidates = async (
  payload: Payload,
  userId: number,
  targetHint: string,
  now: Date,
): Promise<ReminderListItem[]> => {
  const result = await payload.find({
    collection: 'tasks',
    where: {
      owner: { equals: userId },
      character: { equals: 'pip' },
      status: { equals: 'pending' },
      remindAt: { greater_than_equal: now.toISOString() },
    },
    sort: 'remindAt',
    limit: 200,
    depth: 0,
  })

  const pending = result.docs.map((task) => ({
    taskId: String(task.id),
    text: task.text,
    remindAt: task.remindAt,
    rawInput: task.rawInput ?? '',
  }))

  const hint = targetHint.trim().toLowerCase()

  const matches = hint
    ? pending.filter(
        (task) => task.text.toLowerCase().includes(hint) || task.rawInput.toLowerCase().includes(hint),
      )
    : pending

  return matches.map(({ taskId, text, remindAt }) => ({ taskId, text, remindAt }))
}

export interface TimeQueryResult {
  currentTimeIST: string
  nextReminder: { text: string; remindAt: string; minutesUntil: number } | null
}

export const resolveTimeQuery = async (
  payload: Payload,
  userId: number,
  now: Date,
): Promise<TimeQueryResult> => {
  const result = await payload.find({
    collection: 'tasks',
    where: {
      owner: { equals: userId },
      character: { equals: 'pip' },
      status: { equals: 'pending' },
      remindAt: { greater_than_equal: now.toISOString() },
    },
    sort: 'remindAt',
    limit: 1,
    depth: 0,
  })

  const next = result.docs[0]
  const nextReminder = next
    ? {
        text: next.text,
        remindAt: next.remindAt,
        minutesUntil: Math.round((new Date(next.remindAt).getTime() - now.getTime()) / 60_000),
      }
    : null

  return { currentTimeIST: getISTTimeString(now), nextReminder }
}
