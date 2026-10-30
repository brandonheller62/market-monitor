"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { tradingWindow } from "@/lib/format";

/** How often an open page re-reads the server while anything trades. */
const INTERVAL_MS = 60_000;

const isOpen = () => tradingWindow() != null;

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
 * Keeps the numbers on an open page current from the pre-market through after
 * hours (4:00 to 8:00 ET) by re-rendering its server components every minute,
 * which keeps client state (selected tab, open chart, question) in place. It
 * stops overnight after one last read, and skips ticks while the tab is
 * hidden, catching up when it is shown again. Renders the nav's "Live" marker,
 * naming the extended session when it is one.
 */
export function LiveRefresh() {
  const router = useRouter();
  // Closed on the server, so the marker only appears once the browser's clock says so.
  const trading = useSyncExternalStore(subscribe, tradingWindow, () => null);

  useEffect(() => {
    let wasOpen = isOpen();
    let last = Date.now();

    function tick() {
      const now = isOpen();
      // The tick after 8:00 still refreshes once, to land on the last trade.
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

  if (!trading) return null;
  return (
    <span className="eyebrow ml-auto flex items-center gap-2 pb-3" title="Prices update every minute">
      <span aria-hidden className="pulse h-1.5 w-1.5 rounded-full bg-[var(--up)]" />
      {trading === "Open" ? "Live" : `Live · ${trading}`}
    </span>
  );
}
