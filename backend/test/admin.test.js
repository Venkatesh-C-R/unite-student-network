import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { pool } from '../src/db.js'
import { P, PDF, agent, loginByCode, signedIn, startApp, stopApp } from './helpers.js'

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

test('admin reopens an approved claim (points taken back) and withdraws one so the team can resubmit', async () => {
  const admin = await signedIn(app, { role: 'admin' })
  const faculty = await signedIn(app, { role: 'faculty' })
  const owner = await signedIn(app, { programmeId: P.BE_IT })
  const g = (await owner.agent.post('/api/groups').send({ name: 'Revert Squad' })).body.group.id
  const ev = (await owner.agent.post('/api/events').send({ title: 'Undo Cup', hostInstitution: 'Y College', hostCategory: 'college' })).body.event
  const team = (await owner.agent.post(`/api/events/${ev.id}/teams`).send({ label: 'Solo', groupId: g })).body.team
  const submit = () =>
    owner.agent.post('/api/achievements').field('teamId', team.id).field('result', '1').attach('evidence', PDF, { filename: 'u.pdf', contentType: 'application/pdf' })
  const claimId = (await submit()).body.achievement.id
  await faculty.agent.post(`/api/review/achievements/${claimId}`).send({ decision: 'approve' })
  const points = async () => (await pool.query('SELECT COALESCE(SUM(points),0) AS p FROM points_award WHERE group_id = ?', [g]))[0][0].p
  assert.ok(Number(await points()) > 0)

  assert.equal((await faculty.agent.post(`/api/admin/claims/${claimId}/reopen`).send({ reason: 'Wrong certificate' })).status, 403)
  assert.equal((await admin.agent.post(`/api/admin/claims/${claimId}/reopen`).send({ reason: 'Wrong certificate' })).status, 200)
  assert.equal(Number(await points()), 0)
  const pending = await faculty.agent.get('/api/review/achievements').query({ q: String(claimId) })
  assert.equal(pending.body.achievements[0].status, 'pending')
  assert.equal((await admin.agent.post(`/api/admin/claims/${claimId}/reopen`).send({ reason: 'Again' })).status, 409)

  assert.equal((await submit()).status, 409, 'a second claim is blocked while one is pending')
  assert.equal((await admin.agent.post(`/api/admin/claims/${claimId}/withdraw`).send({ reason: 'Duplicate entry' })).status, 200)
  assert.equal((await submit()).status, 201, 'the team can submit again after a withdrawal')
})

test('admin restores a member a leader removed', async () => {
  const admin = await signedIn(app, { role: 'admin' })
  const owner = await signedIn(app, { programmeId: P.BE_MECH })
  const member = await signedIn(app, { programmeId: P.BE_CIVIL })
  const g = (await owner.agent.post('/api/groups').send({ name: 'Restorers' })).body.group.id
  const reqId = (await member.agent.post(`/api/groups/${g}/join-requests`).send({})).body.request.id
  await owner.agent.post(`/api/groups/${g}/join-requests/${reqId}/approve`)
  assert.equal((await owner.agent.delete(`/api/groups/${g}/members/${member.id}`)).status, 200)

  const log = (await admin.agent.get('/api/admin/activity').query({ action: 'member_removed' })).body.activity.find((a) => a.targetId === g)
  assert.ok(log)
  assert.equal((await admin.agent.post(`/api/admin/activity/${log.id}/restore-member`)).status, 200)
  const members = (await admin.agent.get(`/api/groups/${g}`)).body.members.map((m) => m.id)
  assert.ok(members.includes(member.id))
  assert.equal((await admin.agent.post(`/api/admin/activity/${log.id}/restore-member`)).status, 409, 'cannot restore twice')
})

test('searches with non-English letters work against the ASCII email and roll-number columns', async () => {
  const admin = await signedIn(app, { role: 'admin' })
  const faculty = await signedIn(app, { role: 'faculty' })
  const s = await signedIn(app, { programmeId: P.MCA, name: 'Zoé Tamil' })
  for (const q of ['Zoé', 'தமிழ்', '😀']) {
    const users = await admin.agent.get('/api/admin/users').query({ q })
    assert.equal(users.status, 200, `admin users: ${q}`)
    assert.equal((await admin.agent.get('/api/admin/activity').query({ q })).status, 200, `activity: ${q}`)
    assert.equal((await s.agent.get('/api/students').query({ q })).status, 200, `students: ${q}`)
    assert.equal((await faculty.agent.get('/api/review/achievements').query({ q })).status, 200, `review: ${q}`)
  }
  const found = (await admin.agent.get('/api/admin/users').query({ q: 'Zoé' })).body.users
  assert.ok(found.some((u) => u.id === s.id))
})
