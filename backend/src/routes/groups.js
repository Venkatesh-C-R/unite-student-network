import { Router } from 'express'
import { z } from 'zod'
import { all, one, pool, withTransaction } from '../db.js'
import { conflict, forbidden, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { id, text } from '../lib/validate.js'
import { requireRole } from '../middleware/auth.js'
import { isBlocked } from './people.js'
import { addMember, assertCanJoin, insertMember, lockGroup, MAX_GROUP_SIZE, membership } from '../services/groups.js'
import { logActivity } from '../lib/activity.js'

// Roles that run a union day to day: the leader (owner) and the second in command (deputy)
const LEADS = ['owner', 'deputy']

export const groupsRouter = Router()

const GROUP_SUMMARY = `
  SELECT g.id, g.name, g.description, g.created_at AS createdAt,
         COUNT(gm.user_id) AS memberCount,
         COALESCE((SELECT SUM(pa.points) FROM points_award pa WHERE pa.group_id = g.id), 0) AS points
    FROM collab_group g LEFT JOIN group_member gm ON gm.group_id = g.id`

// Adds each group's member programmes (and my role, pending requests for owners) to summary rows
async function withProgrammes(groups, userId) {
  if (!groups.length) return groups
  const ids = groups.map((g) => g.id)
  const rows = await all(
    `SELECT gm.group_id AS groupId, gm.user_id AS userId, gm.role, p.id, p.level, p.name
       FROM group_member gm JOIN user_account u ON u.id = gm.user_id JOIN programme p ON p.id = u.programme_id
      WHERE gm.group_id IN (?) ORDER BY FIELD(gm.role, 'owner', 'deputy', 'member'), gm.joined_at`,
    [ids],
  )
  const pending = await all(
    `SELECT group_id AS groupId, COUNT(*) AS n FROM group_join_request
      WHERE group_id IN (?) AND status = 'pending' GROUP BY group_id`,
    [ids],
  )
  return groups.map((g) => {
    const mine = rows.filter((r) => r.groupId === g.id)
    const myRole = mine.find((r) => r.userId === userId)?.role || null
    return {
      ...g,
      myRole,
      programmes: mine.map(({ id, level, name }) => ({ id, level, name })),
      pendingJoinRequests: LEADS.includes(myRole) ? pending.find((p) => p.groupId === g.id)?.n || 0 : undefined,
    }
  })
}

async function members(groupId) {
  return all(
    `SELECT u.id, u.name, gm.role, gm.joined_at AS joinedAt,
            p.id AS programmeId, p.level AS programmeLevel, p.name AS programmeName
       FROM group_member gm
       JOIN user_account u ON u.id = gm.user_id
       JOIN programme p ON p.id = u.programme_id
      WHERE gm.group_id = ? ORDER BY FIELD(gm.role, 'owner', 'deputy', 'member'), gm.joined_at`,
    [groupId],
  )
}

// Browse groups (optionally only those with room for my programme)
groupsRouter.get('/', requireRole('student', 'faculty', 'admin'), async (req, res) => {
  const q = z.object({ q: text(60).optional(), openForMe: z.stringbool().optional() }).parse(req.query)
  const where = []
  const params = []
  if (q.q) {
    where.push('g.name LIKE ?')
    params.push(`%${q.q}%`)
  }
  if (q.openForMe && req.user.programmeId) {
    where.push(`NOT EXISTS (SELECT 1 FROM group_member x JOIN user_account xu ON xu.id = x.user_id
                             WHERE x.group_id = g.id AND (xu.programme_id = ? OR x.user_id = ?))`)
    params.push(req.user.programmeId, req.user.id)
  }
  const rows = await all(
    `${GROUP_SUMMARY} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY g.id ${q.openForMe ? `HAVING memberCount < ${MAX_GROUP_SIZE}` : ''}
     ORDER BY g.created_at DESC LIMIT 50`,
    params,
  )
  res.json({ groups: await withProgrammes(rows, req.user.id) })
})

// The Groups page after login: my groups plus pending invitations to act on
groupsRouter.get('/mine', requireRole('student', 'faculty', 'admin'), async (req, res) => {
  const groups = await all(
    `${GROUP_SUMMARY} WHERE g.id IN (SELECT group_id FROM group_member WHERE user_id = ?)
     GROUP BY g.id ORDER BY g.created_at DESC`,
    [req.user.id],
  )
  const myRequests = await all(
    `SELECT r.id, r.group_id AS groupId, g.name AS groupName, r.status, r.created_at AS createdAt
       FROM group_join_request r JOIN collab_group g ON g.id = r.group_id
      WHERE r.user_id = ? AND r.status = 'pending' ORDER BY r.id DESC`,
    [req.user.id],
  )
  res.json({ groups: await withProgrammes(groups, req.user.id), pendingRequests: myRequests })
})

groupsRouter.post('/', requireRole('student'), async (req, res) => {
  const body = z.object({ name: text(60, 3), description: text(300).default('') }).parse(req.body)
  const groupId = await withTransaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO collab_group (name, description, creator_id) VALUES (?, ?, ?)', [
      body.name,
      body.description,
      req.user.id,
    ])
    // The creator joins under the same rules as everyone else
    await addMember(conn, r.insertId, req.user.id, 'owner')
    return r.insertId
  })
  await logActivity(req, 'union_created', { targetType: 'union', targetId: groupId, details: body.name })
  res.status(201).json({ group: { id: groupId, name: body.name, description: body.description }, members: await members(groupId) })
})

