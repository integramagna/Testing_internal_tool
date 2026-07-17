import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { resolveIdentity } from '@/lib/identity'
import { getCurrentSlotDateKey, getISTDateString } from '@/lib/istTime'
import { buildReport } from '@/lib/report'
import { getLedDepartmentIds } from '@/lib/relation'

export const GET = async (request: Request, context: { params: Promise<{ slotId: string }> }) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity

  if (user.role !== 'lead' && user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const { slotId } = await context.params
  const slot = await payload
    .findByID({ collection: 'slots', id: Number(slotId), depth: 0 })
    .catch(() => null)

  if (!slot) {
    return Response.json({ error: 'slot_not_found' }, { status: 404 })
  }

  const departmentIdParam = new URL(request.url).searchParams.get('departmentId')
  let departmentId: number | null = departmentIdParam ? Number(departmentIdParam) : null

  if (user.role === 'lead') {
    const ledDepartmentIds = await getLedDepartmentIds(payload, user.id)

    if (departmentId && !ledDepartmentIds.includes(departmentId)) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    if (!departmentId) {
      if (ledDepartmentIds.length === 1) {
        departmentId = ledDepartmentIds[0]
      } else if (ledDepartmentIds.length > 1) {
        return Response.json(
          { error: 'department_required', departments: ledDepartmentIds },
          { status: 400 },
        )
      }
    }
  }

  if (!departmentId) {
    return Response.json({ error: 'missing_department' }, { status: 400 })
  }

  const now = new Date()
  const dateKey = getCurrentSlotDateKey(now)
  const istDate = getISTDateString(now)

  const report = await buildReport(payload, departmentId, slot, dateKey, istDate)

  return Response.json(report)
}
