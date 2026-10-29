import Link from "next/link";
import { Delta } from "./Delta";
import { fmtPrice } from "@/lib/format";
import type { Quote, QuoteGroup } from "@/lib/types";

function Row({ q }: { q: Quote }) {
  const body = (
    <>
      <div className="min-w-0">
        <div className="truncate text-[0.9375rem]">
          {q.label}
          {q.href && <span className="ml-1.5 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">&rarr;</span>}
        </div>
        <div className="data text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
          {q.note}
        </div>
      </div>
      <div className="text-right">
        <div className="data text-[0.9375rem]">{fmtPrice(q.price)}</div>
        <Delta pct={q.changePct} />
      </div>
    </>
  );
  const row = "row-rule flex items-baseline justify-between gap-3 py-2.5";
  if (!q.href) return <div className={row}>{body}</div>;
  return (
    <Link
      href={q.href}
      className={`${row} group -mx-4 px-4 transition-colors hover:bg-[color-mix(in_srgb,var(--paper)_4%,transparent)]`}
    >
      {body}
    </Link>
  );
}

export function Tape({ groups }: { groups: QuoteGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <section key={g.title} className="panel px-4 py-3">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">{g.title}</h2>
            <span className="data text-[0.625rem] text-[var(--muted)]">
              {g.caption}
            </span>
          </div>
          <div className="mt-1">
            {g.quotes.map((q) => (
              <Row key={q.symbol} q={q} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
