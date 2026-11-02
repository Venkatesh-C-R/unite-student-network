import { Router } from 'express'
import { z } from 'zod'
import { all, one, pool, withTransaction } from '../db.js'
import { conflict, forbidden, notFound } from '../lib/errors.js'
import { id, text } from '../lib/validate.js'
import { requireRole } from '../middleware/auth.js'
import { membership } from '../services/groups.js'

export const eventsRouter = Router()

const category = z.enum(['college', 'state', 'national'])

async function teamsOf(eventId) {
  const teams = await all(
    'SELECT id, label, created_at AS createdAt FROM event_team WHERE event_id = ? ORDER BY id',
    [eventId],
  )
  if (!teams.length) return []
  const groups = await all(
    `SELECT tg.team_id AS teamId, g.id, g.name,
            (SELECT COUNT(*) FROM group_member gm WHERE gm.group_id = g.id) AS memberCount
       FROM team_group tg JOIN collab_group g ON g.id = tg.group_id
      WHERE tg.team_id IN (?) ORDER BY g.name`,
    [teams.map((t) => t.id)],
  )
  return teams.map((t) => {
    const gs = groups.filter((g) => g.teamId === t.id).map(({ teamId, ...g }) => g)
    return { ...t, groups: gs, totalMembers: gs.reduce((s, g) => s + g.memberCount, 0) }
  })
}

eventsRouter.get('/', requireRole('student', 'faculty', 'admin'), async (req, res) => {
  const { q } = z.object({ q: text(80).optional() }).parse(req.query)
  const rows = await all(
    `SELECT e.id, e.title, e.host_institution AS hostInstitution, e.host_category AS hostCategory,
            e.event_date AS eventDate, (SELECT COUNT(*) FROM event_team t WHERE t.event_id = e.id) AS teamCount
       FROM event e ${q ? 'WHERE e.title LIKE ? OR e.host_institution LIKE ?' : ''}
      ORDER BY COALESCE(e.event_date, DATE(e.created_at)) DESC, e.id DESC LIMIT 50`,
    q ? [`%${q}%`, `%${q}%`] : [],
  )
  res.json({ events: rows })
})

// Students record an event they take part in. The host institution sets the category;
// a reviewer can correct it when verifying an achievement.
eventsRouter.post('/', requireRole('student', 'faculty', 'admin'), async (req, res) => {
  const body = z
    .object({
      title: text(150, 3),
      hostInstitution: text(150, 2),
      hostCategory: category,
      eventDate: z.iso.date().optional(),
    })
    .parse(req.body)
  const [r] = await pool.query(
    'INSERT INTO event (title, host_institution, host_category, event_date, created_by) VALUES (?, ?, ?, ?, ?)',
    [body.title, body.hostInstitution, body.hostCategory, body.eventDate ?? null, req.user.id],
  )
  res.status(201).json({ event: { id: r.insertId, ...body } })
})

eventsRouter.get('/:id', requireRole('student', 'faculty', 'admin'), async (req, res) => {
  const { id: eventId } = z.object({ id }).parse(req.params)
  const event = await one(
    `SELECT id, title, host_institution AS hostInstitution, host_category AS hostCategory, event_date AS eventDate
       FROM event WHERE id = ?`,
    [eventId],
  )
  if (!event) throw notFound('Event not found.')
  res.json({ event, teams: await teamsOf(eventId) })
})

// Create an event team starting with one of my groups
eventsRouter.post('/:id/teams', requireRole('student'), async (req, res) => {
  const { id: eventId } = z.object({ id }).parse(req.params)
  const body = z.object({ label: text(80, 2), groupId: id }).parse(req.body)
  if (!(await one('SELECT id FROM event WHERE id = ?', [eventId]))) throw notFound('Event not found.')
  if (!(await membership(body.groupId, req.user.id))) throw forbidden('You can only enter groups you belong to.')

  const teamId = await withTransaction(async (conn) => {
    const already = await one(
      `SELECT t.id FROM team_group tg JOIN event_team t ON t.id = tg.team_id WHERE t.event_id = ? AND tg.group_id = ?`,
      [eventId, body.groupId],
      conn,
    )
    if (already) throw conflict('This group is already in a team for this event.', 'group_in_team')
    const [r] = await conn.query('INSERT INTO event_team (event_id, label, created_by) VALUES (?, ?, ?)', [eventId, body.label, req.user.id])
    await conn.query('INSERT INTO team_group (team_id, group_id) VALUES (?, ?)', [r.insertId, body.groupId])
    return r.insertId
  })
  res.status(201).json({ team: (await teamsOf(eventId)).find((t) => t.id === teamId) })
})

// Another group's owner joins an existing event team (for events needing more than 6 people).
// The groups stay separate; each keeps its own six-member, one-per-programme limit.
eventsRouter.post('/:id/teams/:teamId/groups', requireRole('student'), async (req, res) => {
  const p = z.object({ id, teamId: id }).parse(req.params)
  const { groupId } = z.object({ groupId: id }).parse(req.body)
  const team = await one('SELECT id FROM event_team WHERE id = ? AND event_id = ?', [p.teamId, p.id])
  if (!team) throw notFound('Team not found.')
  if ((await membership(groupId, req.user.id))?.role !== 'owner') throw forbidden('Only the group owner can enter the group into a team.')

  await withTransaction(async (conn) => {
    const already = await one(
      `SELECT t.id FROM team_group tg JOIN event_team t ON t.id = tg.team_id WHERE t.event_id = ? AND tg.group_id = ?`,
      [p.id, groupId],
      conn,
    )
    if (already) throw conflict('This group is already in a team for this event.', 'group_in_team')
    await conn.query('INSERT INTO team_group (team_id, group_id) VALUES (?, ?)', [p.teamId, groupId])
  })
  res.status(201).json({ team: (await teamsOf(p.id)).find((t) => t.id === p.teamId) })
})
