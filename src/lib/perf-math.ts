/**
 * The vs-S&P series math, kept free of server code so the portfolio cards can
 * run it in the browser and the check script can run it in Node.
 */

export type Closes = { date: string; close: number }[];

/** One point on a vs-S&P chart, both values in percent from day one. */
export type PerfPoint = {
  /** ISO date of the close, or null for the live quote after the last close. */
  date: string | null;
  subject: number;
  bench: number;
};

export type Performance = {
  points: PerfPoint[];
  subjectPct: number;
  benchPct: number;
};

/**
 * Sessions in the window, counting the base. The stock page's "1 month" is
 * the move from the close 21 sessions before the latest, so the charts start
 * on that same close.
 */
export const SESSIONS = 22;

/**
 * The date the "Since" figures measure from. Moves are taken from the last
 * close before this, which is the standard month-to-date base. Change this one
 * line to re-point every "Since" figure and chart, or set it to the first of
 * the current month to make it roll. Lives here, free of server code, so the
 * browser-side book charts can read it.
 */
export const SINCE_DATE = "2026-09-01";

/**
 * Calendar days of history that reach the close before SINCE_DATE, with a
 * week's slack for a holiday weekend, and never less than the month needs.
 */
export function sinceLookbackDays(now = new Date()): number {
  const from = new Date(`${SINCE_DATE}T00:00:00Z`);
  return Math.max(45, Math.ceil((now.getTime() - from.getTime()) / 86_400_000) + 7);
}

/** The window's dates out of a series: from the close before SINCE_DATE, or the last 22 sessions. */
export function windowDates(closes: Closes, window: "since" | "month"): string[] {
  const dates = closes.map((c) => c.date);
  if (window === "month") return dates.length >= SESSIONS ? dates.slice(-SESSIONS) : [];
  const base = dates.findLastIndex((d) => d < SINCE_DATE);
  return base >= 0 ? dates.slice(base) : [];
}

/**
 * A book against SPY over a window every included ticker traded: SPY's last
 * 22 sessions, or SPY's sessions from the close before SINCE_DATE. The window is SPY's; a holding missing any of those days
 * (failed fetch, halt, gap) is dropped and named rather than shrinking the
 * window for the rest, so the result is the intersection of trading days
 * across the tickers that are kept.
 *
 * Equal-weighted buy-and-hold: the same dollars go into every holding at the
 * first close and are left alone, the method the "Since September 1" card
 * uses. Null only when SPY or every holding is unusable.
 */
export function bookPerformance(
  symbols: string[],
  series: Record<string, Closes>,
  window: "since" | "month" = "month",
): { perf: Performance | null; missing: string[] } {
  const calendar = series.SPY ? windowDates(series.SPY, window) : [];
  if (calendar.length < 2) return { perf: null, missing: symbols };

  const byDate = (closes: Closes) => new Map(closes.map((c) => [c.date, c.close]));
  const spyBy = byDate(series.SPY);

  const lines: number[][] = [];
  const missing: string[] = [];
  for (const symbol of symbols) {
    const by = series[symbol] ? byDate(series[symbol]) : null;
    const closes = by ? calendar.map((d) => by.get(d)) : [];
    if (!by || closes.some((c) => c == null || c === 0)) {
      missing.push(symbol);
      continue;
    }
    const base = closes[0]!;
    lines.push(closes.map((c) => c! / base));
  }
  if (lines.length === 0) return { perf: null, missing };

  const spyBase = spyBy.get(calendar[0])!;
  const points = calendar.map((date, i) => ({
    date,
    subject: (lines.reduce((sum, l) => sum + l[i], 0) / lines.length - 1) * 100,
    bench: (spyBy.get(date)! / spyBase - 1) * 100,
  }));
  const end = points.at(-1)!;
  return { perf: { points, subjectPct: end.subject, benchPct: end.bench }, missing };
}
