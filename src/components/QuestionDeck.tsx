"use client";

import { useCallback, useEffect, useState } from "react";

const BUTTON =
  "data cursor-pointer border border-[var(--line)] px-4 py-2 text-[0.75rem] uppercase tracking-[0.18em] text-[var(--paper)] transition-colors hover:border-[var(--accent)] disabled:cursor-default disabled:opacity-30 disabled:hover:border-[var(--line)]";

/** One question on screen at a time; arrow keys or the buttons step through. */
export function QuestionDeck({ questions }: { questions: string[] }) {
  const [index, setIndex] = useState(0);
  const last = questions.length - 1;

  const go = useCallback(
    (to: number) => setIndex(Math.min(Math.max(to, 0), last)),
    [last],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, last));
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  return (
    <section aria-roledescription="carousel" aria-label="Closing questions">
      <div className="flex items-baseline justify-between">
        <span className="data text-sm text-[var(--accent)]">
          {String(index + 1).padStart(2, "0")}
          <span className="text-[var(--muted)]">
            {" "}/ {String(questions.length).padStart(2, "0")}
          </span>
        </span>
        <span className="eyebrow hidden sm:inline">← → to move</span>
      </div>

      <div className="mt-3 h-px w-full bg-[var(--line)]">
        <div
          className="h-px bg-[var(--accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <p
        key={index}
        aria-live="polite"
        className="rise display flex min-h-[40vh] max-w-[22ch] items-center py-12 text-[clamp(1.75rem,5vw,3.75rem)] leading-[1.05] text-[var(--paper)]"
      >
        {questions[index]}
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className={BUTTON}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === last}
          className={BUTTON}
        >
          Next
        </button>
      </div>
    </section>
  );
}
