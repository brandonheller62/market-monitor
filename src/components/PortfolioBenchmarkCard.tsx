"use client";

import { useEffect, useState } from "react";
import { BenchmarkSkeleton, Body, Shell } from "./BenchmarkParts";
import { bookPerformance, type Closes } from "@/lib/perf-math";

type History = { series: Record<string, Closes>; failed: { symbol: string; reason: string }[] };

/**
 * One request per page for every book's tickers, shared by all three cards.
 * Keyed by the sorted symbol list so the URL, and the edge cache entry behind
 * it, is the same on every visit. A failed request is forgotten so the next
 * mount tries again.
 */
const requests = new Map<string, Promise<History | null>>();

function loadHistory(symbols: string[]): Promise<History | null> {
  const key = [...new Set(symbols)].sort().join(",");
  let pending = requests.get(key);
  if (!pending) {
    pending = fetch(`/api/history?symbols=${key}`)
      .then((res) => (res.ok ? (res.json() as Promise<History>) : null))
      .catch(() => null)
      .then((history) => {
        if (!history) requests.delete(key);
        return history;
      });
    requests.set(key, pending);
  }
  return pending;
}

/**
 * A book's vs-S&P card, loaded in the browser from the history proxy so a
 * throttled fetch at build time can never bake a blank chart into the page.
 * `union` is every book's tickers, so all three cards share one request.
 */
export function PortfolioBenchmarkCard({
  symbols,
  union,
}: {
  symbols: string[];
  union: string[];
}) {
  const [history, setHistory] = useState<History | null | undefined>(undefined);
  const key = union.join(",");

  useEffect(() => {
    let live = true;
    loadHistory(key.split(",")).then((h) => {
      if (live) setHistory(h);
    });
    return () => {
      live = false;
    };
  }, [key]);

  if (history === undefined) return <BenchmarkSkeleton as="h3" />;

  const { perf, missing } = history
    ? bookPerformance(symbols, history.series)
    : { perf: null, missing: symbols };

  const notes = ["Equal dollars in each holding at the first close, held."];
  if (perf && missing.length > 0) {
    notes.push(
      `${missing.length} ${missing.length === 1 ? "ticker" : "tickers"} missing: ${missing.join(", ")}`,
    );
  }

  return (
    <Shell as="h3">
      <Body perf={perf} label="Book" notes={perf ? notes : []} />
    </Shell>
  );
}
