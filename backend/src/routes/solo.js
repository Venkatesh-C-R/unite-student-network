import path from 'node:path'
import { Router } from 'express'
import { z } from 'zod'
import { all, one, withTransaction } from '../db.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { scoreFor } from '../lib/scoring.js'
import { evidenceUpload, removeFiles, uploadDir, verifyFiles } from '../lib/uploads.js'
import { id, text } from '../lib/validate.js'
import { requireRole, requireUser } from '../middleware/auth.js'
import { logActivity } from '../lib/activity.js'

// Solo claims: a student's own result at an event. Faculty verify them like union claims,
// and the points count only on the solo leaderboard.
export const soloRouter = Router()

const RESULTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'participation']

const SOLO_SELECT = `
  SELECT c.id, c.result, c.description, c.status, c.review_note AS reviewNote,
         c.base_points AS basePoints, c.multiplier, c.points,
         c.created_at AS createdAt, c.reviewed_at AS reviewedAt,
         s.id AS submitterId, s.name AS submitterName, s.roll_no AS submitterRollNo, r.name AS reviewerName,
         e.id AS eventId, e.title AS eventTitle, e.host_institution AS hostInstitution, e.host_category AS hostCategory
    FROM solo_claim c
    JOIN user_account s ON s.id = c.student_id
    LEFT JOIN user_account r ON r.id = c.reviewer_id
    JOIN event e ON e.id = c.event_id`

async function withEvidence(rows) {
  if (!rows.length) return rows
  const files = await all(
    'SELECT id, claim_id AS claimId, original_name AS name, mime_type AS type, size_bytes AS size FROM solo_evidence WHERE claim_id IN (?)',
    [rows.map((r) => r.id)],
  )
  return rows.map((r) => ({
    ...r,
    solo: true,
    groups: [],
    evidence: files.filter((f) => f.claimId === r.id).map(({ claimId, ...f }) => ({ ...f, url: `/api/solo-evidence/${f.id}` })),
  }))
}

// Submit my own result with 1–5 evidence files (field "evidence"). Starts as pending.
soloRouter.post('/solo-claims', requireRole('student'), evidenceUpload, async (req, res) => {
  const files = req.files || []
  try {
    const body = z
      .object({ eventId: id, result: z.enum(RESULTS, { message: 'Result must be 1–10 or participation.' }), description: text(500).default('') })
      .parse(req.body)
    if (!files.length) throw badRequest('Attach at least one certificate or proof file.', 'evidence_required')
    await verifyFiles(files)
    const event = await one('SELECT id, title FROM event WHERE id = ?', [body.eventId])
    if (!event) throw notFound('Event not found.')

    const claimId = await withTransaction(async (conn) => {
      const dup = await one(
        `SELECT id FROM solo_claim WHERE event_id = ? AND student_id = ? AND status IN ('pending','approved') FOR UPDATE`,
        [body.eventId, req.user.id],
        conn,
      )
      if (dup) throw conflict('You already have a pending or verified solo claim for this event.', 'already_submitted')
      const [r] = await conn.query('INSERT INTO solo_claim (event_id, student_id, result, description) VALUES (?, ?, ?, ?)', [
        body.eventId,
        req.user.id,
        body.result,
        body.description,
      ])
      await conn.query('INSERT INTO solo_evidence (claim_id, stored_name, original_name, mime_type, size_bytes) VALUES ?', [
        files.map((f) => [r.insertId, f.filename, f.originalname.slice(0, 200), f.mimetype, f.size]),
      ])
      return r.insertId
    })
    const reviewers = await all(`SELECT id FROM user_account WHERE role IN ('faculty','admin') AND is_active`)
    await notify(reviewers.map((r) => r.id), 'review_needed', 'A new solo claim is waiting for review.', `/review?type=solo&q=SOL-${claimId}`)
    await logActivity(req, 'solo_claim_submitted', { targetType: 'solo_claim', targetId: claimId, details: `result ${body.result}` })
    const [created] = await withEvidence(await all(`${SOLO_SELECT} WHERE c.id = ?`, [claimId]))
    res.status(201).json({ claim: created })
  } catch (e) {
    await removeFiles(files)
    throw e
  }
})

soloRouter.get('/solo-claims/mine', requireRole('student'), async (req, res) => {
  const rows = await all(`${SOLO_SELECT} WHERE c.student_id = ? ORDER BY c.id DESC LIMIT 100`, [req.user.id])
  res.json({ claims: await withEvidence(rows) })
})

