import request from 'supertest'
import { setupDatabase } from '../scripts/setup-db.js'
import { createApp } from '../src/app.js'
import { config } from '../src/config.js'
import { pool } from '../src/db.js'
import { outbox } from '../src/lib/mailer.js'

if (!config.db.database.endsWith('_test')) throw new Error('Tests must run against a *_test database')

let counter = 0

export async function startApp() {
  await setupDatabase({ reset: true })
  return createApp()
}

export async function stopApp(app) {
  await app.locals.sessionStore.close().catch(() => {})
  await pool.end()
}

// A supertest agent that keeps cookies and always sends the CSRF header
export function agent(app) {
  return request.agent(app).set('x-unite', '1')
}

// The 6-digit code in the newest email sent
export const lastCode = () => outbox.at(-1).text.match(/\b(\d{6})\b/)[1]

// Sign in the way the app does: ask for a code, then send it back. Older codes are aged past the
// resend cooldown so a test can sign the same person in more than once.
export async function loginByCode(a, email) {
  await pool.query(`UPDATE email_otp SET created_at = created_at - INTERVAL 5 MINUTE WHERE email = ?`, [email])
  const sent = outbox.length
  await a.post('/api/auth/otp').send({ email, purpose: 'login' })
  if (outbox.length === sent) return a.post('/api/auth/login').send({ email, otp: '000000' })
  return a.post('/api/auth/login').send({ email, otp: lastCode() })
}

// Insert a user directly and return a signed-in agent plus the user's id
export async function signedIn(app, { programmeId = null, role = 'student', name } = {}) {
  counter += 1
  const roll = `26zz${String(counter).padStart(3, '0')}`
  const email = role === 'student' ? `${roll}@psgtech.ac.in` : `staff${counter}@psgtech.ac.in`
  const [r] = await pool.query(
    'INSERT INTO user_account (email, roll_no, name, role, programme_id, year) VALUES (?, ?, ?, ?, ?, ?)',
    [email, role === 'student' ? roll.toUpperCase() : null, name || `User ${counter}`, role, programmeId, role === 'student' ? 1 : null],
  )
  const a = agent(app)
  const res = await loginByCode(a, email)
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { agent: a, id: r.insertId, email }
}

// Programme ids from db/seed-programmes.sql
export const P = {
  BE_CSE: 4, BE_MECH: 9, BE_FT: 13, BE_IT: 14, BE_ECE: 7, BE_CIVIL: 3, BE_EEE: 6,
  ME_CSE: 22, ME_VLSI: 30, MSC_DS: 38, MCA: 42, AUTO: 1,
}

// A tiny valid PDF for evidence uploads
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
