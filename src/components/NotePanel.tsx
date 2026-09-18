import { renderMarkdown } from "./Markdown";
import type { NoteResult } from "@/lib/note";

function writtenLabel(iso: string, phase: string): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
  return `Written ${time} ET · ${phase.toLowerCase()}`;
}

/**
 * A written note, rendered on the server into the page's HTML. The heading
 * level differs between the desk note and a portfolio tab, so it is passed in.
 */
export function NotePanel({
  title,
  result,
  as: Heading = "h2",
}: {
  title: string;
  result: NoteResult;
  as?: "h2" | "h3";
}) {
  return (
    <section className="min-w-0">
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] pb-2">
        <Heading className="eyebrow">{title}</Heading>
        <span className="data text-right text-[0.625rem] text-[var(--muted)]">
          {"note" in result
            ? writtenLabel(result.note.writtenAt, result.note.phase)
            : "Unavailable"}
        </span>
      </div>

      <div className="brief mt-6">
        {"note" in result ? (
          renderMarkdown(result.note.text)
        ) : (
          <p className="text-[var(--muted)]">{result.error}</p>
        )}
      </div>
    </section>
  );
}
