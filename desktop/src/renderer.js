import * as buddyStage from './buddyStage.js'

window.addEventListener('error', (event) => {
  console.error('renderer error:', event.message, event.filename, event.lineno)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('unhandled rejection:', event.reason)
})

const bubble = document.getElementById('bubble')
const bubbleText = document.getElementById('bubble-text')
const bubbleActions = document.getElementById('bubble-actions')
const panel = document.getElementById('panel')

const clearBubble = () => {
  bubbleText.textContent = ''
  bubbleActions.innerHTML = ''
  panel.classList.add('hidden')
  bubble.classList.remove('hidden')
}

const showBubble = (text, buttons = []) => {
  clearBubble()
  bubbleText.textContent = text
  for (const { label, primary, onClick } of buttons) {
    const btn = document.createElement('button')
    btn.textContent = label
    if (primary) btn.classList.add('primary')
    btn.addEventListener('click', onClick)
    bubbleActions.appendChild(btn)
  }
}

const hideBubble = () => {
  bubble.classList.add('hidden')
}

const dismiss = async () => {
  hideBubble()
  await buddyStage.exit()
  window.taskBuddy.actionResolved()
}

const formatTime = (isoString) => {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ---------- pairing ----------

const showPairingScreen = async () => {
  await buddyStage.enter('reports', 'wave')
  clearBubble()
  bubbleText.textContent = 'Bello! Enter your setup code.'

  const form = document.createElement('div')
  form.className = 'pairing-form'

  const input = document.createElement('input')
  input.type = 'text'
  input.maxLength = 6
  input.placeholder = '6-digit code'

  const button = document.createElement('button')
  button.textContent = 'Pair'
  button.addEventListener('click', () => submitPairingCode(input.value.trim()))

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitPairingCode(input.value.trim())
  })

  form.appendChild(input)
  form.appendChild(button)
  bubbleActions.appendChild(form)
  input.focus()
}

const submitPairingCode = async (code) => {
  if (!code) return
  const result = await window.taskBuddy.pair(code)

  if (!result.ok) {
    if (result.status === 404) {
      showPairingScreen()
      bubbleText.textContent = "That code didn't work. Check with your admin."
    } else if (result.status === 409) {
      buddyStage.setExpression('concerned')
      bubbleText.textContent = "You're already set up on another device - ask your admin."
      bubbleActions.innerHTML = ''
    } else if (result.status === 403) {
      buddyStage.setExpression('concerned')
      bubbleText.textContent = "You don't have access anymore - ask your admin."
      bubbleActions.innerHTML = ''
    } else {
      showPairingScreen()
      bubbleText.textContent = "Couldn't reach the server - try again in a moment."
    }
    return
  }

  bubbleActions.innerHTML = ''

  if (result.identity.status === 'pending') {
    buddyStage.setExpression('concerned')
    bubbleText.textContent = "You're not activated yet - ask your admin. I'll wait."
    return
  }

  buddyStage.setExpression('happy')
  bubbleText.textContent = `Nice to meet you, ${result.identity.name}!`
  setTimeout(async () => {
    hideBubble()
    await buddyStage.exit()
    window.taskBuddy.hideWindow()
  }, 2200)
}

// ---------- ask_update / escalation_warning ----------

const renderAskUpdate = (action) => {
  clearBubble()
  bubbleText.textContent = action.text

  const textarea = document.createElement('textarea')
  textarea.placeholder = "What's the update?"
  textarea.rows = 3
  bubbleActions.appendChild(textarea)

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const addButton = (label, primary, onClick) => {
    const btn = document.createElement('button')
    btn.textContent = label
    if (primary) btn.classList.add('primary')
    btn.addEventListener('click', onClick)
    row.appendChild(btn)
    return btn
  }

  addButton('Send', true, async () => {
    const result = await window.taskBuddy.submitUpdate({
      slotId: action.slotId,
      text: textarea.value.trim(),
      blocked: false,
    })
    if (result.ok) {
      buddyStage.setExpression('happy')
      buddyStage.playSignature()
      bubbleActions.innerHTML = ''
      bubbleText.textContent = 'Got it. Nice work - see you next time.'
      setTimeout(dismiss, 2000)
    } else {
      bubbleText.textContent = "Couldn't send that - try again in a moment."
    }
  })

  addButton("I'm blocked", false, () => renderBlockedReason(action))

  addButton('Remind me in 5 min', false, async () => {
    await window.taskBuddy.submitUpdate({ slotId: action.slotId, snooze: true })
    buddyStage.setExpression('happy')
    bubbleActions.innerHTML = ''
    bubbleText.textContent = 'Okay, back in 5.'
    setTimeout(dismiss, 1500)
  })
}

