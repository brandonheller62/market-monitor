import { getSnapshot, portfolioToPrompt } from "@/lib/snapshot";
import { getPortfolio, isPortfolioId } from "@/lib/portfolios";
import { nowInEastern, streamNote } from "@/lib/note";
import { sessionPhase } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You write a portfolio note for the owner of the holdings below.

They can see the price and the session move for every position on the page next
to your note. Do not read the table back to them. Tell them what this specific
collection of companies is a bet on, what is driving it today, and what to
watch for these names.

Rules:
- Never invent a price, a level, a print, or a piece of news. Everything
  numerical must come from the data provided.
- You may use general knowledge of what these companies do and what sector they
  sit in. That is what makes the note specific to this portfolio. What you may
  not do is claim a fact about their results, guidance, or news flow that is not
  in the data.
- There are no share counts, so you cannot compute a portfolio return. Both the
  average holding move and the since-September-1 value are equal-weighted
  illustrations and must be described that way. Never call the hypothetical
  dollar figure the portfolio's value.
- Two windows are given for each holding: today's session, and the move since
  September 1. Say which one you mean every time, and when the two disagree,
  that gap is usually the most interesting thing on the page.
- When you link a holding's move to a macro driver, say how firm the link is.
  A tanker name up on a day crude is up is a plausible read, not a proven one.
- Say what is concentrated. If several holdings are the same bet wearing
  different names, say so plainly, and say where the portfolio has no exposure
  if that absence is the more interesting fact.
- No hedging filler, no investment advice, no price targets, no buy or sell
  language.
- Never use an em dash. Use a colon, a comma, or a second sentence instead.

Format your answer as exactly these sections, in Markdown:

**What this portfolio is**: one paragraph, 2-3 sentences naming the real theme
or themes running through the holdings, and the character that follows from it.

**Driving it today**: 3 to 4 bullets. Each bullet is a bolded ticker or short
label, then a colon, then one or two sentences. Lead with the largest movers
and say what connects them.

**Since September 1**: 2 to 3 bullets on the month so far: which holdings built
or cost the most over that window, whether today confirms or contradicts the
month, and any name whose two windows point opposite ways.

**Where the risk clusters**: 2 to 3 bullets on concentration, correlation
between holdings, or an exposure the portfolio is missing.

**Watch for these names**: 2 to 3 bullets, forward-looking only: holdings
reporting, macro prints that matter to these specific companies, levels that
would change the read.

Keep the whole note under 400 words.`;

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/portfolio/[id]">,
) {
  const { id } = await ctx.params;
  if (!isPortfolioId(id)) {
    return new Response("Unknown portfolio.", { status: 404 });
  }

  const [portfolio, snapshot] = await Promise.all([getPortfolio(id), getSnapshot()]);
  const phase = sessionPhase();

  return streamNote({
    name: `portfolio-${id}`,
    system: SYSTEM,
    user:
      `It is ${nowInEastern()} ET. ${phase.description}\n\n` +
      `Write the note for this portfolio.\n\n` +
      portfolioToPrompt(portfolio, snapshot),
  });
}
