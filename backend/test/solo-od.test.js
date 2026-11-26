import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { pool } from '../src/db.js'
import { P, PDF, PNG, signedIn, startApp, stopApp } from './helpers.js'

let app
before(async () => {
  app = await startApp()
})
after(() => stopApp(app))


async function newEvent(a, hostCategory = 'state') {
  const r = await a.post('/api/events').send({ title: `Solo Contest ${Math.random()}`, hostInstitution: 'Anna University', hostCategory })
  return r.body.event.id
}

const soloClaim = (a, eventId, result = '1') =>
  a.post('/api/solo-claims').field('eventId', eventId).field('result', result).attach('evidence', PDF, { filename: 'cert.pdf', contentType: 'application/pdf' })

test('solo claim: pending → faculty approves → student ranks on the solo leaderboard, unions get nothing', async () => {
  const student = await signedIn(app, { programmeId: P.BE_CSE, name: 'Solo Star' })
  const other = await signedIn(app, { programmeId: P.MCA })
  const faculty = await signedIn(app, { role: 'faculty' })
  const group = (await student.agent.post('/api/groups').send({ name: 'Solo Star Union' })).body.group.id
  const eventId = await newEvent(student.agent)

  assert.equal((await student.agent.post('/api/solo-claims').field('eventId', eventId).field('result', '1')).status, 400)
  assert.equal((await faculty.agent.post('/api/solo-claims').field('eventId', eventId).field('result', '1')).status, 403)

  const claim = await soloClaim(student.agent, eventId)
  assert.equal(claim.status, 201, JSON.stringify(claim.body))
  assert.equal(claim.body.claim.status, 'pending')
  assert.equal(claim.body.claim.evidence.length, 1)
  const claimId = claim.body.claim.id

  // One live claim per student per event
  assert.equal((await soloClaim(student.agent, eventId, '2')).status, 409)

  // Evidence: the student and reviewers only
  const fileUrl = claim.body.claim.evidence[0].url
  assert.equal((await student.agent.get(fileUrl)).status, 200)
  assert.equal((await faculty.agent.get(fileUrl)).status, 200)
  assert.equal((await other.agent.get(fileUrl)).status, 404)

  // Reviewers find it by reference; students cannot review
  const byRef = await faculty.agent.get(`/api/review/solo-claims?q=SOL-${String(claimId).padStart(4, '0')}`)
  assert.deepEqual(byRef.body.claims.map((c) => c.id), [claimId])
  assert.equal((await student.agent.post(`/api/review/solo-claims/${claimId}`).send({ decision: 'approve' })).status, 403)

  const ok = await faculty.agent.post(`/api/review/solo-claims/${claimId}`).send({ decision: 'approve' })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.claim.status, 'approved')
  assert.equal(ok.body.claim.points, 150) // 1st place × state 1.5
  assert.equal((await faculty.agent.post(`/api/review/solo-claims/${claimId}`).send({ decision: 'approve' })).status, 409)

  const board = (await other.agent.get('/api/solo-leaderboard')).body.leaderboard
  const me = board.find((r) => r.id === student.id)
  assert.equal(me.points, 150)
  assert.equal(me.wins, 1)

  // Solo points never reach the union leaderboard
  const unions = (await student.agent.get('/api/leaderboard')).body.leaderboard
  assert.equal(unions.find((g) => g.id === group).points, 0)

  const notes = await pool.query(`SELECT message FROM notification WHERE user_id = ? AND type = 'achievement_approved'`, [student.id])
  assert.match(notes[0][0].message, /\+150 solo points/)
})

test('solo claim: rejecting needs a reason, then the student can claim the event again', async () => {
  const student = await signedIn(app, { programmeId: P.BE_IT })
  const faculty = await signedIn(app, { role: 'faculty' })
  const eventId = await newEvent(student.agent, 'college')
  const claimId = (await soloClaim(student.agent, eventId, 'participation')).body.claim.id

  assert.equal((await faculty.agent.post(`/api/review/solo-claims/${claimId}`).send({ decision: 'reject' })).status, 400)
  const no = await faculty.agent.post(`/api/review/solo-claims/${claimId}`).send({ decision: 'reject', note: 'Certificate is for someone else.' })
  assert.equal(no.body.claim.status, 'rejected')
  assert.equal((await student.agent.get('/api/solo-leaderboard')).body.leaderboard.some((r) => r.id === student.id), false)
  assert.equal((await soloClaim(student.agent, eventId, 'participation')).status, 201)
  const mine = (await student.agent.get('/api/solo-claims/mine')).body.claims
  assert.deepEqual(mine.map((c) => c.status), ['pending', 'rejected'])
})

function sendOd(a, faculty, { purpose = 'Hackathon at IIT Madras', fromDate = '2026-12-01', toDate = '2026-12-02', letter = PDF } = {}) {
  const req = a.post('/api/od').field('purpose', purpose).field('fromDate', fromDate).field('toDate', toDate).field('faculty', faculty)
  return letter ? req.attach('letter', letter, { filename: 'od-letter.pdf', contentType: 'application/pdf' }) : req
}

