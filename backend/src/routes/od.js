import path from 'node:path'
import { Router } from 'express'
import { z } from 'zod'
import { all, one, withTransaction } from '../db.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { notify } from '../lib/notify.js'
import { letterUpload, removeFiles, uploadDir, verifyFiles } from '../lib/uploads.js'
import { email, id, text } from '../lib/validate.js'
import { requireRole, requireUser } from '../middleware/auth.js'
import { logActivity } from '../lib/activity.js'

// On-duty (OD) requests. A student uploads the OD letter and sends it to one or more faculty by
// email. Only those faculty see it and decide. It is approved once all of them accept; one
// rejection rejects it.
export const odRouter = Router()

const MAX_FACULTY = 5
const MAX_DAYS = 30

const OD_SELECT = `
  SELECT o.id, o.purpose, DATE_FORMAT(o.from_date, '%Y-%m-%d') AS fromDate, DATE_FORMAT(o.to_date, '%Y-%m-%d') AS toDate,
         o.status, o.created_at AS createdAt, o.decided_at AS decidedAt,
         o.letter_original AS letterName, o.letter_type AS letterType, o.letter_size AS letterSize,
         s.id AS studentId, s.name AS studentName, s.roll_no AS studentRollNo, s.year AS studentYear,
         p.level AS programmeLevel, p.name AS programmeName
    FROM od_request o
    JOIN user_account s ON s.id = o.student_id
    LEFT JOIN programme p ON p.id = s.programme_id`

async function withApprovers(rows) {
  if (!rows.length) return rows
  const approvers = await all(
    `SELECT a.od_id AS odId, u.id, u.name, u.email, a.decision, a.note, a.decided_at AS decidedAt
       FROM od_approver a JOIN user_account u ON u.id = a.faculty_id
      WHERE a.od_id IN (?) ORDER BY u.name`,
    [rows.map((r) => r.id)],
  )
  return rows.map(({ letterName, letterType, letterSize, ...r }) => ({
    ...r,
    letter: { name: letterName, type: letterType, size: letterSize, url: `/api/od/${r.id}/letter` },
    approvers: approvers.filter((a) => a.odId === r.id).map(({ odId, ...a }) => a),
  }))
}

async function loadOne(odId) {
  const [row] = await withApprovers(await all(`${OD_SELECT} WHERE o.id = ?`, [odId]))
  return row
}

// May this user see this request? The student who sent it and the faculty it was sent to.
async function canView(user, odId) {
  return Boolean(
    await one(
      'SELECT 1 FROM od_request o WHERE o.id = ? AND (o.student_id = ? OR EXISTS (SELECT 1 FROM od_approver a WHERE a.od_id = o.id AND a.faculty_id = ?))',
      [odId, user.id, user.id],
    ),
  )
}

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

