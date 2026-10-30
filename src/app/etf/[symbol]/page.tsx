import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Delta } from "@/components/Delta";
import { PriceChart } from "@/components/PriceChart";
import { fmtPct, fmtPrice } from "@/lib/format";
import { CHARTED_ETFS, findChartedEtf, getRecentCloses, quoteSymbol } from "@/lib/market";

export const revalidate = 60;

/** Calendar days back for each range tab. */
const RANGES = [
  { id: "1m", label: "1M", days: 31 },
  { id: "3m", label: "3M", days: 92 },
  { id: "6m", label: "6M", days: 183 },
  { id: "1y", label: "1Y", days: 366 },
  { id: "5y", label: "5Y", days: 5 * 366 },
] as const;
const DEFAULT_RANGE = "1y";

export async function generateMetadata({
  params,
}: PageProps<"/etf/[symbol]">): Promise<Metadata> {
  const { symbol } = await params;
  const etf = findChartedEtf(symbol);
  return { title: etf ? `${etf.symbol} · Market Monitor` : "Market Monitor" };
}

export default async function EtfPage({ params, searchParams }: PageProps<"/etf/[symbol]">) {
  const { symbol } = await params;
  const etf = findChartedEtf(symbol);
  if (!etf) notFound();

  const { range: asked } = await searchParams;
  const range = RANGES.find((r) => r.id === asked) ?? RANGES.find((r) => r.id === DEFAULT_RANGE)!;

  const [q, closes] = await Promise.all([
    quoteSymbol(etf.symbol, "etf"),
    getRecentCloses(etf.symbol, range.days, "etf"),
  ]);
  const first = closes[0]?.close;
  const last = closes.at(-1)?.close;
  const rangePct = first && last != null ? ((last - first) / first) * 100 : null;

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-10 sm:px-8">
      <header className="rise">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <Link href="/" className="eyebrow transition-colors hover:text-[var(--paper)]">
            &larr; Markets
          </Link>
          <span className="eyebrow">{etf.note}</span>
        </div>

        <h1 className="display mt-5 text-[clamp(2.75rem,11vw,7.5rem)] text-white">
          {etf.symbol}
        </h1>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-[1.25rem] text-[var(--muted)]">{etf.label}</span>
          <span className="data text-[1.75rem]">{fmtPrice(q.price)}</span>
          <span
            className={`data text-base ${
              (q.changePct ?? 0) >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
            }`}
          >
            {fmtPct(q.changePct)} today
          </span>
        </div>
      </header>

      <div className="section-rule mt-10 pt-8">
        <nav
          aria-label="Commodity ETFs"
          className="flex flex-wrap gap-x-8 gap-y-2 border-b border-[var(--line)]"
        >
          {CHARTED_ETFS.map((e) => {
            const isActive = e.symbol === etf.symbol;
            return (
              <Link
                key={e.symbol}
                href={`/etf/${e.symbol}?range=${range.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`-mb-px border-b-2 pb-3 transition-colors ${
                  isActive
                    ? "border-[var(--accent)] text-[var(--paper)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--paper)]"
                }`}
              >
                <span className="display block text-[clamp(1rem,2.4vw,1.5rem)]">{e.label}</span>
                <span className="data mt-1 block text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {e.note}
                </span>
              </Link>
            );
          })}
        </nav>

        <section className="panel mt-8 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="eyebrow">Price history</h2>
              <Delta pct={rangePct} />
            </div>
            <div className="flex gap-1" role="group" aria-label="Range">
              {RANGES.map((r) => (
                <Link
                  key={r.id}
                  href={`/etf/${etf.symbol}?range=${r.id}`}
                  scroll={false}
                  aria-current={r.id === range.id ? "true" : undefined}
                  className={`data px-2 py-1 text-[0.6875rem] tracking-[0.12em] transition-colors ${
                    r.id === range.id
                      ? "bg-[var(--accent)] text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--paper)]"
                  }`}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <PriceChart key={`${etf.symbol}-${range.id}`} closes={closes} label={etf.label} />
          </div>
        </section>
      </div>

      <footer className="section-rule mt-12 pt-6">
        <p className="data text-[0.6875rem] leading-relaxed text-[var(--muted)]">
          Daily closes from Nasdaq&rsquo;s API, delayed at the source. These are
          ETF share prices, not spot commodity levels: GLD tracks bullion less
          its fee, and USO&rsquo;s futures roll can drift from spot WTI over
          long windows. Not investment advice.
        </p>
      </footer>
    </main>
  );
}
