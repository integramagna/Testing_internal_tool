const fs = require('fs')
const path = require('path')

const KEEP_LOCALES = new Set(['en-US.pak', 'en-US.pak.info'])

module.exports = async (context) => {
  const localesDir = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(localesDir)) return

  for (const file of fs.readdirSync(localesDir)) {
    if (!KEEP_LOCALES.has(file)) {
      fs.unlinkSync(path.join(localesDir, file))
    }
  }

  console.log(`[after-pack] stripped non-English locale files from ${localesDir}`)
}
