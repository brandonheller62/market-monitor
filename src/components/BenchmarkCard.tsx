import { Body, Shell } from "./BenchmarkParts";
import { getStockPerformance } from "@/lib/performance";
import { SINCE_DATE } from "@/lib/portfolios";
import { fmtShortDate } from "@/lib/format";

export { BenchmarkSkeleton } from "./BenchmarkParts";

/** The stock page's card, rendered on the server so its total matches Moves. */
export async function StockBenchmarkCard({ symbol }: { symbol: string }) {
  const { since, month } = await getStockPerformance(symbol);
  const views = [
    since && { caption: `Since ${fmtShortDate(SINCE_DATE)}`, points: since.points },
    month && { caption: "1 month", points: month.points },
  ].filter((v) => v != null);
  return (
    <Shell as="h2" caption={views[0] && `${views[0].caption} · daily closes`}>
      <Body views={views} label={symbol} />
    </Shell>
  );
}
