import { Router } from 'express'
import { z } from 'zod'
import { all, one, pool, withTransaction } from '../db.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { id, text } from '../lib/validate.js'
import { requireRole } from '../middleware/auth.js'
import { assertCanJoin, insertMember, lockGroup } from '../services/groups.js'
import { logActivity } from '../lib/activity.js'

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
  await logActivity(req, 'report_resolved', { targetType: 'report', targetId: reportId })
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
    where.push('(u.name LIKE ? OR CONVERT(u.email USING utf8mb4) LIKE ? OR CONVERT(u.roll_no USING utf8mb4) LIKE ?)')
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
  if (role !== user.role) {
    await notify(userId, 'role_changed', `An admin changed your UNITE role to ${role}.`)
    await logActivity(req, 'role_changed', { targetType: 'user', targetId: userId, details: `${user.role} → ${role}` })
  }
  res.json({ ok: true })
})

// Suspend or restore an account; suspended users are signed out on their next request
adminRouter.post('/users/:id/active', async (req, res) => {
  const { id: userId } = z.object({ id }).parse(req.params)
  const { active } = z.object({ active: z.boolean() }).parse(req.body)
  if (userId === req.user.id) throw badRequest('You cannot suspend yourself.')
  const [r] = await pool.query('UPDATE user_account SET is_active = ? WHERE id = ?', [active, userId])
  if (!r.affectedRows) throw notFound('User not found.')
  await logActivity(req, active ? 'user_restored' : 'user_suspended', { targetType: 'user', targetId: userId })
  res.json({ ok: true })
})

