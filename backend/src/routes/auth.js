import bcrypt from 'bcrypt'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { one, pool, withTransaction } from '../db.js'
import { badRequest, conflict, unauthorized } from '../lib/errors.js'
import { consumeOtp, issueOtp } from '../lib/otp.js'
import { email, id, otpCode, password, text } from '../lib/validate.js'
import { logActivity } from '../lib/activity.js'

export const authRouter = Router()

const DUMMY_HASH = bcrypt.hashSync('unite-timing-guard', config.bcryptRounds)

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

// Step 1: send a 6-digit code to a college email
authRouter.post('/otp', limiter(10), async (req, res) => {
  const body = z.object({ email, purpose: z.enum(['signup', 'reset']) }).parse(req.body)
  const existing = await one('SELECT id FROM user_account WHERE email = ?', [body.email])

  if (body.purpose === 'signup') {
    studentRoll(body.email)
    if (existing) throw conflict('An account with this email already exists. Sign in instead.', 'email_taken')
    await issueOtp(body.email, 'signup')
  } else if (existing) {
    await issueOtp(body.email, 'reset')
  }
  // Same reply for reset whether or not the account exists
  res.json({ ok: true, message: `If the address can receive mail, a code is on its way. It expires in ${config.otp.ttlMinutes} minutes.` })
})

// Step 2: verify the code and create the student account
authRouter.post('/register', limiter(20), async (req, res) => {
  const body = z
    .object({
      email,
      otp: otpCode,
      name: text(100, 2),
      programmeId: id,
      year: z.coerce.number().int().min(1).max(5),
      password,
    })
    .parse(req.body)
  const rollNo = studentRoll(body.email)

  const programme = await one('SELECT id FROM programme WHERE id = ? AND is_active', [body.programmeId])
  if (!programme) throw badRequest('Choose a valid programme.', 'bad_programme')

  const hash = await bcrypt.hash(body.password, config.bcryptRounds)
  const userId = await withTransaction(async (conn) => {
    await consumeOtp(conn, body.email, 'signup', body.otp)
    try {
      const [r] = await conn.query(
        `INSERT INTO user_account (email, roll_no, name, role, programme_id, year, password_hash)
         VALUES (?, ?, ?, 'student', ?, ?, ?)`,
        [body.email, rollNo, body.name, body.programmeId, body.year, hash],
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

authRouter.post('/login', limiter(10), async (req, res) => {
  const body = z.object({ email, password: z.string().min(1).max(72) }).parse(req.body)
  const user = await one('SELECT id, password_hash, is_active FROM user_account WHERE email = ?', [body.email])
  // Compare against a dummy hash when the user is missing so timing does not reveal accounts
  const ok = await bcrypt.compare(body.password, user?.password_hash || DUMMY_HASH)
  if (!user || !ok || !user.is_active) {
    await logActivity(req, 'login_failed', { userId: user?.id ?? null, details: body.email })
    throw unauthorized('Email or password is not correct.')
  }
  await startSession(req, user.id)
  await logActivity(req, 'login', { userId: user.id })
  res.json({ user: await publicMe(user.id) })
})

authRouter.post('/reset', limiter(10), async (req, res) => {
  const body = z.object({ email, otp: otpCode, password }).parse(req.body)
  const hash = await bcrypt.hash(body.password, config.bcryptRounds)
  await withTransaction(async (conn) => {
    await consumeOtp(conn, body.email, 'reset', body.otp)
    await conn.query('UPDATE user_account SET password_hash = ? WHERE email = ?', [hash, body.email])
  })
  await logActivity(req, 'password_reset', { userId: (await one('SELECT id FROM user_account WHERE email = ?', [body.email]))?.id })
  res.json({ ok: true, message: 'Password updated. You can sign in now.' })
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
