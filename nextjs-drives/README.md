# Home Server Portal

This Next.js service is a stateless landing page and API gateway for home-server workloads. The TeslaMate drives UI remains available at `/drives`.

## Service registry

`HOME_SERVER_SERVICES` is a JSON array. Each item is both a landing-page entry and an allowlisted proxy target:

```json
[
  {
    "id": "teslamate",
    "name": "TeslaMate Drives",
    "description": "Drive history and metadata",
    "upstreamUrl": "http://teslamate:4000/api",
    "href": "/drives",
    "accent": "#d1495b"
  },
  {
    "id": "files",
    "name": "Files API",
    "description": "Private file service",
    "upstreamUrl": "http://files:8080",
    "accent": "#235789"
  }
]
```

Only IDs in this registry can be proxied, preventing the portal from becoming an open proxy. `upstreamUrl` is server-only and is never sent to the browser. `href` is optional; without it, the card opens the service through its proxy path.

All common request methods are forwarded at:

```text
/api/proxy/{service-id}/{upstream-path}?query=value
```

For example, `GET /api/proxy/files/v1/items` forwards to `http://files:8080/v1/items`. The existing `/api/drives` and `/api/tags` routes remain for UI compatibility.

## Authentication

The existing ngrok traffic policy performs Google OAuth before public requests reach this service. The only exception is the exact `/api/health-connect` path, which must remain usable by the Android background client and is protected by its own long random token. The portal intentionally adds no second authentication layer to other routes: direct LAN traffic is trusted, and `/api/health` remains available to local health checks. Do not expose port 3001 directly to the public internet; the public route should terminate at the ngrok endpoint.

## Two-node deployment

The container stores no sessions, uploads, configuration, or mutable data. To run it on both desktops:

1. Deploy the same image and the same `HOME_SERVER_SERVICES` and authentication environment values on each machine.
2. Ensure every configured upstream hostname is reachable from that machine's Docker network. A service that exists only on one desktop needs a LAN-reachable URL or its own replica.
3. Run an ngrok agent on each desktop using the same public endpoint URL and traffic policy, with `pooling_enabled: true` on both endpoint definitions. Endpoint pooling can then distribute requests across the two agents. Keep the OAuth policy at the edge as the single public authentication boundary.
4. Keep all durable data in cloud databases/object storage. Because the portal has no local state, either node can disappear without session migration.

This provides frontend redundancy, but the public hostname still depends on ngrok's edge and on at least one home internet connection. It does not make a single, non-replicated upstream service highly available.

## Local use

```bash
npm install
npm run dev
```

By default, the TeslaMate API is `http://localhost:4000/api`; override it with `TESLAMATE_API_URL`. For the production stack, run `docker compose up -d --build` from the repository root.

## Android Health Connect webhook

The portal accepts JSON from the open-source
[HC Webhook Android app](https://github.com/mcnaveen/health-connect-webhook) at:

```text
POST /api/health-connect?token=YOUR_RANDOM_TOKEN
```

Set a long random token in the repository root `.env` before rebuilding:

```dotenv
HEALTH_CONNECT_WEBHOOK_TOKEN=replace-with-a-long-random-value
```

The receiver validates HC Webhook's root payload shape, limits requests to 25 MB, and
stores each unique raw batch under `/app/data/health-connect` in the existing
`toggl-drive-automation` Docker volume. Identical retry payloads are acknowledged
without being stored twice. Saved batches and authenticated API responses include
record counts grouped by Health Connect `data_origin`, so Oura
(`com.ouraring.oura`), Eight Sleep, Hevy, and Stelo can be verified without
returning measurement values. The token-protected `GET` form reports the number,
time, and source counts for the latest received batch.

On Android, enable Health Connect sharing in each source app first. In HC Webhook,
grant only the Health Connect read permissions you need, add the webhook URL, and
choose interval or scheduled synchronization. Android blocks cleartext HTTP by
default, so use the dedicated HTTPS path on the existing ngrok endpoint:

```text
https://pruinose-concavely-natisha.ngrok-free.app/api/health-connect?token=YOUR_RANDOM_TOKEN
```

The ngrok policy bypasses Google OAuth only for the exact `/api/health-connect`
path; all other portal requests still require an approved Google identity. HC
Webhook does not support a custom authentication header, so the token is part of
the configured URL. Keep the token private and rotate it if it is exposed.

### Encrypted Google Drive backup

The `health-connect-backup` service mounts the shared data volume read-only and
uses `rclone copy` to append new JSON batches to the encrypted
`health-drive-crypt:` remote once per hour. Copy mode does not propagate local
deletions to Google Drive, and `--immutable` prevents an existing cloud object
from being overwritten with different content.

The ignored `.rclone/rclone.conf` file contains the Google OAuth refresh token and
the obscured keys used by the crypt remote. Keep this file private and back up its
encryption passwords separately; the uploaded filenames and file contents cannot
be recovered without them.

Rclone has announced that its shared Google OAuth client ID will stop working
during 2026. For uninterrupted long-term uploads, create a personal Google Drive
OAuth desktop client, add its `client_id` and `client_secret` to the
`health-drive` remote, and reconnect that remote:
<https://rclone.org/drive/#making-your-own-client-id>.

Override the interval in the root `.env` if needed:

```dotenv
HEALTH_BACKUP_INTERVAL_SECONDS=3600
```

After the one-time Google authorization, verify the service with:

```bash
docker compose ps health-connect-backup
docker compose logs --tail 100 health-connect-backup
```

## Toggl drive documentation worker

The production Compose stack includes a local `toggl-drive-worker`. It checks completed drives every 48 hours and only changes drives whose notes and tags are both empty. Each run makes exactly one Toggl API request. Runs alternate between the newest undocumented month and one older backfill month, using about 15 requests per month while gradually covering history.

A Toggl time entry must first overlap a drive by at least 60 seconds. All overlap candidates in the run are then sent together to the Codex SDK using `gpt-5.6-luna` at low reasoning effort. Codex checks whether the activity label plausibly implies travel; it receives timestamps and Toggl labels, but no drive addresses or coordinates. Only accepted candidates add a readable `Toggl:` note plus the `toggl`, project, and Toggl tags that are available. If Codex authentication or structured output validation fails, the run makes no drive edits.

Set the token in the repository root `.env` (do not commit it):

```dotenv
TOGGL_API_TOKEN=your_profile_api_token
TOGGL_SYNC_INTERVAL_SECONDS=172800
TOGGL_MIN_OVERLAP_SECONDS=60
CODEX_CLASSIFIER_MODEL=gpt-5.6-luna
```

On this Windows installation, Compose also mounts `C:\Users\rongd\toggl_api_key.txt` read-only at `/run/secrets/toggl_api_key`. The worker prefers `TOGGL_API_TOKEN` when it is set and otherwise reads that mounted file, keeping the token out of the repository and container environment.

Codex uses this machine's existing ChatGPT subscription sign-in. Compose mounts only `C:\Users\rongd\.codex\auth.json` read-only into the worker; no OpenAI API key or usage-billed API account is required. The worker makes no Codex request when a Toggl month has no timestamp-overlap candidates, and batches all candidates into one request otherwise.

Rebuild with `docker compose up -d --build`. On the `/drives` page, drives whose notes and tags were added by the worker show a small Toggl clock icon in the existing row editor. Notes and tags remain editable in place. The underlying audit data is kept in the `toggl-drive-automation` Docker volume.
