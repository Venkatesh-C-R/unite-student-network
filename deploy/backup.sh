#!/usr/bin/env bash
# Nightly backup of the UNITE database and uploaded files, keeping the last 14 days.
# Install: sudo cp deploy/backup.sh /usr/local/bin/unite-backup && sudo chmod 700 /usr/local/bin/unite-backup
# Schedule (as root, crontab -e):   30 2 * * * /usr/local/bin/unite-backup
# MySQL login comes from /root/.my.cnf (see DEPLOY.md), so no password appears here.
set -euo pipefail

DEST=/var/backups/unite
STAMP=$(date +%Y-%m-%d)
mkdir -p "$DEST"
chmod 700 "$DEST"

mysqldump --single-transaction --routines --triggers unite | gzip > "$DEST/unite-db-$STAMP.sql.gz"
tar -czf "$DEST/unite-uploads-$STAMP.tar.gz" -C /var/lib/unite uploads

find "$DEST" -name 'unite-*' -mtime +14 -delete
echo "UNITE backup done: $DEST ($STAMP)"
