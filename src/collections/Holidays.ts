import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const Holidays: CollectionConfig = {
  slug: 'holidays',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['date', 'label'],
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'date',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'YYYY-MM-DD',
      },
    },
    {
      name: 'label',
      type: 'text',
    },
  ],
}
