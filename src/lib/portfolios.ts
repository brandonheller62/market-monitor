import { getBaselineClose, quoteSymbol } from "./market";
import type { Benchmark, Holding, Portfolio, PortfolioId } from "./types";

type Definition = {
  id: PortfolioId;
  name: string;
  blurb: string;
  /** [ticker, name as the sheet lists it] */
  positions: [string, string][];
};

/**
 * Tickers were resolved against Nasdaq's symbol lookup, not from memory, and
 * every one returns a live quote. Note "Everpure Inc" is the symbol P.
 */
const DEFINITIONS: Definition[] = [
  {
    id: "jaffee",
    name: "Mr. Jaffee's Portfolio",
    blurb: "19 positions",
    positions: [
      ["MU", "Micron Technology Inc"],
      ["P", "Everpure Inc"],
      ["NVDA", "Nvidia Corp"],
      ["TNK", "Teekay Tankers Ltd"],
      ["INSW", "International Seaways Inc"],
      ["ANET", "Arista Networks Inc"],
      ["LIVN", "LivaNova Plc"],
      ["JLL", "Jones Lang LaSalle Inc"],
      ["RELY", "Remitly Global Inc"],
      ["APH", "Amphenol Corp"],
      ["AMZN", "Amazon.Com Inc"],
      ["INCY", "Incyte Corp"],
      ["GRMN", "Garmin Ltd"],
      ["TILE", "Interface Inc"],
      ["ROKU", "Roku Inc"],
      ["SN", "SharkNinja Inc"],
      ["LLY", "Lilly (Eli) & Co"],
      ["VEEV", "Veeva Systems Inc"],
      ["DXCM", "Dexcom Inc"],
    ],
  },
  {
    id: "class",
    name: "Class Portfolio",
    blurb: "16 positions",
    positions: [
      ["ORCL", "Oracle Corp"],
      ["SOFI", "SoFi Technologies Inc"],
      ["CEG", "Constellation Energy Corp"],
      ["NVDA", "Nvidia Corp"],
      ["ELF", "e.l.f. Beauty Inc"],
      ["CROX", "Crocs Inc"],
      ["JNJ", "Johnson & Johnson"],
      ["WMT", "Walmart Inc"],
      ["GILD", "Gilead Sciences Inc"],
      ["NBIX", "Neurocrine Biosciences Inc"],
      ["LLY", "Lilly (Eli) & Co"],
      ["TTWO", "Take-Two Interactive Software"],
      ["CVX", "Chevron Corp"],
      ["AAPL", "Apple Inc"],
      ["PLTR", "Palantir Technologies Inc"],
      ["AVGO", "Broadcom Inc"],
    ],
  },
  {
    id: "dartboard",
    name: "Dartboard Portfolio",
    blurb: "12 positions",
    positions: [
      ["LVS", "Las Vegas Sands Corp"],
      ["NCLH", "Norwegian Cruise Line Holdings Ltd"],
      ["CTAS", "Cintas Corp"],
      ["ATO", "Atmos Energy Corp"],
      ["PFE", "Pfizer Inc"],
      ["VICI", "Vici Properties Inc"],
      ["ODFL", "Old Dominion Freight Line Inc"],
      ["MO", "Altria Group Inc"],
      ["PEP", "Pepsico Inc"],
      ["LIN", "Linde Plc"],
      ["KMI", "Kinder Morgan Inc"],
      ["TSN", "Tyson Foods Inc Class A"],
    ],
  },
];

/**
 * The date the month-to-date block measures from. Moves are taken from the last
 * close before this, which is the standard month-to-date base. Change this one
 * line to re-point the section, or set it to the first of the current month to
 * make it roll.
 */
export const SINCE_DATE = "2026-09-01";

/** Hypothetical capital, spread equally because no share counts are available. */
const START_CAPITAL = 10_000;

export const PORTFOLIO_IDS = DEFINITIONS.map((d) => d.id);

export function isPortfolioId(id: string): id is PortfolioId {
  return DEFINITIONS.some((d) => d.id === id);
}

export async function getPortfolio(id: PortfolioId): Promise<Portfolio> {
  const def = DEFINITIONS.find((d) => d.id === id)!;

  const holdings: Holding[] = await Promise.all(
    def.positions.map(async ([symbol, name]) => {
      const [q, base] = await Promise.all([
        quoteSymbol(symbol),
        getBaselineClose(symbol, SINCE_DATE),
      ]);
      const sincePct =
        q.price != null && base != null && base.close !== 0
          ? ((q.price - base.close) / base.close) * 100
          : null;
      return {
        symbol,
        name,
        price: q.price,
        changePct: q.changePct,
        asOf: q.asOf,
        baseline: base?.close ?? null,
        sincePct,
      };
    }),
  );

  const priced = holdings.filter((h) => h.changePct != null);
  const ranked = [...priced].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const advancing = priced.filter((h) => (h.changePct ?? 0) > 0).length;

  // Equal-weighted because the sheets carry no share counts: the same dollar
  // amount goes into every priced holding at the baseline close.
  const tracked = holdings.filter((h) => h.sincePct != null);
  const perPosition = tracked.length > 0 ? START_CAPITAL / tracked.length : 0;
  const currentValue =
    tracked.length > 0
      ? tracked.reduce((sum, h) => sum + perPosition * (1 + (h.sincePct ?? 0) / 100), 0)
      : null;
  const startValue = perPosition * tracked.length;
  const bySince = [...tracked].sort((a, b) => (b.sincePct ?? 0) - (a.sincePct ?? 0));

  const baselineDate = await getBaselineClose(
    def.positions[0][0],
    SINCE_DATE,
  ).then((b) => b?.date ?? null);

  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    holdings,
    // No share counts on the sheet, so every read here is equal-weighted and
    // labelled as such rather than presented as a portfolio return.
    averageChangePct:
      priced.length > 0
        ? priced.reduce((sum, h) => sum + (h.changePct ?? 0), 0) / priced.length
        : null,
    advancing,
    priced: priced.length,
    best: ranked[0] ?? null,
    worst: ranked.at(-1) ?? null,
    since: {
      date: SINCE_DATE,
      baselineDate,
      startValue,
      currentValue,
      changePct:
        currentValue != null && startValue > 0
          ? (currentValue / startValue - 1) * 100
          : null,
      tracked: tracked.length,
      best: bySince[0] ?? null,
      worst: bySince.at(-1) ?? null,
    },
  };
}

export async function getAllPortfolios(): Promise<Portfolio[]> {
  return Promise.all(PORTFOLIO_IDS.map(getPortfolio));
}

/**
 * The yardstick every book is read against. Nasdaq's quote API does not carry
 * the S&P 500 index itself, so this is SPY, and the panel names the proxy.
 */
export async function getBenchmark(): Promise<Benchmark> {
  const [q, base] = await Promise.all([
    quoteSymbol("SPY", "etf"),
    getBaselineClose("SPY", SINCE_DATE, "etf"),
  ]);

  return {
    label: "S&P 500",
    symbol: "SPY",
    note: "SPY, the index ETF",
    price: q.price,
    changePct: q.changePct,
    sincePct:
      q.price != null && base != null && base.close !== 0
        ? ((q.price - base.close) / base.close) * 100
        : null,
    baselineDate: base?.date ?? null,
  };
}
