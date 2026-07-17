export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV === 'production') return

  const cron = await import('node-cron')
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'

  cron.schedule('* * * * *', async () => {
    try {
      await fetch(`${serverUrl}/api/cron/tick`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    } catch (error) {
      console.error('[dev-cron] tick failed', error)
    }
  })

  console.log('[dev-cron] scheduled local /api/cron/tick every minute (dev only)')
}
