import { getBoard, getCrypto, getCurve, getFx, getMovers } from "./market";
import { getEarnings, getEcon } from "./calendar";
import { getHeadlines } from "./news";
import type { Benchmark, Portfolio, Snapshot } from "./types";

/**
 * One fan-out across every upstream. All of them are cached by the Next data
 * cache for REVALIDATE seconds, so the page and the written notes share the
 * same numbers without paying for the fetches twice.
 */
export async function getSnapshot(): Promise<Snapshot> {
  const [groups, curve, movers, econ, earnings, headlines, fx, crypto] =
    await Promise.all([
      getBoard(),
      getCurve(),
      getMovers(),
      getEcon(),
      getEarnings(),
      getHeadlines(),
      getFx(),
      getCrypto(),
    ]);

  const degraded: string[] = [];
  const quotes = groups.flatMap((g) => g.quotes);
  if (quotes.every((q) => q.price == null)) {
    degraded.push("quotes");
  } else {
    for (const q of quotes) {
      if (q.price == null) degraded.push(q.label);
      else if (q.fallback) degraded.push(`${q.label} shown in place of the index`);
    }
  }
  if (!curve.points.some((p) => p.yield != null)) degraded.push("Treasury curve");
  if (headlines.length === 0) degraded.push("headlines");
  if (econ.length === 0) degraded.push("economic calendar");

  return {
    generatedAt: new Date().toISOString(),
    groups,
    curve,
    gainers: movers.gainers,
    losers: movers.losers,
    econ,
    earnings,
    headlines,
    fx,
    crypto,
    degraded,
  };
}

/** Compact text rendering of the snapshot. This is what Claude reads. */
export function snapshotToPrompt(s: Snapshot): string {
  const pct = (n: number | null) => (n == null ? "n/a" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`);
  const lines: string[] = [];

  for (const g of s.groups) {
    lines.push(`## ${g.title}`);
    for (const q of g.quotes) {
      const what = q.kind === "index" ? "index level" : `ETF share price, ${q.note}`;
      lines.push(`- ${q.label} (${what}): ${q.price ?? "n/a"} ${pct(q.changePct)}`);
    }
  }

  if (s.curve.points.length) {
    lines.push(`## Treasury par yields (${s.curve.date ?? "latest"})`);
    lines.push(s.curve.points.map((p) => `${p.label} ${p.yield ?? "n/a"}%`).join(" | "));
    if (s.curve.twosTens != null) lines.push(`2s10s spread: ${s.curve.twosTens} bp/100`);
  }

  if (s.fx.length) {
    lines.push("## FX (per USD)");
    lines.push(s.fx.map((f) => `${f.pair} ${f.rate}`).join(" | "));
  }

  if (s.crypto.length) {
    lines.push("## Crypto (24h)");
    lines.push(s.crypto.map((c) => `${c.label} $${c.price} ${pct(c.changePct)}`).join(" | "));
  }

  if (s.gainers.length) {
    lines.push("## Nasdaq-100 movers");
    lines.push(`Up: ${s.gainers.map((m) => `${m.symbol} ${pct(m.changePct)}`).join(", ")}`);
    lines.push(`Down: ${s.losers.map((m) => `${m.symbol} ${pct(m.changePct)}`).join(", ")}`);
  }

  if (s.econ.length) {
    lines.push("## Economic calendar today (times ET)");
    for (const e of s.econ) {
      const result = e.released
        ? `actual ${e.actual} vs consensus ${e.consensus || "n/a"} (prev ${e.previous || "n/a"})`
        : `not yet released, consensus ${e.consensus || "n/a"} (prev ${e.previous || "n/a"})`;
      lines.push(`- ${e.time} ${e.country}: ${e.event}, ${result}`);
    }
  }

  if (s.earnings.length) {
    lines.push("## Reporting today");
    for (const e of s.earnings) {
      lines.push(`- ${e.symbol} (${e.name}), ${e.time}, EPS consensus ${e.epsForecast}`);
    }
  }

  if (s.headlines.length) {
    lines.push("## Headlines");
    for (const h of s.headlines.slice(0, 24)) {
      lines.push(`- [${h.source}] ${h.title}`);
    }
  }

  if (s.degraded.length) {
    lines.push(`## Unavailable this run: ${s.degraded.join(", ")}`);
  }

  return lines.join("\n");
}

/** Corporate suffixes that make a poor headline search term. */
const SUFFIXES =
  /\b(inc|corp|corporation|co|ltd|plc|holdings|group|technologies|systems|software|company|class\s+[a-c]|the)\b/gi;

