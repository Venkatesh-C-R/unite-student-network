// Create a faculty or admin account (they do not use student sign-up).
// Usage: npm run staff -- --email umarani@psgtech.ac.in --name "Dr. V. Umarani" --role faculty
// The password is read from the STAFF_PASSWORD environment variable, or a random one is printed.
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import bcrypt from 'bcrypt'
import { config } from '../src/config.js'
import { pool } from '../src/db.js'

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'faculty' } },
})
if (!values.email || !values.name || !['faculty', 'admin'].includes(values.role)) {
  console.error('Usage: npm run staff -- --email you@psgtech.ac.in --name "Full Name" --role faculty|admin')
  process.exit(1)
}

const password = process.env.STAFF_PASSWORD || randomBytes(9).toString('base64url')
const hash = await bcrypt.hash(password, config.bcryptRounds)
await pool.query(
  `INSERT INTO user_account (email, name, role, password_hash) VALUES (?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), password_hash = VALUES(password_hash)`,
  [values.email.toLowerCase(), values.name, values.role, hash],
)
console.log(`${values.role} account ready: ${values.email}`)
if (!process.env.STAFF_PASSWORD) console.log(`Temporary password: ${password}  (share it privately; reset via OTP later)`)
await pool.end()
