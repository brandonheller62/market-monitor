export function fmtPrice(n: number | null): string {
  if (n == null) return "—";
  const digits = Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 10 ? 2 : 4;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function fmtCap(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

export function timeAgo(ts: number | null): string {
  if (ts == null) return "";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function easternNow(): { label: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  return { label, minutes: hour * 60 + minute };
}

/** "14:30" -> 870. Returns null for anything that isn't a clock time. */
export function parseClock(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export type SessionPhase = {
  /** Short label for the UI. */
  label: string;
  /** Sentence Claude is given so the note is framed for the right moment. */
  description: string;
};

/** Where the clock sits relative to the US cash session, in ET. */
export function sessionPhase(now = new Date()): SessionPhase {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const minutes =
    Number(parts.find((p) => p.type === "hour")?.value ?? "0") * 60 +
    Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  if (weekday === "Sat" || weekday === "Sun") {
    return {
      label: "Weekend",
      description:
        "US markets are closed for the weekend. The levels below are Friday's " +
        "close; write the note for the coming week's open.",
    };
  }
  if (minutes < 9 * 60 + 30) {
    return {
      label: "Pre-open",
      description:
        "US cash equities have not opened yet. These are overnight and " +
        "pre-market levels; write the note for the open ahead.",
    };
  }
  if (minutes < 16 * 60) {
    return {
      label: "Open",
      description:
        "The US cash session is open and these are live session levels, not a " +
        "pre-open snapshot. Write the note for the rest of the session.",
    };
  }
  return {
    label: "After the close",
    description:
      "US cash equities have closed. These are closing levels; write the note " +
      "as a wrap of the day just finished and a setup for tomorrow.",
  };
}
