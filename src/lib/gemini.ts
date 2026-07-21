import { GoogleGenAI } from '@google/genai'
import type { Payload } from 'payload'

import { logAudit } from './auditLog'
import { getISTDateString, getISTTimeString, istDateTimeToInstant } from './istTime'

export type PipIntent =
  | 'create_reminder'
  | 'list_reminders'
  | 'manage_reminder'
  | 'time_query'
  | 'identity'
  | 'who_is_god'
  | 'joke'
  | 'motivate'
  | 'decline'

export type ManageAction = 'cancel' | 'reschedule' | 'snooze'

export interface PipParseResult {
  intent: PipIntent
  inScope: boolean
  text: string
  remindAt: string
  confidence: number
  needsClarification: boolean
  listWindow?: 'today' | 'week'
  manageAction?: ManageAction
  targetHint?: string
}

const PIP_INTENTS: readonly PipIntent[] = [
  'create_reminder',
  'list_reminders',
  'manage_reminder',
  'time_query',
  'identity',
  'who_is_god',
  'joke',
  'motivate',
  'decline',
]

const isPipIntent = (value: unknown): value is PipIntent =>
  typeof value === 'string' && PIP_INTENTS.includes(value as PipIntent)

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
  intent: PipIntent
  text: string
  remindAt: string
  confidence: number
  listWindow?: 'today' | 'week'
  manageAction?: ManageAction
  targetHint?: string
}