/** A short, distinctive term to search headlines with, e.g. "Old Dominion". */
function matchTerm(name: string): string {
  const cleaned = name
    .replace(/\(.*?\)/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/[&,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  return words.slice(0, words[0] && words[0].length <= 5 ? 2 : 1).join(" ");
}

/** Text rendering of one portfolio against the day's tape. What Claude reads. */
export function portfolioToPrompt(
  p: Portfolio,
  s: Snapshot,
  benchmark: Benchmark,
): string {
  const pct = (n: number | null) =>
    n == null ? "n/a" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
  const lines: string[] = [`# ${p.name}`, `${p.holdings.length} positions.`, ""];

  lines.push("## Holdings (price, today, since Sep 1)");
  for (const h of p.holdings) {
    lines.push(
      `- ${h.symbol} ${h.name}: ${h.price ?? "n/a"}, today ${pct(h.changePct)}, ` +
        `since Sep 1 ${pct(h.sincePct)}`,
    );
  }

  lines.push("", "## Equal-weighted session read");
  lines.push(
    `No share counts are available, so this is an equal-weighted read of the ` +
      `session, not a portfolio return. Average holding move ${pct(p.averageChangePct)}, ` +
      `${p.advancing} of ${p.priced} priced names advancing.`,
  );
  if (p.best) lines.push(`Best: ${p.best.symbol} ${pct(p.best.changePct)}`);
  if (p.worst) lines.push(`Worst: ${p.worst.symbol} ${pct(p.worst.changePct)}`);

  const since = p.since;
  lines.push("", `## Since September 1 (from the ${since.baselineDate} close)`);
  lines.push(
    `A hypothetical $${Math.round(since.startValue).toLocaleString("en-US")} split ` +
      `equally across the ${since.tracked} priced holdings at that close would now ` +
      `be worth $${Math.round(since.currentValue ?? 0).toLocaleString("en-US")}, ` +
      `${pct(since.changePct)}. There are no share counts, so this is an ` +
      `equal-weighted illustration, not the book's real value.`,
  );
  if (since.best) lines.push(`Best since Sep 1: ${since.best.symbol} ${pct(since.best.sincePct)}`);
  if (since.worst) lines.push(`Worst since Sep 1: ${since.worst.symbol} ${pct(since.worst.sincePct)}`);

  lines.push("", "## Benchmark");
  lines.push(
    `S&P 500 exposure (${benchmark.note}): today ${pct(benchmark.changePct)}, ` +
      `since Sep 1 ${pct(benchmark.sincePct)}. The book's equal-weighted figures ` +
      `are today ${pct(p.averageChangePct)} and since Sep 1 ${pct(since.changePct)}. ` +
      `The book is cap-agnostic and the benchmark is cap-weighted, so treat the ` +
      `gap as a rough read, not an attribution.`,
  );

  const symbols = new Set(p.holdings.map((h) => h.symbol));
  const reporting = s.earnings.filter((e) => symbols.has(e.symbol));
  if (reporting.length) {
    lines.push("", "## Holdings reporting today");
    for (const e of reporting) {
      lines.push(`- ${e.symbol}, ${e.time}, EPS consensus ${e.epsForecast}`);
    }
  }

  const terms = p.holdings.map((h) => ({ h, term: matchTerm(h.name) }));
  const related = s.headlines.filter((headline) =>
    terms.some(({ h, term }) => {
      const title = headline.title.toLowerCase();
      if (term.length >= 4 && title.includes(term.toLowerCase())) return true;
      return h.symbol.length >= 2 && new RegExp(`\\b${h.symbol}\\b`).test(headline.title);
    }),
  );
  if (related.length) {
    lines.push("", "## Headlines naming a holding");
    for (const h of related.slice(0, 8)) lines.push(`- [${h.source}] ${h.title}`);
  }

  lines.push("", "## The tape around it");
  for (const g of s.groups) {
    lines.push(
      `${g.title}: ` + g.quotes.map((q) => `${q.label} ${pct(q.changePct)}`).join(", "),
    );
  }
  const ten = s.curve.points.find((c) => c.label === "10Y")?.yield;
  if (ten != null) lines.push(`10-year Treasury ${ten}% (curve dated ${s.curve.date}).`);

  const pending = s.econ.filter((e) => !e.released);
  if (pending.length) {
    lines.push(
      "Still to print today: " +
        pending.map((e) => `${e.event} (${e.time} ET)`).join(", "),
    );
  }

  return lines.join("\n");
}
