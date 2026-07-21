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

export const isSnoozed = (snoozedUntil: string | null | undefined, now: Date): boolean => {
  if (!snoozedUntil) return false
  return new Date(snoozedUntil).getTime() > now.getTime()
}

export const computeSnoozedUntil = (now: Date, cutoffInstant: Date, snoozeMinutes = 5): Date => {
  const requested = new Date(now.getTime() + snoozeMinutes * 60_000)
  return requested < cutoffInstant ? requested : cutoffInstant
}

export interface DatedRun {
  date: string
}

export const findTodaysUndeliveredRun = <T extends DatedRun>(
  docs: T[],
  todayISTDate: string,
): T | null => docs.find((doc) => doc.date.startsWith(todayISTDate)) ?? null
