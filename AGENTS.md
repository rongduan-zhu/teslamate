# Agent Notes

## Local Drives Frontend Verification

- Rebuild and relaunch the production TeslaMate container and compose stack with `docker compose up -d --build`.
- Verify services with `docker compose ps`; the drives frontend should be available at `http://localhost:3001` and Phoenix at `http://localhost:4000`.
- Check the paginated proxy API before UI verification, for example:
  - `http://localhost:3001/api/drives?page=1&perPage=5`
  - `http://localhost:3001/api/drives?page=1&perPage=3&car=Iron%20Woman`
- Use the Browser plugin to visit `http://localhost:3001` and confirm the page title is `TeslaMate Drives`, no Next.js runtime error is visible, the car filter is present, and scrolling loads additional drive rows.
- Use Computer Use only for a passive visual check when available; stop if the helper cannot verify the current browser URL or policy state.
