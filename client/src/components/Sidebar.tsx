import type { View } from "../lib/types";
import { CalendarIcon, TicketIcon } from "./Icons";

interface SidebarProps {
  view: View;
  onNavigate: (view: View) => void;
  openSlots: number | null;
}

export default function Sidebar({ view, onNavigate, openSlots }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <span className="brand-square brand-square--violet" />
          <span className="brand-square brand-square--coral" />
          <span className="brand-square brand-square--lime" />
          <span className="brand-square brand-square--sky" />
        </span>
        <span className="brand-word">
          Koya <span>Clinic</span>
        </span>
      </div>

      <nav className="nav" aria-label="Main">
        <button
          type="button"
          className="nav-item"
          aria-current={view === "book" ? "page" : undefined}
          onClick={() => onNavigate("book")}
        >
          <CalendarIcon />
          <span>
            <span className="nav-label-long">Book appointment</span>
            <span className="nav-label-short">Book</span>
          </span>
        </button>
        <button
          type="button"
          className="nav-item"
          aria-current={view === "bookings" ? "page" : undefined}
          onClick={() => onNavigate("bookings")}
        >
          <TicketIcon />
          <span>
            <span className="nav-label-long">My bookings</span>
            <span className="nav-label-short">Bookings</span>
          </span>
        </button>
      </nav>

      <div className="side-foot">
        <div className="live-card">
          <p className="live-label">
            <span className="live-dot" aria-hidden="true" />
            Live availability
          </p>
          <p className="live-count">
            {openSlots ?? "—"}
            <span> open slots</span>
          </p>
          <p className="live-note">Across all clinicians</p>
        </div>
        <p className="side-note">Times are shown in your local timezone.</p>
      </div>
    </aside>
  );
}
