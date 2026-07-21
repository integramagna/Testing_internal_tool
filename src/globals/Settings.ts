import type { GlobalConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const Settings: GlobalConfig = {
  slug: 'settings',
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      name: 'supportContactName',
      type: 'text',
      required: true,
      defaultValue: 'Veer',
      admin: {
        description: 'Who Pip points people to when a request is out of scope.',
      },
    },
  ],
}
