import path from 'node:path'
import { Router } from 'express'
import { z } from 'zod'
import { all, one, pool } from '../db.js'
import { logActivity } from '../lib/activity.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { flyerUpload, removeFiles, uploadDir, verifyFiles } from '../lib/uploads.js'
import { httpUrl, id, text } from '../lib/validate.js'
import { requireUser } from '../middleware/auth.js'

// Event flyers: anyone signed in can post a photo of a flyer; everyone can like it,
// comment on it and share it with their union.
export const flyersRouter = Router()
flyersRouter.use(requireUser)

const PAGE = 12

// The two ? are the viewer's id (liked by me, shared with my union)
const FLYER_SELECT = `
  SELECT f.id, f.title, f.details, DATE_FORMAT(f.event_date, '%Y-%m-%d') AS eventDate, f.link,
         f.created_at AS createdAt, u.id AS authorId, u.name AS authorName, u.role AS authorRole,
         (SELECT COUNT(*) FROM flyer_like l WHERE l.flyer_id = f.id) AS likes,
         (SELECT COUNT(*) FROM flyer_comment c WHERE c.flyer_id = f.id) AS comments,
         EXISTS (SELECT 1 FROM flyer_like l WHERE l.flyer_id = f.id AND l.user_id = ?) AS likedByMe,
         EXISTS (SELECT 1 FROM flyer_share s JOIN group_member gm ON gm.group_id = s.group_id
                  WHERE s.flyer_id = f.id AND gm.user_id = ?) AS sharedWithMyUnion
    FROM flyer f JOIN user_account u ON u.id = f.author_id`

const shape = (r) => ({
  ...r,
  likedByMe: Boolean(r.likedByMe),
  sharedWithMyUnion: Boolean(r.sharedWithMyUnion),
  imageUrl: `/api/flyers/${r.id}/image`,
})

async function getFlyer(flyerId, viewerId) {
  const row = await one(`${FLYER_SELECT} WHERE f.id = ?`, [viewerId, viewerId, flyerId])
  if (!row) throw notFound('This flyer was removed or does not exist.')
  return shape(row)
}

const myUnion = (userId) =>
  one('SELECT g.id, g.name FROM group_member gm JOIN collab_group g ON g.id = gm.group_id WHERE gm.user_id = ?', [userId])

const optional = (schema) => schema.optional().or(z.literal('').transform(() => undefined))

// Newest first, 12 at a time: ?before=<id of the last flyer shown>
flyersRouter.get('/', async (req, res) => {
  const { before } = z.object({ before: id.optional() }).parse(req.query)
  const rows = await all(`${FLYER_SELECT} ${before ? 'WHERE f.id < ?' : ''} ORDER BY f.id DESC LIMIT ?`, [
    req.user.id,
    req.user.id,
    ...(before ? [before] : []),
    PAGE + 1,
  ])
  res.json({ flyers: rows.slice(0, PAGE).map(shape), hasMore: rows.length > PAGE })
})

// Flyers shared with my union, newest share first
flyersRouter.get('/shared', async (req, res) => {
  const union = await myUnion(req.user.id)
  if (!union) return res.json({ union: null, shares: [] })
  const rows = await all(
    `${FLYER_SELECT.replace('FROM flyer f', ', s.created_at AS sharedAt, sb.name AS sharedByName FROM flyer f')}
       JOIN flyer_share s ON s.flyer_id = f.id AND s.group_id = ?
       LEFT JOIN user_account sb ON sb.id = s.shared_by
      ORDER BY s.created_at DESC, f.id DESC LIMIT 20`,
    [req.user.id, req.user.id, union.id],
  )
  res.json({ union, shares: rows.map(shape) })
})

flyersRouter.post('/', flyerUpload, async (req, res) => {
  const file = req.file
  try {
    const body = z
      .object({
        title: text(150, 3),
        details: text(1000).default(''),
        eventDate: optional(z.iso.date({ message: 'Pick a valid event date.' })),
        link: optional(httpUrl),
      })
      .parse(req.body)
    if (!file) throw badRequest('Add a photo of the flyer.', 'image_required')
    await verifyFiles([file])
    const [r] = await pool.query(
      'INSERT INTO flyer (author_id, title, details, event_date, link, image_name, image_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, body.title, body.details, body.eventDate ?? null, body.link ?? null, file.filename, file.mimetype],
    )
    await logActivity(req, 'flyer_posted', { targetType: 'flyer', targetId: r.insertId, details: body.title })
    res.status(201).json({ flyer: await getFlyer(r.insertId, req.user.id) })
  } catch (e) {
    if (file) await removeFiles([file])
    throw e
  }
})

flyersRouter.get('/:id', async (req, res) => {
  const { id: flyerId } = z.object({ id }).parse(req.params)
  const flyer = await getFlyer(flyerId, req.user.id)
  const comments = await all(
    `SELECT c.id, c.body, c.created_at AS createdAt, u.id AS userId, u.name AS userName
       FROM flyer_comment c JOIN user_account u ON u.id = c.user_id
      WHERE c.flyer_id = ? ORDER BY c.id`,
    [flyerId],
  )
  res.json({ flyer, comments })
})

