import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const Slots: CollectionConfig = {
  slug: 'slots',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'time', 'days', 'department', 'active'],
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'label',
      type: 'text',
    },
    {
      name: 'time',
      type: 'text',
      required: true,
      admin: {
        description: 'HH:mm in IST, e.g. 12:00',
      },
    },
    {
      name: 'days',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Monday', value: 'mon' },
        { label: 'Tuesday', value: 'tue' },
        { label: 'Wednesday', value: 'wed' },
        { label: 'Thursday', value: 'thu' },
        { label: 'Friday', value: 'fri' },
        { label: 'Saturday', value: 'sat' },
      ],
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      admin: {
        description: 'Empty applies to all departments',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