groupsRouter.get('/:id', requireRole('student', 'faculty', 'admin'), async (req, res) => {
  const { id: groupId } = z.object({ id }).parse(req.params)
  const group = await one(`${GROUP_SUMMARY} WHERE g.id = ? GROUP BY g.id`, [groupId])
  if (!group) throw notFound('Group not found.')
  const my = await membership(groupId, req.user.id)
  const result = { group, members: await members(groupId), myRole: my?.role || null, maxSize: MAX_GROUP_SIZE }
  if (LEADS.includes(my?.role)) {
    result.joinRequests = await all(
      `SELECT r.id, r.message, r.created_at AS createdAt, u.id AS userId, u.name,
              p.id AS programmeId, p.level AS programmeLevel, p.name AS programmeName
         FROM group_join_request r
         JOIN user_account u ON u.id = r.user_id JOIN programme p ON p.id = u.programme_id
        WHERE r.group_id = ? AND r.status = 'pending' ORDER BY r.id`,
      [groupId],
    )
  }
  res.json(result)
})

groupsRouter.patch('/:id', requireRole('student'), async (req, res) => {
  const { id: groupId } = z.object({ id }).parse(req.params)
  const body = z.object({ name: text(60, 3).optional(), description: text(300).optional() }).parse(req.body)
  if ((await membership(groupId, req.user.id))?.role !== 'owner') throw forbidden('Only the group owner can edit the group.')
  await pool.query('UPDATE collab_group SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?', [
    body.name ?? null,
    body.description ?? null,
    groupId,
  ])
  res.json({ ok: true })
})

// Ask to join. Rules are checked now (friendly early answer) and again on approval.
groupsRouter.post('/:id/join-requests', requireRole('student'), async (req, res) => {
  const { id: groupId } = z.object({ id }).parse(req.params)
  const { message } = z.object({ message: text(300).default('') }).parse(req.body ?? {})
  const requestId = await withTransaction(async (conn) => {
    await lockGroup(conn, groupId)
    await assertCanJoin(conn, groupId, req.user.id)
    try {
      const [r] = await conn.query('INSERT INTO group_join_request (group_id, user_id, message) VALUES (?, ?, ?)', [
        groupId,
        req.user.id,
        message,
      ])
      return r.insertId
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw conflict('You already asked to join this group.', 'already_requested')
      throw e
    }
  })
  const owners = await all(`SELECT user_id FROM group_member WHERE group_id = ? AND role IN ('owner', 'deputy')`, [groupId])
  await notify(owners.map((o) => o.user_id), 'join_request', `${req.user.name} asked to join your group.`, `/groups/${groupId}`)
  await logActivity(req, 'join_requested', { targetType: 'union', targetId: groupId })
  res.status(201).json({ request: { id: requestId, status: 'pending' } })
})

groupsRouter.delete('/:id/join-requests/mine', requireRole('student'), async (req, res) => {
  const { id: groupId } = z.object({ id }).parse(req.params)
  await pool.query(
    `UPDATE group_join_request SET status = 'cancelled', decided_at = NOW() WHERE group_id = ? AND user_id = ? AND status = 'pending'`,
    [groupId, req.user.id],
  )
  res.json({ ok: true })
})

// The leader or second in command approves or rejects. Approval re-checks the rules under the group lock.
groupsRouter.post('/:id/join-requests/:requestId/:decision', requireRole('student'), async (req, res) => {
  const p = z.object({ id, requestId: id, decision: z.enum(['approve', 'reject']) }).parse(req.params)
  const request = await withTransaction(async (conn) => {
    await lockGroup(conn, p.id)
    if (!LEADS.includes((await membership(p.id, req.user.id, conn))?.role)) throw forbidden('Only the leader or second in command can decide.')
    const r = await one(
      `SELECT id, user_id FROM group_join_request WHERE id = ? AND group_id = ? AND status = 'pending' FOR UPDATE`,
      [p.requestId, p.id],
      conn,
    )
    if (!r) throw notFound('Join request not found.')
    if (p.decision === 'approve') {
      await assertCanJoin(conn, p.id, r.user_id)
      await insertMember(conn, p.id, r.user_id)
    }
    await conn.query('UPDATE group_join_request SET status = ?, decided_by = ?, decided_at = NOW() WHERE id = ?', [
      p.decision === 'approve' ? 'approved' : 'rejected',
      req.user.id,
      r.id,
    ])
    return r
  })
  const group = await one('SELECT name FROM collab_group WHERE id = ?', [p.id])
  await notify(
    request.user_id,
    p.decision === 'approve' ? 'join_approved' : 'join_rejected',
    p.decision === 'approve' ? `You are now a member of ${group.name}.` : `Your request to join ${group.name} was not accepted.`,
    `/groups/${p.id}`,
  )
  await logActivity(req, p.decision === 'approve' ? 'join_approved' : 'join_rejected', {
    targetType: 'union',
    targetId: p.id,
    details: `student #${request.user_id}`,
  })
  res.json({ ok: true, members: await members(p.id) })
})

