# UNITE backend

Node.js + Express 5 + MySQL API for UNITE. Sessions are stored in MySQL (cookie `unite.sid`), there are no passwords (everyone signs in with a 6-digit code sent to their email), and every SQL query uses placeholders.

## Run it

```bash
brew services start mysql      # MySQL must be running
cp .env.example .env           # then fill it in (see Settings below)
npm install
npm run db:setup               # creates tables, loads the 44 programmes, upgrades an older database (safe to re-run)
npm run dev                    # http://localhost:4000, restarts on file changes
npm test                       # 42 integration tests against the unite_test database (.env.test)
npm run seed:demo              # optional: demo students, groups, a poll and points (dev database only)
```

Demo sign-in after `seed:demo` (development only): `26dm001@psgtech.ac.in` (owner of Team Nova) through `26dm012@psgtech.ac.in`, `demo.faculty@psgtech.ac.in` and `demo.admin@psgtech.ac.in`; they sign in with the fixed code set in `DEMO_LOGIN_CODE` (ignored in production). The demo includes three verified wins, a pending join request for Team Nova, a poll, and two pending claims (one from a joint team of two groups) for the faculty account to review, and three open reports for the admin console. Re-running the command resets all demo data, including its `uploads/demo-*.pdf` certificates.

The frontend dev server (`frontend/`, port 5173) proxies `/api` to this server.

Create a faculty or admin account (they do not use student sign-up):

```bash
npm run staff -- --email someone@psgtech.ac.in --name "Dr. V. Umarani" --role faculty
```

After pulling new code, run `npm run db:setup` again. It changes existing tables in place and keeps your data.

## Settings (`.env`)

Copy `.env.example` to `.env` (and to `.env.test` with `DB_NAME=unite_test` for the tests). `.env` and `.env.test` hold the database password and session secret. They are git-ignored; never commit them.

| Variable | Meaning |
|---|---|
| `MAIL_PROVIDER` | `console` (codes printed in the server log), `brevo` or `resend` |
| `MAIL_FROM` | Sender, e.g. `UNITE <unite.team@gmail.com>`; must be verified with the provider |
| `BREVO_API_KEY` / `RESEND_API_KEY` | API key for the chosen provider |
| `APP_ORIGIN` | The site's origin; other origins are refused on POST/PUT/PATCH/DELETE |

**Email provider tip:** Brevo can send from a single verified address (no domain needed), so it can deliver to `@psgtech.ac.in` inboxes straight away. Resend needs a verified domain before it can send to addresses other than your own.

## Decisions used (change in code if the team decides otherwise)

| Topic | Current rule | Where |
|---|---|---|
| Group size / programmes | Max 6, one per programme, checked under a row lock on the group | `src/services/groups.js` |
| Joining | Request → leader or second in command approves; a student may be in only one union (unique key), and joining cancels their other requests and invites. The leader can also invite a student, who accepts or declines | `src/routes/groups.js` |
| Leadership | Groups are called unions in the app. The creator is leader (`owner`); the leader can name one second in command (`deputy`), who can also approve join requests | `src/routes/groups.js` |
| Leader leaves | Second in command becomes leader, else the longest-standing member; empty group is deleted | `src/routes/groups.js` |
| Sign-up | Only `rollno@psgtech.ac.in`; emailed code (6 digits, 10 min, 5 tries) for both sign-up and sign-in; no passwords | `src/routes/auth.js`, `src/config.js` |
| Email length | At most 30 characters (college emails are about 21), checked on the server, in the sign-in box and by `npm run staff` | `src/lib/validate.js` |
| Flyers | Students and faculty post PNG/JPG flyer photos (≤ 5 MB); anyone signed in can like and comment; union members share with their union; the poster or an admin can delete | `src/routes/flyers.js` |
| Points for multi-group teams | **Every** group in the event team gets the full points | `src/routes/achievements.js` |
| Scoring | 100/70/50/45/…/15, participation 10; ×1.0 college, ×1.5 state, ×2.0 national | `src/lib/scoring.js` |
| Below 10th | Submit as “participation” | `src/routes/achievements.js` |
| Host category | Student picks; reviewer can correct it when approving | `src/routes/achievements.js` |
| Evidence | 1–5 files, PDF/PNG/JPG, ≤ 5 MB each, content checked; visible to submitter, team groups and reviewers | `src/lib/uploads.js` |
| Roles | `student`, `faculty` (reviews claims), `admin` (reviews, reports, roles, suspensions) | `src/middleware/auth.js` |
| Role changes | A student in any group cannot be made faculty/admin until they leave their groups (groups are students-only) | `src/routes/admin.js` |
| Suspension | Suspended users are signed out on their next request and cannot sign in; their data and group places are kept | `src/routes/admin.js` |

