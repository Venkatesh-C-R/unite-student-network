import { Router } from 'express'
import { z } from 'zod'
import { all, one, pool, withTransaction } from '../db.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { httpUrl, id, idParam, text } from '../lib/validate.js'
import { requireUser } from '../middleware/auth.js'

export const peopleRouter = Router()
peopleRouter.use(requireUser)

// True if either user has blocked the other
export async function isBlocked(a, b, conn = pool) {
  return Boolean(
    await one(
      'SELECT 1 FROM user_block WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
      [a, b, b, a],
      conn,
    ),
  )
}

// Friendship between the viewer and each listed student `u`. The join needs [viewerId, viewerId].
const FRIENDSHIP_JOIN = 'LEFT JOIN friend_request f ON f.pair_low = LEAST(u.id, ?) AND f.pair_high = GREATEST(u.id, ?)'
// ANY_VALUE keeps ONLY_FULL_GROUP_BY happy in grouped queries (one friend_request row per pair)
const FRIENDSHIP_COLUMNS = 'ANY_VALUE(f.id) AS frId, ANY_VALUE(f.status) AS frStatus, ANY_VALUE(f.sender_id) AS frSender'

function friendshipState(status, senderId, viewerId) {
  if (status === 'accepted') return 'friends'
  if (status === 'pending') return senderId === viewerId ? 'request_sent' : 'request_received'
  return 'none'
}

function withFriendship({ frId, frStatus, frSender, ...row }, viewerId) {
  const friendship = friendshipState(frStatus, frSender, viewerId)
  return { ...row, friendship, friendRequestId: frStatus === 'pending' ? frId : undefined }
}

async function profileOf(userId, viewerId) {
  const user = await one(
    `SELECT u.id, u.name, u.year, u.about, u.role, p.id AS programmeId, p.level AS programmeLevel, p.name AS programmeName
       FROM user_account u LEFT JOIN programme p ON p.id = u.programme_id
      WHERE u.id = ? AND u.is_active`,
    [userId],
  )
  if (!user) return null
  user.interests = (await all('SELECT interest FROM student_interest WHERE user_id = ? ORDER BY interest', [userId])).map((r) => r.interest)
  user.links = await all('SELECT label, url FROM profile_link WHERE user_id = ? ORDER BY position, id', [userId])
  if (viewerId && viewerId !== userId) {
    const fr = await one(
      'SELECT id, sender_id AS senderId, status FROM friend_request WHERE pair_low = ? AND pair_high = ?',
      [Math.min(userId, viewerId), Math.max(userId, viewerId)],
    )
    user.friendship = friendshipState(fr?.status, fr?.senderId, viewerId)
    user.friendRequestId = fr?.status === 'pending' ? fr.id : undefined
  }
  return user
}

// ---------- Profile ----------
peopleRouter.get('/me/profile', async (req, res) => {
  res.json({ profile: await profileOf(req.user.id) })
})

peopleRouter.put('/me/profile', async (req, res) => {
  const body = z
    .object({
      about: text(600).default(''),
      interests: z.array(text(40, 1).toLowerCase()).max(15).default([]),
      links: z.array(z.object({ label: text(40, 1), url: httpUrl })).max(10).default([]),
    })
    .parse(req.body)
  const interests = [...new Set(body.interests)]

  await withTransaction(async (conn) => {
    await conn.query('UPDATE user_account SET about = ? WHERE id = ?', [body.about, req.user.id])
    await conn.query('DELETE FROM student_interest WHERE user_id = ?', [req.user.id])
    if (interests.length)
      await conn.query('INSERT INTO student_interest (user_id, interest) VALUES ?', [interests.map((i) => [req.user.id, i])])
    await conn.query('DELETE FROM profile_link WHERE user_id = ?', [req.user.id])
    if (body.links.length)
      await conn.query('INSERT INTO profile_link (user_id, label, url, position) VALUES ?', [
        body.links.map((l, i) => [req.user.id, l.label, l.url, i]),
      ])
  })
  res.json({ profile: await profileOf(req.user.id) })
})

