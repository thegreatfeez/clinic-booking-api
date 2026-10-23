import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import pool from "../db.js";
import { requireApiKey } from "../middleware/apiKey.js";
import { consumeBookingAttempt } from "../rateLimit.js";
import { toBooking } from "../serialize.js";
import type { BookingRow } from "../serialize.js";

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

interface BookingInput {
  slot_id: string;
  name: string;
  email: string;
}

interface Cursor {
  created_at: string;
  id: string;
}

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

function parseBookingInput(body: unknown): BookingInput | string {
  const input = (body ?? {}) as { slot_id?: unknown; name?: unknown; email?: unknown };

  if (typeof input.slot_id !== "string" || input.slot_id.trim() === "") {
    return "slot_id is required";
  }

  if (typeof input.name !== "string" || input.name.trim() === "") {
    return "name is required";
  }

  if (typeof input.email !== "string" || input.email.trim() === "") {
    return "email is required";
  }

  const email = input.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    return "email is invalid";
  }

  return {
    slot_id: input.slot_id,
    name: input.name.trim(),
    email
  };
}

function requestHash(input: BookingInput): string {
  return createHash("sha256")
    .update(`${input.slot_id}\n${input.name}\n${input.email}`)
    .digest("hex");
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Cursor>;

    if (
      typeof parsed.created_at !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(Date.parse(parsed.created_at))
    ) {
      return null;
    }

    return { created_at: parsed.created_at, id: parsed.id };
  } catch {
    return null;
  }
}

