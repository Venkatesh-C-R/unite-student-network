import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { pool } from '../src/db.js'
import { uploadDir } from '../src/lib/uploads.js'
import { P, PDF, signedIn, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))

// A file that starts with the PNG signature (all the server checks)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)])

function post(user, fields = {}, image = PNG, type = 'image/png') {
  const req = user.agent.post('/api/flyers')
  for (const [k, v] of Object.entries({ title: 'Hack the Campus 2026', ...fields })) req.field(k, v)
  return image ? req.attach('image', image, { filename: 'flyer.png', contentType: type }) : req
}

async function union(owner, members) {
  const g = await owner.agent.post('/api/groups').send({ name: `Union ${owner.id}` })
  assert.equal(g.status, 201, JSON.stringify(g.body))
  const groupId = g.body.group.id
  for (const m of members) {
    const r = await m.agent.post(`/api/groups/${groupId}/join-requests`).send({})
    assert.equal((await owner.agent.post(`/api/groups/${groupId}/join-requests/${r.body.request.id}/approve`)).status, 200)
  }
  return groupId
}

const notes = async (userId, type) =>
  (await pool.query('SELECT message, link FROM notification WHERE user_id = ? AND type = ?', [userId, type]))[0]

test('anyone signed in can post a flyer photo; it needs a real PNG or JPG', async () => {
  const student = await signedIn(app, { programmeId: P.BE_CSE })
  const faculty = await signedIn(app, { role: 'faculty' })

  assert.equal((await post(student, {}, null)).body.error, 'image_required')
  assert.equal((await post(student, {}, PDF, 'application/pdf')).body.error, 'bad_file_type')
  assert.equal((await post(student, {}, Buffer.from('not an image'))).body.error, 'bad_file_content')
  assert.equal((await post(student, { link: 'javascript:alert(1)' })).status, 400)

  const ok = await post(student, { details: 'Teams of up to 6. Prizes worth ₹50,000.', eventDate: '2026-12-01', link: 'https://example.org/hack' })
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  assert.equal(ok.body.flyer.eventDate, '2026-12-01')
  assert.equal(ok.body.flyer.likes, 0)
  assert.equal((await post(faculty, { title: 'Guest lecture on AI', eventDate: '' })).status, 201)

  const feed = await faculty.agent.get('/api/flyers')
  assert.deepEqual(feed.body.flyers.slice(0, 2).map((f) => f.title), ['Guest lecture on AI', 'Hack the Campus 2026'])

  const img = await faculty.agent.get(ok.body.flyer.imageUrl)
  assert.equal(img.status, 200)
  assert.equal(img.headers['content-type'], 'image/png')
})

test('likes count once per person and can be undone', async () => {
  const author = await signedIn(app, { programmeId: P.BE_CSE })
  const fan = await signedIn(app, { programmeId: P.MCA })
  const { id } = (await post(author)).body.flyer

  await fan.agent.post(`/api/flyers/${id}/like`)
  const twice = await fan.agent.post(`/api/flyers/${id}/like`)
  assert.deepEqual(twice.body, { likes: 1, likedByMe: true })
  assert.deepEqual((await author.agent.post(`/api/flyers/${id}/like`)).body, { likes: 2, likedByMe: true })
  assert.deepEqual((await fan.agent.delete(`/api/flyers/${id}/like`)).body, { likes: 1, likedByMe: false })
  assert.equal((await fan.agent.get(`/api/flyers/${id}`)).body.flyer.likedByMe, false)
})

