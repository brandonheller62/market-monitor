"use client";

import { renderMarkdown } from "./Markdown";
import { useStreamedText } from "./useStreamedText";

export function Brief() {
  const { text, state } = useStreamedText("/api/brief");

  return (
    <section aria-live="polite" aria-busy={state === "loading" || state === "streaming"}>
      <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-2">
        <h2 className="eyebrow">The note</h2>
        <span className="data text-[0.625rem] text-[var(--muted)]">
          {state === "loading"
            ? "Reading the tape…"
            : state === "streaming"
              ? "Writing"
              : state === "off"
                ? "Unavailable"
                : "Generated in real time with the Anthropic and Nasdaq APIs"}
        </span>
      </div>

      <div className="brief mt-6">
        {state === "loading" && (
          <p className="text-[var(--muted)]">
            Pulling quotes, the curve, today&rsquo;s calendar and the wire, then
            writing the note. <span className="caret" />
          </p>
        )}
        {state === "off" && <p className="text-[var(--muted)]">{text}</p>}
        {(state === "streaming" || state === "done") && (
          <>
            {renderMarkdown(text)}
            {state === "streaming" && <span className="caret" />}
          </>
        )}
      </div>
    </section>
  );
}
