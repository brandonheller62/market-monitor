import { Delta } from "./Delta";
import { fmtPrice } from "@/lib/format";
import type { Quote, QuoteGroup } from "@/lib/types";

function Row({ q }: { q: Quote }) {
  return (
    <div className="row-rule flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[0.9375rem]">{q.label}</div>
        <div className="data text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted)]">
          {q.note}
        </div>
      </div>
      <div className="text-right">
        <div className="data text-[0.9375rem]">{fmtPrice(q.price)}</div>
        <Delta pct={q.changePct} />
      </div>
    </div>
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

export function MiniTape({ title, quotes }: { title: string; quotes: Quote[] }) {
  if (quotes.length === 0) return null;
  return (
    <section className="panel px-4 py-3">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-1">
        {quotes.map((q) => (
          <Row key={q.symbol} q={q} />
        ))}
      </div>
    </section>
  );
}
