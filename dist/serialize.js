export function toSlot(row) {
    return {
        id: row.id,
        provider: row.provider,
        start: new Date(row.start_time).toISOString(),
        end: new Date(row.end_time).toISOString(),
        available: row.available
    };
}
export function toBooking(row) {
    return {
        id: row.id,
        slot_id: row.slot_id,
        name: row.name,
        email: row.email,
        status: row.status,
        created_at: new Date(row.created_at).toISOString()
    };
}
//# sourceMappingURL=serialize.js.map