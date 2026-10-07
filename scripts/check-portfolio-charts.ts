/**
 * Loads every book's price history the way the /api/history proxy does (the
 * union of all tickers plus SPY, four at a time, with retries) and checks that
 * each book builds a vs-S&P series of at least 15 points.
 *
 *   npm run check:charts
 */
import { fetchHistories } from "../src/lib/history";
import { bookPerformance } from "../src/lib/perf-math";
import { allSymbols, PORTFOLIO_IDS, portfolioSymbols } from "../src/lib/portfolios";

const MIN_POINTS = 15;

async function main() {
  const started = Date.now();
  const { series, failed } = await fetchHistories(allSymbols());
  console.log(
    `Fetched ${Object.keys(series).length}/${allSymbols().length} symbols in ${Date.now() - started}ms`,
  );
  for (const f of failed) console.log(`  failed: ${f.symbol} (${f.reason})`);

  let ok = true;
  for (const id of PORTFOLIO_IDS) {
    const { name, symbols } = portfolioSymbols(id);
    const { perf, missing } = bookPerformance(symbols, series);
    const points = perf?.points.length ?? 0;
    const pass = points >= MIN_POINTS;
    ok &&= pass;
    console.log(
      `${pass ? "PASS" : "FAIL"} ${name}: ${points} points` +
        (perf ? `, book ${perf.subjectPct.toFixed(2)}% vs SPY ${perf.benchPct.toFixed(2)}%` : "") +
        (missing.length ? `, missing ${missing.join(", ")}` : ""),
    );
  }
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
