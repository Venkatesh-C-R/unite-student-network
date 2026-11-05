// Create a faculty or admin account (they do not use student sign-up). They sign in by emailed code.
// Usage: npm run staff -- --email umarani@psgtech.ac.in --name "Dr. V. Umarani" --role faculty
import { parseArgs } from 'node:util'
import { pool } from '../src/db.js'

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'faculty' } },
})
if (!values.email || !values.name || !['faculty', 'admin'].includes(values.role) || !/@psgtech\.ac\.in$/i.test(values.email)) {
  console.error('Usage: npm run staff -- --email you@psgtech.ac.in --name "Full Name" --role faculty|admin')
  process.exit(1)
}

await pool.query(
  `INSERT INTO user_account (email, name, role) VALUES (?, ?, ?)
   ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role)`,
  [values.email.toLowerCase(), values.name, values.role],
)
console.log(`${values.role} account ready: ${values.email}. They sign in with a code sent to that address.`)
await pool.end()
