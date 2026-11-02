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

// The core UNITE rule: at most six members, and no two from the same programme.
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
  if (members.n >= MAX_GROUP_SIZE) throw conflict(`This group already has ${MAX_GROUP_SIZE} members.`, 'group_full')
  if (Number(members.sameProgramme)) {
    throw conflict('This group already has a member from that programme. One student per programme.', 'programme_taken')
  }
}

export async function addMember(conn, groupId, userId, role = 'member') {
  await lockGroup(conn, groupId)
  await assertCanJoin(conn, groupId, userId)
  await conn.query('INSERT INTO group_member (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, userId, role])
}

export async function membership(groupId, userId, conn) {
  return one('SELECT role FROM group_member WHERE group_id = ? AND user_id = ?', [groupId, userId], conn)
}
