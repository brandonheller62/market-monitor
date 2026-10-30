import type { Metadata } from "next";

export const metadata: Metadata = { title: "Closing Questions · Market Monitor" };

const QUESTIONS = [
  "If you could own one stock from our portfolio tomorrow, which would you pick and why?",
  "Which stock would you sell first?",
  "Would you buy Alphabet (GOOGL) after today’s drop, or wait?",
  "Would you buy Crocs (CROX) after today’s gain, or wait?",
  "What’s one thing that could happen next week that would move our portfolio the most?",
];

export default function QuestionsPage() {
  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-10 sm:px-8">
      <header className="rise">
        <span className="eyebrow">Market Monitor · Discussion</span>
        <h1 className="display mt-5 text-[clamp(2rem,6vw,4.5rem)] leading-[1.02] text-white">
          Closing Questions
        </h1>
      </header>

      <ol className="section-rule mt-10">
        {QUESTIONS.map((q, i) => (
          <li
            key={q}
            className="flex gap-6 border-b border-[var(--line)] py-8 sm:gap-10"
          >
            <span className="data pt-2 text-sm text-[var(--accent)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="display max-w-[36ch] text-[clamp(1.375rem,3vw,2.25rem)] leading-snug text-[var(--paper)]">
              {q}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