soloRouter.get('/solo-evidence/:id', requireUser, async (req, res) => {
  const { id: fileId } = z.object({ id }).parse(req.params)
  const file = await one('SELECT f.*, c.student_id FROM solo_evidence f JOIN solo_claim c ON c.id = f.claim_id WHERE f.id = ?', [fileId])
  const allowed = file && (req.user.role === 'faculty' || req.user.role === 'admin' || file.student_id === req.user.id)
  if (!allowed) throw notFound('File not found.')
  res.setHeader('Content-Type', file.mime_type)
  res.setHeader('Content-Disposition', `inline; filename="${file.original_name.replace(/[^\w.\- ]/g, '_')}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.sendFile(path.join(uploadDir, path.basename(file.stored_name)))
})

// A solo claim's public reference is "SOL-" + its id, e.g. SOL-0007. Accepts "SOL-7", "sol0007", "#7" or "7".
const SOLO_REF = /^#?\s*(?:sol)?[\s#-]*0*(\d{1,9})$/i

// ---------- Faculty / admin review ----------
soloRouter.get('/review/solo-claims', requireRole('faculty', 'admin'), async (req, res) => {
  const { status, q } = z
    .object({ status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']).default('pending'), q: z.string().trim().max(100).optional() })
    .parse(req.query)
  let rows
  if (q) {
    const ref = SOLO_REF.exec(q)
    if (ref) rows = await all(`${SOLO_SELECT} WHERE c.id = ?`, [Number(ref[1])])
    else {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`
      rows = await all(`${SOLO_SELECT} WHERE s.name LIKE ? OR CONVERT(s.roll_no USING utf8mb4) LIKE ? OR e.title LIKE ? ORDER BY c.id DESC LIMIT 100`, [like, like, like])
    }
  } else rows = await all(`${SOLO_SELECT} WHERE c.status = ? ORDER BY c.id ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 100`, [status])
  res.json({ claims: await withEvidence(rows) })
})

soloRouter.post('/review/solo-claims/:id', requireRole('faculty', 'admin'), async (req, res) => {
  const { id: claimId } = z.object({ id }).parse(req.params)
  const body = z
    .object({
      decision: z.enum(['approve', 'reject']),
      note: text(500).optional(),
      // The reviewer may correct the host category after checking the host institution
      hostCategory: z.enum(['college', 'state', 'national']).optional(),
    })
    .parse(req.body)
  if (body.decision === 'reject' && !body.note) throw badRequest('Give a short reason when rejecting.', 'note_required')

  const outcome = await withTransaction(async (conn) => {
    const c = await one(
      `SELECT c.id, c.result, c.student_id, e.id AS eventId, e.host_category, e.title
         FROM solo_claim c JOIN event e ON e.id = c.event_id
        WHERE c.id = ? AND c.status = 'pending' FOR UPDATE`,
      [claimId],
      conn,
    )
    if (!c) throw conflict('This claim is not pending (already reviewed or missing).', 'not_pending')

    if (body.decision === 'reject') {
      await conn.query(`UPDATE solo_claim SET status = 'rejected', reviewer_id = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?`, [
        req.user.id,
        body.note,
        c.id,
      ])
      return { c, points: null }
    }
    const hostCategory = body.hostCategory || c.host_category
    if (hostCategory !== c.host_category) await conn.query('UPDATE event SET host_category = ? WHERE id = ?', [hostCategory, c.eventId])
    const score = scoreFor(c.result, hostCategory)
    await conn.query(
      `UPDATE solo_claim SET status = 'approved', reviewer_id = ?, review_note = ?, reviewed_at = NOW(),
              base_points = ?, multiplier = ?, points = ? WHERE id = ?`,
      [req.user.id, body.note ?? null, score.base, score.multiplier, score.points, c.id],
    )
    return { c, points: score.points }
  })

  await notify(
    outcome.c.student_id,
    body.decision === 'approve' ? 'achievement_approved' : 'achievement_rejected',
    body.decision === 'approve'
      ? `Verified: ${outcome.c.title} — +${outcome.points} solo points.`
      : `Your solo claim for ${outcome.c.title} was not approved: ${body.note}`,
    '/claims?type=solo',
  )
  await logActivity(req, body.decision === 'approve' ? 'solo_claim_approved' : 'solo_claim_rejected', {
    targetType: 'solo_claim',
    targetId: claimId,
    details: body.decision === 'approve' ? `+${outcome.points} pts` : body.note,
  })
  const [row] = await withEvidence(await all(`${SOLO_SELECT} WHERE c.id = ?`, [claimId]))
  res.json({ claim: row })
})

// ---------- Solo leaderboard: students ranked by their own verified points ----------
soloRouter.get('/solo-leaderboard', requireUser, async (req, res) => {
  const rows = await all(
    `SELECT u.id, u.name, u.year, p.id AS programmeId, p.level AS programmeLevel, p.name AS programmeName,
            SUM(c.points) AS points, COUNT(*) AS wins
       FROM solo_claim c
       JOIN user_account u ON u.id = c.student_id AND u.is_active
       LEFT JOIN programme p ON p.id = u.programme_id
      WHERE c.status = 'approved'
      GROUP BY u.id
      ORDER BY points DESC, wins DESC, u.name
      LIMIT 100`,
  )
  let rank = 0
  let prev = null
  const ranked = rows.map((r, i) => {
    if (r.points !== prev) rank = i + 1
    prev = r.points
    return { rank, ...r }
  })
  res.json({ leaderboard: ranked })
})
