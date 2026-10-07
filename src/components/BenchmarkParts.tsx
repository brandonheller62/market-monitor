import { BenchmarkChart, Summary } from "./BenchmarkChart";
import type { Performance } from "@/lib/perf-math";

export type Heading = "h2" | "h3";

/** The vs-S&P card's frame, shared by the server-rendered stock card and the client-loaded book cards. */
export function Shell({
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

export function Body({
  perf,
  label,
  notes = [],
}: {
  perf: Performance | null;
  label: string;
  notes?: string[];
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
      {notes.map((note) => (
        <p key={note} className="data mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted)]">
          {note}
        </p>
      ))}
    </>
  );
}
