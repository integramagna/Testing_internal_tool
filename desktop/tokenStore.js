const fs = require('fs')
const path = require('path')
const { app, safeStorage } = require('electron')

const tokenFilePath = () => path.join(app.getPath('userData'), 'device.token')
const identityFilePath = () => path.join(app.getPath('userData'), 'identity.json')

const storeToken = (token) => {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(token)
    fs.writeFileSync(tokenFilePath(), encrypted)
  } else {
    fs.writeFileSync(tokenFilePath(), token, 'utf8')
  }
}

const readToken = () => {
  if (!fs.existsSync(tokenFilePath())) {
    return null
  }
  const raw = fs.readFileSync(tokenFilePath())
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(raw)
    } catch {
      return null
    }
  }
  return raw.toString('utf8')
}

const clearToken = () => {
  if (fs.existsSync(tokenFilePath())) {
    fs.unlinkSync(tokenFilePath())
  }
  if (fs.existsSync(identityFilePath())) {
    fs.unlinkSync(identityFilePath())
  }
}

const storeIdentity = (identity) => {
  fs.writeFileSync(identityFilePath(), JSON.stringify(identity), 'utf8')
}

const readIdentity = () => {
  if (!fs.existsSync(identityFilePath())) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(identityFilePath(), 'utf8'))
  } catch {
    return null
  }
}

module.exports = { storeToken, readToken, clearToken, storeIdentity, readIdentity }
