# Next.js drives-only rewrite

This folder contains a focused Next.js rewrite of TeslaMate that keeps only drive-management capabilities:

- List drives (`GET /api/drives`)
- Update notes and tags (`PATCH /api/drives/:id`)

## Run

```bash
npm install
npm run dev
```

By default, the Next.js server proxies drive requests to the Phoenix API at
`http://localhost:4000/api`. Set `TESLAMATE_API_URL` when the Elixir server is
available somewhere else.

## Test

```bash
npm test
```
