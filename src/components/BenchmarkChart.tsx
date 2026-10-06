"use client";

import { useRef, useState } from "react";
import { fmtPct, fmtShortDate } from "@/lib/format";
import type { PerfPoint } from "@/lib/performance";

const W = 300;

/** "Oct 5", or "Latest" for the live point after the last close. */
const when = (p: PerfPoint) => (p.date ? fmtShortDate(p.date) : "Latest");

/** "MU +3.76% vs S&P +1.20% · +2.56 pts", in the card's monospace row. */
export function Summary({
  label,
  subjectPct,
  benchPct,
}: {
  label: string;
  subjectPct: number;
  benchPct: number;
}) {
  const gap = subjectPct - benchPct;
  return (
    <p className="data mt-3 border-t border-[var(--line-soft)] pt-2 text-[0.6875rem] text-[var(--muted)]">
      {label}{" "}
      <span className={subjectPct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>
        {fmtPct(subjectPct)}
      </span>{" "}
      vs S&amp;P <span className="text-[var(--paper)]">{fmtPct(benchPct)}</span>
      {" · "}
      <span className={gap >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>
        {`${gap > 0 ? "+" : ""}${gap.toFixed(2)} pts`}
      </span>
    </p>
  );
}

/**
 * Two rebased lines, the subject in its period's up or down color and SPY in
 * muted gray, with a hover readout. Drawn in a stretched viewBox so it fills
 * its box at any width; strokes stay hairline with non-scaling-stroke, and
 * the hover dots are HTML so they stay round. With `draw`, the lines reveal
 * left to right while the baseline and axis labels stay put.
 */
function Plot({
  points,
  label,
  up,
  height,
  draw = false,
}: {
  points: PerfPoint[];
  label: string;
  up: boolean;
  height: number;
  draw?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;

  const values = points.flatMap((p) => [p.subject, p.bench, 0]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || 1) * 0.1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - lo + pad) / (hi - lo + 2 * pad)) * H;
  const path = (key: "subject" | "bench") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p[key]).toFixed(2)}`).join("");

  const color = up ? "var(--up)" : "var(--down)";
  const active = hover != null ? points[hover] : null;
  const leftPct = (i: number) => (x(i) / W) * 100;
  const topPct = (v: number) => (y(v) / H) * 100;

  function track(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(t * (points.length - 1)))));
  }

  const svg = "absolute inset-0 h-full w-full overflow-visible";

  return (
    <div>
      <div
        className="relative touch-none select-none"
        style={{ height: H }}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${label} against the S&P 500 over one month`}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={svg} aria-hidden>
          <line
            x1={0}
            x2={W}
            y1={y(0)}
            y2={y(0)}
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
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={`${svg} ${draw ? "draw-lines" : ""}`}
          aria-hidden
        >
          <path
            d={path("bench")}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1.25}
            strokeOpacity={0.8}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path("subject")}
            fill="none"
            stroke={color}
            strokeWidth={draw ? 2 : 1.75}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {active && hover != null && (
          <>
            {(["bench", "subject"] as const).map((key) => (
              <span
                key={key}
                className="pointer-events-none absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--ink-2)]"
                style={{
                  left: `${leftPct(hover)}%`,
                  top: `${topPct(active[key])}%`,
                  background: key === "subject" ? color : "var(--muted)",
                }}
              />
            ))}
            <div
              className="data pointer-events-none absolute top-0 z-10 whitespace-nowrap border border-[var(--line)] bg-[var(--ink)] px-2 py-1.5 text-[0.6875rem] leading-[1.5] shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
              style={
                leftPct(hover) > 55
                  ? { right: `calc(${100 - leftPct(hover)}% + 10px)` }
                  : { left: `calc(${leftPct(hover)}% + 10px)` }
              }
            >
              <div className="text-[var(--muted)]">{when(active)}</div>
              <div className="flex justify-between gap-4">
                <span>{label}</span>
                <span style={{ color: active.subject >= 0 ? "var(--up)" : "var(--down)" }}>
                  {fmtPct(active.subject)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">S&amp;P 500</span>
                <span className="text-[var(--muted)]">{fmtPct(active.bench)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="data mt-1.5 flex justify-between text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
        <span>{when(points[0])}</span>
        <span>{when(points.at(-1)!)}</span>
      </div>
    </div>
  );
}

/**
 * The card's compact chart. Clicking it opens an enlarged view in a modal
 * dialog where the two lines draw in over a second and a half, replaying on every
 * open. The dialog is native, so Esc closes it and focus returns to the chart.
 */
export function BenchmarkChart({
  points,
  label,
  up,
}: {
  points: PerfPoint[];
  label: string;
  up: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Bumped on each open so the zoomed plot remounts and the drawing replays.
  const [opened, setOpened] = useState(0);
  const end = points.at(-1)!;

  function open() {
    setOpened((n) => n + 1);
    dialog.current?.showModal();
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Enlarge the ${label} vs S&P 500 chart`}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="cursor-zoom-in"
      >
        <Plot points={points} label={label} up={up} height={112} />
      </div>

      <dialog
        ref={dialog}
        className="chart-zoom"
        aria-label={`${label} vs S&P 500, one month`}
        onClose={() => setOpened(0)}
        // A click that lands on the dialog itself, not its panel, is the backdrop.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      >
        <div className="panel w-[min(880px,calc(100vw-32px))] px-5 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="eyebrow">
              <span className="text-[var(--paper)]">{label}</span> vs S&amp;P 500
            </h2>
            <span className="flex items-baseline gap-4">
              <span className="data text-[0.625rem] text-[var(--muted)]">
                1 month · daily closes
              </span>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="data cursor-pointer text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--muted)] transition-colors hover:text-[var(--paper)]"
              >
                Close
              </button>
            </span>
          </div>
          <div className="mt-5">
            {opened > 0 && (
              <Plot
                key={opened}
                points={points}
                label={label}
                up={up}
                height={300}
                draw
              />
            )}
          </div>
          <Summary label={label} subjectPct={end.subject} benchPct={end.bench} />
        </div>
      </dialog>
    </>
  );
}
