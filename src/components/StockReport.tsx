"use client";

import { useEffect, useState } from "react";
import { renderMarkdown } from "./Markdown";
import type { StockReport as Report } from "@/lib/report";

type State =
  | { status: "loading" }
  | { status: "done"; report: Report }
  | { status: "error"; message: string };

function writtenLabel(iso: string, phase: string): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
  return `Written ${time} ET · ${phase.toLowerCase()}`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function fetchReport(symbol: string): Promise<State> {
  try {
    const res = await fetch(`/api/report/${encodeURIComponent(symbol)}`, { method: "POST" });
    const body = (await res.json()) as { report?: Report; error?: string };
    if (body.report) return { status: "done", report: body.report };
    return { status: "error", message: body.error ?? "The report could not be written." };
  } catch {
    return {
      status: "error",
      message: "The report could not be reached. Check your connection and try again.",
    };
  }
}

/**
 * The written report for one stock. Requested from the browser after the page
 * loads, so the prices render at once and the report fills in when it lands.
 */
export function StockReport({ symbol }: { symbol: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let current = true;
    fetchReport(symbol).then((next) => {
      if (current) setState(next);
    });
    return () => {
      current = false;
    };
  }, [symbol]);

  const retry = () => {
    setElapsed(0);
    setState({ status: "loading" });
    fetchReport(symbol).then(setState);
  };

  // A ticking clock while the report is written, so a 30-second wait reads as
  // progress rather than a hang.
  useEffect(() => {
    if (state.status !== "loading") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state.status]);

  return (
    <section className="min-w-0" aria-live="polite" aria-busy={state.status === "loading"}>
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] pb-2">
        <h2 className="eyebrow">The report</h2>
        <span className="data text-right text-[0.625rem] text-[var(--muted)]">
          {state.status === "done"
            ? writtenLabel(state.report.writtenAt, state.report.phase)
            : state.status === "loading"
              ? "Writing"
              : "Unavailable"}
        </span>
      </div>

      <div className="brief mt-6">
        {state.status === "loading" && (
          <div>
            <p className="text-[var(--muted)]">
              Reading the latest news on {symbol} and writing the report. A fresh
              one takes about half a minute; a recent one loads at once.
            </p>
            <p className="data text-[0.75rem] text-[var(--muted)]">
              <span className="pulse mr-2 inline-block h-1.5 w-1.5 bg-[var(--accent)] align-middle" />
              {elapsed}s
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div>
            <p className="text-[var(--muted)]">{state.message}</p>
            <button
              type="button"
              onClick={retry}
              className="data cursor-pointer border border-[var(--line)] px-3 py-1.5 text-[0.75rem] uppercase tracking-[0.18em] text-[var(--paper)] transition-colors hover:border-[var(--accent)]"
            >
              Try again
            </button>
          </div>
        )}

        {state.status === "done" && renderMarkdown(state.report.text)}
      </div>

      {state.status === "done" && state.report.sources.length > 0 && (
        <div className="mt-8 border-t border-[var(--line)] pt-4">
          <h3 className="eyebrow">Sources</h3>
          <ol className="mt-3 space-y-2">
            {state.report.sources.map((s, i) => (
              <li key={s.url} className="flex gap-3 text-[0.875rem] leading-snug">
                <span className="data w-5 shrink-0 text-right text-[0.75rem] text-[var(--muted)]">
                  {i + 1}
                </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--accent)]"
                >
                  {s.title}
                  <span className="data ml-2 text-[0.6875rem] text-[var(--muted)]">
                    {hostname(s.url)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
