import { config } from '../config.js'

// In console mode the last messages are kept in memory so tests can read OTP codes.
export const outbox = []

function parseFrom(from) {
  const m = from.match(/^(.*)<(.+)>$/)
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'UNITE', email: from.trim() }
}

async function sendBrevo({ to, subject, text, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.mail.brevoKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: parseFrom(config.mail.from), to: [{ email: to }], subject, textContent: text, htmlContent: html }),
  })
  if (!res.ok) throw new Error(`Brevo send failed: ${res.status} ${await res.text()}`)
}

async function sendResend({ to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.mail.resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: config.mail.from, to: [to], subject, text, html }),
  })
  if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`)
}

// Any SMTP server. With a Google Workspace account (smtp.gmail.com) one address can send about
// 2,000 emails a day, and mail between two psgtech.ac.in addresses stays inside the college.
let transport
async function sendSmtp({ to, subject, text, html }) {
  if (!transport) {
    const { default: nodemailer } = await import('nodemailer')
    const { host, port, user, pass } = config.mail.smtp
    transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, pool: true })
  }
  await transport.sendMail({ from: config.mail.from, to, subject, text, html })
}

function printMail(msg) {
  outbox.push(msg)
  if (outbox.length > 50) outbox.shift()
  if (config.env !== 'test') console.log(`[mail] to=${msg.to} subject="${msg.subject}"\n${msg.text}\n`)
}

// Providers that are listed but not set up are skipped, so a missing key never sends nothing
const PROVIDERS = {
  smtp: { ready: () => Boolean(config.mail.smtp.user && config.mail.smtp.pass), send: sendSmtp },
  brevo: { ready: () => Boolean(config.mail.brevoKey), send: sendBrevo },
  resend: { ready: () => Boolean(config.mail.resendKey), send: sendResend },
  console: { ready: () => true, send: printMail },
}
// Tests replace a provider's send function here
export const providers = PROVIDERS

// Tries each configured provider in turn (MAIL_PROVIDER=smtp,brevo): when one fails, for
// example because its daily limit is used up, the next one sends. Throws if none could.
export async function sendMail(msg) {
  const list = config.mail.providers.filter((p) => PROVIDERS[p]?.ready())
  if (!list.length) {
    console.warn(`[mail] no provider in "${config.mail.providers.join(',')}" is set up; printing instead.`)
    return printMail(msg)
  }
  let lastError
  for (const name of list) {
    try {
      return await PROVIDERS[name].send(msg)
    } catch (e) {
      lastError = e
      console.error(`[mail] ${name} failed for ${msg.to}: ${e.message}`)
    }
  }
  throw lastError
}

export function otpEmail(to, code, purpose) {
  const action = purpose === 'signup' ? 'finish creating your UNITE account' : 'sign in to UNITE'
  const text = `Your UNITE code is ${code}\n\nUse it to ${action}. It expires in ${config.otp.ttlMinutes} minutes.\nIf you did not ask for this, ignore this email.`
  const html = `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
  <h2 style="margin:0 0 8px;color:#BB2525;letter-spacing:4px">UNITE</h2>
  <p>Use this code to ${action}:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">${code}</p>
  <p style="color:#555">It expires in ${config.otp.ttlMinutes} minutes. If you did not ask for this, ignore this email.</p>
</div>`
  return { to, subject: `Your UNITE code: ${code}`, text, html }
}
