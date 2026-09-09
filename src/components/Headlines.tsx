import { timeAgo } from "@/lib/format";
import type { Headline } from "@/lib/types";

export function Headlines({ headlines }: { headlines: Headline[] }) {
  if (headlines.length === 0) {
    return (
      <section className="panel px-4 py-3">
        <h2 className="eyebrow">The wire</h2>
        <p className="data mt-3 text-[0.8125rem] text-[var(--muted)]">
          No feeds responded on this run. Reload to try again.
        </p>
      </section>
    );
  }

  return (
    <section className="panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">The wire</h2>
        <span className="data text-[0.625rem] text-[var(--muted)]">
          {headlines.length} stories, newest first
        </span>
      </div>
      <div className="mt-1 md:columns-2 md:gap-8">
        {headlines.slice(0, 22).map((h) => (
          <a
            key={h.link}
            href={h.link}
            target="_blank"
            rel="noreferrer"
            className="row-rule group block break-inside-avoid py-2.5"
          >
            <span className="data text-[0.625rem] uppercase tracking-[0.15em] text-[var(--accent)]">
              {h.source}
            </span>
            <span className="data ml-2 text-[0.625rem] text-[var(--muted)]">
              {timeAgo(h.published)}
            </span>
            <div className="mt-0.5 text-[0.9375rem] leading-snug group-hover:text-[var(--accent)]">
              {h.title}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
