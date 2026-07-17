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

describe('parseWithFallback', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalApiKey
  })

  it('returns the first model result without retrying when it succeeds', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        text: 'Client meeting',
        remindAt: '2026-07-17T16:55:00+05:30',
        confidence: 0.95,
      }),
    })

    const result = await parseWithFallback('remind me about the client meeting at 5', new Date())

    expect(result.needsClarification).toBe(false)
    expect(result.text).toBe('Client meeting')
    expect(result.confidence).toBe(0.95)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('moves to the next model immediately on malformed JSON, without retrying the same model', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: 'not valid json at all' })
      .mockResolvedValueOnce({
        text: JSON.stringify({ text: 'Call the vendor', remindAt: '2026-07-17T10:00:00+05:30', confidence: 0.8 }),
      })

    const result = await parseWithFallback('call the vendor', new Date())

    expect(result.text).toBe('Call the vendor')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('never throws and falls back to the local regex parser when every model fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('503 model overloaded'))

    const now = new Date('2026-07-17T06:30:00.000Z')

    const result = await parseWithFallback('in 30 minutes call the vendor', now)

    expect(result).toBeDefined()
    expect(result.needsClarification).toBe(false)
    expect(result.text).toBe('Call the vendor')
    expect(new Date(result.remindAt).getTime()).toBe(now.getTime() + 30 * 60_000)
    // 4 models, 3 attempts each (1 initial + 2 retries) = 12 calls for one parseWithFallback run
    expect(mockGenerateContent.mock.calls.length).toBe(12)
  }, 20000)

  it('flags low-confidence local parses as needing clarification instead of guessing', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network error'))

    const result = await parseWithFallback('remind me 5 minutes before the client call', new Date())

    expect(result.needsClarification).toBe(true)
    expect(result.confidence).toBeLessThan(0.7)
  }, 20000)
})