## API overview

All paths start with `/api`. Send `X-UNITE: 1` on every non-GET request.

- **Auth:** `POST /auth/otp`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/programmes`
- **Profile & people:** `GET/PUT /me/profile`, `GET /students?q=&programmeId=&interest=`, `GET /students/suggested`, `GET /students/:id`
- **Friends:** `GET /friends`, `GET /friends/requests`, `POST /friends/requests`, `POST /friends/requests/:id/accept|reject|cancel`, `DELETE /friends/:userId`
- **Safety:** `GET/POST /blocks`, `DELETE /blocks/:userId`, `POST /reports`
- **Groups:** `GET /groups`, `GET /groups/mine`, `POST /groups`, `GET/PATCH /groups/:id`, `POST /groups/:id/join-requests`, `DELETE /groups/:id/join-requests/mine`, `POST /groups/:id/join-requests/:rid/approve|reject`, `PUT /groups/:id/deputy`, `POST /groups/:id/invites`, `DELETE /groups/:id/members/:userId|me`
- **Invites:** `GET /invites`, `POST /invites/:id/accept|decline`
- **Polls:** `GET/POST /groups/:id/polls`, `POST /polls/:id/vote`
- **Events:** `GET/POST /events`, `GET /events/:id`, `POST /events/:id/teams`, `POST /events/:id/teams/:teamId/groups`
- **Achievements:** `POST /achievements` (multipart, field `evidence`), `GET /achievements/mine`, `GET /achievements/:id`, `GET /evidence/:id`
- **Review (faculty/admin):** `GET /review/achievements?status=`, `POST /review/achievements/:id`
- **Leaderboard:** `GET /leaderboard`
- **Flyers:** `GET /flyers?before=`, `GET /flyers/shared`, `POST /flyers` (multipart, field `image`), `GET /flyers/:id`, `GET /flyers/:id/image`, `POST/DELETE /flyers/:id/like`, `POST /flyers/:id/comments`, `DELETE /flyers/:id/comments/:commentId`, `POST /flyers/:id/share`, `DELETE /flyers/:id`
- **Notifications:** `GET /notifications`, `POST /notifications/read`
- **Admin:** `GET /admin/stats`, `GET /admin/reports?status=`, `POST /admin/reports/:id/resolve`, `GET /admin/users?q=&role=&status=`, `POST /admin/users/:id/role`, `POST /admin/users/:id/active`, `GET /admin/activity?q=`, `POST /admin/claims/:id/reopen|withdraw`, `POST /admin/activity/:id/restore-member`

## Database

`db/schema.sql` maps the design document's eight tables (PROGRAMME, STUDENT → `user_account`, COLLAB_GROUP, GROUP_MEMBER, EVENT, EVENT_TEAM, TEAM_GROUP, ACHIEVEMENT) and adds the supporting tables the report diagram leaves out (OTP, interests, links, friends, blocks, reports, join requests, invites, polls, evidence, points ledger, notifications, activity log, and the flyer, like, comment and share tables). Sessions are kept in a `sessions` table created by the session store.

Columns are sized to the data to save space: emails are `VARCHAR(30)` and roll numbers `VARCHAR(10)` in the 1-byte `ascii` character set, the sign-in code hash is `BINARY(32)`, file types are ENUMs, and `activity_log.id` is `INT UNSIGNED`. `npm run db:setup` upgrades older databases to these types.
