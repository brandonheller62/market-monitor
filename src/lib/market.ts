import { getJson, getText, num } from "./http";
import { dedash } from "./format";
import type { Curve, Mover, Quote, QuoteGroup } from "./types";

type NasdaqQuote = {
  data: {
    symbol: string;
    companyName?: string;
    primaryData?: {
      lastSalePrice?: string;
      netChange?: string;
      percentageChange?: string;
      lastTradeTimestamp?: string;
    } | null;
  } | null;
};

/** One Nasdaq quote. Shared by the board and the portfolio tabs. */
export async function quoteSymbol(
  symbol: string,
  assetclass: "index" | "etf" | "stocks" = "stocks",
): Promise<{
  companyName: string | null;
  price: number | null;
  change: number | null;
  changePct: number | null;
  asOf: string | null;
}> {
  const json = await getJson<NasdaqQuote>(
    `https://api.nasdaq.com/api/quote/${symbol}/info?assetclass=${assetclass}`,
  );
  const p = json?.data?.primaryData;
  return {
    companyName: json?.data?.companyName ? dedash(json.data.companyName) : null,
    price: num(p?.lastSalePrice),
    change: num(p?.netChange),
    changePct: num(p?.percentageChange),
    asOf: p?.lastTradeTimestamp ?? null,
  };
}

type CboeQuote = {
  data?: {
    current_price?: number;
    price_change?: number;
    price_change_percent?: number;
    last_trade_time?: string;
  } | null;
};

/**
 * Where one board row can be read from, in order of preference. `scale`
 * converts a scaled index back to its published level: Cboe carries the Dow
 * as DJX, one hundredth of the average.
 */
type Source =
  | { from: "cboe"; symbol: string; scale?: number }
  | { from: "nasdaq"; symbol: string; assetclass: "index" | "etf" };

type BoardEntry = {
  label: string;
  /** Index sources, tried in order. The first fresh one wins. */
  index: Source[];
  /** Shown only when every index source is down, and labelled as an ETF. */
  etf?: { symbol: string; label: string };
};

type EtfEntry = { label: string; symbol: string; note: string };

/**
 * Real index levels come from Cboe's delayed quote feed and Nasdaq's own
 * indices. Where neither carries a spot level (Treasuries, the dollar,
 * commodities) the row is an ETF price and says so in its label.
 */
const INDICES: BoardEntry[] = [
  {
    label: "S&P 500",
    index: [{ from: "cboe", symbol: "_SPX" }],
    etf: { symbol: "SPY", label: "S&P 500 ETF" },
  },
  {
    label: "Dow Jones Industrials",
    index: [{ from: "cboe", symbol: "_DJX", scale: 100 }],
    etf: { symbol: "DIA", label: "Dow ETF" },
  },
  {
    label: "Nasdaq Composite",
    index: [{ from: "nasdaq", symbol: "COMP", assetclass: "index" }],
    etf: { symbol: "ONEQ", label: "Nasdaq Composite ETF" },
  },
  {
    label: "Nasdaq 100",
    index: [
      { from: "nasdaq", symbol: "NDX", assetclass: "index" },
      { from: "cboe", symbol: "_NDX" },
    ],
    etf: { symbol: "QQQ", label: "Nasdaq 100 ETF" },
  },
  {
    label: "Russell 2000",
    index: [{ from: "cboe", symbol: "_RUT" }],
    etf: { symbol: "IWM", label: "Russell 2000 ETF" },
  },
  {
    label: "VIX",
    index: [{ from: "cboe", symbol: "_VIX" }],
    etf: { symbol: "VIXY", label: "VIX futures ETF" },
  },
];

const ETFS: EtfEntry[] = [
  { label: "Long Treasuries ETF", symbol: "TLT", note: "TLT · 20y+ Treasuries" },
  { label: "US dollar ETF", symbol: "UUP", note: "UUP · dollar index futures" },
  { label: "Gold ETF", symbol: "GLD", note: "GLD · holds bullion" },
  { label: "Crude oil ETF", symbol: "USO", note: "USO · rolls WTI futures" },
];

/**
 * A feed that stops updating keeps answering with its last value (Cboe's own
 * ^DJI and ^COMP quotes froze long ago), so a quote older than this is treated
 * as missing. Five days clears a weekend plus a holiday.
 */
const MAX_QUOTE_AGE_DAYS = 5;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-17T16:15:01" or "Sep 17, 2026 ..." -> "2026-09-17", else null. */
function tradeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const us = raw.match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/);
  if (!us) return null;
  const month = MONTHS.indexOf(us[1]) + 1;
  if (month === 0) return null;
  return `${us[3]}-${String(month).padStart(2, "0")}-${us[2].padStart(2, "0")}`;
}

