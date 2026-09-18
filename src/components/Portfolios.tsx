"use client";

import { useState } from "react";
import { Delta } from "./Delta";
import { NotePanel } from "./NotePanel";
import { fmtMoney, fmtPct, fmtPrice, fmtShortDate } from "@/lib/format";
import type { NoteResult } from "@/lib/note";
import type { Benchmark, Portfolio, PortfolioId } from "@/lib/types";

/** Points of out- or under-performance, stated as a gap rather than a ratio. */
function gap(portfolio: number | null, bench: number | null): string {
  if (portfolio == null || bench == null) return "n/a";
  const d = portfolio - bench;
  return `${d > 0 ? "+" : ""}${d.toFixed(2)} pts`;
}

function BenchmarkPanel({
  benchmark,
  portfolio,
}: {
  benchmark: Benchmark;
  portfolio: Portfolio;
}) {
  const rows: [string, number | null, number | null][] = [
    ["Today", benchmark.changePct, portfolio.averageChangePct],
    ["Since Sep 1", benchmark.sincePct, portfolio.since.changePct],
  ];

  return (
    <section className="panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h3 className="eyebrow">S&amp;P 500 benchmark</h3>
        <span className="data text-[0.625rem] text-[var(--muted)]">
          {benchmark.note}
        </span>
      </div>

      <div className="data mt-3 flex items-baseline justify-between gap-3 border-b border-[var(--line-soft)] pb-1.5 text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
        <span>Window</span>
        <span className="flex shrink-0 items-baseline gap-3 whitespace-nowrap">
          <span className="w-16 text-right sm:w-20">S&amp;P 500</span>
          <span className="w-16 text-right sm:w-20">This book</span>
          <span className="w-16 text-right sm:w-20">Gap</span>
        </span>
      </div>

      <div>
        {rows.map(([label, bench, book]) => (
          <div
            key={label}
            className="row-rule flex items-baseline justify-between gap-3 py-2.5"
          >
            <span className="min-w-0 truncate text-[0.875rem]">{label}</span>
            <span className="flex shrink-0 items-baseline gap-3">
              <span className="w-16 text-right sm:w-20">
                <Delta pct={bench} />
              </span>
              <span className="w-16 text-right sm:w-20">
                <Delta pct={book} />
              </span>
              <span
                className={`data w-16 text-right text-[0.8125rem] sm:w-20 ${
                  book != null && bench != null && book - bench >= 0
                    ? "text-[var(--up)]"
                    : "text-[var(--down)]"
                }`}
              >
                {gap(book, bench)}
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="data mt-2 text-[0.6875rem] leading-relaxed text-[var(--muted)]">
        The book&rsquo;s figures are equal-weighted, the benchmark is
        cap-weighted, so the gap is a rough read rather than an attribution.
      </p>
    </section>
  );
}

function Holdings({
  portfolio,
  benchmark,
}: {
  portfolio: Portfolio;
  benchmark: Benchmark;
}) {
  const sorted = [...portfolio.holdings].sort(
    (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity),
  );
  const since = portfolio.since;

  return (
    <div className="min-w-0 space-y-4">
      <section className="panel px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h3 className="eyebrow">Equal-weighted session</h3>
          <span className="data text-[0.625rem] text-[var(--muted)]">
            No share counts
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div
              className={`data text-2xl ${
                (portfolio.averageChangePct ?? 0) >= 0
                  ? "text-[var(--up)]"
                  : "text-[var(--down)]"
              }`}
            >
              {fmtPct(portfolio.averageChangePct)}
            </div>
            <div className="data mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
              Average holding move
            </div>
          </div>
          <div>
            <div className="data text-2xl">
              {portfolio.advancing}/{portfolio.priced}
            </div>
            <div className="data mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
              Advancing
            </div>
          </div>
        </div>
      </section>

      <section className="panel px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h3 className="eyebrow">Since September 1</h3>
          <span className="data text-[0.625rem] text-[var(--muted)]">
            From the {fmtShortDate(since.baselineDate)} close
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="data text-[1.75rem]">
            {fmtMoney(since.currentValue)}
          </span>
          <span
            className={`data text-base ${
              (since.changePct ?? 0) >= 0
                ? "text-[var(--up)]"
                : "text-[var(--down)]"
            }`}
          >
            {fmtPct(since.changePct)}
          </span>
        </div>
        <p className="data mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted)]">
          What {fmtMoney(since.startValue)} would be worth now, split equally
          across the {since.tracked} holdings at their{" "}
          {fmtShortDate(since.baselineDate)} close. Hypothetical: the sheet
          carries no share counts, so this is not the book&rsquo;s real value.
        </p>

        {since.best && since.worst && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--line-soft)] pt-3">
            <div>
              <div className="data text-[0.8125rem]">
                {since.best.symbol}{" "}
                <span className="text-[var(--up)]">
                  {fmtPct(since.best.sincePct)}
                </span>
              </div>
              <div className="data mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                Best since Sep 1
              </div>
            </div>
            <div>
              <div className="data text-[0.8125rem]">
                {since.worst.symbol}{" "}
                <span className="text-[var(--down)]">
                  {fmtPct(since.worst.sincePct)}
                </span>
              </div>
              <div className="data mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                Worst since Sep 1
              </div>
            </div>
          </div>
        )}
      </section>

      <BenchmarkPanel benchmark={benchmark} portfolio={portfolio} />

      <section className="panel px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h3 className="eyebrow">Holdings</h3>
          <span className="data text-[0.625rem] text-[var(--muted)]">
            Ranked by session move
          </span>
        </div>

        <div className="data mt-3 flex items-baseline justify-between gap-3 border-b border-[var(--line-soft)] pb-1.5 text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
          <span>Holding</span>
          <span className="flex shrink-0 items-baseline gap-3 whitespace-nowrap">
            <span className="w-16 text-right sm:w-20">Last</span>
            <span className="w-14 text-right sm:w-16">Today</span>
            <span className="w-16 text-right sm:w-24">
              <span className="sm:hidden">Sep 1</span>
              <span className="hidden sm:inline">Since Sep 1</span>
            </span>
          </span>
        </div>

        <div>
          {sorted.map((h) => (
            <div
              key={h.symbol}
              className="row-rule flex items-baseline justify-between gap-3 py-2.5"
            >
              <div className="min-w-0 truncate">
                <span className="data text-[0.8125rem]">{h.symbol}</span>
                <span className="ml-2 text-[0.875rem] text-[var(--muted)]">
                  {h.name}
                </span>
              </div>
              <div className="flex shrink-0 items-baseline gap-3">
                <span className="data w-16 text-right text-[0.8125rem] sm:w-20">
                  {fmtPrice(h.price)}
                </span>
                <span className="w-14 text-right sm:w-16">
                  <Delta pct={h.changePct} />
                </span>
                <span className="w-16 text-right sm:w-24">
                  <Delta pct={h.sincePct} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Portfolios({
  portfolios,
  benchmark,
  notes,
}: {
  portfolios: Portfolio[];
  benchmark: Benchmark;
  /** Written on the server, one per book, so every tab's read is in the HTML. */
  notes: Record<PortfolioId, NoteResult>;
}) {
  const [activeId, setActiveId] = useState(portfolios[0]?.id);
  const active = portfolios.find((p) => p.id === activeId) ?? portfolios[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Portfolios"
        className="flex flex-wrap gap-x-8 gap-y-2 border-b border-[var(--line)]"
      >
        {portfolios.map((p) => {
          const isActive = p.id === active.id;
          return (
            <button
              key={p.id}
              role="tab"
              type="button"
              id={`tab-${p.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${p.id}`}
              onClick={() => setActiveId(p.id)}
              className={`-mb-px cursor-pointer border-b-2 pb-3 text-left transition-colors ${
                isActive
                  ? "border-[var(--accent)] text-[var(--paper)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--paper)]"
              }`}
            >
              <span className="display block text-[clamp(1rem,2.4vw,1.5rem)]">
                {p.name}
              </span>
              <span className="data mt-1 block text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                {p.blurb} · avg {fmtPct(p.averageChangePct)}
              </span>
            </button>
          );
        })}
      </div>

      {portfolios.map((p) => (
        <div
          key={p.id}
          role="tabpanel"
          id={`panel-${p.id}`}
          aria-labelledby={`tab-${p.id}`}
          hidden={p.id !== active.id}
          className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
        >
          <NotePanel title="The read" as="h3" result={notes[p.id]} />
          <Holdings portfolio={p} benchmark={benchmark} />
        </div>
      ))}
    </div>
  );
}
