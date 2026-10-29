"use client";

import { useState } from "react";
import { fmtPct, fmtPrice, fmtShortDate } from "@/lib/format";

const W = 600;
const H = 280;

/** "Oct 5, 2025" when the window spans years, else "Oct 5". */
function when(date: string, withYear: boolean): string {
  if (!withYear) return fmtShortDate(date);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * One ETF's daily closes as a price line, colored by the window's direction,
 * with the first close dashed across as the reference and a hover readout of
 * the close and its move from the start. Drawn the way BenchmarkChart draws:
 * a stretched viewBox with non-scaling strokes and HTML dots.
 */
export function PriceChart({
  closes,
  label,
}: {
  closes: { date: string; close: number }[];
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (closes.length < 2) {
    return (
      <p className="data py-16 text-center text-[0.8125rem] text-[var(--muted)]">
        Nasdaq did not return a price history for this window. Try another range.
      </p>
    );
  }

  const first = closes[0].close;
  const values = closes.map((c) => c.close);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || 1) * 0.08;
  const x = (i: number) => (i / (closes.length - 1)) * W;
  const y = (v: number) => H - ((v - lo + pad) / (hi - lo + 2 * pad)) * H;
  const line = closes.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(c.close).toFixed(2)}`).join("");
  const area = `${line}L${W},${H}L0,${H}Z`;

  const up = closes.at(-1)!.close >= first;
  const color = up ? "var(--up)" : "var(--down)";
  const withYear = closes[0].date.slice(0, 4) !== closes.at(-1)!.date.slice(0, 4);
  const active = hover != null ? closes[hover] : null;
  const leftPct = (i: number) => (x(i) / W) * 100;

  function track(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(closes.length - 1, Math.round(t * (closes.length - 1)))));
  }

  const svg = "absolute inset-0 h-full w-full overflow-visible";

  return (
    <div>
      <div className="data mb-2 flex justify-between text-[0.625rem] text-[var(--muted)]">
        <span>High {fmtPrice(hi)}</span>
        <span>Low {fmtPrice(lo)}</span>
      </div>
      <div
        className="relative touch-none select-none"
        style={{ height: H }}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${label} daily closes from ${when(closes[0].date, true)} to ${when(closes.at(-1)!.date, true)}`}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={svg} aria-hidden>
          <defs>
            <linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#price-fill)" />
          <line
            x1={0}
            x2={W}
            y1={y(first)}
            y2={y(first)}
            stroke="var(--line)"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
          {hover != null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={0}
              y2={H}
              stroke="var(--line)"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`${svg} draw-lines`} aria-hidden>
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={1.75}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {active && hover != null && (
          <>
            <span
              className="pointer-events-none absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--ink-2)]"
              style={{ left: `${leftPct(hover)}%`, top: `${(y(active.close) / H) * 100}%`, background: color }}
            />
            <div
              className="data pointer-events-none absolute top-0 z-10 whitespace-nowrap border border-[var(--line)] bg-[var(--ink)] px-2 py-1.5 text-[0.6875rem] leading-[1.5] shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
              style={
                leftPct(hover) > 55
                  ? { right: `calc(${100 - leftPct(hover)}% + 10px)` }
                  : { left: `calc(${leftPct(hover)}% + 10px)` }
              }
            >
              <div className="text-[var(--muted)]">{when(active.date, true)}</div>
              <div className="flex justify-between gap-4">
                <span>Close</span>
                <span>{fmtPrice(active.close)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">From start</span>
                <span style={{ color: active.close >= first ? "var(--up)" : "var(--down)" }}>
                  {fmtPct(((active.close - first) / first) * 100)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="data mt-1.5 flex justify-between text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
        <span>{when(closes[0].date, withYear)}</span>
        <span>{when(closes.at(-1)!.date, withYear)}</span>
      </div>
    </div>
  );
}
