import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const AuditLog: CollectionConfig = {
  slug: 'auditLog',
  admin: {
    useAsTitle: 'type',
    defaultColumns: ['type', 'message', 'createdAt'],
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  // Payload's automatic `createdAt` timestamp field covers the spec's `createdAt` column.
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Pair failed', value: 'pair_failed' },
        { label: 'Gemini failed', value: 'gemini_failed' },
        { label: 'No lead', value: 'no_lead' },
        { label: 'Re-pair blocked', value: 'repair_blocked' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'message',
      type: 'text',
    },
    {
      name: 'meta',
      type: 'json',
    },
  ],
}
