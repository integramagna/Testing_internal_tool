import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import { resolveIdentity } from '@/lib/identity'
import { getLedDepartmentIds } from '@/lib/relation'

export const GET = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const identity = await resolveIdentity(payload, request)

  if (!identity.ok) {
    return Response.json({ error: identity.reason }, { status: identity.status })
  }

  const { user } = identity

  if (user.role !== 'lead' && user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  let where: Where = {
    role: { equals: 'member' },
    status: { equals: 'active' },
  }

  if (user.role === 'lead') {
    const ledDepartmentIds = await getLedDepartmentIds(payload, user.id)
    if (ledDepartmentIds.length === 0) {
      return Response.json({ members: [] })
    }
    where = { ...where, department: { in: ledDepartmentIds } }
  }

  const result = await payload.find({
    collection: 'users',
    where,
    limit: 500,
    depth: 1,
    sort: 'name',
  })

  const members = result.docs.map((m) => {
    const dept = typeof m.department === 'object' ? m.department : null
    return {
      userId: String(m.id),
      name: m.name,
      departmentName: dept?.name ?? null,
    }
  })

  return Response.json({ members })
}
