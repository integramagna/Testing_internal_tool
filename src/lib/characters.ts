import type { Payload } from 'payload'

export type CharacterRoleSlug = 'reminders' | 'reports' | 'dispatch'

export const DEFAULT_CHARACTER_NAMES: Record<CharacterRoleSlug, string> = {
  reminders: 'Coco',
  reports: 'Scout',
  dispatch: 'Zip',
}

const isRoleSlug = (value: unknown): value is CharacterRoleSlug =>
  value === 'reminders' || value === 'reports' || value === 'dispatch'

export const getCharacterDisplayNames = async (
  payload: Payload,
): Promise<Record<CharacterRoleSlug, string>> => {
  const result = await payload
    .find({ collection: 'characters', where: { active: { equals: true } }, limit: 10, depth: 0 })
    .catch(() => null)

  const names: Record<CharacterRoleSlug, string> = { ...DEFAULT_CHARACTER_NAMES }

  for (const doc of result?.docs ?? []) {
    const trimmed = doc.displayName?.trim()
    if (isRoleSlug(doc.roleSlug) && trimmed) {
      names[doc.roleSlug] = trimmed
    }
  }

  return names
}