flyersRouter.get('/:id/image', async (req, res) => {
  const { id: flyerId } = z.object({ id }).parse(req.params)
  const f = await one('SELECT image_name, image_type FROM flyer WHERE id = ?', [flyerId])
  if (!f) throw notFound('Image not found.')
  res.setHeader('Content-Type', f.image_type)
  res.setHeader('Cache-Control', 'private, max-age=86400')
  res.sendFile(path.join(uploadDir, path.basename(f.image_name)))
})

// Like / unlike. Both are safe to repeat.
async function likeState(flyerId, userId) {
  const r = await one(
    `SELECT COUNT(*) AS likes, SUM(user_id = ?) > 0 AS likedByMe FROM flyer_like WHERE flyer_id = ?`,
    [userId, flyerId],
  )
  return { likes: Number(r.likes), likedByMe: Boolean(r.likedByMe) }
}

flyersRouter.post('/:id/like', async (req, res) => {
  const { id: flyerId } = z.object({ id }).parse(req.params)
  await getFlyer(flyerId, req.user.id)
  await pool.query('INSERT IGNORE INTO flyer_like (flyer_id, user_id) VALUES (?, ?)', [flyerId, req.user.id])
  res.json(await likeState(flyerId, req.user.id))
})

flyersRouter.delete('/:id/like', async (req, res) => {
  const { id: flyerId } = z.object({ id }).parse(req.params)
  await pool.query('DELETE FROM flyer_like WHERE flyer_id = ? AND user_id = ?', [flyerId, req.user.id])
  res.json(await likeState(flyerId, req.user.id))
})

flyersRouter.post('/:id/comments', async (req, res) => {
  const { id: flyerId } = z.object({ id }).parse(req.params)
  const { body } = z.object({ body: text(500, 1) }).parse(req.body)
  const flyer = await getFlyer(flyerId, req.user.id)
  const [r] = await pool.query('INSERT INTO flyer_comment (flyer_id, user_id, body) VALUES (?, ?, ?)', [flyerId, req.user.id, body])
  if (flyer.authorId !== req.user.id) {
    await notify(flyer.authorId, 'flyer_comment', `${req.user.name} commented on your flyer "${flyer.title}".`, `/flyers/${flyerId}`)
  }
  const comment = { id: r.insertId, body, createdAt: new Date(), userId: req.user.id, userName: req.user.name }
  res.status(201).json({ comment })
})

// Your own comment, or any comment for an admin
flyersRouter.delete('/:id/comments/:commentId', async (req, res) => {
  const { id: flyerId, commentId } = z.object({ id, commentId: id }).parse(req.params)
  const c = await one('SELECT user_id FROM flyer_comment WHERE id = ? AND flyer_id = ?', [commentId, flyerId])
  if (!c) throw notFound('Comment not found.')
  if (c.user_id !== req.user.id && req.user.role !== 'admin') throw forbidden('You can only delete your own comments.')
  await pool.query('DELETE FROM flyer_comment WHERE id = ?', [commentId])
  res.json({ ok: true })
})

// Share with my union: its other members are notified
flyersRouter.post('/:id/share', async (req, res) => {
  const { id: flyerId } = z.object({ id }).parse(req.params)
  const flyer = await getFlyer(flyerId, req.user.id)
  const union = await myUnion(req.user.id)
  if (!union) throw badRequest('Join a union to share flyers with it.', 'no_union')
  try {
    await pool.query('INSERT INTO flyer_share (flyer_id, group_id, shared_by) VALUES (?, ?, ?)', [flyerId, union.id, req.user.id])
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw conflict(`This flyer is already shared with ${union.name}.`, 'already_shared')
    throw e
  }
  const members = await all('SELECT user_id FROM group_member WHERE group_id = ? AND user_id <> ?', [union.id, req.user.id])
  await notify(
    members.map((m) => m.user_id),
    'flyer_shared',
    `${req.user.name} shared a flyer with ${union.name}: "${flyer.title}".`,
    `/flyers/${flyerId}`,
  )
  await logActivity(req, 'flyer_shared', { targetType: 'flyer', targetId: flyerId, details: `with ${union.name}` })
  res.status(201).json({ union })
})

// The author can delete their flyer; an admin can remove any flyer (the author is told)
flyersRouter.delete('/:id', async (req, res) => {
  const { id: flyerId } = z.object({ id }).parse(req.params)
  const f = await one('SELECT author_id, title, image_name FROM flyer WHERE id = ?', [flyerId])
  if (!f) throw notFound('This flyer was removed or does not exist.')
  const own = f.author_id === req.user.id
  if (!own && req.user.role !== 'admin') throw forbidden('You can only delete your own flyers.')
  await pool.query('DELETE FROM flyer WHERE id = ?', [flyerId])
  await removeFiles([{ path: path.join(uploadDir, path.basename(f.image_name)) }])
  if (!own) await notify(f.author_id, 'flyer_removed', `An admin removed your flyer "${f.title}".`, '/flyers')
  await logActivity(req, own ? 'flyer_deleted' : 'flyer_removed', { targetType: 'flyer', targetId: flyerId, details: f.title })
  res.json({ ok: true })
})
