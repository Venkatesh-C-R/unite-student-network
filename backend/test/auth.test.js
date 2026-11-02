import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { pool } from '../src/db.js'
import { outbox } from '../src/lib/mailer.js'
import { agent, P, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))

const lastCode = () => outbox.at(-1).text.match(/\b(\d{6})\b/)[1]

test('state-changing requests without the CSRF header are refused', async () => {
  const res = await request(app).post('/api/auth/otp').send({ email: '26mx001@psgtech.ac.in', purpose: 'signup' })
  assert.equal(res.status, 403)
})

test('only PSG roll-number emails can sign up', async () => {
  const res = await agent(app).post('/api/auth/otp').send({ email: 'someone@gmail.com', purpose: 'signup' })
  assert.equal(res.status, 400)
  assert.equal(res.body.error, 'email_not_allowed')
})

test('sign up with OTP, then log out and log in with the password', async () => {
  const a = agent(app)
  const email = '26mx354@psgtech.ac.in'
  assert.equal((await a.post('/api/auth/otp').send({ email, purpose: 'signup' })).status, 200)
  const code = lastCode()

  // asking again straight away is rate-limited
  assert.equal((await a.post('/api/auth/otp').send({ email, purpose: 'signup' })).status, 429)

  const details = { email, name: 'Venkatesh C R', programmeId: P.MCA, year: 1, password: 'a-strong-password' }
  const wrong = await a.post('/api/auth/register').send({ ...details, otp: code === '000000' ? '111111' : '000000' })
  assert.equal(wrong.status, 400)
  assert.equal(wrong.body.error, 'otp_invalid')

  const ok = await a.post('/api/auth/register').send({ ...details, otp: code })
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  assert.equal(ok.body.user.rollNo, '26MX354')
  assert.equal(ok.body.user.programmeName, 'Master of Computer Applications')

  // the same code cannot be used again
  const again = await agent(app).post('/api/auth/register').send({ ...details, otp: code })
  assert.equal(again.status, 400)

  assert.equal((await a.get('/api/auth/me')).body.user.email, email)
  await a.post('/api/auth/logout')
  assert.equal((await a.get('/api/auth/me')).body.user, null)

  assert.equal((await a.post('/api/auth/login').send({ email, password: 'wrong-password' })).status, 401)
  const login = await a.post('/api/auth/login').send({ email, password: 'a-strong-password' })
  assert.equal(login.status, 200)
  assert.equal(login.body.user.name, 'Venkatesh C R')

  const [[row]] = await pool.query('SELECT password_hash FROM user_account WHERE email = ?', [email])
  assert.match(row.password_hash, /^\$2[aby]\$/, 'password is stored as a bcrypt hash')
})

test('password reset with OTP', async () => {
  const a = agent(app)
  const email = '26mx354@psgtech.ac.in'
  await pool.query(`UPDATE email_otp SET created_at = created_at - INTERVAL 5 MINUTE WHERE email = ?`, [email])
  assert.equal((await a.post('/api/auth/otp').send({ email, purpose: 'reset' })).status, 200)
  const res = await a.post('/api/auth/reset').send({ email, otp: lastCode(), password: 'brand-new-password' })
  assert.equal(res.status, 200)
  assert.equal((await a.post('/api/auth/login').send({ email, password: 'brand-new-password' })).status, 200)
})
