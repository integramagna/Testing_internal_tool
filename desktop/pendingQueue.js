const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const queueFilePath = () => path.join(app.getPath('userData'), 'pending-updates.json')

const readQueue = () => {
  try {
    return JSON.parse(fs.readFileSync(queueFilePath(), 'utf8'))
  } catch {
    return []
  }
}

const writeQueue = (queue) => {
  fs.writeFileSync(queueFilePath(), JSON.stringify(queue), 'utf8')
}

const enqueue = (payload) => {
  const queue = readQueue()
  queue.push(payload)
  writeQueue(queue)
}

const flush = async (sendFn) => {
  const queue = readQueue()
  if (queue.length === 0) return

  const remaining = []
  for (const payload of queue) {
    const result = await sendFn(payload)
    if (!result.ok) remaining.push(payload)
  }
  writeQueue(remaining)
}

module.exports = { enqueue, flush, readQueue }
