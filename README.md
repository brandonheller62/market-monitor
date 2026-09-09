# Market Monitor

A morning market recap: one page that says what moved overnight, what prints
today, and what to watch, assembled at page load from public data, with a
written note from Claude on top of it.

![Market Monitor](docs/screenshot.png)

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

Every number and headline works with no configuration. The written note needs a
Claude API key:

```bash
cp.env.example.env.local   # then paste your key into ANTHROPIC_API_KEY
npm run dev
```

Without a key the page renders in full and the note panel says the brief is off.

## What's on the page

| Section | What it shows |
| --- | --- |
| **The note** | Claude reads the full snapshot and writes a desk note: the setup, what moved, what to watch, and the most plausible way the read is wrong. It's framed for the current session phase (pre-open, open, after the close, weekend) and streams in as it's written. |
| **Equities / Risk, rates & real assets** | Ten gauges with session change. |
| **Treasury curve** | The par yield curve at seven maturities, plus the 2s10s spread. |

### On the portfolios

Holdings are defined in `src/lib/portfolios.ts`. Every ticker was resolved
against Nasdaq's symbol lookup rather than from memory, and all 45 return a
live quote (note that "Everpure Inc" is the symbol `P`).

The sheets carry no share counts, so the app cannot compute a portfolio return
and does not pretend to. What it shows is an equal-weighted read of the session:
the average holding move and the advance/decline count, labelled as such on the
page and in the prompt.

A tab's note is written the first time you open that tab, not on page load, so
you only pay for the books you actually look at. Once opened it stays put for
the rest of the visit.

### Since September 1

Each holding also carries its move since the start of September, measured from
the last close before the 1st (the standard month-to-date base), fetched from
Nasdaq's daily history and cached for six hours since a settled close does not
change. The date lives in `SINCE_DATE` in `src/lib/portfolios.ts`: change that
one line to re-point the window, or set it to the first of the current month to
make it roll.

Each tab also carries an S&P 500 benchmark panel: the index's move in both
windows, the book's own figures beside it, and the gap in points. Nasdaq's
quote API does not carry the index itself, so the benchmark is SPY and the
panel names the proxy. The book is equal-weighted and the index is
cap-weighted, so the gap is a rough read rather than an attribution, and both
the panel and the note say so.

Because there are still no share counts, the dollar figure is explicitly a
hypothetical: what $10,000 split equally across the priced holdings at that
close would be worth now. The page says so under the number, and the prompt
forbids the note from calling it the portfolio's value.

## Where the data comes from

All sources are public and keyless.

| Data | Source |
| --- | --- |
| Quotes, movers, economic calendar, earnings calendar | `api.nasdaq.com` |
| Treasury par yield curve | `home.treasury.gov` XML feed |
| FX | `api.frankfurter.dev` |
| Crypto | `api.coingecko.com` |
| Headlines | CNBC Markets, CNBC Economy, MarketWatch, FT Markets, Federal Reserve press releases |

Two things worth knowing about the tape:

- **Nasdaq's public quote API only carries its own indices.** COMP and NDX are
  real indices; everything else is read through the most liquid ETF for that
  exposure, and the page labels the proxy under each row (`SPY`, `DIA`, `TLT`…).
  Claude is told the same thing, so it won't call SPY "the S&P 500 index".
- **Prices are delayed at the source.** This is a morning read, not a trading
  screen.

The economic and earnings calendars, the market movers, FX, crypto and the
headline feeds are no longer shown as panels. They are still fetched, because
the written notes read them for context, and the footer credits them.

Any source can rate-limit or change shape. Each fetch fails to `null` rather
than throwing, so one bad feed degrades one panel; the footer names anything
that didn't respond on that run.

## How it's wired

```
src/lib/       http.ts      fetch wrapper: browser UA, timeout, Next data cache
               market.ts    quotes, Treasury curve, movers, FX, crypto
               calendar.ts  economic releases + earnings, keyed to the ET date
               news.ts      RSS parsing and dedupe
               snapshot.ts  one fan-out across all of it, plus the text
                            rendering that Claude reads
src/app/       page.tsx     server component: renders the snapshot
               api/brief/   streams the note from Claude
src/components/             the panels
```

The page is an ISR route revalidating every 5 minutes (`REVALIDATE` in
`src/lib/http.ts`). Every upstream fetch shares the Next data cache, so the page
and the brief route read identical numbers without paying for the fetches twice.

The brief itself is cached in-process for 10 minutes and replayed to anyone who
loads the page inside that window, otherwise every reload would bill a fresh
Opus call. It runs `claude-opus-5` with adaptive thinking, streams token by
token, and declares server-side refusal fallbacks so a declined request routes
to another model instead of leaving an empty panel.

## Deploying

Deploys to Vercel as-is. Set `ANTHROPIC_API_KEY` in the project's environment
variables for the note. Nothing else is required, and there is no database.

Not investment advice.
