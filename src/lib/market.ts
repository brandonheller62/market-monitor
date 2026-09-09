import { getJson, getText, num } from "./http";
import { dedash } from "./format";
import type { Curve, Mover, Quote, QuoteGroup } from "./types";

type NasdaqQuote = {
  data: {
    symbol: string;
    primaryData?: {
      lastSalePrice?: string;
      netChange?: string;
      percentageChange?: string;
      lastTradeTimestamp?: string;
    } | null;
  } | null;
};

type BoardEntry = {
  label: string;
  symbol: string;
  assetclass: "index" | "etf" | "stocks";
  note: string;
};

/**
 * Nasdaq's public quote API only carries its own indices (COMP, NDX), so the
 * broader tape is read through the most liquid ETF for each exposure. Labels
 * name the exposure; the `note` column keeps the proxy honest on screen.
 */
const BOARD: { title: string; caption: string; entries: BoardEntry[] }[] = [
  {
    title: "Equities",
    caption: "Where the tape stands",
    entries: [
      { label: "Nasdaq Composite", symbol: "COMP", assetclass: "index", note: "index" },
      { label: "Nasdaq 100", symbol: "NDX", assetclass: "index", note: "index" },
      { label: "S&P 500", symbol: "SPY", assetclass: "etf", note: "SPY" },
      { label: "Dow 30", symbol: "DIA", assetclass: "etf", note: "DIA" },
      { label: "Small caps", symbol: "IWM", assetclass: "etf", note: "IWM" },
    ],
  },
  {
    title: "Risk, rates & real assets",
    caption: "What the tape is hedging",
    entries: [
      { label: "Volatility", symbol: "VIXY", assetclass: "etf", note: "VIXY" },
      { label: "Long Treasuries", symbol: "TLT", assetclass: "etf", note: "TLT" },
      { label: "US dollar", symbol: "UUP", assetclass: "etf", note: "UUP" },
      { label: "Gold", symbol: "GLD", assetclass: "etf", note: "GLD" },
      { label: "Crude oil", symbol: "USO", assetclass: "etf", note: "USO" },
    ],
  },
];

async function quote(entry: BoardEntry): Promise<Quote> {
  const url = `https://api.nasdaq.com/api/quote/${entry.symbol}/info?assetclass=${entry.assetclass}`;
  const json = await getJson<NasdaqQuote>(url);
  const p = json?.data?.primaryData;
  return {
    label: entry.label,
    symbol: entry.symbol,
    note: entry.note,
    price: num(p?.lastSalePrice),
    change: num(p?.netChange),
    changePct: num(p?.percentageChange),
    asOf: p?.lastTradeTimestamp ?? null,
  };
}

export async function getBoard(): Promise<QuoteGroup[]> {
  return Promise.all(
    BOARD.map(async (group) => ({
      title: group.title,
      caption: group.caption,
      quotes: await Promise.all(group.entries.map(quote)),
    })),
  );
}

const CURVE_FIELDS: [string, string][] = [
  ["3M", "BC_3MONTH"],
  ["6M", "BC_6MONTH"],
  ["1Y", "BC_1YEAR"],
  ["2Y", "BC_2YEAR"],
  ["5Y", "BC_5YEAR"],
  ["10Y", "BC_10YEAR"],
  ["30Y", "BC_30YEAR"],
];

/** Treasury publishes the par yield curve as an Atom feed, one entry per day. */
export async function getCurve(): Promise<Curve> {
  const now = new Date();
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const url =
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml" +
    `?data=daily_treasury_yield_curve&field_tdr_date_value_month=${month}`;
  const xml = await getText(url);
  const empty: Curve = { date: null, points: [], twosTens: null };
  if (!xml) return empty;

  const entries = xml.split("<entry>").slice(1);
  const last = entries.at(-1);
  if (!last) return empty;

  const read = (field: string) => {
    const m = last.match(new RegExp(`<d:${field}[^>]*>([^<]*)</d:${field}>`));
    return m ? num(m[1]) : null;
  };
  const dateMatch = last.match(/<d:NEW_DATE[^>]*>([^<]*)</);
  const points = CURVE_FIELDS.map(([label, field]) => ({ label, yield: read(field) }));
  const two = points.find((p) => p.label === "2Y")?.yield ?? null;
  const ten = points.find((p) => p.label === "10Y")?.yield ?? null;

  return {
    date: dateMatch ? dateMatch[1].slice(0, 10) : null,
    points,
    twosTens: two != null && ten != null ? Number((ten - two).toFixed(2)) : null,
  };
}

type MoversResponse = {
  data?: {
    STOCKS?: {
      Nasdaq100Movers?: { table?: { rows?: { symbol: string; name: string; lastSalePrice: string; change: string }[] } };
    };
  };
};

/** Nasdaq-100 constituents, ranked by session move. Keeps penny stocks out. */
export async function getMovers(): Promise<{ gainers: Mover[]; losers: Mover[] }> {
  const json = await getJson<MoversResponse>("https://api.nasdaq.com/api/marketmovers");
  const rows = json?.data?.STOCKS?.Nasdaq100Movers?.table?.rows ?? [];
  const movers: Mover[] = rows
    .map((r) => ({
      symbol: r.symbol,
      name: dedash(r.name.replace(/\s+(Common Stock|Class [A-C]).*$/i, "").trim()),
      price: num(r.lastSalePrice),
      changePct: num(r.change),
    }))
    .filter((m): m is Mover => m.changePct != null);

  // The feed returns a subset of the index, so cap each side at half the rows
  // rather than a fixed six, otherwise the same name lands in both columns.
  const sorted = [...movers].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const half = Math.min(6, Math.floor(sorted.length / 2));
  return { gainers: sorted.slice(0, half), losers: sorted.slice(-half).reverse() };
}

export async function getFx() {
  const json = await getJson<{ rates?: Record<string, number> }>(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY,CNY",
  );
  const rates = json?.rates ?? {};
  return Object.entries(rates).map(([code, rate]) => ({ pair: `USD/${code}`, rate }));
}

export async function getCrypto(): Promise<Quote[]> {
  const json = await getJson<Record<string, { usd: number; usd_24h_change: number }>>(
    "https://api.coingecko.com/api/v3/simple/price" +
      "?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true",
  );
  const rows: [string, string][] = [
    ["bitcoin", "Bitcoin"],
    ["ethereum", "Ethereum"],
    ["solana", "Solana"],
  ];
  return rows
    .filter(([id]) => json?.[id])
    .map(([id, label]) => ({
      label,
      symbol: id.toUpperCase(),
      note: "24h",
      price: json![id].usd,
      change: null,
      changePct: json![id].usd_24h_change,
      asOf: null,
    }));
}
