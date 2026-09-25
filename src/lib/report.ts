import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import { fmtPct, fmtPrice, sessionPhase } from "./format";
import { nowInEastern, stripDashes } from "./note";
import { STOCK_SYSTEM } from "./prompts";
import { getStock } from "./stock";
import type { StockDetail } from "./types";

const MODEL = "claude-sonnet-5";

/**
 * Seconds a stock report is held before a request rewrites it. A report runs
 * web searches on top of the model call, so it costs more than a note; an
 * hour keeps the news current without paying for it on every click.
 */
export const REPORT_TTL = 3600;

/** Searches allowed per report. Each is billed on top of the tokens. */
const MAX_SEARCHES = 5;

/** A long search turn can pause server-side; resume it at most this often. */
const MAX_CONTINUATIONS = 3;

export type ReportSource = { title: string; url: string };

export type StockReport = {
  text: string;
  sources: ReportSource[];
  /** ISO time the model finished writing. */
  writtenAt: string;
  /** Session phase label at the time of writing, e.g. "After the close". */
  phase: string;
};

export class ReportsOffError extends Error {}

function stockToPrompt(s: StockDetail): string {
  const lines = [
    `${s.symbol}: ${s.name}`,
    `Held in: ${s.books.map((b) => b.name).join(", ")}`,
    `Sector / industry: ${s.sector ?? "n/a"} / ${s.industry ?? "n/a"}`,
    `Last price: ${fmtPrice(s.price)} (last trade ${s.asOf ?? "n/a"})`,
    `Today: ${fmtPct(s.changePct)}`,
    `5 sessions: ${fmtPct(s.fiveDayPct)}`,
    `About 1 month: ${fmtPct(s.oneMonthPct)}`,
    `Since ${s.sinceDate} (from the prior close): ${fmtPct(s.sincePct)}`,
    `52-week high/low: ${s.range52w ?? "n/a"}`,
    `Analyst 1-year consensus target (Nasdaq): ${s.target1y ?? "n/a"}`,
    `Volume today vs average: ${s.volume ?? "n/a"} vs ${s.avgVolume ?? "n/a"}`,
    "",
    "Daily closes, oldest first:",
    ...s.closes.map((c) => `${c.date} ${fmtPrice(c.close)}`),
  ];
  return lines.join("\n");
}

/**
 * One complete report. Every failure throws, as the notes do, so the cache
 * below keeps the last good report instead of storing a broken one.
 */
async function writeReport(stock: StockDetail): Promise<Omit<StockReport, "phase" | "writtenAt">> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new ReportsOffError();
  }

  const client = new Anthropic();
  const phase = sessionPhase();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content:
        `It is ${nowInEastern()} ET. ${phase.description}\n\n` +
        "Write the report for this stock.\n\n" +
        stockToPrompt(stock),
    },
  ];

  // Content across every turn: a paused search turn is resumed by sending it
  // back, and the reply carries on from where it stopped.
  const content: Anthropic.Beta.BetaContentBlock[] = [];

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const message = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 8000,
        system: STOCK_SYSTEM,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        // The basic search tool, not web_search_20260209: the newer one filters
        // results through a code sandbox, which ran several times slower here
        // and returned the report with no citations to list as sources.
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
        // Routes around a safety refusal instead of returning an empty report.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages,
      },
      { timeout: 110_000 },
    );
    content.push(...message.content);

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    if (message.stop_reason === "refusal") {
      throw new Error("the model declined to write this report");
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error("the report was cut off at the token limit");
    }
    break;
  }

  // The report is the text after the last search result; anything before it is
  // the model narrating its searches.
  const lastResult = content.findLastIndex((b) => b.type === "web_search_tool_result");
  const answer = content
    .slice(lastResult + 1)
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");

  // Drop any lead-in ("Now I have enough to write...") before the first section.
  const joined = answer.map((b) => b.text).join("");
  const start = joined.indexOf("**");
  const text = stripDashes(start > 0 ? joined.slice(start) : joined).trim();
  if (!text) throw new Error("the model returned an empty report");

  // Sources are the pages the report actually cites, in first-cited order.
  const seen = new Map<string, ReportSource>();
  for (const block of answer) {
    for (const c of block.citations ?? []) {
      if (c.type === "web_search_result_location" && !seen.has(c.url)) {
        seen.set(c.url, { url: c.url, title: c.title ?? new URL(c.url).hostname });
      }
    }
  }

  return { text, sources: [...seen.values()] };
}

/**
 * The report for one holding, held in the Next data cache per ticker. Once it
 * is an hour old the next request serves the old one while a new one is
 * written behind it; a failed rewrite leaves the old report in place.
 */
export const getStockReport = unstable_cache(
  async (symbol: string): Promise<StockReport> => {
    const stock = await getStock(symbol);
    if (!stock) throw new Error(`${symbol} is not held in any book`);
    const phase = sessionPhase();
    const report = await writeReport(stock);
    return { ...report, writtenAt: new Date().toISOString(), phase: phase.label };
  },
  ["report:stock:v3"],
  { revalidate: REPORT_TTL },
);
