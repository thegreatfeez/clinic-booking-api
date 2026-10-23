import { useCallback, useEffect, useState } from "react";
import type { Slot } from "./api";
import { listSlots } from "./api";
import Sidebar from "./components/Sidebar";
import { describeError } from "./lib/errors";
import { hasStarted } from "./lib/format";
import type { View } from "./lib/types";
import BookView from "./views/BookView";
import BookingsView from "./views/BookingsView";

export default function App() {
  const [view, setView] = useState<View>("book");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastEmail, setLastEmail] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setLoadError(null);

    listSlots(controller.signal)
      .then((data) => setSlots(data))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadError(describeError(error));
      });

    return () => controller.abort();
  }, [reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const openSlots = slots
    ? slots.filter((slot) => slot.available && !hasStarted(slot)).length
    : null;

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigate={setView} openSlots={openSlots} />

      <main className="app-main">
        <div className="content">
          {view === "book" ? (
            <BookView
              slots={slots}
              loadError={loadError}
              onRetry={refresh}
              onBooked={(email) => {
                setLastEmail(email);
                refresh();
              }}
              onViewBookings={() => setView("bookings")}
            />
          ) : (
            <BookingsView
              slots={slots}
              defaultEmail={lastEmail}
              onBook={() => setView("book")}
              onRefreshSlots={refresh}
            />
          )}
        </div>
      </main>
    </div>
  );
}
