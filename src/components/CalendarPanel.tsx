import { fmtCap } from "@/lib/format";
import type { Earning, EconEvent } from "@/lib/types";

function surprise(e: EconEvent): "beat" | "miss" | null {
  if (!e.released) return null;
  const a = Number(e.actual.replace(/[^\d.-]/g, ""));
  const c = Number(e.consensus.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(a) || !Number.isFinite(c) || a === c) return null;
  return a > c ? "beat" : "miss";
}

export function EconPanel({ econ }: { econ: EconEvent[] }) {
  return (
    <section className="panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">On the calendar</h2>
        <span className="data text-[0.625rem] text-[var(--muted)]">
          Actual · consensus · prior
        </span>
      </div>

      {econ.length === 0 ? (
        <p className="data mt-3 text-[0.8125rem] text-[var(--muted)]">
          Nothing scheduled on today&rsquo;s economic calendar.
        </p>
      ) : (
        <div className="mt-1">
          {econ.map((e, i) => {
            const s = surprise(e);
            return (
              <div key={`${e.event}-${i}`} className="row-rule py-2.5">
                <div className="flex items-baseline gap-3">
                  <span className="data w-12 shrink-0 text-[0.75rem] text-[var(--muted)]">
                    {e.time}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.9375rem]">
                    {e.event}
                    <span className="data ml-2 text-[0.625rem] uppercase tracking-[0.15em] text-[var(--muted)]">
                      {e.country}
                    </span>
                  </span>
                </div>
                <div className="data mt-1 flex items-baseline gap-3 pl-15 text-[0.8125rem]">
                  <span
                    className={
                      s === "beat"
                        ? "text-[var(--up)]"
                        : s === "miss"
                          ? "text-[var(--down)]"
                          : e.released
                            ? "text-[var(--paper)]"
                            : "text-[var(--muted)]"
                    }
                  >
                    {e.released ? e.actual : "pending"}
                  </span>
                  <span className="text-[var(--muted)]">
                    {e.consensus || "n/a"} cons.
                  </span>
                  <span className="text-[var(--muted)]">{e.previous || "n/a"} prior</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function EarningsPanel({ earnings }: { earnings: Earning[] }) {
  if (earnings.length === 0) return null;
  return (
    <section className="panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">Reporting today</h2>
        <span className="data text-[0.625rem] text-[var(--muted)]">
          Largest by market cap
        </span>
      </div>
      <div className="mt-1">
        {earnings.map((e) => (
          <div
            key={e.symbol}
            className="row-rule flex items-baseline justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <span className="data text-[0.8125rem]">{e.symbol}</span>
              <span className="ml-2 text-[0.9375rem] text-[var(--muted)]">{e.name}</span>
            </div>
            <div className="shrink-0 text-right">
              <div className="data text-[0.75rem]">{e.time}</div>
              <div className="data text-[0.6875rem] text-[var(--muted)]">
                {fmtCap(e.marketCap)} · EPS {e.epsForecast}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
