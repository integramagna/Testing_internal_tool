import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { parseWithFallback } from '@/lib/gemini'
import { resolveIdentity } from '@/lib/identity'
import { resolveListReminders, resolveManageCandidates, resolveTimeQuery } from '@/lib/pipIntents'
import {
  IDENTITY_REPLY,
  JOKES,
  MOTIVATE_NUDGE,
  MOTIVATIONS,
  WHO_IS_GOD_REPLY,
  buildDeclineMessage,
  pickRandom,
} from '@/lib/pipPersonality'
import { getSupportContactName } from '@/lib/settings'

const REQUESTED_TIME_THRESHOLD_MS = 2 * 60_000

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity

  let body: { rawInput?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const rawInput = typeof body.rawInput === 'string' ? body.rawInput.trim() : ''
  if (!rawInput) {
    return Response.json({ error: 'missing_raw_input' }, { status: 400 })
  }

  const now = new Date()
  const result = await parseWithFallback(rawInput, now, payload)

  if (result.intent === 'decline') {
    const supportContactName = await getSupportContactName(payload)
    return Response.json({ ...result, declineMessage: buildDeclineMessage(supportContactName) })
  }

  if (result.intent === 'list_reminders') {
    const listWindow = result.listWindow ?? 'today'
    const reminders = await resolveListReminders(payload, user.id, listWindow, now)
    return Response.json({ ...result, listWindow, reminders })
  }

  if (result.intent === 'manage_reminder') {
    const candidates = await resolveManageCandidates(payload, user.id, result.targetHint ?? '', now)
    const requestedRemindAt =
      Math.abs(new Date(result.remindAt).getTime() - now.getTime()) > REQUESTED_TIME_THRESHOLD_MS
        ? result.remindAt
        : null

    return Response.json({
      ...result,
      manageAction: result.manageAction ?? 'cancel',
      requestedRemindAt,
      candidates,
    })
  }

  if (result.intent === 'time_query') {
    const timeInfo = await resolveTimeQuery(payload, user.id, now)
    return Response.json({ ...result, ...timeInfo })
  }

  if (result.intent === 'identity') {
    return Response.json({ ...result, reply: IDENTITY_REPLY })
  }

  if (result.intent === 'who_is_god') {
    return Response.json({ ...result, reply: WHO_IS_GOD_REPLY })
  }

  if (result.intent === 'joke') {
    return Response.json({ ...result, reply: pickRandom(JOKES) })
  }

  if (result.intent === 'motivate') {
    return Response.json({ ...result, reply: `${pickRandom(MOTIVATIONS)} ${MOTIVATE_NUDGE}` })
  }

  return Response.json(result)
}
