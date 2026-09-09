import Anthropic from "@anthropic-ai/sdk";
import { getSnapshot, snapshotToPrompt } from "@/lib/snapshot";
import { easternDate } from "@/lib/calendar";
import { sessionPhase } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-5";
/** Rewrite the brief at most this often; page reloads inside the window replay it. */
const BRIEF_TTL_MS = 10 * 60 * 1000;

const SYSTEM = `You write the desk note for a US markets team.

Your reader is looking at the same numbers you are, on the page next to your
note. They do not need the numbers read back to them. They need to know what
the numbers mean together, and what to watch for the rest of the session.

Rules:
- Use only the data provided. Never invent a print, a quote, a level, or a
  causal claim the data does not support.
- When you attribute a move to a cause, say how confident that link is. "Rates
  are higher and growth names are lagging" is fair; "rates rose because of the
  jobs print" needs evidence in the data.
- The tape data comes from ETF proxies where noted. Do not call SPY "the S&P
  500 index" — say the exposure, not the instrument, or name the proxy.
- If a data source is listed as unavailable, say so plainly rather than
  papering over the gap.
- No hedging filler, no "as always, markets are complex", no investment advice.
- The note is written at a specific moment in the session, stated below. Frame
  it for that moment rather than assuming the market is about to open.

Format your answer as exactly these sections, in Markdown:

**The setup** — one paragraph, 2-3 sentences. The single sentence a trader
would say walking onto the desk, plus the context that makes it true.

**What moved** — 3 to 5 bullets. Each bullet: a bolded 2-5 word label, an em
dash, then one or two sentences. Lead with the most consequential item.

**Watch from here** — 2 to 4 bullets, same shape, forward-looking only from
the stated moment: releases still to come, earnings after the close, levels or
spreads that would change the read.

**The contrarian note** — one sentence naming the most plausible way this
morning's read turns out to be wrong.

Keep the whole note under 350 words.`;

type CacheEntry = { key: string; text: string };
let cache: CacheEntry | null = null;

function bucketKey(): string {
  return `${easternDate()}-${Math.floor(Date.now() / BRIEF_TTL_MS)}`;
}

function replay(text: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Brief-Cache": "hit" },
  });
}

export async function GET() {
  const key = bucketKey();
  if (cache?.key === key) return replay(cache.text);

  const hasCredentials = Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
  if (!hasCredentials) {
    return new Response(
      "No ANTHROPIC_API_KEY is set, so the written brief is off. " +
        "The market data on this page is live and unaffected. " +
        "Add a key to .env.local and restart to turn the brief on.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const snapshot = await getSnapshot();
  const client = new Anthropic();

  const now = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  const phase = sessionPhase();
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          system: SYSTEM,
          thinking: { type: "adaptive" },
          // Routes around a safety refusal instead of returning an empty brief.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages: [
            {
              role: "user",
              content:
                `It is ${now} ET. ${phase.description}\n\n` +
                `Write today's note from this snapshot.\n\n` +
                snapshotToPrompt(snapshot),
            },
          ],
        });

        run.on("text", (delta) => {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        });

        const final = await run.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "\n\nThe model declined to complete this note. The market data above is unaffected.",
            ),
          );
        } else if (full.trim()) {
          cache = { key, text: full };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        controller.enqueue(
          encoder.encode(`\n\nThe brief stopped early: ${message}`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Brief-Cache": "miss",
    },
  });
}
