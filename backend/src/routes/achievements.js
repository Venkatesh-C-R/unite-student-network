import path from 'node:path'
import { Router } from 'express'
import { z } from 'zod'
import { all, one, withTransaction } from '../db.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { scoreFor } from '../lib/scoring.js'
import { evidenceUpload, removeFiles, uploadDir, verifyFiles } from '../lib/uploads.js'
import { id, text } from '../lib/validate.js'
import { requireRole, requireUser } from '../middleware/auth.js'
import { logActivity } from '../lib/activity.js'

export const achievementsRouter = Router()

const RESULTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'participation']

const ACH_SELECT = `
  SELECT a.id, a.result, a.description, a.status, a.review_note AS reviewNote,
         a.base_points AS basePoints, a.multiplier, a.points,
         a.created_at AS createdAt, a.reviewed_at AS reviewedAt,
         s.id AS submitterId, s.name AS submitterName, r.name AS reviewerName,
         t.id AS teamId, t.label AS teamLabel,
         e.id AS eventId, e.title AS eventTitle, e.host_institution AS hostInstitution, e.host_category AS hostCategory
    FROM achievement a
    JOIN user_account s ON s.id = a.submitter_id
    LEFT JOIN user_account r ON r.id = a.reviewer_id
    JOIN event_team t ON t.id = a.team_id
    JOIN event e ON e.id = t.event_id`

async function withDetails(rows) {
  if (!rows.length) return rows
  const ids = rows.map((r) => r.id)
  const files = await all(
    'SELECT id, achievement_id AS achievementId, original_name AS name, mime_type AS type, size_bytes AS size FROM evidence WHERE achievement_id IN (?)',
    [ids],
  )
  const groups = await all(
    `SELECT a.id AS achievementId, g.id, g.name FROM achievement a
       JOIN team_group tg ON tg.team_id = a.team_id JOIN collab_group g ON g.id = tg.group_id
      WHERE a.id IN (?) ORDER BY g.name`,
    [ids],
  )
  return rows.map((r) => ({
    ...r,
    evidence: files.filter((f) => f.achievementId === r.id).map(({ achievementId, ...f }) => ({ ...f, url: `/api/evidence/${f.id}` })),
    groups: groups.filter((g) => g.achievementId === r.id).map(({ achievementId, ...g }) => g),
  }))
}

// May this user see this achievement (and its evidence)?
async function canView(user, achievementId) {
  if (user.role === 'faculty' || user.role === 'admin') return true
  return Boolean(
    await one(
      `SELECT 1 FROM achievement a
        WHERE a.id = ? AND (a.submitter_id = ? OR EXISTS (
          SELECT 1 FROM team_group tg JOIN group_member gm ON gm.group_id = tg.group_id
           WHERE tg.team_id = a.team_id AND gm.user_id = ?))`,
      [achievementId, user.id, user.id],
    ),
  )
}

