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
  await buddyStage.enter('nimbus', 'neutral')
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
      buddyStage.setExpression('worried')
      bubbleText.textContent = "You're already set up on another device - ask your admin."
      bubbleActions.innerHTML = ''
    } else if (result.status === 403) {
      buddyStage.setExpression('worried')
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
    buddyStage.setExpression('worried')
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
    buddyStage.setExpression('neutral')
    bubbleActions.innerHTML = ''
    bubbleText.textContent = 'Okay, back in 5.'
    setTimeout(dismiss, 1500)
  })
}

const renderBlockedReason = (action) => {
  buddyStage.setExpression('worried')
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
  await buddyStage.enter('pip', 'neutral')
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
  bubbleText.textContent = 'One sec...'
  bubbleActions.innerHTML = ''

  const result = await window.taskBuddy.parseTask(rawInput)
  if (!result.ok) {
    bubbleText.textContent = "Couldn't reach the server - try again in a moment."
    return
  }

  const parsed = result.data

  if (parsed.needsClarification) {
    renderClarification(parsed, rawInput)
    return
  }

  await createTaskAndConfirm(parsed.text, parsed.remindAt, rawInput)
}

const renderClarification = (parsed, rawInput) => {
  buddyStage.setExpression('worried')
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
  await buddyStage.enter('bolt', 'neutral')
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
    bubbleActions.innerHTML = ''
    bubbleText.textContent = `Sent to ${selectedRecipient.userName}.`
    setTimeout(dismiss, 1500)
  })

  recipientInput.focus()
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
    await buddyStage.enter('nimbus', 'worried')
    showBubble("You're not activated yet - ask your admin. I'll wait.")
    setTimeout(dismiss, 2200)
  },
  ask_update: async (action) => {
    await buddyStage.enter('nimbus', 'neutral')
    renderAskUpdate(action)
  },
  escalation_warning: async (action) => {
    await buddyStage.enter('nimbus', 'worried')
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
    await buddyStage.enter('nimbus', action.summary?.includes('everyone') ? 'happy' : 'worried')
    renderReport(action)
  },
  remind_task: async (action) => {
    await buddyStage.enter('pip', 'neutral')
    renderRemindTask(action)
  },
  dispatch: async (action) => {
    await buddyStage.enter('bolt', 'neutral')
    renderDispatch(action)
  },
}

const handleAction = async (action) => {
  const handler = ACTION_HANDLERS[action.action]
  if (handler) {
    handler(action)
    return
  }
  await buddyStage.enter('nimbus', 'neutral')
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
  await buddyStage.enter('nimbus', 'sleepy')
  showBubble("Can't reach the server - I'll keep trying.")
})

window.taskBuddy.onAccessRemoved(async () => {
  await buddyStage.enter('nimbus', 'worried')
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
    await buddyStage.enter('nimbus', 'neutral')
    renderHistoryPanel(false)
    return
  }
  if (panelName === 'team-updates') {
    await buddyStage.enter('nimbus', 'neutral')
    renderHistoryPanel(true)
    return
  }
  hideBubble()
  panel.classList.remove('hidden')
  panel.textContent = `${panelName} - not wired up yet.`
})

init()
