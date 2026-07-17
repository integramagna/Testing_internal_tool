import type { CollectionConfig } from 'payload'

import { adminOnly, adminOnlyPanel } from '../access/adminOnly'
import { generatePairingCode } from './hooks/generatePairingCode'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'department', 'role', 'status'],
  },
  auth: true,
  access: {
    admin: adminOnlyPanel,
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Member', value: 'member' },
        { label: 'Lead', value: 'lead' },
        { label: 'Admin', value: 'admin' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Left', value: 'left' },
        { label: 'Pending', value: 'pending' },
      ],
    },
    {
      name: 'pairingCode',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
      },
      hooks: {
        beforeChange: [generatePairingCode],
      },
    },
    {
      name: 'deviceId',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'allowRePair',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'lastPairedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'pausedUntil',
      type: 'date',
    },
    {
      name: 'slackUserId',
      type: 'text',
    },
  ],
}
