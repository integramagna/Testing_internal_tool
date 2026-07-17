# Task Buddy v2

Internal task-update tool for Integra Magna. A cartoon character walks onto
each person's screen at scheduled times, asks for their work update, and
routes it to their team lead. The server (Payload CMS 3 + Next.js, this repo
root) is the source of truth; the desktop app (`desktop/`) is a "dumb"
Electron client that only renders what the server tells it to.

## Server setup

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — Postgres connection string (Neon in production)
   - `PAYLOAD_SECRET` — Payload's session/encryption secret
   - `DEVICE_TOKEN_SECRET` — signs the desktop app's device JWTs
   - `CRON_SECRET` — bearer token required by `POST /api/cron/tick`
   - `GEMINI_API_KEY` — used by `POST /api/task/parse`
3. `pnpm dev` — starts Next.js/Payload at `http://localhost:3000`. In
   non-production `NODE_ENV`, a `node-cron` job (see `src/instrumentation.ts`)
   automatically hits `/api/cron/tick` every minute so the scheduler runs
   without any external cron setup.
4. `pnpm seed` — creates 4 departments, 3 slots (12:00/15:00/17:30 IST,
   Mon–Sat), one admin, and 3 demo users in Development with pairing codes
   printed to the console. Admin credentials default to
   `admin@integramagna.com` / `change-me-now`; override with
   `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars before seeding, or
   change them from inside the CMS afterward.

### Testing

- `pnpm test:int` — Vitest: unit tests for IST time/slot math, the
  scheduler's report-trigger logic, and `parseWithFallback()`'s model
  fallback chain (all mocked, no live Gemini calls), plus the existing
  Payload integration test.
- `pnpm test:e2e` — Playwright admin/frontend smoke tests.
- Set `TEST_MODE=true` when starting the server to compress a full day's
  scheduler cycle down to a few minutes for manual end-to-end testing:
  slots open on every tick instead of at their configured time, and the
  report cutoff/escalation window shrinks to a few minutes. Never set this
  in production.

## Desktop app setup

```
pnpm --filter desktop install
pnpm --filter desktop start          # dev, defaults to http://localhost:3000
```

`SERVER_URL` is baked into the app **at build time**, not read from the end
user's environment — see `desktop/scripts/generate-config.js`. To point a
build at a different server:

```
SERVER_URL=https://taskbuddy.integramagna.com pnpm --filter desktop build:win
```

Dev and packaged builds use separate app names and `userData` folders
(`TaskBuddy-dev` vs `TaskBuddy`) so running both at once never collides.

### Building installers

- Windows: `pnpm --filter desktop build:win` → NSIS installer in
  `desktop/dist/`.
- macOS: built via the `.github/workflows/build-mac.yml` GitHub Actions
  workflow on `macos-latest` (Windows can't cross-build a signed `.dmg`).
  Set a `SERVER_URL` repository variable before running it. The workflow
  uploads the `.dmg` as a build artifact — it does not publish a GitHub
  release (`"publish": null` in `desktop/package.json`'s electron-builder
  config keeps CI from attempting that).

## Deployment (Coolify)

- Server: build the root `Dockerfile` (Next.js standalone output) and
  deploy on Coolify. Set the 5 env vars above from the Coolify UI —
  never commit them.
- **Scheduler**: add a Coolify cron job that runs every minute:
  ```
  curl -X POST https://<your-domain>/api/cron/tick \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  This replaces the `node-cron` dev fallback, which is disabled whenever
  `NODE_ENV=production`.
- Desktop installers are built and distributed separately (see above) —
  they are not part of the server deployment.
