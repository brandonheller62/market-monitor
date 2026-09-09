"use client";

import { useState } from "react";
import { Delta } from "./Delta";
import { renderMarkdown } from "./Markdown";
import { useStreamedText } from "./useStreamedText";
import { fmtPct, fmtPrice } from "@/lib/format";
import type { Portfolio } from "@/lib/types";

function Summary({ portfolio }: { portfolio: Portfolio }) {
  const { text, state } = useStreamedText(`/api/portfolio/${portfolio.id}`);

  return (
    <section
      aria-live="polite"
      aria-busy={state === "loading" || state === "streaming"}
    >
      <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-2">
        <h3 className="eyebrow">The read</h3>
        <span className="data text-[0.625rem] text-[var(--muted)]">
          {state === "loading"
            ? "Reading the holdings…"
            : state === "streaming"
              ? "Writing"
              : state === "off"
                ? "Unavailable"
                : "Generated in real time with the Anthropic and Nasdaq APIs"}
        </span>
      </div>

      <div className="brief mt-6">
        {state === "loading" && (
          <p className="text-[var(--muted)]">
            Pricing {portfolio.holdings.length} positions and reading them
            against the tape. <span className="caret" />
          </p>
        )}
        {state === "off" && <p className="text-[var(--muted)]">{text}</p>}
        {(state === "streaming" || state === "done") && (
          <>
            {renderMarkdown(text)}
            {state === "streaming" && <span className="caret" />}
          </>
        )}
      </div>
    </section>
  );
}

function Holdings({ portfolio }: { portfolio: Portfolio }) {
  const sorted = [...portfolio.holdings].sort(
    (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity),
  );

  return (
    <div className="space-y-4">
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
          <h3 className="eyebrow">Holdings</h3>
          <span className="data text-[0.625rem] text-[var(--muted)]">
            Ranked by session move
          </span>
        </div>
        <div className="mt-1">
          {sorted.map((h) => (
            <div
              key={h.symbol}
              className="row-rule flex items-baseline justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <span className="data text-[0.8125rem]">{h.symbol}</span>
                <span className="ml-2 text-[0.875rem] text-[var(--muted)]">
                  {h.name}
                </span>
              </div>
              <div className="flex shrink-0 items-baseline gap-3">
                <span className="data text-[0.8125rem]">{fmtPrice(h.price)}</span>
                <span className="w-16 text-right">
                  <Delta pct={h.changePct} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Portfolios({ portfolios }: { portfolios: Portfolio[] }) {
  const [activeId, setActiveId] = useState(portfolios[0]?.id);
  // A tab keeps its summary once opened, so switching back does not re-bill it.
  const [opened, setOpened] = useState<string[]>([portfolios[0]?.id]);
  const active = portfolios.find((p) => p.id === activeId) ?? portfolios[0];

  const select = (id: typeof activeId) => {
    setActiveId(id);
    setOpened((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

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
              onClick={() => select(p.id)}
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
          {opened.includes(p.id) && <Summary portfolio={p} />}
          <Holdings portfolio={p} />
        </div>
      ))}
    </div>
  );
}
