# Koya Clinic — booking API and web page

Clinic booking API (Express + Postgres) and the React page that uses it.

## Authentication policy

There are two ways to reach the same booking logic:

| Caller | Paths | Authentication |
| --- | --- | --- |
| API client / grader | `/reset`, `/slots`, `/bookings`, `/bookings/:id` | **`x-api-key` header required** on every request |
| Browser page | `/web/slots`, `/web/bookings`, `/web/bookings/:id` | Server-side bridge; the browser never sees a key |

- The key comes from the server environment variable `API_KEY`. It is compared with
  `crypto.timingSafeEqual`, never logged, and never included in the React bundle.
- A missing, empty, wrong, or unconfigured key returns `401` with
  `{ "error": "invalid or missing API key" }`.
- `GET /slots` **is protected** by design: the assignment requires the key on every API
  request, including reads.
- The browser page calls `/web/*`. Those routes live in the same Express process, where
  `webBridge` adds the key to the internal request. This avoids shipping a permanent
  shared secret to every visitor. `/web/reset` is blocked so the UI cannot wipe data.
- The `/web/*` routes are public in the same sense as any booking website: anyone who can
  open the page can view slots and book. `GET /web/bookings?email=` uses an email as the
  lookup key (the assignment's data model has no patient accounts). A production clinic
  would replace that with real user authentication.

If you send `GET /slots` without a header, the `401` is expected. Add:

```
x-api-key: <the value of API_KEY on the server>
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/reset` | Replace every slot (and clear bookings) |
| `GET` | `/slots` | List slots with `available`, optional `?provider=` |
| `POST` | `/bookings` | Book a slot; optional `Idempotency-Key` |
| `GET` | `/bookings?email=&limit=&cursor=` | A person's bookings, oldest first |
| `GET` | `/bookings/:id` | One booking |
| `DELETE` | `/bookings/:id` | Cancel a booking |

Behaviour by level:

- **Level 2** — API key on every request; booking fields validated; `name` trimmed and `email` stored lower case; past slots rejected.
- **Level 3** — a partial unique index (`bookings_one_confirmed_per_slot`) makes double booking impossible even under concurrent requests; cancelling frees the slot.
- **Level 4** — `Idempotency-Key` replays the stored response and never creates a second booking; the same key with a different body returns `422`. Booking lists use cursor pagination.
- **Level 5** — 5 booking attempts per email per minute, failed attempts included; the 6th returns `429` with `Retry-After`.

## Local setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and API_KEY
npm run db:init             # apply schema.sql and seed sample slots
npm run dev                 # API on http://localhost:3000
```

Generate a key with `openssl rand -hex 32`. Only the server reads it.

To run the React page:

```bash
npm run build               # compiles the server to dist/ and builds client/dist
# then open http://localhost:3000

# or for hot reload (the Vite proxy forwards /web to the API):
npm --prefix client run dev # http://localhost:5173
```

## Test

```bash
npm run test:auth      # missing / invalid / valid keys, bridge behaviour (no DB)
npm run typecheck
npm run build

npm run check          # integration checks against a running server
```

`npm run test:auth` uses a synthetic key and never touches the database. `npm run check`
talks to the running server (default `http://localhost:3000`), uses `API_KEY` from your
environment, **resets the slots and bookings**, and covers a 20-way race, cancellation,
idempotent replays, pagination and rate limiting.

## Deploy (Render)

1. Push the repository to GitHub.
2. In Render: **New → Web Service** (or Blueprint), connect the repo.
   - Build command: `npm install && npm run build`
   - Start command: `npm start` (runs `node dist/server.js`)
3. Set environment variables:
   - `DATABASE_URL` — the Neon connection string
   - `API_KEY` — the server-side API key
4. Deploy. The build compiles the API **and** the React page; `/` serves the page and
   `/health` reports the service status.
5. If `/slots` returns `401`, check that the request sends `x-api-key` and that Render has
   `API_KEY` set to exactly that value. The server logs a warning at startup when
   `API_KEY` is missing.

Any host works the same way: `npm run build`, `npm start`, provide both variables, and
point `DATABASE_URL` at a Postgres database that has `schema.sql` applied
(`npm run db:init` once).

### Security note

Older builds embedded the API key in the browser bundle. After switching to the `/web`
bridge, rotate `API_KEY` (GitHub/Render/local `.env`) so the previously published value
is no longer valid. `.env` and `client/dist/` are gitignored; only placeholders belong in
`.env.example`.

## Layout

```
src/
  app.ts                 Express app, /web bridge, static client, error handler
  server.ts              entry point
  db.ts                  pg pool
  serialize.ts           DB row -> API JSON shapes
  rateLimit.ts           per-email attempt window
  middleware/apiKey.ts   x-api-key check (timing-safe)
  middleware/webBridge.ts server-side key injection for browser requests
  routes/slots.ts        /reset, /slots
  routes/bookings.ts     /bookings
client/                  React + Vite page (built to client/dist)
schema.sql               tables and indexes
scripts/auth.test.ts     key and bridge tests (node:test)
scripts/check.ts         end-to-end checks
```
