#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir=/opt/industryconnect/backups
secret_dir=/opt/industryconnect/secrets
mkdir -p "$backup_dir"
test "$(readlink -f "$backup_dir")" = /opt/industryconnect/backups
chmod 700 "$backup_dir"
exec 9>/run/industryconnect-backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$backup_dir/industryconnect-$stamp.archive.gpg"
configuration="$backup_dir/industryconnect-$stamp.config.tar.gpg"
trap 'rm -f -- "$archive.partial" "$configuration.partial"' EXIT
docker exec industryconnect-mongo-1 sh -c 'exec mongodump --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --oplog --archive --gzip' \
  | gpg --batch --yes --pinentry-mode loopback --passphrase-file "$secret_dir/backup-passphrase" --symmetric --cipher-algo AES256 --compress-algo none --output "$archive.partial"
test -s "$archive.partial"
configuration_sources=()
if [ -d /opt/industryconnect/provider-config ]; then configuration_sources=(-C /opt/industryconnect/provider-config .); fi
tar -C "$secret_dir" --exclude=backup-passphrase --exclude='*.previous.env' --exclude=compose.next.env --exclude=test-logins.json --exclude='*.js' --exclude='*.mjs' -czf - . "${configuration_sources[@]}" \
  | gpg --batch --yes --pinentry-mode loopback --passphrase-file "$secret_dir/backup-passphrase" --symmetric --cipher-algo AES256 --compress-algo none --output "$configuration.partial"
test -s "$configuration.partial"
mv -- "$configuration.partial" "$configuration"
sha256sum "$configuration" > "$configuration.sha256"
mv -- "$archive.partial" "$archive"
sha256sum "$archive" > "$archive.sha256"
# Retain fourteen days of completed encrypted archives; unrelated files are untouched.
find "$backup_dir" -maxdepth 1 -type f -name 'industryconnect-*.archive.gpg' -mtime +14 -delete
find "$backup_dir" -maxdepth 1 -type f -name 'industryconnect-*.archive.gpg.sha256' -mtime +14 -delete
find "$backup_dir" -maxdepth 1 -type f -name 'industryconnect-*.config.tar.gpg' -mtime +14 -delete
find "$backup_dir" -maxdepth 1 -type f -name 'industryconnect-*.config.tar.gpg.sha256' -mtime +14 -delete
printf 'Encrypted IndustryConnect backup completed: %s\n' "$stamp"