router.post("/bookings", requireApiKey, async (req, res) => {
  const body = (req.body ?? {}) as { email?: unknown };
  const submittedEmail =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  const input = parseBookingInput(req.body);

  if (typeof input === "string") {
    if (submittedEmail !== "") {
      const limit = await consumeBookingAttempt(submittedEmail);

      if (!limit.allowed) {
        res.set("Retry-After", String(limit.retryAfter));
        return res.status(429).json({ error: "too many booking attempts" });
      }
    }

    return res.status(400).json({ error: input });
  }

  const idempotencyKey = req.get("Idempotency-Key");
  const hash = requestHash(input);

  if (idempotencyKey) {
    const { rows } = await pool.query(
      `SELECT request_hash, status_code, response_body
       FROM idempotency_keys
       WHERE key = $1 AND response_body IS NOT NULL`,
      [idempotencyKey]
    );

    if (rows[0]) {
      if (rows[0].request_hash !== hash) {
        return res.status(422).json({ error: "idempotency key reused with a different body" });
      }

      return res.status(rows[0].status_code).json(rows[0].response_body);
    }
  }

  const limit = await consumeBookingAttempt(input.email);

  if (!limit.allowed) {
    res.set("Retry-After", String(limit.retryAfter));
    return res.status(429).json({ error: "too many booking attempts" });
  }

  const slot = await pool.query<{ start_time: Date }>(
    "SELECT start_time FROM slots WHERE id = $1",
    [input.slot_id]
  );

  if (!slot.rows[0]) {
    return res.status(404).json({ error: "slot not found" });
  }

  if (new Date(slot.rows[0].start_time).getTime() <= Date.now()) {
    return res.status(400).json({ error: "slot has already started" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let reserved = false;

    if (idempotencyKey) {
      const reservation = await client.query(
        `INSERT INTO idempotency_keys (key, request_hash)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING
         RETURNING key`,
        [idempotencyKey, hash]
      );

      if (reservation.rowCount === 0) {
        const existing = await client.query<{
          request_hash: string;
          status_code: number | null;
          response_body: unknown;
        }>(
          `SELECT request_hash, status_code, response_body
           FROM idempotency_keys
           WHERE key = $1
           FOR UPDATE`,
          [idempotencyKey]
        );

        const row = existing.rows[0];

        if (!row || row.request_hash !== hash) {
          await client.query("ROLLBACK");
          return res
            .status(422)
            .json({ error: "idempotency key reused with a different body" });
        }

        if (row.response_body !== null) {
          await client.query("ROLLBACK");
          return res.status(row.status_code ?? 201).json(row.response_body);
        }
      } else {
        reserved = true;
      }
    }

    let status = 201;
    let payload: Record<string, unknown> | ReturnType<typeof toBooking>;

    await client.query("SAVEPOINT book");

    try {
      const { rows } = await client.query<BookingRow>(
        `INSERT INTO bookings (id, slot_id, name, email, status)
         VALUES ($1, $2, $3, $4, 'confirmed')
         RETURNING id, slot_id, name, email, status, created_at`,
        [randomUUID(), input.slot_id, input.name, input.email]
      );

      payload = toBooking(rows[0] as BookingRow);
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT book");

      const code = pgCode(err);

      if (code === "23503") {
        status = 404;
        payload = { error: "slot not found" };
      } else if (code === "23505") {
        status = 409;
        payload = { error: "slot already booked" };
      } else {
        throw err;
      }
    }

    if (idempotencyKey && reserved) {
      await client.query(
        `UPDATE idempotency_keys
         SET status_code = $2, response_body = $3
         WHERE key = $1`,
        [idempotencyKey, status, JSON.stringify(payload)]
      );
    }

    await client.query("COMMIT");

    return res.status(status).json(payload);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.get("/bookings", requireApiKey, async (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";

  if (email === "") {
    return res.status(400).json({ error: "email is required" });
  }

  let limit = DEFAULT_PAGE_SIZE;

  if (req.query.limit !== undefined) {
    const raw = typeof req.query.limit === "string" ? req.query.limit : "";

    if (!/^\d+$/.test(raw)) {
      return res.status(400).json({ error: "limit must be an integer between 1 and 50" });
    }

    limit = Number(raw);

    if (limit < 1 || limit > MAX_PAGE_SIZE) {
      return res.status(400).json({ error: "limit must be an integer between 1 and 50" });
    }
  }

  let cursor: Cursor | null = null;

  if (req.query.cursor !== undefined) {
    const raw = typeof req.query.cursor === "string" ? req.query.cursor : "";
    cursor = raw === "" ? null : decodeCursor(raw);

    if (req.query.cursor !== "" && cursor === null) {
      return res.status(400).json({ error: "invalid cursor" });
    }
  }

  const { rows } = await pool.query<BookingRow>(
    `SELECT id, slot_id, name, email, status, created_at
     FROM bookings
     WHERE LOWER(email) = LOWER($1)
       AND ($2::timestamptz IS NULL OR (created_at, id) > ($2::timestamptz, $3::text))
     ORDER BY created_at, id
     LIMIT $4`,
    [email, cursor?.created_at ?? null, cursor?.id ?? null, limit + 1]
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  res.json({
    bookings: page.map(toBooking),
    next_cursor:
      hasMore && last
        ? encodeCursor({ created_at: new Date(last.created_at).toISOString(), id: last.id })
        : null
  });
});

router.get("/bookings/:id", requireApiKey, async (req, res) => {
  const { rows } = await pool.query<BookingRow>(
    `SELECT id, slot_id, name, email, status, created_at
     FROM bookings
     WHERE id = $1`,
    [req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: "booking not found" });
  }

  res.json(toBooking(rows[0]));
});

router.delete("/bookings/:id", requireApiKey, async (req, res) => {
  const { rows } = await pool.query<BookingRow>(
    `UPDATE bookings
     SET status = 'cancelled'
     WHERE id = $1 AND status = 'confirmed'
     RETURNING id, slot_id, name, email, status, created_at`,
    [req.params.id]
  );

  if (rows[0]) {
    return res.json(toBooking(rows[0]));
  }

  const existing = await pool.query<{ status: string }>(
    "SELECT status FROM bookings WHERE id = $1",
    [req.params.id]
  );

  if (!existing.rows[0]) {
    return res.status(404).json({ error: "booking not found" });
  }

  return res.status(409).json({ error: "booking already cancelled" });
});

export default router;
