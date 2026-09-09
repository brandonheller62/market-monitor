import { getJson, num } from "./http";
import type { Earning, EconEvent } from "./types";

/** The session the recap is written for is the US trading day, so dates are ET. */
export function easternDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

type EconResponse = {
  data?: {
    rows?: {
      gmt: string;
      country: string;
      eventName: string;
      actual: string;
      consensus: string;
      previous: string;
    }[] | null;
  } | null;
};

export async function getEcon(date = easternDate()): Promise<EconEvent[]> {
  const json = await getJson<EconResponse>(
    `https://api.nasdaq.com/api/calendar/economicevents?date=${date}`,
  );
  const rows = json?.data?.rows ?? [];
  // Nasdaq sends a non-breaking space rather than an empty string for a number
  // that has not printed yet, so a bare truthiness check reads as "released".
  const clean = (v: string | null | undefined) =>
    (v ?? "").replace(/[\u00a0\s]+/g, " ").trim();

  return rows
    .map((r) => ({
      time: clean(r.gmt) || "—",
      country: r.country,
      event: r.eventName,
      actual: clean(r.actual),
      consensus: clean(r.consensus),
      previous: clean(r.previous),
      released: clean(r.actual).length > 0,
    }))
    // US prints move US markets most; keep them first, then the rest by time.
    .sort((a, b) => {
      const usA = a.country === "United States" ? 0 : 1;
      const usB = b.country === "United States" ? 0 : 1;
      return usA - usB || a.time.localeCompare(b.time);
    })
    .slice(0, 12);
}

type EarningsResponse = {
  data?: {
    rows?: {
      time: string;
      symbol: string;
      name: string;
      marketCap: string;
      epsForecast: string;
    }[] | null;
  } | null;
};

const WHEN: Record<string, string> = {
  "time-pre-market": "Before open",
  "time-after-hours": "After close",
  "time-not-supplied": "Time TBD",
};

export async function getEarnings(date = easternDate()): Promise<Earning[]> {
  const json = await getJson<EarningsResponse>(
    `https://api.nasdaq.com/api/calendar/earnings?date=${date}`,
  );
  const rows = json?.data?.rows ?? [];
  return rows
    .map((r) => ({
      symbol: r.symbol,
      name: r.name.trim(),
      time: WHEN[r.time] ?? "Time TBD",
      epsForecast: r.epsForecast || "—",
      marketCap: num(r.marketCap),
    }))
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 8);
}
