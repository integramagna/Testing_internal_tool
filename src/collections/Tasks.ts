import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['owner', 'createdBy', 'text', 'remindAt', 'status', 'character'],
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'text',
      type: 'text',
      required: true,
    },
    {
      name: 'remindAt',
      type: 'date',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Done', value: 'done' },
        { label: 'Dismissed', value: 'dismissed' },
        { label: 'Expired', value: 'expired' },
      ],
    },
    {
      name: 'character',
      type: 'select',
      required: true,
      options: [
        { label: 'Pip', value: 'pip' },
        { label: 'Bolt', value: 'bolt' },
      ],
    },
    {
      name: 'rawInput',
      type: 'text',
    },
    {
      name: 'acknowledgedAt',
      type: 'date',
    },
  ],
}
