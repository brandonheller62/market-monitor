import { Curve } from "@/components/Curve";
import { Tape } from "@/components/Tape";
import { NotePanel } from "@/components/NotePanel";
import { getSnapshot } from "@/lib/snapshot";
import { getBriefNote, settleNote } from "@/lib/note";
import { sessionPhase } from "@/lib/format";

export const revalidate = 60;
// A regeneration that has to write fresh notes waits on the model.
export const maxDuration = 120;

export default async function Page() {
  const [snapshot, brief] = await Promise.all([
    getSnapshot(),
    // The note is cached apart from the page and rewritten at most once an
    // hour, so most regenerations read it straight from the cache.
    settleNote(getBriefNote()),
  ]);
  const phase = sessionPhase();
  // The desk note writes its own headline; until it has one, fall back to the name.
  const headline = ("note" in brief && brief.note.headline) || "Market Monitor";

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
            Market Monitor · {phase.recap} · {dateLine}
          </span>
          <span className="eyebrow">Data as of {stamp} ET</span>
        </div>

        <h1 className="display mt-5 max-w-[22ch] text-balance text-[clamp(2rem,6vw,4.5rem)] leading-[1.02] text-white">
          {headline}
        </h1>
      </header>

      <div className="section-rule mt-10 grid gap-10 pt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <NotePanel title="The note" result={brief} />
        <div className="space-y-4">
          <Tape groups={snapshot.groups} />
          <Curve curve={snapshot.curve} />
        </div>
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
          the Federal Reserve. Data refreshes every minute while the market
          is open and is delayed at the source. Not investment advice.
        </p>
      </footer>
    </main>
  );
}
