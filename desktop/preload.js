const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('taskBuddy', {
  pair: (code) => ipcRenderer.invoke('pair', code),
  getCachedIdentity: () => ipcRenderer.invoke('get-cached-identity'),
  getCharacterNames: () => ipcRenderer.invoke('get-character-names'),
  hasToken: () => ipcRenderer.invoke('has-token'),
  actionResolved: () => ipcRenderer.invoke('action-resolved'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  submitUpdate: (payload) => ipcRenderer.invoke('submit-update', payload),
  getReport: (slotId) => ipcRenderer.invoke('get-report', slotId),
  getHistory: () => ipcRenderer.invoke('get-history'),
  getTeamRoster: () => ipcRenderer.invoke('get-team-roster'),
  getCompanyRoster: () => ipcRenderer.invoke('get-company-roster'),
  getMemberReport: (params) => ipcRenderer.invoke('get-member-report', params),
  parseTask: (rawInput) => ipcRenderer.invoke('parse-task', rawInput),
  createTask: (task) => ipcRenderer.invoke('create-task', task),
  ackTask: (taskId, status) => ipcRenderer.invoke('ack-task', { taskId, status }),
  snoozeTask: (taskId) => ipcRenderer.invoke('snooze-task', taskId),
  rescheduleTask: (taskId, remindAt) => ipcRenderer.invoke('reschedule-task', { taskId, remindAt }),
  dispatchMessage: (ownerId, text) => ipcRenderer.invoke('dispatch-message', { ownerId, text }),
  dispatchBulkMessage: (ownerIds, text) => ipcRenderer.invoke('dispatch-bulk-message', { ownerIds, text }),
  onAction: (callback) => ipcRenderer.on('action', (_event, action) => callback(action)),
  onOpenPanel: (callback) => ipcRenderer.on('open-panel', (_event, payload) => callback(payload)),
  onOffline: (callback) => ipcRenderer.on('offline', () => callback()),
  onAccessRemoved: (callback) =>
    ipcRenderer.on('access-removed', (_event, payload) => callback(payload)),
  onShowPairing: (callback) => ipcRenderer.on('show-pairing', () => callback()),
})
