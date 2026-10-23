import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Booking, Slot } from "../api";
import { ApiError, createBooking } from "../api";
import { describeError } from "../lib/errors";
import { formatDay, formatRange } from "../lib/format";
import { ArrowRightIcon, CheckIcon } from "./Icons";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Confirmation {
  booking: Booking;
  slot: Slot;
}

interface BookingPanelProps {
  slot: Slot | null;
  confirmation: Confirmation | null;
  onBooked: (confirmation: Confirmation) => void;
  onClear: () => void;
  onViewBookings: () => void;
  onConflict: () => void;
}

export default function BookingPanel({
  slot,
  confirmation,
  onBooked,
  onClear,
  onViewBookings,
  onConflict
}: BookingPanelProps) {
  if (confirmation) {
    return (
      <ConfirmationPanel
        confirmation={confirmation}
        onClear={onClear}
        onViewBookings={onViewBookings}
      />
    );
  }

  if (!slot) {
    return (
      <aside className="panel" id="booking-panel">
        <div className="panel-head panel-head--empty">
          <p className="panel-eyebrow">Your appointment</p>
          <p className="panel-title">No time selected</p>
          <p className="panel-meta">Pick an open slot to continue</p>
        </div>
        <div className="panel-body">
          <ol className="steps">
            <li className="step step--active">
              <span className="step-num">1</span>
              <span className="step-text">
                <strong>Pick a time</strong>
                <span>Pick an open slot from the list.</span>
              </span>
            </li>
            <li className="step">
              <span className="step-num">2</span>
              <span className="step-text">
                <strong>Add your details</strong>
                <span>Just a name and an email.</span>
              </span>
            </li>
            <li className="step">
              <span className="step-num">3</span>
              <span className="step-text">
                <strong>Get confirmation</strong>
                <span>Your slot is held immediately.</span>
              </span>
            </li>
          </ol>
          <p className="panel-hint">Booking takes less than a minute.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel" id="booking-panel">
      <div className="panel-head">
        <p className="panel-eyebrow">Your appointment</p>
        <p className="panel-title">{formatDay(slot.start)}</p>
        <p className="panel-meta">
          {formatRange(slot)} · {slot.provider}
        </p>
      </div>
      <div className="panel-body">
        <BookingForm
          key={slot.id}
          slot={slot}
          onBooked={(booking) => onBooked({ booking, slot })}
          onConflict={onConflict}
        />
      </div>
    </aside>
  );
}

function BookingForm({
  slot,
  onBooked,
  onConflict
}: {
  slot: Slot;
  onBooked: (booking: Booking) => void;
  onConflict: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nextErrors: { name?: string; email?: string } = {};

    if (name.trim() === "") {
      nextErrors.name = "Enter the patient's full name.";
    }

    if (email.trim() === "") {
      nextErrors.email = "Enter an email address.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = "Enter a valid email, like ada@example.com.";
    }

    setErrors(nextErrors);

    if (nextErrors.name || nextErrors.email) {
      (nextErrors.name ? nameRef : emailRef).current?.focus();
      return;
    }

    setSubmitting(true);
    setServerError(null);

    try {
      const booking = await createBooking({
        slot_id: slot.id,
        name: name.trim(),
        email: email.trim()
      });

      onBooked(booking);
    } catch (error) {
      setServerError(describeError(error));

      if (error instanceof ApiError && error.status === 409) {
        onConflict();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          ref={nameRef}
          type="text"
          autoComplete="name"
          spellCheck={false}
          placeholder="Ada Obi"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
          }}
          aria-invalid={errors.name ? "true" : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && (
          <p className="field-error" id="name-error">
            {errors.name}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          ref={emailRef}
          type="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="ada@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
          }}
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p className="field-error" id="email-error">
            {errors.email}
          </p>
        )}
      </div>

      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        className="button button--primary button--block"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? "Booking…" : "Confirm booking"}
        {!submitting && <ArrowRightIcon />}
      </button>

      <p className="panel-hint">Your slot is reserved as soon as you confirm.</p>
    </form>
  );
}

function ConfirmationPanel({
  confirmation,
  onClear,
  onViewBookings
}: {
  confirmation: Confirmation;
  onClear: () => void;
  onViewBookings: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { booking, slot } = confirmation;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <aside className="panel" id="booking-panel">
      <div className="panel-head panel-head--success">
        <span className="panel-check" aria-hidden="true">
          <CheckIcon />
        </span>
        <p className="panel-eyebrow">Confirmed</p>
        <h2 ref={headingRef} tabIndex={-1} className="panel-title">
          You're booked
        </h2>
        <p className="panel-meta">
          {formatDay(slot.start)} · {formatRange(slot)}
        </p>
      </div>
      <div className="panel-body">
        <div className="confirm-details">
          <div className="confirm-row">
            <span>Provider</span>
            <strong>{slot.provider}</strong>
          </div>
          <div className="confirm-row">
            <span>Name</span>
            <strong>{booking.name}</strong>
          </div>
          <div className="confirm-row">
            <span>Email</span>
            <strong>{booking.email}</strong>
          </div>
        </div>

        <div className="confirm-divider" />

        <div className="reference-box">
          <span>Reference</span>
          <code>{booking.id}</code>
        </div>

        <button type="button" className="button button--primary button--block" onClick={onClear}>
          Book another time
        </button>
        <button
          type="button"
          className="button button--secondary button--block"
          onClick={onViewBookings}
        >
          View my bookings
        </button>
      </div>
    </aside>
  );
}