const renderBlockedReason = (action) => {
  buddyStage.setExpression('concerned')
  clearBubble()
  bubbleText.textContent = "What's blocking you?"

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Blocked on...'
  bubbleActions.appendChild(input)

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const button = document.createElement('button')
  button.textContent = 'Send'
  button.classList.add('primary')
  button.addEventListener('click', async () => {
    const result = await window.taskBuddy.submitUpdate({
      slotId: action.slotId,
      blocked: true,
      blockedReason: input.value.trim(),
    })
    if (result.ok) {
      bubbleActions.innerHTML = ''
      bubbleText.textContent = 'Noted. Your lead will see it first.'
      setTimeout(dismiss, 2000)
    } else {
      bubbleText.textContent = "Couldn't send that - try again in a moment."
    }
  })
  row.appendChild(button)

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', () => renderAskUpdate(action))
  row.appendChild(cancelButton)

  input.focus()
}

// ---------- remind_task ----------

const renderRemindTask = (action) => {
  clearBubble()
  bubbleText.textContent = action.text

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const done = document.createElement('button')
  done.textContent = 'Done'
  done.classList.add('primary')
  done.addEventListener('click', async () => {
    await window.taskBuddy.ackTask(action.taskId, 'done')
    dismiss()
  })
  row.appendChild(done)

  const snooze = document.createElement('button')
  snooze.textContent = 'Snooze 5'
  snooze.addEventListener('click', async () => {
    await window.taskBuddy.snoozeTask(action.taskId)
    dismiss()
  })
  row.appendChild(snooze)
}

// ---------- show_report ----------

const renderReport = (action) => {
  hideBubble()
  panel.classList.remove('hidden')
  panel.innerHTML = ''

  const header = document.createElement('div')
  header.className = 'panel-header'
  header.textContent = action.summary
  panel.appendChild(header)

  const sorted = [...action.items].sort((a, b) => {
    if (a.blocked && !b.blocked) return -1
    if (!a.blocked && b.blocked) return 1
    return 0
  })

  for (const item of sorted) {
    const row = document.createElement('div')
    row.className = 'panel-row'

    const label = document.createElement('span')
    if (item.blocked) {
      label.textContent = `🚧 ${item.userName} - blocked: ${item.blockedReason || ''}`
    } else if (item.status === 'submitted' || item.status === 'late') {
      label.textContent = `✅ ${item.userName} - ${item.text || ''}`
    } else if (item.status === 'on_leave') {
      label.textContent = `🌴 ${item.userName} - on leave`
    } else {
      label.textContent = `❌ ${item.userName} - no update yet`
    }
    row.appendChild(label)

    if (item.status === 'missed') {
      const nudgeBtn = document.createElement('button')
      nudgeBtn.textContent = 'Remind them'
      nudgeBtn.addEventListener('click', async () => {
        nudgeBtn.disabled = true
        nudgeBtn.textContent = 'Reminded'
        await window.taskBuddy.dispatchMessage(item.userId, "Don't forget your update!")
      })
      row.appendChild(nudgeBtn)
    }

    panel.appendChild(row)
  }

  const closeButton = document.createElement('button')
  closeButton.textContent = 'Later'
  closeButton.addEventListener('click', async () => {
    panel.classList.add('hidden')
    await buddyStage.exit()
    window.taskBuddy.actionResolved()
  })
  panel.appendChild(closeButton)
}

// ---------- add-a-task ----------

const showAddTaskPrompt = async () => {
  await buddyStage.enter('reminders', 'wave')
  clearBubble()
  bubbleText.textContent = 'What do you need reminding of?'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = "e.g. 'remind me in 30 minutes to call the client'"
  bubbleActions.appendChild(input)

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const button = document.createElement('button')
  button.textContent = 'Send'
  button.classList.add('primary')
  button.addEventListener('click', () => submitTaskInput(input.value.trim()))
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitTaskInput(input.value.trim())
  })
  row.appendChild(button)

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', dismiss)
  row.appendChild(cancelButton)

  input.focus()
}

