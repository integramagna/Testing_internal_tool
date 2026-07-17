export interface SlotWindow {
  cutoffInstant: Date
  escalationInstant: Date
}

export const computeSlotWindow = (openedAt: Date, effectiveDelayMinutes: number): SlotWindow => {
  const cutoffInstant = new Date(openedAt.getTime() + effectiveDelayMinutes * 60_000)
  const escalationLeadMinutes = Math.max(effectiveDelayMinutes - 5, 0)
  const escalationInstant = new Date(openedAt.getTime() + escalationLeadMinutes * 60_000)
  return { cutoffInstant, escalationInstant }
}

export const shouldTriggerReport = (
  allSubmitted: boolean,
  now: Date,
  cutoffInstant: Date,
): boolean => {
  return allSubmitted || now >= cutoffInstant
}

export const isMemberOnLeave = (pausedUntil: string | null | undefined, istDate: string): boolean => {
  if (!pausedUntil) return false
  const pausedUntilISTDate = pausedUntil.slice(0, 10)
  return pausedUntilISTDate >= istDate
}

export const isSkippableDay = (
  istDay: string,
  istDate: string,
  holidayDates: string[],
): boolean => {
  return istDay === 'sun' || holidayDates.includes(istDate)
}
