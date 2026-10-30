import { fmtPct, fmtPrice } from "@/lib/format";
import type { Extended } from "@/lib/types";

/**
 * "After hours $151.25 +0.66%", set small and apart from the regular-session
 * figures it sits beside.
 */
export function ExtendedQuote({
  extended,
  className = "",
}: {
  extended: Extended | null;
  className?: string;
}) {
  if (!extended) return null;
  const pct = extended.changePct;
  const tone = pct == null ? "" : pct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]";
  return (
    <span
      className={`data whitespace-nowrap text-[var(--muted)] ${className}`}
      title={extended.asOf ? `${extended.session}, ${extended.asOf}` : extended.session}
    >
      {extended.session} {fmtPrice(extended.price)} <span className={tone}>{fmtPct(pct)}</span>
    </span>
  );
}
