import { easternNow, parseClock } from "@/lib/format";
import type { EconEvent } from "@/lib/types";

const START = 0; // 00:00 ET
const END = 20 * 60; // 20:00 ET
const SPAN = END - START;

const pos = (minutes: number) =>
  Math.min(100, Math.max(0, ((minutes - START) / SPAN) * 100));

const BANDS = [
  { name: "Asia", from: 0, to: 2 * 60, hint: "Tokyo, Hong Kong into the close" },
  { name: "Europe", from: 3 * 60, to: 11 * 60 + 30, hint: "London cash hours" },
  { name: "US cash", from: 9 * 60 + 30, to: 16 * 60, hint: "NYSE and Nasdaq" },
];

const HOURS = [0, 4, 8, 12, 16, 20];

/**
 * The session strip: one ruled day, 00:00–20:00 ET, showing which desks were
 * open when, where today's scheduled prints land, and where "now" sits against
 * both. Filled ticks are releases that have already printed.
 */
export function SessionClock({ econ }: { econ: EconEvent[] }) {
  const now = easternNow();
  const events = econ
    .map((e) => ({ ...e, minutes: parseClock(e.time) }))
    .filter((e): e is EconEvent & { minutes: number } => e.minutes != null)
    .filter((e) => e.minutes >= START && e.minutes <= END)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 10);

  return (
    <section aria-label="Session timeline" className="mt-10">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">The session so far</span>
        <span className="eyebrow">
          Now · {now.label} ET
        </span>
      </div>

      <div className="relative mt-4 select-none overflow-hidden">
        {/* hour gridlines */}
        <div className="absolute inset-0" aria-hidden>
          {HOURS.map((h) => (
            <div
              key={h}
              className="strip-tick"
              style={{ left: `${pos(h * 60)}%` }}
            />
          ))}
        </div>

        {/* now marker */}
        {now.minutes >= START && now.minutes <= END && (
          <div
            className="now-marker absolute top-0 bottom-0 w-px z-10"
            style={{ left: `${pos(now.minutes)}%` }}
            aria-hidden
          />
        )}

        <div className="relative space-y-1.5 py-1">
          {BANDS.map((band) => (
            <div key={band.name} className="relative h-9">
              <span
                className="eyebrow absolute top-0 text-[0.625rem] whitespace-nowrap"
                style={{ left: `${pos(band.from)}%` }}
                title={band.hint}
              >
                {band.name}
              </span>
              <div
                className="absolute bottom-1 h-1.5 rounded-[3px]"
                style={{
                  left: `${pos(band.from)}%`,
                  width: `${pos(band.to) - pos(band.from)}%`,
                  background:
                    band.name === "US cash"
                      ? "linear-gradient(90deg, var(--dawn-deep), var(--dawn))"
                      : "var(--line)",
                }}
              />
            </div>
          ))}
        </div>

        {/* scheduled releases */}
        <div className="relative mt-3 h-10 border-t border-[var(--line-soft)]">
          {events.map((e, i) => (
            <div
              key={`${e.event}-${i}`}
              className="absolute top-0"
              style={{ left: `${pos(e.minutes)}%` }}
            >
              <div
                className="h-2.5 w-2.5 -translate-x-1/2 rounded-full border"
                style={{
                  borderColor: "var(--dawn)",
                  background: e.released ? "var(--dawn)" : "transparent",
                }}
                title={`${e.time} ET · ${e.country} · ${e.event}`}
              />
            </div>
          ))}
          <div className="absolute top-4 left-0 right-0 flex justify-between">
            {HOURS.map((h) => (
              <span key={h} className="data text-[0.625rem] text-[var(--muted)]">
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="data mt-2 text-[0.6875rem] text-[var(--muted)]">
        Dots are scheduled economic releases, filled once the number has printed.
        {events.length === 0 && " No timed releases on the calendar today."}
      </p>
    </section>
  );
}
