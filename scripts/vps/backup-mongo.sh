#!/usr/bin/env bash
# Sao lưu MongoDB trên VPS — chạy hằng ngày bằng cron (xem scripts/vps/README.md).
# Giữ các bản trong KEEP_DAYS ngày gần nhất; nếu đặt RCLONE_REMOTE thì đẩy
# thêm 1 bản ra ngoài VPS (Google Drive, R2...) — VPS hỏng vẫn còn dữ liệu.
#
# Cấu hình đọc từ /etc/mongo-backup.env (chmod 600, chỉ root đọc được):
#   BACKUP_URI="mongodb://backup:MATKHAU@127.0.0.1:27017/?authSource=admin"
#   DB_NAME="listening_app"          # tuỳ chọn
#   BACKUP_DIR="/var/backups/mongo"  # tuỳ chọn
#   KEEP_DAYS="14"                   # tuỳ chọn
#   RCLONE_REMOTE="gdrive:mongo-backups"  # tuỳ chọn, cần cài + cấu hình rclone
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/mongo-backup.env}"
# shellcheck disable=SC1090
source "$ENV_FILE"

DB_NAME="${DB_NAME:-listening_app}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mongo}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
FILE="$BACKUP_DIR/${DB_NAME}-$(date +%F-%H%M).archive.gz"

mongodump --uri="$BACKUP_URI" --db="$DB_NAME" --archive="$FILE" --gzip --quiet

# File rỗng/hỏng thì báo lỗi ngay (cron sẽ ghi vào log).
if [ ! -s "$FILE" ] || ! gzip -t "$FILE" 2>/dev/null; then
  echo "$(date -Is) BACKUP FAILED: $FILE is empty or corrupt" >&2
  exit 1
fi

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$FILE" "$RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -name "${DB_NAME}-*.archive.gz" -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
