// Creates all tables and loads the programme list. Safe to run more than once.
// Usage: npm run db:setup            (uses .env)
//        npm run db:setup -- --reset (drops every UNITE table first — deletes data!)
import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'
import { config } from '../src/config.js'

const TABLES = [
  'activity_log', 'notification', 'points_award', 'evidence', 'achievement', 'team_group', 'event_team', 'event',
  'poll_vote', 'poll_option', 'poll', 'group_invite', 'group_join_request', 'group_member', 'collab_group',
  'user_report', 'user_block', 'friend_request', 'profile_link', 'student_interest', 'email_otp',
  'sessions', 'user_account', 'programme',
]

export async function setupDatabase({ reset = false } = {}) {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true })
  try {
    if (reset) {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0')
      for (const t of TABLES) await conn.query(`DROP TABLE IF EXISTS \`${t}\``)
      await conn.query('SET FOREIGN_KEY_CHECKS = 1')
    }
    const dir = new URL('../db/', import.meta.url)
    await conn.query(await readFile(new URL('schema.sql', dir), 'utf8'))
    await conn.query(await readFile(new URL('seed-programmes.sql', dir), 'utf8'))
    // Upgrade databases created before the second-in-command role existed
    await conn.query(`ALTER TABLE group_member MODIFY role ENUM('owner','deputy','member') NOT NULL DEFAULT 'member'`)
    // One union per student. Fails if a student is still in two unions; remove them from one first.
    const [idx] = await conn.query(`SHOW INDEX FROM group_member WHERE Key_name = 'uq_one_union'`)
    if (!idx.length) await conn.query('ALTER TABLE group_member ADD UNIQUE KEY uq_one_union (user_id)')
    // Admins can withdraw claims
    await conn.query(`ALTER TABLE achievement MODIFY status ENUM('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending'`)
    // Sign-in is by emailed code only: drop passwords and the old reset codes
    const [pw] = await conn.query(`SHOW COLUMNS FROM user_account LIKE 'password_hash'`)
    if (pw.length) await conn.query('ALTER TABLE user_account DROP COLUMN password_hash')
    await conn.query(`ALTER TABLE email_otp MODIFY purpose ENUM('signup','reset','login') NOT NULL`)
    await conn.query(`DELETE FROM email_otp WHERE purpose = 'reset'`)
    await conn.query(`ALTER TABLE email_otp MODIFY purpose ENUM('signup','login') NOT NULL`)
  } finally {
    await conn.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes('--reset')
  await setupDatabase({ reset })
  console.log(`Database "${config.db.database}" is ready${reset ? ' (reset)' : ''}.`)
}
