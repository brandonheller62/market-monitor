import type { Metadata } from "next";
import { Portfolios } from "@/components/Portfolios";
import { getAllPortfolios, getBenchmark } from "@/lib/portfolios";
import { getPortfolioNote, settleNote } from "@/lib/note";
import type { NoteResult } from "@/lib/note";
import type { PortfolioId } from "@/lib/types";
import { sessionPhase } from "@/lib/format";

export const revalidate = 60;
// A regeneration that has to write fresh notes waits on the model.
export const maxDuration = 120;

export const metadata: Metadata = { title: "Portfolios · Market Monitor" };

export default async function PortfoliosPage() {
  const [portfolios, benchmark] = await Promise.all([
    getAllPortfolios(),
    getBenchmark(),
  ]);
  // Notes are cached apart from the page and rewritten at most once an hour,
  // so most regenerations read them straight from the cache.
  const bookNotes = await Promise.all(
    portfolios.map((p) => settleNote(getPortfolioNote(p.id))),
  );
  const notes = Object.fromEntries(
    portfolios.map((p, i) => [p.id, bookNotes[i]]),
  ) as Record<PortfolioId, NoteResult>;
  const phase = sessionPhase();

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-10 sm:px-8">
      <header className="rise">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span className="eyebrow">Market Monitor · {phase.recap}</span>
          <span className="eyebrow">Each read is written from its own holdings</span>
        </div>
        <h1 className="display mt-5 text-[clamp(2rem,6vw,4.5rem)] leading-[1.02] text-white">
          Portfolios
        </h1>
      </header>

      <div className="section-rule mt-10 pt-10">
        <Portfolios
          portfolios={portfolios}
          benchmark={benchmark}
          notes={notes}
        />
      </div>

      <footer className="section-rule mt-12 pt-6">
        <p className="data text-[0.6875rem] leading-relaxed text-[var(--muted)]">
          Quotes and price history from Nasdaq&rsquo;s API, delayed at the
          source. Book figures are equal-weighted because the sheets carry no
          share counts. Not investment advice.
        </p>
      </footer>
    </main>
  );
}
