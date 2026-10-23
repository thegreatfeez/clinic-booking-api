export interface SlotRow {
  id: string;
  provider: string;
  start_time: Date;
  end_time: Date;
  available: boolean;
}

export interface SlotShape {
  id: string;
  provider: string;
  start: string;
  end: string;
  available: boolean;
}

export function toSlot(row: SlotRow): SlotShape {
  return {
    id: row.id,
    provider: row.provider,
    start: new Date(row.start_time).toISOString(),
    end: new Date(row.end_time).toISOString(),
    available: row.available
  };
}

export interface BookingRow {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: Date;
}

export interface BookingShape {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

export function toBooking(row: BookingRow): BookingShape {
  return {
    id: row.id,
    slot_id: row.slot_id,
    name: row.name,
    email: row.email,
    status: row.status,
    created_at: new Date(row.created_at).toISOString()
  };
}
