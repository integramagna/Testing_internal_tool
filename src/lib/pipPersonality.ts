export const IDENTITY_REPLY =
  "I'm Pip! I'm your reminder buddy - I can set reminders, tell you what's coming up, cancel or reschedule things, or tell you the time. Try 'remind me to call the vendor at 5'."

export const WHO_IS_GOD_REPLY = 'Veer, obviously - he built me 😎'

export const JOKES = [
  "Why did the reminder break up with the calendar? It needed some space.\nOK maybe not my best one.",
  "I set a reminder to be funnier. It's snoozed for now.",
  "Why do clocks never get invited to parties? They're always ticking someone off.",
  "I told my last reminder a joke. It never fired back.",
  "What do you call a task that never gets done? Pending forever, apparently.",
]

export const MOTIVATIONS = [
  "One task at a time - you've got this.",
  "Small steps still count as moving forward.",
  "You've handled harder days than this one.",
  "Progress, not perfection. Keep going.",
  "Future-you is already thanking you for starting.",
]

export const MOTIVATE_NUDGE = 'Maybe take a short break if you can - even a couple of minutes helps.'

export const pickRandom = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

export const buildDeclineMessage = (supportContactName: string): string =>
  `I'm Pip - I only handle reminders and a few quick things. For anything else, ask ${supportContactName}.`
