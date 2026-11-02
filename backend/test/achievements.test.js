import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { scoreFor } from '../src/lib/scoring.js'
import { P, PDF, signedIn, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))

test('scoring table and host multipliers', () => {
  assert.deepEqual(scoreFor('1', 'college'), { base: 100, multiplier: 1, points: 100 })
  assert.equal(scoreFor('4', 'state').points, 67.5)
  assert.equal(scoreFor('10', 'national').points, 30)
  assert.equal(scoreFor('participation', 'state').points, 15)
})

test('polls: one vote per member, options must belong to the poll', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_CSE })
  const outsider = await signedIn(app, { programmeId: P.BE_IT })
  const g = (await owner.agent.post('/api/groups').send({ name: 'Pollsters' })).body.group.id

  const poll = await owner.agent.post(`/api/groups/${g}/polls`).send({ question: 'Meetup day?', options: ['Saturday', 'Sunday'] })
  assert.equal(poll.status, 201)
  const other = await owner.agent.post(`/api/groups/${g}/polls`).send({ question: 'Venue?', options: ['Library', 'Canteen'] })
  const [sat] = poll.body.poll.options
  const [library] = other.body.poll.options

  assert.equal((await outsider.agent.post(`/api/polls/${poll.body.poll.id}/vote`).send({ optionId: sat.id })).status, 403)
  const bad = await owner.agent.post(`/api/polls/${poll.body.poll.id}/vote`).send({ optionId: library.id })
  assert.equal(bad.status, 400)
  const ok = await owner.agent.post(`/api/polls/${poll.body.poll.id}/vote`).send({ optionId: sat.id })
  assert.equal(ok.status, 201)
  assert.equal(ok.body.poll.options[0].votes, 1)
  assert.equal((await owner.agent.post(`/api/polls/${poll.body.poll.id}/vote`).send({ optionId: sat.id })).status, 409)
})

test('evidence-backed claim: pending → faculty approves → full points to every group in the team', async () => {
  const ownerA = await signedIn(app, { programmeId: P.BE_CSE })
  const ownerB = await signedIn(app, { programmeId: P.MCA })
  const faculty = await signedIn(app, { role: 'faculty', name: 'Faculty Reviewer' })

  const gA = (await ownerA.agent.post('/api/groups').send({ name: 'Group A' })).body.group.id
  const gB = (await ownerB.agent.post('/api/groups').send({ name: 'Group B' })).body.group.id

  const event = await ownerA.agent
    .post('/api/events')
    .send({ title: 'National Hackathon', hostInstitution: 'IIT Madras', hostCategory: 'national', eventDate: '2026-10-10' })
  assert.equal(event.status, 201)
  const eventId = event.body.event.id

  // Two independent groups form one event team; neither group changes
  const team = await ownerA.agent.post(`/api/events/${eventId}/teams`).send({ label: 'A+B', groupId: gA })
  assert.equal(team.status, 201)
  const teamId = team.body.team.id
  const joined = await ownerB.agent.post(`/api/events/${eventId}/teams/${teamId}/groups`).send({ groupId: gB })
  assert.equal(joined.status, 201)
  assert.equal(joined.body.team.groups.length, 2)

  // Evidence is required, and must really be a PDF/PNG/JPG
  const noFile = await ownerA.agent.post('/api/achievements').field('teamId', teamId).field('result', '1')
  assert.equal(noFile.status, 400)
  const fake = await ownerA.agent
    .post('/api/achievements')
    .field('teamId', teamId)
    .field('result', '1')
    .attach('evidence', Buffer.from('not a pdf'), { filename: 'cert.pdf', contentType: 'application/pdf' })
  assert.equal(fake.status, 400)
  assert.equal(fake.body.error, 'bad_file_content')

  const claim = await ownerA.agent
    .post('/api/achievements')
    .field('teamId', teamId)
    .field('result', '1')
    .attach('evidence', PDF, { filename: 'certificate.pdf', contentType: 'application/pdf' })
  assert.equal(claim.status, 201, JSON.stringify(claim.body))
  assert.equal(claim.body.achievement.status, 'pending')
  const achId = claim.body.achievement.id

  // Pending claims give no points yet
  let board = (await ownerA.agent.get('/api/leaderboard')).body.leaderboard
  assert.equal(board.find((r) => r.id === gA).points, 0)

  // Group members can view the evidence; students cannot review
  const fileUrl = claim.body.achievement.evidence[0].url
  assert.equal((await ownerB.agent.get(fileUrl)).status, 200)
  assert.equal((await ownerA.agent.post(`/api/review/achievements/${achId}`).send({ decision: 'approve' })).status, 403)

  // Rejecting needs a reason; approving awards the points
  assert.equal((await faculty.agent.post(`/api/review/achievements/${achId}`).send({ decision: 'reject' })).status, 400)
  const approved = await faculty.agent.post(`/api/review/achievements/${achId}`).send({ decision: 'approve' })
  assert.equal(approved.status, 200)
  assert.equal(approved.body.achievement.points, 200)

  board = (await ownerA.agent.get('/api/leaderboard')).body.leaderboard
  assert.equal(board.find((r) => r.id === gA).points, 200)
  assert.equal(board.find((r) => r.id === gB).points, 200)
  assert.equal(board[0].rank, 1)

  // A claim can only be reviewed once
  assert.equal((await faculty.agent.post(`/api/review/achievements/${achId}`).send({ decision: 'approve' })).status, 409)

  // Members were notified
  const notes = (await ownerB.agent.get('/api/notifications')).body.notifications
  assert.ok(notes.some((n) => n.type === 'achievement_approved'))
})

test('reviewer can correct the host category before approving', async () => {
  const owner = await signedIn(app, { programmeId: P.BE_ECE })
  const faculty = await signedIn(app, { role: 'faculty' })
  const g = (await owner.agent.post('/api/groups').send({ name: 'Correctors' })).body.group.id
  const ev = (await owner.agent.post('/api/events').send({ title: 'Paper Fest', hostInstitution: 'Another College', hostCategory: 'national' })).body.event
  const team = (await owner.agent.post(`/api/events/${ev.id}/teams`).send({ label: 'Solo', groupId: g })).body.team
  const claim = await owner.agent
    .post('/api/achievements')
    .field('teamId', team.id)
    .field('result', '4')
    .attach('evidence', PDF, { filename: 'c.pdf', contentType: 'application/pdf' })
  const res = await faculty.agent.post(`/api/review/achievements/${claim.body.achievement.id}`).send({ decision: 'approve', hostCategory: 'state' })
  assert.equal(res.body.achievement.points, 67.5)
  assert.equal(res.body.achievement.hostCategory, 'state')
})
