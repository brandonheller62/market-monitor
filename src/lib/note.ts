import Anthropic from "@anthropic-ai/sdk";
import { easternDate } from "./calendar";
import { sessionPhase } from "./format";

const MODEL = "claude-sonnet-5";
/** Rewrite a note at most this often; reloads inside the window replay it. */
const NOTE_TTL_MS = 10 * 60 * 1000;

/**
 * Belt and braces on the "never use an em dash" rule. A bolded label followed
 * by one becomes a colon; anywhere else it becomes a comma. Chunks are held
 * back by any trailing run of stars, spaces or dashes so a pattern split
 * across stream boundaries still matches, which makes the output identical
 * whatever size the deltas arrive in.
 */
function makeDashStripper() {
  const rewrite = (t: string) =>
    t.replace(/\*\*\s*—\s*/g, "**: ").replace(/\s*—\s*/g, ", ");
  let carry = "";

  return {
    push(chunk: string): string {
      const text = carry + chunk;
      const tail = text.match(/[*\s—]+$/);
      const held = tail?.[0] ?? "";
      carry = held;
      return rewrite(text.slice(0, text.length - held.length));
    },
    flush(): string {
      const rest = rewrite(carry);
      carry = "";
      return rest;
    },
  };
}

const cache = new Map<string, { key: string; text: string }>();

function bucketKey(name: string): string {
  return `${name}-${easternDate()}-${Math.floor(Date.now() / NOTE_TTL_MS)}`;
}

function textResponse(body: string, status: number, cacheState: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Note-Cache": cacheState,
      "Cache-Control": "no-store",
    },
  });
}

export function nowInEastern(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

/**
 * Streams one written note from Claude, cached per name for NOTE_TTL_MS so a
 * reload replays the text instead of billing a fresh call.
 */
export function streamNote({
  name,
  system,
  user,
}: {
  name: string;
  system: string;
  user: string;
}): Response {
  const key = bucketKey(name);
  const hit = cache.get(name);
  if (hit?.key === key) return textResponse(hit.text, 200, "hit");

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return textResponse(
      "No ANTHROPIC_API_KEY is set, so the written notes are off. The market " +
        "data on this page is live and unaffected. Add a key to .env.local and " +
        "restart to turn them on.",
      503,
      "off",
    );
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const stripper = makeDashStripper();
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          system,
          thinking: { type: "adaptive" },
          // The note is prose over data already gathered, not a reasoning
          // problem, so the lowest effort keeps the reader from waiting on
          // thinking they never see.
          output_config: { effort: "low" },
          // Routes around a safety refusal instead of returning an empty note.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages: [{ role: "user", content: user }],
        });

        run.on("text", (delta) => {
          const clean = stripper.push(delta);
          if (clean) {
            full += clean;
            controller.enqueue(encoder.encode(clean));
          }
        });

        const final = await run.finalMessage();
        const tail = stripper.flush();
        if (tail) {
          full += tail;
          controller.enqueue(encoder.encode(tail));
        }

        if (final.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "\n\nThe model declined to complete this note. The market data " +
                "alongside it is unaffected.",
            ),
          );
        } else if (full.trim()) {
          cache.set(name, { key, text: full });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        controller.enqueue(encoder.encode(`\n\nThe note stopped early: ${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Note-Cache": "miss",
    },
  });
}

export { sessionPhase };
