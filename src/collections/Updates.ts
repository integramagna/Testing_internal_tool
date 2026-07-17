import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const Updates: CollectionConfig = {
  slug: 'updates',
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['user', 'slot', 'date', 'status', 'blocked'],
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  indexes: [{ unique: true, fields: ['user', 'slot', 'date'] }],
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
    },
    {
      name: 'slot',
      type: 'relationship',
      relationTo: 'slots',
      required: true,
    },
    {
      name: 'date',
      type: 'text',
      required: true,
      admin: {
        description: 'IST date, YYYY-MM-DD',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      maxLength: 2000,
    },
    {
      name: 'blocked',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'blockedReason',
      type: 'text',
    },
    {
      name: 'submittedAt',
      type: 'date',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Late', value: 'late' },
        { label: 'Missed', value: 'missed' },
      ],
    },
    {
      name: 'snoozeCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'How many times ask_update was snoozed for this slot/day (capped at 3)',
      },
    },
    {
      name: 'escalatedAt',
      type: 'date',
      admin: {
        description: 'Set the first time escalation_warning was delivered, so it fires only once',
      },
    },
  ],
}
