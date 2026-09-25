export type Quote = {
  label: string;
  symbol: string;
  /** What the price is: a real index level, an ETF's share price, or a spot rate. */
  kind: "index" | "etf" | "spot";
  /** Small print under the label: "index", or the ticker and what the ETF holds. */
  note: string;
  /** Set when every index source was down and the row shows the ETF instead. */
  fallback?: boolean;
  price: number | null;
  change: number | null;
  changePct: number | null;
  asOf: string | null;
};

export type QuoteGroup = { title: string; caption: string; quotes: Quote[] };

export type CurvePoint = { label: string; yield: number | null };

export type Curve = {
  date: string | null;
  points: CurvePoint[];
  twosTens: number | null;
};

export type Mover = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
};

export type EconEvent = {
  time: string;
  country: string;
  event: string;
  actual: string;
  consensus: string;
  previous: string;
  released: boolean;
};

export type Earning = {
  symbol: string;
  name: string;
  time: string;
  epsForecast: string;
  marketCap: number | null;
};

export type Headline = {
  title: string;
  link: string;
  source: string;
  published: number | null;
};

export type Snapshot = {
  generatedAt: string;
  groups: QuoteGroup[];
  curve: Curve;
  gainers: Mover[];
  losers: Mover[];
  econ: EconEvent[];
  earnings: Earning[];
  headlines: Headline[];
  fx: { pair: string; rate: number }[];
  crypto: Quote[];
  degraded: string[];
};

export type PortfolioId = "jaffee" | "class" | "dartboard";

export type Holding = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  asOf: string | null;
  /** Close on the last session before the since-date. */
  baseline: number | null;
  /** Move from that close to now, in percent. */
  sincePct: number | null;
};

export type Portfolio = {
  id: PortfolioId;
  name: string;
  blurb: string;
  holdings: Holding[];
  /** Equal-weighted, because the sheet carries no share counts. */
  averageChangePct: number | null;
  advancing: number;
  priced: number;
  best: Holding | null;
  worst: Holding | null;
  /** Month-to-date block, measured from the close before `since`. */
  since: {
    date: string;
    baselineDate: string | null;
    /** Hypothetical capital spread equally across the priced holdings. */
    startValue: number;
    currentValue: number | null;
    changePct: number | null;
    tracked: number;
    best: Holding | null;
    worst: Holding | null;
  };
};

export type Benchmark = {
  label: string;
  symbol: string;
  note: string;
  price: number | null;
  changePct: number | null;
  sincePct: number | null;
  baselineDate: string | null;
};

export type StockDetail = {
  symbol: string;
  name: string;
  /** Every book that holds the name. */
  books: { id: PortfolioId; name: string }[];
  price: number | null;
  changePct: number | null;
  asOf: string | null;
  /** Moves over trailing windows, from Nasdaq's daily closes. */
  fiveDayPct: number | null;
  oneMonthPct: number | null;
  /** Move from the close before SINCE_DATE, matching the portfolio tabs. */
  sincePct: number | null;
  sinceDate: string;
  closes: { date: string; close: number }[];
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  range52w: string | null;
  target1y: string | null;
  volume: string | null;
  avgVolume: string | null;
};