// Activity log, newest first. Filter by action, by user (name, email or roll no.) or by day;
// pass ?before=<id> to load the next page.
adminRouter.get('/activity', async (req, res) => {
  const f = z
    .object({
      action: z.string().trim().max(40).optional(),
      q: z.string().trim().max(100).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      before: id.optional(),
    })
    .parse(req.query)
  const where = []
  const args = []
  if (f.action) {
    where.push('l.action = ?')
    args.push(f.action)
  }
  if (f.date) {
    where.push('l.created_at >= ? AND l.created_at < ? + INTERVAL 1 DAY')
    args.push(f.date, f.date)
  }
  if (f.before) {
    where.push('l.id < ?')
    args.push(f.before)
  }
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, '\\$&')}%`
    where.push('(u.name LIKE ? OR CONVERT(u.email USING utf8mb4) LIKE ? OR CONVERT(u.roll_no USING utf8mb4) LIKE ? OR l.details LIKE ?)')
    args.push(like, like, like, like)
  }
  const rows = await all(
    `SELECT l.id, l.action, l.target_type AS targetType, l.target_id AS targetId, l.details, l.ip, l.created_at AS createdAt,
            u.id AS userId, u.name AS userName, u.email AS userEmail, u.role AS userRole
       FROM activity_log l LEFT JOIN user_account u ON u.id = l.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.id DESC LIMIT 51`,
    args,
  )
  const actions = await all('SELECT DISTINCT action FROM activity_log ORDER BY action')
  res.json({ activity: rows.slice(0, 50), hasMore: rows.length > 50, actions: actions.map((a) => a.action) })
})

// ---------- Reverting decisions people cannot undo themselves ----------

// Everyone in a claim's team (the submitter plus every member of every union in it)
async function claimPeople(conn, teamId, submitterId) {
  const rows = await all(
    `SELECT DISTINCT gm.user_id FROM team_group tg JOIN group_member gm ON gm.group_id = tg.group_id WHERE tg.team_id = ?`,
    [teamId],
    conn,
  )
  return [submitterId, ...rows.map((r) => r.user_id)]
}

// Reopen an approved or rejected claim: points are taken back and faculty review it again
adminRouter.post('/claims/:id/reopen', async (req, res) => {
  const { id: claimId } = z.object({ id }).parse(req.params)
  const { reason } = z.object({ reason: text(300, 3) }).parse(req.body)
  const claim = await withTransaction(async (conn) => {
    const a = await one(
      `SELECT a.id, a.status, a.team_id, a.submitter_id, e.title FROM achievement a
         JOIN event_team t ON t.id = a.team_id JOIN event e ON e.id = t.event_id
        WHERE a.id = ? FOR UPDATE`,
      [claimId],
      conn,
    )
    if (!a) throw notFound('Claim not found.')
    if (!['approved', 'rejected'].includes(a.status)) throw conflict('Only approved or rejected claims can be reopened.', 'not_reviewed')
    await conn.query('DELETE FROM points_award WHERE achievement_id = ?', [a.id])
    await conn.query(
      `UPDATE achievement SET status = 'pending', reviewer_id = NULL, review_note = NULL, reviewed_at = NULL,
              base_points = NULL, multiplier = NULL, points = NULL WHERE id = ?`,
      [a.id],
    )
    return a
  })
  const people = await claimPeople(pool, claim.team_id, claim.submitter_id)
  await notify(people, 'claim_reopened', `An admin reopened your claim for ${claim.title}: ${reason}. Faculty will review it again.`, '/claims')
  const reviewers = await all(`SELECT id FROM user_account WHERE role IN ('faculty','admin') AND is_active AND id <> ?`, [req.user.id])
  await notify(reviewers.map((r) => r.id), 'review_needed', 'A reopened claim is waiting for review.', `/review/${claim.id}`)
  await logActivity(req, 'claim_reopened', { targetType: 'claim', targetId: claim.id, details: `was ${claim.status}: ${reason}` })
  res.json({ ok: true })
})

// Withdraw a claim a student submitted by mistake; the team may then submit a new one
adminRouter.post('/claims/:id/withdraw', async (req, res) => {
  const { id: claimId } = z.object({ id }).parse(req.params)
  const { reason } = z.object({ reason: text(300, 3) }).parse(req.body)
  const claim = await withTransaction(async (conn) => {
    const a = await one(
      `SELECT a.id, a.status, a.team_id, a.submitter_id, e.title FROM achievement a
         JOIN event_team t ON t.id = a.team_id JOIN event e ON e.id = t.event_id
        WHERE a.id = ? FOR UPDATE`,
      [claimId],
      conn,
    )
    if (!a) throw notFound('Claim not found.')
    if (a.status === 'withdrawn') throw conflict('This claim is already withdrawn.', 'already_withdrawn')
    await conn.query('DELETE FROM points_award WHERE achievement_id = ?', [a.id])
    await conn.query(
      `UPDATE achievement SET status = 'withdrawn', reviewer_id = ?, review_note = ?, reviewed_at = NOW(),
              base_points = NULL, multiplier = NULL, points = NULL WHERE id = ?`,
      [req.user.id, reason, a.id],
    )
    return a
  })
  const people = await claimPeople(pool, claim.team_id, claim.submitter_id)
  await notify(people, 'claim_withdrawn', `An admin withdrew your claim for ${claim.title}: ${reason}. You can submit it again.`, '/claims')
  await logActivity(req, 'claim_withdrawn', { targetType: 'claim', targetId: claim.id, details: `was ${claim.status}: ${reason}` })
  res.json({ ok: true })
})

// Put back a student a union leader removed (from that entry in the activity log)
adminRouter.post('/activity/:id/restore-member', async (req, res) => {
  const { id: logId } = z.object({ id }).parse(req.params)
  const entry = await one(`SELECT target_id AS groupId, details FROM activity_log WHERE id = ? AND action = 'member_removed'`, [logId])
  const studentId = Number(/#(\d+)/.exec(entry?.details || '')?.[1])
  if (!entry || !studentId) throw notFound('That removal was not found in the activity log.')
  await withTransaction(async (conn) => {
    await lockGroup(conn, entry.groupId)
    await assertCanJoin(conn, entry.groupId, studentId)
    await insertMember(conn, entry.groupId, studentId)
  })
  const group = await one('SELECT name FROM collab_group WHERE id = ?', [entry.groupId])
  await notify(studentId, 'member_restored', `An admin put you back in ${group.name}.`, `/groups/${entry.groupId}`)
  await logActivity(req, 'member_restored', { targetType: 'union', targetId: entry.groupId, details: `student #${studentId}` })
  res.json({ ok: true })
})
