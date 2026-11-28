# Hosting UNITE on Azure for Students

This guide runs UNITE for about a year at little or no cost using **Azure for Students** (no card needed). It follows [DEPLOY.md](DEPLOY.md) (the Oracle guide) but runs the database on Azure's managed MySQL instead of on the server.

```
students ──HTTPS──► VM (Ubuntu, B1s)                    Azure Database for MySQL (B1ms)
                     ├── nginx: website + /api/ ──► Node API ──TLS, private network──► database "unite"
                     └── data disk: /var/lib/unite (uploads)
```

## What it uses

| Part | Azure service | Cost |
|---|---|---|
| Server: website + API | Virtual machine **B1s** (1 CPU, 1 GB), Ubuntu 24.04 | Free for 12 months (750 hours a month) |
| Database | Azure Database for MySQL – Flexible Server, **Burstable B1ms**, 32 GB | Free for 12 months (750 hours a month) |
| Disks | OS disk 64 GB + data disk 64 GB, both Premium SSD **P6** | Free for 12 months (2 × P6) |
| Public IP, private DNS, extra traffic | — | A few dollars a month, paid from the $100 credit |

Free services change. Before you start, open **Free services** in the Azure portal and check that the B1s VM, MySQL Flexible Server B1ms and P6 disks are listed for your account. Anything not listed is paid from the credit.

**Capacity:** fine for the pilot and normal college use. During a big rush (thousands signing in at once) the 1 GB server slows down; you can resize it to B2s later (about $30 a month from the credit).

## 1. Sign up and set a budget alert

