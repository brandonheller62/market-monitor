import type { NextRequest } from "next/server";
import { assetclassFor, fetchHistories, ttlFor } from "@/lib/history";
import { allSymbols } from "@/lib/portfolios";

// Forty-odd tickers four at a time, with retries on a bad answer, can take a
// while when Nasdaq is throttling.
export const maxDuration = 60;

/**
 * Daily closes for the portfolio charts, proxied so the browser never calls
 * Nasdaq. Takes `?symbols=A,B,C` for the whole union in one request, or
 * `?symbol=X&assetclass=stocks|etf` for one. Only tickers held in a book (and
 * SPY) are served, which keeps this from being an open proxy.
 *
 * A complete answer is cached at Vercel's edge until the next settled close
 * (or half an hour while the day's close has yet to post); an answer with any
 * failed ticker is cached for a minute so it heals soon.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const one = params.get("symbol");
  const symbols = (one ?? params.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const allowed = new Set(allSymbols());
  const unknown = symbols.filter((s) => !allowed.has(s));
  if (symbols.length === 0 || unknown.length > 0) {
    return Response.json(
      { error: unknown.length ? `Not held in any book: ${unknown.join(", ")}` : "No symbols given." },
      { status: 400 },
    );
  }
  const assetclass = params.get("assetclass");
  if (one && assetclass && assetclass !== assetclassFor(symbols[0])) {
    return Response.json(
      { error: `${symbols[0]} is assetclass=${assetclassFor(symbols[0])}.` },
      { status: 400 },
    );
  }

  const result = await fetchHistories(symbols);
  const ttl =
    result.failed.length > 0
      ? 60
      : Math.min(...Object.values(result.series).map((closes) => ttlFor(closes)));
  return Response.json(result, {
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=300` },
  });
}
