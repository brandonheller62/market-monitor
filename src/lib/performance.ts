import { getRecentCloses, quoteSymbol } from "./market";
import { SESSIONS, type Closes, type Performance, type PerfPoint } from "./perf-math";

export type { Performance, PerfPoint };

/**
 * Value on each calendar date relative to the first, carrying the last close
 * forward over any day the feed skipped. Null when the base close is missing.
 */
function relatives(closes: Closes, calendar: string[]): number[] | null {
  const byDate = new Map(closes.map((c) => [c.date, c.close]));
  const base = byDate.get(calendar[0]);
  if (base == null || base === 0) return null;
  let last = base;
  return calendar.map((d) => {
    last = byDate.get(d) ?? last;
    return last / base;
  });
}

const pct = (relative: number) => (relative - 1) * 100;

/**
 * The live quote as a relative to the base. It differs from the last close
 * during a session, or before the day's close lands in the history; ending on
 * it is what makes the chart's total match the stock page's moves, which are
 * measured to the current price.
 */
function liveRelative(price: number | null, closes: Closes, calendar: string[]): number | null {
  const byDate = new Map(closes.map((c) => [c.date, c.close]));
  const base = byDate.get(calendar[0]);
  if (price == null || base == null || base === 0) return null;
  return price / base;
}

async function spyHistory() {
  const [closes, q] = await Promise.all([
    getRecentCloses("SPY", 45, "etf"),
    quoteSymbol("SPY", "etf"),
  ]);
  return { closes, price: q.price };
}

/** Builds the points, appending a live point when any line has moved since the close. */
function assemble(
  calendar: string[],
  subject: number[],
  bench: number[],
  subjectLive: number | null,
  benchLive: number | null,
): Performance {
  const points: PerfPoint[] = calendar.map((date, i) => ({
    date,
    subject: pct(subject[i]),
    bench: pct(bench[i]),
  }));
  const s = subjectLive ?? subject.at(-1)!;
  const b = benchLive ?? bench.at(-1)!;
  const moved = (a: number, z: number) => Math.abs(a - z) > 1e-6;
  if (moved(s, subject.at(-1)!) || moved(b, bench.at(-1)!)) {
    points.push({ date: null, subject: pct(s), bench: pct(b) });
  }
  const end = points.at(-1)!;
  return { points, subjectPct: end.subject, benchPct: end.bench };
}

/** One stock against SPY over the stock's own last 22 sessions. */
export async function getStockPerformance(symbol: string): Promise<Performance | null> {
  const [closes, q, spy] = await Promise.all([
    getRecentCloses(symbol),
    quoteSymbol(symbol),
    spyHistory(),
  ]);
  if (closes.length < SESSIONS) return null;

  const calendar = closes.slice(-SESSIONS).map((c) => c.date);
  const subject = relatives(closes, calendar);
  const bench = relatives(spy.closes, calendar);
  if (!subject || !bench) return null;

  return assemble(
    calendar,
    subject,
    bench,
    liveRelative(q.price, closes, calendar),
    liveRelative(spy.price, spy.closes, calendar),
  );
}
