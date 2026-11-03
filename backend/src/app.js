import express from 'express'
import session from 'express-session'
import MySQLStoreFactory from 'express-mysql-session'
import helmet from 'helmet'
import { config } from './config.js'
import { pool } from './db.js'
import { errorHandler, notFound } from './lib/errors.js'
import { csrfGuard, loadUser } from './middleware/auth.js'
import { achievementsRouter } from './routes/achievements.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { eventsRouter } from './routes/events.js'
import { groupsRouter } from './routes/groups.js'
import { invitesRouter } from './routes/invites.js'
import { peopleRouter } from './routes/people.js'
import { pollsRouter } from './routes/polls.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))

  const MySQLStore = MySQLStoreFactory(session)
  const store = new MySQLStore({ clearExpired: config.env !== 'test', createDatabaseTable: true }, pool)
  app.locals.sessionStore = store
  app.use(
    session({
      name: 'unite.sid',
      secret: config.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  )

  app.get('/api/health', (req, res) => res.json({ ok: true }))
  app.use('/api', csrfGuard, loadUser)
  app.use('/api/auth', authRouter)
  app.use('/api', peopleRouter)
  app.use('/api/groups', groupsRouter)
  app.use('/api/invites', invitesRouter)
  app.use('/api', pollsRouter)
  app.use('/api/events', eventsRouter)
  app.use('/api', achievementsRouter)
  app.use('/api/admin', adminRouter)

  app.use('/api', () => {
    throw notFound('No such API route.')
  })
  app.use(errorHandler)
  return app
}
