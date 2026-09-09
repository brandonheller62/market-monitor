import { quoteSymbol } from "./market";
import type { Holding, Portfolio, PortfolioId } from "./types";

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

export const PORTFOLIO_IDS = DEFINITIONS.map((d) => d.id);

export function isPortfolioId(id: string): id is PortfolioId {
  return DEFINITIONS.some((d) => d.id === id);
}

export async function getPortfolio(id: PortfolioId): Promise<Portfolio> {
  const def = DEFINITIONS.find((d) => d.id === id)!;

  const holdings: Holding[] = await Promise.all(
    def.positions.map(async ([symbol, name]) => {
      const q = await quoteSymbol(symbol);
      return {
        symbol,
        name,
        price: q.price,
        changePct: q.changePct,
        asOf: q.asOf,
      };
    }),
  );

  const priced = holdings.filter((h) => h.changePct != null);
  const ranked = [...priced].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const advancing = priced.filter((h) => (h.changePct ?? 0) > 0).length;

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
  };
}

export async function getAllPortfolios(): Promise<Portfolio[]> {
  return Promise.all(PORTFOLIO_IDS.map(getPortfolio));
}