const submitTaskInput = async (rawInput) => {
  if (!rawInput) return
  buddyStage.setExpression('thinking')
  bubbleText.textContent = 'One sec...'
  bubbleActions.innerHTML = ''

  const result = await window.taskBuddy.parseTask(rawInput)
  if (!result.ok) {
    bubbleText.textContent = "Couldn't reach the server - try again in a moment."
    return
  }

  const parsed = result.data

  if (parsed.inScope === false) {
    buddyStage.setExpression('concerned')
    clearBubble()
    bubbleText.textContent = parsed.declineMessage
    const okButton = document.createElement('button')
    okButton.textContent = 'OK'
    okButton.classList.add('primary')
    okButton.addEventListener('click', dismiss)
    bubbleActions.appendChild(okButton)
    return
  }

  if (parsed.intent === 'list_reminders') {
    renderReminderList(parsed)
    return
  }

  if (parsed.intent === 'manage_reminder') {
    renderManageReminder(parsed)
    return
  }

  if (parsed.intent === 'time_query') {
    renderTimeQuery(parsed)
    return
  }

  if (
    parsed.intent === 'identity' ||
    parsed.intent === 'who_is_god' ||
    parsed.intent === 'joke' ||
    parsed.intent === 'motivate'
  ) {
    renderPipReply(parsed)
    return
  }

  if (parsed.needsClarification) {
    renderClarification(parsed, rawInput)
    return
  }

  await createTaskAndConfirm(parsed.text, parsed.remindAt, rawInput)
}

const renderPipReply = (parsed) => {
  buddyStage.setExpression('happy')
  clearBubble()
  bubbleText.textContent = parsed.reply
  const okButton = document.createElement('button')
  okButton.textContent = 'OK'
  okButton.classList.add('primary')
  okButton.addEventListener('click', dismiss)
  bubbleActions.appendChild(okButton)
}

const formatHHMM = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

const renderTimeQuery = (parsed) => {
  clearBubble()
  let text = `It's ${formatHHMM(parsed.currentTimeIST)} IST.`
  if (parsed.nextReminder) {
    text += ` Next up: '${parsed.nextReminder.text}' in ${parsed.nextReminder.minutesUntil} min.`
  } else {
    text += ' Nothing else on your reminder list right now.'
  }
  bubbleText.textContent = text
  const okButton = document.createElement('button')
  okButton.textContent = 'OK'
  okButton.classList.add('primary')
  okButton.addEventListener('click', dismiss)
  bubbleActions.appendChild(okButton)
}

const formatDateTimeLabel = (isoString) => {
  const date = new Date(isoString)
  return date.toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
}

const renderReminderList = (parsed) => {
  hideBubble()
  panel.classList.remove('hidden')
  panel.innerHTML = ''

  const header = document.createElement('div')
  header.className = 'panel-header'

  const reminders = parsed.reminders || []
  const windowLabel = parsed.listWindow === 'week' ? 'this week' : 'today'
  const formatRow = parsed.listWindow === 'week' ? formatDateTimeLabel : formatTime

  if (reminders.length === 0) {
    header.textContent = `Nothing on your list for ${windowLabel}. Nice and clear!`
    panel.appendChild(header)
    buddyStage.setExpression('happy')
  } else {
    header.textContent = `Here's what you've got ${windowLabel}:`
    panel.appendChild(header)

    for (const reminder of reminders) {
      const row = document.createElement('div')
      row.className = 'panel-row'
      const label = document.createElement('span')
      label.textContent = `${formatRow(reminder.remindAt)} - ${reminder.text}`
      row.appendChild(label)
      panel.appendChild(row)
    }
  }

  const closeButton = document.createElement('button')
  closeButton.textContent = 'Close'
  closeButton.addEventListener('click', async () => {
    panel.classList.add('hidden')
    await buddyStage.exit()
    window.taskBuddy.actionResolved()
  })
  panel.appendChild(closeButton)
}

const MANAGE_ACTION_LABEL = { cancel: 'Cancel', reschedule: 'Reschedule', snooze: 'Snooze' }

const renderManageReminder = (parsed) => {
  clearBubble()
  const candidates = parsed.candidates || []
  const actionLabel = MANAGE_ACTION_LABEL[parsed.manageAction] || 'Update'

  if (candidates.length === 0) {
    buddyStage.setExpression('concerned')
    bubbleText.textContent = "I couldn't find a matching reminder. Want me to list what you've got?"

    const row = document.createElement('div')
    row.className = 'button-row'
    bubbleActions.appendChild(row)

    const listButton = document.createElement('button')
    listButton.textContent = 'Show my reminders'
    listButton.classList.add('primary')
    listButton.addEventListener('click', () => submitTaskInput('what are my reminders today'))
    row.appendChild(listButton)

    const cancelButton = document.createElement('button')
    cancelButton.textContent = 'Cancel'
    cancelButton.addEventListener('click', dismiss)
    row.appendChild(cancelButton)
    return
  }

  if (candidates.length === 1) {
    renderManageConfirm(parsed, candidates[0])
    return
  }

  bubbleText.textContent = `Which one do you want to ${actionLabel.toLowerCase()}?`

  const pillRow = document.createElement('div')
  pillRow.className = 'pill-row'
  bubbleActions.appendChild(pillRow)

  for (const candidate of candidates) {
    const pill = document.createElement('button')
    pill.className = 'pill-button'
    pill.textContent = `${candidate.text} - ${formatTime(candidate.remindAt)}`
    pill.addEventListener('click', () => renderManageConfirm(parsed, candidate))
    pillRow.appendChild(pill)
  }

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', dismiss)
  row.appendChild(cancelButton)
}

