import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const SlotRuns: CollectionConfig = {
  slug: 'slotRuns',
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['department', 'slot', 'date', 'openedAt', 'reportSentAt'],
    hidden: true,
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  indexes: [{ unique: true, fields: ['department', 'slot', 'date'] }],
  fields: [
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      required: true,
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
      name: 'openedAt',
      type: 'date',
    },
    {
      name: 'reportSentAt',
      type: 'date',
      admin: {
        description: 'Set once the report is finalized (all submitted or cutoff passed)',
      },
    },
    {
      name: 'reportDeliveredAt',
      type: 'date',
      admin: {
        description: 'Set once show_report has been pushed to the lead/admin via poll',
      },
    },
    {
      name: 'noLead',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
