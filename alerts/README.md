# TeslaMate Alerts

This sidecar checks for TeslaMate collection failure modes that are visible from
the app and database:

- a recent open drive that has stopped receiving position rows
- an online car whose latest position row is stale
- TeslaMate's web UI reporting `Health check failed`

Notifications are sent to `ALERT_NTFY_URL` and/or `ALERT_WEBHOOK_URL`.

Current thresholds are configured in `docker-compose.yaml`:

- `CHECK_INTERVAL_SECONDS=300`
- `STALE_OPEN_DRIVE_MINUTES=15`
- `STALE_ONLINE_POSITION_MINUTES=180`
- `ALERT_REPEAT_SECONDS=3600`

To receive ntfy push notifications, install the ntfy app or open the ntfy web
client and subscribe to the topic configured in `ALERT_NTFY_URL`.