const renderManageConfirm = (parsed, candidate) => {
  clearBubble()
  const actionLabel = MANAGE_ACTION_LABEL[parsed.manageAction] || 'Update'
  const whenLabel =
    parsed.manageAction === 'cancel'
      ? ''
      : parsed.requestedRemindAt
        ? ` to ${formatTime(parsed.requestedRemindAt)}`
        : ' by 30 minutes'

  bubbleText.textContent = `${actionLabel} '${candidate.text}' (${formatTime(candidate.remindAt)})${whenLabel}?`

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const confirmButton = document.createElement('button')
  confirmButton.textContent = actionLabel
  confirmButton.classList.add('primary')
  confirmButton.addEventListener('click', async () => {
    confirmButton.disabled = true
    const result =
      parsed.manageAction === 'cancel'
        ? await window.taskBuddy.ackTask(candidate.taskId, 'dismissed')
        : await window.taskBuddy.rescheduleTask(candidate.taskId, parsed.requestedRemindAt)

    if (!result.ok) {
      bubbleText.textContent = "Couldn't do that - try again in a moment."
      confirmButton.disabled = false
      return
    }
    buddyStage.setExpression('happy')
    bubbleActions.innerHTML = ''
    bubbleText.textContent = parsed.manageAction === 'cancel' ? 'Cancelled.' : 'Updated.'
    setTimeout(dismiss, 1500)
  })
  row.appendChild(confirmButton)

  const neverMindButton = document.createElement('button')
  neverMindButton.textContent = 'Never mind'
  neverMindButton.addEventListener('click', dismiss)
  row.appendChild(neverMindButton)
}

const renderClarification = (parsed, rawInput) => {
  buddyStage.setExpression('thinking')
  clearBubble()
  const timeLabel = formatTime(parsed.remindAt)
  bubbleText.textContent = `Is that ${timeLabel} today?`

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const todayBtn = document.createElement('button')
  todayBtn.textContent = `Today ${timeLabel}`
  todayBtn.classList.add('primary')
  todayBtn.addEventListener('click', () => createTaskAndConfirm(parsed.text, parsed.remindAt, rawInput))
  row.appendChild(todayBtn)

  const tomorrowBtn = document.createElement('button')
  tomorrowBtn.textContent = `Tomorrow ${timeLabel}`
  tomorrowBtn.addEventListener('click', () => {
    const tomorrow = new Date(parsed.remindAt)
    tomorrow.setDate(tomorrow.getDate() + 1)
    createTaskAndConfirm(parsed.text, tomorrow.toISOString(), rawInput)
  })
  row.appendChild(tomorrowBtn)

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', dismiss)
  row.appendChild(cancelButton)
}

const createTaskAndConfirm = async (text, remindAt, rawInput) => {
  const result = await window.taskBuddy.createTask({ text, remindAt, rawInput })
  if (!result.ok) {
    bubbleText.textContent = "Couldn't save that - try again in a moment."
    return
  }
  buddyStage.setExpression('happy')
  buddyStage.playSignature()
  bubbleActions.innerHTML = ''
  bubbleText.textContent = `Got it - I'll remind you at ${formatTime(remindAt)} about '${text}'.`
  setTimeout(dismiss, 2500)
}

// ---------- history panels ----------

const statusIcon = (status) => {
  if (status === 'submitted' || status === 'late') return '✅'
  if (status === 'missed') return '❌'
  return '•'
}

