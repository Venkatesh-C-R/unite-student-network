import { one } from '../db.js'
import { conflict, notFound } from '../lib/errors.js'

export const MAX_GROUP_SIZE = 6

// Locks the group row so every membership change on this group runs one at a time.
// Call inside a transaction before reading or changing group_member.
export async function lockGroup(conn, groupId) {
  const group = await one('SELECT id, name FROM collab_group WHERE id = ? FOR UPDATE', [groupId], conn)
  if (!group) throw notFound('Group not found.')
  return group
}

// The core UNITE rules: one union per student, at most six members, and no two from the same programme.
// Reads programmes from user_account (never a copied value), under the group lock.
export async function assertCanJoin(conn, groupId, userId) {
  const user = await one('SELECT id, programme_id, role, is_active FROM user_account WHERE id = ?', [userId], conn)
  if (!user || !user.is_active || user.role !== 'student' || !user.programme_id) {
    throw conflict('Only active students with a programme can join groups.', 'not_eligible')
  }
  const members = await one(
    `SELECT COUNT(*) AS n,
            SUM(gm.user_id = ?) AS isMember,
            SUM(u.programme_id = ?) AS sameProgramme
       FROM group_member gm JOIN user_account u ON u.id = gm.user_id
      WHERE gm.group_id = ?`,
    [userId, user.programme_id, groupId],
    conn,
  )
  if (Number(members.isMember)) throw conflict('Already a member of this group.', 'already_member')
  const elsewhere = await one('SELECT group_id FROM group_member WHERE user_id = ?', [userId], conn)
  if (elsewhere) throw conflict('A student can be in only one union. Leave your current union first.', 'already_in_union')
  if (members.n >= MAX_GROUP_SIZE) throw conflict(`This group already has ${MAX_GROUP_SIZE} members.`, 'group_full')
  if (Number(members.sameProgramme)) {
    throw conflict('This group already has a member from that programme. One student per programme.', 'programme_taken')
  }
}

export async function addMember(conn, groupId, userId, role = 'member') {
  await lockGroup(conn, groupId)
  await assertCanJoin(conn, groupId, userId)
  await insertMember(conn, groupId, userId, role)
}

// The unique key on user_id catches two unions approving the same student at once
export async function insertMember(conn, groupId, userId, role = 'member') {
  try {
    await conn.query('INSERT INTO group_member (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, userId, role])
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw conflict('A student can be in only one union.', 'already_in_union')
    throw e
  }
  // Other pending requests and invites no longer make sense once the student is in a union
  await conn.query(
    `UPDATE group_join_request SET status = 'cancelled', decided_at = NOW() WHERE user_id = ? AND status = 'pending' AND group_id <> ?`,
    [userId, groupId],
  )
  await conn.query(
    `UPDATE group_invite SET status = 'cancelled', decided_at = NOW() WHERE invitee_id = ? AND status = 'pending' AND group_id <> ?`,
    [userId, groupId],
  )
}

export async function membership(groupId, userId, conn) {
  return one('SELECT role FROM group_member WHERE group_id = ? AND user_id = ?', [groupId, userId], conn)
}