const buildPrompt = (rawInput: string, now: Date): string => {
  const nowLabel = `${getISTDateString(now)} ${getISTTimeString(now)} IST (UTC+5:30)`
  const nowIso = now.toISOString()

  return `You are Pip, a work-tool assistant with a fixed, whitelisted set of things you help with. You do
not answer general questions, chat freely, or help with anything the tool doesn't explicitly give you.

The current date and time is ${nowLabel}.

Classify the user's message into EXACTLY ONE of these intents:

- create_reminder: they want to be reminded of something at a future time.
- list_reminders: they're asking what reminders/tasks they currently have (today or this week).
- manage_reminder: they want to cancel, reschedule, or snooze a reminder they already set.
- time_query: they're asking the current time, or how long until their next reminder.
- identity: they're asking who/what you are, who made you, or what you can do.
- who_is_god: they're asking some version of "who is god" (to you / in general).
- joke: they want a joke.
- motivate: they want encouragement, or say they're stuck, tired, low, or unmotivated.
- decline: anything else - unrelated questions, small talk, or requests for something else the tool does
  (like sending a message or viewing a report).

Return ONLY JSON, no markdown, no explanation, in exactly this shape:
{"intent": "create_reminder", "text": "short task description", "remindAt": "ISO 8601 datetime with +05:30 offset", "confidence": 0.0, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Field rules:
- text: only meaningful for create_reminder (short task description). Empty string otherwise.
- remindAt: for create_reminder, the extracted/implied reminder time. For manage_reminder with reschedule
  or snooze, the new time IF the user gave one, otherwise "${nowIso}". Otherwise always "${nowIso}".
- confidence: for create_reminder, how sure you are of the extracted time (below 0.7 if unclear). For every
  other intent, how sure you are of the classification itself.
- listWindow: only for list_reminders - "week" if they said this week / next few days, otherwise "today".
- manageAction: only for manage_reminder - "cancel", "reschedule", or "snooze".
- targetHint: only for manage_reminder - a short phrase identifying which reminder they mean, taken from
  their own words (e.g. "client call"). Empty string if they said "it"/"that" or didn't specify one.
- Leave fields that don't apply to the classified intent at the defaults shown above.

Examples:
Input: "remind me in 30 minutes to call the client"
Output: {"intent": "create_reminder", "text": "Call the client", "remindAt": "2026-07-17T10:35:00+05:30", "confidence": 0.95, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "remind me at before 5"
Output: {"intent": "create_reminder", "text": "Reminder", "remindAt": "2026-07-17T17:00:00+05:30", "confidence": 0.55, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "don't let me forget to submit the report tomorrow morning"
Output: {"intent": "create_reminder", "text": "Submit the report", "remindAt": "2026-07-18T09:00:00+05:30", "confidence": 0.8, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "what are my reminders today"
Output: {"intent": "list_reminders", "text": "", "remindAt": "${nowIso}", "confidence": 0.95, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "what do I have coming up this week"
Output: {"intent": "list_reminders", "text": "", "remindAt": "${nowIso}", "confidence": 0.9, "listWindow": "week", "manageAction": "cancel", "targetHint": ""}

Input: "cancel my reminder about the client call"
Output: {"intent": "manage_reminder", "text": "", "remindAt": "${nowIso}", "confidence": 0.9, "listWindow": "today", "manageAction": "cancel", "targetHint": "client call"}

Input: "push my report reminder to 6pm"
Output: {"intent": "manage_reminder", "text": "", "remindAt": "2026-07-17T18:00:00+05:30", "confidence": 0.85, "listWindow": "today", "manageAction": "reschedule", "targetHint": "report"}

Input: "snooze that reminder"
Output: {"intent": "manage_reminder", "text": "", "remindAt": "${nowIso}", "confidence": 0.8, "listWindow": "today", "manageAction": "snooze", "targetHint": ""}

Input: "what time is it"
Output: {"intent": "time_query", "text": "", "remindAt": "${nowIso}", "confidence": 0.95, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "how long until my next reminder"
Output: {"intent": "time_query", "text": "", "remindAt": "${nowIso}", "confidence": 0.9, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "what's your name"
Output: {"intent": "identity", "text": "", "remindAt": "${nowIso}", "confidence": 0.95, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "who made you"
Output: {"intent": "identity", "text": "", "remindAt": "${nowIso}", "confidence": 0.9, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "who is god to you"
Output: {"intent": "who_is_god", "text": "", "remindAt": "${nowIso}", "confidence": 0.9, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "tell me a joke"
Output: {"intent": "joke", "text": "", "remindAt": "${nowIso}", "confidence": 0.9, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "I'm feeling really stuck today"
Output: {"intent": "motivate", "text": "", "remindAt": "${nowIso}", "confidence": 0.85, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "what's the capital of France"
Output: {"intent": "decline", "text": "", "remindAt": "${nowIso}", "confidence": 0, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "send a message to Rahul"
Output: {"intent": "decline", "text": "", "remindAt": "${nowIso}", "confidence": 0, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

Input: "hey how are you"
Output: {"intent": "decline", "text": "", "remindAt": "${nowIso}", "confidence": 0, "listWindow": "today", "manageAction": "cancel", "targetHint": ""}

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

  if (!isPipIntent(obj.intent)) return null
  if (typeof obj.remindAt !== 'string') return null

  const parsedDate = new Date(obj.remindAt)
  if (Number.isNaN(parsedDate.getTime())) return null

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) return null

  const remindAt = parsedDate.toISOString()

  if (obj.intent === 'create_reminder') {
    if (typeof obj.text !== 'string' || obj.text.trim().length === 0) return null
    return { intent: 'create_reminder', text: obj.text.trim(), remindAt, confidence: obj.confidence }
  }

  if (obj.intent === 'list_reminders') {
    const listWindow = obj.listWindow === 'week' ? 'week' : 'today'
    return { intent: 'list_reminders', text: '', remindAt, confidence: obj.confidence, listWindow }
  }

  if (obj.intent === 'manage_reminder') {
    const manageAction =
      obj.manageAction === 'cancel' || obj.manageAction === 'reschedule' || obj.manageAction === 'snooze'
        ? obj.manageAction
        : null
    if (!manageAction) return null
    const targetHint = typeof obj.targetHint === 'string' ? obj.targetHint.trim() : ''
    return { intent: 'manage_reminder', text: '', remindAt, confidence: obj.confidence, manageAction, targetHint }
  }

  return { intent: obj.intent, text: '', remindAt, confidence: obj.confidence }
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
): Promise<PipParseResult | null> => {
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

      if (parsed.intent === 'decline') {
        if (payload) {
          await logAudit(payload, 'other', 'task/parse: out-of-scope input declined', { model, rawInput })
        }
        return {
          intent: 'decline',
          inScope: false,
          text: '',
          remindAt: parsed.remindAt,
          confidence: 0,
          needsClarification: false,
        }
      }

      if (parsed.intent === 'create_reminder') {
        return {
          intent: 'create_reminder',
          inScope: true,
          text: parsed.text,
          remindAt: parsed.remindAt,
          confidence: parsed.confidence,
          needsClarification: parsed.confidence < 0.7,
        }
      }

      return {
        intent: parsed.intent,
        inScope: true,
        text: '',
        remindAt: parsed.remindAt,
        confidence: parsed.confidence,
        needsClarification: false,
        listWindow: parsed.listWindow,
        manageAction: parsed.manageAction,
        targetHint: parsed.targetHint,
      }
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

const REMINDER_SIGNAL_PATTERN =
  /\b(remind|reminder|forget|before|after|tomorrow|today|tonight|later|in\s+\d|at\s+\d|\d{1,2}(:\d{2})?\s*(am|pm)|o'?clock)\b/i

const looksLikeReminderRequest = (input: string): boolean => REMINDER_SIGNAL_PATTERN.test(input)

const WHO_IS_GOD_PATTERN = /\bwho'?s\s+(your\s+)?god\b|\bwho\s+is\s+god\b/i
const IDENTITY_PATTERN =
  /\byour\s+name\b|\bwho\s+are\s+you\b|\bwho\s+made\s+you\b|\bwhat\s+can\s+you\s+do\b|\bare\s+you\s+(a\s+)?bot\b/i
const JOKE_PATTERN = /\bjoke\b/i
const MOTIVATE_PATTERN = /\bmotivat|\bfeeling\s+(low|stuck|down|tired)\b|\bi'?m\s+stuck\b|\bpep\s+talk\b/i
const TIME_QUERY_PATTERN = /\bwhat\s+time\s+is\s+it\b|\bcurrent\s+time\b|\bhow\s+long\s+until\b|\btime\s+left\b/i

const detectLocalPersonalityIntent = (rawInput: string): PipIntent | null => {
  if (WHO_IS_GOD_PATTERN.test(rawInput)) return 'who_is_god'
  if (IDENTITY_PATTERN.test(rawInput)) return 'identity'
  if (JOKE_PATTERN.test(rawInput)) return 'joke'
  if (MOTIVATE_PATTERN.test(rawInput)) return 'motivate'
  if (TIME_QUERY_PATTERN.test(rawInput)) return 'time_query'
  return null
}

export const parseWithFallback = async (
  rawInput: string,
  now: Date = new Date(),
  payload?: Payload,
): Promise<PipParseResult> => {
  for (const model of MODEL_CHAIN) {
    const result = await tryModel(model, rawInput, now, payload)
    if (result) return result
  }

  const local = localRegexParse(rawInput, now)

  if (local.remindAt && local.confidence >= 0.7) {
    return {
      intent: 'create_reminder',
      inScope: true,
      text: local.text,
      remindAt: local.remindAt.toISOString(),
      confidence: local.confidence,
      needsClarification: false,
    }
  }

  const localPersonalityIntent = detectLocalPersonalityIntent(rawInput)
  if (localPersonalityIntent) {
    return {
      intent: localPersonalityIntent,
      inScope: true,
      text: '',
      remindAt: now.toISOString(),
      confidence: 0.6,
      needsClarification: false,
    }
  }

  if (!local.remindAt && !looksLikeReminderRequest(rawInput)) {
    if (payload) {
      await logAudit(payload, 'other', 'task/parse: out-of-scope input declined (local fallback)', { rawInput })
    }
    return {
      intent: 'decline',
      inScope: false,
      text: '',
      remindAt: now.toISOString(),
      confidence: 0,
      needsClarification: false,
    }
  }

  return {
    intent: 'create_reminder',
    inScope: true,
    text: local.text || rawInput,
    remindAt: (local.remindAt ?? new Date(now.getTime() + 30 * MINUTE_MS)).toISOString(),
    confidence: local.confidence,
    needsClarification: true,
  }
}
