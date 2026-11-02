import { pool } from '../db.js'

export async function notify(userIds, type, message, link = null, conn = pool) {
  const ids = [...new Set([].concat(userIds))].filter(Boolean)
  if (!ids.length) return
  await conn.query('INSERT INTO notification (user_id, type, message, link) VALUES ?', [
    ids.map((id) => [id, type, message.slice(0, 300), link]),
  ])
}
