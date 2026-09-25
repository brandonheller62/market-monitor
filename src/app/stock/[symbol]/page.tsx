import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Delta } from "@/components/Delta";
import { StockReport } from "@/components/StockReport";
import { fmtCap, fmtPct, fmtPrice, fmtShortDate } from "@/lib/format";
import { findHolding } from "@/lib/portfolios";
import { getStock } from "@/lib/stock";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/stock/[symbol]">): Promise<Metadata> {
  const { symbol } = await params;
  const holding = findHolding(symbol);
  return { title: holding ? `${holding.symbol} · Market Monitor` : "Market Monitor" };
}

export default async function StockPage({ params }: PageProps<"/stock/[symbol]">) {
  const { symbol } = await params;
  const stock = await getStock(symbol);
  if (!stock) notFound();

  const windows: [string, number | null][] = [
    ["Today", stock.changePct],
    ["5 sessions", stock.fiveDayPct],
    ["1 month", stock.oneMonthPct],
    [`Since ${fmtShortDate(stock.sinceDate)}`, stock.sincePct],
  ];

  const facts: [string, string | null][] = [
    ["Sector", stock.sector],
    ["Industry", stock.industry],
    ["Market cap", stock.marketCap != null ? fmtCap(stock.marketCap) : null],
    ["52-week high/low", stock.range52w],
    ["Analyst 1-year target", stock.target1y],
    ["Volume / average", stock.volume && stock.avgVolume ? `${stock.volume} / ${stock.avgVolume}` : null],
  ];

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-10 sm:px-8">
      <header className="rise">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <Link href="/" className="eyebrow transition-colors hover:text-[var(--paper)]">
            &larr; Market Monitor
          </Link>
          <span className="eyebrow">
            Held in {stock.books.map((b) => b.name).join(" · ")}
          </span>
        </div>

        <h1 className="display mt-5 text-[clamp(2.75rem,11vw,7.5rem)] text-white">
          {stock.symbol}
        </h1>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-[1.25rem] text-[var(--muted)]">{stock.name}</span>
          <span className="data text-[1.75rem]">{fmtPrice(stock.price)}</span>
          <span
            className={`data text-base ${
              (stock.changePct ?? 0) >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
            }`}
          >
            {fmtPct(stock.changePct)} today
          </span>
        </div>
      </header>

      <div className="section-rule mt-10 grid gap-10 pt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <StockReport symbol={stock.symbol} />

        <div className="min-w-0 space-y-4">
          <section className="panel px-4 py-3">
            <div className="flex items-baseline justify-between">
              <h2 className="eyebrow">Moves</h2>
              <span className="data text-[0.625rem] text-[var(--muted)]">
                From Nasdaq daily closes
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
              {windows.map(([label, pct]) => (
                <div key={label}>
                  <Delta pct={pct} size="lg" />
                  <div className="data mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel px-4 py-3">
            <h2 className="eyebrow">The company</h2>
            <div className="mt-2">
              {facts.map(([label, value]) => (
                <div
                  key={label}
                  className="row-rule flex items-baseline justify-between gap-3 py-2.5"
                >
                  <span className="text-[0.875rem] text-[var(--muted)]">{label}</span>
                  <span className="data min-w-0 truncate text-right text-[0.8125rem]">
                    {value ?? "n/a"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="section-rule mt-12 pt-6">
        <p className="data text-[0.6875rem] leading-relaxed text-[var(--muted)]">
          Prices, history and company facts from Nasdaq&rsquo;s API, delayed at
          the source. The report is written by Claude from a web search of
          recent news and is refreshed at most once an hour. It is a read of the
          news, not investment advice.
        </p>
      </footer>
    </main>
  );
}
