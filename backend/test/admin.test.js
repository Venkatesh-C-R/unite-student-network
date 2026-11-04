import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { P, agent, loginByCode, signedIn, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))

test('only admins can use admin routes', async () => {
  const student = await signedIn(app, { programmeId: P.MCA })
  const faculty = await signedIn(app, { role: 'faculty' })
  assert.equal((await student.agent.get('/api/admin/stats')).status, 403)
  assert.equal((await faculty.agent.get('/api/admin/users')).status, 403)
})

test('reports: listed for admins, then resolved', async () => {
  const admin = await signedIn(app, { role: 'admin' })
  const a = await signedIn(app, { programmeId: P.BE_CSE, name: 'Reporter Person' })
  const b = await signedIn(app, { programmeId: P.BE_IT, name: 'Reported Person' })
  assert.equal((await a.agent.post('/api/reports').send({ userId: b.id, reason: 'Sending spam messages' })).status, 201)

  const open = (await admin.agent.get('/api/admin/reports')).body.reports
  const report = open.find((r) => r.reportedId === b.id)
  assert.equal(report.reporterName, 'Reporter Person')
  assert.equal(report.reportsAgainst, 1)
  assert.equal((await admin.agent.get('/api/admin/stats')).body.stats.openReports, 1)

  assert.equal((await admin.agent.post(`/api/admin/reports/${report.id}/resolve`)).status, 200)
  assert.equal((await admin.agent.post(`/api/admin/reports/${report.id}/resolve`)).status, 404)
  const resolved = (await admin.agent.get('/api/admin/reports?status=resolved')).body.reports
  assert.ok(resolved.some((r) => r.id === report.id && r.resolvedByName))
})

test('suspending signs the user out and blocks login; restoring allows it again', async () => {
  const admin = await signedIn(app, { role: 'admin' })
  const s = await signedIn(app, { programmeId: P.MSC_DS })
  assert.equal((await s.agent.get('/api/groups/mine')).status, 200)

  assert.equal((await admin.agent.post(`/api/admin/users/${s.id}/active`).send({ active: false })).status, 200)
  assert.equal((await s.agent.get('/api/groups/mine')).status, 401)
  assert.notEqual((await loginByCode(s.agent, s.email)).status, 200)
  const list = (await admin.agent.get('/api/admin/users?status=suspended')).body.users
  assert.ok(list.some((u) => u.id === s.id && !u.isActive))

  await admin.agent.post(`/api/admin/users/${s.id}/active`).send({ active: true })
  assert.equal((await loginByCode(s.agent, s.email)).status, 200)
  assert.equal((await admin.agent.post(`/api/admin/users/${admin.id}/active`).send({ active: false })).status, 400)
})

test('role changes keep groups valid', async () => {
  const admin = await signedIn(app, { role: 'admin' })
  const member = await signedIn(app, { programmeId: P.BE_ECE })
  const free = await signedIn(app, { programmeId: P.BE_EEE })
  await member.agent.post('/api/groups').send({ name: 'Role Test Group' })

  const blocked = await admin.agent.post(`/api/admin/users/${member.id}/role`).send({ role: 'faculty' })
  assert.equal(blocked.status, 409)
  assert.equal(blocked.body.error, 'in_groups')

  assert.equal((await admin.agent.post(`/api/admin/users/${free.id}/role`).send({ role: 'faculty' })).status, 200)
  const found = (await admin.agent.get('/api/admin/users?role=faculty').query({ q: free.email })).body.users
  assert.equal(found[0].role, 'faculty')
})

test('activity log records sign-ins, claims and admin actions; only admins can read it', async () => {
  const admin = await signedIn(app, { role: 'admin' })
  const student = await signedIn(app, { programmeId: P.BE_EEE, name: 'Logged Lakshmi' })
  await agent(app).post('/api/auth/login').send({ email: student.email, otp: '000000' })
  await admin.agent.post(`/api/admin/users/${student.id}/active`).send({ active: false })

  const res = await admin.agent.get('/api/admin/activity').query({ q: 'Logged Lakshmi' })
  assert.equal(res.status, 200)
  const actions = res.body.activity.map((a) => a.action)
  assert.ok(actions.includes('login'), actions)
  assert.ok(actions.includes('login_failed'), actions)

  const suspended = await admin.agent.get('/api/admin/activity').query({ action: 'user_suspended' })
  assert.ok(suspended.body.activity.some((a) => a.targetId === student.id && a.userId === admin.id))
  assert.equal((await student.agent.get('/api/admin/activity')).status, 401)
  const faculty = await signedIn(app, { role: 'faculty' })
  assert.equal((await faculty.agent.get('/api/admin/activity')).status, 403)
})
