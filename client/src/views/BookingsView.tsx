import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Booking, Slot } from "../api";
import { cancelBooking, listBookings } from "../api";
import { SearchIcon, TicketIcon } from "../components/Icons";
import { describeError } from "../lib/errors";
import { formatDayNumber, formatMonth, formatTime, formatWeekday } from "../lib/format";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface BookingsViewProps {
  slots: Slot[] | null;
  defaultEmail: string;
  onBook: () => void;
  onRefreshSlots: () => void;
}

type PageMode = "replace" | "append";

export default function BookingsView({
  slots,
  defaultEmail,
  onBook,
  onRefreshSlots
}: BookingsViewProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const requestId = useRef(0);
  const autoRan = useRef(false);

  const slotById = useMemo(
    () => new Map((slots ?? []).map((slot) => [slot.id, slot])),
    [slots]
  );

  async function runSearch(
    targetEmail: string,
    cursor: string | undefined,
    mode: PageMode
  ): Promise<void> {
    const id = requestId.current + 1;
    requestId.current = id;

    if (mode === "append") {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setBookings(null);
      setNextCursor(null);
    }

    setError(null);

    try {
      const page = await listBookings({
        email: targetEmail.trim().toLowerCase(),
        limit: 6,
        ...(cursor ? { cursor } : {})
      });

      if (id !== requestId.current) {
        return;
      }

      setBookings((current) =>
        mode === "append" ? [...(current ?? []), ...page.bookings] : page.bookings
      );
      setNextCursor(page.next_cursor);
    } catch (caught) {
      if (id !== requestId.current) {
        return;
      }

      setError(describeError(caught));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    if (!autoRan.current && defaultEmail.trim() !== "") {
      autoRan.current = true;
      void runSearch(defaultEmail, undefined, "replace");
    }
    // Runs once on mount: the email from the last booking is looked up automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (email.trim() === "") {
      setEmailError("Enter the email you booked with.");
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError("Enter a valid email, like ada@example.com.");
      return;
    }

    setEmailError(null);
    void runSearch(email, undefined, "replace");
  }

  async function handleCancel(id: string): Promise<void> {
    setCancelling(id);
    setError(null);

    try {
      const updated = await cancelBooking(id);
      setBookings((current) =>
        current ? current.map((booking) => (booking.id === updated.id ? updated : booking)) : current
      );
      setConfirmCancel(null);
      onRefreshSlots();
    } catch (caught) {
      setError(describeError(caught));
      setConfirmCancel(null);
    } finally {
      setCancelling(null);
    }
  }

  return (
    <>
      <header className="view-head">
        <div>
          <p className="date-line">Your visits</p>
          <h1>My bookings</h1>
          <p className="view-lede">
            Look up bookings with the email you used. You can cancel any confirmed booking.
          </p>
        </div>
      </header>

      <form className="lookup-card" onSubmit={handleSubmit} noValidate>
        <div className="lookup-form">
          <div className="field">
            <label htmlFor="lookup-email">Email</label>
            <input
              id="lookup-email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="ada@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError(null);
              }}
              aria-invalid={emailError ? "true" : undefined}
              aria-describedby={emailError ? "lookup-email-error" : undefined}
            />
          </div>
          <button type="submit" className="button button--primary" disabled={loading}>
            <SearchIcon />
            {loading ? "Searching…" : "Find bookings"}
          </button>
        </div>
        {emailError && (
          <p className="field-error" id="lookup-email-error">
            {emailError}
          </p>
        )}
        <p className="lookup-note">Matches ignore letter case. Bookings appear oldest first.</p>
      </form>

      {error && (
        <div className="banner banner--error" role="alert">
          <div>
            <strong>Couldn't load bookings</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loading && bookings === null && (
        <div className="booking-list" aria-busy="true">
          <p className="sr-only">Loading bookings</p>
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </div>
      )}

      {!loading && bookings === null && (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <TicketIcon size={22} />
          </span>
          <h3>Find a booking</h3>
          <p>Enter the email you booked with to see your visits.</p>
        </div>
      )}

      {!loading && bookings !== null && bookings.length === 0 && !error && (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <TicketIcon size={22} />
          </span>
          <h3>No bookings for that email</h3>
          <p>Check the spelling, or book a new appointment.</p>
          <button type="button" className="button button--secondary" onClick={onBook}>
            Book an appointment
          </button>
        </div>
      )}

      {bookings !== null && bookings.length > 0 && (
        <div className="booking-list">
          {bookings.map((booking) => {
            const slot = slotById.get(booking.slot_id);
            const isCancelling = cancelling === booking.id;

            return (
              <article key={booking.id} className="booking-row">
                <div className="date-chip">
                  <span>{slot ? formatWeekday(slot.start) : "—"}</span>
                  <strong>{slot ? formatDayNumber(slot.start) : "?"}</strong>
                  <span>{slot ? formatMonth(slot.start) : ""}</span>
                </div>

                <div className="booking-main">
                  <p className="booking-time">
                    {slot ? `${formatTime(slot.start)} – ${formatTime(slot.end)}` : "Time unavailable"}
                  </p>
                  <p className="booking-provider">
                    {slot ? slot.provider : `Slot ${booking.slot_id}`}
                  </p>
                  <p className="booking-ref">Ref {booking.id}</p>
                </div>

                <div className="booking-side">
                  <span className={`status-pill status-${booking.status}`}>
                    {booking.status === "confirmed" ? "Confirmed" : "Cancelled"}
                  </span>

                  {booking.status === "confirmed" &&
                    (confirmCancel === booking.id ? (
                      <div className="cancel-confirm">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setConfirmCancel(null)}
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          className="link-button link-danger"
                          onClick={() => void handleCancel(booking.id)}
                          disabled={isCancelling}
                        >
                          {isCancelling ? "Cancelling…" : "Confirm cancel"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setConfirmCancel(booking.id)}
                      >
                        Cancel booking
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {nextCursor && bookings !== null && bookings.length > 0 && (
        <div className="load-more">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void runSearch(email, nextCursor, "append")}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
