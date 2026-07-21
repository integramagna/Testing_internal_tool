import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const Characters: CollectionConfig = {
  slug: 'characters',
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['roleSlug', 'displayName', 'accentColor', 'active'],
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'roleSlug',
      type: 'select',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        description: 'Fixed identifier. Internal code references characters by this, never by name.',
      },
      options: [
        { label: 'Reminders', value: 'reminders' },
        { label: 'Reports', value: 'reports' },
        { label: 'Dispatch', value: 'dispatch' },
      ],
    },
    {
      name: 'displayName',
      type: 'text',
      required: true,
    },
    {
      name: 'accentColor',
      type: 'text',
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
