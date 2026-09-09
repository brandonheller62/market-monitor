import type { Curve as CurveData } from "@/lib/types";

/**
 * The par curve drawn as bars rather than a line: at seven maturities a line
 * chart implies interpolation the data does not have.
 */
export function Curve({ curve }: { curve: CurveData }) {
  const values = curve.points.map((p) => p.yield).filter((y): y is number => y != null);
  if (values.length === 0) {
    return (
      <section className="panel px-4 py-3">
        <h2 className="eyebrow">Treasury curve</h2>
        <p className="data mt-3 text-[0.8125rem] text-[var(--muted)]">
          Treasury has not published a curve for this month yet.
        </p>
      </section>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const height = (y: number) => 18 + ((y - min) / (max - min || 1)) * 46;

  return (
    <section className="panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">Treasury curve</h2>
        <span className="data text-[0.625rem] text-[var(--muted)]">
          {curve.date ?? ""}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-1.5">
        {curve.points.map((p) => (
          <div key={p.label} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="data text-[0.6875rem]">
              {p.yield != null ? p.yield.toFixed(2) : "—"}
            </span>
            <div
              className="w-full rounded-[1px]"
              style={{
                height: p.yield != null ? `${height(p.yield)}px` : "2px",
                background: "linear-gradient(180deg, var(--dawn), var(--dawn-deep))",
              }}
            />
            <span className="data text-[0.625rem] text-[var(--muted)]">{p.label}</span>
          </div>
        ))}
      </div>

      {curve.twosTens != null && (
        <p className="data mt-3 border-t border-[var(--line-soft)] pt-2 text-[0.6875rem] text-[var(--muted)]">
          2s10s {curve.twosTens > 0 ? "+" : ""}
          {(curve.twosTens * 100).toFixed(0)} bp
          {curve.twosTens < 0 ? " — inverted" : ""}
        </p>
      )}
    </section>
  );
}
