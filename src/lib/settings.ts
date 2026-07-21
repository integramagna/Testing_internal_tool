import type { Payload } from 'payload'

const DEFAULT_SUPPORT_CONTACT_NAME = 'Veer'

export const getSupportContactName = async (payload: Payload): Promise<string> => {
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 }).catch(() => null)
  const name = settings?.supportContactName?.trim()
  return name && name.length > 0 ? name : DEFAULT_SUPPORT_CONTACT_NAME
}
