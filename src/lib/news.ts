import { getText } from "./http";
import type { Headline } from "./types";

const FEEDS: { source: string; url: string; take: number }[] = [
  { source: "CNBC Markets", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", take: 8 },
  { source: "CNBC Economy", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html", take: 6 },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", take: 6 },
  { source: "FT Markets", url: "https://www.ft.com/markets?format=rss", take: 6 },
  { source: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", take: 4 },
];

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    // Feeds double-encode: &amp;#x2018; becomes &#x2018; above, decode that too.
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .trim();
}

function parseFeed(xml: string, source: string, take: number): Headline[] {
  const items = xml.split(/<item[\s>]/i).slice(1);
  return items
    .slice(0, take)
    .map((block) => {
      const title = tag(block, "title");
      const link = tag(block, "link") ?? tag(block, "guid");
      if (!title || !link) return null;
      const date = tag(block, "pubDate") ?? tag(block, "dc:date");
      const published = date ? Date.parse(date) : NaN;
      return {
        title,
        link,
        source,
        published: Number.isFinite(published) ? published : null,
      };
    })
    .filter((h): h is Headline => h !== null);
}

export async function getHeadlines(): Promise<Headline[]> {
  const results = await Promise.all(
    FEEDS.map(async (f) => {
      const xml = await getText(f.url);
      return xml ? parseFeed(xml, f.source, f.take) : [];
    }),
  );

  const seen = new Set<string>();
  return results
    .flat()
    .filter((h) => {
      const key = h.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.published ?? 0) - (a.published ?? 0));
}
