import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { NOTES_TAG } from "@/lib/note";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called by Vercel Cron each weekday morning before the US open (see
 * vercel.json). This is the only thing that rewrites the notes; they do not
 * expire on their own, so the model is billed once a day, not per visit.
 *
 * Every call forces billed model calls, so it only runs with the CRON_SECRET
 * that Vercel sends as a bearer token. Without that variable set, it is off.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Marking stale with "max" keeps the old notes servable, so a failed
  // rewrite falls back to them instead of to an empty panel. The page carries
  // this tag too, so it goes stale with them. Do not add revalidatePath("/"):
  // it hard-expires the page's implicit tags, which the notes inherit, and a
  // failed rewrite would then have nothing to fall back on.
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