/** True when the quote's trade date is known and too old to show as current. */
function isStale(asOf: string | null): boolean {
  const date = tradeDate(asOf);
  if (!date) return false;
  const ageMs = Date.now() - new Date(`${date}T12:00:00Z`).getTime();
  return ageMs > MAX_QUOTE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

type Reading = { price: number | null; change: number | null; changePct: number | null; asOf: string | null };

async function readCboe(symbol: string, scale = 1): Promise<Reading | null> {
  const json = await getJson<CboeQuote>(
    `https://cdn.cboe.com/api/global/delayed_quotes/quotes/${symbol}.json`,
  );
  const d = json?.data;
  if (!d || typeof d.current_price !== "number") return null;
  return {
    price: d.current_price * scale,
    change: typeof d.price_change === "number" ? d.price_change * scale : null,
    changePct: typeof d.price_change_percent === "number" ? d.price_change_percent : null,
    asOf: d.last_trade_time ?? null,
  };
}

async function read(source: Source): Promise<Reading | null> {
  let r: Reading | null;
  if (source.from === "cboe") {
    r = await readCboe(source.symbol, source.scale);
  } else {
    const { price, change, changePct, asOf } = await quoteSymbol(source.symbol, source.assetclass);
    r = { price, change, changePct, asOf };
  }
  if (!r || r.price == null || isStale(r.asOf)) return null;
  return r;
}

async function indexRow(entry: BoardEntry): Promise<Quote> {
  for (const source of entry.index) {
    const r = await read(source);
    if (r) {
      return { label: entry.label, symbol: source.symbol, kind: "index", note: "index", ...r };
    }
  }
  if (entry.etf) {
    const r = await read({ from: "nasdaq", symbol: entry.etf.symbol, assetclass: "etf" });
    if (r) {
      return {
        label: entry.etf.label,
        symbol: entry.etf.symbol,
        kind: "etf",
        note: `${entry.etf.symbol} · index feed down`,
        fallback: true,
        ...r,
      };
    }
  }
  return {
    label: entry.label,
    symbol: entry.index[0].symbol,
    kind: "index",
    note: "index",
    price: null,
    change: null,
    changePct: null,
    asOf: null,
  };
}

async function etfRow(entry: EtfEntry): Promise<Quote> {
  const r = await read({ from: "nasdaq", symbol: entry.symbol, assetclass: "etf" });
  return {
    label: entry.label,
    symbol: entry.symbol,
    kind: "etf",
    note: entry.note,
    price: r?.price ?? null,
    change: r?.change ?? null,
    changePct: r?.changePct ?? null,
    asOf: r?.asOf ?? null,
  };
}

export async function getBoard(): Promise<QuoteGroup[]> {
  const [indices, etfs] = await Promise.all([
    Promise.all(INDICES.map(indexRow)),
    Promise.all(ETFS.map(etfRow)),
  ]);
  return [
    { title: "Indices", caption: "Index levels", quotes: indices },
    { title: "Rates, dollar & commodities", caption: "ETF prices, not spot levels", quotes: etfs },
  ];
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
      kind: "spot" as const,
      note: "24h",
      price: json![id].usd,
      change: null,
      changePct: json![id].usd_24h_change,
      asOf: null,
    }));
}

type HistoricalResponse = {
  data?: {
    tradesTable?: { rows?: { date: string; close: string }[] | null } | null;
  } | null;
};

/** "09/01/2026" -> "2026-09-01", so dates sort as strings. */
function isoFromUs(date: string): string | null {
  const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

/**
 * The last closing price strictly before `since`, which is the base a
 * month-to-date move is measured from. Reaches back two weeks so a holiday or
 * weekend on the boundary still resolves to a real session.
 *
 * Cached for six hours: a settled historical close does not change.
 */
export async function getBaselineClose(
  symbol: string,
  since: string,
  assetclass: "etf" | "stocks" = "stocks",
): Promise<{ date: string; close: number } | null> {
  const from = new Date(`${since}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 14);
  const fromdate = from.toISOString().slice(0, 10);

  const json = await getJson<HistoricalResponse>(
    `https://api.nasdaq.com/api/quote/${symbol}/historical` +
      `?assetclass=${assetclass}&fromdate=${fromdate}&todate=${since}&limit=20`,
    6 * 60 * 60,
  );

  const rows = json?.data?.tradesTable?.rows ?? [];
  const priorSessions = rows
    .map((r) => ({ date: isoFromUs(r.date), close: num(r.close) }))
    .filter(
      (r): r is { date: string; close: number } =>
        r.date != null && r.close != null && r.date < since,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return priorSessions[0] ?? null;
}

/**
 * Daily closes for roughly the last `days` calendar days, oldest first. Feeds
 * the stock page's 5-day and 1-month moves and the report's price context.
 */
export async function getRecentCloses(
  symbol: string,
  days = 45,
): Promise<{ date: string; close: number }[]> {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);

  const json = await getJson<HistoricalResponse>(
    `https://api.nasdaq.com/api/quote/${symbol}/historical` +
      `?assetclass=stocks&fromdate=${from.toISOString().slice(0, 10)}` +
      `&todate=${to.toISOString().slice(0, 10)}&limit=60`,
  );

  return (json?.data?.tradesTable?.rows ?? [])
    .map((r) => ({ date: isoFromUs(r.date), close: num(r.close) }))
    .filter((r): r is { date: string; close: number } => r.date != null && r.close != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

type SummaryResponse = {
  data?: {
    summaryData?: Record<string, { label: string; value: string } | undefined> | null;
  } | null;
};

/**
 * Nasdaq's quote summary: sector, industry, market cap, 52-week range and the
 * analyst one-year target. Values are passed through as Nasdaq prints them.
 */
export async function getStockSummary(symbol: string): Promise<{
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  range52w: string | null;
  target1y: string | null;
  volume: string | null;
  avgVolume: string | null;
}> {
  const json = await getJson<SummaryResponse>(
    `https://api.nasdaq.com/api/quote/${symbol}/summary?assetclass=stocks`,
  );
  const d = json?.data?.summaryData ?? {};
  const read = (key: string) => {
    const v = d[key]?.value?.trim();
    return v && v !== "N/A" ? v : null;
  };
  return {
    sector: read("Sector"),
    industry: read("Industry"),
    marketCap: num(read("MarketCap")),
    range52w: read("FiftTwoWeekHighLow"),
    target1y: read("OneYrTarget"),
    volume: read("ShareVolume"),
    avgVolume: read("AverageVolume"),
  };
}
