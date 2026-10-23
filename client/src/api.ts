export interface Slot {
  id: string;
  provider: string;
  start: string;
  end: string;
  available: boolean;
}

export interface Booking {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

export interface NewBooking {
  slot_id: string;
  name: string;
  email: string;
}

export interface BookingPage {
  bookings: Booking[];
  next_cursor: string | null;
}

export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "The booking service rejected the request.";

    const retryAfter = Number(response.headers.get("Retry-After"));

    throw new ApiError(
      message,
      response.status,
      Number.isNaN(retryAfter) ? undefined : retryAfter
    );
  }

  return data as T;
}

export async function listSlots(signal?: AbortSignal): Promise<Slot[]> {
  const data = await request<{ slots: Slot[] }>("/web/slots", { signal });
  return data.slots;
}

export async function createBooking(input: NewBooking): Promise<Booking> {
  return request<Booking>("/web/bookings", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function listBookings(
  params: { email: string; cursor?: string; limit?: number },
  signal?: AbortSignal
): Promise<BookingPage> {
  const search = new URLSearchParams({
    email: params.email,
    limit: String(params.limit ?? 6)
  });

  if (params.cursor) {
    search.set("cursor", params.cursor);
  }

  return request<BookingPage>(`/web/bookings?${search.toString()}`, { signal });
}

export async function cancelBooking(id: string): Promise<Booking> {
  return request<Booking>(`/web/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
}
