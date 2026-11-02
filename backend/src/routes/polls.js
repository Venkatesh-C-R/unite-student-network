import { Router } from 'express'
import { z } from 'zod'
import { all, one, withTransaction } from '../db.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { id, text } from '../lib/validate.js'
import { requireRole } from '../middleware/auth.js'
import { membership } from '../services/groups.js'

// Group polls — this is also how meetups are planned.
export const pollsRouter = Router()

async function requireMember(groupId, userId) {
  if (!(await one('SELECT id FROM collab_group WHERE id = ?', [groupId]))) throw notFound('Group not found.')
  if (!(await membership(groupId, userId))) throw forbidden('Only group members can do that.')
}

async function pollsFor(groupId, userId, pollId) {
  const polls = await all(
    `SELECT p.id, p.question, p.closes_at AS closesAt, p.created_at AS createdAt,
            (p.closes_at IS NOT NULL AND p.closes_at <= NOW()) AS isClosed,
            u.name AS createdBy,
            (SELECT option_id FROM poll_vote v WHERE v.poll_id = p.id AND v.user_id = ?) AS myVote
       FROM poll p LEFT JOIN user_account u ON u.id = p.created_by
      WHERE p.group_id = ? ${pollId ? 'AND p.id = ?' : ''} ORDER BY p.id DESC`,
    pollId ? [userId, groupId, pollId] : [userId, groupId],
  )
  if (!polls.length) return []
  const options = await all(
    `SELECT o.poll_id AS pollId, o.id, o.label, COUNT(v.user_id) AS votes
       FROM poll_option o LEFT JOIN poll_vote v ON v.option_id = o.id AND v.poll_id = o.poll_id
      WHERE o.poll_id IN (?) GROUP BY o.id ORDER BY o.id`,
    [polls.map((p) => p.id)],
  )
  return polls.map((p) => ({
    ...p,
    isClosed: Boolean(p.isClosed),
    options: options.filter((o) => o.pollId === p.id).map(({ pollId, ...o }) => o),
  }))
}

pollsRouter.get('/groups/:id/polls', requireRole('student'), async (req, res) => {
  const { id: groupId } = z.object({ id }).parse(req.params)
  await requireMember(groupId, req.user.id)
  res.json({ polls: await pollsFor(groupId, req.user.id) })
})

pollsRouter.post('/groups/:id/polls', requireRole('student'), async (req, res) => {
  const { id: groupId } = z.object({ id }).parse(req.params)
  const body = z
    .object({
      question: text(200, 3),
      options: z.array(text(100, 1)).min(2, 'Give at least 2 options.').max(8, 'At most 8 options.'),
      closesAt: z.coerce.date().optional(),
    })
    .parse(req.body)
  if (new Set(body.options.map((o) => o.toLowerCase())).size !== body.options.length) throw badRequest('Options must be different.')
  if (body.closesAt && body.closesAt <= new Date()) throw badRequest('Closing time must be in the future.')
  await requireMember(groupId, req.user.id)

  const pollId = await withTransaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO poll (group_id, created_by, question, closes_at) VALUES (?, ?, ?, ?)', [
      groupId,
      req.user.id,
      body.question,
      body.closesAt ?? null,
    ])
    await conn.query('INSERT INTO poll_option (poll_id, label) VALUES ?', [body.options.map((o) => [r.insertId, o])])
    return r.insertId
  })
  const others = await all('SELECT user_id FROM group_member WHERE group_id = ? AND user_id <> ?', [groupId, req.user.id])
  await notify(others.map((o) => o.user_id), 'poll', `New poll in your group: ${body.question}`, `/groups/${groupId}`)
  res.status(201).json({ poll: (await pollsFor(groupId, req.user.id, pollId))[0] })
})

pollsRouter.post('/polls/:id/vote', requireRole('student'), async (req, res) => {
  const { id: pollId } = z.object({ id }).parse(req.params)
  const { optionId } = z.object({ optionId: id }).parse(req.body)
  const poll = await one('SELECT id, group_id, closes_at IS NOT NULL AND closes_at <= NOW() AS closed FROM poll WHERE id = ?', [pollId])
  if (!poll) throw notFound('Poll not found.')
  await requireMember(poll.group_id, req.user.id)
  if (poll.closed) throw conflict('This poll is closed.', 'poll_closed')
  const option = await one('SELECT id FROM poll_option WHERE id = ? AND poll_id = ?', [optionId, pollId])
  if (!option) throw badRequest('That option is not part of this poll.', 'bad_option')
  try {
    // The (poll_id, user_id) primary key makes a second vote impossible
    await withTransaction((conn) =>
      conn.query('INSERT INTO poll_vote (poll_id, user_id, option_id) VALUES (?, ?, ?)', [pollId, req.user.id, optionId]),
    )
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw conflict('You have already voted in this poll.', 'already_voted')
    throw e
  }
  res.status(201).json({ poll: (await pollsFor(poll.group_id, req.user.id, pollId))[0] })
})
