import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { resolveIdentity } from '@/lib/identity'
import { compareDateStrings, daysBetweenDateStrings, getISTDateString } from '@/lib/istTime'
import { authorizeMemberReportAccess, buildMemberReportEntries, summarizeMemberReport } from '@/lib/memberReport'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 90

export const GET = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity
  const url = new URL(request.url)
  const userIdParam = url.searchParams.get('userId')
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  const targetUserId = Number(userIdParam)
  if (!userIdParam || Number.isNaN(targetUserId)) {
    return Response.json({ error: 'missing_user_id' }, { status: 400 })
  }

  if (!fromParam || !toParam || !DATE_PATTERN.test(fromParam) || !DATE_PATTERN.test(toParam)) {
    return Response.json({ error: 'invalid_range' }, { status: 400 })
  }

  if (compareDateStrings(fromParam, toParam) > 0) {
    return Response.json({ error: 'invalid_range' }, { status: 400 })
  }

  if (daysBetweenDateStrings(fromParam, toParam) > MAX_RANGE_DAYS) {
    return Response.json({ error: 'range_too_large' }, { status: 400 })
  }

  const auth = await authorizeMemberReportAccess(payload, user, targetUserId)
  if (!auth.ok) {
    return Response.json({ error: auth.reason }, { status: auth.status })
  }

  const todayISTDate = getISTDateString(new Date())
  const effectiveTo = compareDateStrings(toParam, todayISTDate) > 0 ? todayISTDate : toParam

  const entries = await buildMemberReportEntries(payload, auth.targetUser, fromParam, effectiveTo, todayISTDate)
  const summary = summarizeMemberReport(entries)

  return Response.json({
    user: { id: auth.targetUser.id, name: auth.targetUser.name },
    from: fromParam,
    to: toParam,
    summary,
    entries,
  })
}
