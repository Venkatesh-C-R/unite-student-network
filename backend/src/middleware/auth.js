import { config } from '../config.js'
import { one } from '../db.js'
import { forbidden, unauthorized } from '../lib/errors.js'

// Loads the signed-in user (if any) onto req.user.
export async function loadUser(req, res, next) {
  const id = req.session?.userId
  if (!id) return next()
  const user = await one(
    `SELECT u.id, u.email, u.name, u.role, u.programme_id AS programmeId, u.year, u.is_active AS isActive
       FROM user_account u WHERE u.id = ?`,
    [id],
  )
  if (user?.isActive) req.user = user
  else req.session.userId = undefined
  next()
}

export function requireUser(req, res, next) {
  if (!req.user) throw unauthorized()
  next()
}

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) throw unauthorized()
    if (!roles.includes(req.user.role)) throw forbidden()
    next()
  }

// CSRF defence for cookie sessions: state-changing requests must come from our own
// origin (when the browser says where it came from) and carry a custom header, which
// other sites cannot add without a CORS preflight that we never approve.
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (origin && origin !== config.appOrigin) throw forbidden('Cross-site request blocked.')
  if (req.get('x-unite') !== '1') throw forbidden('Missing X-UNITE header.')
  next()
}
