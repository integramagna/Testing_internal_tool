const fs = require('fs')
const path = require('path')

const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'

const outPath = path.join(__dirname, '..', 'generated-config.js')
fs.writeFileSync(outPath, `module.exports = { SERVER_URL: ${JSON.stringify(serverUrl)} }\n`, 'utf8')

console.log(`[generate-config] baked SERVER_URL=${serverUrl} into generated-config.js`)
