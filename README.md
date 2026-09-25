# Market Monitor

A US markets recap: one page that says where the tape stands, what prints
next, and what to watch, assembled from public data, with a written note from
Claude on top of it. The masthead and the note are framed for wherever the
session is (pre-open, intraday, after the close, weekend).

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

Without a key the page renders in full and the note panels say the notes are off.

## What's on the page

| Section | What it shows |
| --- | --- |
| **The note** | Claude reads the full snapshot and writes a desk note: the setup, what moved, what to watch, and the most plausible way the read is wrong. It's framed for the session phase at the time of writing, which the panel states, and it is written on the server, so it is in the page's HTML. |
| **Indices** | Real index levels: S&P 500, Dow, Nasdaq Composite, Nasdaq 100, Russell 2000 and the VIX. |
| **Rates, dollar & commodities** | ETF share prices (TLT, UUP, GLD, USO), labelled as ETFs rather than presented as spot levels. |
| **Treasury curve** | The par yield curve at seven maturities, plus the 2s10s spread. |

### On the portfolios

Holdings are defined in `src/lib/portfolios.ts`. Every ticker was resolved
against Nasdaq's symbol lookup rather than from memory, and all 45 return a
live quote (note that "Everpure Inc" is the symbol `P`).

The sheets carry no share counts, so the app cannot compute a portfolio return
and does not pretend to. What it shows is an equal-weighted read of the session:
the average holding move and the advance/decline count, labelled as such on the
page and in the prompt.

Every book's note is written on the server along with the desk note, so all
three are in the page's HTML whichever tab is open.

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

### Stock reports

Every holding row links to `/stock/<TICKER>`: the live quote, the move today,
over five sessions, over a month and since September 1, the company's sector,
market cap, 52-week range and analyst target, and which books hold it.

Beside those numbers is a report from Claude: what happened in the news
recently, why the stock is moving, what comes next, a bull and a bear case,
and a lean (higher, lower or sideways over the next few weeks, with a
confidence level and what would flip it). It never gives a price target of
its own. Claude researches it with the web search tool, and the pages it
cites are listed under the report.

Reports cost more than the notes, because each one runs up to five billed
searches, so they are guarded three ways:

- Only tickers in `src/lib/portfolios.ts` have a page or a report; anything
  else is a 404.
- The page itself carries no report. The browser asks for it with a POST to
  `/api/report/<TICKER>` after the page loads, so a crawler following the
  holding links never starts one.
- Each ticker's report is cached for an hour (`REPORT_TTL` in
  `src/lib/report.ts`), with the same keep-the-last-good-one behaviour as the
  notes. A fresh report takes about 20 seconds; a cached one loads at once.

They use the basic `web_search_20250305` tool rather than the newer
`web_search_20260209`: the newer one filters results through a code sandbox,
which was several times slower here and left the report without citations.

## Where the data comes from

All sources are public and keyless.

| Data | Source |
| --- | --- |
| Index levels: S&P 500, Dow (as DJX × 100), Russell 2000, VIX; fallback for Nasdaq 100 | `cdn.cboe.com` delayed quotes |
| Nasdaq indices, ETFs, stock quotes, movers, economic calendar, earnings calendar | `api.nasdaq.com` |
| Treasury par yield curve | `home.treasury.gov` XML feed |
| FX | `api.frankfurter.dev` |
| Crypto | `api.coingecko.com` |
| Headlines | CNBC Markets, CNBC Economy, MarketWatch, FT Markets, Federal Reserve press releases |

Two things worth knowing about the tape:

- **Every index row is a real index level.** Nasdaq's quote API only carries
  its own indices, so the rest come from Cboe. If every index source for a row
  is down, the row falls back to its ETF, is relabelled as the ETF (for example
  "S&P 500 ETF"), and the footer names the gap. A quote whose last trade is
  more than five days old is treated as missing: Cboe's own `^DJI` and `^COMP`
  quotes stopped updating long ago but still answer, which is why the Dow is
  read from DJX.
- **Treasuries, the dollar, gold and crude are ETF prices.** No free, keyless
  feed carries those spot levels, so the second panel is labelled as ETFs.
  USO and UUP hold rolling futures and track their underlying only loosely;
  Claude is told this and is told never to quote an ETF price as a spot level.
- **Prices are delayed at the source.** This is a recap, not a trading
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
               note.ts      writes the notes with Claude, cached server-side
               prompts.ts   the notes' system prompts
               market.ts    quotes, Treasury curve, movers, FX, crypto
               calendar.ts  economic releases + earnings, keyed to the ET date
               news.ts      RSS parsing and dedupe
               snapshot.ts  one fan-out across all of it, plus the text
                            rendering that Claude reads
               stock.ts     one holding's quote, history and company facts
               report.ts    the per-stock report, researched with web search
src/app/       page.tsx     server component: renders the snapshot
               stock/[symbol]/page.tsx       one holding's page
               api/report/[symbol]/route.ts  writes that holding's report
src/components/             the panels
```

The page is an ISR route revalidating every 5 minutes (`REVALIDATE` in
`src/lib/http.ts`). Every upstream fetch shares the Next data cache, so the page
and the notes read identical numbers without paying for the fetches twice.

The notes are written on the server and rendered into the page, so they are
there on first paint, for crawlers, and with JavaScript off. Each note is held
in the Next data cache (`unstable_cache`) for an hour (`NOTE_TTL` in
`src/lib/note.ts`). A visit to the page is what rewrites them: the first
visitor after the hour is up is served the old note while a new one is written
behind them, and everyone in between reads the cached note. So the API key is
billed at most four calls an hour (the desk note plus three books) on a day
someone is looking, and nothing at all on a day nobody is. If a rewrite fails
(API error, refusal, truncation, timeout) the previous note stays. Notes are
also rewritten on the first render after a deploy that changes
`src/lib/note.ts`, which starts with an empty cache.

They run `claude-sonnet-5` with adaptive thinking at low effort and declare
server-side refusal fallbacks, so a declined request routes to another model.

## Deploying

Deploys to Vercel as-is. Set `ANTHROPIC_API_KEY` in the project's environment
variables for the notes. Nothing else is required, and there is no database.

Not investment advice.
