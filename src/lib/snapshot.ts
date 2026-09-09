import { getBoard, getCrypto, getCurve, getFx, getMovers } from "./market";
import { getEarnings, getEcon } from "./calendar";
import { getHeadlines } from "./news";
import type { Snapshot } from "./types";

/**
 * One fan-out across every upstream. All of them are cached by the Next data
 * cache for REVALIDATE seconds, so the page and the /api/brief route share the
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
  if (groups.every((g) => g.quotes.every((q) => q.price == null)))
    degraded.push("quotes");
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

/** Compact text rendering of the snapshot — this is what Claude reads. */
export function snapshotToPrompt(s: Snapshot): string {
  const pct = (n: number | null) => (n == null ? "n/a" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`);
  const lines: string[] = [];

  for (const g of s.groups) {
    lines.push(`## ${g.title}`);
    for (const q of g.quotes) {
      lines.push(`- ${q.label} (${q.note}): ${q.price ?? "n/a"} ${pct(q.changePct)}`);
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
      lines.push(`- ${e.time} ${e.country}: ${e.event} — ${result}`);
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
