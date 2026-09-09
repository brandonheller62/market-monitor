import { Brief } from "@/components/Brief";
import { Curve } from "@/components/Curve";
import { EarningsPanel, EconPanel } from "@/components/CalendarPanel";
import { Headlines } from "@/components/Headlines";
import { Movers } from "@/components/Movers";
import { MiniTape, Tape } from "@/components/Tape";
import { Portfolios } from "@/components/Portfolios";
import { getSnapshot } from "@/lib/snapshot";
import { getAllPortfolios } from "@/lib/portfolios";
import { REVALIDATE } from "@/lib/http";
import { easternNow, parseClock, sessionPhase } from "@/lib/format";
import type { Snapshot } from "@/lib/types";

export const revalidate = 300;

/** One factual sentence under the masthead. No interpretation, that's the note's job. */
function tapeLine(s: Snapshot): string {
  const equities = s.groups[0]?.quotes ?? [];
  const scored = equities.filter((q) => q.changePct != null);
  const up = scored.filter((q) => (q.changePct ?? 0) > 0).length;
  const ten = s.curve.points.find((p) => p.label === "10Y")?.yield;
  // Counted off the clock, not the `released` flag: the calendar feed prefills
  // figures for releases that have not happened yet, so "still to print" has to
  // come from the scheduled time.
  const nowMinutes = easternNow().minutes;
  const pending = s.econ.filter((e) => {
    const at = parseClock(e.time);
    return at == null ? !e.released : at > nowMinutes;
  }).length;

  const parts: string[] = [];
  if (scored.length) {
    parts.push(
      up === scored.length
        ? `All ${scored.length} equity gauges higher`
        : up === 0
          ? `All ${scored.length} equity gauges lower`
          : `${up} of ${scored.length} equity gauges higher`,
    );
  }
  if (ten != null) parts.push(`the 10-year at ${ten.toFixed(2)}%`);
  parts.push(
    pending > 0
      ? `${pending} release${pending === 1 ? "" : "s"} still to print`
      : "the calendar already cleared",
  );
  return `${parts.join(", ")}.`;
}

export default async function Page() {
  const [snapshot, portfolios] = await Promise.all([
    getSnapshot(),
    getAllPortfolios(),
  ]);
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
          <span className="eyebrow">Morning recap · {dateLine}</span>
          <span className="eyebrow">
            {phase.label} · Assembled {stamp} ET
          </span>
        </div>

        <h1
          className="display mt-5 text-[clamp(2.75rem,11vw,7.5rem)]"
          style={{
            background: "linear-gradient(96deg, var(--paper) 30%, var(--dawn))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          The Overnight
        </h1>

        <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-[var(--muted)]">
          {tapeLine(snapshot)}
        </p>
      </header>

      <div className="section-rule mt-10 grid gap-10 pt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Brief />
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
        <Portfolios portfolios={portfolios} />
      </div>

      <div className="section-rule mt-12 grid gap-4 pt-10 lg:grid-cols-2">
        <EconPanel econ={snapshot.econ} />
        <div className="space-y-4">
          <EarningsPanel earnings={snapshot.earnings} />
          <MiniTape title="Crypto" quotes={snapshot.crypto} />
          {snapshot.fx.length > 0 && (
            <section className="panel px-4 py-3">
              <h2 className="eyebrow">Dollar crosses</h2>
              <div className="mt-1">
                {snapshot.fx.map((f) => (
                  <div
                    key={f.pair}
                    className="row-rule flex items-baseline justify-between py-2"
                  >
                    <span className="text-[0.9375rem]">{f.pair}</span>
                    <span className="data text-[0.875rem]">
                      {f.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="section-rule mt-12 space-y-4 pt-10">
        <Movers gainers={snapshot.gainers} losers={snapshot.losers} />
        <Headlines headlines={snapshot.headlines} />
      </div>

      <footer className="section-rule mt-12 pt-6">
        {snapshot.degraded.length > 0 && (
          <p className="data mb-3 text-[0.75rem] text-[var(--down)]">
            Unavailable this run: {snapshot.degraded.join(", ")}. Everything else on
            this page is live.
          </p>
        )}
        <p className="data text-[0.6875rem] leading-relaxed text-[var(--muted)]">
          Quotes, movers and calendars from Nasdaq&rsquo;s public API · par yields
          from the US Treasury · FX from Frankfurter · crypto from CoinGecko ·
          headlines from CNBC, MarketWatch, the FT and the Federal Reserve. Data
          refreshes every {REVALIDATE / 60} minutes and is delayed at the
          source. Not investment advice.
        </p>
      </footer>
    </main>
  );
}
