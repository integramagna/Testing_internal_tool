import { GoogleGenAI } from '@google/genai'
import type { Payload } from 'payload'

import { logAudit } from './auditLog'
import { getISTDateString, getISTTimeString, istDateTimeToInstant } from './istTime'

export interface TaskParseResult {
  text: string
  remindAt: string
  confidence: number
  needsClarification: boolean
}

const MODEL_CHAIN = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
]

const RETRY_DELAYS_MS = [500, 1500]
const ATTEMPT_TIMEOUT_MS = 8000
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface GeminiShapeResult {
  text: string
  remindAt: string
  confidence: number
}

const buildPrompt = (rawInput: string, now: Date): string => {
  const nowLabel = `${getISTDateString(now)} ${getISTTimeString(now)} IST (UTC+5:30)`
  return `You convert a short reminder request into JSON. The current date and time is ${nowLabel}.

Return ONLY JSON, no markdown, no explanation, in exactly this shape:
{"text": "short task description", "remindAt": "ISO 8601 datetime with +05:30 offset", "confidence": 0.0}

confidence is a number from 0 to 1. If the input does not clearly specify a time, set confidence below 0.7.

Input: "${rawInput}"`
}

const validateShape = (raw: string): GeminiShapeResult | null => {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  let json: unknown
  try {
    json = JSON.parse(cleaned)
  } catch {
    return null
  }

  if (typeof json !== 'object' || json === null) return null
  const obj = json as Record<string, unknown>

  if (typeof obj.text !== 'string' || obj.text.trim().length === 0) return null
  if (typeof obj.remindAt !== 'string') return null

  const parsedDate = new Date(obj.remindAt)
  if (Number.isNaN(parsedDate.getTime())) return null

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) return null

  return { text: obj.text.trim(), remindAt: parsedDate.toISOString(), confidence: obj.confidence }
}

const callGemini = async (model: string, apiKey: string, rawInput: string, now: Date): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey })
  const prompt = buildPrompt(rawInput, now)

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('gemini_timeout')), ATTEMPT_TIMEOUT_MS)
  })

  const call = ai.models.generateContent({ model, contents: prompt })
  const response = await Promise.race([call, timeout])
  const text = response.text

  if (!text) throw new Error('empty_response')
  return text
}

const tryModel = async (
  model: string,
  rawInput: string,
  now: Date,
  payload?: Payload,
): Promise<TaskParseResult | null> => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const raw = await callGemini(model, apiKey, rawInput, now)
      const parsed = validateShape(raw)

      if (!parsed) {
        if (payload) {
          await logAudit(payload, 'gemini_failed', `${model} returned malformed JSON`, { model, raw })
        }
        return null
      }

      return { ...parsed, needsClarification: parsed.confidence < 0.7 }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (payload) {
        await logAudit(payload, 'gemini_failed', `${model} attempt ${attempt + 1} failed: ${message}`, {
          model,
          attempt,
        })
      }

      const isLastAttempt = attempt === RETRY_DELAYS_MS.length
      if (isLastAttempt) return null
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }

  return null
}

const capitalize = (text: string): string => {
  const trimmed = text.trim()
  return trimmed.length > 0 ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed
}

const stripPhrase = (input: string, phrase: string): string => {
  const idx = input.toLowerCase().indexOf(phrase.toLowerCase())
  if (idx === -1) return input.trim()
  const cleaned = (input.slice(0, idx) + input.slice(idx + phrase.length))
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim()
  return cleaned.length > 0 ? capitalize(cleaned) : capitalize(input.trim())
}

const normalizeHour = (hour: number, meridiem: string | undefined): number => {
  if (!meridiem) return hour
  if (meridiem === 'pm' && hour < 12) return hour + 12
  if (meridiem === 'am' && hour === 12) return 0
  return hour
}

const istWallTimeOnDate = (now: Date, dayOffset: number, hour: number, minute: number): Date => {
  const istDateStr = getISTDateString(now)
  const [y, m, d] = istDateStr.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1, d + dayOffset))
  const targetDateStr = target.toISOString().slice(0, 10)
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return istDateTimeToInstant(targetDateStr, `${hh}:${mm}`)
}

interface LocalParseResult {
  text: string
  remindAt: Date | null
  confidence: number
}

const localRegexParse = (rawInput: string, now: Date): LocalParseResult => {
  const input = rawInput.trim()
  const lower = input.toLowerCase()

  let m = lower.match(/\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/)
  if (m) {
    const amount = Number(m[1])
    const unit = m[2]
    const ms = unit.startsWith('h') ? amount * HOUR_MS : amount * MINUTE_MS
    return {
      text: stripPhrase(input, m[0]),
      remindAt: new Date(now.getTime() + ms),
      confidence: 0.9,
    }
  }

  m = lower.match(/\bremind me\s+(\d+)\s*(minutes?|mins?)\s+before\s+(.+)/)
  if (m) {
    return { text: capitalize(m[3]), remindAt: null, confidence: 0.2 }
  }

  m = lower.match(/\btomorrow\b(?:\s+at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (m) {
    const hour = normalizeHour(Number(m[1]), m[3])
    const minute = m[2] ? Number(m[2]) : 0
    return {
      text: stripPhrase(input, m[0]),
      remindAt: istWallTimeOnDate(now, 1, hour, minute),
      confidence: 0.85,
    }
  }

  m = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (m) {
    const hour = normalizeHour(Number(m[1]), m[3])
    const minute = m[2] ? Number(m[2]) : 0
    let remindAt = istWallTimeOnDate(now, 0, hour, minute)
    if (remindAt.getTime() <= now.getTime()) {
      remindAt = istWallTimeOnDate(now, 1, hour, minute)
    }
    return {
      text: stripPhrase(input, m[0]),
      remindAt,
      confidence: m[3] || m[2] ? 0.85 : 0.6,
    }
  }

  return { text: input, remindAt: null, confidence: 0 }
}

export const parseWithFallback = async (
  rawInput: string,
  now: Date = new Date(),
  payload?: Payload,
): Promise<TaskParseResult> => {
  for (const model of MODEL_CHAIN) {
    const result = await tryModel(model, rawInput, now, payload)
    if (result) return result
  }

  const local = localRegexParse(rawInput, now)

  if (local.remindAt && local.confidence >= 0.7) {
    return {
      text: local.text,
      remindAt: local.remindAt.toISOString(),
      confidence: local.confidence,
      needsClarification: false,
    }
  }

  return {
    text: local.text || rawInput,
    remindAt: (local.remindAt ?? new Date(now.getTime() + 30 * MINUTE_MS)).toISOString(),
    confidence: local.confidence,
    needsClarification: true,
  }
}
