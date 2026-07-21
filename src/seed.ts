import 'dotenv/config'

import { getPayload } from 'payload'

import config from './payload.config.js'

const DEPARTMENT_NAMES = ['Development', 'Design', 'HR', 'Sales'] as const

const SLOT_DEFINITIONS = [
  { label: '12 PM', time: '12:00' },
  { label: '3 PM', time: '15:00' },
  { label: '5:30 PM', time: '17:30' },
] as const

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@integramagna.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'change-me-now'

const run = async () => {
  const payload = await getPayload({ config })

  const departmentByName = new Map<string, number>()

  for (const name of DEPARTMENT_NAMES) {
    const existing = await payload.find({
      collection: 'departments',
      where: { name: { equals: name } },
      limit: 1,
    })

    const doc =
      existing.docs[0] ??
      (await payload.create({
        collection: 'departments',
        data: { name, reportDelayMinutes: 15, active: true },
      }))

    departmentByName.set(name, doc.id)
  }

  for (const slot of SLOT_DEFINITIONS) {
    const existing = await payload.find({
      collection: 'slots',
      where: { time: { equals: slot.time } },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'slots',
        data: {
          label: slot.label,
          time: slot.time,
          days: [...ALL_DAYS],
          active: true,
        },
      })
    }
  }

  const existingAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: ADMIN_EMAIL } },
    limit: 1,
  })

  if (existingAdmin.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: {
        name: 'Admin',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
        status: 'active',
      },
    })
    console.log(`Admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  } else {
    console.log(`Admin already exists: ${ADMIN_EMAIL}`)
  }

  const developmentId = departmentByName.get('Development')

  const demoUsers = [
    { name: 'Asha Rao', email: 'asha.rao@integramagna.com', role: 'lead' as const },
    { name: 'Rahul Verma', email: 'rahul.verma@integramagna.com', role: 'member' as const },
    { name: 'Meera Iyer', email: 'meera.iyer@integramagna.com', role: 'member' as const },
  ]

  let leadId: number | undefined

  for (const demo of demoUsers) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: demo.email } },
      limit: 1,
    })

    const doc =
      existing.docs[0] ??
      (await payload.create({
        collection: 'users',
        data: {
          name: demo.name,
          email: demo.email,
          password: crypto.randomUUID(),
          department: developmentId,
          role: demo.role,
          status: 'active',
        },
      }))

    if (demo.role === 'lead') {
      leadId = doc.id
    }

    console.log(`${demo.name} <${demo.email}> pairing code: ${doc.pairingCode}`)
  }

  if (developmentId && leadId) {
    await payload.update({
      collection: 'departments',
      id: developmentId,
      data: { lead: leadId },
    })
  }

  const CHARACTER_SEEDS = [
    { roleSlug: 'reminders', displayName: 'Coco' },
    { roleSlug: 'reports', displayName: 'Scout' },
    { roleSlug: 'dispatch', displayName: 'Zip' },
  ] as const

  for (const character of CHARACTER_SEEDS) {
    const existing = await payload.find({
      collection: 'characters',
      where: { roleSlug: { equals: character.roleSlug } },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'characters',
        data: { roleSlug: character.roleSlug, displayName: character.displayName, active: true },
      })
    }
  }

  console.log('Seed complete.')
  process.exit(0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
