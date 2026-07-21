import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
      return { models: { generateContent: mockGenerateContent } }
    }),
  }
})

import { parseWithFallback } from '@/lib/gemini'

const originalApiKey = process.env.GEMINI_API_KEY

const mockReply = (payload: Record<string, unknown>) => ({ text: JSON.stringify(payload) })

describe('parseWithFallback', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalApiKey
  })

  it('returns the first model result without retrying when it succeeds', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      mockReply({
        intent: 'create_reminder',
        text: 'Client meeting',
        remindAt: '2026-07-17T16:55:00+05:30',
        confidence: 0.95,
      }),
    )

    const result = await parseWithFallback('remind me about the client meeting at 5', new Date())

    expect(result.intent).toBe('create_reminder')
    expect(result.inScope).toBe(true)
    expect(result.needsClarification).toBe(false)
    expect(result.text).toBe('Client meeting')
    expect(result.confidence).toBe(0.95)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('moves to the next model immediately on malformed JSON, without retrying the same model', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: 'not valid json at all' })
      .mockResolvedValueOnce(
        mockReply({
          intent: 'create_reminder',
          text: 'Call the vendor',
          remindAt: '2026-07-17T10:00:00+05:30',
          confidence: 0.8,
        }),
      )

    const result = await parseWithFallback('call the vendor', new Date())

    expect(result.text).toBe('Call the vendor')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('never throws and falls back to the local regex parser when every model fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('503 model overloaded'))

    const now = new Date('2026-07-17T06:30:00.000Z')

    const result = await parseWithFallback('in 30 minutes call the vendor', now)

    expect(result).toBeDefined()
    expect(result.intent).toBe('create_reminder')
    expect(result.inScope).toBe(true)
    expect(result.needsClarification).toBe(false)
    expect(result.text).toBe('Call the vendor')
    expect(new Date(result.remindAt).getTime()).toBe(now.getTime() + 30 * 60_000)
    // 2 models, 2 attempts each (1 initial + 1 retry) = 4 calls for one parseWithFallback run
    expect(mockGenerateContent.mock.calls.length).toBe(4)
  }, 20000)

  it('flags low-confidence local parses as needing clarification instead of guessing', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network error'))

    const result = await parseWithFallback('remind me 5 minutes before the client call', new Date())

    expect(result.intent).toBe('create_reminder')
    expect(result.inScope).toBe(true)
    expect(result.needsClarification).toBe(true)
    expect(result.confidence).toBeLessThan(0.7)
  }, 20000)

  it('declines out-of-scope requests the model correctly classifies, without guessing a time', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      mockReply({
        intent: 'decline',
        text: '',
        remindAt: '2026-07-17T06:30:00.000Z',
        confidence: 0,
      }),
    )

    const result = await parseWithFallback("what's the capital of France", new Date())

    expect(result.intent).toBe('decline')
    expect(result.inScope).toBe(false)
    expect(result.needsClarification).toBe(false)
  })

  it('declines a clearly out-of-scope input locally when every model fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network error'))

    const result = await parseWithFallback("what's the capital of France", new Date())

    expect(result.intent).toBe('decline')
    expect(result.inScope).toBe(false)
    expect(result.text).toBe('')
  }, 20000)

  it('routes list_reminders with the extracted window', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      mockReply({
        intent: 'list_reminders',
        text: '',
        remindAt: '2026-07-17T06:30:00.000Z',
        confidence: 0.9,
        listWindow: 'week',
      }),
    )

    const result = await parseWithFallback('what do I have coming up this week', new Date())

    expect(result.intent).toBe('list_reminders')
    expect(result.inScope).toBe(true)
    expect(result.listWindow).toBe('week')
    expect(result.text).toBe('')
  })

  it('routes manage_reminder with the action and target hint', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      mockReply({
        intent: 'manage_reminder',
        text: '',
        remindAt: '2026-07-17T18:00:00+05:30',
        confidence: 0.85,
        manageAction: 'reschedule',
        targetHint: 'client call',
      }),
    )

    const result = await parseWithFallback('push my client call reminder to 6pm', new Date())

    expect(result.intent).toBe('manage_reminder')
    expect(result.manageAction).toBe('reschedule')
    expect(result.targetHint).toBe('client call')
  })

  it('rejects a manage_reminder response with an invalid action and falls through the chain', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(
        mockReply({
          intent: 'manage_reminder',
          text: '',
          remindAt: '2026-07-17T06:30:00.000Z',
          confidence: 0.8,
          manageAction: 'delete_everything',
          targetHint: '',
        }),
      )
      .mockResolvedValueOnce(
        mockReply({
          intent: 'time_query',
          text: '',
          remindAt: '2026-07-17T06:30:00.000Z',
          confidence: 0.9,
        }),
      )

    const result = await parseWithFallback('cancel it', new Date())

    expect(result.intent).toBe('time_query')
  })

  it('routes time_query', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      mockReply({
        intent: 'time_query',
        text: '',
        remindAt: '2026-07-17T06:30:00.000Z',
        confidence: 0.95,
      }),
    )

    const result = await parseWithFallback('what time is it', new Date())

    expect(result.intent).toBe('time_query')
    expect(result.inScope).toBe(true)
  })

  it.each(['identity', 'who_is_god', 'joke', 'motivate'] as const)(
    'routes the %s personality intent and discards any freeform Gemini text',
    async (intent) => {
      mockGenerateContent.mockResolvedValueOnce(
        mockReply({
          intent,
          text: 'a made-up freeform answer the model should not be trusted to produce',
          remindAt: '2026-07-17T06:30:00.000Z',
          confidence: 0.9,
        }),
      )

      const result = await parseWithFallback('hello pip', new Date())

      expect(result.intent).toBe(intent)
      expect(result.inScope).toBe(true)
      expect(result.text).toBe('')
    },
  )

  it('classifies a joke request locally as the joke intent when every model fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network error'))

    const result = await parseWithFallback('tell me a joke', new Date())

    expect(result.intent).toBe('joke')
    expect(result.inScope).toBe(true)
  }, 20000)

  it('classifies a motivation request locally when every model fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network error'))

    const result = await parseWithFallback("I'm feeling stuck today", new Date())

    expect(result.intent).toBe('motivate')
    expect(result.inScope).toBe(true)
  }, 20000)
})
