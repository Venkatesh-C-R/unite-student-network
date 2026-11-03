import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { P, signedIn, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))

test('profile: About, Interests and any valid http(s) link', async () => {
  const me = await signedIn(app, { programmeId: P.MCA })
  const bad = await me.agent.put('/api/me/profile').send({ about: 'Hi', interests: [], links: [{ label: 'X', url: 'javascript:alert(1)' }] })
  assert.equal(bad.status, 400)

  const ok = await me.agent.put('/api/me/profile').send({
    about: 'MCA student who likes building things.',
    interests: ['AI', 'web', 'ai'],
    links: [
      { label: 'GitHub', url: 'https://github.com/example' },
      { label: 'My blog', url: 'https://example.com/blog' },
    ],
  })
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body.profile.interests, ['ai', 'web'])
  assert.equal(ok.body.profile.links[1].label, 'My blog')
})

test('discover: search shows friendship state; suggestions and popular interests', async () => {
  const a = await signedIn(app, { programmeId: P.BE_CSE, name: 'Asha Search' })
  const b = await signedIn(app, { programmeId: P.BE_MECH, name: 'Bharath Search' })
  const c = await signedIn(app, { programmeId: P.MSC_DS, name: 'Chitra Search' })
  await a.agent.put('/api/me/profile').send({ interests: ['robotics', 'ai'] })
  await b.agent.put('/api/me/profile').send({ interests: ['robotics'] })
  await c.agent.put('/api/me/profile').send({ interests: ['ai', 'robotics'] })

  await a.agent.post('/api/friends/requests').send({ userId: b.id })
  const found = (await a.agent.get('/api/students').query({ q: 'Search' })).body.students
  assert.equal(found.find((s) => s.id === b.id).friendship, 'request_sent')
  assert.equal(found.find((s) => s.id === c.id).friendship, 'none')

  const fromB = (await b.agent.get('/api/students').query({ q: 'Asha' })).body.students[0]
  assert.equal(fromB.friendship, 'request_received')
  assert.ok(fromB.friendRequestId)

  // Suggestions skip people I already asked; Chitra shares two interests so ranks first
  const sug = (await a.agent.get('/api/students/suggested')).body.students
  assert.equal(sug[0].id, c.id)
  assert.deepEqual(sug[0].sharedInterests, ['ai', 'robotics'])
  assert.ok(!sug.some((s) => s.id === b.id))

  const popular = (await a.agent.get('/api/interests/popular')).body.interests
  assert.equal(popular.find((i) => i.interest === 'robotics').students, 3)
  assert.ok(popular[0].students >= popular.at(-1).students, 'sorted by popularity')

  // LIKE wildcards in the search box are treated as plain text
  assert.equal((await a.agent.get('/api/students').query({ q: '%' })).body.students.length, 0)
})

test('a student can update their year of study', async () => {
  const s = await signedIn(app, { programmeId: P.MCA })
  const r = await s.agent.put('/api/me/profile').send({ year: 2 })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.equal(r.body.profile.year, 2)
  assert.equal((await s.agent.put('/api/me/profile').send({ year: 9 })).status, 400)
})
