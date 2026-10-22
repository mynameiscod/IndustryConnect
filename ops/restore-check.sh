#!/usr/bin/env bash
set -euo pipefail
umask 077
archive=${1:?Pass a completed encrypted backup archive}
case "$(readlink -f "$archive")" in /opt/industryconnect/backups/industryconnect-*.archive.gpg) ;; *) echo 'Unexpected archive location'; exit 1;; esac
sha256sum --check "$archive.sha256"
configuration=${archive%.archive.gpg}.config.tar.gpg
sha256sum --check "$configuration.sha256"
container=industryconnect-restore-check
if docker container inspect "$container" >/dev/null 2>&1; then echo 'Restore-check container already exists; inspect it first'; exit 1; fi
work=$(mktemp -d /opt/industryconnect/backups/restore-check.XXXXXX)
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; rm -f "$work/source.json" "$work/restored.json" "$work/config-files.txt"; rmdir "$work"; }
trap cleanup EXIT
gpg --batch --pinentry-mode loopback --passphrase-file /opt/industryconnect/secrets/backup-passphrase --decrypt "$configuration" | tar -tzf - > "$work/config-files.txt"
for required in app.env compose.env mongo-key; do grep -qx "./$required" "$work/config-files.txt"; done
docker run -d --name "$container" --label industryconnect.restore-check=true --network none mongo:7.0 mongod --bind_ip 127.0.0.1 --replSet restorecheck >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$container" mongosh --quiet --eval 'db.adminCommand("ping").ok' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" mongosh --quiet --eval 'rs.initiate({_id:"restorecheck",members:[{_id:0,host:"127.0.0.1:27017"}]})' >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$container" mongosh --quiet --eval 'if(!db.hello().isWritablePrimary)quit(1)' >/dev/null 2>&1; then break; fi
  sleep 1
done
gpg --batch --pinentry-mode loopback --passphrase-file /opt/industryconnect/secrets/backup-passphrase --decrypt "$archive" \
  | docker exec -i "$container" mongorestore --archive --gzip --oplogReplay >/dev/null
script_dir=$(dirname "$(readlink -f "$0")")
docker cp "$script_dir/restore-counts.js" industryconnect-mongo-1:/tmp/ic-restore-counts.js >/dev/null
docker cp "$script_dir/restore-counts.js" "$container":/tmp/ic-restore-counts.js >/dev/null
docker exec industryconnect-mongo-1 sh -c 'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin /tmp/ic-restore-counts.js' > "$work/source.json"
docker exec "$container" mongosh --quiet /tmp/ic-restore-counts.js > "$work/restored.json"
if ! cmp -s "$work/source.json" "$work/restored.json"; then echo 'Restore comparison differs from current source; inspect possible concurrent writes'; exit 1; fi
printf '{"restoredAt":"%s","result":"pass","checks":["encrypted archive checksum","isolated no-network restore","application collection counts","ledger totals"]}\n' "$(date -u +%FT%TZ)" > /opt/industryconnect/backups/restore-last.json
printf 'Isolated restore check passed; application collection counts and ledger totals match.\n'
