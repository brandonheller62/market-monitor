import { Body, Shell } from "./BenchmarkParts";
import { getStockPerformance } from "@/lib/performance";

export { BenchmarkSkeleton } from "./BenchmarkParts";

/** The stock page's card, rendered on the server so its total matches Moves. */
export async function StockBenchmarkCard({ symbol }: { symbol: string }) {
  const perf = await getStockPerformance(symbol);
  return (
    <Shell as="h2">
      <Body perf={perf} label={symbol} />
    </Shell>
  );
}
