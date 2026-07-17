import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { resolveIdentity } from '@/lib/identity'
import { getISTDateString } from '@/lib/istTime'
import { getLedDepartmentIds } from '@/lib/relation'
import type { Update } from '@/payload-types'

const serializeUpdate = (update: Update) => {
  const slot = typeof update.slot === 'object' ? update.slot : null
  return {
    slotId: String(slot?.id ?? update.slot),
    slotLabel: slot?.label ?? slot?.time ?? null,
    date: update.date,
    status: update.status,
    text: update.text ?? undefined,
    blocked: update.blocked ?? undefined,
    blockedReason: update.blockedReason ?? undefined,
  }
}

export const GET = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity
  const sevenDaysAgo = getISTDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

  if (user.role === 'member') {
    const result = await payload.find({
      collection: 'updates',
      where: {
        user: { equals: user.id },
        date: { greater_than_equal: sevenDaysAgo },
      },
      sort: '-date',
      limit: 200,
      depth: 1,
    })

    return Response.json({ updates: result.docs.map(serializeUpdate) })
  }

  let departmentIds: number[] = []

  if (user.role === 'lead') {
    departmentIds = await getLedDepartmentIds(payload, user.id)
  } else if (user.role === 'admin') {
    const departmentIdParam = new URL(request.url).searchParams.get('departmentId')
    departmentIds = departmentIdParam ? [Number(departmentIdParam)] : []
  }

  if (departmentIds.length === 0) {
    return Response.json({ error: 'missing_department' }, { status: 400 })
  }

  const result = await payload.find({
    collection: 'updates',
    where: {
      department: { in: departmentIds },
      date: { greater_than_equal: sevenDaysAgo },
    },
    sort: '-date',
    limit: 1000,
    depth: 1,
  })

  const groups = new Map<string, { userId: string; userName: string; entries: ReturnType<typeof serializeUpdate>[] }>()

  for (const update of result.docs) {
    const userRef = update.user
    const userId = String(typeof userRef === 'object' ? userRef.id : userRef)
    const userName = typeof userRef === 'object' ? userRef.name : userId

    if (!groups.has(userId)) {
      groups.set(userId, { userId, userName, entries: [] })
    }
    groups.get(userId)!.entries.push(serializeUpdate(update))
  }

  return Response.json({ groups: [...groups.values()] })
}
