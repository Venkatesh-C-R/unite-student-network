# UNITE

UNITE stands for University Network for Interdisciplinary Teamwork and Engagement. It's a site for PSG Tech students who want to team up with people outside their own department.

Students form a union, which is a team of up to six with at most one person from each programme. The union enters events together. When it wins or places somewhere, it claims the result and uploads proof, and a faculty member checks it. Verified results earn points, and every union shows up on one shared leaderboard.

The code is in two parts:

- `frontend/` is the website, built with React, Vite and Tailwind. It runs on port 5173.
- `backend/` is the API, built with Node.js, Express and MySQL. It runs on port 4000. The scoring rules, the API routes and every setting are explained in [backend/README.md](backend/README.md).

## Running it on your computer

Your copy is completely separate from anyone else's. You get your own MySQL database, your own API and your own website.

You'll need Node.js 20.6 or newer and MySQL 8. On a Mac with Homebrew:

```bash
brew install node mysql
brew services start mysql
```

On Windows or Linux, install both the way you normally would and make sure MySQL is running.

1. Get the code:

   ```bash
   git clone https://github.com/Venkatesh-C-R/unite-student-network.git
   cd unite-student-network
   ```

2. Make an empty database:

   ```bash
   mysql -u root -e "CREATE DATABASE unite"
   ```

3. Copy the settings template:

   ```bash
   cp backend/.env.example backend/.env
   ```

   Then open `backend/.env` and fill in a few values. `SESSION_SECRET` can be any long random string. Add your MySQL username and password. Set `DEMO_LOGIN_CODE=123456` if you want to use the demo accounts.

4. Install the packages, create the tables and load the demo data:

   ```bash
   cd backend && npm install && npm run db:setup && npm run seed:demo && cd ..
   cd frontend && npm install && cd ..
   ```

5. Start it up.

   On a Mac, double-click `start-unite.command` (or run `./start-unite.command` from a terminal). It starts MySQL, the API and the website, then opens the site in your browser. Close the window to stop everything.

   On Windows or Linux, open two terminals. Run `npm run dev` in `backend/` in one and `npm run dev` in `frontend/` in the other, then go to http://localhost:5173.

When you pull new code later, run `npm run db:setup` in `backend/` once. It updates your tables to match the new code and keeps your data.

## Demo accounts

To sign in, use one of the emails below and the code you set as `DEMO_LOGIN_CODE` (`123456` if you followed the steps above). That fixed code only works for demo accounts, and it's switched off in production. Every other account gets a code by email. If `MAIL_PROVIDER` is set to `console`, the code is printed in the backend terminal instead.

| Email | Who it is |
|---|---|
| `26dm001@psgtech.ac.in` | Aarav, who leads Team Nova. This account has a join request waiting for approval and an open poll, and can submit claims. |
| `26dm002@psgtech.ac.in` to `26dm012@psgtech.ac.in` | More students. Some are in Team Nova, Circuit Breakers or Bio Bytes, and some haven't joined a union yet. |
| `demo.faculty@psgtech.ac.in` | A faculty member with two claims waiting for review, certificates attached. |
| `demo.admin@psgtech.ac.in` | The admin, who can see reports, manage users, read the activity log and undo decisions. |

To reset the demo data, run `npm run seed:demo` in `backend/`. It won't run in production or against the test database.

## Putting it online

[DEPLOY.md](DEPLOY.md) explains how to host UNITE for free for up to about 12,000 students. The website, API and database all run on one Oracle Cloud Always Free server. Sign-in emails go out through a college Google Workspace account, with Brevo as a backup. The config files for this are in [`deploy/`](deploy/).

## Tests

The tests need their own database, because they wipe its tables every time they run. Set one up once:

```bash
mysql -u root -e "CREATE DATABASE unite_test"
cp backend/.env.example backend/.env.test   # set DB_NAME=unite_test and fill in the rest
cd backend && npm test
```