1. Sign up at <https://azure.microsoft.com/free/students> with your college email. No card is needed.
2. In the portal, search **Cost Management → Budgets → Add**. Scope: your subscription. Amount: **$10** a month. Alert at **50%** actual and **100%** forecast, to your email (and a teammate's).
3. When the $100 credit runs out, Azure **stops** the services instead of charging you, so the site goes offline. Check the remaining credit in **Cost Management** once a month.

## 2. Create the server (VM)

Portal → **Virtual machines → Create → Azure virtual machine**.

| Setting | Value |
|---|---|
| Resource group | New: `unite-rg` (put everything in it) |
| Name | `unite-vm` |
| Region | **(Asia Pacific) Central India** (keep every resource in this region) |
| Image | **Ubuntu Server 24.04 LTS – x64 Gen2** |
| Size | **B1s** (look for the "Free services eligible" tag) |
| Authentication | **SSH public key**, username `azureuser`; download the key and keep it private |
| Inbound ports | **SSH (22)** only for now |

**Disks** tab:
- OS disk: **Premium SSD**, size **64 GiB (P6)**.
- **Create and attach a new disk:** Premium SSD, **64 GiB (P6)**, for the uploads.

**Networking** tab: keep the new virtual network `unite-vm-vnet` (the database joins it later). Public IP: new, **Static**.

**Review + create**. Note the **public IP**.

Then make SSH reachable only from you: VM → **Networking → Network settings** → the SSH rule → **Source: My IP address**. Add two rules: **HTTP (80)** and **HTTPS (443)** from **Any**. Never open port 3306.

## 3. Create the database

Portal → **Azure Database for MySQL flexible servers → Create → Flexible server**. If it offers a **free** option, take it.

| Setting | Value |
|---|---|
| Resource group / region | `unite-rg`, **Central India** |
| Server name | e.g. `unite-db-psg` (becomes `unite-db-psg.mysql.database.azure.com`) |
| MySQL version | **8.4** (or 8.0) |
| Workload type | **For development or hobby projects** |
| Compute + storage | **Burstable, B1ms**, **32 GiB**, storage auto-growth **off**, high availability **off**, backup retention **7 days** |
| Authentication | MySQL only; admin user `uniteadmin`, a long random password (keep it in a password manager) |

**Networking** tab: **Private access (VNet Integration)**. Virtual network: `unite-vm-vnet`. Subnet: create a new one (e.g. `mysql-subnet`, `10.0.1.0/24`); Azure delegates it to MySQL. Private DNS zone: let Azure create it. The database is then reachable only from inside that network, never from the internet.

**Review + create** (takes about 10 minutes).

Leave the server parameter `require_secure_transport` **ON** (the default): UNITE connects with TLS (`DB_SSL=true`).

## 4. Install the software

```bash
ssh -i <your key>.pem azureuser@<VM public IP>
```

**Memory:** B1s has 1 GB, which is too little to build the website. Add 2 GB of swap first:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Data disk** for uploads (the 64 GB disk without a partition, usually `/dev/sdc`; check with `lsblk`):

```bash
lsblk                                   # find the empty 64G disk, e.g. sdc
sudo mkfs.ext4 -L unitedata /dev/sdc    # only on the NEW empty disk
sudo mkdir -p /var/lib/unite
echo 'LABEL=unitedata /var/lib/unite ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo mount -a && df -h /var/lib/unite
```

Uploads live on the data disk; backups go to `/var/backups/unite` on the OS disk, so one disk failing doesn't take both.

**Packages, user and code** (same as DEPLOY.md step 3, but the MySQL *client* instead of the server):

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx mysql-client git rsync certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt -y install nodejs
sudo useradd --system --home-dir /var/lib/unite --shell /usr/sbin/nologin unite
sudo mkdir -p /var/lib/unite/uploads /opt/unite && sudo chown -R unite:unite /var/lib/unite /opt/unite
sudo -u unite git clone https://github.com/Venkatesh-C-R/unite-student-network.git /opt/unite
```

**Database and app user.** Connect with the admin account (it asks for the admin password), then create a separate user for the app with access to the `unite` database only:

```bash
mysql -h unite-db-psg.mysql.database.azure.com -u uniteadmin -p --ssl-mode=REQUIRED
```

```sql
CREATE DATABASE unite CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'unite'@'%' IDENTIFIED BY '<a long random password>';
GRANT ALL ON unite.* TO 'unite'@'%';
EXIT;
```

For the backup script, put the app login in `/root/.my.cnf`:

```bash
sudo install -m 600 /dev/null /root/.my.cnf && sudo nano /root/.my.cnf
```

```ini
[client]
host=unite-db-psg.mysql.database.azure.com
user=unite
password=<the app password>
ssl-mode=REQUIRED
```

## 5. Get an address

Point a name at the VM's public IP: a college subdomain (`unite.psgtech.ac.in`, ask IT for an `A` record) or a free DuckDNS name (`unitepsg.duckdns.org`). See DEPLOY.md step 4.

## 6. Install and start UNITE

Follow **DEPLOY.md steps 5 and 6** exactly, with these `.env` differences:

```ini
APP_ORIGIN=https://<your address>
DB_HOST=unite-db-psg.mysql.database.azure.com
DB_PORT=3306
DB_USER=unite
DB_PASSWORD=<the app password>
DB_NAME=unite
DB_SSL=true
UPLOAD_DIR=/var/lib/unite/uploads
```

Use your address instead of `unite.psgtech.ac.in` in the nginx and certbot commands. Keep `.env` mode 600, never commit it, never put a secret in a `VITE_` variable, and run the "no secret is public" checks at the end of DEPLOY.md step 6.

## 7. Backups

- **Database:** Azure backs it up automatically and keeps 7 days (restore from the portal: database → **Backup and restore**).
- **Uploads (and a second copy of the database):** use the same nightly script as DEPLOY.md step 7. It keeps 14 days and shares unchanged files between days, so it uses about the space of one copy.
- **Off the server:** copy a backup to another machine now and then, e.g. `scp -r azureuser@<IP>:/var/backups/unite ./unite-backup`.

## 8. Updating, watching, and the end of the year

- **Updating:** DEPLOY.md step 8.
- **Watch:** `df -h` (disks), `free -h` (memory), `journalctl -u unite-api` (errors), and the credit in Cost Management.
- **Too slow?** VM → **Size** → **B2s**. Takes a few minutes of downtime and uses the credit faster.
- **Before the 12 months end** (or when you graduate), move UNITE to a college server or Oracle: dump the database (`mysqldump`), copy `/var/lib/unite/uploads`, and follow DEPLOY.md there. Then delete the resource group `unite-rg` so nothing keeps running.
