import { describe, it, expect, afterEach } from 'vitest'

import {
  getISTDateString,
  getISTTimeString,
  getISTDayCode,
  isSunday,
  istDateTimeToInstant,
  isWithinQuietHoursExemptWindow,
  getEffectiveReportDelayMinutes,
  getCurrentSlotDateKey,
  getDayCodeForDateString,
  addDaysToDateString,
  compareDateStrings,
  daysBetweenDateStrings,
} from '@/lib/istTime'

describe('istTime', () => {
  afterEach(() => {
    delete process.env.TEST_MODE
  })

  it('converts a UTC instant to the correct IST date and time', () => {
    const instant = new Date('2026-07-17T06:30:00.000Z')
    expect(getISTDateString(instant)).toBe('2026-07-17')
    expect(getISTTimeString(instant)).toBe('12:00')
    expect(getISTDayCode(instant)).toBe('fri')
  })

  it('rolls over to the next IST day near midnight UTC', () => {
    const instant = new Date('2026-07-17T19:00:00.000Z')
    expect(getISTDateString(instant)).toBe('2026-07-18')
    expect(getISTTimeString(instant)).toBe('00:30')
  })

  it('identifies Sunday correctly', () => {
    const sunday = new Date('2026-07-19T06:30:00.000Z')
    const friday = new Date('2026-07-17T06:30:00.000Z')
    expect(isSunday(sunday)).toBe(true)
    expect(isSunday(friday)).toBe(false)
  })

  it('round-trips an IST date/time into the matching UTC instant', () => {
    const instant = istDateTimeToInstant('2026-07-17', '12:00')
    expect(instant.toISOString()).toBe('2026-07-17T06:30:00.000Z')
  })

  it('gates the quiet-hours window at 09:30-19:00 IST inclusive', () => {
    const at0929 = istDateTimeToInstant('2026-07-17', '09:29')
    const at0930 = istDateTimeToInstant('2026-07-17', '09:30')
    const at1900 = istDateTimeToInstant('2026-07-17', '19:00')
    const at1901 = istDateTimeToInstant('2026-07-17', '19:01')

    expect(isWithinQuietHoursExemptWindow(at0929)).toBe(false)
    expect(isWithinQuietHoursExemptWindow(at0930)).toBe(true)
    expect(isWithinQuietHoursExemptWindow(at1900)).toBe(true)
    expect(isWithinQuietHoursExemptWindow(at1901)).toBe(false)
  })

  it('uses the configured delay outside TEST_MODE and a compressed delay inside it', () => {
    delete process.env.TEST_MODE
    expect(getEffectiveReportDelayMinutes(15)).toBe(15)

    process.env.TEST_MODE = 'true'
    expect(getEffectiveReportDelayMinutes(15)).toBe(6)
  })

  it('keys slotRuns/updates by plain IST date outside TEST_MODE and by minute inside it', () => {
    const instant = new Date('2026-07-17T06:30:00.000Z')

    delete process.env.TEST_MODE
    expect(getCurrentSlotDateKey(instant)).toBe('2026-07-17')

    process.env.TEST_MODE = 'true'
    expect(getCurrentSlotDateKey(instant)).toBe('2026-07-17T12:00')
  })

  it('derives the day code from a plain date string without timezone drift', () => {
    expect(getDayCodeForDateString('2026-07-17')).toBe('fri')
    expect(getDayCodeForDateString('2026-07-19')).toBe('sun')
  })

  it('adds and subtracts days across a date string, including month rollover', () => {
    expect(addDaysToDateString('2026-07-17', 1)).toBe('2026-07-18')
    expect(addDaysToDateString('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDaysToDateString('2026-07-17', -3)).toBe('2026-07-14')
  })

  it('compares and diffs date strings', () => {
    expect(compareDateStrings('2026-07-17', '2026-07-18')).toBeLessThan(0)
    expect(compareDateStrings('2026-07-18', '2026-07-17')).toBeGreaterThan(0)
    expect(compareDateStrings('2026-07-17', '2026-07-17')).toBe(0)
    expect(daysBetweenDateStrings('2026-07-17', '2026-07-20')).toBe(3)
  })
})