// Submit a result with 1–5 evidence files (field "evidence"). Starts as pending.
achievementsRouter.post('/achievements', requireRole('student'), evidenceUpload, async (req, res) => {
  const files = req.files || []
  try {
    const body = z
      .object({ teamId: id, result: z.enum(RESULTS, { message: 'Result must be 1–10 or participation.' }), description: text(500).default('') })
      .parse(req.body)
    if (!files.length) throw badRequest('Attach at least one certificate or proof file.', 'evidence_required')
    await verifyFiles(files)

    const inTeam = await one(
      `SELECT gm.role FROM team_group tg JOIN group_member gm ON gm.group_id = tg.group_id WHERE tg.team_id = ? AND gm.user_id = ?`,
      [body.teamId, req.user.id],
    )
    if (!inTeam) throw forbidden('You can only submit results for a team your group is in.')
    if (inTeam.role !== 'owner') throw forbidden('Only the union leader can submit a claim for approval.', 'leader_only')

    const achievementId = await withTransaction(async (conn) => {
      const dup = await one(`SELECT id FROM achievement WHERE team_id = ? AND status IN ('pending','approved') FOR UPDATE`, [body.teamId], conn)
      if (dup) throw conflict('A result for this team is already submitted or approved.', 'already_submitted')
      const [r] = await conn.query('INSERT INTO achievement (team_id, submitter_id, result, description) VALUES (?, ?, ?, ?)', [
        body.teamId,
        req.user.id,
        body.result,
        body.description,
      ])
      await conn.query('INSERT INTO evidence (achievement_id, stored_name, original_name, mime_type, size_bytes) VALUES ?', [
        files.map((f) => [r.insertId, f.filename, f.originalname.slice(0, 200), f.mimetype, f.size]),
      ])
      return r.insertId
    })
    const reviewers = await all(`SELECT id FROM user_account WHERE role IN ('faculty','admin') AND is_active`)
    await notify(reviewers.map((r) => r.id), 'review_needed', 'A new achievement is waiting for review.', `/review/${achievementId}`)
    await logActivity(req, 'claim_submitted', { targetType: 'claim', targetId: achievementId, details: `result ${body.result}` })
    const [created] = await withDetails(await all(`${ACH_SELECT} WHERE a.id = ?`, [achievementId]))
    res.status(201).json({ achievement: created })
  } catch (e) {
    await removeFiles(files)
    throw e
  }
})

// Achievements I submitted or that belong to my groups
achievementsRouter.get('/achievements/mine', requireUser, async (req, res) => {
  const rows = await all(
    `${ACH_SELECT}
      WHERE a.submitter_id = ? OR EXISTS (
        SELECT 1 FROM team_group tg JOIN group_member gm ON gm.group_id = tg.group_id
         WHERE tg.team_id = a.team_id AND gm.user_id = ?)
      ORDER BY a.id DESC LIMIT 100`,
    [req.user.id, req.user.id],
  )
  res.json({ achievements: await withDetails(rows) })
})

achievementsRouter.get('/achievements/:id', requireUser, async (req, res) => {
  const { id: achId } = z.object({ id }).parse(req.params)
  if (!(await canView(req.user, achId))) throw notFound('Achievement not found.')
  const [row] = await withDetails(await all(`${ACH_SELECT} WHERE a.id = ?`, [achId]))
  if (!row) throw notFound('Achievement not found.')
  res.json({ achievement: row })
})

achievementsRouter.get('/evidence/:id', requireUser, async (req, res) => {
  const { id: fileId } = z.object({ id }).parse(req.params)
  const file = await one('SELECT * FROM evidence WHERE id = ?', [fileId])
  if (!file || !(await canView(req.user, file.achievement_id))) throw notFound('File not found.')
  res.setHeader('Content-Type', file.mime_type)
  res.setHeader('Content-Disposition', `inline; filename="${file.original_name.replace(/[^\w.\- ]/g, '_')}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.sendFile(path.join(uploadDir, path.basename(file.stored_name)))
})

// A claim's public reference is "CLM-" + its id, e.g. CLM-0007. Accepts "CLM-7", "clm0007", "#7" or "7".
const CLAIM_REF = /^#?\s*(?:clm)?[\s#-]*0*(\d{1,9})$/i

// ---------- Faculty / admin review ----------
// With q: a claim reference matches that one claim in any status; other text searches
// student name, roll number and event title across all statuses.
achievementsRouter.get('/review/achievements', requireRole('faculty', 'admin'), async (req, res) => {
  const { status, q } = z
    .object({ status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']).default('pending'), q: z.string().trim().max(100).optional() })
    .parse(req.query)
  let rows
  if (q) {
    const ref = CLAIM_REF.exec(q)
    if (ref) rows = await all(`${ACH_SELECT} WHERE a.id = ?`, [Number(ref[1])])
    else {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`
      rows = await all(`${ACH_SELECT} WHERE s.name LIKE ? OR s.roll_no LIKE ? OR e.title LIKE ? ORDER BY a.id DESC LIMIT 100`, [like, like, like])
    }
  } else rows = await all(`${ACH_SELECT} WHERE a.status = ? ORDER BY a.id ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 100`, [status])
  res.json({ achievements: await withDetails(rows) })
})

