import { Curve } from "@/components/Curve";
import { Tape } from "@/components/Tape";
import { NotePanel } from "@/components/NotePanel";
import { Portfolios } from "@/components/Portfolios";
import { getSnapshot } from "@/lib/snapshot";
import { getAllPortfolios, getBenchmark } from "@/lib/portfolios";
import { getBriefNote, getPortfolioNote, settleNote } from "@/lib/note";
import type { NoteResult } from "@/lib/note";
import type { PortfolioId } from "@/lib/types";
import { REVALIDATE } from "@/lib/http";
import { sessionPhase } from "@/lib/format";

export const revalidate = 300;
// A regeneration that has to write fresh notes waits on the model.
export const maxDuration = 120;

export default async function Page() {
  const [snapshot, portfolios, benchmark] = await Promise.all([
    getSnapshot(),
    getAllPortfolios(),
    getBenchmark(),
  ]);
  // Notes are cached apart from the page and rewritten at most once an hour,
  // so most regenerations read them straight from the cache.
  const [brief, ...bookNotes] = await Promise.all([
    settleNote(getBriefNote()),
    ...portfolios.map((p) => settleNote(getPortfolioNote(p.id))),
  ]);
  const notes = Object.fromEntries(
    portfolios.map((p, i) => [p.id, bookNotes[i]]),
  ) as Record<PortfolioId, NoteResult>;
  const phase = sessionPhase();

  const dateLine = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(snapshot.generatedAt));

  const stamp = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(snapshot.generatedAt));

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-10 sm:px-8">
      <header className="rise">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span className="eyebrow">
            {phase.recap} · {dateLine}
          </span>
          <span className="eyebrow">Data as of {stamp} ET</span>
        </div>

        <h1 className="display mt-5 text-[clamp(2.75rem,11vw,7.5rem)] text-white">
          Market Monitor
        </h1>
      </header>

      <div className="section-rule mt-10 grid gap-10 pt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <NotePanel title="The note" result={brief} />
        <div className="space-y-4">
          <Tape groups={snapshot.groups} />
          <Curve curve={snapshot.curve} />
        </div>
      </div>

      <div className="section-rule mt-12 pt-10">
        <div className="mb-6 flex items-baseline justify-between">
          <span className="eyebrow">Portfolios</span>
          <span className="data text-[0.625rem] text-[var(--muted)]">
            Each read is written from its own holdings
          </span>
        </div>
        <Portfolios portfolios={portfolios} benchmark={benchmark} notes={notes} />
      </div>

      <footer className="section-rule mt-12 pt-6">
        {snapshot.degraded.length > 0 && (
          <p className="data mb-3 text-[0.75rem] text-[var(--down)]">
            Unavailable this run: {snapshot.degraded.join(", ")}. Everything
            else is live.
          </p>
        )}
        <p className="data text-[0.6875rem] leading-relaxed text-[var(--muted)]">
          Quotes and price history from Nasdaq&rsquo;s API · par yields from the
          US Treasury. The written notes also read Nasdaq&rsquo;s economic and
          earnings calendars and headlines from CNBC, MarketWatch, the FT and
          the Federal Reserve. Data refreshes every {REVALIDATE / 60} minutes
          and is delayed at the source. Not investment advice.
        </p>
      </footer>
    </main>
  );
}
