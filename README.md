# UNITE

University Network for Interdisciplinary Teamwork and Engagement: PSG Tech students from different programmes form unions (teams of up to six, one per programme), enter events together, claim results with evidence for faculty to verify, and climb a shared leaderboard.

- `frontend/`: React + Vite + Tailwind website (port 5173)
- `backend/`: Node.js + Express + MySQL API (port 4000); see [backend/README.md](backend/README.md) for the rules, API and settings

## Run it on your own computer

Everything runs locally: your own MySQL database, the API and the website. Nothing is shared with anyone else's copy.

You need **Node.js 20.6 or newer** and **MySQL 8**. On a Mac with Homebrew:

```bash
brew install node mysql
brew services start mysql
```

On Windows or Linux, install Node.js and MySQL the usual way for your system and start MySQL.

1. Download the code:

   ```bash
   git clone https://github.com/Venkatesh-C-R/unite-student-network.git
   cd unite-student-network
   ```

2. Create the database:

   ```bash
   mysql -u root -e "CREATE DATABASE unite"
   ```

3. Create the settings file from the template, then open `backend/.env` and fill in `SESSION_SECRET` (any long random text), your MySQL user and password, and `DEMO_LOGIN_CODE=123456` to use the demo accounts:

   ```bash
   cp backend/.env.example backend/.env
   ```

4. Install everything, create the tables and load the demo data:

   ```bash
   cd backend && npm install && npm run db:setup && npm run seed:demo && cd ..
   cd frontend && npm install && cd ..
   ```

5. Start it:
   - **Mac:** double-click `start-unite.command` (or run `./start-unite.command`). It starts MySQL, the API and the website, and opens the site. Close its window to stop.
   - **Windows / Linux:** run `npm run dev` in `backend/` and `npm run dev` in `frontend/`, each in its own terminal, then open http://localhost:5173.

## Demo accounts

Sign in with one of these emails and the code from `DEMO_LOGIN_CODE` (e.g. `123456`). The fixed code works only for demo accounts and never in production; other accounts get their code by email (with `MAIL_PROVIDER=console` it is printed in the backend terminal).

| Email | Who |
|---|---|
| `26dm001@psgtech.ac.in` | Aarav, leader of Team Nova: a join request to approve, a poll, can submit claims |
| `26dm002@psgtech.ac.in` … `26dm012@psgtech.ac.in` | Other students, in Team Nova, Circuit Breakers, Bio Bytes or no union yet |
| `demo.faculty@psgtech.ac.in` | Faculty: two pending claims with certificates to review |
| `demo.admin@psgtech.ac.in` | Admin: reports, users, activity log, undoing decisions |

Run `npm run seed:demo` in `backend/` at any time to reset the demo data. It refuses to run in production or on the test database.

## Tests

Create a second database and settings file for the tests (they reset its tables on every run):

```bash
mysql -u root -e "CREATE DATABASE unite_test"
cp backend/.env.example backend/.env.test   # set DB_NAME=unite_test and fill in the rest
cd backend && npm test
```