// Send an OD request: purpose, dates, faculty emails (comma, space or new line separated) and
// the letter (field "letter", PDF/PNG/JPG, required).
odRouter.post('/', requireRole('student'), letterUpload, async (req, res) => {
  const file = req.file
  try {
    const body = z
      .object({
        purpose: text(150, 3),
        fromDate: z.iso.date({ message: 'Choose the first day of the OD.' }),
        toDate: z.iso.date({ message: 'Choose the last day of the OD.' }),
        faculty: z.string().max(400).default(''),
      })
      .parse(req.body)
    if (body.toDate < body.fromDate) throw badRequest('The last day cannot be before the first day.', 'bad_dates')
    if (daysBetween(body.fromDate, body.toDate) + 1 > MAX_DAYS) throw badRequest(`One OD request can cover at most ${MAX_DAYS} days.`, 'bad_dates')

    const emails = [
      ...new Set(
        body.faculty
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((e) => {
            const parsed = email.safeParse(e)
            if (!parsed.success) throw badRequest(`"${e.slice(0, 40)}" is not a valid email address.`, 'bad_email')
            return parsed.data
          }),
      ),
    ]
    if (!emails.length) throw badRequest('Add the email of at least one faculty member.', 'faculty_required')
    if (emails.length > MAX_FACULTY) throw badRequest(`Send it to at most ${MAX_FACULTY} faculty.`, 'too_many_faculty')
    const faculty = await all(`SELECT id, email FROM user_account WHERE email IN (?) AND role = 'faculty' AND is_active`, [emails])
    const missing = emails.filter((e) => !faculty.some((f) => f.email === e))
    if (missing.length)
      throw badRequest(`${missing.join(', ')} ${missing.length > 1 ? 'are not faculty accounts' : 'is not a faculty account'} on UNITE.`, 'not_faculty')

    if (!file) throw badRequest('Attach the OD letter as a PDF, PNG or JPG.', 'letter_required')
    await verifyFiles([file])

    const odId = await withTransaction(async (conn) => {
      const [r] = await conn.query(
        `INSERT INTO od_request (student_id, purpose, from_date, to_date, letter_name, letter_original, letter_type, letter_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, body.purpose, body.fromDate, body.toDate, file.filename, file.originalname.slice(0, 200), file.mimetype, file.size],
      )
      await conn.query('INSERT INTO od_approver (od_id, faculty_id) VALUES ?', [faculty.map((f) => [r.insertId, f.id])])
      return r.insertId
    })
    await notify(
      faculty.map((f) => f.id),
      'od_requested',
      `${req.user.name} asked you to approve an OD: ${body.purpose}.`,
      '/od',
    )
    await logActivity(req, 'od_requested', { targetType: 'od', targetId: odId, details: `to ${emails.join(', ')}` })
    res.status(201).json({ od: await loadOne(odId) })
  } catch (e) {
    await removeFiles(file ? [file] : [])
    throw e
  }
})

// My OD requests (student)
odRouter.get('/mine', requireRole('student'), async (req, res) => {
  const rows = await all(`${OD_SELECT} WHERE o.student_id = ? ORDER BY o.id DESC LIMIT 100`, [req.user.id])
  res.json({ requests: await withApprovers(rows) })
})

// Requests sent to me (faculty). "waiting": I still have to decide and the request is still open.
odRouter.get('/inbox', requireRole('faculty'), async (req, res) => {
  const { view } = z.object({ view: z.enum(['waiting', 'done']).default('waiting') }).parse(req.query)
  const waiting = `a.decision = 'pending' AND o.status = 'pending'`
  const rows = await all(
    `${OD_SELECT} JOIN od_approver a ON a.od_id = o.id AND a.faculty_id = ?
      WHERE ${view === 'waiting' ? waiting : `NOT (${waiting})`}
      ORDER BY o.id ${view === 'waiting' ? 'ASC' : 'DESC'} LIMIT 100`,
    [req.user.id],
  )
  res.json({ requests: await withApprovers(rows) })
})

// Accept or reject a request sent to me. A rejection needs a reason.
odRouter.post('/:id/decision', requireRole('faculty'), async (req, res) => {
  const { id: odId } = z.object({ id }).parse(req.params)
  const body = z.object({ decision: z.enum(['approve', 'reject']), note: text(300).optional() }).parse(req.body)
  if (body.decision === 'reject' && !body.note) throw badRequest('Give a short reason when rejecting.', 'note_required')

  const outcome = await withTransaction(async (conn) => {
    const od = await one('SELECT id, student_id, purpose, status FROM od_request WHERE id = ? FOR UPDATE', [odId], conn)
    const mine = od && (await one('SELECT decision FROM od_approver WHERE od_id = ? AND faculty_id = ? FOR UPDATE', [odId, req.user.id], conn))
    if (!mine) throw notFound('OD request not found.')
    if (od.status !== 'pending') throw conflict(`This OD request is already ${od.status}.`, 'not_pending')
    if (mine.decision !== 'pending') throw conflict('You have already decided on this request.', 'already_decided')

    const decision = body.decision === 'approve' ? 'approved' : 'rejected'
    await conn.query('UPDATE od_approver SET decision = ?, note = ?, decided_at = NOW() WHERE od_id = ? AND faculty_id = ?', [
      decision,
      body.note ?? null,
      odId,
      req.user.id,
    ])
    const [{ waiting, total }] = await all(
      `SELECT SUM(decision = 'pending') AS waiting, COUNT(*) AS total FROM od_approver WHERE od_id = ?`,
      [odId],
      conn,
    )
    let status = 'pending'
    if (decision === 'rejected') status = 'rejected'
    else if (Number(waiting) === 0) status = 'approved'
    if (status !== 'pending') await conn.query('UPDATE od_request SET status = ?, decided_at = NOW() WHERE id = ?', [status, odId])
    return { od, status, approvedSoFar: Number(total) - Number(waiting), total: Number(total) }
  })

  const { od, status } = outcome
  const message =
    status === 'rejected'
      ? `${req.user.name} rejected your OD (${od.purpose}): ${body.note}`
      : status === 'approved'
        ? `Your OD (${od.purpose}) is approved by everyone you sent it to.`
        : `${req.user.name} approved your OD (${od.purpose}). ${outcome.approvedSoFar} of ${outcome.total} have approved.`
  await notify(od.student_id, `od_${status === 'pending' ? 'progress' : status}`, message, '/od')
  await logActivity(req, body.decision === 'approve' ? 'od_approved' : 'od_rejected', { targetType: 'od', targetId: odId, details: body.note })
  res.json({ od: await loadOne(odId) })
})

// The student withdraws a request that is still open
odRouter.post('/:id/withdraw', requireRole('student'), async (req, res) => {
  const { id: odId } = z.object({ id }).parse(req.params)
  const waitingOn = await withTransaction(async (conn) => {
    const od = await one('SELECT id, status FROM od_request WHERE id = ? AND student_id = ? FOR UPDATE', [odId, req.user.id], conn)
    if (!od) throw notFound('OD request not found.')
    if (od.status !== 'pending') throw conflict(`This OD request is already ${od.status}.`, 'not_pending')
    await conn.query(`UPDATE od_request SET status = 'withdrawn', decided_at = NOW() WHERE id = ?`, [odId])
    return all(`SELECT faculty_id FROM od_approver WHERE od_id = ? AND decision = 'pending'`, [odId], conn)
  })
  const od = await loadOne(odId)
  await notify(
    waitingOn.map((a) => a.faculty_id),
    'od_withdrawn',
    `${req.user.name} withdrew the OD request: ${od.purpose}.`,
    '/od',
  )
  await logActivity(req, 'od_withdrawn', { targetType: 'od', targetId: odId })
  res.json({ od })
})

odRouter.get('/:id/letter', requireUser, async (req, res) => {
  const { id: odId } = z.object({ id }).parse(req.params)
  const od = await one('SELECT letter_name, letter_original, letter_type FROM od_request WHERE id = ?', [odId])
  if (!od || !(await canView(req.user, odId))) throw notFound('File not found.')
  res.setHeader('Content-Type', od.letter_type)
  res.setHeader('Content-Disposition', `inline; filename="${od.letter_original.replace(/[^\w.\- ]/g, '_')}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.sendFile(path.join(uploadDir, path.basename(od.letter_name)))
})
