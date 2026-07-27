import type { Payload } from 'payload'

export const relationId = (value: unknown): number | null => {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return typeof value === 'number' ? value : null
}

export const getLedDepartmentIds = async (payload: Payload, userId: number): Promise<number[]> => {
  const result = await payload.find({
    collection: 'departments',
    where: { lead: { equals: userId } },
    limit: 200,
    depth: 0,
  })
  return result.docs.map((d) => d.id)
}
