import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import { sessionPhase } from "./format";
import { getSnapshot, portfolioToPrompt, snapshotToPrompt } from "./snapshot";
import { getBenchmark, getPortfolio } from "./portfolios";
import { BRIEF_SYSTEM, PORTFOLIO_SYSTEM } from "./prompts";
import type { PortfolioId } from "./types";

const MODEL = "claude-sonnet-5";

/**
 * Notes never expire on a timer. Every rewrite is a billed model call, so they
 * are rewritten once each weekday morning, when the cron job behind
 * /api/refresh marks this tag stale (see vercel.json). Between runs every
 * visitor gets the cached morning note. The only other rewrite is the first
 * render after a deploy that changes this file, which starts with an empty
 * cache.
 *
 * This tag is shared by every note, and marking it stale is the only way a
 * note is rewritten.
 */
export const NOTES_TAG = "notes";

export type Note = {
  text: string;
  /** ISO time the model finished writing. */
  writtenAt: string;
  /** Session phase label at the time of writing, e.g. "Pre-open". */
  phase: string;
};

/** What a panel renders: the note, or a plain reason it is missing. */
export type NoteResult = { note: Note } | { error: string };

class NotesOffError extends Error {}

/**
 * Belt and braces on the "never use an em dash" rule. A bolded label followed
 * by one becomes a colon; anywhere else it becomes a comma.
 */
function stripDashes(text: string): string {
  return text.replace(/\*\*\s*—\s*/g, "**: ").replace(/\s*—\s*/g, ", ");
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
 * One complete note from Claude. Every failure throws, including a refusal, an
 * empty answer or a truncated one, because the cache below only keeps a value
 * that returned: a throw leaves the last good note in place.
 */
async function writeNote(system: string, user: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new NotesOffError();
  }

  const client = new Anthropic();
  const message = await client.beta.messages.create(
    {
      model: MODEL,
      max_tokens: 4000,
      system,
      thinking: { type: "adaptive" },
      // The note is prose over data already gathered, not a reasoning
      // problem, so the lowest effort keeps the rewrite quick and cheap.
      output_config: { effort: "low" },
      // Routes around a safety refusal instead of returning an empty note.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: user }],
    },
    { timeout: 90_000 },
  );

  if (message.stop_reason === "refusal") {
    throw new Error("the model declined to write this note");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("the note was cut off at the token limit");
  }

  const text = stripDashes(
    message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join(""),
  ).trim();
  if (!text) throw new Error("the model returned an empty note");
  return text;
}

async function composeNote(system: string, user: string): Promise<Note> {
  const phase = sessionPhase();
  const text = await writeNote(
    system,
    `It is ${nowInEastern()} ET. ${phase.description}\n\n${user}`,
  );
  return { text, writtenAt: new Date().toISOString(), phase: phase.label };
}

/**
 * The desk note, written on the server and held in the Next data cache. When
 * the morning refresh marks it stale, the old note is served while a new one
 * is written, and if that rewrite fails the old note stays: readers never see
 * an empty panel because one model call went wrong.
 */
export const getBriefNote = unstable_cache(
  async (): Promise<Note> => {
    const snapshot = await getSnapshot();
    return composeNote(
      BRIEF_SYSTEM,
      "Write today's note from this snapshot.\n\n" + snapshotToPrompt(snapshot),
    );
  },
  ["note:brief:v2"],
  { revalidate: false, tags: [NOTES_TAG] },
);

/** One book's note. Same caching as the desk note, keyed by portfolio id. */
export const getPortfolioNote = unstable_cache(
  async (id: PortfolioId): Promise<Note> => {
    const [portfolio, snapshot, benchmark] = await Promise.all([
      getPortfolio(id),
      getSnapshot(),
      getBenchmark(),
    ]);
    return composeNote(
      PORTFOLIO_SYSTEM,
      "Write the note for this portfolio.\n\n" +
        portfolioToPrompt(portfolio, snapshot, benchmark),
    );
  },
  ["note:portfolio:v2"],
  { revalidate: false, tags: [NOTES_TAG] },
);

/**
 * Resolves a note for rendering. Only reached as an error when there is no
 * earlier note to fall back on, typically the first render after a deploy.
 */
export async function settleNote(pending: Promise<Note>): Promise<NoteResult> {
  try {
    return { note: await pending };
  } catch (err) {
    if (err instanceof NotesOffError) {
      return {
        error:
          "No ANTHROPIC_API_KEY is set, so the written notes are off. The " +
          "market data on this page is live and unaffected.",
      };
    }
    console.error("note failed:", err);
    return {
      error:
        "This note could not be written on the last refresh. The market data " +
        "on this page is live and unaffected, and the note is retried on the " +
        "next refresh.",
    };
  }
}
