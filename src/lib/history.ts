import { UA, num } from "./http";
import type { Closes } from "./perf-math";

/**
 * Daily closes for the portfolio charts, fetched for the union of every book's
 * tickers in one pass. Nasdaq's unofficial API throttles bursts and sometimes
 * answers 200 with an empty or malformed table, so every response is checked
 * before it counts, failures are retried with backoff, and only good results
 * are cached. Next's own fetch cache is bypassed here because it would keep a
 * bad 200 for as long as a good one.
 */

const LOOKBACK_DAYS = 45;
/** Fewer rows than this in a 45-day window means the reply was not real data. */
const MIN_ROWS = 15;
const RETRIES = 3;
const CONCURRENCY = 4;
const CLOSE_SECONDS = 16 * 3600 + 30 * 60; // 4:30 PM ET, once the close has settled

type Failure = { symbol: string; reason: string };
export type HistoryResult = { series: Record<string, Closes>; failed: Failure[] };

export const assetclassFor = (symbol: string) => (symbol === "SPY" ? "etf" : "stocks");

/** Today's date and seconds past midnight, both in New York. */
function eastern(now: Date): { date: string; seconds: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

/** Seconds until the next settled close, which is how long a good series stays good. */
export function secondsUntilNextClose(now = new Date()): number {
  const { seconds } = eastern(now);
  const left = seconds < CLOSE_SECONDS ? CLOSE_SECONDS - seconds : 86400 - seconds + CLOSE_SECONDS;
  return Math.max(60, left);
}

/**
 * How long a good series stays good: until the next settled close, except
 * after a weekday's close when the day's row has not landed yet. Nasdaq posts
 * it hours late (still missing at 7:30 PM ET), so until then check back every
 * half hour instead of holding yesterday's series until tomorrow afternoon.
 */
export function ttlFor(closes: Closes, now = new Date()): number {
  const { date, seconds } = eastern(now);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const afterClose = weekday >= 1 && weekday <= 5 && seconds >= CLOSE_SECONDS;
  if (afterClose && closes.at(-1)?.date !== date) return 30 * 60;
  return secondsUntilNextClose(now);
}

/** "10/05/2026" -> "2026-10-05". */
function isoFromUs(date: string): string | null {
  const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

type Attempt = { ok: true; closes: Closes } | { ok: false; reason: string };

async function attempt(symbol: string, now: Date): Promise<Attempt> {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - LOOKBACK_DAYS);
  const url =
    `https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=${assetclassFor(symbol)}` +
    `&fromdate=${from.toISOString().slice(0, 10)}&todate=${to.toISOString().slice(0, 10)}&limit=60`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return { ok: false, reason: (err as Error).name === "TimeoutError" ? "timeout" : "network error" };
  }
  if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` };

  let json: { data?: { tradesTable?: { rows?: { date: string; close: string }[] | null } | null } | null };
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: "non-JSON body" };
  }

  // A close that is still forming during the session would be frozen in the
  // cache until tomorrow, so only settled sessions are kept.
  const today = eastern(now);
  const closes = (json?.data?.tradesTable?.rows ?? [])
    .map((r) => ({ date: isoFromUs(r.date), close: num(r.close) }))
    .filter((r): r is { date: string; close: number } => r.date != null && r.close != null)
    .filter((r) => !(r.date === today.date && today.seconds < CLOSE_SECONDS))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (closes.length < MIN_ROWS) return { ok: false, reason: `only ${closes.length} rows` };
  return { ok: true, closes };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Survives between requests on a warm function; holds only checked results. */
const memory = new Map<string, { closes: Closes; expires: number }>();

async function history(symbol: string): Promise<Attempt> {
  const hit = memory.get(symbol);
  if (hit && hit.expires > Date.now()) return { ok: true, closes: hit.closes };

  let last: Attempt = { ok: false, reason: "not tried" };
  for (let i = 0; i <= RETRIES; i++) {
    if (i > 0) await sleep(400 * 2 ** (i - 1) + Math.random() * 200);
    const now = new Date();
    last = await attempt(symbol, now);
    if (last.ok) {
      memory.set(symbol, { closes: last.closes, expires: Date.now() + ttlFor(last.closes, now) * 1000 });
      return last;
    }
  }
  console.warn(`[history] ${symbol} failed after ${RETRIES + 1} attempts: ${last.reason}`);
  return last;
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Every symbol's closes, fetched four at a time. A failure drops only that symbol. */
export async function fetchHistories(symbols: string[]): Promise<HistoryResult> {
  const unique = [...new Set(symbols)];
  const results = await pooled(unique, CONCURRENCY, history);
  const series: Record<string, Closes> = {};
  const failed: Failure[] = [];
  unique.forEach((symbol, i) => {
    const r = results[i];
    if (r.ok) series[symbol] = r.closes;
    else failed.push({ symbol, reason: r.reason });
  });
  return { series, failed };
}
