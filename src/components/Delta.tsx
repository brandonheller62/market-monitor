import { fmtPct } from "@/lib/format";

export function Delta({
  pct,
  size = "sm",
}: {
  pct: number | null;
  size?: "sm" | "lg";
}) {
  const tone =
    pct == null ? "text-[var(--muted)]" : pct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]";
  return (
    <span
      className={`data ${tone} ${size === "lg" ? "text-base" : "text-[0.8125rem]"}`}
    >
      {fmtPct(pct)}
    </span>
  );
}