achievementsRouter.post('/review/achievements/:id', requireRole('faculty', 'admin'), async (req, res) => {
  const { id: achId } = z.object({ id }).parse(req.params)
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
    const a = await one(
      `SELECT a.id, a.result, a.submitter_id, a.team_id, e.id AS eventId, e.host_category, e.title
         FROM achievement a JOIN event_team t ON t.id = a.team_id JOIN event e ON e.id = t.event_id
        WHERE a.id = ? AND a.status = 'pending' FOR UPDATE`,
      [achId],
      conn,
    )
    if (!a) throw conflict('This claim is not pending (already reviewed or missing).', 'not_pending')
    if (a.submitter_id === req.user.id) throw forbidden('You cannot review your own claim.')

    if (body.decision === 'reject') {
      await conn.query(
        `UPDATE achievement SET status = 'rejected', reviewer_id = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?`,
        [req.user.id, body.note, a.id],
      )
      return { a, points: null }
    }

    const hostCategory = body.hostCategory || a.host_category
    if (hostCategory !== a.host_category) await conn.query('UPDATE event SET host_category = ? WHERE id = ?', [hostCategory, a.eventId])
    const score = scoreFor(a.result, hostCategory)
    await conn.query(
      `UPDATE achievement SET status = 'approved', reviewer_id = ?, review_note = ?, reviewed_at = NOW(),
              base_points = ?, multiplier = ?, points = ? WHERE id = ?`,
      [req.user.id, body.note ?? null, score.base, score.multiplier, score.points, a.id],
    )
    // Agreed policy: every group in the event team receives the full points
    const groups = await all('SELECT group_id FROM team_group WHERE team_id = ?', [a.team_id], conn)
    if (groups.length)
      await conn.query('INSERT INTO points_award (achievement_id, group_id, points) VALUES ?', [
        groups.map((g) => [a.id, g.group_id, score.points]),
      ])
    return { a, points: score.points }
  })

  const memberIds = await all(
    `SELECT DISTINCT gm.user_id FROM team_group tg JOIN group_member gm ON gm.group_id = tg.group_id WHERE tg.team_id = ?`,
    [outcome.a.team_id],
  )
  await notify(
    [outcome.a.submitter_id, ...memberIds.map((m) => m.user_id)],
    body.decision === 'approve' ? 'achievement_approved' : 'achievement_rejected',
    body.decision === 'approve'
      ? `Verified: ${outcome.a.title} — +${outcome.points} points for your group.`
      : `Your claim for ${outcome.a.title} was not approved: ${body.note}`,
    `/achievements/${achId}`,
  )
  await logActivity(req, body.decision === 'approve' ? 'claim_approved' : 'claim_rejected', {
    targetType: 'claim',
    targetId: achId,
    details: body.decision === 'approve' ? `+${outcome.points} pts` : body.note,
  })
  const [row] = await withDetails(await all(`${ACH_SELECT} WHERE a.id = ?`, [achId]))
  res.json({ achievement: row })
})

// ---------- Group leaderboard (approved points only) ----------
achievementsRouter.get('/leaderboard', requireUser, async (req, res) => {
  const rows = await all(
    `SELECT g.id, g.name,
            (SELECT COUNT(*) FROM group_member gm WHERE gm.group_id = g.id) AS memberCount,
            COALESCE(SUM(pa.points), 0) AS points,
            COUNT(pa.achievement_id) AS wins
       FROM collab_group g LEFT JOIN points_award pa ON pa.group_id = g.id
      GROUP BY g.id
      ORDER BY points DESC, wins DESC, g.name
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
