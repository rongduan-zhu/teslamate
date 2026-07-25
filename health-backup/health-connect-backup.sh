#!/bin/sh
set -u

config="${HEALTH_BACKUP_CONFIG:-/config/rclone/rclone.conf}"
health_connect_source="${HEALTH_BACKUP_SOURCE:-/data/health-connect}"
oura_source="${OURA_BACKUP_SOURCE:-/data/oura/records}"
remote="${HEALTH_BACKUP_REMOTE:-health-drive-crypt:}"
interval="${HEALTH_BACKUP_INTERVAL_SECONDS:-3600}"
success_marker="/tmp/health-backup-last-success"

case "$interval" in
  *[!0-9]*|"") interval=3600 ;;
esac

if [ "$interval" -lt 300 ]; then
  interval=300
fi

run_backup() {
  if [ ! -s "$config" ]; then
    echo "Health backup is waiting for Google Drive authorization."
    rm -f "$success_marker"
    return 1
  fi

  if ! rclone listremotes --config "$config" | grep -Fxq "$remote"; then
    echo "Health backup remote $remote is not configured yet."
    rm -f "$success_marker"
    return 1
  fi

  if rclone copy "$health_connect_source" "$remote" \
    --config "$config" \
    --include "*.json" \
    --immutable \
    --checkers 4 \
    --transfers 2 \
    --log-level INFO &&
    { [ ! -d "$oura_source" ] || rclone copy "$oura_source" "${remote%:}:oura" \
      --config "$config" \
      --include "*.json" \
      --immutable \
      --checkers 4 \
      --transfers 2 \
      --log-level INFO; }; then
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$success_marker"
    echo "Health backup completed successfully."
    return 0
  fi

  rm -f "$success_marker"
  echo "Health backup failed; it will retry after ${interval}s."
  return 1
}

while true; do
  run_backup || true
  sleep "$interval"
done
