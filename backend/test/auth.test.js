import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { config } from '../src/config.js'
import { pool } from '../src/db.js'
import { agent, lastCode, loginByCode, P, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))

test('state-changing requests without the CSRF header are refused', async () => {
  const res = await request(app).post('/api/auth/otp').send({ email: '26mx001@psgtech.ac.in', purpose: 'signup' })
  assert.equal(res.status, 403)
})

test('only PSG roll-number emails can sign up', async () => {
  const res = await agent(app).post('/api/auth/otp').send({ email: 'someone@gmail.com', purpose: 'signup' })
  assert.equal(res.status, 400)
  assert.equal(res.body.error, 'email_not_allowed')
})

test('sign up with a code, then sign out and back in with a new code', async () => {
  const a = agent(app)
  const email = '26mx354@psgtech.ac.in'
  assert.equal((await a.post('/api/auth/otp').send({ email, purpose: 'signup' })).status, 200)
  const code = lastCode()

  // asking again straight away is rate-limited
  assert.equal((await a.post('/api/auth/otp').send({ email, purpose: 'signup' })).status, 429)

  const details = { email, name: 'Venkatesh C R', programmeId: P.MCA, year: 1 }
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

  // a sign-up code cannot be used to sign in, and a wrong code is refused
  assert.equal((await a.post('/api/auth/login').send({ email, otp: code })).status, 400)
  const login = await loginByCode(a, email)
  assert.equal(login.status, 200, JSON.stringify(login.body))
  assert.equal(login.body.user.name, 'Venkatesh C R')

  const [cols] = await pool.query(`SHOW COLUMNS FROM user_account LIKE 'password_hash'`)
  assert.equal(cols.length, 0, 'accounts have no password')
})

test('sign-in codes are only sent to existing accounts, with the same reply either way', async () => {
  const a = agent(app)
  await pool.query(`UPDATE email_otp SET created_at = created_at - INTERVAL 5 MINUTE`)
  const known = await a.post('/api/auth/otp').send({ email: '26mx354@psgtech.ac.in', purpose: 'login' })
  const unknown = await a.post('/api/auth/otp').send({ email: '26mx999@psgtech.ac.in', purpose: 'login' })
  assert.equal(known.status, 200)
  assert.equal(unknown.status, 200)
  assert.equal(unknown.body.message, known.body.message)
  assert.equal((await a.post('/api/auth/login').send({ email: '26mx999@psgtech.ac.in', otp: '123456' })).status, 400)
  assert.equal((await a.post('/api/auth/login').send({ email: '26mx354@psgtech.ac.in', password: 'anything' })).status, 400)
})

test('the demo code signs in demo accounts only, and only when configured', async () => {
  const [r] = await pool.query(`INSERT INTO user_account (email, roll_no, name, role, programme_id, year) VALUES ('26dm001@psgtech.ac.in', '26DM001', 'Demo One', 'student', ?, 1)`, [P.MCA])
  const real = '26mx354@psgtech.ac.in'
  config.demoLoginCode = null
  assert.equal((await agent(app).post('/api/auth/login').send({ email: '26dm001@psgtech.ac.in', otp: '123456' })).status, 400)

  config.demoLoginCode = '123456'
  try {
    const ok = await agent(app).post('/api/auth/login').send({ email: '26dm001@psgtech.ac.in', otp: '123456' })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.user.id, r.insertId)
    assert.equal((await agent(app).post('/api/auth/login').send({ email: real, otp: '123456' })).status, 400)
  } finally {
    config.demoLoginCode = null
  }
})

test('emails longer than 30 characters are refused before reaching the database', async () => {
  const long = 'a.very.long.faculty@psgtech.ac.in' // 33 characters
  for (const purpose of ['signup', 'login']) {
    const res = await agent(app).post('/api/auth/otp').send({ email: long, purpose })
    assert.equal(res.status, 400, purpose)
    assert.match(JSON.stringify(res.body), /at most 30 characters/)
  }
  // 30 is still allowed
  const ok = await agent(app).post('/api/auth/otp').send({ email: 'abcdefghij.mca@psgtech.ac.in'.padStart(30, 'x'), purpose: 'login' })
  assert.equal(ok.status, 200)
})
