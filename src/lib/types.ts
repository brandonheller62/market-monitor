export type Quote = {
  label: string;
  symbol: string;
  note: string;
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