test('comments notify the author; only the writer or an admin can delete one', async () => {
  const author = await signedIn(app, { programmeId: P.BE_CSE })
  const other = await signedIn(app, { programmeId: P.MCA, name: 'Meera Nair' })
  const admin = await signedIn(app, { role: 'admin' })
  const { id } = (await post(author)).body.flyer

  assert.equal((await other.agent.post(`/api/flyers/${id}/comments`).send({ body: '   ' })).status, 400)
  const c = await other.agent.post(`/api/flyers/${id}/comments`).send({ body: 'Is it open to MCA students?' })
  assert.equal(c.status, 201)
  const reply = await author.agent.post(`/api/flyers/${id}/comments`).send({ body: 'Yes, all programmes!' })

  const detail = await other.agent.get(`/api/flyers/${id}`)
  assert.deepEqual(detail.body.comments.map((x) => x.body), ['Is it open to MCA students?', 'Yes, all programmes!'])
  assert.equal(detail.body.comments[0].userName, 'Meera Nair')
  assert.equal(detail.body.flyer.comments, 2)
  const [n] = await notes(author.id, 'flyer_comment')
  assert.match(n.message, /Meera Nair commented/)
  assert.equal(n.link, `/flyers/${id}`)
  assert.equal((await notes(author.id, 'flyer_comment')).length, 1, 'the author is not notified of their own comment')

  assert.equal((await other.agent.delete(`/api/flyers/${id}/comments/${reply.body.comment.id}`)).status, 403)
  assert.equal((await other.agent.delete(`/api/flyers/${id}/comments/${c.body.comment.id}`)).status, 200)
  assert.equal((await admin.agent.delete(`/api/flyers/${id}/comments/${reply.body.comment.id}`)).status, 200)
  assert.equal((await author.agent.get(`/api/flyers/${id}`)).body.comments.length, 0)
})

test('sharing with your union notifies its other members, once per union', async () => {
  const author = await signedIn(app, { role: 'faculty' })
  const leader = await signedIn(app, { programmeId: P.BE_CSE, name: 'Aarav Kumar' })
  const member = await signedIn(app, { programmeId: P.BE_MECH })
  const loner = await signedIn(app, { programmeId: P.MCA })
  const groupId = await union(leader, [member])
  const { id } = (await post(author, { title: 'Robotics Expo' })).body.flyer

  assert.equal((await loner.agent.post(`/api/flyers/${id}/share`)).body.error, 'no_union')
  assert.equal((await author.agent.post(`/api/flyers/${id}/share`)).body.error, 'no_union')

  const s = await leader.agent.post(`/api/flyers/${id}/share`)
  assert.equal(s.status, 201)
  assert.equal(s.body.union.id, groupId)
  assert.equal((await member.agent.post(`/api/flyers/${id}/share`)).body.error, 'already_shared')

  const [n] = await notes(member.id, 'flyer_shared')
  assert.match(n.message, /Aarav Kumar shared a flyer with .*Robotics Expo/)
  assert.equal((await notes(leader.id, 'flyer_shared')).length, 0)

  const shared = await member.agent.get('/api/flyers/shared')
  assert.equal(shared.body.union.id, groupId)
  assert.equal(shared.body.shares[0].title, 'Robotics Expo')
  assert.equal(shared.body.shares[0].sharedByName, 'Aarav Kumar')
  assert.equal(shared.body.shares[0].sharedWithMyUnion, true)
  assert.deepEqual((await loner.agent.get('/api/flyers/shared')).body, { union: null, shares: [] })
})

test('the author can delete a flyer; an admin can remove any, and the author is told', async () => {
  const author = await signedIn(app, { programmeId: P.BE_CSE })
  const other = await signedIn(app, { programmeId: P.MCA })
  const admin = await signedIn(app, { role: 'admin' })
  const mine = (await post(author)).body.flyer
  const theirs = (await post(author, { title: 'Spam flyer' })).body.flyer
  const [[row]] = await pool.query('SELECT image_name FROM flyer WHERE id = ?', [theirs.id])
  const file = path.join(uploadDir, row.image_name)
  assert.ok(existsSync(file))

  assert.equal((await other.agent.delete(`/api/flyers/${mine.id}`)).status, 403)
  assert.equal((await author.agent.delete(`/api/flyers/${mine.id}`)).status, 200)
  assert.equal((await admin.agent.delete(`/api/flyers/${theirs.id}`)).status, 200)
  assert.equal(existsSync(file), false, 'the photo is deleted too')
  assert.equal((await other.agent.get(`/api/flyers/${theirs.id}`)).status, 404)
  assert.match((await notes(author.id, 'flyer_removed'))[0].message, /removed your flyer "Spam flyer"/)

  const [log] = await pool.query(`SELECT action FROM activity_log WHERE target_type = 'flyer' AND target_id IN (?) ORDER BY id`, [[mine.id, theirs.id]])
  assert.deepEqual(log.map((l) => l.action), ['flyer_posted', 'flyer_posted', 'flyer_deleted', 'flyer_removed'])
})

test('signed-out visitors cannot see flyers', async () => {
  const res = await request(app).get('/api/flyers')
  assert.equal(res.status, 401)
})
