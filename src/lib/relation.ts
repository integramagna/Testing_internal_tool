import type { Payload } from 'payload'

export const relationId = (value: unknown): number | null => {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return typeof value === 'number' ? value : null
}

// A lead's scope is whichever departments have their `lead` field set to this
// user - not the user's own `department` field, since one person can lead
// several departments while only "belonging" to (at most) one themselves.
export const getLedDepartmentIds = async (payload: Payload, userId: number): Promise<number[]> => {
  const result = await payload.find({
    collection: 'departments',
    where: { lead: { equals: userId } },
    limit: 200,
    depth: 0,
  })
  return result.docs.map((d) => d.id)
}
