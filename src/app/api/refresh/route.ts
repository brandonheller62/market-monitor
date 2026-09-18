import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { getBriefNote, NOTES_TAG } from "@/lib/note";
import { MARKET_TAG } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Eastern date and minutes past midnight for a moment in time. */
function eastern(at: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/**
 * Called by Vercel Cron every weekday morning before the US open (see
 * vercel.json). This is the only thing that rewrites the notes; they do not
 * expire on their own, so the model is billed once a morning, not per visit.
 *
 * The route is public, so it rewrites at most once a morning: if the notes
 * were already written today after 6 AM Eastern, a call does nothing. That
 * caps what a stranger calling it could cost at the same four calls a day.
 */
export async function GET(req: Request) {
  const current = await getBriefNote().catch(() => null);
  if (current) {
    const written = eastern(new Date(current.writtenAt));
    const now = eastern(new Date());
    if (written.date === now.date && written.minutes >= 6 * 60) {
      return Response.json({ ok: true, skipped: "already written this morning" });
    }
  }

  // Expire every cached market response outright, so the rewrite fetches live
  // numbers instead of whatever was cached overnight. The notes are only
  // marked stale ("max"), so a failed rewrite falls back to the old note
  // rather than to an empty panel. The page carries both tags and regenerates.
  // Do not add revalidatePath("/"): it hard-expires the page's implicit tags,
  // which the notes inherit, and a failed rewrite would have nothing to fall
  // back on.
  revalidateTag(MARKET_TAG, { expire: 0 });
  revalidateTag(NOTES_TAG, "max");

  // Invalidations land once this handler returns, so the page is requested
  // afterwards. That request starts the regeneration, which rewrites the notes.
  const home = new URL("/", req.url);
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await fetch(home, { cache: "no-store" }).catch(() => {});
  });

  return Response.json({ ok: true, requestedAt: new Date().toISOString() });
}
