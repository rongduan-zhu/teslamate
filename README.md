# Home Superapp

Private, Docker-based home services built around TeslaMate. The repository combines vehicle logging, a lightweight home portal, personal-data integrations, automations, alerts, and backups in one Compose stack.

## What is here

- **TeslaMate** - Tesla data collection and API, backed by PostgreSQL.
- **Home portal** (`nextjs-drives/`) - landing page, drive history, notes/tags, service proxying, Health Connect ingestion, and Oura integration.
- **Grafana** - TeslaMate dashboards and reporting.
- **Automations** - Toggl drive matching/classification and scheduled data jobs.
- **Operations** - stale-drive alerts, MQTT, encrypted health-data backups, and repair scripts.

## Main directories

- `nextjs-drives/` - Next.js portal, APIs, workers, tests, and Oura disclosures.
- `lib/`, `config/`, `assets/`, `priv/` - TeslaMate/Phoenix application.
- `alerts/` - TeslaMate health and stale-drive monitoring.
- `health-backup/` - scheduled rclone backup script.
- `grafana/` - dashboards and Grafana provisioning.
- `scripts/` - maintenance and repair utilities.

## Run locally

1. Copy `.env.example` to `.env` and provide the required private values.
2. Keep `.env`, `.rclone/`, auth files, and database backups out of Git.
3. Start the stack:

```powershell
docker compose up -d --build
docker compose ps
```

Key local endpoints:

- Home portal: <http://localhost:3001>
- TeslaMate: <http://localhost:4000>
- Grafana: <http://localhost:3000>

## Quick verification

```powershell
docker compose config --quiet
Invoke-WebRequest -UseBasicParsing "http://localhost:3001/api/drives?page=1&perPage=5"
Invoke-WebRequest -UseBasicParsing "http://localhost:3001/api/health"
```

For upstream TeslaMate behavior and configuration, see the [TeslaMate documentation](https://docs.teslamate.org/). TeslaMate remains MIT licensed; see `LICENSE`.
