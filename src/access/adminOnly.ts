import type { Access, FieldAccess, PayloadRequest } from 'payload'

export const adminOnly: Access = ({ req: { user } }) => {
  return user?.role === 'admin'
}

export const adminOnlyField: FieldAccess = ({ req: { user } }) => {
  return user?.role === 'admin'
}

export const adminOnlyPanel = ({ req: { user } }: { req: PayloadRequest }): boolean => {
  return user?.role === 'admin'
}
