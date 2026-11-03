import { pool } from '../db.js'

// Record one user action. Logging must never break the request, so failures are only printed.
export async function logActivity(req, action, { userId = req.user?.id, targetType = null, targetId = null, details = null } = {}) {
  try {
    await pool.query('INSERT INTO activity_log (user_id, action, target_type, target_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)', [
      userId ?? null,
      action,
      targetType,
      targetId,
      details ? String(details).slice(0, 300) : null,
      (req.ip || '').slice(0, 45) || null,
    ])
  } catch (e) {
    console.error('[activity] could not record', action, e.message)
  }
}
