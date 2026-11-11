# Deploying UNITE for free

How to run UNITE for up to about 12,000 students at no cost:

- **Website, API and database:** one Oracle Cloud *Always Free* virtual machine.
- **Sign-in emails:** a college Google Workspace account, with Brevo's free plan as a backup.

Everything runs on one machine: nginx serves the website and passes `/api` to Node, and Node talks to MySQL on the same machine. The config files used below are in [`deploy/`](deploy/).

```
student's browser ──HTTPS──► nginx ──► website files (frontend/dist)
                               └─/api─► Node API :4000 ──► MySQL :3306 (local only)
                                             └──► uploads in /var/lib/unite/uploads
```

## What the free services give you

| Need | Service | Free allowance | Enough for 12,000 students? |
|---|---|---|---|
| Server (web + API + DB) | Oracle Cloud Always Free, Ampere A1 | 2 CPUs, 12 GB RAM, 200 GB disk, 10 TB outbound data a month | Yes. The database is a few hundred MB even at full size; evidence files and flyers fit easily in 200 GB. |
| Sign-in codes (main) | Google Workspace account at `psgtech.ac.in` | About 2,000 emails a day per account | Yes, once sign-up is spread over a week. Mail between two `psgtech.ac.in` addresses stays inside the college, so codes reach the inbox. |
| Sign-in codes (backup) | Brevo free plan | 300 emails a day | Backup only |
| Address and HTTPS | A college subdomain (e.g. `unite.psgtech.ac.in`) or a free DuckDNS name, with Let's Encrypt | Free | Yes |

Free-tier limits change. Check Oracle's [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm) page and Google's [Gmail sending limits](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace) before launch.

**Email maths:** each student needs one email to sign up. Sign-ins then last until the student logs out, so later codes are only needed on a new device. 12,000 sign-ups at about 2,300 emails a day (Workspace plus Brevo) take about 6 days if everyone joins at once, so open sign-up in stages (see the launch plan below). If every provider is out of emails for the day, the app tells students to try again later and nothing breaks.

## 1. Things to ask for first (they take the longest)

1. **From the college IT department:**
   - A Google Workspace account just for UNITE, e.g. `unite@psgtech.ac.in`, with 2-Step Verification and **app passwords allowed** (or SMTP access) for that account.
   - A DNS record `unite.psgtech.ac.in → <server IP>` once you have the server. If that's not possible, use a free DuckDNS name (step 4).
2. **An Oracle Cloud account** at <https://www.oracle.com/cloud/free/>. It needs a debit or credit card to check your identity; Always Free resources are not charged. Pick **India South (Hyderabad)** or **India West (Mumbai)** as the home region. It can't be changed later.

## 2. Create the server

In the Oracle Cloud console, go to **Compute → Instances → Create instance**:

- **Image:** Canonical Ubuntu 24.04
- **Shape:** Ampere `VM.Standard.A1.Flex`, 2 OCPUs, 12 GB memory (the whole free allowance)
- **Boot volume:** 100 GB
- **SSH key:** upload your public key (or let Oracle generate one and download it)

If you get "Out of capacity", try another availability domain or try again later. A1 capacity comes and goes.

Then open the web ports:

