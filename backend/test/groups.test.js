import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { pool } from '../src/db.js'
import { P, signedIn, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))

async function createGroup(owner, name = 'Team Nova') {
  const res = await owner.agent.post('/api/groups').send({ name })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body.group.id
}

async function requestJoin(student, groupId) {
  return student.agent.post(`/api/groups/${groupId}/join-requests`).send({})
}

async function approve(owner, groupId, requestId) {
  return owner.agent.post(`/api/groups/${groupId}/join-requests/${requestId}/approve`)
}

async function join(owner, student, groupId) {
  const r = await requestJoin(student, groupId)
  assert.equal(r.status, 201, JSON.stringify(r.body))
  const a = await approve(owner, groupId, r.body.request.id)
  assert.equal(a.status, 200, JSON.stringify(a.body))
}

const memberCount = async (groupId) => (await pool.query('SELECT COUNT(*) n FROM group_member WHERE group_id = ?', [groupId]))[0][0].n

test('creator becomes owner; BE CSE and ME CSE can share a group', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_CSE })
  const meCse = await signedIn(app, { programmeId: P.ME_CSE })
  const g = await createGroup(owner)
  await join(owner, meCse, g)
  const detail = await owner.agent.get(`/api/groups/${g}`)
  assert.equal(detail.body.myRole, 'owner')
  assert.equal(detail.body.members.length, 2)
})

test('a second student from the same programme is rejected', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_CSE })
  const sameProg = await signedIn(app, { programmeId: P.BE_CSE })
  const g = await createGroup(owner)
  const r = await requestJoin(sameProg, g)
  assert.equal(r.status, 409)
  assert.equal(r.body.error, 'programme_taken')
})

test('the seventh member is rejected by the server', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_CSE })
  const g = await createGroup(owner)
  for (const p of [P.BE_MECH, P.BE_FT, P.MCA, P.MSC_DS, P.ME_VLSI]) await join(owner, await signedIn(app, { programmeId: p }), g)
  assert.equal(await memberCount(g), 6)
  const seventh = await signedIn(app, { programmeId: P.MBA })
  const r = await requestJoin(seventh, g)
  assert.equal(r.status, 409)
  assert.equal(r.body.error, 'group_full')
})

test('only the owner can approve requests', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_CSE })
  const member = await signedIn(app, { programmeId: P.BE_IT })
  const applicant = await signedIn(app, { programmeId: P.BE_ECE })
  const g = await createGroup(owner)
  await join(owner, member, g)
  const r = await requestJoin(applicant, g)
  assert.equal((await approve(member, g, r.body.request.id)).status, 403)
})

test('race: two approvals for the last slot — exactly one wins', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_CSE })
  const g = await createGroup(owner)
  for (const p of [P.BE_MECH, P.BE_FT, P.MCA, P.MSC_DS]) await join(owner, await signedIn(app, { programmeId: p }), g)
  assert.equal(await memberCount(g), 5)

  // Two students from different programmes both have pending requests for the single open slot
  const r1 = await requestJoin(await signedIn(app, { programmeId: P.ME_VLSI }), g)
  const r2 = await requestJoin(await signedIn(app, { programmeId: P.MBA }), g)
  const results = await Promise.all([approve(owner, g, r1.body.request.id), approve(owner, g, r2.body.request.id)])

  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
  assert.equal(results.find((r) => r.status === 409).body.error, 'group_full')
  assert.equal(await memberCount(g), 6)
})

test('race: two students of the same programme approved at once — exactly one wins', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_CSE })
  const g = await createGroup(owner)
  const r1 = await requestJoin(await signedIn(app, { programmeId: P.BE_CIVIL }), g)
  const r2 = await requestJoin(await signedIn(app, { programmeId: P.BE_CIVIL }), g)
  const results = await Promise.all([approve(owner, g, r1.body.request.id), approve(owner, g, r2.body.request.id)])

  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
  assert.equal(results.find((r) => r.status === 409).body.error, 'programme_taken')
  const [[{ n }]] = await pool.query(
    'SELECT COUNT(*) n FROM group_member gm JOIN user_account u ON u.id = gm.user_id WHERE gm.group_id = ? AND u.programme_id = ?',
    [g, P.BE_CIVIL],
  )
  assert.equal(n, 1)
})

test('when the owner leaves, the next member becomes owner', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_CSE })
  const member = await signedIn(app, { programmeId: P.BE_EEE })
  const g = await createGroup(owner)
  await join(owner, member, g)
  assert.equal((await owner.agent.delete(`/api/groups/${g}/members/me`)).status, 200)
  assert.equal((await member.agent.get(`/api/groups/${g}`)).body.myRole, 'owner')
})

test('students of the same programme can be friends', async () => {
  const a = await signedIn(app, { programmeId: P.MCA })
  const b = await signedIn(app, { programmeId: P.MCA })
  const req = await a.agent.post('/api/friends/requests').send({ userId: b.id })
  assert.equal(req.status, 201)
  assert.equal((await b.agent.post(`/api/friends/requests/${req.body.request.id}/accept`)).status, 200)
  const friends = await a.agent.get('/api/friends')
  assert.deepEqual(friends.body.friends.map((f) => f.id), [b.id])
})

test('blocking hides a student from discovery and ends the friendship', async () => {
  const a = await signedIn(app, { programmeId: P.MCA, name: 'Blocker' })
  const b = await signedIn(app, { programmeId: P.BE_IT, name: 'Blocked Person' })
  await a.agent.post('/api/friends/requests').send({ userId: b.id })
  assert.equal((await a.agent.post('/api/blocks').send({ userId: b.id })).status, 201)
  const search = await a.agent.get('/api/students').query({ q: 'Blocked Person' })
  assert.equal(search.body.students.length, 0)
  assert.equal((await b.agent.get(`/api/students/${a.id}`)).status, 404)
})