const renderHistoryPanel = async (isTeamView) => {
  hideBubble()
  buddyStage.setExpression('thinking')
  panel.classList.remove('hidden')
  panel.innerHTML = 'Loading…'

  const result = await window.taskBuddy.getHistory()
  panel.innerHTML = ''

  if (!result.ok) {
    panel.textContent = "Couldn't load history."
    return
  }

  const header = document.createElement('div')
  header.className = 'panel-header'
  header.textContent = isTeamView ? "Team's last 7 days" : 'Your last 7 days'
  panel.appendChild(header)

  if (isTeamView) {
    for (const group of result.data.groups || []) {
      const groupHeader = document.createElement('div')
      groupHeader.className = 'panel-header'
      groupHeader.textContent = group.userName
      panel.appendChild(groupHeader)

      for (const entry of group.entries) {
        panel.appendChild(buildHistoryRow(entry))
      }
    }
  } else {
    for (const entry of result.data.updates || []) {
      panel.appendChild(buildHistoryRow(entry))
    }
  }

  const closeButton = document.createElement('button')
  closeButton.textContent = 'Close'
  closeButton.addEventListener('click', async () => {
    panel.classList.add('hidden')
    await buddyStage.exit()
    window.taskBuddy.actionResolved()
  })
  panel.appendChild(closeButton)
}

const buildHistoryRow = (entry) => {
  const row = document.createElement('div')
  row.className = 'panel-row'
  const label = document.createElement('span')
  const detail = entry.blocked ? `blocked: ${entry.blockedReason || ''}` : entry.text || ''
  label.textContent = `${statusIcon(entry.status)} ${entry.date} ${entry.slotLabel || ''} - ${detail}`
  row.appendChild(label)
  return row
}

// ---------- send-a-message (lead/admin dispatch) ----------

const loadTeamRoster = async () => {
  const result = await window.taskBuddy.getHistory()
  if (!result.ok) return []
  const groups = result.data.groups || []
  const seen = new Map()
  for (const g of groups) seen.set(g.userId, g.userName)
  return [...seen.entries()].map(([userId, userName]) => ({ userId, userName }))
}

const showSendMessagePrompt = async () => {
  await buddyStage.enter('dispatch', 'wave')
  clearBubble()
  bubbleText.textContent = 'Who is this for, and what do you want to say?'

  let selectedRecipient = null
  const roster = await loadTeamRoster()

  const recipientWrap = document.createElement('div')
  recipientWrap.className = 'autocomplete'

  const recipientInput = document.createElement('input')
  recipientInput.type = 'text'
  recipientInput.placeholder = 'Type a team member name…'
  recipientWrap.appendChild(recipientInput)

  const suggestionList = document.createElement('div')
  suggestionList.className = 'suggestion-list hidden'
  recipientWrap.appendChild(suggestionList)
  bubbleActions.appendChild(recipientWrap)

  const renderSuggestions = (query) => {
    suggestionList.innerHTML = ''
    const q = query.trim().toLowerCase()
    const matches = q ? roster.filter((r) => r.userName.toLowerCase().includes(q)) : roster

    if (matches.length === 0) {
      suggestionList.classList.add('hidden')
      return
    }

    for (const match of matches) {
      const item = document.createElement('div')
      item.className = 'suggestion-item'
      item.textContent = match.userName
      item.addEventListener('click', () => {
        selectedRecipient = match
        recipientInput.value = match.userName
        suggestionList.classList.add('hidden')
        updateSendState()
      })
      suggestionList.appendChild(item)
    }
    suggestionList.classList.remove('hidden')
  }

  recipientInput.addEventListener('focus', () => renderSuggestions(recipientInput.value))
  recipientInput.addEventListener('input', () => {
    selectedRecipient = null
    renderSuggestions(recipientInput.value)
    updateSendState()
  })

  const messageInput = document.createElement('input')
  messageInput.type = 'text'
  messageInput.placeholder = 'Message'
  messageInput.addEventListener('input', updateSendState)
  bubbleActions.appendChild(messageInput)

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const sendButton = document.createElement('button')
  sendButton.textContent = 'Send'
  sendButton.classList.add('primary')
  sendButton.disabled = true
  row.appendChild(sendButton)

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', dismiss)
  row.appendChild(cancelButton)

  function updateSendState() {
    sendButton.disabled = !selectedRecipient || !messageInput.value.trim()
  }

  sendButton.addEventListener('click', async () => {
    const text = messageInput.value.trim()
    if (!selectedRecipient || !text) return
    const result = await window.taskBuddy.dispatchMessage(selectedRecipient.userId, text)
    if (!result.ok) {
      bubbleText.textContent = "Couldn't send that - try again in a moment."
      return
    }
    buddyStage.setExpression('happy')
    buddyStage.playSignature()
    bubbleActions.innerHTML = ''
    bubbleText.textContent = `Sent to ${selectedRecipient.userName}.`
    setTimeout(dismiss, 1500)
  })

  recipientInput.focus()
}

