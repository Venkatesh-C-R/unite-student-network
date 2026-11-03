import bcrypt from 'bcrypt'
import request from 'supertest'
import { setupDatabase } from '../scripts/setup-db.js'
import { createApp } from '../src/app.js'
import { config } from '../src/config.js'
import { pool } from '../src/db.js'

if (!config.db.database.endsWith('_test')) throw new Error('Tests must run against a *_test database')

export const PASSWORD = 'test-password-1'
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

// Insert a user directly and return a signed-in agent plus the user's id
export async function signedIn(app, { programmeId = null, role = 'student', name } = {}) {
  counter += 1
  const roll = `26zz${String(counter).padStart(3, '0')}`
  const email = role === 'student' ? `${roll}@psgtech.ac.in` : `staff${counter}@psgtech.ac.in`
  const hash = await bcrypt.hash(PASSWORD, 4)
  const [r] = await pool.query(
    'INSERT INTO user_account (email, roll_no, name, role, programme_id, year, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, role === 'student' ? roll.toUpperCase() : null, name || `User ${counter}`, role, programmeId, role === 'student' ? 1 : null, hash],
  )
  const a = agent(app)
  const res = await a.post('/api/auth/login').send({ email, password: PASSWORD })
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
