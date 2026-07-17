import { describe, it, expect } from 'vitest'

import {
  computeSlotWindow,
  shouldTriggerReport,
  isMemberOnLeave,
  isSkippableDay,
} from '@/lib/scheduler'

describe('scheduler', () => {
  describe('computeSlotWindow', () => {
    it('computes cutoff and escalation instants from the delay', () => {
      const openedAt = new Date('2026-07-17T06:30:00.000Z')
      const { cutoffInstant, escalationInstant } = computeSlotWindow(openedAt, 15)

      expect(cutoffInstant.toISOString()).toBe('2026-07-17T06:45:00.000Z')
      expect(escalationInstant.toISOString()).toBe('2026-07-17T06:40:00.000Z')
    })

    it('clamps the escalation lead time at zero when the delay is under 5 minutes', () => {
      const openedAt = new Date('2026-07-17T06:30:00.000Z')
      const { escalationInstant } = computeSlotWindow(openedAt, 2)
      expect(escalationInstant.toISOString()).toBe(openedAt.toISOString())
    })
  })

  describe('shouldTriggerReport', () => {
    const cutoffInstant = new Date('2026-07-17T06:45:00.000Z')

    it('fires early when everyone has already submitted, before cutoff', () => {
      const beforeCutoff = new Date('2026-07-17T06:35:00.000Z')
      expect(shouldTriggerReport(true, beforeCutoff, cutoffInstant)).toBe(true)
    })

    it('does not fire before cutoff when submissions are still missing', () => {
      const beforeCutoff = new Date('2026-07-17T06:35:00.000Z')
      expect(shouldTriggerReport(false, beforeCutoff, cutoffInstant)).toBe(false)
    })

    it('fires at cutoff even when submissions are still missing', () => {
      expect(shouldTriggerReport(false, cutoffInstant, cutoffInstant)).toBe(true)
      const afterCutoff = new Date('2026-07-17T06:50:00.000Z')
      expect(shouldTriggerReport(false, afterCutoff, cutoffInstant)).toBe(true)
    })
  })

  describe('isMemberOnLeave', () => {
    it('is false when pausedUntil is not set', () => {
      expect(isMemberOnLeave(null, '2026-07-17')).toBe(false)
      expect(isMemberOnLeave(undefined, '2026-07-17')).toBe(false)
    })

    it('is true while pausedUntil is today or later', () => {
      expect(isMemberOnLeave('2026-07-17T00:00:00.000Z', '2026-07-17')).toBe(true)
      expect(isMemberOnLeave('2026-07-20T00:00:00.000Z', '2026-07-17')).toBe(true)
    })

    it('is false once pausedUntil is in the past', () => {
      expect(isMemberOnLeave('2026-07-16T00:00:00.000Z', '2026-07-17')).toBe(false)
    })
  })

  describe('isSkippableDay', () => {
    it('skips Sundays regardless of the holiday list', () => {
      expect(isSkippableDay('sun', '2026-07-19', [])).toBe(true)
    })

    it('skips a date that is in the holiday list', () => {
      expect(isSkippableDay('fri', '2026-07-17', ['2026-07-17'])).toBe(true)
    })

    it('does not skip an ordinary weekday', () => {
      expect(isSkippableDay('fri', '2026-07-17', ['2026-07-18'])).toBe(false)
    })
  })
})