// Leave a group, or (leader) remove a member. If the leader leaves, the second in command takes over,
// otherwise the longest-standing member;
// an empty group is deleted.
groupsRouter.delete('/:id/members/:userId', requireRole('student'), async (req, res) => {
  const p = z.object({ id, userId: z.union([z.literal('me'), id]) }).parse(req.params)
  const targetId = p.userId === 'me' ? req.user.id : p.userId
  await withTransaction(async (conn) => {
    await lockGroup(conn, p.id)
    const mine = await membership(p.id, req.user.id, conn)
    if (!mine) throw notFound('You are not in this group.')
    if (targetId !== req.user.id && mine.role !== 'owner') throw forbidden('Only the owner can remove members.')
    const target = await membership(p.id, targetId, conn)
    if (!target) throw notFound('That student is not in this group.')
    await conn.query('DELETE FROM group_member WHERE group_id = ? AND user_id = ?', [p.id, targetId])
    if (target.role === 'owner') {
      const next = await one(`SELECT user_id FROM group_member WHERE group_id = ? ORDER BY role = 'deputy' DESC, joined_at, user_id LIMIT 1`, [p.id], conn)
      if (next) await conn.query(`UPDATE group_member SET role = 'owner' WHERE group_id = ? AND user_id = ?`, [p.id, next.user_id])
      else await conn.query('DELETE FROM collab_group WHERE id = ?', [p.id])
    }
  })
  await logActivity(req, targetId === req.user.id ? 'union_left' : 'member_removed', {
    targetType: 'union',
    targetId: p.id,
    details: targetId === req.user.id ? null : `student #${targetId}`,
  })
  res.json({ ok: true })
})

// The leader names one member as second in command, or clears it with { userId: null }.
groupsRouter.put('/:id/deputy', requireRole('student'), async (req, res) => {
  const { id: groupId } = z.object({ id }).parse(req.params)
  const { userId } = z.object({ userId: id.nullable() }).parse(req.body)
  await withTransaction(async (conn) => {
    await lockGroup(conn, groupId)
    if ((await membership(groupId, req.user.id, conn))?.role !== 'owner') throw forbidden('Only the leader can choose the second in command.')
    if (userId !== null && (await membership(groupId, userId, conn))?.role !== 'member') throw notFound('That student is not a member of this union.')
    await conn.query(`UPDATE group_member SET role = 'member' WHERE group_id = ? AND role = 'deputy'`, [groupId])
    if (userId !== null) await conn.query(`UPDATE group_member SET role = 'deputy' WHERE group_id = ? AND user_id = ?`, [groupId, userId])
  })
  if (userId !== null) {
    const group = await one('SELECT name FROM collab_group WHERE id = ?', [groupId])
    await notify(userId, 'deputy', `You are now second in command of ${group.name}.`, `/groups/${groupId}`)
  }
  await logActivity(req, 'deputy_changed', { targetType: 'union', targetId: groupId, details: userId ? `student #${userId}` : 'cleared' })
  res.json({ ok: true, members: await members(groupId) })
})

// Only the leader invites a student who could join (same rules as a join request)
groupsRouter.post('/:id/invites', requireRole('student'), async (req, res) => {
  const { id: groupId } = z.object({ id }).parse(req.params)
  const { userId } = z.object({ userId: id }).parse(req.body)
  const inviteId = await withTransaction(async (conn) => {
    await lockGroup(conn, groupId)
    if ((await membership(groupId, req.user.id, conn))?.role !== 'owner') throw forbidden('Only the union leader can invite students.')
    if (await isBlocked(req.user.id, userId, conn)) throw notFound('Student not found.')
    if (await one('SELECT 1 FROM group_member WHERE user_id = ?', [userId], conn)) {
      throw conflict('That student is already in a union.', 'already_in_union')
    }
    await assertCanJoin(conn, groupId, userId)
    try {
      const [r] = await conn.query('INSERT INTO group_invite (group_id, inviter_id, invitee_id) VALUES (?, ?, ?)', [groupId, req.user.id, userId])
      return r.insertId
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw conflict('This student already has an invite to this union.', 'already_invited')
      throw e
    }
  })
  const group = await one('SELECT name FROM collab_group WHERE id = ?', [groupId])
  await notify(userId, 'union_invite', `${req.user.name} invited you to join ${group.name}.`, '/groups')
  await logActivity(req, 'invite_sent', { targetType: 'union', targetId: groupId, details: `student #${userId}` })
  res.status(201).json({ invite: { id: inviteId, status: 'pending' } })
})
