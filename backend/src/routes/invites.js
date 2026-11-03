import { Router } from 'express'
import { z } from 'zod'
import { all, one, withTransaction } from '../db.js'
import { notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { id } from '../lib/validate.js'
import { requireRole } from '../middleware/auth.js'
import { assertCanJoin, insertMember, lockGroup } from '../services/groups.js'

// Union invites the signed-in student has received
export const invitesRouter = Router()
invitesRouter.use(requireRole('student'))

invitesRouter.get('/', async (req, res) => {
  const invites = await all(
    `SELECT i.id, i.created_at AS createdAt, g.id AS groupId, g.name AS groupName, u.name AS inviterName
       FROM group_invite i
       JOIN collab_group g ON g.id = i.group_id
       LEFT JOIN user_account u ON u.id = i.inviter_id
      WHERE i.invitee_id = ? AND i.status = 'pending' ORDER BY i.id DESC`,
    [req.user.id],
  )
  res.json({ invites })
})

// Accepting re-checks every union rule under the group lock, like approving a join request
invitesRouter.post('/:id/:decision', async (req, res) => {
  const p = z.object({ id, decision: z.enum(['accept', 'decline']) }).parse(req.params)
  const invite = await one(`SELECT id, group_id, inviter_id FROM group_invite WHERE id = ? AND invitee_id = ? AND status = 'pending'`, [
    p.id,
    req.user.id,
  ])
  if (!invite) throw notFound('Invite not found.')
  await withTransaction(async (conn) => {
    await lockGroup(conn, invite.group_id)
    const still = await one(`SELECT id FROM group_invite WHERE id = ? AND status = 'pending' FOR UPDATE`, [invite.id], conn)
    if (!still) throw notFound('Invite not found.')
    if (p.decision === 'accept') {
      await assertCanJoin(conn, invite.group_id, req.user.id)
      await insertMember(conn, invite.group_id, req.user.id)
    }
    await conn.query('UPDATE group_invite SET status = ?, decided_at = NOW() WHERE id = ?', [
      p.decision === 'accept' ? 'accepted' : 'declined',
      invite.id,
    ])
  })
  if (p.decision === 'accept' && invite.inviter_id) {
    const group = await one('SELECT name FROM collab_group WHERE id = ?', [invite.group_id])
    await notify(invite.inviter_id, 'invite_accepted', `${req.user.name} joined ${group.name}.`, `/groups/${invite.group_id}`)
  }
  res.json({ ok: true, groupId: invite.group_id })
})
