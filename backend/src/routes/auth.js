import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { one, pool, withTransaction } from '../db.js'
import { badRequest, conflict, unauthorized } from '../lib/errors.js'
import { consumeOtp, issueOtp } from '../lib/otp.js'
import { email, id, otpCode, text } from '../lib/validate.js'
import { logActivity } from '../lib/activity.js'

export const authRouter = Router()

const limiter = (limit) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => config.env === 'test' })

function studentRoll(addr) {
  const m = addr.match(config.studentEmail)
  if (!m) throw badRequest('Use your PSG roll-number email, like 26mx354@psgtech.ac.in.', 'email_not_allowed')
  return m[1].toUpperCase()
}

async function startSession(req, userId) {
  await new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())))
  req.session.userId = userId
}

export async function publicMe(userId) {
  return one(
    `SELECT u.id, u.email, u.roll_no AS rollNo, u.name, u.role, u.year, u.about,
            p.id AS programmeId, p.level AS programmeLevel, p.name AS programmeName
       FROM user_account u LEFT JOIN programme p ON p.id = u.programme_id
      WHERE u.id = ?`,
    [userId],
  )
}

// Step 1: email a 6-digit code. UNITE has no passwords: every sign-up and sign-in is by code.
authRouter.post('/otp', limiter(10), async (req, res) => {
  const body = z.object({ email, purpose: z.enum(['signup', 'login']) }).parse(req.body)
  const existing = await one('SELECT id, is_active FROM user_account WHERE email = ?', [body.email])

  if (body.purpose === 'signup') {
    studentRoll(body.email)
    if (existing) throw conflict('An account with this email already exists. Sign in instead.', 'email_taken')
    await issueOtp(body.email, 'signup')
  } else if (existing?.is_active) {
    await issueOtp(body.email, 'login')
  }
  // Same reply for sign-in whether or not the account exists
  res.json({ ok: true, message: `If the address has a UNITE account, a code is on its way. It expires in ${config.otp.ttlMinutes} minutes.` })
})

// Step 2 (new students): verify the code and create the account
authRouter.post('/register', limiter(20), async (req, res) => {
  const body = z
    .object({
      email,
      otp: otpCode,
      name: text(100, 2),
      programmeId: id,
      year: z.coerce.number().int().min(1).max(5),
    })
    .parse(req.body)
  const rollNo = studentRoll(body.email)

  const programme = await one('SELECT id FROM programme WHERE id = ? AND is_active', [body.programmeId])
  if (!programme) throw badRequest('Choose a valid programme.', 'bad_programme')

  const userId = await withTransaction(async (conn) => {
    await consumeOtp(conn, body.email, 'signup', body.otp)
    try {
      const [r] = await conn.query(
        `INSERT INTO user_account (email, roll_no, name, role, programme_id, year)
         VALUES (?, ?, ?, 'student', ?, ?)`,
        [body.email, rollNo, body.name, body.programmeId, body.year],
      )
      return r.insertId
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw conflict('An account with this email already exists.', 'email_taken')
      throw e
    }
  })

  await startSession(req, userId)
  await logActivity(req, 'signup', { userId, targetType: 'user', targetId: userId })
  res.status(201).json({ user: await publicMe(userId) })
})

// Step 2 (everyone else): sign in with the emailed code
authRouter.post('/login', limiter(20), async (req, res) => {
  const body = z.object({ email, otp: otpCode }).parse(req.body)
  const user = await one('SELECT id, is_active FROM user_account WHERE email = ?', [body.email])
  try {
    // With no account (or a suspended one) no code was sent, so this fails as "expired"
    await withTransaction((conn) => consumeOtp(conn, body.email, 'login', body.otp))
    if (!user?.is_active) throw unauthorized('This account cannot sign in.')
  } catch (e) {
    await logActivity(req, 'login_failed', { userId: user?.id ?? null, details: body.email })
    throw e
  }
  await startSession(req, user.id)
  await logActivity(req, 'login', { userId: user.id })
  res.json({ user: await publicMe(user.id) })
})

authRouter.post('/logout', async (req, res) => {
  if (req.user) await logActivity(req, 'logout')
  req.session.destroy(() => {
    res.clearCookie('unite.sid')
    res.json({ ok: true })
  })
})

// Who is signed in? Returns { user: null } rather than 401 so visitors' browsers log no error.
authRouter.get('/me', async (req, res) => {
  res.json({ user: req.user ? await publicMe(req.user.id) : null })
})

// Public list for the sign-up programme dropdown
authRouter.get('/programmes', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, level, name, institution FROM programme WHERE is_active ORDER BY id',
  )
  res.json({ programmes: rows })
})