- **In Oracle:** Networking → your VCN → Security List → add ingress rules for TCP **80** and **443** from `0.0.0.0/0`.
- **On the server** (Oracle's Ubuntu image also blocks them):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Do **not** open port 3306 (MySQL) or 4000 (API). Only nginx should be reachable from outside.

> **Oracle reclaims idle free servers:** it may reclaim an Always Free instance if, over 7 days, its CPU, network and memory use all stay under 20%. The MySQL setting in `deploy/mysql-unite.cnf` keeps 4 GB of the 12 GB in use, which keeps memory above that line. Upgrading the account to Pay As You Go also stops reclamation, and Always Free resources stay free. Set a budget alert if you do.

## 3. Install the software

```bash
ssh ubuntu@<server IP>
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx mysql-server git certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt -y install nodejs
sudo useradd --system --create-home --home-dir /var/lib/unite --shell /usr/sbin/nologin unite
sudo mkdir -p /var/lib/unite/uploads /opt/unite && sudo chown -R unite:unite /var/lib/unite /opt/unite
sudo -u unite git clone https://github.com/Venkatesh-C-R/unite-student-network.git /opt/unite
```

**MySQL:**

```bash
sudo cp /opt/unite/deploy/mysql-unite.cnf /etc/mysql/mysql.conf.d/unite.cnf
sudo systemctl restart mysql
sudo mysql -e "CREATE DATABASE unite; CREATE USER 'unite'@'localhost' IDENTIFIED BY '<a long random password>'; GRANT ALL ON unite.* TO 'unite'@'localhost';"
```

For the backup script, put the same login in `/root/.my.cnf` (mode 600):

```ini
[client]
user=unite
password=<the same password>
```

## 4. Get an address

- **College subdomain:** ask IT for an `A` record `unite.psgtech.ac.in` pointing to the server's public IP.
- **Or DuckDNS (free):** sign in at <https://www.duckdns.org>, create a name such as `unite-psg`, and set it to the server IP. Your address is then `unite-psg.duckdns.org`.

## 5. Install UNITE

The code was cloned to `/opt/unite` in step 3.

```bash
cd /opt/unite/backend && sudo -u unite npm ci --omit=dev
cd /opt/unite/frontend && sudo -u unite npm ci && sudo -u unite npm run build
```

Create `/opt/unite/backend/.env` (owner `unite`, mode 600). **Never commit this file.**

```ini
NODE_ENV=production
PORT=4000
APP_ORIGIN=https://unite.psgtech.ac.in
SESSION_SECRET=<64 random hex characters: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=unite
DB_PASSWORD=<the MySQL password>
DB_NAME=unite
MAIL_PROVIDER=smtp,brevo
MAIL_FROM=UNITE <unite@psgtech.ac.in>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=unite@psgtech.ac.in
SMTP_PASS=<the app password>
BREVO_API_KEY=<from Brevo → SMTP & API → API keys>
UPLOAD_DIR=/var/lib/unite/uploads
```

- Keep `SESSION_SECRET` the same forever. Changing it signs everyone out.
- Leave `DEMO_LOGIN_CODE` out in production. It's ignored there anyway.
- In Brevo, verify `MAIL_FROM` as a sender.

```bash
cd /opt/unite/backend
sudo -u unite node --env-file=.env scripts/setup-db.js
sudo -u unite node --env-file=.env scripts/create-staff.js --email <admin email> --name "<name>" --role admin
```

## 6. Start it

```bash
sudo cp /opt/unite/deploy/unite-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now unite-api
curl -s localhost:4000/api/health          # {"ok":true}

sudo cp /opt/unite/deploy/nginx-unite.conf /etc/nginx/sites-available/unite
sudo sed -i 's/unite.example.org/unite.psgtech.ac.in/' /etc/nginx/sites-available/unite
sudo ln -s /etc/nginx/sites-available/unite /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d unite.psgtech.ac.in   # HTTPS, renews itself
```

HTTPS is required: in production the sign-in cookie is only sent over HTTPS.

## 7. Backups

```bash
sudo cp /opt/unite/deploy/backup.sh /usr/local/bin/unite-backup && sudo chmod 700 /usr/local/bin/unite-backup
sudo crontab -e      # add:  30 2 * * * /usr/local/bin/unite-backup
```

This keeps 14 days of database dumps and uploads in `/var/backups/unite`. Copy one off the server now and then, for example with `scp`, or use Oracle's free volume backups.

## 8. Updating later

```bash
cd /opt/unite && sudo -u unite git pull
cd backend && sudo -u unite npm ci --omit=dev && sudo -u unite node --env-file=.env scripts/setup-db.js
cd ../frontend && sudo -u unite npm ci && sudo -u unite npm run build
sudo systemctl restart unite-api
```

`setup-db.js` upgrades the tables in place and keeps all data.

## Launch plan

1. **Pilot:** one class of 50–100 students for 2–3 days. Check that codes arrive in the inbox (not spam), uploads work, and nothing appears in `journalctl -u unite-api`.
2. **Staged sign-up:** announce to one year or department at a time, about 1,500–2,000 students a day, so the daily email allowance is never exceeded.
3. **Watch:** daily emails sent (Google Admin and Brevo dashboards), disk space (`df -h`), and that last night's backup exists.

## How sign-in behaves

- Students sign in with an emailed 6-digit code and stay signed in on that device until they press **Log out**. Each visit renews the sign-in. A device left unused for 400 days (the longest a browser keeps a cookie) has to sign in again.
- Signing out on one device doesn't affect the others.
- An admin suspending an account signs it out everywhere on its next request.
- Code requests are limited to 5 per email address and 300 per IP address every 15 minutes. The per-IP limit is high because a whole campus can share one public IP. Change it with `RATE_LIMIT_OTP_PER_IP` and `RATE_LIMIT_VERIFY_PER_IP`.
