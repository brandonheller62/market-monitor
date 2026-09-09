import { getSnapshot, snapshotToPrompt } from "@/lib/snapshot";
import { nowInEastern, streamNote } from "@/lib/note";
import { sessionPhase } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You write the desk note for a US markets team.

Your reader can see the index and commodity board and the Treasury curve on the
page next to your note, so do not read those numbers back to them. They cannot
see the economic calendar, the earnings calendar or the headlines, so anything
that matters from those has to reach them through you.

They need to know what the numbers mean together, and what to watch for the
rest of the session.

Rules:
- Use only the data provided. Never invent a print, a quote, a level, or a
  causal claim the data does not support.
- When you attribute a move to a cause, say how confident that link is. "Rates
  are higher and growth names are lagging" is fair; "rates rose because of the
  jobs print" needs evidence in the data.
- The tape data comes from ETF proxies where noted. Do not call SPY "the S&P
  500 index". Say the exposure, not the instrument, or name the proxy.
- If a data source is listed as unavailable, say so plainly rather than
  papering over the gap.
- No hedging filler, no "as always, markets are complex", no investment advice.
- The note is written at a specific moment in the session, stated below. Frame
  it for that moment rather than assuming the market is about to open.
- Never use an em dash. Use a colon, a comma, or a second sentence instead.

Format your answer as exactly these sections, in Markdown:

**The setup**: one paragraph, 2-3 sentences. The single sentence a trader
would say walking onto the desk, plus the context that makes it true.

**What moved**: 3 to 5 bullets. Each bullet is a bolded 2-5 word label, then a
colon, then one or two sentences. Lead with the most consequential item.

**Watch from here**: 2 to 4 bullets, same shape, forward-looking only from the
stated moment: releases still to come, earnings after the close, levels or
spreads that would change the read.

**The contrarian note**: one sentence naming the most plausible way this
morning's read turns out to be wrong.

Keep the whole note under 350 words.`;

export async function GET() {
  const snapshot = await getSnapshot();
  const phase = sessionPhase();

  return streamNote({
    name: "brief",
    system: SYSTEM,
    user:
      `It is ${nowInEastern()} ET. ${phase.description}\n\n` +
      `Write today's note from this snapshot.\n\n` +
      snapshotToPrompt(snapshot),
  });
}
