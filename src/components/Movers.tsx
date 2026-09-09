import { Delta } from "./Delta";
import { fmtPrice } from "@/lib/format";
import type { Mover } from "@/lib/types";

function Column({ title, movers }: { title: string; movers: Mover[] }) {
  return (
    // Grid items are min-width:auto by default, which would let a long company
    // name widen the whole grid rather than truncate.
    <div className="min-w-0">
      <h3 className="eyebrow">{title}</h3>
      <div className="mt-1">
        {movers.map((m) => (
          <div
            key={m.symbol}
            className="row-rule flex items-baseline justify-between gap-3 py-2"
          >
            <div className="min-w-0 truncate">
              <span className="data text-[0.8125rem]">{m.symbol}</span>
              <span className="ml-2 text-[0.8125rem] text-[var(--muted)]">
                {m.name}
              </span>
            </div>
            <div className="flex shrink-0 items-baseline gap-3">
              <span className="data text-[0.8125rem] text-[var(--muted)]">
                {fmtPrice(m.price)}
              </span>
              <Delta pct={m.changePct} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Movers({ gainers, losers }: { gainers: Mover[]; losers: Mover[] }) {
  if (gainers.length === 0) return null;
  return (
    <section className="panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">Nasdaq-100 movers</h2>
        <span className="data text-[0.625rem] text-[var(--muted)]">Session change</span>
      </div>
      <div className="mt-3 grid gap-6 md:grid-cols-2">
        <Column title="Leading" movers={gainers} />
        <Column title="Lagging" movers={losers} />
      </div>
    </section>
  );
}
