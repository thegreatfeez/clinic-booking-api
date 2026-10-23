import { Router } from "express";
import pool from "../db.js";
import { requireApiKey } from "../middleware/apiKey.js";
import { toSlot } from "../serialize.js";

const router = Router();

interface ResetSlot {
  id: string;
  provider: string;
  start: string;
  end: string;
}

function parseResetSlots(body: unknown): ResetSlot[] | string {
  const slots = (body as { slots?: unknown } | null)?.slots;

  if (!Array.isArray(slots)) {
    return "slots must be an array";
  }

  const seen = new Set<string>();
  const parsed: ResetSlot[] = [];

  for (const raw of slots) {
    const slot = raw as Partial<ResetSlot> | null;

    if (
      !slot ||
      typeof slot.id !== "string" ||
      slot.id.trim() === "" ||
      typeof slot.provider !== "string" ||
      slot.provider.trim() === "" ||
      typeof slot.start !== "string" ||
      typeof slot.end !== "string"
    ) {
      return "each slot needs id, provider, start and end";
    }

    const start = Date.parse(slot.start);
    const end = Date.parse(slot.end);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      return "start and end must be valid dates";
    }

    if (end <= start) {
      return "end must be after start";
    }

    if (seen.has(slot.id)) {
      return "slot ids must be unique";
    }

    seen.add(slot.id);
    parsed.push({ id: slot.id, provider: slot.provider, start: slot.start, end: slot.end });
  }

  return parsed;
}

router.post("/reset", requireApiKey, async (req, res) => {
  const slots = parseResetSlots(req.body);

  if (typeof slots === "string") {
    return res.status(400).json({ error: slots });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM idempotency_keys");
    await client.query("DELETE FROM booking_attempts");
    await client.query("DELETE FROM bookings");
    await client.query("DELETE FROM slots");

    for (const slot of slots) {
      await client.query(
        "INSERT INTO slots (id, provider, start_time, end_time) VALUES ($1, $2, $3, $4)",
        [slot.id, slot.provider, slot.start, slot.end]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json({ ok: true });
});

router.get("/slots", requireApiKey, async (req, res) => {
  const provider = typeof req.query.provider === "string" ? req.query.provider : null;

  const { rows } = await pool.query(
    `SELECT
       s.id,
       s.provider,
       s.start_time,
       s.end_time,
       NOT EXISTS (
         SELECT 1
         FROM bookings b
         WHERE b.slot_id = s.id AND b.status = 'confirmed'
       ) AS available
     FROM slots s
     WHERE ($1::text IS NULL OR s.provider = $1)
     ORDER BY s.start_time, s.id`,
    [provider]
  );

  res.json({ slots: rows.map(toSlot) });
});

export default router;
