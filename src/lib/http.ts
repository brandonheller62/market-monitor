const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Seconds the Next data cache holds a response before refetching. */
export const REVALIDATE = 300;

/**
 * Tag on every upstream response, so the morning refresh can expire them all
 * and write the note from freshly fetched numbers rather than cached ones.
 */
export const MARKET_TAG = "market";

/**
 * Every upstream here is a public, keyless endpoint that will occasionally
 * rate-limit or change shape. Callers get `null` instead of a throw so one bad
 * feed degrades a single panel rather than the whole page.
 */
export async function getJson<T>(
  url: string,
  revalidate = REVALIDATE,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate, tags: [MARKET_TAG] },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getText(
  url: string,
  revalidate = REVALIDATE,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/xml, text/xml, */*" },
      next: { revalidate, tags: [MARKET_TAG] },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** "$763.41" / "26,327.40" / "+1.9%" -> number, or null when unparseable. */
export function num(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = raw.replace(/[$,%\s]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
