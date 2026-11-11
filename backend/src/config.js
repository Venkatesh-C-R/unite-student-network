// All settings come from environment variables (see .env.example).
function required(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing environment variable ${name}`)
  return v
}

const env = process.env.NODE_ENV || 'development'

export const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT || 4000),
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  sessionSecret: required('SESSION_SECRET'),
  // A sign-in lasts until the user logs out; this is how long an unused device stays signed in
  sessionDays: 400,
  // Sign-in rate limits per 15 minutes. Limits per email address stop abuse of one account;
  // the per-IP limits are high because a whole campus can share one public IP address.
  rateLimits: {
    otpPerEmail: 5,
    otpPerIp: Number(process.env.RATE_LIMIT_OTP_PER_IP || 300),
    verifyPerEmail: 10,
    verifyPerIp: Number(process.env.RATE_LIMIT_VERIFY_PER_IP || 600),
  },
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME'),
  },
  mail: {
    // One provider, or several separated by commas to try in order, e.g. "smtp,brevo":
    // if the first fails (for example its daily limit is reached) the next one sends.
    // console | smtp | brevo | resend
    providers: (process.env.MAIL_PROVIDER || 'console').split(',').map((p) => p.trim().toLowerCase()).filter(Boolean),
    from: process.env.MAIL_FROM || 'UNITE <no-reply@example.com>',
    resendKey: process.env.RESEND_API_KEY || '',
    brevoKey: process.env.BREVO_API_KEY || '',
    // Any SMTP server; for a Google Workspace account: smtp.gmail.com, port 465, an app password
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  // Only PSG Tech roll-number emails can sign up as students, e.g. 26mx354@psgtech.ac.in
  studentEmail: /^(\d{2}[a-z]{1,3}\d{2,4})@psgtech\.ac\.in$/i,
  otp: { ttlMinutes: 10, maxAttempts: 5, resendSeconds: 60 },
  // Demo only: a fixed 6-digit code that signs in the seeded demo accounts. Never used in production.
  demoLoginCode: env === 'production' ? null : /^\d{6}$/.test(process.env.DEMO_LOGIN_CODE || '') ? process.env.DEMO_LOGIN_CODE : null,
  demoEmail: /^(26dm\d{3}|demo\.faculty|demo\.admin)@psgtech\.ac\.in$/i,
  uploads: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxBytes: 5 * 1024 * 1024,
    maxFiles: 5,
  },
}
