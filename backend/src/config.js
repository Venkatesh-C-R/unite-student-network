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
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME'),
  },
  mail: {
    provider: process.env.MAIL_PROVIDER || 'console', // console | resend | brevo
    from: process.env.MAIL_FROM || 'UNITE <no-reply@example.com>',
    resendKey: process.env.RESEND_API_KEY || '',
    brevoKey: process.env.BREVO_API_KEY || '',
  },
  // Only PSG Tech roll-number emails can sign up as students, e.g. 26mx354@psgtech.ac.in
  studentEmail: /^(\d{2}[a-z]{1,3}\d{2,4})@psgtech\.ac\.in$/i,
  otp: { ttlMinutes: 10, maxAttempts: 5, resendSeconds: 60 },
  uploads: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxBytes: 5 * 1024 * 1024,
    maxFiles: 5,
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
}
