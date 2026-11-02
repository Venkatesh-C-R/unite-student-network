import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'
import { one, pool } from '../db.js'
import { badRequest, HttpError } from './errors.js'
import { otpEmail, sendMail } from './mailer.js'

const hash = (email, code) => createHmac('sha256', config.sessionSecret).update(`${email}:${code}`).digest('hex')

export async function issueOtp(email, purpose) {
  const recent = await one(
    `SELECT created_at FROM email_otp
      WHERE email = ? AND purpose = ? AND created_at > NOW() - INTERVAL ? SECOND
      ORDER BY id DESC LIMIT 1`,
    [email, purpose, config.otp.resendSeconds],
  )
  if (recent) throw new HttpError(429, 'Please wait a minute before asking for another code.', 'otp_cooldown')

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await pool.query(
    `INSERT INTO email_otp (email, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, NOW() + INTERVAL ? MINUTE)`,
    [email, purpose, hash(email, code), config.otp.ttlMinutes],
  )
  await sendMail(otpEmail(email, code, purpose))
}

// Checks the newest unused code and consumes it on success, inside the caller's transaction.
// The row is not locked while checking, so a failed try can be counted on another connection.
export async function consumeOtp(conn, email, purpose, code) {
  const row = await one(
    `SELECT id, code_hash, attempts, expires_at > NOW() AS live
       FROM email_otp
      WHERE email = ? AND purpose = ? AND consumed_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    [email, purpose],
    conn,
  )
  if (!row || !row.live) throw badRequest('This code has expired. Ask for a new one.', 'otp_expired')
  if (row.attempts >= config.otp.maxAttempts) throw badRequest('Too many wrong tries. Ask for a new code.', 'otp_locked')

  const ok = timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hash(email, code)))
  if (!ok) {
    // Count the failed try outside the caller's transaction, which is about to roll back
    await pool.query('UPDATE email_otp SET attempts = attempts + 1 WHERE id = ?', [row.id])
    throw badRequest('That code is not correct.', 'otp_invalid')
  }
  // Conditional update so the same code can never be used twice, even by parallel requests
  const [r] = await conn.query('UPDATE email_otp SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL', [row.id])
  if (r.affectedRows !== 1) throw badRequest('This code was already used. Ask for a new one.', 'otp_used')
}
