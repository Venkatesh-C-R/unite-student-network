import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { config } from '../src/config.js'
import { pool } from '../src/db.js'
import { outbox, providers } from '../src/lib/mailer.js'
import { emailKey } from '../src/routes/auth.js'
import { agent, loginByCode, signedIn, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))

test('a sign-in lasts until logout: the cookie is renewed for 400 days on every visit', async () => {
  const s = await signedIn(app)
  const res = await s.agent.get('/api/auth/me')
  assert.equal(res.status, 200)
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('unite.sid='))
  const days = (Date.parse(cookie.match(/Expires=([^;]+)/i)[1]) - Date.now()) / 86400000
  assert.ok(days > 399.9 && days <= 400, `cookie lasts ${days} days`)
  const [[row]] = await pool.query('SELECT MAX(expires) AS e FROM sessions')
  assert.ok(row.e - Date.now() / 1000 > 399 * 24 * 60 * 60, 'stored session lasts 400 days too')

  // Logging out ends it on this device only
  const other = agent(app)
  assert.equal((await loginByCode(other, s.email)).status, 200)
  assert.equal((await s.agent.post('/api/auth/logout')).status, 200)
  assert.equal((await s.agent.get('/api/auth/me')).body.user, null)
  assert.equal((await other.get('/api/auth/me')).body.user.id, s.id)
})

test('sign-in limits count per email, so a campus sharing one IP is not blocked', async () => {
  assert.equal(emailKey({ body: { email: ' 26AB123@psgtech.ac.in ' }, ip: '1.2.3.4' }), 'email:26ab123@psgtech.ac.in')
  assert.match(emailKey({ body: {}, ip: '1.2.3.4' }), /^ip:/)

  config.rateLimits.inTests = true
  try {
    // 12 different students from the same IP (the old limit was 10 per IP)
    for (let i = 0; i < 12; i++) {
      const res = await agent(app).post('/api/auth/otp').send({ email: `26rl${String(i).padStart(3, '0')}@psgtech.ac.in`, purpose: 'signup' })
      assert.equal(res.status, 200, `student ${i}: ${JSON.stringify(res.body)}`)
    }
    // One address asking again and again is stopped after 5 tries
    const codes = []
    for (let i = 0; i < 6; i++) codes.push((await agent(app).post('/api/auth/otp').send({ email: '26rl999@psgtech.ac.in', purpose: 'signup' })).body.error)
    assert.equal(codes.at(-1), 'rate_limited')
  } finally {
    config.rateLimits.inTests = false
  }
})

test('mail falls back to the next provider, and a failed send can be retried at once', async () => {
  const saved = { list: config.mail.providers, key: config.mail.brevoKey, send: providers.brevo.send }
  try {
    config.mail.brevoKey = 'test-key'
    providers.brevo.send = async () => {
      throw new Error('daily limit reached')
    }

    // brevo fails, console sends
    config.mail.providers = ['brevo', 'console']
    const before = outbox.length
    const ok = await agent(app).post('/api/auth/otp').send({ email: '26fb001@psgtech.ac.in', purpose: 'signup' })
    assert.equal(ok.status, 200)
    assert.equal(outbox.length, before + 1)

    // every provider fails: a clear 503, and no code is left behind to block a retry
    config.mail.providers = ['brevo']
    const fail = await agent(app).post('/api/auth/otp').send({ email: '26fb002@psgtech.ac.in', purpose: 'signup' })
    assert.equal(fail.status, 503)
    assert.equal(fail.body.error, 'mail_unavailable')
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM email_otp WHERE email = ?', ['26fb002@psgtech.ac.in'])
    assert.equal(n, 0)

    config.mail.providers = ['console']
    const retry = await agent(app).post('/api/auth/otp').send({ email: '26fb002@psgtech.ac.in', purpose: 'signup' })
    assert.equal(retry.status, 200)
  } finally {
    Object.assign(config.mail, { providers: saved.list, brevoKey: saved.key })
    providers.brevo.send = saved.send
  }
})