// ---------- Discovery ----------
peopleRouter.get('/students', async (req, res) => {
  const q = z
    .object({
      q: text(60).optional(),
      programmeId: id.optional(),
      interest: text(40).optional(),
      page: z.coerce.number().int().min(1).max(100).default(1),
    })
    .parse(req.query)
  const where = [`u.role = 'student'`, 'u.is_active', 'u.id <> ?',
    'NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ? AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?))']
  const params = [req.user.id, req.user.id, req.user.id]
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`
    where.push('(u.name LIKE ? OR u.roll_no LIKE ?)')
    params.push(like, like)
  }
  if (q.programmeId) {
    where.push('u.programme_id = ?')
    params.push(q.programmeId)
  }
  if (q.interest) {
    where.push('EXISTS (SELECT 1 FROM student_interest si WHERE si.user_id = u.id AND si.interest = ?)')
    params.push(q.interest.toLowerCase())
  }
  const rows = await all(
    `SELECT u.id, u.name, u.year, p.id AS programmeId, p.level AS programmeLevel, p.name AS programmeName,
            (SELECT GROUP_CONCAT(interest ORDER BY interest SEPARATOR ',') FROM student_interest WHERE user_id = u.id) AS interests,
            ${FRIENDSHIP_COLUMNS}
       FROM user_account u JOIN programme p ON p.id = u.programme_id
       ${FRIENDSHIP_JOIN}
      WHERE ${where.join(' AND ')}
      ORDER BY u.name LIMIT 21 OFFSET ?`,
    [req.user.id, req.user.id, ...params, (q.page - 1) * 20],
  )
  res.json({
    students: rows.slice(0, 20).map((r) => withFriendship({ ...r, interests: r.interests ? r.interests.split(',') : [] }, req.user.id)),
    hasMore: rows.length > 20,
  })
})

// Peers who share interests with me and are not yet my friends
peopleRouter.get('/students/suggested', async (req, res) => {
  const rows = await all(
    `SELECT u.id, u.name, u.year, p.id AS programmeId, p.level AS programmeLevel, p.name AS programmeName,
            COUNT(*) AS shared, GROUP_CONCAT(theirs.interest ORDER BY theirs.interest SEPARATOR ',') AS sharedInterests,
            ${FRIENDSHIP_COLUMNS}
       FROM student_interest mine
       JOIN student_interest theirs ON theirs.interest = mine.interest AND theirs.user_id <> mine.user_id
       JOIN user_account u ON u.id = theirs.user_id AND u.is_active AND u.role = 'student'
       JOIN programme p ON p.id = u.programme_id
       ${FRIENDSHIP_JOIN}
      WHERE mine.user_id = ?
        AND (f.id IS NULL OR f.status = 'rejected')
        AND NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = ? AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?))
      GROUP BY u.id ORDER BY shared DESC, u.name LIMIT 10`,
    [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id],
  )
  res.json({
    students: rows.map((r) => withFriendship({ ...r, sharedInterests: r.sharedInterests.split(',') }, req.user.id)),
  })
})

// Most common interests, for the Discover filter chips
peopleRouter.get('/interests/popular', async (req, res) => {
  const rows = await all(
    `SELECT si.interest, COUNT(*) AS students
       FROM student_interest si JOIN user_account u ON u.id = si.user_id AND u.is_active AND u.role = 'student'
      GROUP BY si.interest ORDER BY students DESC, si.interest LIMIT 20`,
  )
  res.json({ interests: rows })
})

peopleRouter.get('/students/:id', async (req, res) => {
  const { id: userId } = idParam().parse(req.params)
  if (await isBlocked(req.user.id, userId)) throw notFound('Student not found.')
  const profile = await profileOf(userId, req.user.id)
  if (!profile) throw notFound('Student not found.')
  res.json({ profile })
})

// ---------- Friends ----------
peopleRouter.get('/friends', async (req, res) => {
  const rows = await all(
    `SELECT u.id, u.name, p.level AS programmeLevel, p.name AS programmeName
       FROM friend_request f
       JOIN user_account u ON u.id = IF(f.sender_id = ?, f.receiver_id, f.sender_id)
       LEFT JOIN programme p ON p.id = u.programme_id
      WHERE f.status = 'accepted' AND (f.sender_id = ? OR f.receiver_id = ?)
      ORDER BY u.name`,
    [req.user.id, req.user.id, req.user.id],
  )
  res.json({ friends: rows })
})

peopleRouter.get('/friends/requests', async (req, res) => {
  const rows = await all(
    `SELECT f.id, f.created_at AS createdAt, IF(f.receiver_id = ?, 'incoming', 'outgoing') AS direction,
            u.id AS userId, u.name, p.level AS programmeLevel, p.name AS programmeName
       FROM friend_request f
       JOIN user_account u ON u.id = IF(f.sender_id = ?, f.receiver_id, f.sender_id)
       LEFT JOIN programme p ON p.id = u.programme_id
      WHERE f.status = 'pending' AND (f.sender_id = ? OR f.receiver_id = ?)
      ORDER BY f.created_at DESC`,
    [req.user.id, req.user.id, req.user.id, req.user.id],
  )
  res.json({ requests: rows })
})

peopleRouter.post('/friends/requests', async (req, res) => {
  const { userId } = z.object({ userId: id }).parse(req.body)
  const me = req.user.id
  if (userId === me) throw badRequest('You cannot send a friend request to yourself.')
  const other = await one(`SELECT id, role FROM user_account WHERE id = ? AND is_active`, [userId])
  if (!other || other.role !== 'student' || (await isBlocked(me, userId))) throw notFound('Student not found.')

  const low = Math.min(me, userId)
  const high = Math.max(me, userId)
  const result = await withTransaction(async (conn) => {
    const existing = await one('SELECT * FROM friend_request WHERE pair_low = ? AND pair_high = ? FOR UPDATE', [low, high], conn)
    if (existing?.status === 'accepted') throw conflict('You are already friends.', 'already_friends')
    if (existing?.status === 'pending') {
      if (existing.sender_id === me) throw conflict('Request already sent.', 'already_requested')
      // They already asked me: sending back means accepting
      await conn.query(`UPDATE friend_request SET status = 'accepted', responded_at = NOW() WHERE id = ?`, [existing.id])
      return { id: existing.id, status: 'accepted' }
    }
    if (existing) {
      // A rejected request can be sent again
      await conn.query(
        `UPDATE friend_request SET sender_id = ?, receiver_id = ?, status = 'pending', created_at = NOW(), responded_at = NULL WHERE id = ?`,
        [me, userId, existing.id],
      )
      return { id: existing.id, status: 'pending' }
    }
    const [r] = await conn.query(
      'INSERT INTO friend_request (sender_id, receiver_id, pair_low, pair_high) VALUES (?, ?, ?, ?)',
      [me, userId, low, high],
    )
    return { id: r.insertId, status: 'pending' }
  })
  await notify(
    userId,
    result.status === 'accepted' ? 'friend_accepted' : 'friend_request',
    result.status === 'accepted' ? `${req.user.name} accepted your friend request.` : `${req.user.name} sent you a friend request.`,
    `/students/${me}`,
  )
  res.status(result.status === 'pending' ? 201 : 200).json({ request: result })
})

peopleRouter.post('/friends/requests/:id/:action', async (req, res) => {
  const { id: requestId, action } = z.object({ id, action: z.enum(['accept', 'reject', 'cancel']) }).parse(req.params)
  const fr = await one(`SELECT * FROM friend_request WHERE id = ? AND status = 'pending'`, [requestId])
  if (!fr) throw notFound('Friend request not found.')
  if (action === 'cancel' ? fr.sender_id !== req.user.id : fr.receiver_id !== req.user.id) throw forbidden()

  if (action === 'cancel') {
    await pool.query('DELETE FROM friend_request WHERE id = ?', [fr.id])
  } else {
    const status = action === 'accept' ? 'accepted' : 'rejected'
    await pool.query(`UPDATE friend_request SET status = ?, responded_at = NOW() WHERE id = ? AND status = 'pending'`, [status, fr.id])
    if (status === 'accepted') await notify(fr.sender_id, 'friend_accepted', `${req.user.name} accepted your friend request.`, `/students/${req.user.id}`)
  }
  res.json({ ok: true })
})

peopleRouter.delete('/friends/:id', async (req, res) => {
  const { id: userId } = idParam().parse(req.params)
  await pool.query(
    `DELETE FROM friend_request WHERE pair_low = ? AND pair_high = ? AND status = 'accepted'`,
    [Math.min(userId, req.user.id), Math.max(userId, req.user.id)],
  )
  res.json({ ok: true })
})

// ---------- Block & report ----------
peopleRouter.get('/blocks', async (req, res) => {
  const rows = await all(
    'SELECT u.id, u.name FROM user_block b JOIN user_account u ON u.id = b.blocked_id WHERE b.blocker_id = ? ORDER BY u.name',
    [req.user.id],
  )
  res.json({ blocked: rows })
})

peopleRouter.post('/blocks', async (req, res) => {
  const { userId } = z.object({ userId: id }).parse(req.body)
  if (userId === req.user.id) throw badRequest('You cannot block yourself.')
  if (!(await one('SELECT id FROM user_account WHERE id = ?', [userId]))) throw notFound('Student not found.')
  await withTransaction(async (conn) => {
    await conn.query('INSERT IGNORE INTO user_block (blocker_id, blocked_id) VALUES (?, ?)', [req.user.id, userId])
    // Blocking ends any friendship or pending request
    await conn.query('DELETE FROM friend_request WHERE pair_low = ? AND pair_high = ?', [
      Math.min(userId, req.user.id),
      Math.max(userId, req.user.id),
    ])
  })
  res.status(201).json({ ok: true })
})

peopleRouter.delete('/blocks/:id', async (req, res) => {
  const { id: userId } = idParam().parse(req.params)
  await pool.query('DELETE FROM user_block WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, userId])
  res.json({ ok: true })
})

peopleRouter.post('/reports', async (req, res) => {
  const body = z.object({ userId: id, reason: text(500, 5) }).parse(req.body)
  if (body.userId === req.user.id) throw badRequest('You cannot report yourself.')
  if (!(await one('SELECT id FROM user_account WHERE id = ?', [body.userId]))) throw notFound('Student not found.')
  await pool.query('INSERT INTO user_report (reporter_id, reported_id, reason) VALUES (?, ?, ?)', [req.user.id, body.userId, body.reason])
  const admins = await all(`SELECT id FROM user_account WHERE role = 'admin' AND is_active`)
  await notify(admins.map((a) => a.id), 'report', 'A student was reported and needs review.', '/admin/reports')
  res.status(201).json({ ok: true, message: 'Thanks. An admin will look at this report.' })
})

// ---------- Notifications ----------
peopleRouter.get('/notifications', async (req, res) => {
  const rows = await all(
    `SELECT id, type, message, link, read_at IS NOT NULL AS isRead, created_at AS createdAt
       FROM notification WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
    [req.user.id],
  )
  const unread = await one('SELECT COUNT(*) AS n FROM notification WHERE user_id = ? AND read_at IS NULL', [req.user.id])
  res.json({ notifications: rows.map((r) => ({ ...r, isRead: Boolean(r.isRead) })), unread: unread.n })
})

peopleRouter.post('/notifications/read', async (req, res) => {
  const { ids } = z.object({ ids: z.array(id).max(100).optional() }).parse(req.body ?? {})
  if (ids?.length) {
    await pool.query('UPDATE notification SET read_at = NOW() WHERE user_id = ? AND id IN (?) AND read_at IS NULL', [req.user.id, ids])
  } else {
    await pool.query('UPDATE notification SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [req.user.id])
  }
  res.json({ ok: true })
})
