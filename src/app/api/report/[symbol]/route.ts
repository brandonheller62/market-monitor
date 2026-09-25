import { findHolding } from "@/lib/portfolios";
import { getStockReport, ReportsOffError } from "@/lib/report";

// A report searches the web before it writes, and a long search turn can be
// resumed, so give it room.
export const maxDuration = 300;

/**
 * The stock page asks for its report from the browser, with a POST. Crawlers
 * following the holding links fetch the page but never post, so only a person
 * opening a stock can start a billed report.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/report/[symbol]">) {
  const { symbol } = await ctx.params;
  const holding = findHolding(symbol);
  if (!holding) {
    return Response.json({ error: "That ticker is not held in any book." }, { status: 404 });
  }

  try {
    return Response.json({ report: await getStockReport(holding.symbol) });
  } catch (err) {
    if (err instanceof ReportsOffError) {
      return Response.json(
        { error: "No ANTHROPIC_API_KEY is set, so reports are off. The prices on this page are live." },
        { status: 503 },
      );
    }
    console.error(`report ${holding.symbol} failed:`, err);
    return Response.json(
      { error: "The report could not be written just now. The prices on this page are live; try again in a minute." },
      { status: 502 },
    );
  }
}
