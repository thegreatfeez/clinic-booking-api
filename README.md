# Koya Clinic — booking API and web page

Clinic booking API (Express + Postgres) and the React page that uses it.

## Endpoints

All requests need the `X-API-Key` header. Errors are `{ "error": "..." }`.

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

Generate a key with `openssl rand -hex 32`. The React page runs against the API with:

```bash
npm run build               # builds client/dist
# then open http://localhost:3000

# or for hot reload:
npm --prefix client run dev # http://localhost:5173, proxied to the API
```

The browser bundle embeds `API_KEY` at build time (`client/vite.config.ts`), so rebuild after changing it.

## Test

With the server running:

```bash
npm run check
```

This exercises every level: auth, validation, a 20-way race for one slot, cancellation, idempotent replays, pagination and rate limiting.

## Deploy (Render)

1. Push the repository to GitHub.
2. In Render: **New → Web Service**, connect the repo. `render.yaml` already defines the build and start commands.
3. Set environment variables:
   - `DATABASE_URL` — the Neon connection string (same as local)
   - `API_KEY` — the key you generated
4. Deploy. Render runs `npm install && npm run build` (which builds the React page) and starts with `npm start`.
5. Check `https://<your-url>/health`, then send the deployed URL and `API_KEY` with your submission.

Any host works the same way: build the client, run `npm start`, provide both variables, and point `DATABASE_URL` at a Postgres database that has `schema.sql` applied (`npm run db:init` once).

## Layout

```
src/
  app.ts              Express app, static client, error handler
  server.ts           entry point
  db.ts               pg pool
  serialize.ts        DB row -> API JSON shapes
  rateLimit.ts        per-email attempt window
  middleware/apiKey.ts
  routes/slots.ts     /reset, /slots
  routes/bookings.ts  /bookings
client/               React + Vite page (built to client/dist)
schema.sql            tables and indexes
scripts/check.ts      end-to-end checks
```
