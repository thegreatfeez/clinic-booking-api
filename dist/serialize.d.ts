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
export declare function toSlot(row: SlotRow): SlotShape;
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
export declare function toBooking(row: BookingRow): BookingShape;
//# sourceMappingURL=serialize.d.ts.map