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
 * A book against SPY over the last 22 sessions every included ticker traded.
 * The window is SPY's last 22 sessions; a holding missing any of those days
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
): { perf: Performance | null; missing: string[] } {
  const spy = series.SPY;
  if (!spy || spy.length < SESSIONS) return { perf: null, missing: symbols };

  const calendar = spy.slice(-SESSIONS).map((c) => c.date);
  const byDate = (closes: Closes) => new Map(closes.map((c) => [c.date, c.close]));
  const spyBy = byDate(spy);

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