test('OD request: sent by email to several faculty, approved only when all of them accept', async () => {
  const student = await signedIn(app, { programmeId: P.BE_ECE, name: 'OD Student' })
  const hod = await signedIn(app, { role: 'faculty', name: 'HOD ECE' })
  const tutor = await signedIn(app, { role: 'faculty', name: 'Tutor ECE' })
  const outsider = await signedIn(app, { role: 'faculty' })
  const classmate = await signedIn(app, { programmeId: P.BE_EEE })

  // Checks: letter required, faculty emails must be faculty accounts, sane dates
  assert.equal((await sendOd(student.agent, hod.email, { letter: null })).body.error, 'letter_required')
  const notFaculty = await sendOd(student.agent, `${hod.email}, ${classmate.email}`)
  assert.equal(notFaculty.body.error, 'not_faculty')
  assert.match(notFaculty.body.message, new RegExp(classmate.email))
  assert.equal((await sendOd(student.agent, 'not-an-email')).body.error, 'bad_email')
  assert.equal((await sendOd(student.agent, hod.email, { fromDate: '2026-12-05', toDate: '2026-12-01' })).body.error, 'bad_dates')
  assert.equal((await sendOd(student.agent, hod.email, { fromDate: '2026-12-01', toDate: '2027-01-15' })).body.error, 'bad_dates')
  assert.equal((await sendOd(hod.agent, tutor.email)).status, 403)

  const sent = await sendOd(student.agent, `${hod.email.toUpperCase()}\n${tutor.email}, ${hod.email}`)
  assert.equal(sent.status, 201, JSON.stringify(sent.body))
  const od = sent.body.od
  assert.equal(od.status, 'pending')
  assert.equal(od.fromDate, '2026-12-01')
  assert.deepEqual(od.approvers.map((a) => a.decision), ['pending', 'pending'])

  // Only the chosen faculty see it and its letter
  assert.equal((await hod.agent.get('/api/od/inbox')).body.requests.some((r) => r.id === od.id), true)
  assert.equal((await outsider.agent.get('/api/od/inbox')).body.requests.some((r) => r.id === od.id), false)
  assert.equal((await student.agent.get(od.letter.url)).status, 200)
  assert.equal((await tutor.agent.get(od.letter.url)).status, 200)
  assert.equal((await outsider.agent.get(od.letter.url)).status, 404)
  assert.equal((await classmate.agent.get(od.letter.url)).status, 404)
  assert.equal((await outsider.agent.post(`/api/od/${od.id}/decision`).send({ decision: 'approve' })).status, 404)

  const first = await hod.agent.post(`/api/od/${od.id}/decision`).send({ decision: 'approve' })
  assert.equal(first.status, 200)
  assert.equal(first.body.od.status, 'pending') // the tutor has not decided yet
  assert.equal((await hod.agent.post(`/api/od/${od.id}/decision`).send({ decision: 'reject', note: 'Changed my mind' })).body.error, 'already_decided')
  assert.equal((await hod.agent.get('/api/od/inbox')).body.requests.some((r) => r.id === od.id), false)
  assert.equal((await hod.agent.get('/api/od/inbox?view=done')).body.requests.some((r) => r.id === od.id), true)

  const second = await tutor.agent.post(`/api/od/${od.id}/decision`).send({ decision: 'approve', note: 'All the best' })
  assert.equal(second.body.od.status, 'approved')
  assert.equal((await student.agent.post(`/api/od/${od.id}/withdraw`)).body.error, 'not_pending')

  const mine = (await student.agent.get('/api/od/mine')).body.requests
  assert.equal(mine[0].status, 'approved')
  const [notes] = await pool.query(`SELECT type FROM notification WHERE user_id = ? ORDER BY id`, [student.id])
  assert.deepEqual(notes.map((n) => n.type), ['od_progress', 'od_approved'])
})

test('OD request: one rejection rejects it; a pending request can be withdrawn', async () => {
  const student = await signedIn(app, { programmeId: P.BE_MECH })
  const hod = await signedIn(app, { role: 'faculty' })
  const tutor = await signedIn(app, { role: 'faculty' })

  const od = (await sendOd(student.agent, `${hod.email} ${tutor.email}`)).body.od
  assert.equal((await tutor.agent.post(`/api/od/${od.id}/decision`).send({ decision: 'reject' })).body.error, 'note_required')
  const no = await tutor.agent.post(`/api/od/${od.id}/decision`).send({ decision: 'reject', note: 'Internal exam that week.' })
  assert.equal(no.body.od.status, 'rejected')
  assert.equal((await hod.agent.post(`/api/od/${od.id}/decision`).send({ decision: 'approve' })).body.error, 'not_pending')

  const png = await sendOd(student.agent, hod.email, { purpose: 'State robotics meet', letter: null })
    .attach('letter', PNG, { filename: 'letter.png', contentType: 'image/png' })
  assert.equal(png.status, 201)
  const withdrawn = await student.agent.post(`/api/od/${png.body.od.id}/withdraw`)
  assert.equal(withdrawn.body.od.status, 'withdrawn')
  assert.equal((await hod.agent.get('/api/od/inbox')).body.requests.length, 0)
})
