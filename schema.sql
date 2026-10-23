DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS booking_attempts;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS slots;

CREATE TABLE slots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  CONSTRAINT slots_end_after_start CHECK (end_time > start_time)
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_status_valid CHECK (status IN ('confirmed', 'cancelled'))
);

CREATE UNIQUE INDEX bookings_one_confirmed_per_slot
  ON bookings (slot_id)
  WHERE status = 'confirmed';

CREATE INDEX bookings_email_created_idx
  ON bookings (LOWER(email), created_at, id);

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  status_code INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX booking_attempts_email_time_idx
  ON booking_attempts (email, attempted_at DESC);
