import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const Departments: CollectionConfig = {
  slug: 'departments',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'lead', 'reportDelayMinutes', 'active'],
  },
  access: {
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
      unique: true,
    },
    {
      name: 'lead',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
    },
    {
      name: 'reportDelayMinutes',
      type: 'number',
      defaultValue: 15,
    },
    
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
