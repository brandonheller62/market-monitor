"use client";

import { useEffect, useState, type ReactNode } from "react";

const SECTION = /^\*\*(.+?)\*\*:?\s*$/;

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyBase}-${i}`}>{part}</span>;
  });
}

/** Renders the subset of Markdown the note is written in: sections, bullets, bold. */
function render(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (bullets.length === 0) return;
    out.push(
      <ul key={`ul-${key}`}>
        {bullets.map((b, i) => (
          <li key={`${key}-${i}`}>{inline(b, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  md.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      flush(`b${i}`);
      return;
    }
    const section = line.match(SECTION);
    if (section) {
      flush(`b${i}`);
      out.push(<h3 key={`h-${i}`}>{section[1]}</h3>);
      return;
    }
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ""));
      return;
    }
    flush(`b${i}`);
    out.push(<p key={`p-${i}`}>{inline(line, `p${i}`)}</p>);
  });

  flush("end");
  return out;
}

export function Brief() {
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "streaming" | "done" | "off">(
    "loading",
  );

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/brief", { signal: controller.signal });
        if (res.status === 503) {
          setText(await res.text());
          setState("off");
          return;
        }
        if (!res.body) throw new Error("no response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        setState("streaming");
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setText((prev) => prev + decoder.decode(value, { stream: true }));
        }
        setState("done");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setText(
          "The brief could not be reached. The market data on this page is live and unaffected.",
        );
        setState("off");
      }
    })();

    return () => controller.abort();
  }, []);

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
                : "Written by Claude from the data on this page"}
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
            {render(text)}
            {state === "streaming" && <span className="caret" />}
          </>
        )}
      </div>
    </section>
  );
}
