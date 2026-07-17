const path = require('path')
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, powerMonitor } = require('electron')

const isDev = !app.isPackaged
app.setName(isDev ? 'TaskBuddy-dev' : 'TaskBuddy')
app.setPath('userData', path.join(app.getPath('appData'), isDev ? 'TaskBuddy-dev' : 'TaskBuddy'))

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
  return
}

const tokenStore = require('./tokenStore')
const pendingQueue = require('./pendingQueue')
const { SERVER_URL: BAKED_SERVER_URL } = require('./generated-config')

const SERVER_URL = process.env.SERVER_URL || BAKED_SERVER_URL
const POLL_INTERVAL_MS = 60 * 1000
const OFFLINE_BACKOFF_MS = 5 * 60 * 1000
const WINDOW_WIDTH = 380
const WINDOW_HEIGHT = 420

let mainWindow = null
let tray = null
let pollTimer = null
let currentPollIntervalMs = POLL_INTERVAL_MS
let actionOnScreen = false
const actionQueue = []
const snoozedTaskUntil = new Map()

const authedFetch = async (urlPath, options = {}) => {
  const token = tokenStore.readToken()
  if (!token) return { ok: false, status: 401, data: { error: 'not_paired' } }

  try {
    const response = await fetch(`${SERVER_URL}${urlPath}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
    const data = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'network' } }
  }
}

const windowPosition = () => {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - WINDOW_WIDTH - 16,
    y: workArea.y + workArea.height - WINDOW_HEIGHT - 16,
  }
}

const createWindow = () => {
  const { x, y } = windowPosition()

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`)
  })

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))
}

const showWindow = () => {
  if (!mainWindow) return
  mainWindow.setPosition(windowPosition().x, windowPosition().y)
  mainWindow.showInactive()
}

const hideWindow = () => {
  if (!mainWindow) return
  mainWindow.hide()
}

const sendToRenderer = (channel, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

const buildTrayMenu = () => {
  const identity = tokenStore.readIdentity()
  const isLead = identity?.role === 'lead' || identity?.role === 'admin'

  const template = [
    {
      label: 'Add a task',
      click: () => {
        showWindow()
        sendToRenderer('open-panel', { panel: 'add-task' })
      },
    },
    {
      label: 'My updates',
      click: () => {
        showWindow()
        sendToRenderer('open-panel', { panel: 'my-updates' })
      },
    },
  ]

  if (isLead) {
    template.push(
      {
        label: 'Team updates',
        click: () => {
          showWindow()
          sendToRenderer('open-panel', { panel: 'team-updates' })
        },
      },
      {
        label: 'Send a message',
        click: () => {
          showWindow()
          sendToRenderer('open-panel', { panel: 'send-message' })
        },
      },
    )
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Switch account',
      click: () => {
        switchAccount()
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  )

  return Menu.buildFromTemplate(template)
}

const refreshTrayMenu = () => {
  if (tray) {
    tray.setContextMenu(buildTrayMenu())
  }
}

const createTray = () => {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Task Buddy')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    showWindow()
    deliverNextAction()
  })
}

const deliverNextAction = () => {
  if (actionOnScreen || actionQueue.length === 0) return
  const action = actionQueue.shift()
  actionOnScreen = true
  showWindow()
  sendToRenderer('action', action)
}

const enqueueAction = (action) => {
  if (!action || action.action === 'none') return

  if (action.action === 'remind_task') {
    const snoozedUntil = snoozedTaskUntil.get(action.taskId)
    if (snoozedUntil && snoozedUntil > Date.now()) return
    if (snoozedUntil) snoozedTaskUntil.delete(action.taskId)
  }

  actionQueue.push(action)
  deliverNextAction()
}

const setPollInterval = (ms) => {
  currentPollIntervalMs = ms
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(poll, currentPollIntervalMs)
}

const poll = async () => {
  if (actionOnScreen) return

  const token = tokenStore.readToken()
  if (!token) return

  try {
    const response = await fetch(`${SERVER_URL}/api/poll`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.status === 401 || response.status === 403) {
      tokenStore.clearToken()
      sendToRenderer('access-removed', { status: response.status })
      if (pollTimer) clearInterval(pollTimer)
      return
    }

    const data = await response.json()

    if (currentPollIntervalMs !== POLL_INTERVAL_MS) {
      setPollInterval(POLL_INTERVAL_MS)
    }

    flushPendingUpdates()
    enqueueAction(data)
  } catch {
    if (currentPollIntervalMs !== OFFLINE_BACKOFF_MS) {
      setPollInterval(OFFLINE_BACKOFF_MS)
      sendToRenderer('offline', {})
    }
  }
}

const startPolling = () => {
  setPollInterval(POLL_INTERVAL_MS)
  poll()
}

const flushPendingUpdates = () => {
  pendingQueue.flush((payload) =>
    authedFetch('/api/update', { method: 'POST', body: JSON.stringify(payload) }),
  )
}

const switchAccount = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  actionQueue.length = 0
  actionOnScreen = false
  tokenStore.clearToken()
  refreshTrayMenu()
  showWindow()
  sendToRenderer('show-pairing', {})
}

ipcMain.handle('pair', async (_event, code) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceInfo: { platform: process.platform } }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { ok: false, status: response.status, error: data.error, message: data.message }
    }

    tokenStore.storeToken(data.token)
    tokenStore.storeIdentity(data.identity)
    refreshTrayMenu()
    startPolling()

    return { ok: true, identity: data.identity }
  } catch {
    return { ok: false, status: 0, error: 'network' }
  }
})

ipcMain.handle('get-cached-identity', () => tokenStore.readIdentity())

ipcMain.handle('has-token', () => Boolean(tokenStore.readToken()))

ipcMain.handle('action-resolved', () => {
  actionOnScreen = false
  hideWindow()
  deliverNextAction()
})

ipcMain.handle('hide-window', () => {
  hideWindow()
})

ipcMain.handle('submit-update', async (_event, payload) => {
  const result = await authedFetch('/api/update', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!result.ok && result.status === 0 && !payload.snooze) {
    pendingQueue.enqueue(payload)
    return { ok: true, queued: true }
  }

  return result
})

ipcMain.handle('get-report', async (_event, slotId) => {
  return authedFetch(`/api/report/${slotId}`)
})

ipcMain.handle('get-history', async () => {
  return authedFetch('/api/history')
})

ipcMain.handle('parse-task', async (_event, rawInput) => {
  return authedFetch('/api/task/parse', {
    method: 'POST',
    body: JSON.stringify({ rawInput }),
  })
})

ipcMain.handle('create-task', async (_event, task) => {
  return authedFetch('/api/task', {
    method: 'POST',
    body: JSON.stringify(task),
  })
})

ipcMain.handle('ack-task', async (_event, { taskId, status }) => {
  return authedFetch(`/api/task/${taskId}/ack`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
})

ipcMain.handle('snooze-task', (_event, taskId) => {
  snoozedTaskUntil.set(taskId, Date.now() + 5 * 60 * 1000)
})

ipcMain.handle('dispatch-message', async (_event, { ownerId, text }) => {
  return authedFetch('/api/dispatch', {
    method: 'POST',
    body: JSON.stringify({ ownerId, text }),
  })
})

app.on('second-instance', () => {
  showWindow()
})

app.whenReady().then(() => {
  createWindow()
  createTray()

  if (tokenStore.readToken()) {
    startPolling()
  } else {
    mainWindow.once('ready-to-show', showWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  powerMonitor.on('resume', () => {
    if (tokenStore.readToken()) poll()
  })
})

app.on('window-all-closed', (event) => {
  event.preventDefault()
})
