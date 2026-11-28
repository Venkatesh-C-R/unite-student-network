#!/usr/bin/env bash
# Nightly backup of the UNITE database and uploaded files, keeping the last 14 days.
# Install: sudo cp deploy/backup.sh /usr/local/bin/unite-backup && sudo chmod 700 /usr/local/bin/unite-backup
# Schedule (as root, crontab -e):   30 2 * * * /usr/local/bin/unite-backup
# MySQL login comes from /root/.my.cnf (see DEPLOY.md or DEPLOY-AZURE.md), so no password appears here.
#
# Uploads are backed up as one folder per day. A file that has not changed since the day before is
# not copied again: rsync hard-links it to yesterday's copy. So 14 days of backups take about the
# space of one copy plus the files added in those 14 days (photos and PDFs do not compress, so
# 14 full copies would need 14 times the space).
#
# Restore uploads:  sudo rsync -a /var/backups/unite/uploads/<YYYY-MM-DD>/ /var/lib/unite/uploads/
# Restore database: gunzip -c /var/backups/unite/unite-db-<YYYY-MM-DD>.sql.gz | sudo mysql unite
set -euo pipefail

DEST=${UNITE_BACKUP_DIR:-/var/backups/unite}
SRC=${UNITE_UPLOAD_DIR:-/var/lib/unite/uploads}
KEEP=15 # today plus the 14 days before
STAMP=$(date +%Y-%m-%d)
mkdir -p "$DEST/uploads"
chmod 700 "$DEST"

# Database (small, so a full compressed dump each night)
mysqldump --single-transaction --routines --triggers --no-tablespaces unite | gzip > "$DEST/unite-db-$STAMP.sql.gz"
ls -1 "$DEST"/unite-db-*.sql.gz | sort | head -n -"$KEEP" | xargs -r rm -f

# Uploads: today's folder, sharing unchanged files with the latest earlier one
SNAP="$DEST/uploads/$STAMP"
PREV=$(ls -1d "$DEST"/uploads/20??-??-?? 2>/dev/null | grep -v "/$STAMP\$" | sort | tail -n 1 || true)
if [ -n "$PREV" ]; then
  rsync -a --delete --link-dest="$PREV" "$SRC/" "$SNAP/"
else
  rsync -a --delete "$SRC/" "$SNAP/"
fi
ls -1d "$DEST"/uploads/20??-??-?? | sort | head -n -"$KEEP" | xargs -r rm -rf

echo "UNITE backup done: $DEST ($STAMP), uploads use $(du -sh "$DEST/uploads" | cut -f1) for all days"
