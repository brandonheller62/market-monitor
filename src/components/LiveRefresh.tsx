"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { sessionPhase } from "@/lib/format";

/** How often an open page re-reads the server while the session runs. */
const INTERVAL_MS = 60_000;

const isOpen = () => sessionPhase().label === "Open";

/** Re-checks the clock on the same beat as the refresh, and when the tab is shown. */
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, INTERVAL_MS);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/**
 * Keeps the numbers on an open page current during the US cash session by
 * re-rendering its server components every minute, which keeps client state
 * (selected tab, open chart, question) in place. It stops outside the session
 * after one last read to pick up the close, and skips ticks while the tab is
 * hidden, catching up when it is shown again. Renders the nav's "Live" marker.
 */
export function LiveRefresh() {
  const router = useRouter();
  // Closed on the server, so the marker only appears once the browser's clock says so.
  const open = useSyncExternalStore(subscribe, isOpen, () => false);

  useEffect(() => {
    let wasOpen = isOpen();
    let last = Date.now();

    function tick() {
      const now = isOpen();
      // The tick after the bell still refreshes once, to land on the close.
      if ((now || wasOpen) && !document.hidden && Date.now() - last >= INTERVAL_MS - 1_000) {
        last = Date.now();
        router.refresh();
      }
      wasOpen = now;
    }

    const id = window.setInterval(tick, INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  if (!open) return null;
  return (
    <span className="eyebrow ml-auto flex items-center gap-2 pb-3" title="Prices update every minute">
      <span aria-hidden className="pulse h-1.5 w-1.5 rounded-full bg-[var(--up)]" />
      Live
    </span>
  );
}