// ---------- member report (lead/admin) ----------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

const istDateString = (date = new Date()) => {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const d = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const addDaysToDateString = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

const formatDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const STATUS_LABEL = { submitted: 'On time', late: 'Late', missed: 'Missed' }

const loadTeamRosterForReport = async () => {
  const result = await window.taskBuddy.getTeamRoster()
  if (!result.ok) return []
  return result.data.members || []
}

const showMemberReportPrompt = async () => {
  await buddyStage.enter('reports', 'wave')
  clearBubble()
  bubbleText.textContent = 'Whose report do you want to pull?'

  let selectedMember = null
  const roster = await loadTeamRosterForReport()

  const recipientWrap = document.createElement('div')
  recipientWrap.className = 'autocomplete'

  const recipientInput = document.createElement('input')
  recipientInput.type = 'text'
  recipientInput.placeholder = 'Type a team member name…'
  recipientWrap.appendChild(recipientInput)

  const suggestionList = document.createElement('div')
  suggestionList.className = 'suggestion-list hidden'
  recipientWrap.appendChild(suggestionList)
  bubbleActions.appendChild(recipientWrap)

  const renderSuggestions = (query) => {
    suggestionList.innerHTML = ''
    const q = query.trim().toLowerCase()
    const matches = q ? roster.filter((r) => r.name.toLowerCase().includes(q)) : roster

    if (matches.length === 0) {
      suggestionList.classList.add('hidden')
      return
    }

    for (const match of matches) {
      const item = document.createElement('div')
      item.className = 'suggestion-item'
      item.textContent = match.departmentName ? `${match.name} - ${match.departmentName}` : match.name
      item.addEventListener('click', () => {
        selectedMember = match
        recipientInput.value = match.name
        suggestionList.classList.add('hidden')
      })
      suggestionList.appendChild(item)
    }
    suggestionList.classList.remove('hidden')
  }

  recipientInput.addEventListener('focus', () => renderSuggestions(recipientInput.value))
  recipientInput.addEventListener('input', () => {
    selectedMember = null
    renderSuggestions(recipientInput.value)
  })

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const nextButton = document.createElement('button')
  nextButton.textContent = 'Next'
  nextButton.classList.add('primary')
  nextButton.addEventListener('click', () => {
    if (!selectedMember) {
      bubbleText.textContent = 'Pick a name from the list first.'
      return
    }
    showRangePrompt(selectedMember)
  })
  row.appendChild(nextButton)

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', dismiss)
  row.appendChild(cancelButton)

  recipientInput.focus()
}

const showRangePrompt = (member) => {
  clearBubble()
  bubbleText.textContent = `How far back for ${member.name}?`

  const today = istDateString()
  const dayIndex = new Date(`${today}T00:00:00Z`).getUTCDay()
  const sinceMonday = (dayIndex + 6) % 7

  const presets = [
    { label: 'Today', from: today, to: today },
    { label: 'Last 3 days', from: addDaysToDateString(today, -2), to: today },
    { label: 'Last 7 days', from: addDaysToDateString(today, -6), to: today },
    { label: 'This week', from: addDaysToDateString(today, -sinceMonday), to: today },
  ]

  const pillRow = document.createElement('div')
  pillRow.className = 'pill-row'
  bubbleActions.appendChild(pillRow)

  for (const preset of presets) {
    const pill = document.createElement('button')
    pill.className = 'pill-button'
    pill.textContent = preset.label
    pill.addEventListener('click', () => fetchAndRenderMemberReport(member, preset.from, preset.to))
    pillRow.appendChild(pill)
  }

  const customPill = document.createElement('button')
  customPill.className = 'pill-button'
  customPill.textContent = 'Custom'
  customPill.addEventListener('click', () => showCustomRangePrompt(member))
  pillRow.appendChild(customPill)

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', dismiss)
  row.appendChild(cancelButton)
}

const showCustomRangePrompt = (member) => {
  clearBubble()
  bubbleText.textContent = `Pick a range for ${member.name}.`

  const today = istDateString()

  const fromInput = document.createElement('input')
  fromInput.type = 'date'
  fromInput.value = addDaysToDateString(today, -6)
  fromInput.max = today
  bubbleActions.appendChild(fromInput)

  const toInput = document.createElement('input')
  toInput.type = 'date'
  toInput.value = today
  toInput.max = today
  bubbleActions.appendChild(toInput)

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const goButton = document.createElement('button')
  goButton.textContent = 'View report'
  goButton.classList.add('primary')
  goButton.addEventListener('click', () => {
    if (!fromInput.value || !toInput.value || fromInput.value > toInput.value) {
      bubbleText.textContent = 'Pick a valid range - start before end.'
      return
    }
    fetchAndRenderMemberReport(member, fromInput.value, toInput.value)
  })
  row.appendChild(goButton)

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', () => showRangePrompt(member))
  row.appendChild(cancelButton)
}

const fetchAndRenderMemberReport = async (member, from, to) => {
  clearBubble()
  buddyStage.setExpression('thinking')
  bubbleText.textContent = 'One sec...'

  const result = await window.taskBuddy.getMemberReport({ userId: member.userId, from, to })

  if (!result.ok) {
    buddyStage.setExpression('concerned')
    bubbleText.textContent = "Couldn't load that report - try again in a moment."
    const row = document.createElement('div')
    row.className = 'button-row'
    bubbleActions.appendChild(row)
    const backButton = document.createElement('button')
    backButton.textContent = 'Back'
    backButton.classList.add('primary')
    backButton.addEventListener('click', () => showRangePrompt(member))
    row.appendChild(backButton)
    return
  }

  renderMemberReport(member, result.data)
}

const renderMemberReport = (member, data) => {
  hideBubble()
  panel.classList.remove('hidden')
  panel.innerHTML = ''

  const header = document.createElement('div')
  header.className = 'panel-header'

  if (!data.entries || data.entries.length === 0) {
    header.textContent = `${member.name} had no expected updates between ${formatDateLabel(data.from)} and ${formatDateLabel(data.to)}.`
    panel.appendChild(header)
    buddyStage.setExpression('happy')
  } else {
    header.textContent = `Here's ${member.name}'s report, ${formatDateLabel(data.from)} - ${formatDateLabel(data.to)}.`
    panel.appendChild(header)

    const chipRow = document.createElement('div')
    chipRow.className = 'stat-chips'

    const chipTexts = [
      `${data.summary.submitted + data.summary.late}/${data.summary.totalExpected} submitted`,
      `${data.summary.onTimePercent}% on time`,
      `${data.summary.late} late`,
      `${data.summary.missed} missed`,
    ]
    if (data.summary.blockedDays > 0) chipTexts.push(`${data.summary.blockedDays} blocked`)

    for (const chipText of chipTexts) {
      const chip = document.createElement('span')
      chip.className = 'stat-chip'
      chip.textContent = chipText
      chipRow.appendChild(chip)
    }
    panel.appendChild(chipRow)

    for (const entry of data.entries) {
      const row = document.createElement('div')
      row.className = 'panel-row member-report-row'
      if (entry.blocked) row.classList.add('blocked-highlight')

      const info = document.createElement('div')
      info.className = 'member-report-info'

      const dateLine = document.createElement('div')
      dateLine.className = 'member-report-date'
      dateLine.textContent = `${formatDateLabel(entry.date)} - ${entry.slotLabel}`
      info.appendChild(dateLine)

      if (entry.blocked && entry.blockedReason) {
        const reasonLine = document.createElement('div')
        reasonLine.className = 'member-report-reason'
        reasonLine.textContent = `Blocked: ${entry.blockedReason}`
        info.appendChild(reasonLine)
      } else if (entry.text) {
        const textLine = document.createElement('div')
        textLine.className = 'member-report-text'
        textLine.textContent = entry.text
        info.appendChild(textLine)
      }

      row.appendChild(info)

      const pill = document.createElement('span')
      pill.className = `status-pill ${entry.status}`
      pill.textContent = STATUS_LABEL[entry.status] || entry.status
      row.appendChild(pill)

      panel.appendChild(row)
    }
  }

  const closeButton = document.createElement('button')
  closeButton.textContent = 'Close'
  closeButton.addEventListener('click', async () => {
    panel.classList.add('hidden')
    await buddyStage.exit()
    window.taskBuddy.actionResolved()
  })
  panel.appendChild(closeButton)
}

// ---------- dispatch (received message) ----------

const renderDispatch = (action) => {
  clearBubble()
  bubbleText.textContent = `Message from ${action.from}:`

  const messageBody = document.createElement('p')
  messageBody.className = 'message-body'
  messageBody.textContent = action.text
  bubbleActions.appendChild(messageBody)

  const replyInput = document.createElement('input')
  replyInput.type = 'text'
  replyInput.placeholder = 'Type a reply...'
  if (!action.fromUserId) replyInput.classList.add('hidden')
  bubbleActions.appendChild(replyInput)

  const row = document.createElement('div')
  row.className = 'button-row'
  bubbleActions.appendChild(row)

  const acknowledge = async () => {
    await window.taskBuddy.ackTask(action.taskId, 'done')
  }

  if (action.fromUserId) {
    const replyButton = document.createElement('button')
    replyButton.textContent = 'Reply'
    replyButton.classList.add('primary')
    replyButton.addEventListener('click', async () => {
      const text = replyInput.value.trim()
      if (!text) return
      await acknowledge()
      const result = await window.taskBuddy.dispatchMessage(action.fromUserId, text)
      if (!result.ok) {
        bubbleText.textContent = "Couldn't send that - try again in a moment."
        return
      }
      buddyStage.setExpression('happy')
      buddyStage.playSignature()
      bubbleActions.innerHTML = ''
      bubbleText.textContent = 'Reply sent.'
      setTimeout(dismiss, 1500)
    })
    row.appendChild(replyButton)
  }

  const gotIt = document.createElement('button')
  gotIt.textContent = 'Got it'
  if (!action.fromUserId) gotIt.classList.add('primary')
  gotIt.addEventListener('click', async () => {
    await acknowledge()
    dismiss()
  })
  row.appendChild(gotIt)
}

// ---------- action routing ----------

const ACTION_HANDLERS = {
  not_registered: async () => {
    await buddyStage.enter('reports', 'concerned')
    showBubble("You're not activated yet - ask your admin. I'll wait.")
    setTimeout(dismiss, 2200)
  },
  ask_update: async (action) => {
    await buddyStage.enter('reports', 'wave')
    renderAskUpdate(action)
  },
  escalation_warning: async (action) => {
    await buddyStage.enter('reports', 'concerned')
    clearBubble()
    bubbleText.textContent = action.text
    const row = document.createElement('div')
    row.className = 'button-row'
    bubbleActions.appendChild(row)
    const sendNow = document.createElement('button')
    sendNow.textContent = 'Send now'
    sendNow.classList.add('primary')
    sendNow.addEventListener('click', () => renderAskUpdate({ ...action, text: "What's your update?" }))
    row.appendChild(sendNow)
    const later = document.createElement('button')
    later.textContent = 'Later'
    later.addEventListener('click', dismiss)
    row.appendChild(later)
  },
  show_report: async (action) => {
    await buddyStage.enter('reports', action.summary?.includes('everyone') ? 'celebrate' : 'concerned')
    renderReport(action)
  },
  remind_task: async (action) => {
    await buddyStage.enter('reminders', 'wave')
    renderRemindTask(action)
  },
  dispatch: async (action) => {
    await buddyStage.enter('dispatch', 'wave')
    renderDispatch(action)
  },
}

const handleAction = async (action) => {
  const handler = ACTION_HANDLERS[action.action]
  if (handler) {
    handler(action)
    return
  }
  await buddyStage.enter('reports', 'wave')
  showBubble(`(${action.action}) - not wired up yet.`, [{ label: 'Dismiss', primary: true, onClick: dismiss }])
}

const init = async () => {
  const hasToken = await window.taskBuddy.hasToken()
  if (!hasToken) {
    showPairingScreen()
    return
  }
  hideBubble()
}

window.taskBuddy.onAction(handleAction)

window.taskBuddy.onOffline(async () => {
  await buddyStage.enter('reports', 'sleepy')
  showBubble("Can't reach the server - I'll keep trying.")
})

window.taskBuddy.onAccessRemoved(async () => {
  await buddyStage.enter('reports', 'concerned')
  showBubble("You don't have access anymore - ask your admin.")
})

window.taskBuddy.onShowPairing(() => {
  panel.classList.add('hidden')
  showPairingScreen()
})

window.taskBuddy.onOpenPanel(async ({ panel: panelName }) => {
  if (panelName === 'add-task') {
    showAddTaskPrompt()
    return
  }
  if (panelName === 'send-message') {
    showSendMessagePrompt()
    return
  }
  if (panelName === 'my-updates') {
    await buddyStage.enter('reports', 'wave')
    renderHistoryPanel(false)
    return
  }
  if (panelName === 'team-updates') {
    await buddyStage.enter('reports', 'wave')
    renderHistoryPanel(true)
    return
  }
  if (panelName === 'member-report') {
    showMemberReportPrompt()
    return
  }
  hideBubble()
  panel.classList.remove('hidden')
  panel.textContent = `${panelName} - not wired up yet.`
})

init()
