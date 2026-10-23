import { useEffect, useMemo, useState } from "react";
import type { Slot } from "../api";
import BookingPanel from "../components/BookingPanel";
import type { Confirmation } from "../components/BookingPanel";
import { BoltIcon, CheckIcon } from "../components/Icons";
import { providerColorMap } from "../lib/colors";
import {
  durationMinutes,
  formatTime,
  formatToday,
  hasStarted,
  initials,
  relativeDayLabel
} from "../lib/format";

interface BookViewProps {
  slots: Slot[] | null;
  loadError: string | null;
  onRetry: () => void;
  onBooked: (email: string) => void;
  onViewBookings: () => void;
}

export default function BookView({
  slots,
  loadError,
  onRetry,
  onBooked,
  onViewBookings
}: BookViewProps) {
  const [provider, setProvider] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  const upcoming = useMemo(() => (slots ?? []).filter((slot) => !hasStarted(slot)), [slots]);

  const providers = useMemo(() => {
    const names = new Set<string>();

    for (const slot of slots ?? []) {
      names.add(slot.provider);
    }

    return [...names].sort();
  }, [slots]);

  const colors = useMemo(
    () => providerColorMap((slots ?? []).map((slot) => slot.provider)),
    [slots]
  );

  const colorFor = (name: string) => colors.get(name) ?? "violet";

  const openByProvider = useMemo(() => {
    const counts = new Map<string, number>();

    for (const slot of upcoming) {
      if (slot.available) {
        counts.set(slot.provider, (counts.get(slot.provider) ?? 0) + 1);
      }
    }

    return counts;
  }, [upcoming]);

  const totalOpen = useMemo(() => upcoming.filter((slot) => slot.available).length, [upcoming]);

  const visibleSlots = useMemo(
    () => upcoming.filter((slot) => provider === "all" || slot.provider === provider),
    [upcoming, provider]
  );

  const openInView = visibleSlots.filter((slot) => slot.available).length;

  const groups = useMemo(() => {
    const map = new Map<string, Slot[]>();

    for (const slot of visibleSlots) {
      const day = relativeDayLabel(slot.start);
      const list = map.get(day);

      if (list) {
        list.push(slot);
      } else {
        map.set(day, [slot]);
      }
    }

    return [...map.entries()];
  }, [visibleSlots]);

  useEffect(() => {
    if (!selectedId || !slots) {
      return;
    }

    const current = slots.find((slot) => slot.id === selectedId);

    if (!current || !current.available || hasStarted(current)) {
      setSelectedId(null);
    }
  }, [slots, selectedId]);

  const selectedSlot = slots?.find((slot) => slot.id === selectedId) ?? null;
  const loading = slots === null && loadError === null;

  return (
    <>
      <header className="view-head">
        <div>
          <p className="date-line">{formatToday()}</p>
          <h1>
            Book an <span className="accent-word">appointment</span>
          </h1>
          <p className="view-lede">
            Pick a clinician and a time. Your slot is confirmed instantly.
          </p>
        </div>
        <span className="head-chip">
          <BoltIcon />
          Instant confirmation
        </span>
      </header>

      <section className="clinicians" aria-labelledby="clinicians-label">
        <h2 className="section-label" id="clinicians-label">
          Clinicians
        </h2>
        <div className="provider-grid">
          {slots === null ? (
            <>
              <span className="provider-skeleton" />
              <span className="provider-skeleton" />
              <span className="provider-skeleton" />
            </>
          ) : (
            <>
              <button
                type="button"
                className="provider-card"
                aria-pressed={provider === "all"}
                onClick={() => setProvider("all")}
              >
                <span className="provider-avatar provider-avatar--all" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                <span className="provider-meta">
                  <strong>All clinicians</strong>
                  <span>{totalOpen} open</span>
                </span>
                {provider === "all" && (
                  <span className="provider-check">
                    <CheckIcon size={15} />
                  </span>
                )}
              </button>

              {providers.map((name) => {
                const color = colorFor(name);

                return (
                  <button
                    key={name}
                    type="button"
                    className="provider-card"
                    aria-pressed={provider === name}
                    onClick={() => setProvider(name)}
                  >
                    <span className={`provider-avatar avatar--${color}`} aria-hidden="true">
                      {initials(name)}
                    </span>
                    <span className="provider-meta">
                      <strong>{name}</strong>
                      <span>{openByProvider.get(name) ?? 0} open</span>
                    </span>
                    {provider === name && (
                      <span className="provider-check">
                        <CheckIcon size={15} />
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </section>

      <div className="book-grid">
        <section className="times" aria-labelledby="times-heading">
          <div className="section-head">
            <h2 id="times-heading">Choose a time</h2>
            <span className="section-count">{openInView} open</span>
          </div>

          {conflictNotice && (
            <div className="banner banner--warn" role="alert">
              {conflictNotice}
            </div>
          )}

          {loading && (
            <div className="day" aria-busy="true">
              <p className="sr-only">Loading available times</p>
              <div className="day-head">
                <span className="skeleton skeleton-line" />
              </div>
              <div className="time-grid">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="skeleton skeleton-tile" />
                ))}
              </div>
            </div>
          )}

          {loadError && slots === null && (
            <div className="banner banner--error" role="alert">
              <div>
                <strong>Couldn't load the times</strong>
                <p>{loadError}</p>
                <button type="button" className="button button--secondary" onClick={onRetry}>
                  Try again
                </button>
              </div>
            </div>
          )}

          {loadError && slots !== null && (
            <div className="banner banner--warn" role="alert">
              <div>
                <strong>Showing the last loaded times</strong>
                <p>{loadError}</p>
                <button type="button" className="button button--secondary" onClick={onRetry}>
                  Refresh
                </button>
              </div>
            </div>
          )}

          {!loading && groups.length === 0 && !loadError && (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">
                <BoltIcon size={20} />
              </span>
              <h3>{provider === "all" ? "No upcoming times" : `Nothing open with ${provider}`}</h3>
              <p>
                {provider === "all"
                  ? "The clinic hasn't published any upcoming times. Check back shortly."
                  : "Try another clinician, or see every available time."}
              </p>
              <div className="empty-actions">
                {provider !== "all" && (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setProvider("all")}
                  >
                    Show all clinicians
                  </button>
                )}
                <button type="button" className="button button--ghost" onClick={onRetry}>
                  Refresh
                </button>
              </div>
            </div>
          )}

          {groups.map(([day, daySlots]) => (
            <section key={day} className="day" aria-label={day}>
              <div className="day-head">
                <h3>{day}</h3>
                <span>{daySlots.filter((slot) => slot.available).length} open</span>
              </div>
              <div className="time-grid">
                {daySlots.map((slot) => {
                  const color = colorFor(slot.provider);
                  const isSelected = selectedId === slot.id;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className="time-tile"
                      aria-pressed={isSelected}
                      disabled={!slot.available}
                      onClick={() => {
                        setConfirmation(null);
                        setConflictNotice(null);
                        setSelectedId(slot.id);

                        if (window.matchMedia("(max-width: 960px)").matches) {
                          requestAnimationFrame(() => {
                            document.getElementById("booking-panel")?.scrollIntoView({
                              behavior: "auto",
                              block: "start"
                            });
                          });
                        }
                      }}
                    >
                      <span className="tile-time">{formatTime(slot.start)}</span>
                      <span className="tile-meta">
                        <span className={`tile-dot avatar-bg--${color}`} aria-hidden="true" />
                        {slot.provider}
                      </span>
                      <span className={slot.available ? "tile-status is-open" : "tile-status"}>
                        {slot.available ? "Open" : "Booked"} · {durationMinutes(slot)} min
                      </span>
                      {isSelected && (
                        <span className="tile-check" aria-hidden="true">
                          <CheckIcon size={11} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </section>

        <BookingPanel
          slot={selectedSlot}
          confirmation={confirmation}
          onBooked={(next) => {
            setConfirmation(next);
            onBooked(next.booking.email);
          }}
          onClear={() => {
            setConfirmation(null);
            setSelectedId(null);
            setConflictNotice(null);
            onRetry();
          }}
          onViewBookings={onViewBookings}
          onConflict={() => {
            setConflictNotice("That time was just taken by someone else. Choose another slot.");
            setSelectedId(null);
            onRetry();
          }}
        />
      </div>
    </>
  );
}
