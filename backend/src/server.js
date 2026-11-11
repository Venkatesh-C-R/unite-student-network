import { createApp } from './app.js'
import { config } from './config.js'

createApp().listen(config.port, () => {
  console.log(`UNITE API listening on http://localhost:${config.port} (mail: ${config.mail.providers.join(' → ')})`)
})
