import type { ReactNode } from "react";

const SECTION = /^\*\*(.+?)\*\*:?\s*$/;

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyBase}-${i}`}>{part}</span>;
  });
}

/** Renders the subset of Markdown the notes are written in: sections, bullets, bold. */
export function renderMarkdown(md: string): ReactNode[] {
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
