import { getRecentCloses, quoteSymbol } from "./market";
import { portfolioSymbols } from "./portfolios";
import type { PortfolioId } from "./types";

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

type Closes = { date: string; close: number }[];

/**
 * Sessions in the window, counting the base. The stock page's "1 month" is
 * the move from the close 21 sessions before the latest, so the chart starts
 * on that same close and both read the same number.
 */
const SESSIONS = 22;

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

/**
 * A book against SPY on SPY's last 22 sessions. Equal-weighted buy-and-hold:
 * the same dollars go into every holding at the first close and are left
 * alone, the method the "Since September 1" card uses. Holdings without a
 * close on day one are left out rather than guessed at.
 */
export async function getPortfolioPerformance(
  id: PortfolioId,
): Promise<(Performance & { tracked: number; total: number }) | null> {
  const { symbols } = portfolioSymbols(id);
  const [spy, holdings] = await Promise.all([
    spyHistory(),
    Promise.all(
      symbols.map(async (s) => {
        const [closes, q] = await Promise.all([getRecentCloses(s), quoteSymbol(s)]);
        return { closes, price: q.price };
      }),
    ),
  ]);
  if (spy.closes.length < SESSIONS) return null;

  const calendar = spy.closes.slice(-SESSIONS).map((c) => c.date);
  const bench = relatives(spy.closes, calendar);
  const lines = holdings
    .map((h) => {
      const rel = relatives(h.closes, calendar);
      if (!rel) return null;
      return { rel, live: liveRelative(h.price, h.closes, calendar) ?? rel.at(-1)! };
    })
    .filter((l) => l != null);
  if (!bench || lines.length === 0) return null;

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const subject = calendar.map((_, i) => mean(lines.map((l) => l.rel[i])));

  return {
    ...assemble(
      calendar,
      subject,
      bench,
      mean(lines.map((l) => l.live)),
      liveRelative(spy.price, spy.closes, calendar),
    ),
    tracked: lines.length,
    total: symbols.length,
  };
}
