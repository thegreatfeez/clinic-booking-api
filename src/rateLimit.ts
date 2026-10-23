import pool from "./db.js";

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 5;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

export async function consumeBookingAttempt(email: string): Promise<RateLimitResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);

    const { rows } = await client.query<{ count: number; retry_after: number | null }>(
      `SELECT
         COUNT(*)::int AS count,
         CEIL(EXTRACT(EPOCH FROM (MIN(attempted_at) + interval '1 minute' - NOW())))::int
           AS retry_after
       FROM (
         SELECT attempted_at
         FROM booking_attempts
         WHERE email = $1 AND attempted_at > NOW() - interval '1 minute'
         ORDER BY attempted_at DESC
         LIMIT $2
       ) recent`,
      [email, MAX_ATTEMPTS]
    );

    const row = rows[0];

    if (!row || row.count >= MAX_ATTEMPTS) {
      await client.query("ROLLBACK");
      return {
        allowed: false,
        retryAfter: Math.max(1, row?.retry_after ?? WINDOW_SECONDS)
      };
    }

    await client.query("INSERT INTO booking_attempts (email) VALUES ($1)", [email]);
    await client.query("COMMIT");

    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
