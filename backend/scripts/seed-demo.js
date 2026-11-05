// Fills the DEVELOPMENT database with demo students, groups, polls and points so the
// app has something to show. Re-running replaces the previous demo data.
// Usage: npm run seed:demo
//
// Demo sign-in (development only): 26dm001@psgtech.ac.in … 26dm012@psgtech.ac.in
// demo.faculty@psgtech.ac.in and demo.admin@psgtech.ac.in. Sign in with the code from DEMO_LOGIN_CODE in .env,
// or the emailed code (printed in the backend terminal in development).
import { randomBytes } from 'node:crypto'
import { readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../src/config.js'
import { pool, withTransaction } from '../src/db.js'
import { scoreFor } from '../src/lib/scoring.js'
import { uploadDir } from '../src/lib/uploads.js'

// A one-page PDF with a few lines of text, used as demo evidence
function demoPdf(lines) {
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 22 : 13} Tf 60 ${720 - i * 34} Td (${l.replace(/[()\\]/g, '')}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets = objects.map((o, i) => {
    const at = Buffer.byteLength(out)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out)
}

// Old demo evidence files are named demo-*.pdf; remove them before writing new ones
for (const f of await readdir(uploadDir)) if (f.startsWith('demo-')) await unlink(path.join(uploadDir, f))

if (config.isProd || config.db.database.endsWith('_test')) {
  console.error('seed:demo only runs against the development database.')
  process.exit(1)
}

// [name, programme id] — programme ids from db/seed-programmes.sql
const STUDENTS = [
  ['Aarav Kumar', 4], //  1 BE CSE
  ['Diya Raman', 13], //  2 BE Fashion Tech
  ['Kavin Prakash', 9], //  3 BE Mechanical
  ['Meera Nair', 42], //  4 MCA
  ['Rahul Menon', 38], //  5 MSc Data Science
  ['Sneha Iyer', 6], //  6 BE EEE
  ['Arjun Das', 7], //  7 BE ECE
  ['Nila Shankar', 22], //  8 ME CSE
  ['Vikram Rao', 1], //  9 BE Automobile
  ['Priya Lakshmi', 2], // 10 BE Biomedical
  ['Hari Krishnan', 4], // 11 BE CSE (same programme as Aarav)
  ['Divya Suresh', 30], // 12 ME VLSI
]

await withTransaction(async (conn) => {
  // Remove earlier demo data (groups are removed through their demo owners below)
  const [old] = await conn.query(`SELECT id FROM user_account WHERE email LIKE '26dm%@psgtech.ac.in' OR email IN ('demo.faculty@psgtech.ac.in', 'demo.admin@psgtech.ac.in')`)
  if (old.length) {
    const ids = old.map((u) => u.id)
    await conn.query('DELETE FROM collab_group WHERE creator_id IN (?)', [ids])
    await conn.query('DELETE FROM event WHERE created_by IN (?)', [ids])
    await conn.query('DELETE FROM user_account WHERE id IN (?)', [ids])
  }

  const ids = []
  for (const [i, [name, programmeId]] of STUDENTS.entries()) {
    const roll = `26dm${String(i + 1).padStart(3, '0')}`
    const [r] = await conn.query(
      `INSERT INTO user_account (email, roll_no, name, role, programme_id, year, about)
       VALUES (?, ?, ?, 'student', ?, ?, ?)`,
      [`${roll}@psgtech.ac.in`, roll.toUpperCase(), name, programmeId, 1 + (i % 4), 'Demo account for trying UNITE.'],
    )
    ids.push(r.insertId)
  }
  const [fac] = await conn.query(
    `INSERT INTO user_account (email, name, role) VALUES ('demo.faculty@psgtech.ac.in', 'Demo Faculty', 'faculty')`,
  )
  await conn.query(`INSERT INTO user_account (email, name, role) VALUES ('demo.admin@psgtech.ac.in', 'Demo Admin', 'admin')`)
  const S = (n) => ids[n - 1]

  // Open reports for the admin console (Hari is reported twice)
  await conn.query('INSERT INTO user_report (reporter_id, reported_id, reason) VALUES ?', [
    [
      [S(2), S(11), 'Keeps sending the same group invite message to everyone in my class.'],
      [S(3), S(11), 'Rude comments when I declined his friend request.'],
      [S(6), S(9), 'Profile link points to a site asking for our college login. Looks like phishing.'],
    ],
  ])

  const interests = { 1: ['ai', 'web'], 2: ['design', 'fashion'], 3: ['robotics', 'cad'], 4: ['web', 'ai'], 5: ['ai', 'data'], 7: ['iot', 'robotics'], 8: ['ai', 'research'] }
  for (const [n, list] of Object.entries(interests))
    await conn.query('INSERT INTO student_interest (user_id, interest) VALUES ?', [list.map((x) => [S(Number(n)), x])])

  async function group(name, description, ownerN, memberNs) {
    const [g] = await conn.query('INSERT INTO collab_group (name, description, creator_id) VALUES (?, ?, ?)', [name, description, S(ownerN)])
    await conn.query('INSERT INTO group_member (group_id, user_id, role) VALUES ?', [
      [[g.insertId, S(ownerN), 'owner'], ...memberNs.map((n) => [g.insertId, S(n), 'member'])],
    ])
    return g.insertId
  }
  // Every demo group has ≤ 6 members, each from a different programme
  const nova = await group('Team Nova', 'Hackathon team mixing code, design and data. Looking for an automobile engineer.', 1, [2, 3, 4, 5])
  const circuit = await group('Circuit Breakers', 'Hardware + software builds: IoT, embedded and smart-campus ideas.', 7, [6, 8])
  const bio = await group('Bio Bytes', 'Healthcare tech — medical devices meet machine learning.', 10, [12])

  // A pending request for Aarav (owner of Team Nova) to review
  await conn.query('INSERT INTO group_join_request (group_id, user_id, message) VALUES (?, ?, ?)', [
    nova,
    S(9),
    'I can handle the pitch deck and business plan for the next hackathon.',
  ])

  // A poll in Team Nova with some votes
  const [p] = await conn.query('INSERT INTO poll (group_id, created_by, question, closes_at) VALUES (?, ?, ?, NOW() + INTERVAL 3 DAY)', [
    nova,
    S(1),
    'When should we meet to plan the hackathon?',
  ])
  const opts = []
  for (const label of ['Saturday 10 AM · Library', 'Sunday 4 PM · Canteen', 'Online call on Friday'])
    opts.push((await conn.query('INSERT INTO poll_option (poll_id, label) VALUES (?, ?)', [p.insertId, label]))[0].insertId)
  await conn.query('INSERT INTO poll_vote (poll_id, user_id, option_id) VALUES ?', [
    [[p.insertId, S(2), opts[0]], [p.insertId, S(3), opts[0]], [p.insertId, S(5), opts[1]]],
  ])

  // Verified results so the leaderboard has points
  async function win(groupIds, title, host, category, result, submitterN) {
    const [e] = await conn.query('INSERT INTO event (title, host_institution, host_category, event_date, created_by) VALUES (?, ?, ?, CURDATE() - INTERVAL 20 DAY, ?)', [
      title,
      host,
      category,
      S(submitterN),
    ])
    const [t] = await conn.query('INSERT INTO event_team (event_id, label, created_by) VALUES (?, ?, ?)', [e.insertId, title, S(submitterN)])
    await conn.query('INSERT INTO team_group (team_id, group_id) VALUES ?', [groupIds.map((g) => [t.insertId, g])])
    const sc = scoreFor(result, category)
    const [a] = await conn.query(
      `INSERT INTO achievement (team_id, submitter_id, result, status, reviewer_id, base_points, multiplier, points, reviewed_at)
       VALUES (?, ?, ?, 'approved', ?, ?, ?, ?, NOW())`,
      [t.insertId, S(submitterN), result, fac.insertId, sc.base, sc.multiplier, sc.points],
    )
    await conn.query('INSERT INTO points_award (achievement_id, group_id, points) VALUES ?', [groupIds.map((g) => [a.insertId, g, sc.points])])
  }
  await win([nova], 'Smart India Hackathon (demo)', 'IIT Madras', 'national', '1', 1)
  await win([circuit], 'Inter-college IoT Challenge (demo)', 'Another College', 'state', '2', 7)
  await win([bio], 'PSG Tech Paper Presentation (demo)', 'PSG College of Technology', 'college', '3', 10)

  // Pending claims for demo.faculty to review, each with a certificate PDF
  async function pendingClaim(groupIds, title, host, category, result, submitterN, certificate) {
    const [e] = await conn.query('INSERT INTO event (title, host_institution, host_category, event_date, created_by) VALUES (?, ?, ?, CURDATE() - INTERVAL 5 DAY, ?)', [
      title,
      host,
      category,
      S(submitterN),
    ])
    const [t] = await conn.query('INSERT INTO event_team (event_id, label, created_by) VALUES (?, ?, ?)', [e.insertId, `${title} team`, S(submitterN)])
    await conn.query('INSERT INTO team_group (team_id, group_id) VALUES ?', [groupIds.map((g) => [t.insertId, g])])
    const [a] = await conn.query('INSERT INTO achievement (team_id, submitter_id, result, description) VALUES (?, ?, ?, ?)', [
      t.insertId,
      S(submitterN),
      result,
      'Demo claim — certificate attached.',
    ])
    const pdf = demoPdf(certificate)
    const stored = `demo-${randomBytes(8).toString('hex')}.pdf`
    await writeFile(path.join(uploadDir, stored), pdf)
    await conn.query('INSERT INTO evidence (achievement_id, stored_name, original_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)', [
      a.insertId,
      stored,
      'certificate.pdf',
      'application/pdf',
      pdf.length,
    ])
  }
  // Two groups entered one event team together (event needed more than 6 people)
  await pendingClaim([nova, bio], 'Smart City Hackathon (demo)', 'Anna University', 'state', '2', 1, [
    'Certificate of Achievement (DEMO)',
    'Smart City Hackathon - Anna University',
    'Awarded 2nd place to Team Nova + Bio Bytes',
    'This is sample data for trying UNITE.',
  ])
  await pendingClaim([circuit], 'PSG Code Sprint (demo)', 'PSG College of Technology', 'college', 'participation', 7, [
    'Certificate of Participation (DEMO)',
    'PSG Code Sprint - PSG College of Technology',
    'Presented to Circuit Breakers',
    'This is sample data for trying UNITE.',
  ])
})

console.log('Demo data ready. Sign in as 26dm001@psgtech.ac.in (owner of Team Nova) with the DEMO_LOGIN_CODE from .env.')
await pool.end()
