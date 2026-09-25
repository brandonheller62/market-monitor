import { getBaselineClose, getRecentCloses, getStockSummary, quoteSymbol } from "./market";
import { findHolding, SINCE_DATE } from "./portfolios";
import type { StockDetail } from "./types";

function pctFrom(base: number | undefined, now: number | null): number | null {
  if (base == null || now == null || base === 0) return null;
  return ((now - base) / base) * 100;
}

/**
 * Everything the stock page shows for one holding, or null when the ticker is
 * not in any book. Each fetch shares the Next data cache with the rest of the
 * site, so the page and the report read identical numbers.
 */
export async function getStock(symbol: string): Promise<StockDetail | null> {
  const holding = findHolding(symbol);
  if (!holding) return null;

  const [q, base, closes, summary] = await Promise.all([
    quoteSymbol(holding.symbol),
    getBaselineClose(holding.symbol, SINCE_DATE),
    getRecentCloses(holding.symbol),
    getStockSummary(holding.symbol),
  ]);

  // Trailing windows count sessions back from the latest settled close:
  // "5-day" is the close five rows before it, "1-month" about 21.
  const at = (sessionsBack: number) => closes.at(-1 - sessionsBack)?.close;

  return {
    symbol: holding.symbol,
    name: holding.name,
    books: holding.books,
    price: q.price,
    changePct: q.changePct,
    asOf: q.asOf,
    fiveDayPct: pctFrom(at(5), q.price),
    oneMonthPct: pctFrom(at(21), q.price),
    sincePct: pctFrom(base?.close, q.price),
    sinceDate: SINCE_DATE,
    closes,
    ...summary,
  };
}
