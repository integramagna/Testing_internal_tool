const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayCode = (typeof DAY_CODES)[number]

const toISTShifted = (date: Date): Date => new Date(date.getTime() + IST_OFFSET_MS)

export const getISTDateString = (date: Date = new Date()): string => {
  const shifted = toISTShifted(date)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const d = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const getISTTimeString = (date: Date = new Date()): string => {
  const shifted = toISTShifted(date)
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export const getISTDayCode = (date: Date = new Date()): DayCode => {
  const shifted = toISTShifted(date)
  return DAY_CODES[shifted.getUTCDay()]
}

export const isSunday = (date: Date = new Date()): boolean => getISTDayCode(date) === 'sun'

export const getISTMinutesSinceMidnight = (date: Date = new Date()): number => {
  const shifted = toISTShifted(date)
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
}

export const parseTimeToMinutes = (time: string): number => {
  const [hh, mm] = time.split(':').map(Number)
  return hh * 60 + mm
}

export const istDateTimeToInstant = (dateStr: string, time: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS)
}

export const isWithinQuietHoursExemptWindow = (date: Date = new Date()): boolean => {
  const minutes = getISTMinutesSinceMidnight(date)
  return minutes >= 9 * 60 + 30 && minutes <= 19 * 60
}

const isTestMode = (): boolean => process.env.TEST_MODE === 'true'

export const getCurrentSlotDateKey = (date: Date = new Date()): string => {
  const istDate = getISTDateString(date)
  if (!isTestMode()) {
    return istDate
  }
  return `${istDate}T${getISTTimeString(date)}`
}

export const getEffectiveReportDelayMinutes = (configured: number): number => {
  return isTestMode() ? 6 : configured
}

export { isTestMode }
