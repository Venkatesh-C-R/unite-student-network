import { Router } from 'express'
import { z } from 'zod'
import { all, one, pool } from '../db.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { id, text } from '../lib/validate.js'
import { requireRole } from '../middleware/auth.js'

export const adminRouter = Router()
adminRouter.use(requireRole('admin'))

// Numbers for the admin dashboard header
adminRouter.get('/stats', async (req, res) => {
  const stats = await one(
    `SELECT (SELECT COUNT(*) FROM user_report WHERE status = 'open') AS openReports,
            (SELECT COUNT(*) FROM user_account WHERE role = 'student' AND is_active) AS students,
            (SELECT COUNT(*) FROM user_account WHERE role IN ('faculty','admin') AND is_active) AS staff,
            (SELECT COUNT(*) FROM user_account WHERE NOT is_active) AS suspended,
            (SELECT COUNT(*) FROM achievement WHERE status = 'pending') AS pendingClaims,
            (SELECT COUNT(*) FROM collab_group) AS groupCount`, // not "groups": reserved word in MySQL 8
  )
  res.json({ stats })
})

adminRouter.get('/reports', async (req, res) => {
  const { status } = z.object({ status: z.enum(['open', 'resolved']).default('open') }).parse(req.query)
  const rows = await all(
    `SELECT r.id, r.reason, r.status, r.created_at AS createdAt, r.resolved_at AS resolvedAt,
            rp.id AS reporterId, rp.name AS reporterName,
            rd.id AS reportedId, rd.name AS reportedName, rd.email AS reportedEmail, rd.role AS reportedRole,
            rd.is_active AS reportedActive,
            (SELECT COUNT(*) FROM user_report x WHERE x.reported_id = rd.id) AS reportsAgainst,
            rs.name AS resolvedByName
       FROM user_report r
       JOIN user_account rp ON rp.id = r.reporter_id
       JOIN user_account rd ON rd.id = r.reported_id
       LEFT JOIN user_account rs ON rs.id = r.resolved_by
      WHERE r.status = ? ORDER BY r.id ${status === 'open' ? 'ASC' : 'DESC'} LIMIT 100`,
    [status],
  )
  res.json({ reports: rows.map((r) => ({ ...r, reportedActive: Boolean(r.reportedActive) })) })
})

adminRouter.post('/reports/:id/resolve', async (req, res) => {
  const { id: reportId } = z.object({ id }).parse(req.params)
  const [r] = await pool.query(
    `UPDATE user_report SET status = 'resolved', resolved_by = ?, resolved_at = NOW() WHERE id = ? AND status = 'open'`,
    [req.user.id, reportId],
  )
  if (!r.affectedRows) throw notFound('Open report not found.')
  res.json({ ok: true })
})

// Everyone with an account, newest first, filterable
adminRouter.get('/users', async (req, res) => {
  const q = z
    .object({
      q: text(80).optional(),
      role: z.enum(['student', 'faculty', 'admin']).optional(),
      status: z.enum(['active', 'suspended']).optional(),
      page: z.coerce.number().int().min(1).max(200).default(1),
    })
    .parse(req.query)
  const where = []
  const params = []
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.roll_no LIKE ?)')
    params.push(like, like, like)
  }
  if (q.role) {
    where.push('u.role = ?')
    params.push(q.role)
  }
  if (q.status) where.push(q.status === 'active' ? 'u.is_active' : 'NOT u.is_active')
  const rows = await all(
    `SELECT u.id, u.name, u.email, u.roll_no AS rollNo, u.role, u.year, u.is_active AS isActive, u.created_at AS createdAt,
            p.id AS programmeId, p.level AS programmeLevel, p.name AS programmeName,
            (SELECT COUNT(*) FROM group_member gm WHERE gm.user_id = u.id) AS groupCount,
            (SELECT COUNT(*) FROM user_report r WHERE r.reported_id = u.id AND r.status = 'open') AS openReports
       FROM user_account u LEFT JOIN programme p ON p.id = u.programme_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY u.created_at DESC, u.id DESC LIMIT 31 OFFSET ?`,
    [...params, (q.page - 1) * 30],
  )
  res.json({ users: rows.slice(0, 30).map((u) => ({ ...u, isActive: Boolean(u.isActive) })), hasMore: rows.length > 30 })
})

adminRouter.post('/users/:id/role', async (req, res) => {
  const { id: userId } = z.object({ id }).parse(req.params)
  const { role } = z.object({ role: z.enum(['student', 'faculty', 'admin']) }).parse(req.body)
  if (userId === req.user.id) throw badRequest('You cannot change your own role.')
  const user = await one(
    'SELECT id, role, programme_id, (SELECT COUNT(*) FROM group_member WHERE user_id = u.id) AS groupCount FROM user_account u WHERE id = ?',
    [userId],
  )
  if (!user) throw notFound('User not found.')
  if (role === 'student' && !user.programme_id) throw badRequest('Students need a programme, so this account cannot become a student.')
  // Groups are for students only; keep them valid
  if (role !== 'student' && user.groupCount > 0) {
    throw conflict(`This student is in ${user.groupCount} group(s). They must leave their groups before becoming ${role}.`, 'in_groups')
  }
  await pool.query('UPDATE user_account SET role = ? WHERE id = ?', [role, userId])
  if (role !== user.role) await notify(userId, 'role_changed', `An admin changed your UNITE role to ${role}.`)
  res.json({ ok: true })
})

// Suspend or restore an account; suspended users are signed out on their next request
adminRouter.post('/users/:id/active', async (req, res) => {
  const { id: userId } = z.object({ id }).parse(req.params)
  const { active } = z.object({ active: z.boolean() }).parse(req.body)
  if (userId === req.user.id) throw badRequest('You cannot suspend yourself.')
  const [r] = await pool.query('UPDATE user_account SET is_active = ? WHERE id = ?', [active, userId])
  if (!r.affectedRows) throw notFound('User not found.')
  res.json({ ok: true })
})
