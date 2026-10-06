import { BenchmarkChart, Summary } from "./BenchmarkChart";
import {
  getPortfolioPerformance,
  getStockPerformance,
  type Performance,
} from "@/lib/performance";
import type { PortfolioId } from "@/lib/types";

type Heading = "h2" | "h3";

function Shell({
  as: H,
  caption = "1 month · daily closes",
  children,
}: {
  as: Heading;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <H className="eyebrow">vs S&amp;P 500</H>
        <span className="data text-[0.625rem] text-[var(--muted)]">{caption}</span>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Fallback while the histories load, the chart's size so nothing shifts. */
export function BenchmarkSkeleton({ as = "h2" }: { as?: Heading }) {
  return (
    <Shell as={as}>
      <div className="pulse h-[112px] border-y border-dashed border-[var(--line-soft)]" />
      <div className="data mt-1.5 text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
        Loading closes
      </div>
      <div className="data mt-3 border-t border-[var(--line-soft)] pt-2 text-[0.6875rem] text-[var(--muted)]">
        &nbsp;
      </div>
    </Shell>
  );
}

function Body({
  perf,
  label,
  note,
}: {
  perf: Performance | null;
  label: string;
  note?: string;
}) {
  if (!perf) {
    return (
      <p className="data text-[0.8125rem] text-[var(--muted)]">
        Price history is unavailable right now.
      </p>
    );
  }
  return (
    <>
      <BenchmarkChart points={perf.points} label={label} up={perf.subjectPct >= 0} />
      <Summary label={label} subjectPct={perf.subjectPct} benchPct={perf.benchPct} />
      {note && (
        <p className="data mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted)]">{note}</p>
      )}
    </>
  );
}

export async function StockBenchmarkCard({ symbol }: { symbol: string }) {
  const perf = await getStockPerformance(symbol);
  return (
    <Shell as="h2">
      <Body perf={perf} label={symbol} />
    </Shell>
  );
}

export async function PortfolioBenchmarkCard({ id }: { id: PortfolioId }) {
  const perf = await getPortfolioPerformance(id);
  const missing = perf ? perf.total - perf.tracked : 0;
  return (
    <Shell as="h3">
      <Body
        perf={perf}
        label="Book"
        note={
          perf
            ? `Equal dollars in each holding at the first close, held.${
                missing > 0 ? ` ${missing} without history left out.` : ""
              }`
            : undefined
        }
      />
    </Shell>
  );
}
